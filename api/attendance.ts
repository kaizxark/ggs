/**
 * Attendance.
 *
 * ## Who may take a register
 *
 * The class teacher, and nobody else. `classrooms.class_teacher_id` holds the
 * `staff.id` responsible for a class; `staff.profile_id` links that staff record
 * to the login. The route resolves both from the session token and refuses
 * everybody else — including the super admin, an administrator or the
 * principal. They can read the register; they cannot mark it.
 *
 * That check lives here, not in the browser. The screen hides the buttons for a
 * caller who is not the class teacher, but a hidden button is not a permission:
 * a teacher's console could still POST another class's roster. The route is the
 * boundary.
 *
 * ## Why the register goes through the server
 *
 * The old screen wrote to Supabase from the browser, swallowed every error, and
 * then read its own localStorage copy back — so two teachers on two laptops saw
 * two different registers, and a saved mark never appeared on the pupil's
 * profile. This route reads and writes `public.attendance` with the service key,
 * records `recorded_by`, and writes `attendance_corrections` when an existing
 * mark changes. The browser only ever sees what the database actually holds.
 *
 * ## One mark per pupil per day
 *
 * The table has a unique key on `(student_id, attendance_date)`, so this is a
 * daily register, not a per-period one. The route upserts on that key.
 */

export const config = { runtime: "edge" };

import {
  resolveCaller,
  SERVICE_KEY,
  SUPABASE_URL,
  type Caller,
} from "../shared/ai-auth.js";
import {
  ATTENDANCE_THRESHOLD,
  attendancePercent,
  countsAsPresent,
  isAttendanceStatus,
  type AttendanceAbsenteeItem,
  type AttendanceBootstrap,
  type AttendanceClassOption,
  type AttendanceDaySummary,
  type AttendanceOverview,
  type AttendanceRosterStudent,
  type AttendanceSaveItem,
  type AttendanceStatus,
} from "../shared/attendance.js";

type Json = Record<string, unknown>;

/** Administrators review attendance; they never mark it. */
const MANAGERS = new Set(["super_admin", "admin", "principal"]);

/** Roles that could plausibly be a class teacher. */
const TEACHING_ROLES = new Set(["teacher", "faculty", "staff"]);

const MAX_BODY_BYTES = 120_000;
const MAX_ITEMS = 200;

function fail(
  message: string,
  status: number,
  code = "error",
  extra: Json = {}
): Response {
  return Response.json({ error: code, message, ...extra }, { status });
}

function serviceHeaders(json = false): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function restRows<T = Json>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: serviceHeaders(),
  });
  if (!res.ok) {
    throw new Error(`${table}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T[];
}

/**
 * Read every matching row, not just the first page.
 *
 * PostgREST caps one response at 1,000 rows. The old attendance query asked for
 * a whole class's history in one go, so a school with more than a few weeks of
 * records silently computed "term attendance" from only the latest 1,000 rows.
 * This asks for the exact count first, then fetches the pages together.
 *
 * The cap exists so a pathological query cannot fan out into hundreds of
 * requests. It is high enough for a real school year and low enough to fail
 * loudly rather than hang.
 */
const PAGE_SIZE = 1_000;
const MAX_PAGES = 50;

async function restAllRows<T = Json>(
  table: string,
  select: string,
  filter: string,
  order = ""
): Promise<T[]> {
  const base = `select=${select}&${filter}${order ? `&${order}` : ""}`;
  const countRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${base}&limit=1`,
    { headers: { ...serviceHeaders(), Prefer: "count=exact" } }
  );
  if (!countRes.ok) {
    throw new Error(
      `${table} count: ${countRes.status} ${(await countRes.text()).slice(0, 200)}`
    );
  }
  const contentRange = countRes.headers.get("content-range") ?? "";
  const headerTotal = Number.parseInt(contentRange.split("/")[1] ?? "", 10);

  if (!Number.isFinite(headerTotal)) {
    // When the backend or mock environment does not supply a Content-Range header,
    // fetch all rows directly without pagination.
    const fallbackRes = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${base}`,
      { headers: serviceHeaders() }
    );
    if (!fallbackRes.ok) {
      throw new Error(
        `${table} fallback: ${fallbackRes.status} ${(await fallbackRes.text()).slice(0, 200)}`
      );
    }
    return (await fallbackRes.json()) as T[];
  }

  const total = headerTotal;
  if (total <= 0) return [];

  const pages = Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES);
  const results = await Promise.all(
    Array.from({ length: pages }, async (_, page) => {
      const offset = page * PAGE_SIZE;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?${base}&limit=${PAGE_SIZE}&offset=${offset}`,
        { headers: serviceHeaders() }
      );
      if (!res.ok) {
        throw new Error(
          `${table} page ${page}: ${res.status} ${(await res.text()).slice(0, 200)}`
        );
      }
      return (await res.json()) as T[];
    })
  );
  return results.flat();
}

/** The school the caller belongs to, read from their own profile row. */
async function callerOrganisation(caller: Caller): Promise<string | null> {
  const rows = await restRows<{ organisation_id?: string | null }>(
    "profiles",
    `select=organisation_id&id=eq.${encodeURIComponent(caller.id)}&limit=1`
  );
  const org = String(rows[0]?.organisation_id ?? "").trim();
  return org || null;
}

/* ------------------------------------------------------------------ */
/* Time                                                                */
/* ------------------------------------------------------------------ */

/**
 * Today's date in the school's timezone.
 *
 * The route runs on servers in several regions. A register taken at 00:30 IST
 * belongs to that Indian day, not to the previous UTC one, so the date is
 * formatted in Asia/Kolkata rather than from `new Date().toISOString()`.
 */
function todayInSchool(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** A strict YYYY-MM-DD date, or null. */
function isoDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === text ? text : null;
}

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

interface ClassroomRecord {
  id: string;
  grade: string;
  section: string;
  room: string | null;
  class_teacher_id: string | null;
}

interface StaffRecord {
  id: string;
  name: string;
  profile_id: string | null;
}

interface EnrollmentRecord {
  student_id: string;
  classroom_id: string;
  roll_no: string | null;
}

interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  usn: string | null;
}

/** The columns the arithmetic needs, without notes or ids. */
interface AttendanceRow {
  student_id: string;
  classroom_id: string | null;
  attendance_date: string;
  status: AttendanceStatus;
}

/** One saved mark for the selected day, including its remarks. */
interface AttendanceMarkRow extends AttendanceRow {
  id: string;
  notes: string | null;
}

interface Roster {
  id: string;
  name: string;
  usn: string;
  rollNo: string | null;
  status: AttendanceStatus | null;
  notes: string;
  termPresent: number;
  termTotal: number;
  termPercent: number;
}

function classLabel(room: ClassroomRecord): string {
  return `Grade ${room.grade} · ${room.section}`;
}

function initialsOf(first: string, last: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

async function loadClassrooms(orgId: string): Promise<ClassroomRecord[]> {
  const rooms = await restRows<ClassroomRecord>(
    "classrooms",
    `select=id,grade,section,room,class_teacher_id&organisation_id=eq.${encodeURIComponent(orgId)}` +
      `&order=grade.asc,section.asc`
  );
  return rooms
    .map((room) => ({
      id: String(room.id),
      grade: String(room.grade ?? ""),
      section: String(room.section ?? ""),
      room: room.room ? String(room.room) : null,
      class_teacher_id: room.class_teacher_id ? String(room.class_teacher_id) : null,
    }))
    // `order=grade.asc` sorts the grade column as text, which puts "10" before
    // "6". A register list should read 6, 7, 8, 9, 10.
    .sort((a, b) => {
      const ga = Number.parseInt(a.grade, 10);
      const gb = Number.parseInt(b.grade, 10);
      if (Number.isFinite(ga) && Number.isFinite(gb) && ga !== gb) return ga - gb;
      return a.grade.localeCompare(b.grade) || a.section.localeCompare(b.section);
    });
}

async function loadStaff(orgId: string): Promise<StaffRecord[]> {
  return restRows<StaffRecord>(
    "staff",
    `select=id,name,profile_id&organisation_id=eq.${encodeURIComponent(orgId)}&active=eq.true`
  );
}

async function loadEnrollments(
  orgId: string,
  classroomIds: string[]
): Promise<EnrollmentRecord[]> {
  if (classroomIds.length === 0) return [];
  return restAllRows<EnrollmentRecord>(
    "enrollments",
    "student_id,classroom_id,roll_no",
    `organisation_id=eq.${encodeURIComponent(orgId)}` +
      `&active=eq.true&classroom_id=in.(${classroomIds.join(",")})`
  );
}

async function loadStudents(
  orgId: string,
  studentIds: string[]
): Promise<StudentRecord[]> {
  if (studentIds.length === 0) return [];
  return restAllRows<StudentRecord>(
    "students",
    "id,first_name,last_name,usn",
    `organisation_id=eq.${encodeURIComponent(orgId)}` +
      `&id=in.(${studentIds.join(",")})`
  );
}

/**
 * Every recorded mark for the visible classes.
 *
 * This is the term-to-date denominator: notes are deliberately left out (only
 * the selected day needs them), which keeps a year of records small.
 */
async function loadAttendance(
  orgId: string,
  classroomIds: string[]
): Promise<AttendanceRow[]> {
  if (classroomIds.length === 0) return [];
  return restAllRows<AttendanceRow>(
    "attendance",
    "student_id,classroom_id,attendance_date,status",
    `organisation_id=eq.${encodeURIComponent(orgId)}` +
      `&classroom_id=in.(${classroomIds.join(",")})`,
    "order=attendance_date.desc"
  );
}

/** The selected day's marks, with their remarks. */
async function loadDayMarks(
  orgId: string,
  classroomIds: string[],
  date: string
): Promise<AttendanceMarkRow[]> {
  if (classroomIds.length === 0) return [];
  return restAllRows<AttendanceMarkRow>(
    "attendance",
    "id,student_id,classroom_id,attendance_date,status,notes",
    `organisation_id=eq.${encodeURIComponent(orgId)}` +
      `&classroom_id=in.(${classroomIds.join(",")})` +
      `&attendance_date=eq.${encodeURIComponent(date)}`
  );
}

/** Stable order: roll number when it is numeric, then name. */
function compareRoster(a: Roster, b: Roster): number {
  const ra = Number.parseInt(String(a.rollNo ?? ""), 10);
  const rb = Number.parseInt(String(b.rollNo ?? ""), 10);
  if (Number.isFinite(ra) && Number.isFinite(rb) && ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name);
}

/* ------------------------------------------------------------------ */
/* Assembling the bootstrap                                            */
/* ------------------------------------------------------------------ */

function summariseDay(date: string, rows: AttendanceRow[]): AttendanceDaySummary {
  let present = 0;
  let absent = 0;
  let late = 0;
  let leave = 0;
  for (const row of rows) {
    if (row.attendance_date !== date) continue;
    if (row.status === "present") present += 1;
    else if (row.status === "absent") absent += 1;
    else if (row.status === "late") late += 1;
    else if (row.status === "leave") leave += 1;
  }
  const marked = present + absent + late + leave;
  return {
    date,
    present,
    absent,
    late,
    leave,
    marked,
    percent: attendancePercent(present + late, marked),
  };
}

function buildOverview(
  rows: AttendanceRow[],
  date: string,
  studentIds: string[],
  classes: AttendanceClassOption[]
): AttendanceOverview {
  const dates = Array.from(new Set(rows.map((row) => row.attendance_date))).sort();
  const recent = dates.slice(-7).map((d) => summariseDay(d, rows));

  const daySummary = summariseDay(date, rows);

  const perStudent = new Map<string, { total: number; present: number }>();
  for (const row of rows) {
    if (!studentIds.includes(row.student_id)) continue;
    const entry = perStudent.get(row.student_id) ?? { total: 0, present: 0 };
    entry.total += 1;
    if (countsAsPresent(row.status)) entry.present += 1;
    perStudent.set(row.student_id, entry);
  }
  let belowThreshold = 0;
  for (const entry of perStudent.values()) {
    if (entry.total > 0 && attendancePercent(entry.present, entry.total) < ATTENDANCE_THRESHOLD) {
      belowThreshold += 1;
    }
  }

  const classesTotal = classes.length;
  const classesMarked = classes.filter((c) => Boolean(c.isMarked)).length;
  const classesPending = classes.filter((c) => (c.markedToday ?? 0) === 0).length;
  const totalStudents = classes.reduce((sum, c) => sum + (c.studentCount ?? 0), 0);

  return {
    daily: recent,
    todayPresent: daySummary.present + daySummary.late,
    todayMarked: daySummary.marked,
    todayPercent: daySummary.percent,
    todayAbsent: daySummary.absent,
    todayLate: daySummary.late,
    todayLeave: daySummary.leave,
    belowThreshold,
    totalStudents,
    classesMarked,
    classesPending,
    classesTotal,
  };
}

function buildRoster(
  classroomId: string,
  enrollments: EnrollmentRecord[],
  students: StudentRecord[],
  summaryRows: AttendanceRow[],
  dayMarks: AttendanceMarkRow[]
): AttendanceRosterStudent[] {
  const studentById = new Map(students.map((student) => [student.id, student]));
  const rowByStudent = new Map<string, AttendanceMarkRow>();
  const termByStudent = new Map<string, { total: number; present: number }>();

  for (const row of dayMarks) {
    if (row.classroom_id !== classroomId) continue;
    rowByStudent.set(row.student_id, row);
  }

  for (const row of summaryRows) {
    if (row.classroom_id !== classroomId) continue;
    const term = termByStudent.get(row.student_id) ?? { total: 0, present: 0 };
    term.total += 1;
    if (countsAsPresent(row.status)) term.present += 1;
    termByStudent.set(row.student_id, term);
  }

  const roster: Roster[] = [];
  for (const enrollment of enrollments) {
    if (enrollment.classroom_id !== classroomId) continue;
    const student = studentById.get(enrollment.student_id);
    if (!student) continue;
    const term = termByStudent.get(student.id) ?? { total: 0, present: 0 };
    const mark = rowByStudent.get(student.id);
    roster.push({
      id: student.id,
      name: `${student.first_name} ${student.last_name}`.trim(),
      usn: String(student.usn ?? "").trim(),
      rollNo: enrollment.roll_no ? String(enrollment.roll_no) : null,
      status: mark?.status ?? null,
      notes: String(mark?.notes ?? ""),
      termPresent: term.present,
      termTotal: term.total,
      termPercent: attendancePercent(term.present, term.total),
    });
  }

  roster.sort(compareRoster);
  return roster.map((student) => ({
    ...student,
    initials: initialsOf(
      student.name.split(" ")[0] ?? "",
      student.name.split(" ").slice(-1)[0] ?? ""
    ),
  }));
}

function buildClassOptions(
  classrooms: ClassroomRecord[],
  staffById: Map<string, StaffRecord>,
  enrollments: EnrollmentRecord[],
  students: StudentRecord[],
  rows: AttendanceRow[],
  dayMarks: AttendanceMarkRow[],
  date: string,
  today: string,
  staffId: string,
  managerView: boolean
): AttendanceClassOption[] {
  const studentById = new Map(students.map((student) => [student.id, student]));

  return classrooms.map((room) => {
    const classRows = rows.filter((row) => row.classroom_id === room.id);
    const total = classRows.length;
    const present = classRows.filter((row) => countsAsPresent(row.status)).length;

    // Daily marks for this classroom on the queried date:
    const classDayMarks = dayMarks.filter((row) => row.classroom_id === room.id);
    const markedToday = classDayMarks.length;
    const presentToday = classDayMarks.filter((row) => countsAsPresent(row.status)).length;
    const absentToday = classDayMarks.filter((row) => row.status === "absent").length;
    const lateToday = classDayMarks.filter((row) => row.status === "late").length;
    const leaveToday = classDayMarks.filter((row) => row.status === "leave").length;

    const studentCount = enrollments.filter(
      (enrollment) => enrollment.classroom_id === room.id
    ).length;

    const teacher = room.class_teacher_id
      ? staffById.get(room.class_teacher_id)
      : undefined;

    const absentees: AttendanceAbsenteeItem[] = [];
    for (const mark of classDayMarks) {
      if (mark.status === "absent" || mark.status === "leave" || mark.status === "late") {
        const student = studentById.get(mark.student_id);
        const enrollment = enrollments.find(
          (e) => e.student_id === mark.student_id && e.classroom_id === room.id
        );
        if (student) {
          absentees.push({
            id: student.id,
            name: `${student.first_name} ${student.last_name}`.trim(),
            rollNo: enrollment?.roll_no ? String(enrollment.roll_no) : null,
            status: mark.status,
            notes: String(mark.notes ?? "").trim(),
          });
        }
      }
    }

    return {
      id: room.id,
      label: classLabel(room),
      grade: room.grade,
      section: room.section,
      room: room.room ?? "",
      classTeacherId: room.class_teacher_id,
      classTeacherName: teacher?.name ?? null,
      studentCount,
      // Administrators review; only the assigned class teacher marks.
      canMark:
        !managerView &&
        Boolean(staffId) &&
        room.class_teacher_id === staffId,
      termPercent: attendancePercent(present, total),
      presentToday,
      markedToday,
      absentToday,
      lateToday,
      leaveToday,
      todayPercent: attendancePercent(presentToday, markedToday),
      isMarked: studentCount > 0 && markedToday >= studentCount,
      absentees,
    };
  });
}

/* ------------------------------------------------------------------ */
/* GET                                                                 */
/* ------------------------------------------------------------------ */

async function bootstrap(caller: Caller, orgId: string, url: URL): Promise<AttendanceBootstrap> {
  const managerView = MANAGERS.has(caller.role) || caller.superAdmin;
  const today = todayInSchool();
  const requestedDate = isoDate(url.searchParams.get("date")) ?? today;
  const requestedClass = String(url.searchParams.get("classroomId") ?? "").trim();

  const [classrooms, staff] = await Promise.all([
    loadClassrooms(orgId),
    loadStaff(orgId),
  ]);
  const staffById = new Map(staff.map((member) => [member.id, member]));
  const me = staff.find((member) => member.profile_id === caller.id) ?? null;
  const staffId = me?.id ?? "";

  // A teacher sees only the classes they are responsible for. Administrators
  // see every class, read-only.
  const visible = managerView
    ? classrooms
    : classrooms.filter((room) => Boolean(staffId) && room.class_teacher_id === staffId);

  const visibleIds = visible.map((room) => room.id);
  const [enrollments, rows, dayMarks] = await Promise.all([
    loadEnrollments(orgId, visibleIds),
    loadAttendance(orgId, visibleIds),
    loadDayMarks(orgId, visibleIds, requestedDate),
  ]);

  const studentIds = Array.from(
    new Set(enrollments.map((enrollment) => enrollment.student_id))
  );
  const students = await loadStudents(orgId, studentIds);

  const classes = buildClassOptions(
    visible,
    staffById,
    enrollments,
    students,
    rows,
    dayMarks,
    requestedDate,
    today,
    staffId,
    managerView
  );

  const selected =
    classes.find((option) => option.id === requestedClass) ?? classes[0] ?? null;
  const roster = selected
    ? buildRoster(selected.id, enrollments, students, rows, dayMarks)
    : [];

  let message = "";
  if (classes.length === 0) {
    if (managerView) {
      message = "No classes exist yet. Create a class before taking attendance.";
    } else if (caller.role === "parent" || caller.role === "student") {
      message = "Attendance is taken by class teachers. Your own attendance is on your profile.";
    } else if (!me) {
      message =
        "Your login is not linked to a staff record yet, so it cannot take attendance. Ask an administrator to link it.";
    } else {
      message =
        `${me.name} is not the class teacher of any class yet. Ask an administrator to assign a class.`;
    }
  }

  return {
    date: requestedDate,
    today,
    role: caller.role,
    managerView,
    canMarkAny: classes.some((option) => option.canMark),
    classes,
    selectedClassroomId: selected?.id ?? null,
    selectedClass: selected,
    roster,
    overview: buildOverview(rows, requestedDate, studentIds, classes),
    message,
  };
}

/* ------------------------------------------------------------------ */
/* POST                                                                */
/* ------------------------------------------------------------------ */

interface SaveBody {
  classroomId?: unknown;
  date?: unknown;
  reason?: unknown;
  items?: unknown;
}

async function save(
  caller: Caller,
  orgId: string,
  body: SaveBody
): Promise<Response> {
  const managerView = MANAGERS.has(caller.role) || caller.superAdmin;
  if (managerView) {
    return fail(
      "Attendance is recorded by the class teacher. Administrators can review the register but cannot mark it.",
      403,
      "manager_read_only"
    );
  }

  if (!TEACHING_ROLES.has(caller.role)) {
    return fail(
      "Only the class teacher can record attendance.",
      403,
      "forbidden"
    );
  }

  const classroomId = String(body.classroomId ?? "").trim();
  if (!classroomId) {
    return fail("Choose a class first.", 400, "missing_class");
  }

  const date = isoDate(body.date);
  if (!date) {
    return fail("Choose a valid date (YYYY-MM-DD).", 400, "bad_date");
  }
  if (date > todayInSchool()) {
    return fail("Attendance cannot be taken for a future date.", 422, "future_date");
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return fail("There are no pupils to mark.", 400, "empty_register");
  }
  if (items.length > MAX_ITEMS) {
    return fail("That register is too large.", 413, "too_large");
  }

  const [classrooms, staff] = await Promise.all([
    loadClassrooms(orgId),
    loadStaff(orgId),
  ]);
  const classroom = classrooms.find((room) => room.id === classroomId);
  if (!classroom) {
    return fail("That class does not belong to your school.", 404, "unknown_class");
  }

  const me = staff.find((member) => member.profile_id === caller.id) ?? null;
  if (!me) {
    return fail(
      "Your login is not linked to a staff record, so it cannot take attendance.",
      403,
      "no_staff_record"
    );
  }
  if (classroom.class_teacher_id !== me.id) {
    return fail(
      `Only the class teacher of ${classLabel(classroom)} can take attendance.`,
      403,
      "not_class_teacher"
    );
  }

  // Validate every item and make sure the register covers the real roster.
  const clean: AttendanceSaveItem[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const item = raw as Json;
    const studentId = String(item?.studentId ?? "").trim();
    const status = item?.status;
    if (!studentId) {
      return fail("A pupil in the register is missing an id.", 400, "bad_item");
    }
    if (seen.has(studentId)) {
      return fail("The same pupil appears twice in the register.", 400, "duplicate_pupil");
    }
    if (!isAttendanceStatus(status)) {
      return fail("Choose Present, Late, Leave or Absent for every pupil.", 400, "bad_status");
    }
    seen.add(studentId);
    clean.push({
      studentId,
      status,
      notes: String(item?.notes ?? "").trim().slice(0, 500) || undefined,
    });
  }

  const enrollments = await loadEnrollments(orgId, [classroomId]);
  const rosterIds = new Set(
    enrollments
      .filter((enrollment) => enrollment.classroom_id === classroomId)
      .map((enrollment) => enrollment.student_id)
  );
  if (rosterIds.size === 0) {
    return fail("This class has no active pupils to mark.", 422, "empty_class");
  }
  for (const item of clean) {
    if (!rosterIds.has(item.studentId)) {
      return fail(
        "A pupil in this register is no longer enrolled in the class. Reload and try again.",
        409,
        "roster_changed"
      );
    }
  }
  if (clean.length !== rosterIds.size) {
    return fail(
      `Mark every pupil before saving. ${rosterIds.size - clean.length} still have no status.`,
      422,
      "incomplete_register",
      { missing: rosterIds.size - clean.length }
    );
  }

  const studentIds = clean.map((item) => item.studentId);
  const existing = await restRows<{ id: string; student_id: string; status: AttendanceStatus }>(
    "attendance",
    `select=id,student_id,status&organisation_id=eq.${encodeURIComponent(orgId)}` +
      `&attendance_date=eq.${date}&student_id=in.(${studentIds.join(",")})`
  );
  const existingByStudent = new Map(existing.map((row) => [row.student_id, row]));

  const payload = clean.map((item) => ({
    organisation_id: orgId,
    student_id: item.studentId,
    classroom_id: classroomId,
    attendance_date: date,
    status: item.status,
    notes: item.notes ?? null,
    recorded_by: caller.id,
  }));

  const write = await fetch(
    `${SUPABASE_URL}/rest/v1/attendance?on_conflict=student_id,attendance_date`,
    {
      method: "POST",
      headers: {
        ...serviceHeaders(true),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!write.ok) {
    console.error("attendance upsert failed", write.status, (await write.text()).slice(0, 300));
    return fail(
      "The register could not be saved. Check that this server can reach the database.",
      502,
      "save_failed"
    );
  }

  // Keep the audit trail the schema asks for: a mark that changes after being
  // recorded leaves a before/after row, so a later dispute is answerable.
  const reason =
    String(body.reason ?? "").trim().slice(0, 500) ||
    "Register updated by the class teacher.";
  const corrections = clean
    .map((item) => {
      const before = existingByStudent.get(item.studentId);
      if (!before || before.status === item.status) return null;
      return {
        organisation_id: orgId,
        student_id: item.studentId,
        attendance_id: before.id,
        attendance_date: date,
        from_status: before.status,
        to_status: item.status,
        reason,
        corrected_by: caller.id,
      };
    })
    .filter(Boolean) as Json[];

  if (corrections.length > 0) {
    const audit = await fetch(`${SUPABASE_URL}/rest/v1/attendance_corrections`, {
      method: "POST",
      headers: serviceHeaders(true),
      body: JSON.stringify(corrections),
    });
    if (!audit.ok) {
      // The register itself is saved; a failed audit write must not pretend
      // otherwise. Log it loudly so it can be repaired.
      console.error(
        "attendance correction audit failed",
        audit.status,
        (await audit.text()).slice(0, 300)
      );
    }
  }

  let present = 0;
  let absent = 0;
  let late = 0;
  let leave = 0;
  for (const item of clean) {
    if (item.status === "present") present += 1;
    else if (item.status === "absent") absent += 1;
    else if (item.status === "late") late += 1;
    else leave += 1;
  }
  const marked = present + absent + late + leave;

  return Response.json({
    ok: true,
    message: `${classLabel(classroom)} attendance saved for ${date}.`,
    summary: {
      present,
      absent,
      late,
      leave,
      marked,
      percent: attendancePercent(present + late, marked),
    },
  });
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export default async function handler(req: Request): Promise<Response> {
  const caller = await resolveCaller(req);
  if (!caller) {
    return fail("Sign in to continue.", 401, "unauthorized");
  }

  let orgId: string | null;
  try {
    orgId = await callerOrganisation(caller);
  } catch {
    return fail(
      "The school could not be loaded. Check that this server can reach the database.",
      502,
      "database_unreachable"
    );
  }
  if (!orgId) {
    return fail("Your account is not attached to a school.", 403, "no_school");
  }

  if (req.method === "GET") {
    try {
      const url = new URL(req.url);
      return Response.json(await bootstrap(caller, orgId, url), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      console.error("attendance bootstrap failed", error);
      return fail("The attendance register could not be loaded.", 502, "load_failed");
    }
  }

  if (req.method !== "POST") {
    return fail("Use GET or POST for this route.", 405, "method_not_allowed");
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return fail("That register is too large to save.", 413, "too_large");
  }

  let body: SaveBody;
  try {
    body = JSON.parse(raw) as SaveBody;
  } catch {
    return fail("The request body was not valid JSON.", 400, "bad_json");
  }

  try {
    return await save(caller, orgId, body);
  } catch (error) {
    console.error("attendance save failed", error);
    return fail(
      "The register could not be saved. Check that this server can reach the database.",
      502,
      "save_failed"
    );
  }
}

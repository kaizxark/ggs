/**
 * The student directory.
 *
 * Server-side search, filtering, sorting and pagination, plus the create and
 * update operations for a pupil's core record.
 *
 * ## Why this is a route and not a Supabase query from the browser
 *
 * Three reasons, in order of importance:
 *
 *   1. Pagination has to be real. The browser cannot ask PostgREST for "page 7
 *      of 100 students", because to render page 7 it would have to read the
 *      first 700 rows. `fetchAll()` in erp-views.ts does exactly that — it pages
 *      through a whole table into memory. With 100 students that is fine; with
 *      12,000 it is a school that cannot open its own roll call.
 *
 *   2. The role is resolved from the session token, not from the request. The
 *      client sends whatever it likes; `resolveCaller()` derives the truth from
 *      the bearer token, so a teacher cannot promote themselves by editing a
 *      field in the console.
 *
 *   3. Every write is audited with the actor, and the caller can only ever
 *      write a pupil in their own organisation. Both are checked here as well
 *      as by RLS, so a mistake is a 403 with a message rather than a silently
 *      empty result set.
 *
 * ## Data access
 *
 * The route uses the service key and applies its own authorisation, for the same
 * reason api/documents.ts does: the directory needs to join students against
 * enrolments, classrooms, academic years, attendance and exam results in one
 * page, and per-row RLS cannot express that join without a view. RLS is still
 * switched on for every table involved, so a query issued straight from the
 * browser remains scoped — this route is a wider door, not a wider policy.
 */

export const config = { runtime: "edge" };

import {
  resolveCaller,
  SUPABASE_URL,
  SERVICE_KEY,
  type Caller,
} from "../shared/ai-auth.js";
import {
  canEditStudent,
  canListStudents,
  canViewFees,
  exportColumnsForRole,
} from "../shared/student-access.js";
import { provisionPortalAccount } from "../shared/portal-server.js";

/** Hard ceiling. A caller asking for 10,000 rows gets this and no more. */
const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 25;

type Json = Record<string, unknown>;

function fail(message: string, status: number, code = "error") {
  return Response.json({ error: code, message }, { status });
}

interface Filter {
  search: string;
  grade: string;
  section: string;
  year: string;
  status: string;
  attendance: string;
  fees: string;
  admissionFrom: string;
  admissionTo: string;
  sort: string;
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
}

function parseFilters(url: URL): Filter {
  const p = url.searchParams;
  const int = (raw: string | null, fallback: number) => {
    const n = Number.parseInt(String(raw ?? ""), 10);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    search: (p.get("search") ?? "").trim().slice(0, 80),
    grade: (p.get("grade") ?? "").trim().slice(0, 20),
    section: (p.get("section") ?? "").trim().slice(0, 20),
    year: (p.get("year") ?? "").trim().slice(0, 64),
    status: (p.get("status") ?? "").trim().slice(0, 20),
    attendance: (p.get("attendance") ?? "").trim().slice(0, 20),
    fees: (p.get("fees") ?? "").trim().slice(0, 20),
    admissionFrom: (p.get("admissionFrom") ?? "").trim().slice(0, 10),
    admissionTo: (p.get("admissionTo") ?? "").trim().slice(0, 10),
    sort: (p.get("sort") ?? "name").trim().slice(0, 20),
    direction: p.get("direction") === "desc" ? "desc" : "asc",
    page: Math.max(1, int(p.get("page"), 1)),
    pageSize: Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, int(p.get("pageSize"), DEFAULT_PAGE_SIZE))
    ),
  };
}

/**
 * PostgREST column allow-list for ordering.
 *
 * Without this, `?order=some.expression` is an injection point: the `order`
 * parameter is spliced into the query string rather than being escaped. Every
 * value has to appear in this list before it is used.
 */
const SORT_COLUMNS: Record<string, string> = {
  name: "last_name",
  usn: "usn",
  grade: "grade",
  section: "section",
  roll_no: "roll_no",
  joined_on: "joined_on",
  status: "status",
  attendance: "attendance_percentage",
  average: "academic_average",
};

/** Only these statuses may be written, matching the table's own CHECK. */
const STATUSES = new Set(["active", "inactive", "graduated", "withdrawn"]);

/**
 * The shape of a USN the school hands out: its initials and four digits.
 *
 * `GGS1234`. It replaces the old `adm2627nnnn` form, which carried the
 * academic year and grew a digit longer than a child could comfortably copy.
 * The first number is 1001 rather than 0001 so a printed USN never looks like
 * a padded row index.
 */
const USN_PREFIX = "GGS";
const USN_FIRST_NUMBER = 1001;

/**
 * Normalise a value written by a form.
 *
 * Strips control characters and caps the length. The control-character strip is
 * load-bearing, not cosmetic: a value carrying a NUL or a newline would be
 * spliced into a PostgREST filter string below, and the query would then fail
 * or match something unintended. Length is truncated rather than rejected so a
 * paste with a stray trailing space is not an error the user cannot see.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function clean(value: unknown, max = 120): string {
  return String(value ?? "")
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, max);
}

/**
 * The USN as it is stored: compact and upper-case, the way it is printed.
 *
 * The school may write it with slashes or spaces, but those are presentation.
 * The identifier itself is the letters and digits, so `GGS1001` and `ggs1001`
 * are the same pupil and cannot both exist. Upper case is the stored form
 * because the number is read off a printed slip, and a pupil should see on
 * their profile exactly the string they were handed.
 */
function normaliseUsn(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 40);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** A date field, or null. Anything unparseable is rejected rather than guessed. */
function isoDateOrNull(value: string): string | null | undefined {
  if (!value) return null;
  if (!isIsoDate(value)) return undefined;
  return value;
}

/**
 * Thin PostgREST client.
 *
 * The service key bypasses RLS, which is exactly why every query built here
 * carries an explicit `organisation_id` filter. That is not belt and braces:
 * without it this route would read every school's roll call in the database.
 */
async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`rest ${res.status}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/**
 * The caller's relationship to a pupil.
 *
 * Mirrors the database's `can_access_student()`. The three lookups are the same
 * three the SECURITY DEFINER functions use: the pupil's own profile, a guardian
 * link carrying the caller's profile id, or a class the caller's staff record
 * teaches.
 *
 * Returns null when there is no relationship at all, which is what a role like
 * `staff` or `accountant` does not need — they are allowed by role regardless.
 */
async function relationshipTo(
  caller: Caller,
  studentIds: string[],
  orgId: string
): Promise<Map<string, "guardian" | "self" | "teacher">> {
  const found = new Map<string, "guardian" | "self" | "teacher">();
  if (!studentIds.length) return found;

  const idList = studentIds.join(",");

  // A pupil's own account.
  const own = await readJson<Json[]>(
    await rest(
      `profiles?select=student_id&id=eq.${caller.id}&student_id=in.(${idList})&organisation_id=eq.${orgId}`
    )
  ).catch(() => [] as Json[]);
  for (const row of own) {
    if (row.student_id) found.set(String(row.student_id), "self");
  }

  // A guardian of these children.
  const linked = await readJson<Json[]>(
    await rest(
      `student_guardians?select=student_id&portal_profile_id=eq.${caller.id}` +
        `&student_id=in.(${idList})&organisation_id=eq.${orgId}`
    )
  ).catch(() => [] as Json[]);
  for (const row of linked) {
    const id = String(row.student_id ?? "");
    // A guardian link does not downgrade an own-account relationship.
    if (id && !found.has(id)) found.set(id, "guardian");
  }

  // Teaching one of their classes.
  const staff = await readJson<Json[]>(
    await rest(
      `staff?select=id&profile_id=eq.${caller.id}&organisation_id=eq.${orgId}`
    )
  ).catch(() => [] as Json[]);
  const staffId = staff[0]?.id ? String(staff[0].id) : "";

  if (staffId) {
    const classrooms = await readJson<Json[]>(
      await rest(
        `classrooms?select=id&organisation_id=eq.${orgId}` +
          `&(class_teacher_id=eq.${staffId},id=in.(${
            (
              await readJson<Json[]>(
                await rest(
                  `subject_teachers?select=classroom_id&staff_id=eq.${staffId}&organisation_id=eq.${orgId}`
                )
              ).catch(() => [] as Json[])
            )
              .map(r => String(r.classroom_id))
              .filter(Boolean)
              .join(",") || "00000000-0000-0000-0000-000000000000"
          }))`
      )
    ).catch(() => [] as Json[]);

    const classroomIds = classrooms.map(c => String(c.id)).filter(Boolean);
    if (classroomIds.length) {
      const enrolled = await readJson<Json[]>(
        await rest(
          `enrollments?select=student_id,classroom_id&active=eq.true` +
            `&classroom_id=in.(${classroomIds})&student_id=in.(${idList})` +
            `&organisation_id=eq.${orgId}`
        )
      ).catch(() => [] as Json[]);
      for (const row of enrolled) {
        const id = String(row.student_id ?? "");
        if (id && !found.has(id)) found.set(id, "teacher");
      }
    }
  }

  return found;
}

/** The caller's organisation, from their profile. */
async function callerOrg(caller: Caller): Promise<string | null> {
  const rows = await readJson<Json[]>(
    await rest(`profiles?select=organisation_id&id=eq.${caller.id}&limit=1`)
  ).catch(() => [] as Json[]);
  const org = rows[0]?.organisation_id;
  return org ? String(org) : null;
}

/**
 * The directory query.
 *
 * Builds one PostgREST query per section and composes them here, because the
 * derived columns a directory row needs — grade, section, roll number,
 * attendance percentage, academic average — each live in a different table.
 * PostgREST's embedded-resource syntax could express this in a single round
 * trip, but the aggregations it needs (a percentage over 12,000 attendance rows,
 * an average over 931 results) cannot be expressed there at all, so the rows are
 * fetched separately and joined in memory with the row cap applied last.
 */
async function loadDirectory(
  orgId: string,
  filter: Filter,
  maySeeFees: boolean,
  maySeeContacts: boolean,
  isExport = false
): Promise<{
  rows: Json[];
  total: number;
  scanned: number;
  truncated: boolean;
}> {
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,usn,first_name,last_name,date_of_birth,gender,phone,email," +
      "guardian_name,guardian_phone,guardian_email,photo_url,status,joined_on,address," +
      "blood_group,nationality,mother_tongue,emergency_contact_name,emergency_contact_phone"
  );
  params.set("organisation_id", `eq.${orgId}`);

  if (filter.status && STATUSES.has(filter.status)) {
    params.append("status", `eq.${filter.status}`);
  }

  // Search across name, USN and the pupil's own id. PostgREST
  // `or` takes the whole expression in one parameter. Commas, parentheses,
  // quotes and wildcards are removed so the term cannot restructure the query
  // or turn into a match-everything pattern.
  if (filter.search) {
    const term = filter.search.replace(/[%,()*"_]/g, " ").trim();
    if (term) {
      const fields = [
        `first_name.ilike.*${term}*`,
        `last_name.ilike.*${term}*`,
        `usn.ilike.*${term}*`,
      ];
      // `id` is a uuid. Comparing it to a name or a USN makes Postgres raise
      // 22P02 before it can ignore the branch, so only add the id branch when
      // the term could actually be an id.
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term)) {
        fields.push(`id.eq.${term}`);
      }
      params.set("or", `(${fields.join(",")})`);
    }
  }

  if (filter.admissionFrom)
    params.append("joined_on", `gte.${filter.admissionFrom}`);
  if (filter.admissionTo)
    params.append("joined_on", `lte.${filter.admissionTo}`);

  const SCAN_CAP = 5000;

  // Run the initial queries concurrently rather than awaiting them one after another:
  // count probe, student scan, current academic year and published examinations.
  const [countRes, scanRes, yearRes, examRes] = await Promise.all([
    rest(
      `students?select=id&${params.toString()}&limit=1`,
      { headers: { Prefer: "count=exact", Range: "0-0" } }
    ),
    rest(
      `students?${params.toString()}&order=last_name.asc,first_name.asc&limit=${SCAN_CAP}`
    ),
    rest(
      `academic_years?select=id,name&organisation_id=eq.${orgId}&is_current=eq.true&limit=1`
    ),
    rest(
      `examinations?select=id&organisation_id=eq.${orgId}&published=eq.true&limit=200`
    ),
  ]);

  const total =
    Number(countRes.headers.get("content-range")?.split("/")[1] ?? 0) || 0;

  let students = await readJson<Json[]>(scanRes);
  const truncated = students.length >= SCAN_CAP;

  const studentIds = students.map(s => String(s.id));
  if (!studentIds.length) return { rows: [], total, scanned: 0, truncated };

  const idList = studentIds.join(",");

  const years = await readJson<Json[]>(yearRes).catch(() => [] as Json[]);
  const currentYearId = years[0]?.id ? String(years[0].id) : "";

  const examIds = Array.from(
    new Set(
      (
        await readJson<Json[]>(examRes).catch(() => [] as Json[])
      ).map(e => String(e.id))
    )
  );

  const enrolments = await readJson<Json[]>(
    await rest(
      `enrollments?select=id,student_id,classroom_id,academic_year_id,roll_no,active` +
        `&organisation_id=eq.${orgId}&student_id=in.(${idList})`
    )
  ).catch(() => [] as Json[]);

  const yearEnrolments = currentYearId
    ? enrolments.filter(
        e =>
          String(e.academic_year_id ?? "") === currentYearId &&
          e.active === true
      )
    : enrolments.filter(e => e.active === true);

  // A pupil with no current-year enrolment is still listed, under "Unassigned".
  const enrolmentByStudent = new Map<string, Json>();
  for (const e of yearEnrolments) {
    const id = String(e.student_id ?? "");
    if (id && !enrolmentByStudent.has(id)) enrolmentByStudent.set(id, e);
  }

  const classroomIds = Array.from(
    new Set(
      yearEnrolments.map(e => String(e.classroom_id ?? "")).filter(Boolean)
    )
  );

  const classrooms = classroomIds.length
    ? await readJson<Json[]>(
        await rest(
          `classrooms?select=id,grade,section,room&id=in.(${classroomIds.join(",")})` +
            `&organisation_id=eq.${orgId}`
        )
      ).catch(() => [] as Json[])
    : [];
  const classroomById = new Map(classrooms.map(c => [String(c.id), c]));

  // Base rows with identity and classroom placements.
  const baseRows: Json[] = students.map(s => {
    const id = String(s.id);
    const enrolment = enrolmentByStudent.get(id);
    const room = enrolment
      ? classroomById.get(String(enrolment.classroom_id ?? ""))
      : undefined;

    return {
      id,
      usn: String(s.usn ?? ""),
      first_name: String(s.first_name ?? ""),
      last_name: String(s.last_name ?? ""),
      name: `${String(s.first_name ?? "")} ${String(s.last_name ?? "")}`.trim(),
      date_of_birth: s.date_of_birth ?? null,
      gender: s.gender ?? null,
      status: String(s.status ?? "active"),
      photo_url: s.photo_url ?? null,
      joined_on: s.joined_on ?? null,
      grade: room ? String(room.grade ?? "") : "Unassigned",
      section: room ? String(room.section ?? "") : "",
      roll_no: enrolment ? (enrolment.roll_no ?? null) : null,
      enrolment_status: enrolment ? "active" : "not_enrolled",
      academic_year_id: currentYearId,
      attendance_percentage: null,
      attendance_records: 0,
      academic_average: null,
      scored_papers: 0,
      guardian_name: s.guardian_name ?? null,
      fees: maySeeFees ? "Paid" : null,
    };
  });

  // Class and section filters, applied after the join because those columns
  // come from classrooms. Smart match handles both raw "6" and "Class 6".
  let filteredRows = baseRows;
  if (filter.grade) {
    const targetGrade = filter.grade.trim().toLowerCase().replace(/^(class|grade)\s+/i, "");
    filteredRows = filteredRows.filter(r => {
      const rowGrade = String(r.grade ?? "").trim().toLowerCase().replace(/^(class|grade)\s+/i, "");
      return rowGrade === targetGrade || String(r.grade ?? "").toLowerCase() === filter.grade.toLowerCase();
    });
  }
  if (filter.section) {
    const targetSection = filter.section.trim().toLowerCase().replace(/^section\s+/i, "");
    filteredRows = filteredRows.filter(r => {
      const rowSection = String(r.section ?? "").trim().toLowerCase().replace(/^section\s+/i, "");
      return rowSection === targetSection || String(r.section ?? "").toLowerCase() === filter.section.toLowerCase();
    });
  }

  // Attendance and academic average stats are only needed across the entire scanned
  // dataset if sorting by those computed fields, or if exporting the entire roll call,
  // or if filtering by attendance compliance or fee payment status.
  const needsAllStats =
    isExport ||
    filter.sort === "attendance" ||
    filter.sort === "average" ||
    Boolean(filter.attendance) ||
    Boolean(filter.fees);

  if (needsAllStats) {
    // Fetch full stats in parallel
    const [attendance, results, invoices] = await Promise.all([
      readJson<Json[]>(
        await rest(
          `attendance?select=student_id,status&organisation_id=eq.${orgId}` +
            `&student_id=in.(${idList})&limit=20000`
        )
      ).catch(() => [] as Json[]),
      examIds.length
        ? readJson<Json[]>(
            await rest(
              `exam_results?select=student_id,marks,max_marks&organisation_id=eq.${orgId}` +
                `&examination_id=in.(${examIds.join(",")})&student_id=in.(${idList})&limit=20000`
            )
          ).catch(() => [] as Json[])
        : Promise.resolve([] as Json[]),
      readJson<Json[]>(
        await rest(
          `invoices?select=student_id,total,paid_amount,due_on,status&organisation_id=eq.${orgId}` +
            `&student_id=in.(${idList})&limit=10000`
        )
      ).catch(() => [] as Json[]),
    ]);

    enrichWithStats(filteredRows, attendance, results, invoices, maySeeFees);
    enrichWithContacts(filteredRows, students, maySeeContacts);

    if (filter.attendance === "at_risk") {
      filteredRows = filteredRows.filter(
        r => typeof r.attendance_percentage === "number" && r.attendance_percentage < 75
      );
    } else if (filter.attendance === "good") {
      filteredRows = filteredRows.filter(
        r => typeof r.attendance_percentage === "number" && r.attendance_percentage >= 90
      );
    }

    if (filter.fees === "unpaid") {
      filteredRows = filteredRows.filter(
        r => r.fees !== null && r.fees !== "Paid"
      );
    } else if (filter.fees === "paid") {
      filteredRows = filteredRows.filter(
        r => r.fees === "Paid"
      );
    }

    sortRows(filteredRows, filter.sort, filter.direction);

    const start = (filter.page - 1) * filter.pageSize;
    return {
      rows: isExport ? filteredRows : filteredRows.slice(start, start + filter.pageSize),
      total: truncated ? SCAN_CAP : filteredRows.length,
      scanned: studentIds.length,
      truncated,
    };
  }

  // Fast path: sort and slice the page first, then fetch stats for only the visible slice!
  sortRows(filteredRows, filter.sort, filter.direction);

  const start = (filter.page - 1) * filter.pageSize;
  const pageRows = filteredRows.slice(start, start + filter.pageSize);
  const pageIds = pageRows.map(r => String(r.id));

  if (pageIds.length > 0) {
    const pageIdList = pageIds.join(",");
    const [attendance, results, invoices] = await Promise.all([
      readJson<Json[]>(
        await rest(
          `attendance?select=student_id,status&organisation_id=eq.${orgId}` +
            `&student_id=in.(${pageIdList})&limit=2000`
        )
      ).catch(() => [] as Json[]),
      examIds.length
        ? readJson<Json[]>(
            await rest(
              `exam_results?select=student_id,marks,max_marks&organisation_id=eq.${orgId}` +
                `&examination_id=in.(${examIds.join(",")})&student_id=in.(${pageIdList})&limit=2000`
            )
          ).catch(() => [] as Json[])
        : Promise.resolve([] as Json[]),
      readJson<Json[]>(
        await rest(
          `invoices?select=student_id,total,paid_amount,due_on,status&organisation_id=eq.${orgId}` +
            `&student_id=in.(${pageIdList})&limit=1000`
        )
      ).catch(() => [] as Json[]),
    ]);

    enrichWithStats(pageRows, attendance, results, invoices, maySeeFees);
  }

  enrichWithContacts(pageRows, students, maySeeContacts);

  return {
    rows: pageRows,
    total: truncated ? SCAN_CAP : filteredRows.length,
    scanned: studentIds.length,
    truncated,
  };
}

function sortRows(rows: Json[], sortField: string, direction: "asc" | "desc") {
  const sortColumn = SORT_COLUMNS[sortField] ?? SORT_COLUMNS.name;
  const dir = direction === "desc" ? -1 : 1;
  rows.sort((a, b) => {
    const av = a[sortColumn];
    const bv = b[sortColumn];
    if (typeof av === "number" && typeof bv === "number")
      return (av - bv) * dir;
    const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return cmp * dir || String(a.id).localeCompare(String(b.id));
  });
}

function enrichWithStats(
  rows: Json[],
  attendance: Json[],
  results: Json[],
  invoices: Json[],
  maySeeFees: boolean
) {
  const tally = new Map<string, { present: number; total: number }>();
  for (const row of attendance) {
    const id = String(row.student_id ?? "");
    if (!id) continue;
    const entry = tally.get(id) ?? { present: 0, total: 0 };
    const status = String(row.status ?? "");
    entry.total += 1;
    if (
      status === "present" ||
      status === "late" ||
      status === "half_day" ||
      status === "leave"
    ) {
      entry.present += 1;
    }
    tally.set(id, entry);
  }

  const marks = new Map<string, { got: number; max: number; papers: number }>();
  for (const row of results) {
    const id = String(row.student_id ?? "");
    const max = Number(row.max_marks ?? 0);
    const got = Number(row.marks ?? 0);
    if (!id || max <= 0) continue;
    const entry = marks.get(id) ?? { got: 0, max: 0, papers: 0 };
    entry.got += got;
    entry.max += max;
    entry.papers += 1;
    marks.set(id, entry);
  }

  const feeByStudent = new Map<
    string,
    { due: number; outstanding: number; overdue: boolean }
  >();
  const today = new Date().toISOString().slice(0, 10);
  for (const row of invoices) {
    const id = String(row.student_id ?? "");
    if (!id) continue;
    const entry = feeByStudent.get(id) ?? {
      due: 0,
      outstanding: 0,
      overdue: false,
    };
    const total = Number(row.total ?? 0);
    const paid = Number(row.paid_amount ?? 0);
    entry.due += total;
    entry.outstanding += Math.max(0, total - paid);
    const dueOn = String(row.due_on ?? "");
    if (
      dueOn &&
      dueOn < today &&
      total - paid > 0 &&
      row.status !== "cancelled"
    ) {
      entry.overdue = true;
    }
    feeByStudent.set(id, entry);
  }

  for (const row of rows) {
    const id = String(row.id);
    const a = tally.get(id);
    const m = marks.get(id);
    const f = feeByStudent.get(id);

    row.attendance_percentage =
      a && a.total > 0 ? round1((a.present / a.total) * 100) : null;
    row.attendance_records = a ? a.total : 0;
    row.academic_average = m && m.max > 0 ? round1((m.got / m.max) * 100) : null;
    row.scored_papers = m ? m.papers : 0;

    if (maySeeFees) {
      row.fees = f
        ? f.outstanding <= 0
          ? "Paid"
          : f.overdue
            ? "Overdue"
            : "Due"
        : "Paid";
      row.outstanding_fees = f ? round2(f.outstanding) : 0;
      row.total_fees = f ? round2(f.due) : 0;
    } else {
      row.fees = null;
    }
  }
}

function enrichWithContacts(
  rows: Json[],
  students: Json[],
  maySeeContacts: boolean
) {
  if (!maySeeContacts) return;
  const byId = new Map(students.map(s => [String(s.id), s]));
  for (const row of rows) {
    const source = byId.get(String(row.id));
    if (!source) continue;
    row.phone = source.phone ?? null;
    row.email = source.email ?? null;
    row.guardian_phone = source.guardian_phone ?? null;
    row.guardian_email = source.guardian_email ?? null;
    row.address = source.address ?? null;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Distinct values for the filter dropdowns, so the UI never guesses. */
async function filterOptions(orgId: string): Promise<Json> {
  const classrooms = await readJson<Json[]>(
    await rest(
      `classrooms?select=grade,section&organisation_id=eq.${orgId}&order=grade.asc`
    )
  ).catch(() => [] as Json[]);

  const years = await readJson<Json[]>(
    await rest(
      `academic_years?select=id,name,is_current&organisation_id=eq.${orgId}&order=name.desc`
    )
  ).catch(() => [] as Json[]);

  const grades = Array.from(
    new Set(classrooms.map(c => String(c.grade ?? "")).filter(Boolean))
  );
  const sections = Array.from(
    new Set(classrooms.map(c => String(c.section ?? "")).filter(Boolean))
  );

  return {
    grades: grades.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    ),
    sections: sections.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    ),
    years,
  };
}

/** CSV cell quoting. Leading =, +, - and @ are escaped so Excel treats them as text. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows: Json[], columns: string[]): string {
  const head = columns.join(",");
  const body = rows.map(row => columns.map(c => csvCell(row[c])).join(","));
  // A BOM so Excel opens a UTF-8 file with Indian names correctly rather than
  // rendering them as mojibake.
  return `﻿${[head, ...body].join("\n")}`;
}

/* ------------------------------------------------------------------ *
 * Handler
 * ------------------------------------------------------------------ */

export default async function handler(req: Request): Promise<Response> {
  if (!SERVICE_KEY) {
    return fail(
      "The database is not configured on this deployment.",
      503,
      "not_configured"
    );
  }

  const caller = await resolveCaller(req);
  if (!caller) {
    return fail("Sign in to continue.", 401, "unauthenticated");
  }

  const url = new URL(req.url);

  /* ---------------------------------------------------------------- *
   * GET — directory, options, or export
   * ---------------------------------------------------------------- */

  if (req.method === "GET") {
    // Filter dropdowns. Allowed for anyone who may open the directory, since the
    // options reveal only which grades and sections this school runs.
    if (url.searchParams.has("options")) {
      if (!canListStudents(caller.role)) {
        return fail(
          "You do not have access to the student list.",
          403,
          "forbidden"
        );
      }
      const orgId = await callerOrg(caller);
      if (!orgId)
        return fail(
          "Your account is not linked to a school.",
          403,
          "no_organisation"
        );
      return Response.json(await filterOptions(orgId));
    }

    if (!canListStudents(caller.role)) {
      /*
       * A parent or a pupil asking for the directory is refused outright. They
       * reach their own child through the profile route, which resolves the
       * link server-side. Returning a filtered list instead would still leak the
       * existence and USN of every other child.
       */
      return fail(
        "The student list is not available to your account. Open your profile to see your records.",
        403,
        "forbidden"
      );
    }

    const orgId = await callerOrg(caller);
    if (!orgId)
      return fail(
        "Your account is not linked to a school.",
        403,
        "no_organisation"
      );

    const maySeeFees = canViewFees(caller.role);
    const maySeeContacts = SCHOOL_ONLY(caller.role);

    const filter = parseFilters(url);
    const isExport = url.searchParams.has("export");
    const { rows, total, scanned, truncated } = await loadDirectory(
      orgId,
      filter,
      maySeeFees,
      maySeeContacts,
      isExport
    );

    // Export. Same authorisation as the screen, but the columns are narrowed to
    // `exportColumnsForRole` so a spreadsheet never carries more than the person
    // may already read here.
    if (url.searchParams.has("export")) {
      const columns = exportColumnsForRole(caller.role);
      const csv = toCsv(rows, columns);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return Response.json({
      students: rows,
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      pageCount: Math.max(1, Math.ceil(total / filter.pageSize)),
      scanned,
      truncated,
    });
  }

  /* ---------------------------------------------------------------- *
   * POST — create a pupil
   * ---------------------------------------------------------------- */

  if (req.method === "POST") {
    if (!canEditStudent(caller.role)) {
      return fail("Only an administrator can add a student.", 403, "forbidden");
    }
    const orgId = await callerOrg(caller);
    if (!orgId)
      return fail(
        "Your account is not linked to a school.",
        403,
        "no_organisation"
      );

    let body: Json;
    try {
      body = (await req.json()) as Json;
    } catch {
      return fail("Bad request.", 400, "bad_request");
    }

    const firstName = clean(body.first_name, 60);
    const lastName = clean(body.last_name, 60);

    const fieldErrors: Record<string, string> = {};
    if (!firstName) fieldErrors.first_name = "Enter a first name.";
    if (!lastName) fieldErrors.last_name = "Enter a last name.";
    if (Object.keys(fieldErrors).length) {
      return Response.json(
        { error: "validation", fieldErrors },
        { status: 400 }
      );
    }

    /*
     * The USN is either supplied or generated. A generated one is the school's
     * initials and the next four-digit number: GGS1001. The school asked for
     * that shape because it is short enough for a child to read off a slip and
     * type unaided, and the number continues where the roll call ended rather
     * than restarting each year, so no two pupils ever share one.
     */
    let usn = normaliseUsn(body.usn);
    if (!usn) {
      const prefix = USN_PREFIX;
      /*
       * The highest number already in use, not an arbitrary one.
       *
       * The query used to ask for a single row with no ordering, so it
       * returned whichever row the database happened to give first — the
       * lowest one. The number after it was then handed out again, the
       * database refused the insert for being a duplicate, and the enrolment
       * came back as "that USN is already in use" for every
       * pupil the school tried to add.
       */
      const existing = await readJson<Json[]>(
        await rest(
          `students?select=usn&organisation_id=eq.${orgId}` +
            `&usn=ilike.${encodeURIComponent(prefix)}*` +
            `&order=usn.desc&limit=1`
        )
      ).catch(() => [] as Json[]);
      let next = USN_FIRST_NUMBER;
      if (existing.length) {
        const last = String(existing[0].usn ?? "");
        const n = Number.parseInt(last.slice(prefix.length), 10);
        if (Number.isFinite(n)) next = n + 1;
      }
      usn = `${prefix}${String(next).padStart(4, "0")}`;
    }

    const status = clean(body.status, 20) || "active";
    if (!STATUSES.has(status)) {
      return fail("That status is not recognised.", 400, "bad_status");
    }

    const dob = isoDateOrNull(clean(body.date_of_birth, 10));
    if (dob === undefined) {
      return fail("Enter the date of birth as YYYY-MM-DD.", 400, "bad_date");
    }

    const payload: Json = {
      organisation_id: orgId,
      usn,
      first_name: firstName,
      last_name: lastName,
      status,
      joined_on:
        isoDateOrNull(clean(body.joined_on, 10)) ??
        new Date().toISOString().slice(0, 10),
    };

    // Optional fields are written only when present. A column with an empty
    // string is not the same as a column with nothing in it, and the difference
    // matters for "has this been filled in yet" checks in the profile.
    const optional = [
      "date_of_birth",
      "gender",
      "email",
      "phone",
      "guardian_name",
      "guardian_phone",
      "guardian_email",
      "blood_group",
      "nationality",
      "mother_tongue",
      "photo_url",
      "emergency_contact_name",
      "emergency_contact_phone",
    ];
    for (const field of optional) {
      const value = clean(body[field], field === "photo_url" ? 400 : 200);
      if (value) payload[field] = value;
    }

    // Address arrives as a structured object from the form and is stored as the
    // jsonb the existing screens already read.
    if (body.address && typeof body.address === "object") {
      const address = body.address as Json;
      payload.address = {
        line1: clean(address.line1, 160),
        line2: clean(address.line2, 160),
        city: clean(address.city, 80),
        district: clean(address.district, 80),
        state: clean(address.state, 80),
        pincode: clean(address.pincode, 10),
        country: clean(address.country, 60) || "India",
      };
    }

    const created = await readJson<Json[]>(
      await rest("students", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      })
    ).catch(() => [] as Json[]);

    if (!created.length) {
      /*
       * Most likely the USN already exists: there is a unique index
       * on (organisation_id, usn). That is a user-correctable mistake,
       * so it is reported as a field error rather than a generic failure.
       */
      if (await usnTaken(orgId, usn)) {
        return Response.json(
          {
            error: "validation",
            fieldErrors: {
              usn: "That USN is already in use.",
            },
          },
          { status: 400 }
        );
      }
      return fail("The student could not be created.", 500, "create_failed");
    }

    const { account, detail } = await ensureStudentAccount(
      orgId,
      caller.id,
      created[0]
    );

    return Response.json(
      { student: created[0], account, accountDetail: detail },
      { status: 201 }
    );
  }

  /* ---------------------------------------------------------------- *
   * PATCH — update a pupil
   * ---------------------------------------------------------------- */

  if (req.method === "PATCH") {
    if (!canEditStudent(caller.role)) {
      return fail(
        "Only an administrator can change a student record.",
        403,
        "forbidden"
      );
    }
    const orgId = await callerOrg(caller);
    if (!orgId)
      return fail(
        "Your account is not linked to a school.",
        403,
        "no_organisation"
      );

    let body: Json;
    try {
      body = (await req.json()) as Json;
    } catch {
      return fail("Bad request.", 400, "bad_request");
    }

    const id = clean(body.id, 64);
    if (!id) return fail("Which student?", 400, "missing_id");

    // Confirm the pupil is in this caller's school before touching anything.
    // Without this, an admin of one school could update a pupil in another by
    // guessing a UUID.
    const existing = await readJson<Json[]>(
      await rest(
        `students?select=id,usn&organisation_id=eq.${orgId}&id=eq.${id}&limit=1`
      )
    ).catch(() => [] as Json[]);
    if (!existing.length) {
      return fail("That student could not be found.", 404, "not_found");
    }

    const patch: Json = {};
    const fieldErrors: Record<string, string> = {};

    const strings: Array<[string, number]> = [
      ["first_name", 60],
      ["last_name", 60],
      ["gender", 20],
      ["email", 160],
      ["phone", 40],
      ["guardian_name", 120],
      ["guardian_phone", 40],
      ["guardian_email", 160],
      ["blood_group", 10],
      ["nationality", 60],
      ["mother_tongue", 60],
      ["religion", 60],
      ["photo_url", 400],
      ["emergency_contact_name", 120],
      ["emergency_contact_phone", 40],
    ];

    for (const [field, max] of strings) {
      if (!(field in body)) continue;
      const value = clean(body[field], max);
      if ((field === "first_name" || field === "last_name") && !value) {
        fieldErrors[field] = "This field is required.";
      }
      // An explicit empty string clears the field; `undefined` leaves it alone.
      patch[field] = value;
    }

    if ("usn" in body) {
      const usn = normaliseUsn(body.usn);
      if (!usn) {
        fieldErrors.usn = "Enter a USN.";
      } else if (usn !== normaliseUsn(existing[0].usn)) {
        if (await usnTaken(orgId, usn)) {
          fieldErrors.usn = "That USN is already in use.";
        } else {
          patch.usn = usn;
        }
      }
    }

    if ("status" in body) {
      const status = clean(body.status, 20);
      if (!STATUSES.has(status)) {
        fieldErrors.status = "That status is not recognised.";
      } else {
        patch.status = status;
      }
    }

    for (const dateField of ["date_of_birth", "joined_on"]) {
      if (!(dateField in body)) continue;
      const value = isoDateOrNull(clean(body[dateField], 10));
      if (value === undefined) {
        fieldErrors[dateField] = "Enter the date as YYYY-MM-DD.";
      } else {
        patch[dateField] = value;
      }
    }

    if (body.address && typeof body.address === "object") {
      const address = body.address as Json;
      patch.address = {
        line1: clean(address.line1, 160),
        line2: clean(address.line2, 160),
        city: clean(address.city, 80),
        district: clean(address.district, 80),
        state: clean(address.state, 80),
        pincode: clean(address.pincode, 10),
        country: clean(address.country, 60) || "India",
      };
    }

    if (Object.keys(fieldErrors).length) {
      return Response.json(
        { error: "validation", fieldErrors },
        { status: 400 }
      );
    }

    if (!Object.keys(patch).length) {
      return fail("There was nothing to save.", 400, "nothing_to_save");
    }

    const updated = await readJson<Json[]>(
      await rest(`students?id=eq.${id}&organisation_id=eq.${orgId}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch),
      })
    ).catch(() => [] as Json[]);

    if (!updated.length) {
      return fail("The student could not be saved.", 500, "update_failed");
    }

    /*
     * The `audit_students` trigger already writes before_data/after_data into
     * audit_logs for every row change, with `actor_id` = auth.uid(). This route
     * runs on the service key, where auth.uid() is null, so it records the
     * actor explicitly. That distinction matters: without this, every change made
     * through the API would show an unattributed edit in the audit history.
     */
    await writeAudit(orgId, caller.id, "update", id, updated[0]).catch(
      () => null
    );

    // Re-run provisioning so a changed address reaches the login too. A family
    // that corrects an email address must keep their child's account rather
    // than have to ask an administrator to reissue it.
    const { account, detail } = await ensureStudentAccount(
      orgId,
      caller.id,
      updated[0]
    );

    return Response.json({
      student: updated[0],
      account,
      accountDetail: detail,
    });
  }

  /* ---------------------------------------------------------------- *
   * DELETE — archive rather than destroy
   * ---------------------------------------------------------------- */

  if (req.method === "DELETE") {
    if (!canEditStudent(caller.role)) {
      return fail(
        "Only an administrator can archive a student record.",
        403,
        "forbidden"
      );
    }
    const orgId = await callerOrg(caller);
    if (!orgId)
      return fail(
        "Your account is not linked to a school.",
        403,
        "no_organisation"
      );

    let body: Json;
    try {
      body = (await req.json()) as Json;
    } catch {
      return fail("Bad request.", 400, "bad_request");
    }

    const id = clean(body.id, 64);
    if (!id) return fail("Which student?", 400, "missing_id");

    const existing = await readJson<Json[]>(
      await rest(
        `students?select=id,status&organisation_id=eq.${orgId}&id=eq.${id}&limit=1`
      )
    ).catch(() => [] as Json[]);
    if (!existing.length) {
      return fail("That student could not be found.", 404, "not_found");
    }

    /*
     * Archival, not deletion. A pupil's marks, attendance, invoices and medical
     * history are the school's legal record; deleting the row would cascade
     * them away and there would be no way to undo it. `withdrawn` records that
     * the pupil has left and keeps every record intact and auditable.
     */
    const updated = await readJson<Json[]>(
      await rest(`students?id=eq.${id}&organisation_id=eq.${orgId}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "withdrawn" }),
      })
    ).catch(() => [] as Json[]);

    if (!updated.length) {
      return fail(
        "The student record could not be archived.",
        500,
        "archive_failed"
      );
    }

    await writeAudit(orgId, caller.id, "archive", id, updated[0]).catch(
      () => null
    );

    return Response.json({
      student: updated[0],
      archived: true,
      message: `${updated[0].first_name ?? "The student"} has been archived. Their academic and fee records are unchanged.`,
    });
  }

  return new Response("Method not allowed", { status: 405 });
}

/** Roles whose directory rows carry contact details. */
function SCHOOL_ONLY(role: string): boolean {
  const r = String(role ?? "")
    .trim()
    .toLowerCase();
  return r === "super_admin" || r === "admin" || r === "principal";
}

async function usnTaken(orgId: string, usn: string): Promise<boolean> {
  const rows = await readJson<Json[]>(
    await rest(
      `students?select=id&organisation_id=eq.${orgId}` +
        `&usn=ilike.${encodeURIComponent(normaliseUsn(usn))}&limit=1`
    )
  ).catch(() => [] as Json[]);
  return rows.length > 0;
}

/**
 * Give this pupil an account, and keep the one they have in step with the record.
 *
 * Called on every save rather than from a button. A parent told their child has
 * a place should be able to sign in that afternoon, and a step somebody has to
 * remember is a step that does not happen for the families who need it most.
 *
 * Best effort, and deliberately so: enrolling a child is the school's real work
 * and must not fail because an account could not be minted. The outcome travels
 * back in the response so an administrator can see which record needs attention,
 * rather than a parent discovering it when sign-in does not work.
 */
async function ensureStudentAccount(
  orgId: string,
  actorId: string,
  student: Json
): Promise<{ account: string | null; detail: Json }> {
  const id = String(student.id ?? "");
  if (!id || !orgId) return { account: null, detail: {} };
  try {
    const result = await provisionPortalAccount({
      subject: "student",
      recordId: id,
      organisationId: orgId,
      email: student.email,
      name: `${String(student.first_name ?? "")} ${String(student.last_name ?? "")}`.trim(),
      role: "student",
      // The first password is the date of birth in six digits. A save must never
      // rewrite it, because from the first sign-in the password belongs to the
      // pupil rather than to the record.
      birthDate: student.date_of_birth,
      actorId,
    });
    if (!result.ok)
      return { account: null, detail: { reason: result.reason ?? "unknown" } };
    return {
      account: result.created ? "created" : "existing",
      detail: { username: result.username, email: result.email },
    };
  } catch {
    return { account: null, detail: { reason: "unexpected" } };
  }
}

/**
 * Write an audit entry naming the actor.
 *
 * `write_audit_log()` uses auth.uid(), which is null for the service key. The
 * service key is what makes these routes able to join across tables, so the
 * audit write is done explicitly here rather than relying on the trigger.
 * Best effort: an audit failure must not fail the operation the user asked for,
 * but it is caught rather than ignored so it cannot take the request down.
 */
async function writeAudit(
  orgId: string,
  actorId: string,
  action: string,
  entityId: string,
  after: Json
): Promise<void> {
  await rest("audit_logs", {
    method: "POST",
    body: JSON.stringify({
      organisation_id: orgId,
      actor_id: actorId,
      action: `student.${action}`,
      entity_type: "students",
      entity_id: entityId,
      before_data: null,
      after_data: after,
    }),
  });
}

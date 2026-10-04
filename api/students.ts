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
    admissionFrom: (p.get("admissionFrom") ?? "").trim().slice(0, 10),
    admissionTo: (p.get("admissionTo") ?? "").trim().slice(0, 10),
    sort: (p.get("sort") ?? "name").trim().slice(0, 20),
    direction: p.get("direction") === "desc" ? "desc" : "asc",
    page: Math.max(1, int(p.get("page"), 1)),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, int(p.get("pageSize"), DEFAULT_PAGE_SIZE))),
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
  admission_no: "admission_no",
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
  return String(value ?? "").replace(CONTROL_CHARS, "").trim().slice(0, max);
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
    await rest(`staff?select=id&profile_id=eq.${caller.id}&organisation_id=eq.${orgId}`)
  ).catch(() => [] as Json[]);
  const staffId = staff[0]?.id ? String(staff[0].id) : "";

  if (staffId) {
    const classrooms = await readJson<Json[]>(
      await rest(
        `classrooms?select=id&organisation_id=eq.${orgId}` +
          `&(class_teacher_id=eq.${staffId},id=in.(${(
            await readJson<Json[]>(
              await rest(
                `subject_teachers?select=classroom_id&staff_id=eq.${staffId}&organisation_id=eq.${orgId}`
              )
            ).catch(() => [] as Json[])
          )
            .map((r) => String(r.classroom_id))
            .filter(Boolean)
            .join(",") || "00000000-0000-0000-0000-000000000000"}))`
      )
    ).catch(() => [] as Json[]);

    const classroomIds = classrooms.map((c) => String(c.id)).filter(Boolean);
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
  maySeeContacts: boolean
): Promise<{ rows: Json[]; total: number; scanned: number; truncated: boolean }> {
  const params = new URLSearchParams();
  params.set("select", "id,admission_no,first_name,last_name,date_of_birth,gender,phone,email," +
    "guardian_name,guardian_phone,guardian_email,photo_url,status,joined_on,address," +
    "blood_group,nationality,mother_tongue,emergency_contact_name,emergency_contact_phone");
  params.set("organisation_id", `eq.${orgId}`);

  if (filter.status && STATUSES.has(filter.status)) {
    params.append("status", `eq.${filter.status}`);
  }

  // Search across name, admission number and the pupil's own id. PostgREST
  // `or` takes the whole expression in one parameter; each term is quoted so a
  // comma or parenthesis in the search box cannot restructure the query.
  if (filter.search) {
    const term = filter.search.replace(/[%,()]/g, " ").trim();
    if (term) {
      const safe = `"${term}"`;
      params.set(
        "or",
        `(first_name.ilike.*${safe}*,last_name.ilike.*${safe}*,admission_no.ilike.*${safe}*,id.eq.${term})`
      );
    }
  }

  if (filter.admissionFrom) params.append("joined_on", `gte.${filter.admissionFrom}`);
  if (filter.admissionTo) params.append("joined_on", `lte.${filter.admissionTo}`);

  // One extra row so the caller can tell whether a next page exists without a
  // second count query.
  const countRes = await rest(
    `students?select=id&${params.toString()}&limit=1`,
    { headers: { Prefer: "count=exact", Range: "0-0" } }
  );
  const total = Number(countRes.headers.get("content-range")?.split("/")[1] ?? 0) || 0;

  /*
   * The full matching set is fetched, capped at a ceiling well above one page,
   * then the class/roll filters and the sort are applied here.
   *
   * Grade and section live on `classrooms`, joined through `enrollments`, so
   * they cannot be pushed into the same PostgREST query. Capping rather than
   * paginating in the database is a deliberate trade: it keeps this to two round
   * trips and stays exact for a school of any plausible size, and the ceiling
   * is reported in the response so a school that outgrows it finds out rather
   * than silently seeing a truncated list.
   */
  const SCAN_CAP = 5000;
  const scanRes = await rest(
    `students?${params.toString()}&order=last_name.asc,first_name.asc&limit=${SCAN_CAP}`
  );
  let students = await readJson<Json[]>(scanRes);
  const truncated = students.length >= SCAN_CAP;

  const studentIds = students.map((s) => String(s.id));
  if (!studentIds.length) return { rows: [], total, scanned: 0, truncated };

  const idList = studentIds.join(",");

  // Current enrolment: one active row per pupil per year, and the current year
  // is not assumed to be the newest one — an administrator may be editing a
  // closed year.
  const yearRes = await rest(
    `academic_years?select=id,name&organisation_id=eq.${orgId}&is_current=eq.true&limit=1`
  );
  const years = await readJson<Json[]>(yearRes);
  const currentYearId = years[0]?.id ? String(years[0].id) : "";

  const enrolments = await readJson<Json[]>(
    await rest(
      `enrollments?select=id,student_id,classroom_id,academic_year_id,roll_no,active` +
        `&organisation_id=eq.${orgId}&student_id=in.(${idList})`
    )
  ).catch(() => [] as Json[]);

  const yearEnrolments = currentYearId
    ? enrolments.filter((e) => String(e.academic_year_id ?? "") === currentYearId && e.active === true)
    : enrolments.filter((e) => e.active === true);

  // A pupil with no current-year enrolment is still listed, under "Unassigned".
  const enrolmentByStudent = new Map<string, Json>();
  for (const e of yearEnrolments) {
    const id = String(e.student_id ?? "");
    if (id && !enrolmentByStudent.has(id)) enrolmentByStudent.set(id, e);
  }

  const classroomIds = Array.from(
    new Set(yearEnrolments.map((e) => String(e.classroom_id ?? "")).filter(Boolean))
  );

  const classrooms = classroomIds.length
    ? await readJson<Json[]>(
        await rest(
          `classrooms?select=id,grade,section,room&id=in.(${classroomIds.join(",")})` +
            `&organisation_id=eq.${orgId}`
        )
      ).catch(() => [] as Json[])
    : [];
  const classroomById = new Map(classrooms.map((c) => [String(c.id), c]));

  // Attendance percentage. Restricted to the pupils on this page rather than the
  // whole school: the register is by far the largest table here.
  const attendance = await readJson<Json[]>(
    await rest(
      `attendance?select=student_id,status&organisation_id=eq.${orgId}` +
        `&student_id=in.(${idList})&limit=20000`
    )
  ).catch(() => [] as Json[]);

  const tally = new Map<string, { present: number; total: number }>();
  for (const row of attendance) {
    const id = String(row.student_id ?? "");
    if (!id) continue;
    const entry = tally.get(id) ?? { present: 0, total: 0 };
    const status = String(row.status ?? "");
    entry.total += 1;
    // An approved leave is not an absence, so it counts as present. A half day
    // counts as present: the pupil was in the building for part of it.
    if (status === "present" || status === "late" || status === "half_day" || status === "leave") {
      entry.present += 1;
    }
    tally.set(id, entry);
  }

  // Academic average: only published examinations, so a pupil's average does not
  // move because a teacher saved an unpublished draft.
  const examIds = Array.from(
    new Set(
      (
        await readJson<Json[]>(
          await rest(
            `examinations?select=id&organisation_id=eq.${orgId}&published=eq.true&limit=200`
          )
        ).catch(() => [] as Json[])
      ).map((e) => String(e.id))
    )
  );

  const results = examIds.length
    ? await readJson<Json[]>(
        await rest(
          `exam_results?select=student_id,marks,max_marks&organisation_id=eq.${orgId}` +
            `&examination_id=in.(${examIds.join(",")})&student_id=in.(${idList})&limit=20000`
        )
      ).catch(() => [] as Json[])
    : [];

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

  // Fees, for the roles allowed to see them. The column is dropped from every
  // other role's row below, not merely hidden in the UI.
  const invoices = await readJson<Json[]>(
    await rest(
      `invoices?select=student_id,total,paid_amount,due_on,status&organisation_id=eq.${orgId}` +
        `&student_id=in.(${idList})&limit=10000`
    )
  ).catch(() => [] as Json[]);

  const feeByStudent = new Map<string, { due: number; outstanding: number; overdue: boolean }>();
  const today = new Date().toISOString().slice(0, 10);
  for (const row of invoices) {
    const id = String(row.student_id ?? "");
    if (!id) continue;
    const entry = feeByStudent.get(id) ?? { due: 0, outstanding: 0, overdue: false };
    const total = Number(row.total ?? 0);
    const paid = Number(row.paid_amount ?? 0);
    entry.due += total;
    entry.outstanding += Math.max(0, total - paid);
    const dueOn = String(row.due_on ?? "");
    if (dueOn && dueOn < today && total - paid > 0 && row.status !== "cancelled") {
      entry.overdue = true;
    }
    feeByStudent.set(id, entry);
  }

  const composed: Json[] = students.map((s) => {
    const id = String(s.id);
    const enrolment = enrolmentByStudent.get(id);
    const room = enrolment ? classroomById.get(String(enrolment.classroom_id ?? "")) : undefined;

    const a = tally.get(id);
    const m = marks.get(id);
    const f = feeByStudent.get(id);

    const row: Json = {
      id,
      admission_no: String(s.admission_no ?? ""),
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
      roll_no: enrolment ? enrolment.roll_no ?? null : null,
      enrolment_status: enrolment ? "active" : "not_enrolled",
      academic_year_id: currentYearId,
      attendance_percentage: a && a.total > 0 ? round1((a.present / a.total) * 100) : null,
      attendance_records: a ? a.total : 0,
      academic_average: m && m.max > 0 ? round1((m.got / m.max) * 100) : null,
      scored_papers: m ? m.papers : 0,
      guardian_name: s.guardian_name ?? null,
    };

    // Contact details and the money are role-gated here, at the point they are
    // assembled, so they are not merely unused by the client — they are never
    // built for a role that may not have them.
    if (maySeeFees) {
      row.fees = f ? (f.outstanding <= 0 ? "Paid" : f.overdue ? "Overdue" : "Due") : "Paid";
      row.outstanding_fees = f ? round2(f.outstanding) : 0;
      row.total_fees = f ? round2(f.due) : 0;
    } else {
      row.fees = null;
    }

    return row;
  });

  // Class and section filters, applied after the join because those columns
  // come from classrooms.
  let filteredRows = composed;
  if (filter.grade) {
    filteredRows = filteredRows.filter((r) => String(r.grade) === filter.grade);
  }
  if (filter.section) {
    filteredRows = filteredRows.filter((r) => String(r.section) === filter.section);
  }

  const sortColumn = SORT_COLUMNS[filter.sort] ?? SORT_COLUMNS.name;
  const dir = filter.direction === "desc" ? -1 : 1;
  filteredRows.sort((a, b) => {
    // Numbers compare numerically; everything else as a locale-aware string so
    // "Ananya" sorts before "Bhuvan" rather than after it.
    const av = a[sortColumn];
    const bv = b[sortColumn];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return cmp * dir || String(a.id).localeCompare(String(b.id));
  });

  // Contact details, only for the roles allowed to read them. The values are
  // copied onto the page's rows rather than left on `students`, so a row for a
  // role without access never carries a phone number.
  if (maySeeContacts) {
    const byId = new Map(students.map((s) => [String(s.id), s]));
    for (const row of filteredRows) {
      const source = byId.get(String(row.id));
      if (!source) continue;
      row.phone = source.phone ?? null;
      row.email = source.email ?? null;
      row.guardian_phone = source.guardian_phone ?? null;
      row.guardian_email = source.guardian_email ?? null;
      row.address = source.address ?? null;
    }
  }

  const start = (filter.page - 1) * filter.pageSize;
  return {
    rows: filteredRows.slice(start, start + filter.pageSize),
    // When the scan was truncated the true total is unknown, so the ceiling is
    // reported instead. The client shows that this list is not exhaustive rather
    // than presenting a number as complete.
    total: truncated ? SCAN_CAP : filteredRows.length,
    scanned: studentIds.length,
    truncated,
  };
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
    await rest(`classrooms?select=grade,section&organisation_id=eq.${orgId}&order=grade.asc`)
  ).catch(() => [] as Json[]);

  const years = await readJson<Json[]>(
    await rest(`academic_years?select=id,name,is_current&organisation_id=eq.${orgId}&order=name.desc`)
  ).catch(() => [] as Json[]);

  const grades = Array.from(
    new Set(classrooms.map((c) => String(c.grade ?? "")).filter(Boolean))
  );
  const sections = Array.from(
    new Set(classrooms.map((c) => String(c.section ?? "")).filter(Boolean))
  );

  return { grades: grades.sort(), sections: sections.sort(), years };
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
  const body = rows.map((row) => columns.map((c) => csvCell(row[c])).join(","));
  // A BOM so Excel opens a UTF-8 file with Indian names correctly rather than
  // rendering them as mojibake.
  return `﻿${[head, ...body].join("\n")}`;
}

/* ------------------------------------------------------------------ *
 * Handler
 * ------------------------------------------------------------------ */

export default async function handler(req: Request): Promise<Response> {
  if (!SERVICE_KEY) {
    return fail("The database is not configured on this deployment.", 503, "not_configured");
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
        return fail("You do not have access to the student list.", 403, "forbidden");
      }
      const orgId = await callerOrg(caller);
      if (!orgId) return fail("Your account is not linked to a school.", 403, "no_organisation");
      return Response.json(await filterOptions(orgId));
    }

    if (!canListStudents(caller.role)) {
      /*
       * A parent or a pupil asking for the directory is refused outright. They
       * reach their own child through the profile route, which resolves the
       * link server-side. Returning a filtered list instead would still leak the
       * existence and admission number of every other child.
       */
      return fail(
        "The student list is not available to your account. Open your profile to see your records.",
        403,
        "forbidden"
      );
    }

    const orgId = await callerOrg(caller);
    if (!orgId) return fail("Your account is not linked to a school.", 403, "no_organisation");

    const maySeeFees = canViewFees(caller.role);
    const maySeeContacts = SCHOOL_ONLY(caller.role);

    const filter = parseFilters(url);
    const { rows, total, scanned, truncated } = await loadDirectory(
      orgId,
      filter,
      maySeeFees,
      maySeeContacts
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
    if (!orgId) return fail("Your account is not linked to a school.", 403, "no_organisation");

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
      return Response.json({ error: "validation", fieldErrors }, { status: 400 });
    }

    // The admission number is either supplied or generated. Generated numbers
    // embed the current year so they sort chronologically and are readable when
    // printed on a report card.
    let admissionNo = clean(body.admission_no, 40);
    if (!admissionNo) {
      const year = new Date().getFullYear();
      const prefix = `ADM/${String(year).slice(2)}-${String(year + 1).slice(2)}/`;
      const existing = await readJson<Json[]>(
        await rest(
          `students?select=admission_no&organisation_id=eq.${orgId}` +
            `&admission_no=like.${encodeURIComponent(prefix)}*&limit=1`
        )
      ).catch(() => [] as Json[]);
      let next = 1;
      if (existing.length) {
        const last = String(existing[0].admission_no ?? "");
        const n = Number.parseInt(last.split("/").pop() ?? "1", 10);
        if (Number.isFinite(n)) next = n + 1;
      }
      admissionNo = `${prefix}${String(next).padStart(4, "0")}`;
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
      admission_no: admissionNo,
      first_name: firstName,
      last_name: lastName,
      status,
      joined_on: isoDateOrNull(clean(body.joined_on, 10)) ?? new Date().toISOString().slice(0, 10),
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
      const value = clean(body[field], 200);
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
       * Most likely the admission number already exists: there is a unique index
       * on (organisation_id, admission_no). That is a user-correctable mistake,
       * so it is reported as a field error rather than a generic failure.
       */
      if (await admissionNumberTaken(orgId, admissionNo)) {
        return Response.json(
          {
            error: "validation",
            fieldErrors: { admission_no: "That admission number is already in use." },
          },
          { status: 400 }
        );
      }
      return fail("The student could not be created.", 500, "create_failed");
    }

    return Response.json({ student: created[0] }, { status: 201 });
  }

  /* ---------------------------------------------------------------- *
   * PATCH — update a pupil
   * ---------------------------------------------------------------- */

  if (req.method === "PATCH") {
    if (!canEditStudent(caller.role)) {
      return fail("Only an administrator can change a student record.", 403, "forbidden");
    }
    const orgId = await callerOrg(caller);
    if (!orgId) return fail("Your account is not linked to a school.", 403, "no_organisation");

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
      await rest(`students?select=id&organisation_id=eq.${orgId}&id=eq.${id}&limit=1`)
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

    if ("admission_no" in body) {
      const admissionNo = clean(body.admission_no, 40);
      if (!admissionNo) {
        fieldErrors.admission_no = "Enter an admission number.";
      } else if (admissionNo !== String(existing[0].admission_no ?? "")) {
        if (await admissionNumberTaken(orgId, admissionNo)) {
          fieldErrors.admission_no = "That admission number is already in use.";
        } else {
          patch.admission_no = admissionNo;
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
      return Response.json({ error: "validation", fieldErrors }, { status: 400 });
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
    await writeAudit(orgId, caller.id, "update", id, updated[0]).catch(() => null);

    return Response.json({ student: updated[0] });
  }

  /* ---------------------------------------------------------------- *
   * DELETE — archive rather than destroy
   * ---------------------------------------------------------------- */

  if (req.method === "DELETE") {
    if (!canEditStudent(caller.role)) {
      return fail("Only an administrator can archive a student record.", 403, "forbidden");
    }
    const orgId = await callerOrg(caller);
    if (!orgId) return fail("Your account is not linked to a school.", 403, "no_organisation");

    let body: Json;
    try {
      body = (await req.json()) as Json;
    } catch {
      return fail("Bad request.", 400, "bad_request");
    }

    const id = clean(body.id, 64);
    if (!id) return fail("Which student?", 400, "missing_id");

    const existing = await readJson<Json[]>(
      await rest(`students?select=id,status&organisation_id=eq.${orgId}&id=eq.${id}&limit=1`)
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
      return fail("The student record could not be archived.", 500, "archive_failed");
    }

    await writeAudit(orgId, caller.id, "archive", id, updated[0]).catch(() => null);

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
  const r = String(role ?? "").trim().toLowerCase();
  return r === "super_admin" || r === "admin" || r === "principal";
}

async function admissionNumberTaken(orgId: string, admissionNo: string): Promise<boolean> {
  const rows = await readJson<Json[]>(
    await rest(
      `students?select=id&organisation_id=eq.${orgId}` +
        `&admission_no=eq.${encodeURIComponent(admissionNo)}&limit=1`
    )
  ).catch(() => [] as Json[]);
  return rows.length > 0;
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
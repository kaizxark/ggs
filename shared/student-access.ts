/**
 * Who may see and change what on a student record.
 *
 * ## Why this exists
 *
 * The brief asks for permissions enforced on the backend, not in the UI. That
 * leaves a question this file answers once instead of in every route: what are
 * the rules?
 *
 * There are two layers in play and they are not the same thing.
 *
 *   • The database already has the authoritative rules. Migrations 004–006
 *     installed SECURITY DEFINER functions — `can_access_student()`,
 *     `can_read_student_record()`, `can_view_health_records()`,
 *     `can_view_student_finance()` — and every new table's RLS policy calls
 *     one of them. Row level security evaluates them per row.
 *
 *   • This file is the application-side mirror of those rules. It exists so a
 *     route can decide *what to fetch* before it fetches, so it can return 403
 *     with an explanation instead of an empty list, and so the client can grey
 *     out a button that would be refused.
 *
 * The duplication is deliberate and the database stays authoritative. If these
 * two ever disagree, the disagreement shows up as a policy refusing a write
 * this module thought was allowed — a loud, safe failure. The reverse, which
 * would be the dangerous one, cannot happen: nothing here can widen access,
 * because every write still has to satisfy RLS.
 *
 * ## Why the client copy is never trusted
 *
 * `canEdit()` and friends are exported so the UI does not show an action that
 * would be refused. A caller who edits their own copy of the answer to "yes"
 * gets a 403 from the route, because the route resolves the caller's role from
 * their session token via `resolveCaller()` and never reads a role from the
 * request body.
 */

/** The sections of a student profile, as data-scope names. */
export type StudentSection =
  | "personal"
  | "guardians"
  | "academics"
  | "attendance"
  | "fees"
  | "documents"
  | "admission"
  | "account";

export const ALL_STUDENT_SECTIONS: StudentSection[] = [
  "personal",
  "guardians",
  "academics",
  "attendance",
  "fees",
  "documents",
  "admission",
  "account",
];

/** Human labels, for the profile's tab strip. */
export const SECTION_LABELS: Record<StudentSection, string> = {
  personal: "Personal",
  guardians: "Guardians",
  academics: "Academics",
  attendance: "Attendance",
  fees: "Fees",
  documents: "Documents",
  admission: "Admission",
  account: "Account",
};

/** Roles that run the school day to day. */
const SCHOOL_MANAGERS = new Set(["super_admin", "admin", "principal"]);

/** Roles with the accounts desk's view of money. */
const FINANCE_ROLES = new Set(["super_admin", "admin", "principal", "accountant"]);

/**
 * Roles permitted to open a pupil's file cabinet.
 *
 * Narrower than the management set on purpose: a document cabinet holds Aadhaar
 * copies and medical certificates, so it is restricted to the two administrative
 * roles rather than everyone who runs a school.
 */
const DOCUMENT_ROLES = new Set(["super_admin", "admin"]);

/** Teaching staff. */
const TEACHERS = new Set(["teacher"]);

/**
 * May this role open the student directory at all?
 *
 * Pupils and parents reach their own child, never the list. A parent seeing the
 * whole roll call is the single most likely privacy failure in a system like
 * this, so it is refused at the door rather than filtered afterwards.
 */
export function canListStudents(role: string): boolean {
  const r = norm(role);
  return SCHOOL_MANAGERS.has(r) || TEACHERS.has(r) || r === "staff" || r === "accountant";
}

/**
 * May this role see a particular child at all?
 *
 * `relatesTo` is the caller's relationship to that child, resolved server-side:
 * a guardian linked through `student_guardians.portal_profile_id`, a pupil
 * through `profiles.student_id`, or a teacher through their timetabled classes.
 * It is never taken from the request.
 */
export function canViewStudent(
  role: string,
  relatesTo: "guardian" | "self" | "teacher" | null
): boolean {
  const r = norm(role);
  if (SCHOOL_MANAGERS.has(r)) return true;
  if (r === "staff" || r === "accountant") return true;
  // A teacher is also a member of staff, so their own record stays reachable.
  if (r === "teacher") return relatesTo === "teacher" || relatesTo === "self";
  // A parent reaches their own children, a pupil reaches themselves. These are
  // matched separately rather than with one combined check: a parent account
  // must not pass by claiming a "self" relationship, and a pupil must not pass
  // by claiming to be a guardian.
  if (r === "parent") return relatesTo === "guardian";
  if (r === "student") return relatesTo === "self";
  return false;
}

/** May this role change a child's core details? */
export function canEditStudent(role: string): boolean {
  return SCHOOL_MANAGERS.has(norm(role));
}

/** May this role manage guardians and family links? */
export function canManageGuardians(role: string): boolean {
  return SCHOOL_MANAGERS.has(norm(role));
}

/** May this role record attendance? Teachers take their own register. */
export function canRecordAttendance(role: string): boolean {
  const r = norm(role);
  return SCHOOL_MANAGERS.has(r) || TEACHERS.has(r);
}

/** May this role read a child's fee position? */
export function canViewFees(role: string): boolean {
  return FINANCE_ROLES.has(norm(role));
}

/** May this role change fees, and therefore see the finance screens? */
export function canManageFees(role: string): boolean {
  return FINANCE_ROLES.has(norm(role));
}

/**
 * May this role read a child's health record?
 *
 * Teachers qualify because allergies and emergency medication are needed to keep
 * a child safe in the classroom. They do not automatically get the medical
 * record itself — that is a narrower slice, and the database enforces it.
 */
export function canViewHealth(role: string): boolean {
  const r = norm(role);
  return SCHOOL_MANAGERS.has(r) || TEACHERS.has(r);
}

/** May this role write health information? */
export function canEditHealth(role: string): boolean {
  const r = norm(role);
  return SCHOOL_MANAGERS.has(r) || TEACHERS.has(r);
}

/**
 * May this role open a child's documents?
 *
 * Matches `ALLOWED_ROLES` in `api/documents.ts` exactly: super_admin and admin,
 * and not principal. That is narrower than SCHOOL_MANAGERS on purpose — a pupil's
 * file cabinet holds Aadhaar copies, so even a school's academic head does not
 * get it by role. It is deliberately a separate set rather than a reuse of
 * SCHOOL_MANAGERS, and `student-access-parity.test.ts` asserts the two stay in
 * step, because when they drifted apart a teacher saw a Documents screen whose
 * every request returned 403.
 */
export function canViewDocuments(role: string): boolean {
  return DOCUMENT_ROLES.has(norm(role));
}

/** May this role verify or replace a document? */
export function canManageDocuments(role: string): boolean {
  return SCHOOL_MANAGERS.has(norm(role));
}

/** May this role record a teacher observation? */
export function canWriteObservations(role: string): boolean {
  const r = norm(role);
  return SCHOOL_MANAGERS.has(r) || TEACHERS.has(r);
}

/**
 * May this role read observations?
 *
 * Only for a child they are connected to. Note this says nothing about
 * `visible_to_guardians`: a parent linked to a child passes this check and then
 * still only sees the observations an author chose to share, because that flag
 * lives on the row and the database policy reads it.
 */
export function canViewObservations(role: string, relatesTo: "guardian" | "self" | "teacher" | null): boolean {
  const r = norm(role);
  if (SCHOOL_MANAGERS.has(r)) return true;
  if (r === "teacher") return relatesTo === "teacher" || relatesTo === "self";
  return false;
}

/** May this role decide a leave application? */
export function canDecideLeave(role: string): boolean {
  return SCHOOL_MANAGERS.has(norm(role));
}

/** May this role apply for leave on a child's behalf? */
export function canApplyForLeave(role: string): boolean {
  const r = norm(role);
  return SCHOOL_MANAGERS.has(r) || TEACHERS.has(r) || r === "parent";
}

/** May this role manage extracurricular activities and participation? */
export function canManageActivities(role: string): boolean {
  return SCHOOL_MANAGERS.has(norm(role));
}

/** May this role manage the library loan register? */
export function canManageLibrary(role: string): boolean {
  return SCHOOL_MANAGERS.has(norm(role));
}

/** May this role manage a pupil's sign-in account? */
export function canManageAccount(role: string): boolean {
  return SCHOOL_MANAGERS.has(norm(role));
}

/**
 * Which profile sections this role may receive, for a child they can view.
 *
 * `canViewStudent` gates the profile as a whole; this gates what is inside it.
 * The fee tab, the health tab and the documents tab are the three that carry
 * confidential material, and each is decided separately so a teacher sees a
 * complete academic profile without a ledger or a medical history.
 */
export function sectionsForRole(
  role: string,
  relatesTo: "guardian" | "self" | "teacher" | null
): StudentSection[] {
  if (!canViewStudent(role, relatesTo)) return [];

  const r = norm(role);
  const out: StudentSection[] = [];

  // Personal details are the child's own identity; everyone linked to the child
  // may see them.
  out.push("personal");

  // Guardians. A guardian sees the family record because it is their own
  // family's contact details.
  out.push("guardians");

  // Academics and attendance are the ordinary school record.
  if (SCHOOL_MANAGERS.has(r) || TEACHERS.has(r) || relatesTo === "guardian" || relatesTo === "self") {
    out.push("academics", "attendance");
  }

  // Admission history is administrative; a parent does not need to read their
  // own child's admission application.
  if (SCHOOL_MANAGERS.has(r)) out.push("admission");

  // A pupil may read their own money and paperwork.
  // Those sections stay closed to every other relationship: a guardian only gets
  // fees when their link row grants it, and a teacher does not need the family's
  // bank ledger or the child's identity documents.
  if (canViewFees(r) || relatesTo === "self") out.push("fees");
  if (canViewDocuments(r) || relatesTo === "self") out.push("documents");

  // Account status. Never the credential itself — see `publicAccountFields`.
  if (SCHOOL_MANAGERS.has(r) || relatesTo === "self") out.push("account");

  return ALL_STUDENT_SECTIONS.filter((section) => out.indexOf(section) !== -1);
}

/**
 * The only fields of a pupil's sign-in that may ever leave the server.
 *
 * The brief is explicit: never expose passwords, password hashes, tokens or
 * session credentials. `student_credentials` really does hold a `password`
 * column, so this list is the reason that column is never selected anywhere in
 * the codebase. Anything not named here does not travel.
 */
export const PUBLIC_ACCOUNT_FIELDS = [
  "username",
  "issued_at",
  "revoked_at",
] as const;

/**
 * The directory columns an export may contain, by role.
 *
 * A spreadsheet is the easiest way to leak a whole roll call out of the system,
 * so an export is narrower than the screen it came from: no date of birth, no
 * home address, no guardian contact details, unless the role already handles
 * those records in the app.
 */
export function exportColumnsForRole(role: string): string[] {
  const base = [
    "usn",
    "first_name",
    "last_name",
    "status",
    "grade",
    "section",
    "roll_no",
    "joined_on",
  ];

  if (SCHOOL_MANAGERS.has(norm(role))) {
    return base.concat([
      "date_of_birth",
      "gender",
      "phone",
      "email",
      "guardian_name",
      "guardian_phone",
      "guardian_email",
      "attendance_percentage",
      "academic_average",
      "outstanding_fees",
    ]);
  }

  // Teachers and the accounts desk get the academic and money columns they use
  // day to day, and no family contact details.
  return base.concat(["attendance_percentage", "academic_average"]);
}

/** Trim and lowercase, so " Admin " and "admin" are the same role. */
function norm(role: unknown): string {
  return String(role ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}
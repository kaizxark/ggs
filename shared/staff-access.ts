/**
 * The sections of a staff profile, and who may read each one.
 *
 * The student profile has `shared/student-access.ts` for exactly this reason:
 * the route decides what it will send and the drawer renders whatever came
 * back, so the list lives in one place instead of two lists that drift until
 * the UI offers a tab the server refuses.
 *
 * The rules here are deliberately simpler than the pupil ones, because a member
 * of staff is not a child: there is no medical history and no guardian, only
 * the person's own record, what they teach, their sign-in account and the audit
 * trail of changes made to their record.
 *
 *   personal     every colleague who can open the Staff directory
 *   employment   every colleague who can open the Staff directory
 *   teaching     every colleague who can open the Staff directory
 *   account      administrators, and the person themselves
 *   activity     administrators only
 *
 * The account section is the one that matters. It names the username and says
 * whether a password has been chosen yet, which is information an administrator
 * needs in order to help somebody sign in and information a colleague does not
 * need about another colleague.
 */

export const ALL_STAFF_SECTIONS = [
  "personal",
  "employment",
  "teaching",
  "account",
  "activity",
] as const;

export type StaffSection = (typeof ALL_STAFF_SECTIONS)[number];

export const STAFF_SECTION_LABELS: Record<StaffSection, string> = {
  personal: "Personal",
  employment: "Employment",
  teaching: "Teaching",
  account: "Account",
  activity: "Activity",
};

/** Roles that may open the Staff directory at all. Mirrors the sidebar. */
const DIRECTORY_ROLES = new Set([
  "super_admin",
  "admin",
  "principal",
  "staff",
  "teacher",
  "accountant",
]);

/** Roles that may read another person's account and activity sections. */
const MANAGER_ROLES = new Set(["super_admin", "admin", "principal"]);

export function canOpenStaffDirectory(role: string | null | undefined): boolean {
  return DIRECTORY_ROLES.has(String(role ?? "").toLowerCase());
}

export function isStaffManager(role: string | null | undefined): boolean {
  return MANAGER_ROLES.has(String(role ?? "").toLowerCase());
}

/**
 * The sections this caller may read for one member of staff.
 *
 * `isSelf` is passed rather than inferred from the role: a teacher looking at
 * their own record is looking at their own sign-in details, which is theirs to
 * see even though nobody else's is.
 */
export function sectionsForStaffRole(
  role: string | null | undefined,
  isSelf = false
): StaffSection[] {
  if (!canOpenStaffDirectory(role)) return [];

  const manager = isStaffManager(role);
  return ALL_STAFF_SECTIONS.filter((section) => {
    if (section === "activity") return manager;
    if (section === "account") return manager || isSelf;
    return true;
  });
}

/** Why a section was withheld, phrased for the person who cannot see it. */
export function withheldReason(section: StaffSection): string {
  if (section === "account")
    return "Sign-in details are visible to administrators and to the account holder.";
  if (section === "activity")
    return "The change history of another person's record is visible to administrators only.";
  return "Your role cannot read this section.";
}

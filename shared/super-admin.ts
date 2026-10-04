/**
 * The super admin.
 *
 * One account outranks every other in this system: it cannot be demoted,
 * deleted, or locked out, no matter who tries, and it holds the widest access
 * in the dashboard.
 *
 * ## Why this is anchored on a UUID and not on an email address
 *
 * The obvious implementation is "if the email is kaizxark@gmail.com, treat him
 * as super admin". That silently breaks the moment he renames himself — the
 * Settings screen rewrites the email to `<username>@gmail.com` — and a silent
 * privilege loss is worse than no privilege at all, because nobody notices
 * until an admin can no longer do their job.
 *
 * A Supabase user id is a UUID minted once at signup. It does not change when
 * the email changes, when the username changes, or when the password changes.
 * That makes it the one identifier here that can actually carry a permanent
 * privilege, so it is the only thing this module trusts.
 *
 * ## Why the role is derived rather than stored
 *
 * The `app_role` enum in the database has five members — admin, principal,
 * staff, teacher, parent. It has never had `super_admin` added, and adding one
 * needs `ALTER TYPE`, which cannot be run from here. So `super_admin` cannot be
 * written to `profiles.role`; the database rejects it.
 *
 * Rather than wait on a migration, super admin is applied at read time:
 * `effectiveRole` returns `super_admin` for this id whatever the row says.
 * Every screen, every server route and every label goes through it, so the
 * stored value never matters. When the migration does land and the column
 * accepts the role, this module keeps working unchanged — it simply starts
 * agreeing with the database instead of overriding it.
 */

/**
 * The permanent super admin's user id.
 *
 * 60ff6003-c0a4-438f-85df-2048b0e7b6c8 — kaizxark@gmail.com, "Ehtesham".
 * Display purposes only; this id is what every check compares against.
 */
export const SUPER_ADMIN_ID = "60ff6003-c0a4-438f-85df-2048b0e7b6c8";

/** Highest role in the system. Never grantable to anyone else. */
export const SUPER_ADMIN_ROLE = "super_admin";

/** Roles ordered from most to least privilege, used by the access label. */
export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  principal: "Admin",
  staff: "Staff",
  teacher: "Staff",
  accountant: "Staff",
  student: "Student",
  parent: "Parent",
};

/**
 * True only for the super admin's own id.
 *
 * Deliberately takes an id and nothing else. An earlier version also accepted
 * an email match, which meant a renamed account quietly lost the role.
 */
export function isSuperAdminId(id: unknown): boolean {
  return typeof id === "string" && id.trim().toLowerCase() === SUPER_ADMIN_ID;
}

/**
 * The role this account actually acts as.
 *
 * Callers pass whatever is stored in `profiles.role` and get back the role to
 * trust, so no individual screen can accidentally read the raw column.
 */
export function effectiveRole(
  id: unknown,
  storedRole: unknown
): string {
  if (isSuperAdminId(id)) return SUPER_ADMIN_ROLE;
  const role = String(storedRole ?? "");
  if (!role) return "parent";
  /*
   * Belt and braces against a second super admin. The stored value can only be
   * "super_admin" if the enum grows one and someone writes it, and returning
   * it here would promote whoever that row belonged to. Super admin is granted
   * by this module and by nothing else, so a row is never enough on its own.
   */
  return role === SUPER_ADMIN_ROLE ? "admin" : role;
}

/** Human label for an access level. Pass an id so the super admin is labelled correctly. */
export function roleLabel(
  id: unknown,
  storedRole: unknown = null
): string {
  return ROLE_LABELS[effectiveRole(id, storedRole)] ?? String(storedRole ?? "");
}

/**
 * Refuse an attempt to change the super admin.
 *
 * `action` is a verb phrase — "delete", "change the role of" — so the sentence
 * reads correctly whichever one a caller passes.
 *
 * Returned rather than thrown so a route can turn it into a 403 with a message
 * that explains the rule instead of a generic "forbidden".
 */
export function superAdminGuard(
  id: unknown,
  action: "change the role of" | "delete" | "replace the account of"
): string | null {
  return isSuperAdminId(id)
    ? `Nobody can ${action} the super admin account, including another super admin.`
    : null;
}
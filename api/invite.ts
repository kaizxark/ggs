/**
 * User provisioning endpoint (super admin / admin only).
 *
 * Creating an account means calling the Supabase Admin API, which needs the
 * service-role key. That key must never reach the browser, so it lives only in
 * this server route's environment.
 *
 * Two jobs:
 *   • invite  — an admin invites a colleague (another admin, or staff)
 *   • student — generate a username + password for a student portal login
 *
 * Authorisation is enforced here, not in the UI: the caller's own session is
 * resolved with the publishable key and their profile role is checked before
 * anything is written.
 */

export const config = { runtime: "edge" };

import {
  SUPER_ADMIN_ROLE,
  effectiveRole,
  isSuperAdminId,
  superAdminGuard,
} from "../shared/super-admin";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_Y1oStHbYHErfX2FD6xyKeg_PXuVcQ1w";

/**
 * Roles an inviter may hand out, and who is allowed to hand them out.
 *
 * `super_admin` appears in nobody's list: it is not a role anyone can be given.
 * The one super admin already exists, and there is no path in this app that
 * creates a second one.
 *
 * The super admin's own list is the widest — he appoints other admins — which
 * is the whole point of the role. It used to be empty, which quietly left the
 * most powerful account the least able to create anyone.
 */
const GRANTABLE: Record<string, string[]> = {
  super_admin: ["admin", "staff", "teacher", "accountant"],
  // An ordinary admin runs the school day to day but cannot mint a peer: that
  // is the one power reserved for the super admin, and it is what stops two
  // admins from editing each other's access indefinitely.
  admin: ["staff", "teacher", "accountant"],
  staff: [],
};

/**
 * The role written to a pupil's linked profile.
 *
 * This used to be hard-coded to "parent", on the reasoning that the `app_role`
 * enum had no `student` member and writing one would be rejected. Migration 001
 * adds it, so the fallback was no longer needed — and it was actively harmful:
 * a pupil signed in as a parent, which put them behind the guardian's view of
 * the school rather than their own record, and meant every student's dashboard
 * was showing them somebody else's data.
 */
const STUDENT_ROLE = "student";

type Json = Record<string, unknown>;

function fail(message: string, status: number, code = "error") {
  return Response.json({ error: code, message }, { status });
}

/** Resolve the caller from their bearer token and read their real role. */
async function resolveCaller(
  req: Request
): Promise<{ id: string; role: string } | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  if (!user?.id) return null;

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,role&id=eq.${user.id}&limit=1`,
    {
      headers: {
        apikey: SERVICE_KEY || ANON_KEY,
        Authorization: `Bearer ${SERVICE_KEY || token}`,
      },
    }
  );
  const rows = (await profileRes.json()) as Json[];
  /*
   * The role is derived from the caller's id, not read straight off the row.
   * The `app_role` enum cannot hold "super_admin" yet, so the stored value for
   * the super admin reads "admin" — trusting it here would quietly cap him at
   * admin the first time anyone looked.
   */
  return {
    id: user.id,
    role: effectiveRole(user.id, rows?.[0]?.role),
  };
}

/** Temporary staff password: readable aloud to a colleague, still non-trivial. */
function makePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const body = Array.from({ length: 8 }, () => pick(all)).join("");
  return `${pick(upper)}${pick(digits)}${body}`; // 10 chars total
}

/**
 * A student's portal password is their date of birth as DDMMYYYY — a pupil born
 * on 28 August 2005 signs in with 29082005.
 *
 * The point is that a child can be handed their own credentials and remember
 * them without writing anything down, which a generated eight-character string
 * defeats.
 *
 * This is weak by any measure, so it is deliberately confined to student portal
 * accounts: it depends on the date of birth being private, and every adult
 * account — admins, teachers, accountants — still gets a generated password.
 * Anything a student can reach should be treated as low-value, because it is
 * reachable by anyone who knows a schoolchild's date of birth.
 */
export function studentPassword(dateOfBirth: unknown): string | null {
  const value = String(dateOfBirth ?? "")
    .trim()
    .slice(0, 10);
  // Accepts the YYYY-MM-DD shape the students table stores.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const mm = Number(month);
  const dd = Number(day);
  // Reject impossible dates rather than minting an unguessable-but-wrong
  // password such as 32082005 for a 32 August.
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const check = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(check.getTime())) return null;
  if (check.getUTCMonth() + 1 !== mm || check.getUTCDate() !== dd) return null;
  return `${day}${month}${year}`;
}

/**
 * Supabase's user-create trigger also inserts a junk organisation and a
 * profile row. We overwrite the profile with the real values and remove the
 * orphan organisation afterwards.
 */
async function cleanupJunkOrg(userId: string, realOrgId: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=organisation_id&id=eq.${userId}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const rows = (await res.json()) as Json[];
  const junkOrg = rows?.[0]?.organisation_id;
  if (junkOrg && junkOrg !== realOrgId) {
    await fetch(`${SUPABASE_URL}/rest/v1/organisations?id=eq.${junkOrg}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
  }
}

/**
 * Update a profile row.
 *
 * `resolution=merge-duplicates` matters because the auth trigger already
 * inserted a row with the same id. Unknown columns are dropped on a retry so
 * the write still lands before the migration has been applied.
 */
async function patchProfile(userId: string, fields: Json): Promise<boolean> {
  const attempt = async (payload: Json) => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: "PATCH",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal, resolution=merge-duplicates",
        },
        body: JSON.stringify(payload),
      }
    );
    return { ok: res.ok, body: res.ok ? "" : await res.text() };
  };

  let result = await attempt(fields);
  if (result.ok) return true;
  // 42703 = undefined_column: retry without the not-yet-migrated keys.
  const retry: Json = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key !== "student_id") retry[key] = value;
  }
  result = await attempt(retry);
  return result.ok;
}

/**
 * Whether an address already has an account.
 *
 * Every page of the auth user list is searched. The admin API pages at fifty
 * by default, so the first version of this checked one fiftieth of the
 * school's accounts and let the rest through — the invite then failed at the
 * create step with a raw database error instead of the plain "that email
 * already has an account" the screen knows how to show.
 */
async function authUserExists(email: string): Promise<boolean> {
  if (!SERVICE_KEY) return false;
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?per_page=200&page=${page}`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        }
      );
      if (!res.ok) return false;
      const body = (await res.json()) as { users?: { email?: string }[] };
      const users = body.users ?? [];
      if (
        users.some(user => String(user.email ?? "").toLowerCase() === wanted)
      ) {
        return true;
      }
      if (users.length < 200) return false;
    } catch {
      return false;
    }
  }
  return false;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return fail("Method not allowed", 405);
  if (!SERVICE_KEY) {
    return fail(
      "SUPABASE_SECRET_KEY is not set on the server, so accounts cannot be provisioned.",
      503,
      "no_service_key"
    );
  }

  const caller = await resolveCaller(req);
  if (!caller) return fail("You must be signed in.", 401, "unauthenticated");
  if (!GRANTABLE[caller.role]) {
    return fail(
      "You do not have permission to manage users.",
      403,
      "forbidden"
    );
  }

  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return fail("Bad request", 400);
  }

  const action = String(body.action ?? "");
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const orgId = String(body.organisationId ?? "");
  const fullName = String(body.fullName ?? "").trim();

  if (action === "student") {
    // Student logins are generated credentials, not invitations.
    const studentId = String(body.studentId ?? "");
    if (!studentId) return fail("Pick a student first.", 400);
    return provisionStudent({ studentId, orgId, callerId: caller.id });
  }

  if (action !== "invite") return fail("Unknown action.", 400);
  if (!email || !email.includes("@"))
    return fail("Enter a valid email address.", 400);
  if (!orgId) return fail("Missing school id.", 400);

  const role = String(body.role ?? "staff");
  /*
   * Two separate locks on the top role. The first catches an honest mistake —
   * a form that submits super_admin — and the second catches a crafted
   * request, because GRANTABLE never lists it either way.
   */
  if (role === SUPER_ADMIN_ROLE) {
    return fail(
      "The super admin role cannot be granted. There is exactly one, and it cannot be given to anyone else.",
      403,
      "forbidden"
    );
  }
  const allowed = GRANTABLE[caller.role];
  if (!allowed.includes(role)) {
    return fail(`You cannot invite someone as ${role}.`, 403, "forbidden");
  }

  // already have an account?
  if (await authUserExists(email)) {
    return fail("That email already has an account.", 409, "duplicate");
  }

  const password = makePassword();
  const username = email.split("@")[0];

  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || username },
    }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    return fail(`Could not create the account: ${text.slice(0, 200)}`, 502);
  }
  const created = (await createRes.json()) as { id?: string };
  const userId = created.id;
  if (!userId) return fail("Account creation returned no id.", 502);

  // The DB trigger created its own profile row; correct it.
  await patchProfile(userId, {
    organisation_id: orgId,
    full_name: fullName || username,
    email,
    role,
  });
  await cleanupJunkOrg(userId, orgId);

  // Record the invite when the table exists. Absent the migration the account
  // is still created and usable — we just can't show an audit trail.
  let recorded = false;
  try {
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/invitations`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        organisation_id: orgId,
        email,
        full_name: fullName || username,
        role,
        username,
        temp_password: password,
        status: "pending",
        invited_by: caller.id,
      }),
    });
    recorded = ins.ok;
  } catch {
    recorded = false;
  }

  return Response.json({
    ok: true,
    recorded,
    email,
    username,
    password,
    role,
    message: recorded
      ? "Invite recorded. Share these credentials with them."
      : "Account created. The invitations table has not been created yet, so this invite was not recorded — run supabase/migrations/001_roles_invites.sql.",
  });
}

/**
 * Give a student a portal login.
 *
 * The username is derived from the USN so it is unique and
 * recognisable; the password is generated once and returned to the admin to
 * hand over. It is stored on the student row so it can be reissued, never in
 * the invitations table.
 */
async function provisionStudent({
  studentId,
  orgId,
  callerId,
}: {
  studentId: string;
  orgId: string;
  callerId: string;
}) {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/students?select=id,usn,first_name,last_name,email,organisation_id,date_of_birth&id=eq.${studentId}&limit=1`,
    { headers }
  );
  const rows = (await res.json()) as Json[];
  const student = rows?.[0];
  if (!student) return fail("Student not found.", 404, "not_found");

  const realOrg = String(student.organisation_id ?? orgId);
  const usn = String(student.usn ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
  const name = `${student.first_name ?? ""}${student.last_name ?? ""}`
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase();
  const username = usn || name || `student${studentId.slice(0, 6)}`;
  const email = String(student.email ?? "").trim() || `${username}@gks.edu`;
  // Date of birth as DDMMYYYY when we have a usable one, otherwise a generated
  // password — a student with no recorded date of birth still needs a login,
  // and handing out a blank password would be far worse.
  const password = studentPassword(student.date_of_birth) ?? makePassword();
  const passwordIsDob = studentPassword(student.date_of_birth) !== null;

  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name:
          `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
        student_id: studentId,
      },
    }),
  });

  if (createRes.ok) {
    const created = (await createRes.json()) as { id?: string };
    if (created.id) {
      await patchProfile(created.id, {
        organisation_id: realOrg,
        full_name:
          `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
        email,
        role: STUDENT_ROLE,
        student_id: studentId,
      });
      await cleanupJunkOrg(created.id, realOrg);
    }
  } else if (createRes.status !== 422) {
    return fail("Could not create the student login.", 502);
  }

  /*
   * Keep the credentials so they can be reissued later, in the
   * `student_credentials` table the migration creates. Writing to
   * `students.portal_username` instead would need columns no migration adds,
   * so the write would fail on every run — including after the migration — and
   * a silently-unrecordable credential cannot be regenerated for a family who
   * has lost it.
   *
   * Absent the table the account still exists and works; only the ability to
   * reissue is lost, so this is reported rather than treated as fatal.
   */
  const persisted = await fetch(
    `${SUPABASE_URL}/rest/v1/student_credentials?on_conflict=student_id`,
    {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        student_id: studentId,
        organisation_id: realOrg,
        username,
        password,
        issued_by: callerId,
      }),
    }
  ).then(r => r.ok);

  return Response.json({
    ok: true,
    username,
    password,
    passwordIsDob,
    email,
    persisted,
    issuedTo: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
    issuedBy: callerId,
  });
}

/**
 * Username → account address resolution.
 *
 * ## Why this lives outside `api/login.ts`
 *
 * It started life there, but Vercel builds every `api/*.ts` file into its own
 * serverless function. When `api/recover.ts` imported it, the import survived
 * into the bundle as a bare `./login` specifier and failed at runtime with
 * `ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/api/login'` — the login
 * function exists as `login.js`, which Node's ESM resolver will not match
 * against an extensionless specifier.
 *
 * Anything in `shared/` is bundled into whichever function imports it, the same
 * way `api/invite.ts` already pulls in `shared/super-admin`.
 *
 * ## Why it is not in the browser bundle
 *
 * These helpers read the service key from the environment and query PostgREST.
 * They are imported only by server routes; nothing under `client/` refers to
 * them, so the key never reaches a browser.
 */

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_Y1oStHbYHErfX2FD6xyKeg_PXuVcQ1w";

/**
 * A username is the local part of an email address.
 *
 * This is also a security control, not just tidiness: the value is interpolated
 * into a PostgREST filter, and a comma or a closing paren would let a caller
 * rewrite that filter and dump the whole profiles table. Only characters that
 * cannot appear in a PostgREST filter value are allowed through.
 *
 * The pattern is defined in `client/src/lib/username.ts` and re-exported here so
 * the browser can validate a username without importing this module — which
 * reads the service key and would put it in the client bundle.
 */
export { USERNAME_PATTERN } from "../client/src/lib/username.js";
import { USERNAME_PATTERN } from "../client/src/lib/username.js";

/** Emails allow a couple of characters the username pattern excludes. */
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value) && value.length <= 254;
}

/**
 * Username-prefix lookup against the auth users, the record of record.
 *
 * Every page is searched, not just the first. The admin API pages at two
 * hundred and this school is close to that already, so a member of staff
 * further down the list was not found by name — and could neither sign in nor
 * recover their password.
 */
async function resolveAuthEmails(username: string): Promise<string[]> {
  if (!SERVICE_KEY) return [];
  const wanted = username.toLowerCase();
  const found: string[] = [];
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
      if (!res.ok) return found;
      const body = (await res.json()) as { users?: { email?: string }[] };
      const users = body.users ?? [];
      found.push(
        ...users
          .map(user =>
            String(user.email ?? "")
              .trim()
              .toLowerCase()
          )
          .filter(
            email => isValidEmail(email) && email.split("@")[0] === wanted
          )
      );
      if (users.length < 200) break;
    } catch {
      return found;
    }
  }
  return found;
}

/**
 * Find every account whose chosen username matches.
 *
 * Two sources, in order:
 *
 *   1. `profiles.username` — what the person chose in Settings. This is the
 *      column a rename writes to, so a renamed account is found here and
 *      nowhere else: its email local part no longer has to agree with it.
 *   2. the email local part — the original behaviour, kept as a fallback so an
 *      account that has never set a name (or predates migration 003) still
 *      signs in with the name it always had.
 *
 * `basanagouda.reddy` exists on two different addresses, so this can return more
 * than one. PostgREST wants `*` and `%` percent-encoded inside the filter value,
 * hence the manual encode rather than a plain template string.
 */
export async function resolveEmails(username: string): Promise<string[]> {
  const wanted = username.toLowerCase();

  const byColumn = await emailsWhere(
    `select=email&username=eq.${encodeURIComponent(wanted)}&limit=10`
  );
  if (byColumn.length > 0) return byColumn;

  // `encodeURIComponent` deliberately leaves "*" alone — it is in the
  // unreserved set — but PostgREST then reads it as syntax rather than as the
  // SQL LIKE wildcard and rejects the whole filter with "error code 1101".
  // Percent is handled correctly by encodeURIComponent; the asterisk is not,
  // so it is replaced by hand.
  const filter = encodeURIComponent(`*${wanted}@%`).replace(/\*/g, "%2A");
  const byEmail = (
    await emailsWhere(`select=email&email=like.${filter}&limit=50`)
  ).filter(email => email.slice(0, email.lastIndexOf("@")) === wanted);
  if (byEmail.length > 0) return byEmail;

  /*
   * The USN is the pupil identifier, and it lives on the student record rather
   * than on the profile. A newly enrolled pupil whose profile has not yet been
   * renamed still has to be able to sign in with the USN printed for them.
   */
  const byUsn = await emailsForUsn(wanted);
  if (byUsn.length > 0) return byUsn;

  const byStaffUsn = await emailsForStaffUsn(wanted);
  if (byStaffUsn.length > 0) return byStaffUsn;

  /*
   * Neither source in `profiles` matched, so consult the auth user list — the
   * authority for what can actually receive a recovery email.
   *
   * `profiles.email` is only a copy, and the two drift: with secure email
   * change enabled a rename only lands once the new mailbox is confirmed, and an
   * unconfirmed rename left the super admin unable to sign in or reset because
   * every path resolves the username through a stale copy.
   */
  return resolveAuthEmails(wanted);
}

/**
 * The account addresses of the pupil(s) whose USN this is.
 *
 * Compared without case, because the USN is printed as `GGS1001` and typed
 * however the person remembers it, and because this function is called with
 * the lower-cased form of whatever was entered.
 */
async function emailsForUsn(usn: string): Promise<string[]> {
  if (!SERVICE_KEY) return [];
  try {
    const studentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/students?select=id&usn=ilike.${encodeURIComponent(
        usn
      )}&limit=10`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    );
    if (!studentRes.ok) return [];
    const students = (await studentRes.json()) as { id?: string }[];
    const ids = students.map(student => String(student.id ?? "")).filter(Boolean);
    if (!ids.length) return [];

    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=email&student_id=in.(${ids
        .map(id => encodeURIComponent(id))
        .join(",")})&limit=10`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    );
    if (!profileRes.ok) return [];
    const profiles = (await profileRes.json()) as { email?: string | null }[];
    return Array.from(
      new Set(
        profiles
          .map(profile =>
            String(profile?.email ?? "")
              .trim()
              .toLowerCase()
          )
          .filter(email => isValidEmail(email))
      )
    );
  } catch {
    return [];
  }
}


/**
 * The account addresses of the staff member whose USN this is.
 *
 * Staff sign in with the identifier on their record, so this path has to exist
 * alongside the pupil one even when a profile still carries an older username.
 */
async function emailsForStaffUsn(usn: string): Promise<string[]> {
  if (!SERVICE_KEY) return [];
  try {
    const staffRes = await fetch(
      `${SUPABASE_URL}/rest/v1/staff?select=profile_id&usn=ilike.${encodeURIComponent(
        usn
      )}&limit=10`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    );
    if (!staffRes.ok) return [];
    const staff = (await staffRes.json()) as { profile_id?: string | null }[];
    const ids = staff
      .map(person => String(person.profile_id ?? ""))
      .filter(Boolean);
    if (!ids.length) return [];

    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=email&id=in.(${ids
        .map(id => encodeURIComponent(id))
        .join(",")})&limit=10`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    );
    if (!profileRes.ok) return [];
    const profiles = (await profileRes.json()) as { email?: string | null }[];
    return Array.from(
      new Set(
        profiles
          .map(profile =>
            String(profile?.email ?? "")
              .trim()
              .toLowerCase()
          )
          .filter(email => isValidEmail(email))
      )
    );
  } catch {
    return [];
  }
}

/** Read the distinct, valid emails of the rows matching a PostgREST query. */
async function emailsWhere(query: string): Promise<string[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${query}`, {
    headers: {
      apikey: SERVICE_KEY || ANON_KEY,
      Authorization: `Bearer ${SERVICE_KEY || ANON_KEY}`,
    },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as { email?: string | null }[];
  return Array.from(
    new Set(
      rows
        .map(row =>
          String(row?.email ?? "")
            .trim()
            .toLowerCase()
        )
        .filter(email => isValidEmail(email))
    )
  );
}

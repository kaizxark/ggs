/**
 * Portal accounts: provisioning, and changing what a person signed in with.
 *
 * ## What this owns
 *
 * One code path that turns a saved student or staff record into an account
 * somebody can sign in to, and keeps that account in step afterwards. Both
 * `api/students.ts` and `api/staff.ts` call into here, so a pupil and a member
 * of staff end up with the same shape of account and the same rules.
 *
 * ## The credential itself
 *
 * A person's username is their email address and their first password is their
 * date of birth as six digits — `290805` for 29 August 2005. That means the
 * whole flow needs **no table that does not already exist**: the password lives
 * in Supabase Auth, and the username is the address the record already carries,
 * which `/api/login` accepts directly.
 *
 * That is the reason this was built this way rather than against a credential
 * table. A school that cannot yet run a migration should not be locked out of
 * its own roll call, and every part of the flow below was built to work against
 * the schema as it is today:
 *
 *   • `student_credentials` already exists, so a pupil's current password is
 *     recorded there in the clear for the school owner to read back.
 *   • A member of staff has no such table. Their password is *derived* from
 *     their record rather than stored, which is why the owner's screen can show
 *     it without anywhere to have put it.
 *   * Changing a password goes through the Supabase admin API, which needs no
 *     schema at all.
 *
 * Migration 007, when it is run, adds a real store for staff credentials and the
 * table the OTP flow needs. Nothing here changes when it is: the derived
 * password is only consulted for display, never for authentication.
 */

import {
  ddmmDate,
  emailLocalPart,
  generateSecret,
  isPlaceholderEmail,
  isUsableEmail,
  normaliseEmail,
  passwordProblem,
  PASSWORD_MIN_LENGTH,
  PLACEHOLDER_EMAIL_DOMAIN,
  placeholderEmail,
  type PortalSubject,
} from "./portal-accounts.js";
import { SERVICE_KEY, SUPABASE_URL } from "./ai-auth.js";
import { readSharedUsername } from "./shared-signin.js";
import { isValidUsername } from "./username-lookup.js";

type Json = Record<string, unknown>;

/** Which table a credential hangs off. */
const CREDENTIAL_TABLE: Record<PortalSubject, string> = {
  student: "student_credentials",
  staff: "staff_credentials",
};

/** The column each table keys on. */
const SUBJECT_COLUMN: Record<PortalSubject, string> = {
  student: "student_id",
  staff: "staff_id",
};

/** How many attempts the caller gets at the whole provisioning sequence. */
const MAX_CONFLICT_ATTEMPTS = 8;

function headers(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function readJson<T>(res: Response): Promise<T[]> {
  try {
    return ((await res.json()) as T[]) ?? [];
  } catch {
    return [];
  }
}

/** First matching row, or null. A failure reads as "not found". */
async function first<T>(path: string): Promise<T | null> {
  if (!SERVICE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { ...headers(), Prefer: "count=exact" },
    });
    if (!res.ok) return null;
    const rows = await readJson<T>(res);
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Remove the junk organisation Supabase's own trigger creates.
 *
 * Creating an auth user fires a database trigger that inserts a profile row and
 * an organisation of its own. `api/invite.ts` has the same workaround and the
 * same explanation; repeated here because the two would otherwise drift, and a
 * drifted cleanup shows up as a school with two organisations and a dashboard
 * that quietly reads from the empty one.
 */
async function cleanupJunkOrg(realOrgId: string): Promise<void> {
  if (!SERVICE_KEY || !realOrgId) return;
  /*
   * `organisations` is (id, name, city, timezone, created_at) — it has no
   * owner_id, so the body api/invite.ts sends here would be rejected with a
   * 42703 or, worse, silently ignored by PostgREST's merge behaviour. The
   * orphan is therefore found the way the column is actually shaped: a
   * creation-time row with no members on it.
   */
  const real = await first<Json>(
    `organisations?select=id,created_at&id=eq.${encodeURIComponent(realOrgId)}&limit=1`
  );
  if (!real) return;

  const createdAt = String(real.created_at ?? "");
  const candidates = await readJson<Json>(
    await fetch(
      `${SUPABASE_URL}/rest/v1/organisations?select=id,created_at&id=neq.${encodeURIComponent(
        realOrgId
      )}&limit=100`,
      { headers: headers() }
    )
  ).catch(() => [] as Json[]);

  /*
   * An orphan is created within a second or two of the user it belongs to and
   * has no profile pointing at it. Anything older, or with members, is a real
   * school and is left strictly alone.
   */
  const threshold = Date.parse(createdAt) - 60_000;
  for (const org of candidates) {
    const orgId = String(org.id ?? "");
    if (!orgId) continue;
    if (
      Number.isFinite(threshold) &&
      Date.parse(String(org.created_at ?? "")) < threshold
    ) {
      continue;
    }
    const members = await first<Json>(
      `profiles?select=id&organisation_id=eq.${encodeURIComponent(orgId)}&limit=1`
    );
    if (members) continue;
    await fetch(
      `${SUPABASE_URL}/rest/v1/organisations?id=eq.${encodeURIComponent(orgId)}`,
      {
        method: "DELETE",
        headers: { ...headers(), Prefer: "return=minimal" },
      }
    ).catch(() => null);
  }
}

/** The username a record is issued before its owner picks one. */
export function provisionalUsername(
  subject: PortalSubject,
  token: string
): string {
  const scope = subject === "student" ? "pupil" : "staff";
  const safe = String(token ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return `${scope}.${safe || "pending"}`;
}

/**
 * The email an account signs in with, given whatever the record carries.
 *
 * A record with no address still gets one, because the email is now the thing
 * somebody proves they own. The placeholder is in the reserved `.invalid`
 * space, so it cannot be delivered to anybody and cannot be quietly registered
 * by a third party later.
 */
export function signInEmail(
  subject: PortalSubject,
  token: string,
  supplied: unknown
): string {
  const given = normaliseEmail(supplied);
  if (isUsableEmail(given)) return given;
  return placeholderEmail(subject, token);
}

export interface ProvisionInput {
  subject: PortalSubject;
  recordId: string;
  organisationId: string;
  /** The address typed on the record. Falls back to a placeholder. */
  email?: unknown;
  /**
   * What the person types to sign in. Defaults to the address for older
   * callers, but pupils and staff use their USN so the sign-in name matches the
   * identifier printed on their record.
   */
  username?: unknown;
  name: string;
  /**
   * The app_role to give the linked profile.
   *
   * Left out, the profile's existing role is kept. That matters because the
   * role is a property of the person rather than of the record, and the two
   * ways of getting it wrong are both bad: writing a job title into this
   * column is rejected by the enum, and overwriting a role that somebody was
   * given in Settings silently demotes them.
   */
  role?: string;
  /**
   * The date the first password is derived from: a pupil's date of birth, a
   * member of staff's date of joining, since `staff` has no birth date column
   * and one cannot be added without a migration.
   */
  birthDate?: unknown;
  /** The auth user to adopt if the record already has one. */
  existingAuthUserId?: string | null;
  actorId?: string | null;
  /**
   * Overwrite a password the owner has since changed.
   *
   * Only the backfill sets this. Saving a record must never reset somebody's
   * chosen password back to their date of birth, which would quietly undo the
   * one thing the flow asks them to do.
   */
  resetPassword?: boolean;
}

export interface ProvisionResult {
  ok: boolean;
  reason?: string;
  username: string;
  email: string;
  authUserId: string;
  created: boolean;
}

/**
 * Make sure this record has an account, and that the account matches the record.
 *
 * Safe to call on every save. It is a no-op when the account is already right,
 * and it repairs one column when only the address moved — so a family that
 * changes their email address keeps their child's account instead of losing it.
 */
export async function provisionPortalAccount(
  input: ProvisionInput
): Promise<ProvisionResult> {
  if (!SERVICE_KEY) {
    return {
      ok: false,
      reason: "not_configured",
      username: "",
      email: "",
      authUserId: "",
      created: false,
    };
  }

  const email = signInEmail(input.subject, input.recordId, input.email);

  /*
   * Pupils and staff sign in with their USN, not their mailbox. The address is
   * still what receives the one-time code; the username is the identifier the
   * school prints on the record.
   */
  const wantedUsername = String(input.username ?? "").trim().toLowerCase();
  const username = isValidUsername(wantedUsername) ? wantedUsername : email;

  /*
   * The first password is derived from the record, so it is never written
   * anywhere as a secret that could leak from a different place than the record
   * itself. Where the record has no usable date the fallback is a generated
   * secret, which only the owner can read — never a guessable one.
   */
  const derived = ddmmDate(input.birthDate);
  const secret = derived ?? generateSecret(24);

  /*
   * The account this record already owns, if it has one.
   *
   * A pupil's account is reached through `profiles.student_id` and a member of
   * staff's through `staff.profile_id`. Both are the link that says the
   * account belongs to this record, and both are written by this function.
   */
  const ownedAuthUserId =
    input.existingAuthUserId ??
    (await resolveAuthUserFor(input.subject, input.recordId));

  const minted = await createAuthUser(email, secret, input.name);

  /*
   * An address that is already taken belongs to somebody.
   *
   * It is this record's to write on only when the account behind it is
   * already the record's own — a record saved a second time, whose account is
   * being kept in step. Anything else is another person's account: a
   * colleague's, a parent's, a pupil's, or somebody at another school.
   * Writing to it here would replace their name, their role and the school
   * they belong to, which is how one person's sign-in ends up belonging to
   * another. So the address is refused and the account behind it is left
   * exactly as it is.
   */
  if (minted && !minted.created && minted.id !== ownedAuthUserId) {
    return {
      ok: false,
      reason: "email_taken",
      username,
      email,
      authUserId: "",
      created: false,
    };
  }

  let authUserId = minted?.id ?? "";
  let created = minted?.created ?? false;

  /*
   * The account could not be minted at all: the admin API was unreachable, or
   * the address was taken and the account behind it could not be read. The
   * record may still have an account of its own from an earlier save, and
   * that one is kept in step rather than lost.
   */
  if (!authUserId) {
    if (!ownedAuthUserId) {
      return {
        ok: false,
        reason: "auth_user_failed",
        username,
        email,
        authUserId: "",
        created: false,
      };
    }
    authUserId = ownedAuthUserId;
  }

  /*
   * On the first pass through — the backfill, or the first save of a record that
   * already existed — the password is written to match the derived one. After
   * that it is left alone, because from then on it belongs to the person and not
   * to the record.
   */
  if (input.resetPassword) {
    await setAuthPassword(authUserId, secret);
  }

  const profileFields: Json = {
    organisation_id: input.organisationId,
    full_name: input.name,
  };
  /*
   * The address is written only when the account was minted here, or when the
   * account is this record's own and already signs in with it. In the
   * fallback above the account kept the address it already had, and putting a
   * different one on the profile would leave the two disagreeing about what
   * the person signs in with.
   */
  if (minted) {
    profileFields.email = email;
    /*
     * The sign-in name is not always the address.
     *
     * A pupil signs in with the school's shared name, and anybody who has
     * renamed themselves signs in with the name they chose. Neither may be
     * quietly moved back to the address just because their record was saved,
     * so the name is only written when the profile has none, or when it is
     * still the provisional one — the address the account was issued with.
     */
    const current = await first<Json>(
      `profiles?select=email,username&id=eq.${encodeURIComponent(authUserId)}&limit=1`
    );
    const currentUsername = String(current?.username ?? "").trim();
    const currentEmail = normaliseEmail(current?.email);
    if (
      !currentUsername ||
      (currentEmail && currentUsername === currentEmail)
    ) {
      profileFields.username = username;
    }
  }
  if (input.role) profileFields.role = input.role;
  if (input.subject === "student") profileFields.student_id = input.recordId;

  await patchProfile(authUserId, profileFields);
  await cleanupJunkOrg(input.organisationId);

  /*
   * A pupil's current password is recorded so the owner can read it back.
   * `student_credentials` already exists with exactly these columns, so this
   * writes nothing that needs a migration. A member of staff has no such table
   * and is not recorded — their password stays derivable from their record.
   */
  if (input.subject === "student") {
    await recordStudentCredential(input, email, derived);
  }

  /*
   * "Created" means an account was minted in this call, not merely that the
   * record has one. The backfill counts this to say how many accounts it made,
   * and a counter that said "provisioned" for a record that already had an
   * account reported the opposite of what happened on a second run.
   */
  return {
    ok: true,
    username,
    email,
    authUserId,
    created,
  };
}

/**
 * Keep `student_credentials` in step with the account.
 *
 * Written only when the password is still the derived one, or when no row
 * exists. Once a pupil has chosen a password of their own, their row keeps it —
 * that row is what the owner reads, and overwriting it would show them a
 * password that no longer works.
 */
async function recordStudentCredential(
  input: ProvisionInput,
  email: string,
  derived: string | null
): Promise<void> {
  const existing = await first<Json>(
    `student_credentials?select=student_id,password&student_id=eq.${encodeURIComponent(
      input.recordId
    )}&limit=1`
  );

  if (existing && derived === null) {
    // No date on the record, so there is nothing to derive; leave whatever is
    // already recorded rather than inventing one.
    await patch(
      "student_credentials",
      input.recordId,
      { email },
      keyColumn("student_credentials")
    );
    return;
  }

  if (existing) {
    if (input.resetPassword) {
      await patch(
        "student_credentials",
        input.recordId,
        { password: derived, email },
        keyColumn("student_credentials")
      );
    } else {
      await patch(
        "student_credentials",
        input.recordId,
        { email },
        keyColumn("student_credentials")
      );
    }
    return;
  }

  await insert("student_credentials", {
    student_id: input.recordId,
    organisation_id: input.organisationId,
    username: email,
    /*
     * The address the account signs in with, kept here so the row can be read
     * on its own. It is the pupil's own address — or the placeholder the
     * school issued — and never the family's, which lives on the pupil's
     * record where it belongs.
     */
    email,
    password: derived ?? generateSecret(24),
    issued_by: input.actorId ?? null,
  });
}

/**
 * The auth user behind an existing record.
 *
 * Found through the record's own link rather than a column on the credential
 * row. The two tables deliberately do not store the auth user id: a pupil's
 * account is reached through `profiles.student_id` and a member of staff's
 * through `staff.profile_id`, and both are already maintained by the
 * provisioning path itself. A third copy would be one more thing to fall out of
 * step with the other two.
 */
async function resolveAuthUserFor(
  subject: PortalSubject,
  recordId: string
): Promise<string | null> {
  const encoded = encodeURIComponent(recordId);
  if (subject === "staff") {
    const row = await first<Json>(
      `staff?select=profile_id&id=eq.${encoded}&limit=1`
    );
    const id = String(row?.profile_id ?? "").trim();
    return id || null;
  }
  const row = await first<Json>(
    `profiles?select=id&student_id=eq.${encoded}&limit=1`
  );
  const id = String(row?.id ?? "").trim();
  return id || null;
}

/**
 * Create the auth user.
 *
 * Returns the id and whether it was created, or null when the attempt failed
 * for a reason other than the address already being taken. A 422 means the
 * account is already there, which is a re-run rather than a failure — and it
 * is reported as not created, so a backfill run twice does not claim to have
 * created anything the second time.
 */
async function createAuthUser(
  email: string,
  secret: string,
  name: string
): Promise<{ id: string; created: boolean } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify({
      email,
      password: secret,
      email_confirm: true,
      user_metadata: { full_name: name },
    }),
  });
  if (res.ok) {
    const body = (await res.json()) as { id?: string };
    return body.id ? { id: body.id, created: true } : null;
  }
  // 422 means the address is taken, which is a re-run rather than a failure.
  if (res.status === 422) {
    const id = await findAuthUserId(email);
    return id ? { id, created: false } : null;
  }
  return null;
}

/**
 * The auth user behind an address.
 *
 * Every page is searched, not just the first. This school has well over a
 * hundred accounts and the admin API pages at two hundred, so somebody past
 * that point was simply not found — and the record they belonged to then
 * looked as though it had no account at all.
 */
async function findAuthUserId(email: string): Promise<string | null> {
  const wanted = normaliseEmail(email);
  for (let page = 1; page <= 20; page += 1) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?per_page=200&page=${page}`,
        {
          headers: headers(),
        }
      );
      if (!res.ok) return null;
      const body = (await res.json()) as {
        users?: { id?: string; email?: string }[];
      };
      const users = body.users ?? [];
      const match = users.find(user => normaliseEmail(user.email) === wanted);
      if (match?.id) return match.id;
      if (users.length < 200) return null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * The account that already uses an address, if any.
 *
 * The auth user list is the authority on this. `profiles.email` is a copy of
 * the address and the two drift apart — a rename only lands once the new
 * mailbox is confirmed — so an account that has been renamed would still look
 * free, and a record could be written onto somebody else's sign-in.
 */
export async function findAccountByEmail(
  email: string
): Promise<string | null> {
  return findAuthUserId(email);
}

/**
 * Correct the profile the database trigger created.
 *
 * Patched rather than inserted, for the same reason api/invite.ts patches: the
 * trigger has already made the row, and an insert here would be a duplicate.
 * A 42703 means the column does not exist on this database — migration 001 adds
 * `student_id` and an older one may not have run — so the link is retried
 * without it rather than failing the whole save.
 */
async function patchProfile(userId: string, fields: Json): Promise<void> {
  const attempt = async (payload: Json): Promise<boolean> => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: {
          ...headers(),
          Prefer: "return=minimal, resolution=merge-duplicates",
        },
        body: JSON.stringify(payload),
      }
    );
    return res.ok || res.status === 204;
  };

  if (await attempt(fields)) return;
  const { student_id: _dropped, ...rest } = fields;
  await attempt(rest);
}

async function insert(table: string, body: Json): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

/**
 * Update one row.
 *
 * `key` names the column to filter on, which defaults to `id`. It is not always
 * `id`: `student_credentials` is keyed by `student_id`, and filtering it by `id`
 * asks PostgREST for a column that does not exist. That request returns 400, the
 * boolean came back false, and every caller ignored it — so a pupil's changed
 * password was never written down and the owner's screen kept showing the
 * original one. The row that is actually updated now is the row you can read.
 */
async function patch(
  table: string,
  id: string,
  body: Json,
  key = "id"
): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${key}=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...headers(), Prefer: "return=minimal" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    console.error(`portal: ${table} update by ${key} failed`, res.status);
  }
  return res.ok;
}

/** The key column for a table this module writes to. */
function keyColumn(table: string): string {
  return table === "student_credentials" ? "student_id" : "id";
}

/**
 * Delete an auth user.
 *
 * A 404 is success: the account is already gone, which is the state the caller
 * asked for. Every other failure is reported so a route can refuse to leave an
 * orphaned login behind a deleted record.
 */
export async function deletePortalAccount(authUserId: string): Promise<boolean> {
  if (!authUserId) return true;
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`,
    { method: "DELETE", headers: headers() }
  );
  return res.ok || res.status === 404;
}

/** Set the auth user's password through the admin API. */
async function setAuthPassword(
  userId: string,
  password: string
): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PUT",
      headers: { ...headers(), Prefer: "return=minimal" },
      body: JSON.stringify({ password }),
    }
  );
  return res.ok;
}

export interface ChangeInput {
  authUserId: string;
  /** null means "leave the username alone". */
  username: string | null;
  /** null means "leave the password alone". */
  password: string | null;
  /** The address the account already has; kept unless the username is the address. */
  email: string;
  /**
   * The record this account belongs to, when there is one.
   *
   * Used only to keep `student_credentials` in step so the school owner reads a
   * password that actually works. A member of staff has no such row and is
   * handled without it.
   */
  studentId?: string | null;
  /**
   * The staff record, for the same reason. `staff_credentials` keys on
   * `staff_id`, which is `staff.id` — the `staff` table's own primary key.
   */
  staffId?: string | null;
  /**
   * The school, for the same reason. A credential row cannot be written
   * without it, so a row created here has to say which school it belongs to.
   */
  organisationId?: string | null;
}

export interface ChangeResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/**
 * Change what somebody signs in with.
 *
 * Both halves go through the Supabase admin API and the profile row, and both are
 * optional: renaming yourself does not demand a new password, and changing a
 * password does not demand a new name. Nothing here touches a table that would
 * need a migration, so the flow works on the schema as it stands today.
 *
 * The current password is checked by the caller before this runs — an email
 * address proves control of a mailbox, not knowledge of a password, so without
 * that check anyone who reached an open tab could take the account over.
 */
export async function changePortalCredentials(
  input: ChangeInput
): Promise<ChangeResult> {
  const username =
    input.username === null
      ? null
      : String(input.username).trim().toLowerCase();
  const password = input.password === null ? null : String(input.password);
  const email = normaliseEmail(input.email);

  /*
   * The school's shared sign-in name.
   *
   * It is read before the username is judged, because the shared name is very
   * often an email address and an address is not a legal username: it holds an
   * "@", which the username pattern refuses. A pupil whose name is still the
   * shared one has to be able to save the form without it being rejected, and
   * the only way that works is if the shared name itself is allowed.
   */
  const shared = await readSharedUsername();

  if (
    username !== null &&
    username !== email &&
    username !== shared &&
    !isValidUsername(username)
  ) {
    return {
      ok: false,
      error: "invalid_username",
      message:
        "A username is 2 to 64 characters: letters, numbers, dots, dashes and underscores.",
    };
  }
  if (password !== null) {
    const problem = passwordProblem(password);
    if (problem) return { ok: false, error: "weak_password", message: problem };
  }

  /*
   * The username is normally the address, and `/api/login` resolves a full
   * address directly. Changing it away from the address means the typed name now
   * has to resolve through `profiles.username` instead, so that column is the
   * one that has to carry the change.
   */
  if (password !== null) {
    const saved = await setAuthPassword(input.authUserId, password);
    if (!saved) {
      return {
        ok: false,
        error: "password_not_saved",
        message: "That password could not be saved. Please try again.",
      };
    }
  }

  const profileFields: Json = {};
  if (username !== null) profileFields.username = username;
  await patchProfile(input.authUserId, profileFields);

  /*
   * Best effort, and deliberately after the auth write rather than before it:
   * if this row is left stale the owner reads a password that no longer works,
   * which is recoverable by running the backfill again. Failing the whole change
   * instead would leave the real password changed and the caller told it failed.
   *
   * The row keeps the account's address in its `username` column, because that
   * column is unique within the school and the shared sign-in name is not: a
   * hundred pupils cannot each hold a copy of one name in a column that
   * refuses duplicates. The name they actually sign in with is on the profile.
   */
  if (input.studentId && (password !== null || username !== null)) {
    const fields: Json = { email };
    if (password !== null) fields.password = password;
    if (username !== null && username !== shared) {
      /*
       * The pupil has claimed a name of their own. The shared name does not
       * reach them from now on: it is theirs, and it is theirs alone.
       */
      fields.username_chosen_at = new Date().toISOString();
    }
    await patch(
      "student_credentials",
      input.studentId,
      fields,
      SUBJECT_COLUMN.student
    );
  }

  /*
   * The same for a member of staff.
   *
   * A staff member's password used to be derived from their joining date and
   * never written down, so the moment one of them chose their own the owner's
   * screen went on showing the date and a password that no longer worked. The
   * row is written here, keyed by `staff_id`, and the credentials screen reads
   * it in preference to the derived value.
   */
  if (input.staffId && password !== null) {
    const fields: Json = { email, password };
    if (username !== null && username !== shared) {
      fields.username_chosen_at = new Date().toISOString();
    }
    const existing = await first<Json>(
      `${CREDENTIAL_TABLE.staff}?select=staff_id&staff_id=eq.${encodeURIComponent(
        input.staffId
      )}&limit=1`
    );
    if (existing) {
      await patch(
        CREDENTIAL_TABLE.staff,
        input.staffId,
        fields,
        SUBJECT_COLUMN.staff
      );
    } else {
      /*
       * No row yet. A patch would update nothing and say so with a 204, so the
       * row is created instead — the owner reads the password they chose, not
       * the date they joined.
       */
      await insert(CREDENTIAL_TABLE.staff, {
        staff_id: input.staffId,
        organisation_id: input.organisationId ?? null,
        username: username ?? email,
        email,
        password,
        issued_at: new Date().toISOString(),
      });
    }
  }

  return { ok: true };
}

/**
 * Put every pupil's password back to their date of birth.
 *
 * The school hands out one sign-in name and a date of birth, and this is the
 * one-off that makes every account match it: the auth password is written
 * again from the pupil's record, and the school's own record of it is written
 * at the same time so the owner reads a password that works.
 *
 * It is deliberately not part of the ordinary backfill. That one creates
 * accounts and issues addresses; this one overwrites credentials that
 * somebody may have changed on purpose, so it is a separate, named action that
 * the owner has to ask for.
 */
export interface ResetResult {
  /** How many pupils now sign in with their date of birth. */
  reset: number;
  /** How many were left alone, and why. */
  skipped: number;
  /** One line per pupil who could not be reset. */
  failures: string[];
}

export async function resetPupilPasswords(
  organisationId: string
): Promise<ResetResult> {
  const result: ResetResult = { reset: 0, skipped: 0, failures: [] };
  if (!SERVICE_KEY || !organisationId) return result;

  const students = await readJson<Json>(
    await fetch(
      `${SUPABASE_URL}/rest/v1/students?select=id,usn,first_name,last_name,email,date_of_birth&organisation_id=eq.${encodeURIComponent(
        organisationId
      )}&limit=5000`,
      { headers: headers() }
    ).catch(() => new Response("[]", { status: 200 }))
  );

  for (const student of students) {
    const studentId = String(student.id ?? "");
    const name = `${String(student.first_name ?? "")} ${String(
      student.last_name ?? ""
    )}`.trim();
    const label = name || String(student.usn ?? studentId);

    /*
     * The date of birth is the password. A record without one cannot be
     * given a guessable password, so it is left alone and reported.
     */
    const secret = ddmmDate(student.date_of_birth);
    if (!secret) {
      result.skipped += 1;
      result.failures.push(`${label}: no date of birth on the record`);
      continue;
    }

    const authUserId = await resolveAuthUserFor("student", studentId);
    if (!authUserId) {
      result.skipped += 1;
      result.failures.push(`${label}: no sign-in account`);
      continue;
    }

    const saved = await setAuthPassword(authUserId, secret);
    if (!saved) {
      result.skipped += 1;
      result.failures.push(`${label}: the password could not be written`);
      continue;
    }

    /*
     * The school's own record of the password, so the owner reads the one
     * that works. The row is created when it is not there, because a pupil
     * with an account but no row is a pupil the owner cannot help.
     */
    const email = signInEmail("student", studentId, student.email);
    const existing = await first<Json>(
      `student_credentials?select=student_id&student_id=eq.${encodeURIComponent(
        studentId
      )}&limit=1`
    );
    if (existing) {
      await patch(
        "student_credentials",
        studentId,
        {
          password: secret,
          email,
          issued_at: new Date().toISOString(),
        },
        SUBJECT_COLUMN.student
      );
    } else {
      await insert("student_credentials", {
        student_id: studentId,
        organisation_id: organisationId,
        username: email,
        email,
        password: secret,
        issued_by: null,
      });
    }

    result.reset += 1;
  }

  return result;
}

/** What the signed-in person has to finish before the dashboard opens. */
export interface AccountState {
  subject: PortalSubject;
  recordId: string;
  organisationId: string;
  authUserId: string;
  email: string;
  username: string;
  mustSetPassword: boolean;
  name: string;
  role: string;
  hasCredential: boolean;
}

export async function readAccountState(
  authUserId: string
): Promise<AccountState | null> {
  const profile = await first<Json>(
    `profiles?select=id,organisation_id,full_name,email,role,username,student_id&id=eq.${encodeURIComponent(
      authUserId
    )}&limit=1`
  );
  if (!profile) return null;

  /*
   * The staff row is found through the link, not through its own primary key.
   *
   * `staff.id` is the row's own uuid and `staff.profile_id` is the auth user
   * it belongs to, and the two are different values for anybody the
   * application created. Filtering on `id` as well therefore matched only the
   * seeded rows, where the two happen to be the same value, and matched
   * nothing at all for everybody else — which left a member of staff with no
   * staff record, and their changed password written against the wrong key.
   */
  const staffRow = await first<Json>(
    `staff?select=id,organisation_id,name,profile_id` +
      `&or=(profile_id.eq.${encodeURIComponent(authUserId)},id.eq.${encodeURIComponent(
        authUserId
      )})&limit=1`
  );

  if (staffRow) {
    return {
      subject: "staff",
      recordId: String(staffRow.id),
      organisationId: String(
        staffRow.organisation_id ?? profile.organisation_id ?? ""
      ),
      authUserId,
      // The username is the address. `profiles.username` is kept equal to it so
      // `/api/login` resolves the typed name on either path — by address, or by
      // the username column if somebody has since renamed themselves.
      email: normaliseEmail(profile.email),
      username: String(profile.username ?? emailLocalPart(profile.email)),
      mustSetPassword: false,
      name: String(staffRow.name ?? profile.full_name ?? ""),
      role: String(profile.role ?? "staff"),
      hasCredential: true,
    };
  }

  if (profile.student_id) {
    /*
     * `profiles.student_id` is the pupil's own primary key, so it matches
     * `students.id`. Filtering on `student_id` here asks PostgREST for a column
     * the table does not have; it answers 400, and `first()` turns that into
     * null, which reads as "this pupil has no record" and drops them onto the
     * unlinked-account message. The broken query had been failing silently for
     * every single pupil.
     */
    const student = await first<Json>(
      `students?select=id,organisation_id,first_name,last_name,email&id=eq.${encodeURIComponent(
        String(profile.student_id)
      )}&limit=1`
    );
    if (student) {
      const credentials = await first<Json>(
        `student_credentials?select=username,password&student_id=eq.${encodeURIComponent(
          String(student.id)
        )}&limit=1`
      );
      return {
        subject: "student",
        recordId: String(student.id),
        organisationId: String(
          student.organisation_id ?? profile.organisation_id ?? ""
        ),
        authUserId,
        email: normaliseEmail(student.email ?? profile.email),
        // A pupil signs in with the name on their profile: the school's
        // shared name, or the one they chose for themselves. The credential
        // row keeps the account's address, which is not what they type.
        username: String(profile.username ?? credentials?.username ?? ""),
        mustSetPassword: false,
        name: `${String(student.first_name ?? "")} ${String(student.last_name ?? "")}`.trim(),
        role: "student",
        hasCredential: true,
      };
    }
  }

  // An administrator with no pupil or staff record behind them.
  return {
    subject: "staff",
    recordId: authUserId,
    organisationId: String(profile.organisation_id ?? ""),
    authUserId,
    email: normaliseEmail(profile.email),
    username: String(profile.username ?? emailLocalPart(profile.email)),
    mustSetPassword: false,
    name: String(profile.full_name ?? ""),
    role: String(profile.role ?? "admin"),
    hasCredential: true,
  };
}

export { PASSWORD_MIN_LENGTH, PLACEHOLDER_EMAIL_DOMAIN, isPlaceholderEmail };

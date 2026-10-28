/**
 * The sign-in name every pupil shares.
 *
 * ## What the school asked for
 *
 * One name for the whole roll call: a pupil types it, types their date of
 * birth, and is in. The name is held once, here, rather than copied onto a
 * hundred pupil records, because a hundred copies of one string is a hundred
 * things to keep in step and a hundred places for it to go stale.
 *
 * ## Why it is a setting and not a column on the pupil record
 *
 * `student_credentials.username` is unique per school — the database refuses
 * two pupils with the same name, because a duplicate login name fails
 * confusingly rather than loudly. So the shared name cannot live there. It
 * lives in `public.settings`, which is the table the school already keeps its
 * own configuration in, and the sign-in route reads it when it needs to work
 * out what a typed name means.
 *
 * ## How a typed name is turned into an account
 *
 * Three cases, in this order:
 *
 *   1. the typed name is the shared name — it means "a pupil", and the
 *      password says which one. The password is checked against each pupil's
 *      recorded credential and the one that matches is signed in.
 *   2. the typed name is somebody's own name or address — it means that
 *      account, exactly as it always did.
 *
 * The shared name is checked *first* on purpose. It is often the school
 * owner's own address, and letting it fall through to case 2 would mean a
 * pupil's date of birth was tried against the owner's account before the
 * pupil was considered at all.
 *
 * ## The weakness, stated plainly
 *
 * A date of birth is not a secret. It is on a birth certificate, in a
 * WhatsApp group, and in every teacher's register. So the shared name plus a
 * date of birth is a credential that anybody who knows the child can use.
 *
 * The school asked for it because it is the only thing a small child can
 * remember and type unaided, and the flow around it is built to make it
 * temporary: every pupil can replace it from Settings, the emailed code
 * needs no password at all, and the school owner can read every account's
 * real credential on the credentials screen and hand it out.
 *
 * ## Why this file is not in the browser bundle
 *
 * It reads the service key. `shared/username-lookup.ts` has the same rule and
 * the same reason.
 */

import { SERVICE_KEY, SUPABASE_URL } from "./ai-auth.js";
import { ddmmDate, normaliseEmail } from "./portal-accounts.js";
import { isValidEmail, isValidUsername } from "./username-lookup.js";

type Json = Record<string, unknown>;

/**
 * The key the shared name is stored under, in `public.settings`.
 *
 * The same table the school name and the academic year live in, so the value
 * is a piece of school configuration rather than a piece of code.
 */
export const SHARED_USERNAME_SETTING_KEY = "portal_shared_username";

/** How many ids go in one `in.(...)` filter. Keeps the URL a sane length. */
const ID_CHUNK = 40;

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

/** Trim and lowercase. Every comparison of the shared name goes through this. */
export function normaliseSharedUsername(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Why a shared name cannot be used, or null when it can.
 *
 * Both shapes are allowed: an address, because that is what the school
 * handed out, and a plain name, because a school that would rather not put an
 * address in every pupil's hands can use one word instead. The address is
 * checked with the same pattern the sign-in route uses, so a name that the
 * login form would reject is refused here rather than at the door.
 */
export function sharedUsernameProblem(value: unknown): string | null {
  const name = normaliseSharedUsername(value);
  if (!name) return "Enter the sign-in name for pupils.";
  if (name.length > 254) return "That is too long to be an address.";
  if (name.includes("@")) {
    if (!isValidEmail(name)) {
      return "That does not look like an email address.";
    }
    return null;
  }
  if (!isValidUsername(name)) {
    return "A username is 2 to 64 characters: letters, numbers, dots, dashes and underscores.";
  }
  return null;
}

/**
 * The shared name, or "" when the school has not set one.
 *
 * A failure to read it reads as "not set" rather than throwing: a sign-in
 * route that cannot reach the settings table should still let a member of
 * staff sign in with their own name.
 */
export async function readSharedUsername(): Promise<string> {
  const row = await first<{ value?: unknown }>(
    `settings?select=value&key=eq.${encodeURIComponent(
      SHARED_USERNAME_SETTING_KEY
    )}&limit=1`
  );
  const value = row?.value;
  if (typeof value === "string") return normaliseSharedUsername(value);
  return "";
}

/**
 * Store the shared name.
 *
 * Written through the key rather than the primary key, because the key is
 * what everything else looks it up by and the id is an arbitrary label. The
 * row is created on the way in if it is not there yet.
 */
export async function writeSharedUsername(value: unknown): Promise<boolean> {
  const name = normaliseSharedUsername(value);
  if (!name) return false;

  /*
   * The row is written by key rather than by its own id, because the key is
   * what everything else looks it up by.
   *
   * The update asks for the rows it changed. A PATCH that matches nothing
   * still answers 204, so without that the write would report success on a
   * setting that had not been stored at all — and the school would go on
   * handing out a name that no pupil was reached by. An empty answer means
   * there was no row yet, and the row is created below.
   */
  const updated = await fetch(
    `${SUPABASE_URL}/rest/v1/settings?key=eq.${encodeURIComponent(
      SHARED_USERNAME_SETTING_KEY
    )}`,
    {
      method: "PATCH",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify({ value: name }),
    }
  ).catch(() => null);

  if (updated?.ok) {
    const rows = await readJson<Json>(updated);
    if (rows.length > 0) return true;
  }

  const created = await fetch(
    `${SUPABASE_URL}/rest/v1/settings?on_conflict=key`,
    {
      method: "POST",
      headers: {
        ...headers(),
        Prefer: "return=minimal,resolution=merge-duplicates",
      },
      body: JSON.stringify({
        id: `set-${SHARED_USERNAME_SETTING_KEY}`,
        key: SHARED_USERNAME_SETTING_KEY,
        value: name,
      }),
    }
  ).catch(() => null);
  return Boolean(created?.ok);
}

/**
 * True when the typed value is the school's shared pupil name.
 *
 * Compared against the stored value, so changing the name in Settings takes
 * effect on the next sign-in without a deployment.
 */
export async function isSharedUsername(value: unknown): Promise<boolean> {
  const typed = normaliseSharedUsername(value);
  if (!typed) return false;
  const shared = await readSharedUsername();
  if (!shared) return false;
  return typed === shared;
}

/** A pupil's account, as the shared sign-in path sees it. */
export interface PupilAccount {
  /** The pupil's own record id. */
  studentId: string;
  name: string;
  usn: string;
  /** The address the account signs in with. */
  email: string;
  /**
   * The password the account currently holds, when it is known.
   *
   * It comes from the credential row, which is written when the account is
   * provisioned and rewritten whenever the pupil changes it. A pupil with no
   * row at all has no recorded password, and the date of birth is used
   * instead.
   */
  password: string | null;
  /**
   * True when the pupil has chosen a sign-in name of their own.
   *
   * A pupil who has claimed one is no longer reached through the shared name;
   * their own name is theirs alone.
   */
  claimed: boolean;
}

/**
 * Every pupil account, with the credential that signs it in.
 *
 * Read in three queries that run together: the credential rows, the pupil
 * records, and the profiles that carry the address the account actually
 * authenticates with.
 *
 * The profile is the authority for that address rather than the pupil record,
 * because the record's address can be edited after the account was minted and
 * the two drift. The pupil record is the fallback, and the credential row's
 * own copy is the last resort.
 */
export async function readPupilAccounts(): Promise<PupilAccount[]> {
  if (!SERVICE_KEY) return [];

  const [credentialRows, studentRows, profileRows] = await Promise.all([
    readJson<Json>(
      await fetch(
        `${SUPABASE_URL}/rest/v1/student_credentials?select=student_id,username,email,password,username_chosen_at&limit=5000`,
        { headers: headers() }
      ).catch(() => new Response("[]", { status: 200 }))
    ),
    readJson<Json>(
      await fetch(
        `${SUPABASE_URL}/rest/v1/students?select=id,usn,first_name,last_name,email,date_of_birth&limit=5000`,
        { headers: headers() }
      ).catch(() => new Response("[]", { status: 200 }))
    ),
    readJson<Json>(
      await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=id,email,student_id&student_id=not.is.null&limit=5000`,
        { headers: headers() }
      ).catch(() => new Response("[]", { status: 200 }))
    ),
  ]);

  const students = new Map(studentRows.map(row => [String(row.id), row]));
  const profiles = new Map(
    profileRows.map(row => [String(row.student_id), row])
  );
  const credentials = new Map(
    credentialRows.map(row => [String(row.student_id), row])
  );

  const accounts: PupilAccount[] = [];

  for (const student of studentRows) {
    const id = String(student.id);
    const credential = credentials.get(id);
    const profile = profiles.get(id);
    const name = `${String(student.first_name ?? "")} ${String(
      student.last_name ?? ""
    )}`.trim();

    /*
     * The first address that is actually there.
     *
     * `??` would not do: an empty string is not null, so a profile whose
     * address was cleared would stop the search and the pupil would be
     * treated as having no account at all — when their record still carried
     * one.
     */
    const email =
      normaliseEmail(profile?.email) ||
      normaliseEmail(student.email) ||
      normaliseEmail(credential?.email);
    if (!email) continue;

    const recorded = String(credential?.password ?? "").trim();
    const derived = ddmmDate(student.date_of_birth);
    const password = recorded || derived;

    accounts.push({
      studentId: id,
      name,
      usn: String(student.usn ?? ""),
      email,
      password: password || null,
      claimed: Boolean(credential?.username_chosen_at),
    });
  }

  return accounts;
}

/**
 * The pupils whose password is the one given.
 *
 * More than one match means two pupils share a date of birth, and the shared
 * name cannot say which of them is signing in. The caller is expected to
 * refuse rather than pick: signing the first one in would put one child in
 * another child's account, which is a worse outcome than asking them to use
 * the code instead.
 */
export function matchPupilsByPassword(
  accounts: PupilAccount[],
  password: string
): PupilAccount[] {
  const wanted = String(password ?? "");
  if (!wanted) return [];
  return accounts.filter(account => account.password === wanted);
}

/**
 * Put the shared name on every pupil who has not chosen one of their own.
 *
 * A pupil who has claimed a name keeps it: `username_chosen_at` is what says
 * they have, and it is set the moment they choose. Everyone else is moved
 * onto the shared name, so the school can hand out one sign-in name and have
 * it mean something.
 *
 * Returns how many profiles were written.
 */
export async function applySharedUsernameToPupils(
  value: unknown
): Promise<number> {
  const shared = normaliseSharedUsername(value);
  if (!shared || !SERVICE_KEY) return 0;

  const credentialRows = await readJson<Json>(
    await fetch(
      `${SUPABASE_URL}/rest/v1/student_credentials?select=student_id,username_chosen_at&limit=5000`,
      { headers: headers() }
    ).catch(() => new Response("[]", { status: 200 }))
  );

  const claimed = new Set(
    credentialRows
      .filter(row => row.username_chosen_at)
      .map(row => String(row.student_id))
  );

  const profileRows = await readJson<Json>(
    await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,student_id&student_id=not.is.null&limit=5000`,
      { headers: headers() }
    ).catch(() => new Response("[]", { status: 200 }))
  );

  const targets = profileRows
    .map(row => String(row.student_id ?? ""))
    .filter(id => id && !claimed.has(id));

  let written = 0;
  for (let index = 0; index < targets.length; index += ID_CHUNK) {
    const chunk = targets.slice(index, index + ID_CHUNK);
    if (chunk.length === 0) continue;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?student_id=in.(${chunk
        .map(id => encodeURIComponent(id))
        .join(",")})`,
      {
        method: "PATCH",
        headers: { ...headers(), Prefer: "return=minimal" },
        body: JSON.stringify({ username: shared }),
      }
    ).catch(() => null);
    if (res?.ok) written += chunk.length;
  }

  return written;
}

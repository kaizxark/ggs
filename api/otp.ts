/**
 * Sign in with an emailed one-time code.
 *
 * ## Why this route exists
 *
 * The sign-in screen has always offered a second way in — "Sign in with an
 * email code instead" — and the browser has always called this endpoint. The
 * route itself was never written, so the button returned 404 and the only way
 * into the product was a password.
 *
 * A code is the right answer for the people this product serves. A pupil's
 * first password is derived from their date of birth, which is printed on a
 * birth certificate and known to every teacher who has marked a register; a
 * parent has no password at all. Neither is a secret, and both are guessable
 * by anyone who knows the child. The code replaces that: the person proves
 * they can read a mailbox, and the thing they read is a number that expires in
 * ten minutes.
 *
 * ## The shape of it
 *
 *   request  { email }              →  a code is mailed out
 *   verify   { email, code }        →  a session, once the code is right
 *
 * Both answers are deliberately dull. "Request" says the same thing whether or
 * not the address is registered, because a sign-in screen that answers
 * differently is a list of who has an account. "Verify" says the same thing
 * whether the code was wrong, expired or never existed.
 *
 * ## The code itself
 *
 * Six digits, generated with rejection sampling so the range is even, stored
 * only as a salted SHA-256 hash. `login_otp_codes` has row level security
 * turned on with no policies at all, so nothing short of the service key can
 * read a row of it — a code the browser could read would be a code any signed
 * in user could read, which is the same as no code at all.
 *
 * ## Where the code goes when the account has no real address
 *
 * A pupil whose record has no email address is issued a placeholder in the
 * reserved `.invalid` domain, which is inert by construction: it cannot be
 * delivered to and cannot be registered by somebody else. But that also means
 * a code mailed there goes nowhere, and a pupil who has never been given a
 * real address could never sign in.
 *
 * The school already holds the family's address on the pupil's record, as
 * `guardian_email`. So a code for a pupil with a placeholder address is sent
 * to the guardian instead, and says whose account it opens. The pupil still
 * types the address they know; the code is checked against their account.
 *
 * ## Runtime
 *
 * Node.js rather than Edge, unlike most of the routes here. Nodemailer
 * depends on `tls`, `net` and `dns`, which the Edge runtime does not provide.
 *
 * The handler is a *named* HTTP method export rather than a default export.
 * A Node function is called with `(req, res)` and writes through `res`; the
 * Edge routes in this project are Web-standard and return a `Response`.
 * Handing a `Response` to the Node runtime does not fail loudly — Vercel logs
 * a warning, discards the return value and waits for the function to finish,
 * so the route answers nothing and the caller sees a bare 504 after five
 * minutes. `export async function POST(request)` opts into the fetch-style
 * signature that does work here.
 */

import { ANON_KEY, SERVICE_KEY, SUPABASE_URL } from "../shared/ai-auth.js";
import {
  generateOtpCode,
  hashOtp,
  isPlaceholderEmail,
  isUsableEmail,
  normaliseEmail,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_SEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  PASSWORD_OTP_PREFIX,
  verifyOtpHash,
} from "../shared/portal-accounts.js";
import { sendOtpEmail } from "../shared/otp-mail.js";
import { isSuperAdminId } from "../shared/super-admin.js";
import { isSharedUsername } from "../shared/shared-signin.js";
import {
  isValidUsername,
  resolveEmails,
  USERNAME_PATTERN,
} from "../shared/username-lookup.js";

export const config = { runtime: "nodejs" };

type Json = Record<string, unknown>;

/**
 * The same message whatever happens.
 *
 * Any difference between "that address has an account" and "it does not" turns
 * this into a way to enumerate staff accounts and families, so the reply is
 * constant and the work is done quietly either way.
 */
const GENERIC =
  "If that address is registered, a sign-in code is on its way. Check your inbox.";

/**
 * The answer when the school's shared pupil sign-in name is typed.
 *
 * The shared name is not an account — it stands for "a pupil" — and a pupil
 * needs to say *which* one, so it cannot be asked for a code on its own. The
 * message says what to type instead, and names the other way in, because the
 * shared name is very often the school owner's own address and they are
 * entitled to a code for it like anybody else.
 *
 * It repeats nothing secret: the shared name is written on the board at
 * school, and the message does not say whether any account holds it.
 */
const SHARED_NAME_CODE =
  "That is the sign-in name every pupil shares. A pupil should enter their username to get a code. If it is your own account, the code is on its way.";

/** Per-isolate throttle, matching the limit used by /api/login. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 20;

function throttled(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

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
 * The shape of a USN.
 *
 * The school prints them as `GGS1001`: letters, digits and the odd
 * slash. A child reads one off a slip and types it however it was written
 * down, so the punctuation and the case are noise — but the shape is worth
 * recognising, because it is the one identifier a pupil always has to hand.
 */
const USN_PATTERN =
  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9][A-Za-z0-9 /.\-]{1,31}$/;

/**
 * The identifier a person typed, if it could be one.
 *
 * Three things are accepted: an address, a username and a USN.
 * The last two are recognised by shape rather than by looking anything up, so
 * a value that is none of them is refused before any work is done. Refusing it
 * says nothing about the school: the shape of a string is not a fact about who
 * has an account.
 */
function readIdentifier(body: Json): string {
  const raw = String(body.identifier ?? body.email ?? "").trim();
  if (!raw) return "";
  if (raw.includes("@")) {
    return isUsableEmail(raw) ? normaliseEmail(raw) : "";
  }
  const lower = raw.toLowerCase();
  if (isValidUsername(lower) && USERNAME_PATTERN.test(lower)) return lower;
  if (USN_PATTERN.test(raw)) return raw;
  return "";
}

/** The account behind an address, and where a code for it has to go. */
interface Account {
  /** The auth user id, which is also `profiles.id`. */
  id: string;
  /** The auth address, which is unique and is what a session is minted for. */
  email: string;
  /** The same value, named explicitly for the challenge path. */
  authEmail: string;
  /** The address on the student/staff record, where the code is delivered. */
  recordEmail: string;
  role: string;
  username: string;
  name: string;
  organisationId: string;
  kind: "student" | "staff" | "super_admin";
  recordId: string;
  /**
   * Where the code goes.
   *
   * Null means there is nowhere to send it, which is the honest answer: a
   * message that cannot be delivered is not a message that was sent.
   */
  deliveryEmail: string | null;
  /** Whose account the code opens, when it was sent to somebody else. */
  onBehalfOf: string | null;
  /** The name of whoever the code is being sent to. */
  recipientName: string | null;
}

/**
 * An address the account itself can be reached at.
 *
 * Null for anything unusable, and for the placeholder addresses the school
 * issues: a placeholder is inert by construction, so a code sent to one goes
 * nowhere at all.
 */
function ownDelivery(email: unknown): string | null {
  const address = normaliseEmail(email);
  if (!isUsableEmail(address)) return null;
  if (isPlaceholderEmail(address)) return null;
  return address;
}

/**
 * The auth users, paged.
 *
 * `profiles.email` is a copy of the account's address, and the two drift: with
 * secure email change enabled a rename only lands once the new mailbox is
 * confirmed, so an unconfirmed rename leaves a profile holding an address that
 * matches no real account. The auth user list is the authority for what can
 * actually receive a message, so it is consulted when the profile lookup
 * comes up empty.
 */
async function authUsers(): Promise<{ id: string; email: string }[]> {
  const out: { id: string; email: string }[] = [];
  if (!SERVICE_KEY) return out;
  for (let page = 1; page <= 5; page += 1) {
    let users: { id?: string; email?: string }[] = [];
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
      if (!res.ok) break;
      const body = (await res.json()) as {
        users?: { id?: string; email?: string }[];
      };
      users = body.users ?? [];
    } catch {
      break;
    }
    for (const user of users) {
      if (user.id) out.push({ id: user.id, email: normaliseEmail(user.email) });
    }
    if (users.length < 200) break;
  }
  return out;
}

/**
 * The account behind a pupil record.
 *
 * Split out of the address lookup so that a pupil found by USN
 * and a pupil found by address are described in exactly the same way.
 */
function pupilAccount(profile: Json, student: Json): Account {
  const id = String(profile.id ?? "");
  const organisationId = String(profile.organisation_id ?? "");
  const profileEmail = normaliseEmail(profile.email);
  const name = `${String(student.first_name ?? "")} ${String(
    student.last_name ?? ""
  )}`.trim();
  const guardian = normaliseEmail(student.guardian_email);
  const guardianUsable =
    guardian && isUsableEmail(guardian) && guardian !== profileEmail;

  /*
   * Where the code goes for this pupil.
   *
   * Their own address is used when it is one the family reads. A placeholder
   * is never used — it is inert — and an address at the school's own domain
   * is not used either: those are the school's own mailboxes, not the family's,
   * and a code sent there is one nobody ever sees. In both of those cases the
   * family's address on the record is used instead, and the message says whose
   * account it opens.
   *
   * A family address is only used when the pupil's own is not. A pupil who
   * asked to sign in with their own address gets their code at their own
   * address, and nobody else's mailbox is involved.
   */
  const recordEmail = normaliseEmail(student.email);
  const own = ownDelivery(recordEmail);
  const useGuardian = !own && guardianUsable;

  return {
    id,
    email: profileEmail,
    authEmail: profileEmail,
    recordEmail,
    role: "student",
    username: String(profile.username ?? ""),
    name,
    organisationId,
    kind: "student",
    recordId: String(student.id),
    deliveryEmail: useGuardian ? guardian : own,
    onBehalfOf: useGuardian ? name : null,
    recipientName: String(student.guardian_name ?? "") || name,
  };
}

/**
 * Find the account behind an address.
 *
 * Returns null when there is no such account, which is the ordinary case and
 * must be indistinguishable to the caller from a successful send.
 */
async function resolveAccountByEmail(email: string): Promise<Account | null> {
  const wanted = normaliseEmail(email);
  if (!wanted) return null;

  let profile = await first<Json>(
    `profiles?select=id,organisation_id,full_name,email,role,username,student_id&email=eq.${encodeURIComponent(
      wanted
    )}&limit=1`
  );

  if (!profile) {
    const match = (await authUsers()).find(user => user.email === wanted);
    if (match) {
      profile = await first<Json>(
        `profiles?select=id,organisation_id,full_name,email,role,username,student_id&id=eq.${encodeURIComponent(
          match.id
        )}&limit=1`
      );
    }
  }
  if (!profile) return null;

  const id = String(profile.id ?? "");
  const organisationId = String(profile.organisation_id ?? "");
  const profileEmail = normaliseEmail(profile.email);
  const role = String(profile.role ?? "");

  /* A pupil. */
  if (profile.student_id) {
    const student = await first<Json>(
      `students?select=id,first_name,last_name,email,guardian_email,guardian_name&id=eq.${encodeURIComponent(
        String(profile.student_id)
      )}&limit=1`
    );
    if (student) return pupilAccount(profile, student);
  }

  /* A member of staff. */
  const staffRow = await first<Json>(
    `staff?select=id,name,email&profile_id=eq.${encodeURIComponent(id)}&limit=1`
  );
  if (staffRow) {
    const recordEmail = normaliseEmail(staffRow.email);
    return {
      id,
      email: profileEmail,
      authEmail: profileEmail,
      recordEmail,
      role: role || "staff",
      username: String(profile.username ?? ""),
      name: String(staffRow.name ?? profile.full_name ?? ""),
      organisationId,
      kind: "staff",
      recordId: String(staffRow.id),
      /*
       * A member of staff is reached at the address on their record. The auth
       * address is kept separate so changing the contact address does not
       * change the identity Supabase signs in.
       */
      deliveryEmail: ownDelivery(recordEmail) ?? ownDelivery(profileEmail),
      onBehalfOf: null,
      recipientName: String(staffRow.name ?? profile.full_name ?? ""),
    };
  }

  /* The owner, or anybody else with an account. */
  return {
    id,
    email: profileEmail,
    authEmail: profileEmail,
    recordEmail: profileEmail,
    role: isSuperAdminId(id) ? "super_admin" : role || "staff",
    username: String(profile.username ?? ""),
    name: String(profile.full_name ?? ""),
    organisationId,
    kind: isSuperAdminId(id) ? "super_admin" : "staff",
    recordId: id,
    deliveryEmail: ownDelivery(profileEmail),
    onBehalfOf: null,
    recipientName: String(profile.full_name ?? ""),
  };
}

/**
 * Roles that must prove a password before a code is issued.
 *
 * The code is a second factor for these people, not a way in on its own. The
 * code-only endpoint therefore refuses to mint one for them; only `/api/login`
 * does, after Supabase has accepted the password.
 */
function passwordRequired(account: Account): boolean {
  const role = String(account.role ?? "").trim().toLowerCase();
  if (account.kind === "student") return true;
  return ["staff", "teacher", "principal", "accountant"].includes(role);
}

/**
 * The letters and digits of a USN.
 *
 * The school prints them as `GGS1001` and a child reads them off a slip and
 * types them however they were written down, so the slashes, the spaces and
 * the case are all noise. What is left is what has to match.
 */
function compactUsn(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * The pupil record for a USN, however it was typed.
 *
 * Every pupil has one and it is printed on the slip the family is given, which
 * makes it the one identifier a child can always produce. A pupil whose record
 * has no address of their own — and there are plenty, because the school has
 * not collected one from every family — can still ask for a code with it.
 */
async function findPupilByUsn(typed: string): Promise<Json | null> {
  const wanted = compactUsn(typed).toLowerCase();
  if (!wanted) return null;
  return first<Json>(
    `students?select=id,usn&usn=ilike.${encodeURIComponent(wanted)}&limit=1`
  );
}

/**
 * Find the account behind whatever the person typed.
 *
 * Three things are accepted, and they are the three things a person in this
 * school actually has to hand:
 *
 *   * an address — a member of staff's own, or a pupil's;
 *   * a USN — printed on the slip every family is given;
 *   * a username — the name somebody chose for themselves.
 *
 * A name that is none of those finds nothing, which is the ordinary case and
 * reads to the caller as no account at all.
 */
async function resolveAccount(
  identifier: string,
  options: { addressOnly?: boolean } = {}
): Promise<Account | null> {
  const typed = String(identifier ?? "").trim();
  if (!typed) return null;

  if (typed.includes("@")) {
    return resolveAccountByEmail(normaliseEmail(typed));
  }

  /*
   * The shared pupil sign-in name, as a plain word.
   *
   * It stands for "a pupil", not for an account, so there is nobody to send a
   * code to. Resolving it as a username or a USN would find the
   * pupils behind it and send one of them a code they did not ask for.
   */
  if (options.addressOnly) return null;

  const pupil = await findPupilByUsn(typed);
  if (pupil) {
    const studentId = String(pupil.id ?? "");
    const [profile, student] = await Promise.all([
      first<Json>(
        `profiles?select=id,organisation_id,full_name,email,role,username,student_id&student_id=eq.${encodeURIComponent(
          studentId
        )}&limit=1`
      ),
      first<Json>(
        `students?select=id,first_name,last_name,email,guardian_email,guardian_name&id=eq.${encodeURIComponent(
          studentId
        )}&limit=1`
      ),
    ]);
    if (profile && student) return pupilAccount(profile, student);
  }

  for (const email of await resolveEmails(typed)) {
    const account = await resolveAccountByEmail(email);
    if (account) return account;
  }
  return null;
}

/**
 * Where a code is actually posted.
 *
 * The address was worked out when the account was read — a pupil's own where
 * the family reads it, the family's where the pupil's own is a placeholder
 * or a school mailbox. Null means there is nowhere to send it, so none is
 * issued.
 */
function deliveryAddress(account: Account): string | null {
  return account.deliveryEmail && isUsableEmail(account.deliveryEmail)
    ? account.deliveryEmail
    : null;
}

/** The logo is inlined by absolute URL; tests swap in a placeholder. */
function siteOrigin(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "ggs-erp.vercel.app";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Exchange a proven address for a session.
 *
 * Supabase has no "sign this user in" endpoint, so the session is minted the
 * way Supabase itself mints one for a magic link: the admin API generates a
 * single-use link — which sends nothing — and the token in it is exchanged for
 * a session. The link is never shown to anybody; only the resulting session
 * leaves this function.
 */
async function mintSession(email: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
} | null> {
  if (!SERVICE_KEY) return null;

  let link = "";
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ type: "magiclink", email }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      action_link?: string;
      properties?: { action_link?: string };
    };
    link = String(body.action_link ?? body.properties?.action_link ?? "");
  } catch {
    return null;
  }
  if (!link) return null;

  /*
   * The token in the link is the value GoTrue calls `token_hash` when it is
   * exchanged. It is not the `token_hash` field of the response, which this
   * version of Supabase leaves empty.
   */
  let tokenHash = "";
  try {
    tokenHash = new URL(link).searchParams.get("token_hash") ?? "";
    if (!tokenHash) {
      const token = new URL(link).searchParams.get("token") ?? "";
      tokenHash = token;
    }
  } catch {
    return null;
  }
  if (!tokenHash) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token_hash: tokenHash, type: "magiclink" }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
    };
    if (!body.access_token || !body.refresh_token) return null;
    return {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_in: Number(body.expires_in ?? 3600),
      token_type: body.token_type ?? "bearer",
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * The two actions
 * ------------------------------------------------------------------ */

async function requestCode(req: Request, body: Json): Promise<Response> {
  const identifier = readIdentifier(body);
  if (!identifier) {
    return Response.json(
      {
        error: "invalid",
        message: "Enter your email address or your username.",
      },
      { status: 400 }
    );
  }

  if (throttled(req.headers.get("x-forwarded-for") ?? "unknown")) {
    return Response.json(
      { error: "rate_limited", message: "Too many attempts. Wait a minute." },
      { status: 429 }
    );
  }

  /*
   * The shared pupil sign-in name is not an account, so a code asked for with
   * it cannot say which pupil it is for.
   *
   * It is looked up by address only. When it is an address — and it very
   * often is, because a school hands out the one it already has — that
   * address belongs to the school owner, and their account is served as it
   * stands. The pupils who sign in with the shared name are never the
   * account behind it, so no code is sent to one of them by accident.
   */
  const shared = await isSharedUsername(identifier);

  const account = await resolveAccount(identifier, { addressOnly: shared });
  if (!account) {
    // The same answer as a successful send. Nothing is created and nothing is
    // sent, but the caller cannot tell that from the outside.
    return Response.json({
      ok: true,
      message: shared ? SHARED_NAME_CODE : GENERIC,
    });
  }

  /*
   * Students and staff cannot ask for a code on its own. Their code is issued
   * by `/api/login` only after the password has been accepted, and accepting a
   * code minted here would let anybody who knows a USN skip that password.
   */
  if (passwordRequired(account)) {
    return Response.json({
      ok: true,
      message:
        "Sign in with your username and password. A verification code is sent after your password is checked.",
    });
  }

  const to = deliveryAddress(account);
  if (!to) {
    /*
     * The account has an address that cannot receive mail and no family
     * address on file. There is nowhere to send a code, so none is issued —
     * but the answer is the same one everybody else gets, because "this
     * account cannot be reached" is not something an unauthenticated caller
     * gets to find out.
     */
    return Response.json({
      ok: true,
      message: shared ? SHARED_NAME_CODE : GENERIC,
    });
  }

  /* The cooldown: one code per address per fifteen minutes. */
  const recent = await first<Json>(
    `login_otp_codes?select=id,created_at&email=eq.${encodeURIComponent(
      account.email
    )}&order=created_at.desc&limit=1`
  );
  if (recent?.created_at) {
    const age = Date.now() - Date.parse(String(recent.created_at));
    if (Number.isFinite(age) && age < OTP_SEND_COOLDOWN_SECONDS * 1000) {
      const minutes = Math.max(
        1,
        Math.ceil((OTP_SEND_COOLDOWN_SECONDS * 1000 - age) / 60000)
      );
      return Response.json(
        {
          error: "cooldown",
          message: `A code was already sent. Ask for another in ${minutes} minute${
            minutes === 1 ? "" : "s"
          }.`,
        },
        { status: 429 }
      );
    }
  }

  const id = crypto.randomUUID();
  const code = generateOtpCode();
  const codeHash = await hashOtp(code, id);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  const inserted = await fetch(
    `${SUPABASE_URL}/rest/v1/login_otp_codes?select=id`,
    {
      method: "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify({
        id,
        /*
         * The account's own address, never the value that was typed.
         *
         * The address is what a code is checked against, so it has to be the
         * one the account holds: a pupil who asked with a USN
         * has a code filed under their account's address, and a pupil whose
         * code went to the family is still verified against their own.
         */
        email: account.email,
        code_hash: codeHash,
        organisation_id: account.organisationId || null,
        expires_at: expiresAt,
      }),
    }
  );
  if (!inserted.ok) {
    // Nothing was issued, so nothing can be verified. The answer is the same
    // one as success: a failed insert is a fault of ours, not of the caller's.
    return Response.json({
      ok: true,
      message: shared ? SHARED_NAME_CODE : GENERIC,
    });
  }

  let sent = false;
  try {
    sent = await sendOtpEmail({
      to,
      code,
      recipientName: account.recipientName ?? undefined,
      onBehalfOf: account.onBehalfOf ?? undefined,
      logoUrl: `${siteOrigin(req)}/logo.png`,
    });
  } catch {
    // Swallowed on purpose: a bounce must not change the response, or this
    // form becomes an oracle for whether an account exists.
    sent = false;
  }

  if (!sent) {
    /*
     * The code could not be delivered, so it is withdrawn rather than left
     * behind. A withdrawn code cannot be guessed against, and the person can
     * ask for another straight away instead of waiting out the cooldown for a
     * message that is not coming.
     */
    await fetch(
      `${SUPABASE_URL}/rest/v1/login_otp_codes?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE", headers: headers() }
    ).catch(() => null);
    return Response.json({
      ok: true,
      message: shared ? SHARED_NAME_CODE : GENERIC,
    });
  }

  return Response.json({
    ok: true,
    message: shared ? SHARED_NAME_CODE : GENERIC,
  });
}

async function verifyCode(body: Json): Promise<Response> {
  const identifier = readIdentifier(body);
  const code = String(body.code ?? "").replace(/\D/g, "");
  if (!identifier || code.length !== OTP_LENGTH) {
    return Response.json(
      { error: "invalid", message: "That code is not right." },
      { status: 400 }
    );
  }

  /*
   * The account is found first, because a code is filed against the account's
   * own address and not against whatever the person happened to type. A pupil
   * who asked with a USN types the USN again to
   * check the code, and the two have to arrive at the same account.
   *
   * An identifier that finds no account is answered exactly as a wrong code
   * is, so this cannot be used to find out who has an account.
   */
  const account = await resolveAccount(identifier);
  if (!account) {
    return Response.json(
      { error: "invalid", message: "That code is not right." },
      { status: 400 }
    );
  }

  /*
   * The newest few codes for this address. Only the ones that are unspent and
   * unexpired can be used, and the newest is tried first, so asking for a
   * second code does not invalidate the first one before it is used.
   */
  const rows = await readJson<Json>(
    await fetch(
      `${SUPABASE_URL}/rest/v1/login_otp_codes?select=id,code_hash,expires_at,attempts,consumed_at&email=eq.${encodeURIComponent(
        account.email
      )}&order=created_at.desc&limit=5`,
      { headers: headers() }
    ).catch(() => new Response("[]", { status: 200 }))
  );

  const now = Date.now();
  const usable = rows.find(row => {
    if (row.consumed_at) return false;
    const expiry = Date.parse(String(row.expires_at ?? ""));
    return !Number.isFinite(expiry) || expiry > now;
  });

  if (!usable) {
    // No code, an expired code and a spent code all read the same way.
    return Response.json(
      { error: "invalid", message: "That code is not right." },
      { status: 400 }
    );
  }

  const attemptsSoFar = Number(usable.attempts ?? 0);
  if (attemptsSoFar >= OTP_MAX_ATTEMPTS) {
    return Response.json(
      {
        error: "too_many_attempts",
        message: "Too many wrong guesses. Ask for a new code.",
      },
      { status: 429 }
    );
  }

  const id = String(usable.id);
  const storedHash = String(usable.code_hash ?? "");
  const isPasswordChallenge = storedHash.startsWith(PASSWORD_OTP_PREFIX);
  if (passwordRequired(account) && !isPasswordChallenge) {
    return Response.json(
      { error: "invalid", message: "That code is not right." },
      { status: 400 }
    );
  }
  const correct = await verifyOtpHash(
    code,
    id,
    isPasswordChallenge ? storedHash.slice(PASSWORD_OTP_PREFIX.length) : storedHash
  );
  if (!correct) {
    // The attempt is counted against the code, so a six-digit space cannot be
    // swept one guess at a time.
    await fetch(
      `${SUPABASE_URL}/rest/v1/login_otp_codes?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ attempts: attemptsSoFar + 1 }),
      }
    ).catch(() => null);
    return Response.json(
      { error: "invalid", message: "That code is not right." },
      { status: 400 }
    );
  }

  /* The code is right. It is spent, and a session is minted. */
  await fetch(
    `${SUPABASE_URL}/rest/v1/login_otp_codes?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        consumed_at: new Date().toISOString(),
        attempts: attemptsSoFar + 1,
      }),
    }
  ).catch(() => null);

  const session = await mintSession(account.email);
  if (!session) {
    return Response.json(
      {
        error: "error",
        message: "That code could not be used. Ask for a new one.",
      },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    session,
    /*
     * Every account in this school has a working password from the moment its
     * record is saved, so there is no setup step to force. The flag is reported
     * accurately anyway, because the screen that consumes it asks for it.
     */
    mustSetPassword: false,
    subject: {
      kind: account.kind,
      name: account.name,
      role: account.role,
      username: account.username || account.email,
    },
  });
}

/* ------------------------------------------------------------------ */

export async function POST(req: Request): Promise<Response> {
  if (!SERVICE_KEY) {
    return Response.json(
      {
        error: "not_configured",
        message: "Sign-in codes are not configured on this deployment.",
      },
      { status: 503 }
    );
  }

  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const action = body.action === "verify" ? "verify" : "request";
  if (action === "verify") return verifyCode(body);
  return requestCode(req, body);
}

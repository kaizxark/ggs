/**
 * USN sign-in.
 *
 * A student or member of staff types the USN on their record and the password
 * derived from their date of birth (DDMMYY). Supabase Auth only accepts an
 * email, so this route resolves the USN to the account's auth address and
 * exchanges the password for a session.
 *
 * For a student or member of staff that session is *not* returned. The password
 * proves the first factor; a six-digit code mailed to the address on their
 * record proves the second. Only after `/api/otp` accepts that code does the
 * browser receive a session. Admin, super-admin and parent accounts keep the
 * single-step sign-in they had before.
 *
 * Email addresses are deliberately not accepted here. The USN is the only
 * sign-in name for the two groups this route is for, and a mailbox is the
 * second factor, not a username.
 */

export const config = { runtime: "nodejs" };

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_Y1oStHbYHErfX2FD6xyKeg_PXuVcQ1w";

/** Identical for a wrong USN, a wrong password and an unreachable auth
 *  server. Differing them would turn this route into a way to test which
 *  accounts exist. */
const GENERIC = "That username and password do not match an account.";

/*
 * The username helpers live in shared/ so api/recover.ts can use them.
 * They are re-exported here because the login route is still their home as far
 * as callers and tests are concerned.
 */
export {
  isValidEmail,
  isValidUsername,
  resolveEmails,
  USERNAME_PATTERN,
} from "../shared/username-lookup.js";
import { isValidUsername, resolveEmails } from "../shared/username-lookup.js";
import {
  generateOtpCode,
  hashOtp,
  isUsableEmail,
  normaliseEmail,
  OTP_SEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  PASSWORD_OTP_PREFIX,
} from "../shared/portal-accounts.js";
import { sendOtpEmail } from "../shared/otp-mail.js";

/**
 * Where recovery lands. Mirrored by RESET_PASSWORD_PATH in the client's
 * supabase.ts; kept as two literals so this bundle stays free of any
 * browser-facing module.
 */
export const RESET_PASSWORD_PATH = "/reset-password";

/** Host-only fallback for the recovery redirect. Never include a scheme here. */
const DEFAULT_HOST = "ggs-erp.vercel.app";

function siteOrigin(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    DEFAULT_HOST;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function resetPasswordUrl(req: Request): string {
  return `${siteOrigin(req)}${RESET_PASSWORD_PATH}`;
}

type Session = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

/** Exchange an address + password for a session, or null if it is rejected. */
async function signIn(
  email: string,
  password: string
): Promise<Session | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as Partial<Session>;
  if (!json.access_token || !json.refresh_token) return null;
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: Number(json.expires_in ?? 3600),
    token_type: json.token_type ?? "bearer",
  };
}

function headers(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function first<T>(path: string): Promise<T | null> {
  if (!SERVICE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { ...headers(), Prefer: "count=exact" },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as T[];
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}

type Json = Record<string, unknown>;

/** The account behind a profile, with the two addresses kept apart. */
interface LoginAccount {
  profileId: string;
  organisationId: string;
  /** The address Supabase Auth signs in. It stays unique. */
  authEmail: string;
  /** The address on the student/staff record, where the code is delivered. */
  recordEmail: string;
  role: string;
  username: string;
  name: string;
  kind: "student" | "staff" | "admin" | "super_admin" | "parent";
}

/**
 * Roles that must prove a password before a code is issued.
 *
 * These are the people whose sign-in is two-step. The code-only route refuses
 * to mint a code for them; only this route does, after the password check.
 */
function requiresOtp(account: LoginAccount): boolean {
  const role = account.role.trim().toLowerCase();
  if (account.kind === "student") return true;
  return ["staff", "teacher", "principal", "accountant"].includes(role);
}

async function accountForAuthEmail(email: string): Promise<LoginAccount | null> {
  const authEmail = normaliseEmail(email);
  if (!authEmail) return null;

  const profile = await first<Json>(
    `profiles?select=id,organisation_id,full_name,email,role,username,student_id&email=eq.${encodeURIComponent(
      authEmail
    )}&limit=1`
  );
  if (!profile) return null;

  const profileId = String(profile.id ?? "");
  const organisationId = String(profile.organisation_id ?? "");
  const role = String(profile.role ?? "").trim() || "staff";
  const username = String(profile.username ?? "").trim();

  if (profile.student_id) {
    const student = await first<Json>(
      `students?select=id,first_name,last_name,email&id=eq.${encodeURIComponent(
        String(profile.student_id)
      )}&limit=1`
    );
    if (!student) return null;
    const name =
      `${String(student.first_name ?? "")} ${String(student.last_name ?? "")}`.trim();
    return {
      profileId,
      organisationId,
      authEmail,
      recordEmail: normaliseEmail(student.email),
      role: "student",
      username,
      name,
      kind: "student",
    };
  }

  const staffRow = await first<Json>(
    `staff?select=id,name,email&profile_id=eq.${encodeURIComponent(profileId)}&limit=1`
  );
  if (staffRow) {
    return {
      profileId,
      organisationId,
      authEmail,
      recordEmail: normaliseEmail(staffRow.email),
      role,
      username,
      name: String(staffRow.name ?? profile.full_name ?? ""),
      kind: "staff",
    };
  }

  const kind: LoginAccount["kind"] =
    role === "super_admin"
      ? "super_admin"
      : role === "admin"
        ? "admin"
        : role === "parent"
          ? "parent"
          : "staff";

  return {
    profileId,
    organisationId,
    authEmail,
    recordEmail: authEmail,
    role,
    username,
    name: String(profile.full_name ?? ""),
    kind,
  };
}

function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  return `${local.slice(0, 1)}***${email.slice(at)}`;
}

type ChallengeResult =
  | { ok: true; emailHint: string }
  | { ok: false; status: number; message: string };

/**
 * Issue a second-factor code after the password has been accepted.
 *
 * The row is filed under the auth address, which is unique, so two pupils who
 * share a test mailbox cannot read each other's codes. The message is sent to
 * the address on the record.
 */
async function issueChallenge(
  req: Request,
  account: LoginAccount
): Promise<ChallengeResult> {
  if (!isUsableEmail(account.recordEmail)) {
    return {
      ok: false,
      status: 503,
      message:
        "There is no usable email address on this record. Ask the school office to update it.",
    };
  }

  const recent = await first<Json>(
    `login_otp_codes?select=id,created_at&email=eq.${encodeURIComponent(
      account.authEmail
    )}&order=created_at.desc&limit=1`
  );
  if (recent?.created_at) {
    const age = Date.now() - Date.parse(String(recent.created_at));
    if (Number.isFinite(age) && age < OTP_SEND_COOLDOWN_SECONDS * 1000) {
      const minutes = Math.max(
        1,
        Math.ceil((OTP_SEND_COOLDOWN_SECONDS * 1000 - age) / 60000)
      );
      return {
        ok: false,
        status: 429,
        message: `A code was already sent. Ask for another in ${minutes} minute${
          minutes === 1 ? "" : "s"
        }.`,
      };
    }
  }

  const id = crypto.randomUUID();
  const code = generateOtpCode();
  const codeHash = PASSWORD_OTP_PREFIX + (await hashOtp(code, id));
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  const inserted = await fetch(
    `${SUPABASE_URL}/rest/v1/login_otp_codes?select=id`,
    {
      method: "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify({
        id,
        email: account.authEmail,
        code_hash: codeHash,
        organisation_id: account.organisationId || null,
        expires_at: expiresAt,
      }),
    }
  ).catch(() => null);

  if (!inserted?.ok) {
    return {
      ok: false,
      status: 503,
      message: "A sign-in code could not be issued. Please try again.",
    };
  }

  let sent = false;
  try {
    sent = await sendOtpEmail({
      to: account.recordEmail,
      code,
      recipientName: account.name,
      logoUrl: `${siteOrigin(req)}/logo.png`,
    });
  } catch {
    sent = false;
  }

  if (!sent) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/login_otp_codes?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE", headers: headers() }
    ).catch(() => null);
    return {
      ok: false,
      status: 503,
      message:
        "A sign-in code could not be sent. Check the email on your record and try again.",
    };
  }

  return { ok: true, emailHint: maskEmail(account.recordEmail) };
}

/**
 * Best-effort throttle.
 *
 * The password check itself is rate limited by Supabase, but this route is
 * unauthenticated and service-privileged, so an unbounded lookup endpoint would
 * be a username-enumeration oracle. The map lives in the isolate, which limits
 * how much this achieves — it blunts casual scripted abuse, it is not a wall.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 20;

function throttled(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (attempts.size > 5000) {
      attempts.forEach((value, mapKey) => {
        if (value.resetAt <= now) attempts.delete(mapKey);
      });
    }
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!SERVICE_KEY) {
    return Response.json(
      {
        error: "not_configured",
        message:
          "Username sign-in is not configured on this deployment (SUPABASE_SECRET_KEY is missing).",
      },
      { status: 503 }
    );
  }

  let body: { username?: string; password?: string; action?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const raw = String(body.username ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const action = body.action === "recover" ? "recover" : "signin";

  if (throttled(req.headers.get("x-forwarded-for") ?? "unknown")) {
    return Response.json(
      {
        error: "rate_limited",
        message: "Too many attempts. Wait a minute and try again.",
      },
      { status: 429 }
    );
  }

  /*
   * The sign-in name is a USN. A mailbox is the second factor, never the
   * first, so an address is refused before any lookup happens.
   */
  if (raw.includes("@")) {
    return Response.json(
      {
        error: "invalid",
        message: "Enter your username, not an email address.",
      },
      { status: 400 }
    );
  }
  if (!isValidUsername(raw)) {
    return Response.json(
      { error: "invalid", message: "Enter a valid username." },
      { status: 400 }
    );
  }

  if (action === "recover" && !password) {
    const candidates = await resolveEmails(raw);
    if (candidates.length > 0) {
      await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          email: candidates[0],
          redirect_to: resetPasswordUrl(req),
        }),
      }).catch(() => null);
    }
    return Response.json({
      ok: true,
      message:
        "If that username has an account, a reset link is on its way. Check your inbox.",
    });
  }

  if (!password) {
    return new Response("Bad request", { status: 400 });
  }

  /*
   * More than one account can share a username (parents can), so every
   * candidate is tried and the one whose password matches wins. A USN is
   * unique, so the student and staff paths resolve exactly one.
   */
  const candidates = await resolveEmails(raw);
  let session: Session | null = null;
  let account: LoginAccount | null = null;

  for (const email of candidates) {
    const candidate = await signIn(email, password);
    if (!candidate) continue;
    const details = await accountForAuthEmail(email);
    if (!details) continue;
    session = candidate;
    account = details;
    break;
  }

  if (!session || !account) {
    return Response.json(
      { error: "invalid_credentials", message: GENERIC },
      { status: 401 }
    );
  }

  if (requiresOtp(account)) {
    const challenge = await issueChallenge(req, account);
    if (!challenge.ok) {
      return Response.json(
        { error: "otp_error", message: challenge.message },
        { status: challenge.status }
      );
    }
    return Response.json({
      ok: true,
      otpRequired: true,
      emailHint: challenge.emailHint,
      message: `Enter the six-digit code sent to ${challenge.emailHint}.`,
    });
  }

  return Response.json({ ok: true, session });
}

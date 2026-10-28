/**
 * Password recovery: mint a one-time link and email it ourselves.
 *
 * ## Why this route exists
 *
 * Supabase Auth sends its own recovery email, but two things about this project
 * made that unusable:
 *
 *   • Supabase refuses to deliver to any address outside the project team
 *     unless the project has custom SMTP configured. Staff accounts therefore
 *     could not reset a forgotten password at all — only the team owner could.
 *   • Configuring custom SMTP requires a sending domain with SPF and DKIM
 *     records, and this project has no such domain.
 *
 * Sending the message through Nodemailer removes both problems. Gmail signs
 * outgoing mail with its own DKIM key, so the message is authenticated and
 * delivered on the same footing as any other mail from that account.
 *
 * ## How the link is built
 *
 * The Admin API's `generate_link` returns a verify URL for a one-time recovery
 * token without sending anything. The token is lifted out of that URL and
 * re-issued against this app's own redirect, so the emailed link lands on
 * `/reset-password` and not on whatever the project's site URL happens to be.
 *
 * ## Runtime
 *
 * Deliberately Node.js rather than Edge, unlike the other routes here. Nodemailer
 * depends on `tls`, `net` and `dns`, which the Edge runtime does not provide.
 *
 * The handler is a *named* HTTP method export rather than a default export.
 * A Node function is called with `(req, res)` and writes through `res`; the
 * Edge routes in this project are Web-standard and return a `Response`. Handing
 * a `Response` to the Node runtime does not fail loudly — Vercel logs a warning,
 * discards the return value and waits for the function to finish, so the route
 * answers nothing and the caller sees a bare 504 after five minutes.
 * `export function POST(request)` opts into the fetch-style signature that does
 * work here.
 */

import nodemailer from "nodemailer";
import {
  isValidEmail,
  isValidUsername,
  resolveEmails,
} from "../shared/username-lookup.js";
import {
  RESET_SUBJECT,
  resetEmailHtml,
  resetEmailText,
} from "../shared/reset-email.js";
import {
  isPlaceholderEmail,
  isUsableEmail,
  normaliseEmail,
} from "../shared/portal-accounts.js";
import { isSharedUsername } from "../shared/shared-signin.js";

export const config = { runtime: "nodejs" };

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || "";

/*
 * Nodemailer's own timeouts are minutes. Vercel kills a function that runs long
 * and returns a bare 504, which told us nothing about whether the mail was
 * sent. These bound the whole exchange so a misconfigured or unreachable relay
 * fails fast and the route still answers with its constant reply.
 */
const SMTP_TIMEOUT_MS = 8_000;

/**
 * The same message whatever happens.
 *
 * Any difference between "that username exists" and "it does not" turns this
 * form into a way to enumerate staff accounts, so the reply is constant and the
 * work is done quietly either way.
 */
const GENERIC =
  "If that username has an account, a reset link is on its way. Check your inbox.";

/**
 * The answer when the school's shared pupil sign-in name is typed.
 *
 * A plain shared name is not an account — it stands for "a pupil" — so there
 * is nobody to reset. Resolving it would find every pupil who signs in with
 * it and send the link to whichever of them came first, which is worse than
 * sending nothing at all.
 *
 * The answer is not the constant one, and that is deliberate: the shared name
 * is written on the board at school, so saying "this is the shared name, use
 * the code instead" tells the reader nothing they do not already know, and
 * tells a pupil who has forgotten their password exactly what to do next.
 */
const SHARED_NAME_RECOVERY =
  "That is the name every pupil signs in with, so there is no account to reset. Use “Sign in with an email code instead” — your email address or your username — to get back in.";

/** Per-isolate throttle, matching the limit used by /api/login. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

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

/** Where the emailed link should land. */
function resetPageUrl(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "ggs-erp.vercel.app";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/reset-password`;
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

/** Where a recovery message has to go, and who it is for. */
export interface RecoveryTarget {
  /** The one-time link, pointing at this app's own reset page. */
  url: string;
  /** The address the message is actually sent to. */
  address: string;
  /** The name to greet them by. */
  recipientName?: string;
  /** Whose account the link opens, when it went to somebody else. */
  onBehalfOf?: string;
}

/** First matching row, or null. A failure reads as "not found". */
async function first<T>(path: string): Promise<T | null> {
  if (!SERVICE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as T[];
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Where the reset message for an account has to be sent.
 *
 * The auth address is the one Supabase knows, but it is not always the one a
 * person reads. A pupil's auth address is usually a generated identifier and a
 * member of staff's may be a school mailbox; both now carry a real test
 * mailbox on the student/staff record, and that is where the link belongs.
 *
 * A pupil with no usable record address falls back to the guardian on the
 * pupil's record, and the message says whose account it opens. Returns null
 * when there is nowhere to send it, which is the honest answer: a message that
 * cannot be delivered is not a message that was sent.
 */
async function deliveryFor(
  email: string
): Promise<Omit<RecoveryTarget, "url"> | null> {
  const profile = await first<{
    id?: string;
    full_name?: string;
    student_id?: string;
  }>(
    `profiles?select=id,full_name,student_id&email=eq.${encodeURIComponent(
      email
    )}&limit=1`
  );

  if (profile?.student_id) {
    const student = await first<{
      first_name?: string;
      last_name?: string;
      email?: string;
      guardian_email?: string;
      guardian_name?: string;
    }>(
      `students?select=first_name,last_name,email,guardian_email,guardian_name&id=eq.${encodeURIComponent(
        String(profile.student_id)
      )}&limit=1`
    );
    if (!student) return null;

    const pupilName = `${String(student.first_name ?? "")} ${String(
      student.last_name ?? ""
    )}`.trim();
    const record = normaliseEmail(student.email);

    /*
     * The address on the pupil's record is the one the school has told the
     * family to use. Prefer it over the auth identifier even when the auth
     * address happens to be a real mailbox.
     */
    if (isUsableEmail(record) && !isPlaceholderEmail(record)) {
      return {
        address: record,
        recipientName: pupilName || undefined,
      };
    }

    const guardian = normaliseEmail(student.guardian_email);
    if (!isValidEmail(guardian)) return null;
    return {
      address: guardian,
      recipientName:
        String(student.guardian_name ?? "") || pupilName || undefined,
      onBehalfOf: pupilName || undefined,
    };
  }

  if (profile?.id) {
    const person = await first<{ name?: string; email?: string }>(
      `staff?select=name,email&profile_id=eq.${encodeURIComponent(
        String(profile.id)
      )}&limit=1`
    );
    if (person) {
      const record = normaliseEmail(person.email);
      if (isUsableEmail(record) && !isPlaceholderEmail(record)) {
        return {
          address: record,
          recipientName:
            String(person.name ?? "") || String(profile.full_name ?? "") || undefined,
        };
      }
    }
  }

  /*
   * A school-domain mailbox with no pupil behind it belongs to a member of
   * staff, and they can read their own mailbox. Only a pupil's address is
   * redirected to the family.
   */
  if (isPlaceholderEmail(email)) return null;

  return {
    address: email,
    recipientName: String(profile?.full_name ?? "") || undefined,
  };
}

/**
 * Turn a username or address into a one-time recovery link for this app.
 *
 * Returns null when no account matches, which is the normal case for a typo and
 * must be indistinguishable to the caller from a successful send.
 *
 * The address the message goes to is part of the answer, and it is not always
 * the address that was typed. A person who types their username has their
 * account's real address resolved here, and the message has to go to *that* —
 * mailing the typed value would send it to a username, which is not an
 * address, and the message would be dropped by the relay without anybody
 * noticing.
 */
export async function buildRecoveryUrl(
  target: string,
  looksLikeEmail: boolean,
  redirectTo: string
): Promise<RecoveryTarget | null> {
  const candidates = looksLikeEmail ? [target] : await resolveEmails(target);
  for (const email of candidates) {
    if (!isValidEmail(email)) continue;

    const delivery = await deliveryFor(normaliseEmail(email));
    if (!delivery) continue;

    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "recovery", email }),
    });
    if (!res.ok) continue;

    const body = (await res.json()) as {
      action_link?: string;
      properties?: { action_link?: string };
    };
    const generated = body.action_link ?? body.properties?.action_link ?? "";
    if (!generated) continue;

    /*
     * A 200 from generate_link can still carry no usable link. Parsing an
     * empty or malformed one used to throw out of the whole route and answer
     * 500, which both leaked that something had matched and told the caller
     * nothing they could act on. A bad link is simply "try the next candidate".
     */
    let token = "";
    try {
      token = new URL(generated).searchParams.get("token") ?? "";
    } catch {
      continue;
    }
    if (!token) continue;

    /*
     * Rebuilt rather than reusing `generated`: that URL points at the project's
     * site URL, which is not where this app's reset page lives.
     */
    const verify = new URL(`${SUPABASE_URL}/auth/v1/verify`);
    verify.searchParams.set("token", token);
    verify.searchParams.set("type", "recovery");
    verify.searchParams.set("redirect_to", redirectTo);
    return { url: verify.toString(), ...delivery };
  }
  return null;
}

/** Deliver the reset mail. Returns false rather than throwing on failure. */
export async function sendResetEmail(options: {
  to: string;
  recipientName?: string;
  onBehalfOf?: string;
  resetUrl: string;
  logoUrl: string;
}): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return false;

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    // Gmail refuses plain auth on anything but an implicit-TLS port.
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });

  await transport.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: options.to,
    subject: RESET_SUBJECT,
    text: resetEmailText({
      resetUrl: options.resetUrl,
      onBehalfOf: options.onBehalfOf,
    }),
    html: resetEmailHtml({
      resetUrl: options.resetUrl,
      recipientName: options.recipientName,
      onBehalfOf: options.onBehalfOf,
    }).replace("{{ logo }}", options.logoUrl),
  });
  return true;
}

export async function POST(req: Request): Promise<Response> {
  if (!SERVICE_KEY) {
    return Response.json(
      { error: "not_configured", message: "Recovery is not configured." },
      { status: 503 }
    );
  }

  let body: { username?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const raw = String(body.username ?? "").trim().toLowerCase();
  const looksLikeEmail = raw.includes("@");
  if (looksLikeEmail ? !isValidEmail(raw) : !isValidUsername(raw)) {
    return Response.json(
      { error: "invalid", message: "Enter a valid username." },
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
   * The shared pupil sign-in name, when it is a plain word rather than an
   * address.
   *
   * An address-shaped shared name is the school owner's own mailbox in
   * practice, and that account is reset like any other: the address is used
   * directly and the link goes to whoever holds it. A plain word has no
   * account behind it, and resolving it would find the pupils rather than a
   * person.
   */
  if (!looksLikeEmail && (await isSharedUsername(raw))) {
    return Response.json({ ok: true, message: SHARED_NAME_RECOVERY });
  }

  const redirectTo = resetPageUrl(req);
  const recovery = await buildRecoveryUrl(raw, looksLikeEmail, redirectTo);

  if (recovery) {
    try {
      await sendResetEmail({
        // The account's real address, not the value that was typed. A username
        // is not an address, and mailing one loses the message silently.
        to: recovery.address,
        recipientName: recovery.recipientName,
        onBehalfOf: recovery.onBehalfOf,
        // The token lives in the verify URL, so that is what must be emailed —
        // sending the plain app page would produce a link that never carries a
        // session and always lands on the expired screen.
        resetUrl: recovery.url,
        logoUrl: `${siteOrigin(req)}/logo.png`,
      });
    } catch {
      // Swallowed on purpose. A bounce must not change the response, or this
      // form becomes an oracle for whether an account exists.
    }
  }

  return Response.json({ ok: true, message: GENERIC });
}

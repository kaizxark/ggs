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
} from "./reset-email.js";

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

/**
 * Turn a username or address into a one-time recovery link for this app.
 *
 * Returns null when no account matches, which is the normal case for a typo and
 * must be indistinguishable to the caller from a successful send.
 */
export async function buildRecoveryUrl(
  target: string,
  looksLikeEmail: boolean,
  redirectTo: string
): Promise<string | null> {
  const candidates = looksLikeEmail ? [target] : await resolveEmails(target);
  for (const email of candidates) {
    if (!isValidEmail(email)) continue;

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
    const token = new URL(generated).searchParams.get("token");
    if (!token) continue;

    /*
     * Rebuilt rather than reusing `generated`: that URL points at the project's
     * site URL, which is not where this app's reset page lives.
     */
    const verify = new URL(`${SUPABASE_URL}/auth/v1/verify`);
    verify.searchParams.set("token", token);
    verify.searchParams.set("type", "recovery");
    verify.searchParams.set("redirect_to", redirectTo);
    return verify.toString();
  }
  return null;
}

/** Deliver the reset mail. Returns false rather than throwing on failure. */
export async function sendResetEmail(options: {
  to: string;
  recipientName?: string;
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
    text: resetEmailText({ resetUrl: options.resetUrl }),
    html: resetEmailHtml({
      resetUrl: options.resetUrl,
      recipientName: options.recipientName,
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

  const redirectTo = resetPageUrl(req);
  const verifyUrl = await buildRecoveryUrl(raw, looksLikeEmail, redirectTo);

  if (verifyUrl) {
    const recipient = looksLikeEmail ? raw : raw;
    try {
      await sendResetEmail({
        to: recipient,
        // The token lives in the verify URL, so that is what must be emailed —
        // sending the plain app page would produce a link that never carries a
        // session and always lands on the expired screen.
        resetUrl: verifyUrl,
        logoUrl: `${siteOrigin(req)}/logo.png`,
      });
    } catch {
      // Swallowed on purpose. A bounce must not change the response, or this
      // form becomes an oracle for whether an account exists.
    }
  }

  return Response.json({ ok: true, message: GENERIC });
}

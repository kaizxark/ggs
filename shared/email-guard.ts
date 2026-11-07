/**
 * Small, shared guards for the routes that send mail.
 *
 * The receipt and report-card dispatchers used to accept an anonymous POST and
 * interpolate the body straight into HTML. That made them an open SMTP relay —
 * anyone could send an official-looking "Global Kids School" receipt to any
 * address — and an HTML-injection point inside school-branded mail.
 *
 * Everything a route needs to prevent both lives here, once: resolve the real
 * caller, check their role, escape every interpolated value, and rate-limit a
 * single account so a stolen session cannot be used to spray a mailbox.
 */

import { resolveCaller, type Caller } from "./ai-auth.js";

/** Escape a value for interpolation into HTML text or an attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A conservative address check.
 *
 * It rejects CR/LF (the header-injection vector) and anything without a single
 * `@` and a dotted domain. It is not trying to be RFC 5322.
 */
export function isUsableEmail(value: unknown): boolean {
  const address = String(value ?? "").trim();
  if (!address || address.length > 254) return false;
  if (/[\r\n]/.test(address)) return false;
  return /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/.test(
    address
  );
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Per-isolate throttle. Returns true when this caller has spent the budget. */
export function rateLimited(
  key: string,
  max = 20,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

export type Guarded = { ok: true; caller: Caller } | { ok: false; response: Response };

/**
 * Resolve the caller and require one of `roles`.
 *
 * `super_admin` is always accepted: it outranks every list this is called with.
 * The caller's role comes from the session, never from the request body.
 */
export async function guardEmailRoute(
  req: Request,
  roles: readonly string[],
  limitKey: string
): Promise<Guarded> {
  const caller = await resolveCaller(req);
  if (!caller) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "unauthenticated",
          message: "Sign in to send school mail.",
        },
        { status: 401 }
      ),
    };
  }

  if (!caller.superAdmin && !roles.includes(caller.role)) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "forbidden",
          message: "Your account cannot send this mail.",
        },
        { status: 403 }
      ),
    };
  }

  if (rateLimited(`${limitKey}:${caller.id}`)) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "rate_limited",
          message: "Too many messages. Try again in a minute.",
        },
        { status: 429 }
      ),
    };
  }

  return { ok: true, caller };
}

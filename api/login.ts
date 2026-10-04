/**
 * Username login.
 *
 * People sign in with their username — the local part of their email address,
 * e.g. `rajesh.menon` — rather than the full address. Supabase Auth only
 * accepts an email, so this route resolves the username to the account's real
 * address and exchanges the password for a session.
 *
 * Why it cannot live in the browser:
 *   • Row level security on `profiles` blocks anonymous reads (it returns an
 *     empty set without a session), so there is nothing to look the username up
 *     against before signing in.
 *   • The school spans seven email domains — gmail.com, myschool.edu.in,
 *     yahoo.in, rediffmail.com, outlook.com, hotmail.com, gmail.co.in — so a
 *     username cannot be turned into an address by appending a fixed suffix.
 *
 * The password is verified by Supabase, never here. This route only translates
 * the username and forwards the credential, in the same way `api/invite.ts`
 * already forwards provisioning requests with the service key.
 */

export const config = { runtime: "edge" };

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_Y1oStHbYHErfX2FD6xyKeg_PXuVcQ1w";

/** Identical for a wrong username, a wrong password and an unreachable auth
 *  server. Differing them would turn this route into a way to test which
 *  usernames exist. */
const GENERIC = "That username and password do not match an account.";

/*
 * The username helpers now live in shared/ so api/recover.ts can use them.
 * They are re-exported here because the login route is still their home as
 * far as callers and tests are concerned.
 */
export {
  isValidEmail,
  isValidUsername,
  resolveEmails,
  USERNAME_PATTERN,
} from "../shared/username-lookup";
import { isValidEmail, isValidUsername, resolveEmails } from "../shared/username-lookup";

/**
 * Where recovery lands. Mirrored by RESET_PASSWORD_PATH in the client's
 * supabase.ts; kept as two literals so this edge bundle stays free of any
 * browser-facing module.
 */
export const RESET_PASSWORD_PATH = "/reset-password";

/** Host-only fallback for the recovery redirect. Never include a scheme here. */
const DEFAULT_HOST = "ggs-erp.vercel.app";

/**
 * Where a recovery link should send the browser.
 *
 * Rebuilt from the request's own Origin rather than hard-coded, so the same
 * build works on the production domain and on localhost during testing.
 * Forwarded headers are trusted because the app only ever runs behind Vercel,
 * which sets them; a forged header could at worst point the email at another
 * page of this same app.
 */
function resetPasswordUrl(req: Request): string {
  // A bare host, never a full URL: the scheme is prepended below, and a
  // fallback that already carried one produced "https://https://…" in the
  // emailed link whenever no host header was present.
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? DEFAULT_HOST;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}${RESET_PASSWORD_PATH}`;
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
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    }
  );
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
    // Opportunistic sweep so a long-lived isolate does not accumulate entries.
    // Map.forEach rather than for...of: the project targets ES5, where
    // iterating a Map directly needs downlevelIteration and throws at runtime.
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!SERVICE_KEY) {
    return Response.json(
      {
        error: "not_configured",
        message:
          "Username login is not configured on this deployment (SUPABASE_SECRET_KEY is missing).",
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

  const raw = String(body.username ?? "").trim().toLowerCase();
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

  // A full address is accepted as a convenience, since people paste it.
  const looksLikeEmail = raw.includes("@");
  if (looksLikeEmail ? !isValidEmail(raw) : !isValidUsername(raw)) {
    return Response.json(
      { error: "invalid", message: "Enter a valid username." },
      { status: 400 }
    );
  }

  if (action === "recover" && !password) {
    const candidates = looksLikeEmail ? [raw] : await resolveEmails(raw);
    if (candidates.length > 0) {
      await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        /*
         * `redirect_to` is sent explicitly because omitting it makes Supabase
         * fall back to the project's Site URL — normally still localhost — and
         * the emailed link then points at a page that does not exist for the
         * person reading it. This is where recovery must land.
         */
        body: JSON.stringify({
          email: candidates[0],
          redirect_to: resetPasswordUrl(req),
        }),
      });
    }
    // Always the same answer, whether or not the username exists.
    return Response.json({
      ok: true,
      message:
        "If that username has an account, a reset link is on its way. Check your inbox.",
    });
  }

  if (!password) {
    return new Response("Bad request", { status: 400 });
  }

  const candidates = looksLikeEmail ? [raw] : await resolveEmails(raw);

  /*
   * More than one account can share a username (`basanagouda.reddy` does), so
   * every candidate is tried and the one whose password matches wins. Only the
   * password distinguishes them — asking the user to pick would mean showing
   * them a list of addresses they are trying to avoid typing.
   */
  for (const email of candidates) {
    const session = await signIn(email, password);
    if (session) {
      return Response.json({ ok: true, session });
    }
  }

  return Response.json(
    { error: "invalid_credentials", message: GENERIC },
    { status: 401 }
  );
}
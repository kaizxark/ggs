import {
  createClient,
  type SupabaseClient,
  type Session,
} from "@supabase/supabase-js";
import { useEffect, useState } from "react";

/**
 * Supabase browser client.
 *
 * Keys are read from Vite env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at the
 * project root, see vite.config.ts `envDir`). The fallback constants below are the
 * project's publishable key (safe for browsers by design) so the app keeps working
 * even if the env vars are missing. The service_role / secret key must NEVER be
 * shipped to the client — it is only used server-side (not part of this app).
 */
const FALLBACK_URL = "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const FALLBACK_ANON_KEY =
  "sb_publishable_Y1oStHbYHErfX2FD6xyKeg_PXuVcQ1w";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY;

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: true, // localStorage — survives reloads
    autoRefreshToken: true,
    /*
     * Must stay true. Supabase sends password-recovery links carrying either a
     * `#access_token=...&type=recovery` fragment or a `?code=...` query, and
     * this flag is what turns either of those into a signed-in recovery
     * session. With it off, the link landed on a page that looked right and
     * then failed to save: `updateUser({ password })` needs a session, and
     * there was none, so every attempt returned "Auth session missing" and the
     * user was stuck in a loop with no way forward.
     *
     * It is a no-op on ordinary navigation, which carries neither parameter.
     */
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// ---------------------------------------------------------------------------
// Admin login — Supabase Auth.
//
// Supabase verifies the password (never stored or compared here), issues a
// signed session, and it is persisted in localStorage so the dashboard stays
// reachable across reloads. Every other API call carries that session
// automatically, and RLS lets the signed-in role read the school tables.
//
// Sign-in itself takes a username rather than an email address; see
// signInWithUsername below and /api/login for why the translation happens on
// the server.
// ---------------------------------------------------------------------------

export type AuthResult =
  | { status: "ok" }
  | { status: "invalid" }
  | { status: "error"; message: string };

/**
 * The page a recovery link lands on.
 *
 * Sent explicitly on every reset request. Omitting it makes Supabase fall back
 * to the project's Site URL setting, which is usually still localhost — the
 * email then links to a page that does not exist for the person reading it.
 * It must also be added under Authentication → URL Configuration → Redirect
 * URLs in the Supabase dashboard, or Supabase silently ignores it again.
 */
export const RESET_PASSWORD_PATH = "/reset-password";

/** Where a recovery link should send this browser. */
export function resetPasswordRedirect(): string {
  return `${window.location.origin}${RESET_PASSWORD_PATH}`;
}

/**
 * True when the URL carries a password-recovery token.
 *
 * Supabase uses the PKCE `?code=` form for some projects and the implicit
 * `#access_token=...&type=recovery` fragment for others, and which one you get
 * is a project setting rather than something the app chooses. Checking only
 * one of them meant a link in the other format landed on a page that then
 * insisted no reset was in progress.
 */
export function isRecoverySession(): boolean {
  if (typeof window === "undefined") return false;
  const { hash, search } = window.location;
  if (/[?&]code=/.test(search)) return true;
  return hash.includes("type=recovery") || hash.includes("access_token");
}

/**
 * Resolve the recovery session, if there is one.
 *
 * The token is exchanged for a session asynchronously on load, so "no session
 * yet" does not mean "invalid link" — a caller has to allow for the wait. The
 * timeout stops a slow or silent exchange from leaving the page spinning
 * forever.
 */
export async function getRecoverySession(timeoutMs = 8000): Promise<Session | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/**
 * Send a password-reset email.
 *
 * Supabase emails a recovery link to the address if an account exists. We
 * deliberately return the same result whether or not it does, so the form
 * can't be used to discover which emails are registered.
 */
export async function sendPasswordReset(
  email: string
): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetPasswordRedirect(),
    });
    if (error) {
      return {
        status: "error",
        message:
          "Could not send the reset email. Please try again in a moment.",
      };
    }
    return { status: "ok" };
  } catch {
    return {
      status: "error",
      message: "Cannot reach the server. Check your connection and try again.",
    };
  }
}

/**
 * Sign in with a username instead of an email address.
 *
 * Supabase Auth only accepts an email, and the browser cannot look one up —
 * row level security on `profiles` blocks unauthenticated reads. So /api/login
 * resolves the username server-side and hands back a signed session, which is
 * then installed here so every later request carries it exactly as if the user
 * had signed in directly.
 *
 * A full email address is also accepted, since people paste those.
 */
export function isValidUsername(username: string): boolean {
  if (typeof username !== "string") return false;
  return /^[a-z0-9][a-z0-9._-]{1,63}$/.test(username.trim().toLowerCase());
}

export async function signInWithUsername(
  username: string,
  password: string
): Promise<AuthResult> {
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        password,
        action: "signin",
      }),
    });
    const json = (await res.json()) as {
      session?: {
        access_token: string;
        refresh_token: string;
      };
      message?: string;
      error?: string;
    };

    if (!res.ok) {
      if (res.status === 401 || json.error === "invalid_credentials") {
        return { status: "invalid" };
      }
      return {
        status: "error",
        message:
          json.message ??
          "Cannot reach the server. Check your connection and try again.",
      };
    }

    if (!json.session?.access_token || !json.session?.refresh_token) {
      return {
        status: "error",
        message: "The login service returned an incomplete session.",
      };
    }

    // setSession persists it and schedules refresh, so the rest of the app is
    // unaware that the sign-in took a detour through /api/login.
    const { error } = await supabase.auth.setSession({
      access_token: json.session.access_token,
      refresh_token: json.session.refresh_token,
    });
    if (error) {
      return {
        status: "error",
        message: "Your session could not be started. Please try again.",
      };
    }
    return { status: "ok" };
  } catch {
    return {
      status: "error",
      message: "Cannot reach the server. Check your connection and try again.",
    };
  }
}

/**
 * Update the login username for the current user.
 *
 * The username is the local part of the sign-in email and the field staff use
 * as their "username". It is stored in `profiles.username`; the auth email is
 * left untouched, so a username change does not rename the mailbox or disturb
 * password recovery.
 *
 * The old code rewrote the whole email as `<username>@<domain>` and called
 * `updateUser({ email })`. That was removed because it changed the sign-in
 * identity and broke recovery.
 */
export async function updateUsername(
  username: string
): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: new Error("Not signed in") };
  }
  const normalized = username.trim().toLowerCase();
  if (!isValidUsername(normalized)) {
    return {
      error: new Error(
        "Username must be 2–64 characters, start with a letter or digit, and only contain letters, digits, dots, underscores and hyphens."
      ),
    };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ username: normalized })
    .eq("id", user.id);
  return { error };
}

/**
 * Start password recovery from a username.
 *
 * The route resolves the address and asks Supabase to mail it, then always
 * answers the same way — so this cannot be used to find out who has an account.
 */
export async function resetPasswordByUsername(
  username: string
): Promise<{ status: "ok"; message: string } | { status: "error"; message: string }> {
  try {
    /*
     * /api/recover, not /api/login. The app sends this mail itself, because
     * Supabase Auth only delivers to project-team addresses without custom
     * SMTP, and this project has no sending domain to configure. See
     * api/recover.ts.
     */
    const res = await fetch("/api/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim() }),
    });
    const json = (await res.json()) as { message?: string };
    if (!res.ok) {
      return {
        status: "error",
        message:
          json.message ??
          "Could not send the reset email. Please try again in a moment.",
      };
    }
    return {
      status: "ok",
      message:
        json.message ??
        "If that username has an account, a reset link is on its way. Check your inbox.",
    };
  } catch {
    return {
      status: "error",
      message: "Cannot reach the server. Check your connection and try again.",
    };
  }
}

/**
 * Set a new password from the recovery link.
 *
 * Supabase puts the recovery token in the URL fragment; supabase-js picks it up
 * and puts the session in "recovery" mode, which is what authorises this call.
 */
/**
 * Save a new password.
 *
 * The old version reported every failure as "It must be at least 8
 * characters", including the common one — no recovery session — which is
 * actively misleading: the password is fine, the link is not, and sending
 * someone round to shorten their password fixes nothing.
 */
export async function updatePassword(
  password: string
): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const reason = error.message.toLowerCase();
      if (reason.includes("session") || reason.includes("auth")) {
        return {
          status: "error",
          message:
            "This recovery link is no longer valid. Request a new one — links expire after a short time.",
        };
      }
      if (reason.includes("8 character") || reason.includes("password should")) {
        return {
          status: "error",
          message: "That password is too short. Use at least 8 characters.",
        };
      }
      if (reason.includes("same") || reason.includes("current")) {
        return {
          status: "error",
          message: "Choose a password you have not used before.",
        };
      }
      return { status: "error", message: error.message };
    }
    return { status: "ok" };
  } catch {
    return { status: "error", message: "Cannot reach the server." };
  }
}

export interface AdminSession {
  email: string;
  loggedInAt: string;
}

/** Map a Supabase session onto the app's admin-session shape. */
function toAdminSession(session: Session | null): AdminSession | null {
  if (!session) return null;
  const email =
    session.user?.email ??
    (session.user?.user_metadata as { email?: string } | undefined)?.email ??
    "";
  if (!email) return null;
  return {
    email,
    loggedInAt:
      (session as Session & { created_at?: string }).created_at ??
      new Date().toISOString(),
  };
}

/**
 * Reactive admin session, backed by Supabase Auth.
 *
 * `loading` is true only until the stored session has been read and
 * confirmed, so route guards show a splash instead of flashing the
 * login page on reload.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const admin = toAdminSession(session);

  return {
    session,
    loading,
    user: admin ? { email: admin.email, name: admin.email } : null,
    isAuthenticated: !!admin,
  };
}

/** End the Supabase Auth session (clears tokens locally + revokes server-side). */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return error;
}

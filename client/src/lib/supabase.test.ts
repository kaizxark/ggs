import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isRecoverySession,
  isValidUsername,
  RESET_PASSWORD_PATH,
  resetPasswordRedirect,
} from "./supabase";

const setSessionMock = vi.fn();
const signOutMock = vi.fn();
const fetchMock = vi.fn();

// Call history has to be cleared between tests: assertions like
// `mock.calls[0]` would otherwise read a previous test's request.
beforeEach(() => {
  fetchMock.mockReset();
  setSessionMock.mockReset();
  signOutMock.mockReset();
});

vi.stubGlobal("fetch", (...args: unknown[]) => fetchMock(...args));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      setSession: (...args: unknown[]) => setSessionMock(...args),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
  }),
}));

import {
  resetPasswordByUsername,
  signInWithUsername,
  signOut,
} from "./supabase";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SESSION = {
  access_token: "at_123",
  refresh_token: "rt_456",
  expires_in: 3600,
  token_type: "bearer",
};

describe("signInWithUsername", () => {
  it("installs the session the route returns", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, session: SESSION }));
    setSessionMock.mockResolvedValueOnce({ error: null });

    const result = await signInWithUsername("rajesh.menon", "hunter2hunter2");

    expect(result).toEqual({ status: "ok" });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual({
      username: "rajesh.menon",
      password: "hunter2hunter2",
      action: "signin",
    });
    // setSession is what makes the rest of the app see a signed-in user.
    expect(setSessionMock).toHaveBeenCalledWith({
      access_token: "at_123",
      refresh_token: "rt_456",
    });
  });

  it("returns the OTP step instead of a session for a student or member of staff", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        otpRequired: true,
        emailHint: "k***@gmail.com",
        message: "Enter the six-digit code sent to k***@gmail.com.",
      })
    );

    const result = await signInWithUsername("adm26270001", "250213");

    expect(result).toEqual({
      status: "otp",
      message: "Enter the six-digit code sent to k***@gmail.com.",
      emailHint: "k***@gmail.com",
    });
    // The password step proves the first factor only; no session may be
    // installed until the code comes back.
    expect(setSessionMock).not.toHaveBeenCalled();
  });

  it("trims the username and posts to /api/login", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, session: SESSION }));
    setSessionMock.mockResolvedValueOnce({ error: null });

    await signInWithUsername("  rajesh.menon  ", "pw");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).username).toBe("rajesh.menon");
  });

  it("returns invalid, not an error, when the pair is rejected", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: "invalid_credentials", message: "That username and password do not match an account." },
        401
      )
    );
    const result = await signInWithUsername("rajesh.menon", "wrong");
    expect(result).toEqual({ status: "invalid" });
    // Crucially, no half-built session is left behind.
    expect(setSessionMock).not.toHaveBeenCalled();
  });

  it("surfaces a rate limit as an error with the server's wording", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: "rate_limited", message: "Too many attempts. Wait a minute and try again." },
        429
      )
    );
    const result = await signInWithUsername("rajesh.menon", "pw");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/too many attempts/i);
    }
  });

  it("never reports success when the route returns no session", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const result = await signInWithUsername("rajesh.menon", "pw");
    expect(result.status).toBe("error");
    expect(setSessionMock).not.toHaveBeenCalled();
  });

  it("never reports success when the session cannot be installed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, session: SESSION }));
    setSessionMock.mockResolvedValueOnce({ error: { message: "bad jwt" } });
    const result = await signInWithUsername("rajesh.menon", "pw");
    expect(result.status).toBe("error");
  });

  it("treats a thrown network failure as an error, not a login", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const result = await signInWithUsername("rajesh.menon", "pw");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/cannot reach the server/i);
    }
    expect(setSessionMock).not.toHaveBeenCalled();
  });
});

describe("resetPasswordByUsername", () => {
  it("asks the route to start recovery and returns its message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        message:
          "If that username has an account, a reset link is on its way. Check your inbox.",
      })
    );
    const result = await resetPasswordByUsername("rajesh.menon");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.message).toMatch(/reset link is on its way/i);
    }
    const [url, init] = fetchMock.mock.calls[0];
    // Posted to /api/recover, not /api/login: the app sends this mail itself
    // because Supabase only delivers to project-team addresses without custom
    // SMTP. `action: "recover"` on the login route is what this replaced.
    expect(String(url)).toContain("/api/recover");
    expect(JSON.parse(String(init.body))).toEqual({
      username: "rajesh.menon",
    });
    // A password must never travel on this request.
    expect(JSON.parse(String(init.body)).password).toBeUndefined();
  });

  it("never sends a password when recovering", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await resetPasswordByUsername("rajesh.menon");
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init.body)).password).toBeUndefined();
  });

  it("reports a failure as an error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "not_configured", message: "not configured" }, 503)
    );
    const result = await resetPasswordByUsername("rajesh.menon");
    expect(result.status).toBe("error");
  });
});

describe("signOut", () => {
  it("asks Supabase Auth to end the session", async () => {
    signOutMock.mockResolvedValueOnce({ error: null });
    await signOut();
    expect(signOutMock).toHaveBeenCalled();
  });
});
/*
 * Password recovery is the one flow where a wrong URL detail makes the whole
 * thing unusable, and every failure is invisible until a real person tries to
 * reset a password. These tests pin the two details that decide whether it
 * works at all: recognising the link, and pointing it at the right page.
 */
describe("isRecoverySession", () => {
  const setUrl = (search: string, hash: string) => {
    vi.stubGlobal("window", {
      location: { search, hash, origin: "https://ggs-erp.vercel.app" },
    });
  };

  afterEach(() => vi.unstubAllGlobals());

  it("recognises the PKCE query form", () => {
    // Supabase uses ?code= for PKCE projects. Checking only the fragment form
    // meant a link in this shape landed on a page insisting no reset was in
    // progress, with no way forward.
    setUrl("?code=abc123", "");
    expect(isRecoverySession()).toBe(true);
  });

  it("recognises the implicit fragment form", () => {
    setUrl("", "#access_token=tok&type=recovery");
    expect(isRecoverySession()).toBe(true);
  });

  it("recognises a fragment that only carries the type", () => {
    setUrl("", "#type=recovery");
    expect(isRecoverySession()).toBe(true);
  });

  it("does not fire on an ordinary sign-in page", () => {
    // The route runs on every load, so a false positive would replace the
    // sign-in form with the recovery form for someone who just wanted to log in.
    setUrl("", "");
    expect(isRecoverySession()).toBe(false);
    setUrl("?foo=bar", "#section-2");
    expect(isRecoverySession()).toBe(false);
  });
});

describe("resetPasswordRedirect", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("targets the dedicated reset page, not the login page", () => {
    // Landing on /login meant a visitor who mistyped the address had no route
    // back to the reset form, because the mode lived in component state.
    vi.stubGlobal("window", {
      location: { origin: "https://ggs-erp.vercel.app" },
    });
    expect(RESET_PASSWORD_PATH).toBe("/reset-password");
    expect(resetPasswordRedirect()).toBe(
      "https://ggs-erp.vercel.app/reset-password"
    );
  });
});

describe("isValidUsername", () => {
  it("accepts a valid username", () => {
    expect(isValidUsername("kaizxark")).toBe(true);
    expect(isValidUsername("ehtesham.s")).toBe(true);
    expect(isValidUsername("a1")).toBe(true);
  });

  it("rejects an invalid username", () => {
    expect(isValidUsername("@bad")).toBe(false);
    expect(isValidUsername("too-long-" + "x".repeat(60))).toBe(false);
    expect(isValidUsername("Space Name")).toBe(false);
    expect(isValidUsername("")).toBe(false);
    expect(isValidUsername(null as unknown as string)).toBe(false);
  });

  it("normalises case", () => {
    expect(isValidUsername("KaIzXaRk")).toBe(true);
  });
});

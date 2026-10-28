import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as handler, isValidEmail, isValidUsername, RESET_PASSWORD_PATH, resolveEmails } from "./login";

const mail = vi.hoisted(() => ({
  sendOtpEmail: vi.fn(async () => true),
}));

vi.mock("../shared/otp-mail.js", () => ({
  sendOtpEmail: mail.sendOtpEmail,
}));

/**
 * USN login: the USN resolves to an auth address, the password is exchanged
 * there, and a student or member of staff gets a second factor instead of a
 * session. These tests treat filter injection and the separation of the auth
 * address from the record address as the things most worth pinning down.
 */

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
  mail.sendOtpEmail.mockReset();
  mail.sendOtpEmail.mockResolvedValue(true);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetchSequence(responses: Response[]) {
  const spy = vi.fn(async () => responses.shift() ?? new Response("[]"));
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

function callTo(spy: { mock: { calls: unknown[][] } }, fragment: string) {
  return spy.mock.calls.find(call => String(call[0]).includes(fragment));
}

function callsTo(spy: { mock: { calls: unknown[][] } }, fragment: string) {
  return spy.mock.calls.filter(call => String(call[0]).includes(fragment));
}

function postedTo(spy: { mock: { calls: unknown[][] } }, fragment: string) {
  return spy.mock.calls.find(
    call =>
      String(call[0]).includes(fragment) &&
      (call[1] as RequestInit | undefined)?.method === "POST"
  );
}

let clientNumber = 0;

function post(body: unknown, headers: Record<string, string> = {}) {
  clientNumber += 1;
  return handler(
    new Request("https://erp.example.com/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${clientNumber % 250}`,
        ...headers,
      },
      body: JSON.stringify(body),
    })
  );
}

function session(prefix = "at") {
  return {
    access_token: prefix,
    refresh_token: `${prefix}-rt`,
    expires_in: 3600,
    token_type: "bearer",
  };
}

/**
 * A URL-routed fake, because the login route now makes several reads whose
 * order is not the point of the test.
 */
function stubLogin(options: {
  profile?: Record<string, unknown> | null;
  student?: Record<string, unknown> | null;
  staff?: Record<string, unknown> | null;
  recentCode?: Record<string, unknown> | null;
  insertOk?: boolean;
  tokenOk?: boolean;
}) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/v1/token")) {
      return options.tokenOk === false
        ? new Response("invalid_grant", { status: 400 })
        : json(session());
    }
    if (url.includes("/rest/v1/login_otp_codes")) {
      if (init?.method === "POST") {
        return options.insertOk === false
          ? new Response("nope", { status: 500 })
          : json([{ id: "code-1" }]);
      }
      return json(options.recentCode ? [options.recentCode] : []);
    }
    if (url.includes("/rest/v1/profiles?select=email")) {
      return json(options.profile?.email ? [{ email: options.profile.email }] : []);
    }
    if (url.includes("/rest/v1/profiles?")) {
      return json(options.profile ? [options.profile] : []);
    }
    if (url.includes("/rest/v1/students")) {
      return json(options.student ? [options.student] : []);
    }
    if (url.includes("/rest/v1/staff")) {
      return json(options.staff ? [options.staff] : []);
    }
    if (url.includes("/auth/v1/recover")) return json({});
    return json([]);
  });
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

const ADMIN_PROFILE = {
  id: "admin-auth",
  organisation_id: "org-1",
  full_name: "School Owner",
  email: "owner@example.com",
  role: "admin",
  username: "owner",
  student_id: null,
};

const STUDENT_PROFILE = {
  id: "student-auth",
  organisation_id: "org-1",
  full_name: "Priya Menon",
  email: "priya.auth@example.com",
  role: "student",
  username: "adm26270042",
  student_id: "student-1",
};

const STUDENT_ROW = {
  id: "student-1",
  first_name: "Priya",
  last_name: "Menon",
  email: "kaizxark@gmail.com",
};

const STAFF_PROFILE = {
  id: "staff-auth",
  organisation_id: "org-1",
  full_name: "Meera Iyer",
  email: "meera.auth@example.com",
  role: "staff",
  username: "emp2012026",
  student_id: null,
};

const STAFF_ROW = {
  id: "staff-1",
  name: "Dr. Meera Iyer",
  email: "sincejuly7th@gmail.com",
};

describe("username validation", () => {
  it("accepts the shapes real local parts take", () => {
    for (const value of [
      "kaizxark",
      "rajesh.menon",
      "dr.meera.iyer",
      "sincejuly7th",
      "a_b-c",
      "adm26270041",
    ]) {
      expect(isValidUsername(value), value).toBe(true);
    }
  });

  it("rejects anything that could rewrite a PostgREST filter", () => {
    for (const value of [
      "a,b",
      "a)or(email.neq.",
      "a&select=*",
      "a%00b",
      "a@b",
      "a",
      "",
      " leading",
      "trailing ",
      "a b",
      "a'.or(1=1)",
    ]) {
      expect(isValidUsername(value), value).toBe(false);
    }
  });

  it("recognises full email addresses", () => {
    expect(isValidEmail("kaizxark@gmail.com")).toBe(true);
    expect(isValidEmail("rajesh.menon@myschool.edu.in")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("resolveEmails", () => {
  it("finds an account by the username column, without consulting the email", async () => {
    const spy = mockFetchSequence([
      json([{ email: "head.teacher@globalskids.edu.in" }]),
    ]);
    const emails = await resolveEmails("head.teacher");

    expect(emails).toEqual(["head.teacher@globalskids.edu.in"]);
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("username=eq.head.teacher");
    expect(url).not.toContain("email=like");
    expect(spy.mock.calls.length).toBe(1);
  });

  it("falls back to the email local part when nobody chose that name", async () => {
    const spy = mockFetchSequence([
      json([]),
      json([{ email: "rajesh.menon@myschool.edu.in" }]),
    ]);
    const emails = await resolveEmails("rajesh.menon");

    const url = String(spy.mock.calls[1][0]);
    expect(url).toContain("email=like.");
    expect(url).toContain("%2A");
    expect(url).not.toMatch(/email=like\.\*/);
    expect(emails).toEqual(["rajesh.menon@myschool.edu.in"]);
  });

  it("returns every account when a username is not unique", async () => {
    mockFetchSequence([
      json([
        { email: "basanagouda.reddy@outlook.com" },
        { email: "basanagouda.reddy@gmail.com" },
      ]),
    ]);
    expect(await resolveEmails("basanagouda.reddy")).toEqual([
      "basanagouda.reddy@outlook.com",
      "basanagouda.reddy@gmail.com",
    ]);
  });

  it("finds a pupil by the USN on the student record", async () => {
    const spy = mockFetchSequence([
      json([]),
      json([]),
      json([{ id: "student-1" }]),
      json([{ email: "pupil@example.com" }]),
    ]);
    /*
     * Typed the way the slip prints it. The lookup lower-cases what it was
     * given and the query itself ignores case, so a USN stored as `GGS1001`
     * is found from either spelling.
     */
    expect(await resolveEmails("GGS1001")).toEqual(["pupil@example.com"]);
    expect(
      callsTo(spy, "/rest/v1/students?select=id&usn=ilike.ggs1001")
    ).toHaveLength(1);
  });

  it("does not match a username that is only the tail of an address", async () => {
    mockFetchSequence([
      json([]),
      json([
        { email: "santosh.nair@myschool.edu.in" },
        { email: "nair@myschool.edu.in" },
      ]),
    ]);
    expect(await resolveEmails("nair")).toEqual(["nair@myschool.edu.in"]);
  });

  it("falls through to the auth users when profiles only has a suffix match", async () => {
    const spy = mockFetchSequence([
      json([]),
      json([{ email: "santosh.nair@myschool.edu.in" }]),
      json([]),
      json({
        users: [
          { email: "santosh.nair@myschool.edu.in" },
          { email: "nair@myschool.edu.in" },
        ],
      }),
    ]);
    expect(await resolveEmails("nair")).toEqual(["nair@myschool.edu.in"]);
    expect(callsTo(spy, "/auth/v1/admin/users")).toHaveLength(1);
  });

  it("de-duplicates and drops unusable rows", async () => {
    mockFetchSequence([
      json([
        { email: "A@x.com" },
        { email: "a@x.com" },
        { email: null },
        { email: "not-an-email" },
      ]),
    ]);
    expect(await resolveEmails("a")).toEqual(["a@x.com"]);
  });

  it("treats a failed lookup as no candidates rather than throwing", async () => {
    mockFetchSequence([
      new Response("boom", { status: 500 }),
      new Response("boom", { status: 500 }),
    ]);
    expect(await resolveEmails("rajesh.menon")).toEqual([]);
  });
});

describe("POST /api/login", () => {
  it("refuses an email address before any lookup", async () => {
    const spy = mockFetchSequence([]);
    const res = await post({
      username: "owner@example.com",
      password: "pw",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("username");
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses filter syntax before any lookup", async () => {
    const spy = mockFetchSequence([]);
    const res = await post({ username: "x,or(1=1", password: "pw" });
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("signs an admin in with the USN and returns the session", async () => {
    const spy = stubLogin({ profile: ADMIN_PROFILE });
    const res = await post({ username: "owner", password: "pw12345678" });
    const body = (await res.json()) as {
      ok: boolean;
      session: { access_token: string };
      otpRequired?: boolean;
    };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.session.access_token).toBe("at");
    expect(body.otpRequired).toBeUndefined();
    expect(mail.sendOtpEmail).not.toHaveBeenCalled();
    expect(
      JSON.parse(String(callTo(spy, "/auth/v1/token")?.[1]?.body))
    ).toEqual({ email: "owner@example.com", password: "pw12345678" });
  });

  it("gives the same answer for a wrong password and an unknown USN", async () => {
    stubLogin({ profile: ADMIN_PROFILE, tokenOk: false });
    const wrongPassword = await post({ username: "owner", password: "nope" });
    const wrongBody = await wrongPassword.json();

    stubLogin({ profile: null });
    const unknown = await post({ username: "nosuchuser", password: "nope" });
    const unknownBody = await unknown.json();

    expect(wrongPassword.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongBody).toEqual(unknownBody);
  });

  it("tries every account when a USN maps to more than one", async () => {
    const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/profiles?select=email")) {
        return json([
          { email: "first@example.com" },
          { email: "second@example.com" },
        ]);
      }
      if (url.includes("/auth/v1/token")) {
        const body = JSON.parse(String(init?.body)) as { email: string };
        if (body.email === "first@example.com") {
          return new Response("invalid_grant", { status: 400 });
        }
        return json(session("second-at"));
      }
      if (url.includes("/rest/v1/profiles?")) {
        return json([{ ...ADMIN_PROFILE, email: "second@example.com" }]);
      }
      return json([]);
    });
    globalThis.fetch = spy as unknown as typeof fetch;

    const res = await post({ username: "shared.name", password: "pw" });
    const body = (await res.json()) as { session: { access_token: string } };

    expect(res.status).toBe(200);
    expect(body.session.access_token).toBe("second-at");
    expect(callsTo(spy, "/auth/v1/token")).toHaveLength(2);
  });

  it("returns a challenge, not a session, for a student", async () => {
    const spy = stubLogin({
      profile: STUDENT_PROFILE,
      student: STUDENT_ROW,
    });
    const res = await post({
      username: "adm26270042",
      password: "290805",
    });
    const body = (await res.json()) as {
      ok: boolean;
      otpRequired: boolean;
      emailHint: string;
      session?: unknown;
    };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.otpRequired).toBe(true);
    expect(body.session).toBeUndefined();
    expect(body.emailHint).toBe("k***@gmail.com");

    const inserted = JSON.parse(
      String(postedTo(spy, "/rest/v1/login_otp_codes")?.[1]?.body)
    ) as { email: string; code_hash: string };
    expect(inserted.email).toBe("priya.auth@example.com");
    expect(inserted.code_hash.startsWith("pwd:")).toBe(true);
    expect(mail.sendOtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "kaizxark@gmail.com" })
    );
  });

  it("returns a challenge, not a session, for a member of staff", async () => {
    const spy = stubLogin({
      profile: STAFF_PROFILE,
      staff: STAFF_ROW,
    });
    const res = await post({
      username: "emp2012026",
      password: "100175",
    });
    const body = (await res.json()) as {
      otpRequired: boolean;
      session?: unknown;
    };

    expect(res.status).toBe(200);
    expect(body.otpRequired).toBe(true);
    expect(body.session).toBeUndefined();
    expect(mail.sendOtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "sincejuly7th@gmail.com" })
    );
    const inserted = JSON.parse(
      String(postedTo(spy, "/rest/v1/login_otp_codes")?.[1]?.body)
    ) as { email: string };
    expect(inserted.email).toBe("meera.auth@example.com");
  });

  it("does not issue a challenge while the last code is still fresh", async () => {
    stubLogin({
      profile: STUDENT_PROFILE,
      student: STUDENT_ROW,
      recentCode: { id: "old", created_at: new Date().toISOString() },
    });
    const res = await post({
      username: "adm26270042",
      password: "290805",
    });
    expect(res.status).toBe(429);
    expect(mail.sendOtpEmail).not.toHaveBeenCalled();
  });

  it("fails closed when the code cannot be stored", async () => {
    stubLogin({
      profile: STUDENT_PROFILE,
      student: STUDENT_ROW,
      insertOk: false,
    });
    const res = await post({
      username: "adm26270042",
      password: "290805",
    });
    expect(res.status).toBe(503);
    expect(mail.sendOtpEmail).not.toHaveBeenCalled();
  });

  it("always answers recovery identically, whether or not the USN exists", async () => {
    stubLogin({ profile: ADMIN_PROFILE });
    const known = await post({ username: "owner", action: "recover" });
    const knownBody = await known.json();

    stubLogin({ profile: null });
    const unknown = await post({ username: "nosuchuser", action: "recover" });
    const unknownBody = await unknown.json();

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(knownBody).toEqual(unknownBody);
  });

  it("always tells Supabase where the recovery link should land", async () => {
    const spy = stubLogin({ profile: ADMIN_PROFILE });
    await post(
      { username: "owner", action: "recover" },
      {
        "x-forwarded-host": "erp-abc123.vercel.app",
        "x-forwarded-proto": "https",
      }
    );
    const recoverBody = JSON.parse(
      String(callTo(spy, "/auth/v1/recover")?.[1]?.body)
    );
    expect(recoverBody.redirect_to).toBe(
      `https://erp-abc123.vercel.app${RESET_PASSWORD_PATH}`
    );
  });

  it("honours the forwarded protocol rather than assuming https", async () => {
    const spy = stubLogin({ profile: ADMIN_PROFILE });
    await post(
      { username: "owner", action: "recover" },
      { "x-forwarded-host": "localhost:5173", "x-forwarded-proto": "http" }
    );
    const recoverBody = JSON.parse(
      String(callTo(spy, "/auth/v1/recover")?.[1]?.body)
    );
    expect(recoverBody.redirect_to).toBe(
      "http://localhost:5173/reset-password"
    );
  });

  it("rejects a non-POST request", async () => {
    const res = await handler(
      new Request("https://erp.example.com/api/login", { method: "GET" })
    );
    expect(res.status).toBe(405);
  });
});

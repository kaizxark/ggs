import { afterEach, describe, expect, it, vi } from "vitest";
import handler, {
  isValidEmail,
  isValidUsername,
  RESET_PASSWORD_PATH,
  resolveEmails,
} from "./login";

/**
 * The username is interpolated into a PostgREST filter, so these tests treat
 * filter injection as the primary hazard rather than an afterthought.
 */

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function mockFetchSequence(responses: Response[]) {
  const spy = vi.fn(async () => responses.shift() ?? new Response("[]"));
  spy.mockClear();
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return handler(
    new Request("https://erp.example.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  );
}

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
    // A comma or a paren in an unvalidated username would let a caller escape
    // the `like` filter and read the whole profiles table.
    for (const value of [
      "a,b",
      "a)or(email.neq.",
      "a&select=*",
      "a%00b",
      "a@b", // not a username
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

  it("recognises full email addresses for people who paste them", () => {
    expect(isValidEmail("kaizxark@gmail.com")).toBe(true);
    expect(isValidEmail("rajesh.menon@myschool.edu.in")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("resolveEmails", () => {
  /*
   * Two lookups, in order: `profiles.username` first, then the email local part.
   * A test that wants the *second* one therefore has to answer the first with no
   * rows, and a test that wants the first must not queue a second response —
   * the helpers queue responses in call order.
   */
  it("finds an account by the username column, without consulting the email", async () => {
    const spy = mockFetchSequence([
      json([{ email: "head.teacher@globalskids.edu.in" }]),
    ]);
    const emails = await resolveEmails("head.teacher");

    expect(emails).toEqual(["head.teacher@globalskids.edu.in"]);
    // The chosen name is deliberately unlike the mailbox local part, which is
    // the whole point: a rename must keep working after it stops matching.
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("username=eq.head.teacher");
    expect(url).not.toContain("email=like");
    // One lookup is enough when the column matches.
    expect(spy.mock.calls.length).toBe(1);
  });

  it("falls back to the email local part when nobody chose that name", async () => {
    const spy = mockFetchSequence([
      json([]),                                                  // username: no match
      json([{ email: "rajesh.menon@myschool.edu.in" }]),          // email: match
    ]);
    const emails = await resolveEmails("rajesh.menon");

    const url = String(spy.mock.calls[1][0]);
    expect(url).toContain("email=like.");
    // encodeURIComponent leaves "*" alone, and PostgREST then reads it as
    // filter syntax and rejects the request with "error code 1101".
    expect(url).toContain("%2A");
    expect(url).not.toMatch(/email=like\.\*/);
    expect(decodeURIComponent(url.split("email=like.")[1]).split("&")[0]).toBe(
      "*rajesh.menon@%"
    );
    expect(emails).toEqual(["rajesh.menon@myschool.edu.in"]);
  });

  it("returns every account when a username is not unique", async () => {
    // basanagouda.reddy genuinely exists on two addresses.
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
  it("signs in with the username and returns the session", async () => {
    const spy = mockFetchSequence([
      json([{ email: "rajesh.menon@myschool.edu.in" }]),
      json({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        token_type: "bearer",
      }),
    ]);

    const res = await post({ username: "rajesh.menon", password: "pw12345678" });
    const body = (await res.json()) as { ok: boolean; session: { access_token: string } };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.session.access_token).toBe("at");
    // The password is forwarded to Supabase, never compared here.
    const tokenCall = JSON.parse(String(spy.mock.calls[1][1]?.body));
    expect(tokenCall).toEqual({
      email: "rajesh.menon@myschool.edu.in",
      password: "pw12345678",
    });
  });

  it("tries every account when a username maps to more than one", async () => {
    const spy = mockFetchSequence([
      json([
        { email: "basanagouda.reddy@outlook.com" },
        { email: "basanagouda.reddy@gmail.com" },
      ]),
      new Response("invalid_grant", { status: 400 }),
      json({
        access_token: "at2",
        refresh_token: "rt2",
        expires_in: 3600,
        token_type: "bearer",
      }),
    ]);

    const res = await post({
      username: "basanagouda.reddy",
      password: "pw",
    });
    const body = (await res.json()) as { session: { access_token: string } };

    expect(res.status).toBe(200);
    expect(body.session.access_token).toBe("at2");
    // Both candidates were attempted before the right one answered.
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("gives the same answer for a wrong password and an unknown username", async () => {
    mockFetchSequence([
      json([{ email: "rajesh.menon@myschool.edu.in" }]),
      new Response("invalid_grant", { status: 400 }),
    ]);
    const wrongPassword = await post({
      username: "rajesh.menon",
      password: "nope",
    });
    const wrongPasswordBody = await wrongPassword.json();

    mockFetchSequence([json([])]);
    const unknown = await post({ username: "nosuchuser", password: "nope" });
    const unknownBody = await unknown.json();

    // Indistinguishable, so this cannot be used to enumerate usernames.
    expect(wrongPassword.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPasswordBody).toEqual(unknownBody);
  });

  it("skips the lookup entirely when a full email is pasted", async () => {
    const spy = mockFetchSequence([
      json({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
    ]);
    const res = await post({
      username: "rajesh.menon@myschool.edu.in",
      password: "pw",
    });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(spy.mock.calls[0][1]?.body)).email).toBe(
      "rajesh.menon@myschool.edu.in"
    );
  });

  it("refuses a username containing filter syntax before any lookup", async () => {
    const spy = mockFetchSequence([]);
    const res = await post({ username: "x,or(1=1", password: "pw" });
    expect(res.status).toBe(400);
    // Nothing was sent to PostgREST at all.
    expect(spy).not.toHaveBeenCalled();
  });

  it("always answers recovery identically, whether or not the username exists", async () => {
    mockFetchSequence([json([{ email: "rajesh.menon@myschool.edu.in" }]), json({})]);
    const known = await post({ username: "rajesh.menon", action: "recover" });
    const knownBody = await known.json();

    mockFetchSequence([json([])]);
    const unknown = await post({ username: "nosuchuser", action: "recover" });
    const unknownBody = await unknown.json();

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(knownBody).toEqual(unknownBody);
  });

  it("does not send a password when recovering", async () => {
    const spy = mockFetchSequence([
      json([{ email: "rajesh.menon@myschool.edu.in" }]),
      json({}),
    ]);
    await post({ username: "rajesh.menon", action: "recover" });
    const recoverBody = JSON.parse(String(spy.mock.calls[1][1]?.body));
    expect(recoverBody.password).toBeUndefined();
    expect(recoverBody.email).toBe("rajesh.menon@myschool.edu.in");
  });

  it("always tells Supabase where the recovery link should land", async () => {
    /*
     * Omitting redirect_to makes Supabase fall back to the project's Site URL,
     * which is normally still localhost — so the emailed link pointed at a page
     * that does not exist for the person reading it. The fix is worthless if
     * the field can quietly go missing again.
     */
    const spy = mockFetchSequence([
      json([{ email: "rajesh.menon@myschool.edu.in" }]),
      json({}),
    ]);
    await post({ username: "rajesh.menon", action: "recover" });
    const recoverBody = JSON.parse(String(spy.mock.calls[1][1]?.body));
    expect(recoverBody.redirect_to).toContain(RESET_PASSWORD_PATH);
    // A doubled scheme ("https://https://…") is the shape this produced when no
    // host header was present, and it is a link that cannot load.
    expect(recoverBody.redirect_to).toMatch(/^https?:\/\/[^/]+\/reset-password$/);
  });

  it("builds the redirect from the request's own host, so preview and production both work", async () => {
    // Hard-coding the production domain would send a Vercel preview
    // deployment's users to an unrelated site.
    const spy = mockFetchSequence([
      json([{ email: "rajesh.menon@myschool.edu.in" }]),
      json({}),
    ]);
    await post(
      { username: "rajesh.menon", action: "recover" },
      { "x-forwarded-host": "erp-abc123.vercel.app", "x-forwarded-proto": "https" }
    );
    const recoverBody = JSON.parse(String(spy.mock.calls[1][1]?.body));
    expect(recoverBody.redirect_to).toBe(
      "https://erp-abc123.vercel.app/reset-password"
    );
  });

  it("honours the forwarded protocol rather than assuming https", async () => {
    // Local and preview deployments run over http; assuming https would emit a
    // link that does not load for whoever is testing.
    const spy = mockFetchSequence([
      json([{ email: "rajesh.menon@myschool.edu.in" }]),
      json({}),
    ]);
    await post(
      { username: "rajesh.menon", action: "recover" },
      { "x-forwarded-host": "localhost:5173", "x-forwarded-proto": "http" }
    );
    const recoverBody = JSON.parse(String(spy.mock.calls[1][1]?.body));
    expect(recoverBody.redirect_to).toBe(
      "http://localhost:5173/reset-password"
    );
  });

  it("falls back to the auth users when profiles has no matching address", async () => {
    /*
     * profiles.email is only a copy. With secure email change enabled a rename
     * is not applied until the new mailbox is confirmed, so a rename that was
     * never confirmed left profiles holding an address that matches no real
     * account — and the super admin could neither sign in nor reset. The auth
     * user list is what can actually receive a recovery email.
     */
    const spy = mockFetchSequence([
      json([]),                                                   // username: no match
      json([]),                                                   // email: no match
      json({ users: [                                             // auth users
        { email: "someone.else@example.com" },
        { email: "rajesh.menon@myschool.edu.in" },
      ] }),
    ]);
    const res = await post({ username: "rajesh.menon", password: "wrong" });
    // Reaching the sign-in stage proves the address was resolved at all.
    expect(spy).toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it("does not fall back when profiles already matched", async () => {
    // One lookup is enough in the normal case; a second round trip per sign-in
    // would be paid by every user to serve a rare one.
    const spy = mockFetchSequence([
      json([{ email: "rajesh.menon@myschool.edu.in" }]),
      json({}),
    ]);
    await post({ username: "rajesh.menon", action: "recover" });
    expect(spy.mock.calls).toHaveLength(2);
  });

  it("rejects a non-POST request", async () => {
    const res = await handler(
      new Request("https://erp.example.com/api/login", { method: "GET" })
    );
    expect(res.status).toBe(405);
  });
});
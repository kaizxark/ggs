import { afterEach, describe, expect, it } from "vitest";
import { SUPER_ADMIN_ID } from "../shared/super-admin";
import handler, { studentPassword } from "./invite";

type Json = Record<string, unknown>;

/**
 * A student portal password is the pupil's date of birth as DDMMYYYY, so that
 * a child can be handed their own credentials and remember them. The order is
 * the whole point of these tests: DDMM, not MMDD, and no separators.
 */
describe("studentPassword", () => {
  it("uses DDMMYYYY with no separators", () => {
    // 28 August 2005 -> 28 08 2005.
    expect(studentPassword("2005-08-28")).toBe("28082005");
    expect(studentPassword("2010-10-01")).toBe("01102010");
    expect(studentPassword("2013-12-31")).toBe("31122013");
  });

  it("is not affected by the time component", () => {
    expect(studentPassword("2005-08-28T00:00:00.000Z")).toBe("28082005");
  });

  it("pads single-digit days and months", () => {
    // 01 October reads as 0110, not 110.
    expect(studentPassword("2010-10-01")).toBe("01102010");
    expect(studentPassword("2011-03-13")).toBe("13032011");
  });

  it("rejects dates that do not exist", () => {
    expect(studentPassword("2005-02-30")).toBeNull();
    expect(studentPassword("2005-13-01")).toBeNull();
    expect(studentPassword("2005-00-10")).toBeNull();
    expect(studentPassword("2005-08-32")).toBeNull();
  });

  it("returns null when there is no usable date", () => {
    // A student with no recorded date of birth must not be issued a blank or
    // partial password; the caller falls back to a generated one.
    expect(studentPassword(null)).toBeNull();
    expect(studentPassword(undefined)).toBeNull();
    expect(studentPassword("")).toBeNull();
    expect(studentPassword("not a date")).toBeNull();
    expect(studentPassword("28/08/2005")).toBeNull();
  });
});

/**
 * There is exactly one super admin, and the app has no way to make a second
 * one. These tests drive the real handler with a stubbed fetch so the check is
 * exercised where it actually runs, rather than against a copy of the GRANTABLE
 * map that could drift from it.
 */
describe("POST /api/invite — super admin cannot be granted", () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /** Answer the two auth/profile lookups, then record any further call. */
  function stubFetch(callerId: string, profileRole: string) {
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: callerId }), { status: 200 });
      }
      if (url.includes("/rest/v1/profiles")) {
        return new Response(JSON.stringify([{ id: callerId, role: profileRole }]), {
          status: 200,
        });
      }
      // The account-creation POST, as opposed to the duplicate-check GET on the
      // same URL, has to return an id or the route bails with a 502.
      return new Response(
        JSON.stringify(
          init && init.method === "POST" ? { id: "new-user-id" } : { users: [] }
        ),
        { status: 200 }
      );
    }) as typeof fetch;
    return calls;
  }

  function invite(role: string, callerId = SUPER_ADMIN_ID) {
    return handler(
      new Request("https://erp.test/api/invite", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          action: "invite",
          email: "newcomer@gks.edu",
          fullName: "Newcomer",
          role,
          organisationId: "org-1",
        }),
      })
    );
  }

  it("refuses super_admin even when the caller really is the super admin", async () => {
    // The most important case: the check must not be "only an admin may not do
    // this", or the super admin could simply mint himself a rival.
    stubFetch(SUPER_ADMIN_ID, "admin");
    const res = await invite("super_admin");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/cannot be granted/i);
  });

  it("refuses a renamed variant of the role", async () => {
    // Not a real case today — the enum rejects these before this point — but a
    // normalisation gap here would be a silent second super admin later.
    stubFetch(SUPER_ADMIN_ID, "admin");
    for (const role of ["Super_Admin", "SUPER_ADMIN", " super_admin "]) {
      const res = await invite(role);
      expect(res.status).toBe(403);
    }
  });

  it("refuses an ordinary admin trying to grant it", async () => {
    stubFetch("11111111-1111-1111-1111-111111111111", "admin");
    expect((await invite("super_admin")).status).toBe(403);
  });

  it("does not create an account on the way to refusing", async () => {
    // The refusal has to come before the Supabase Admin API is touched, or a
    // rejected request would still have made a real user.
    const calls = stubFetch(SUPER_ADMIN_ID, "admin");
    await invite("super_admin");
    expect(calls.some((url) => url.includes("/auth/v1/admin/users"))).toBe(false);
  });

  it("reaches the account-creation step for a role that is allowed", async () => {
    // The mirror image: a guard that refuses everything would pass the tests
    // above while breaking the one job this route has.
    const calls = stubFetch(SUPER_ADMIN_ID, "admin");
    await invite("staff");
    expect(calls.some((url) => url.includes("/auth/v1/admin/users"))).toBe(true);
  });

  it("gives the super admin the wider role list", async () => {
    // Deriving the caller's role from the id is what buys this. Reading the
    // stored "admin" would cap him at staff-level invites and quietly
    // downgrade the one person who must be able to appoint other admins.
    const calls = stubFetch(SUPER_ADMIN_ID, "admin");
    await invite("admin");
    expect(calls.some((url) => url.includes("/auth/v1/admin/users"))).toBe(true);
  });

  it("still refuses a plain admin the power to appoint other admins", async () => {
    // The super admin is the only account that can create an admin, which is
    // what stops two admins from editing each other's access indefinitely.
    const calls = stubFetch("11111111-1111-1111-1111-111111111111", "admin");
    const res = await invite("admin");
    expect(res.status).toBe(403);
    expect(calls.some((url) => url.includes("/auth/v1/admin/users"))).toBe(false);
  });

  it("still lets a plain admin invite staff", async () => {
    // The mirror of the test above, so a fix that overcorrects and locks admins
    // out of ordinary hiring is caught too.
    const calls = stubFetch("11111111-1111-1111-1111-111111111111", "admin");
    const res = await invite("staff");
    expect(res.status).toBe(200);
    expect(calls.some((url) => url.includes("/auth/v1/admin/users"))).toBe(true);
  });

  it("records student credentials in the table the migration creates", async () => {
    /*
     * The route used to write `students.portal_username`, a column no migration
     * ever adds. The write failed on every run — including after the migration —
     * so a family who lost their child's password could never be reissued one.
     * student_credentials is the table the migration actually builds.
     */
    const writes: { url: string; body: unknown }[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" || init?.method === "PATCH") {
        writes.push({ url, body: JSON.parse(String(init.body ?? "{}")) });
      }
      if (url.includes("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: SUPER_ADMIN_ID }), { status: 200 });
      }
      if (url.includes("/rest/v1/profiles?select=id,role")) {
        return new Response(JSON.stringify([{ id: SUPER_ADMIN_ID, role: "admin" }]), { status: 200 });
      }
      if (url.includes("/rest/v1/students?select=")) {
        return new Response(
          JSON.stringify([
            {
              id: "student-1",
              usn: "adm26270041",
              first_name: "Yashaswini",
              last_name: "Naidu",
              email: "yashaswini.naidu@gks.edu.in",
              organisation_id: "org-1",
              date_of_birth: "2010-10-01",
            },
          ]),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ id: "new-user-id" }), { status: 200 });
    }) as typeof fetch;

    try {
      const res = await handler(
        new Request("https://erp.test/api/invite", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer test-token",
          },
          body: JSON.stringify({
            action: "student",
            studentId: "student-1",
            organisationId: "org-1",
          }),
        })
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        username: string;
        password: string;
        passwordIsDob: boolean;
        persisted: boolean;
      };
      expect(body.username).toBe("adm26270041");
      expect(body.password).toBe("01102010");
      expect(body.passwordIsDob).toBe(true);
      expect(body.persisted).toBe(true);

      const credentialWrite = writes.find((w) =>
        w.url.includes("/rest/v1/student_credentials")
      );
      expect(credentialWrite).toBeTruthy();
      expect(credentialWrite?.body).toMatchObject({
        student_id: "student-1",
        username: "adm26270041",
        password: "01102010",
      });
      // The column that does not exist must not be written any more.
      expect(
        writes.some((w) => "portal_username" in (w.body as Json))
      ).toBe(false);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
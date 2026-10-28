import { afterEach, beforeEach, describe, expect, it } from "vitest";
import handler from "./staff";

/**
 * The staff directory.
 *
 * Two things are checked here, and both of them were broken.
 *
 * The first is where a role goes. The access level lives on the profile, and
 * the staff row has no `role` column at all — so writing one there was
 * rejected by the database and took the whole save down with it. Every attempt
 * to change a member of staff's role failed.
 *
 * The second is how a staff record is found again. `staff.id` is the row's own
 * primary key and `staff.profile_id` is the account it belongs to; they are
 * different values for anybody the application created, so a lookup keyed on
 * the wrong one found the seeded rows (where the two happen to agree) and
 * nothing else.
 */

const realFetch = globalThis.fetch;

const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const OWNER_ID = "60ff6003-c0a4-438f-85df-2048b0e7b6c8";
const STAFF_ID = "22222222-2222-2222-2222-222222222222";
const PROFILE_ID = "33333333-3333-3333-3333-333333333333";

interface Store {
  profiles: Record<string, unknown>[];
  staff: Record<string, unknown>[];
  authUsers: { id: string; email: string }[];
  /** Every write that reached the database, in order. */
  writes: {
    table: string;
    method: string;
    url: string;
    body: Record<string, unknown>;
  }[];
}

let store: Store;

function emptyStore(): Store {
  return { profiles: [], staff: [], authUsers: [], writes: [] };
}

/** Pull the value out of a PostgREST filter such as `email=eq.a@b.com`. */
function filterValue(url: string, column: string): string | null {
  const match = new RegExp(`(?:[?&])${column}=eq\\.([^&]+)`).exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

function bodyOf(init?: RequestInit): Record<string, unknown> {
  try {
    return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stubNetwork() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET");

    /* The session, and the caller's own role. */
    if (url.includes("/auth/v1/user")) {
      return Response.json({
        id: CALLER_ID,
        email: "head.teacher@globalskids.edu.in",
      });
    }
    if (url.includes("/auth/v1/admin/users")) {
      if (method === "POST") {
        const body = bodyOf(init);
        const email = String(body.email ?? "");
        // An address that already has an account is refused, which is what the
        // real admin API does and what the provisioner relies on.
        if (store.authUsers.some(user => user.email === email)) {
          return Response.json(
            { msg: "User already registered" },
            { status: 422 }
          );
        }
        const id = `auth-${store.authUsers.length + 1}`;
        store.authUsers.push({ id, email });
        return Response.json({ id }, { status: 200 });
      }
      return Response.json({ users: store.authUsers });
    }

    if (url.includes("/rest/v1/profiles")) {
      if (method === "PATCH") {
        const body = bodyOf(init);
        store.writes.push({ table: "profiles", method, url, body });
        const byId = filterValue(url, "id");
        const row = store.profiles.find(profile => String(profile.id) === byId);
        if (row) Object.assign(row, body);
        return new Response(null, { status: 204 });
      }
      const byId = filterValue(url, "id");
      const rows = store.profiles.filter(
        profile => !byId || String(profile.id) === byId
      );
      return Response.json(rows);
    }

    if (url.includes("/rest/v1/staff")) {
      if (method === "POST") {
        const body = bodyOf(init);
        store.writes.push({ table: "staff", method, url, body });
        const row = { id: STAFF_ID, ...body, profile_id: null };
        store.staff.push(row);
        return Response.json([row], { status: 201 });
      }
      if (method === "PATCH") {
        const body = bodyOf(init);
        store.writes.push({ table: "staff", method, url, body });
        const byId = filterValue(url, "id");
        const row = store.staff.find(person => String(person.id) === byId);
        if (!row) {
          // A column the table does not have is refused by the database.
          return Response.json(
            {
              code: "42703",
              message: `column staff.${Object.keys(body)[0]} does not exist`,
            },
            { status: 400 }
          );
        }
        Object.assign(row, body);
        return Response.json([row]);
      }
      const byId = filterValue(url, "id");
      const byProfile = filterValue(url, "profile_id");
      const rows = store.staff.filter(person => {
        if (byId && String(person.id) === byId) return true;
        if (byProfile && String(person.profile_id) === byProfile) return true;
        return !byId && !byProfile;
      });
      return Response.json(rows);
    }

    if (url.includes("/rest/v1/organisations")) return Response.json([]);
    if (url.includes("/rest/v1/audit_logs")) {
      store.writes.push({
        table: "audit_logs",
        method,
        url,
        body: bodyOf(init),
      });
      return new Response(null, { status: 204 });
    }
    if (url.includes("/rest/v1/student_credentials")) return Response.json([]);

    return Response.json([]);
  }) as typeof fetch;
}

function request(method: string, body: unknown) {
  return handler(
    new Request("https://erp.test/api/staff", {
      method,
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer test-token",
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    })
  );
}

/** The writes that reached a given table. */
function writesTo(table: string) {
  return store.writes.filter(write => write.table === table);
}

beforeEach(() => {
  store = emptyStore();
  store.profiles.push({
    id: CALLER_ID,
    organisation_id: "org-1",
    full_name: "Head Teacher",
    email: "head.teacher@globalskids.edu.in",
    role: "admin",
    username: "head.teacher",
  });
  stubNetwork();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

/* ------------------------------------------------------------------ */

describe("PATCH /api/staff — changing somebody's role", () => {
  beforeEach(() => {
    store.staff.push({
      id: STAFF_ID,
      organisation_id: "org-1",
      name: "Rajesh Menon",
      email: "rajesh.menon@myschool.edu.in",
      designation: "Head of Physics",
      employee_code: "EMP-2015-002",
      joined_on: "2015-03-01",
      active: true,
      profile_id: PROFILE_ID,
    });
    store.profiles.push({
      id: PROFILE_ID,
      organisation_id: "org-1",
      full_name: "Rajesh Menon",
      email: "rajesh.menon@myschool.edu.in",
      role: "staff",
      username: "rajesh.menon",
    });
    store.authUsers.push({
      id: PROFILE_ID,
      email: "rajesh.menon@myschool.edu.in",
    });
  });

  it("saves the role on the profile, not on the staff row", async () => {
    const res = await request("PATCH", { id: STAFF_ID, role: "teacher" });
    expect(res.status).toBe(200);

    const staffWrites = writesTo("staff").filter(
      write => write.method === "PATCH"
    );
    // The staff row has no `role` column. Sending one is rejected by the
    // database, which is what made every role change fail.
    for (const write of staffWrites) {
      expect(write.body).not.toHaveProperty("role");
    }

    // The role lands on the profile the record is linked to, and on nothing
    // else.
    const roleWrite = writesTo("profiles").find(
      write => write.body.role !== undefined
    );
    expect(roleWrite).toBeDefined();
    expect(roleWrite?.url).toContain(`id=eq.${PROFILE_ID}`);
    expect(roleWrite?.body.role).toBe("teacher");
  });

  it("changes the role on the profile the record is linked to", async () => {
    await request("PATCH", { id: STAFF_ID, role: "teacher" });
    const row = store.profiles.find(profile => profile.id === PROFILE_ID);
    expect(row?.role).toBe("teacher");
  });

  it("leaves the role alone when the save is about something else", async () => {
    // Saving a staff record must not quietly demote somebody who was made an
    // admin in Settings.
    const res = await request("PATCH", { id: STAFF_ID, phone: "9845012345" });
    expect(res.status).toBe(200);
    // The account is kept in step with the record, and that write must not
    // carry a role with it.
    for (const write of writesTo("profiles")) {
      expect(write.body).not.toHaveProperty("role");
    }
    const row = store.profiles.find(profile => profile.id === PROFILE_ID);
    expect(row?.role).toBe("staff");
  });

  it("refuses a role nobody may hold", async () => {
    const res = await request("PATCH", { id: STAFF_ID, role: "principal" });
    expect(res.status).toBe(400);
    expect(writesTo("profiles")).toHaveLength(0);
  });

  it("will not move the super admin down", async () => {
    store.staff[0].profile_id = OWNER_ID;
    const res = await request("PATCH", { id: STAFF_ID, role: "staff" });
    expect(res.status).toBe(403);
    expect(writesTo("profiles")).toHaveLength(0);
  });

  it("still saves the rest of the record when the role is rejected", async () => {
    // A rejected field must not throw the whole save away.
    const res = await request("PATCH", {
      id: STAFF_ID,
      role: "principal",
      phone: "9845012345",
    });
    expect(res.status).toBe(400);
    expect(writesTo("staff")).toHaveLength(0);
  });

  it("refuses to move a record onto somebody else's account", async () => {
    store.authUsers.push({ id: "victim", email: "parent@example.com" });
    store.profiles.push({
      id: "victim",
      organisation_id: "org-1",
      full_name: "A Parent",
      email: "parent@example.com",
      role: "parent",
      username: "parent",
    });

    const res = await request("PATCH", {
      id: STAFF_ID,
      email: "parent@example.com",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      fieldErrors?: Record<string, string>;
    };
    expect(body.fieldErrors?.email).toBeTruthy();
    expect(writesTo("staff")).toHaveLength(0);
    expect(writesTo("profiles")).toHaveLength(0);
  });

  it("still saves when the address is the record's own", async () => {
    // The record's own account is the one account that may be kept in step.
    const res = await request("PATCH", {
      id: STAFF_ID,
      email: "rajesh.menon@myschool.edu.in",
    });
    expect(res.status).toBe(200);
  });
});

describe("POST /api/staff — adding a member of staff", () => {
  it("links the new record to the account it was given", async () => {
    const res = await request("POST", {
      name: "Anita Kulkarni",
      email: "anita.kulkarni@myschool.edu.in",
      role: "teacher",
    });
    expect(res.status).toBe(201);

    // `staff.profile_id` is how the record is found again. Without it a
    // member of staff added here has a record but no account anybody reaches.
    const link = writesTo("staff").find(
      write => write.method === "PATCH" && write.body.profile_id
    );
    expect(link).toBeDefined();
    expect(String(link?.body.profile_id)).toMatch(/^auth-/);
  });

  it("gives the new profile the role that was asked for", async () => {
    await request("POST", {
      name: "Anita Kulkarni",
      email: "anita.kulkarni@myschool.edu.in",
      role: "teacher",
    });
    const profileWrites = writesTo("profiles");
    expect(profileWrites.length).toBeGreaterThan(0);
    expect(profileWrites[0].body.role).toBe("teacher");
  });

  it("refuses an address that is not one", async () => {
    // A non-empty string is not an address. The account was being created with
    // it, so the person could never be sent a message, never prove the
    // address was theirs, and never sign in.
    const res = await request("POST", {
      name: "Anita Kulkarni",
      email: "not-an-email",
      role: "teacher",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      fieldErrors?: Record<string, string>;
    };
    expect(body.fieldErrors?.email).toBeTruthy();
    expect(writesTo("staff")).toHaveLength(0);
    expect(store.authUsers).toHaveLength(0);
  });

  it("refuses the placeholder address the system invents", async () => {
    // Nobody owns this address, so it cannot be the one somebody is invited
    // to prove they own.
    const res = await request("POST", {
      name: "Anita Kulkarni",
      email: "staff-pending@gks.invalid",
      role: "teacher",
    });
    expect(res.status).toBe(400);
    expect(writesTo("staff")).toHaveLength(0);
  });

  it("refuses an address that is not one when the record is changed", async () => {
    store.staff.push({
      id: STAFF_ID,
      organisation_id: "org-1",
      name: "Rajesh Menon",
      email: "rajesh.menon@myschool.edu.in",
      profile_id: PROFILE_ID,
    });
    const res = await request("PATCH", {
      id: STAFF_ID,
      email: "not-an-email",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      fieldErrors?: Record<string, string>;
    };
    expect(body.fieldErrors?.email).toBeTruthy();
    expect(writesTo("staff")).toHaveLength(0);
  });

  it("refuses an address that already has somebody else's account", async () => {
    /*
     * The account behind the address belongs to somebody else: a colleague, a
     * parent, a pupil, or somebody at another school. Provisioning it would
     * rewrite their name, their role and their school, so the address is
     * refused — and their account is left exactly as it was.
     */
    store.authUsers.push({ id: "victim", email: "parent@example.com" });
    store.profiles.push({
      id: "victim",
      organisation_id: "org-1",
      full_name: "A Parent",
      email: "parent@example.com",
      role: "parent",
      username: "parent",
    });

    const res = await request("POST", {
      name: "Impostor",
      email: "parent@example.com",
      role: "admin",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      fieldErrors?: Record<string, string>;
    };
    expect(body.fieldErrors?.email).toBeTruthy();

    // No record was written, and nothing was written to the account that was
    // already there.
    expect(writesTo("staff")).toHaveLength(0);
    expect(writesTo("profiles")).toHaveLength(0);
    const victim = store.profiles.find(profile => profile.id === "victim");
    expect(victim?.role).toBe("parent");
    expect(victim?.full_name).toBe("A Parent");
  });
});

describe("GET /api/staff — reading the directory", () => {
  it("never returns anybody's password", async () => {
    store.staff.push({
      id: STAFF_ID,
      organisation_id: "org-1",
      name: "Rajesh Menon",
      email: "rajesh.menon@myschool.edu.in",
      joined_on: "2015-03-01",
      profile_id: PROFILE_ID,
    });

    const res = await request("GET", {});
    const body = (await res.json()) as { staff: Record<string, unknown>[] };
    expect(res.status).toBe(200);
    expect(body.staff).toHaveLength(1);
    expect(body.staff[0]).not.toHaveProperty("password");
  });
});

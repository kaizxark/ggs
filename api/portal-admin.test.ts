import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, PATCH, POST } from "./portal-admin";
import { SUPER_ADMIN_ID } from "../shared/super-admin";
import { PASSWORD_NOT_STORED } from "../shared/portal-accounts";

/**
 * The two owner actions this school runs on.
 *
 * The shared name is the sign-in name every pupil in this school uses, and
 * the reset puts every pupil's password back to their date of birth. Both
 * overwrite something other people rely on, so both are owner-only, both are
 * written to the audit log, and both have to be exactly repeatable — the
 * owner will run them again the first time something looks wrong.
 */

const realFetch = globalThis.fetch;

interface Store {
  settings: { key: string; value: unknown }[];
  profiles: Record<string, unknown>[];
  students: Record<string, unknown>[];
  credentials: Record<string, unknown>[];
  audit: Record<string, unknown>[];
  /** Passwords written through the auth admin API. */
  passwords: { id: string; password: string }[];
  /** Writes made to a profile. */
  profileWrites: { url: string; body: Record<string, unknown> }[];
  /** Writes made to a credential row. */
  credentialWrites: { url: string; body: Record<string, unknown> }[];
  /** Writes made to the settings table. */
  settingWrites: {
    method: string;
    url: string;
    body: Record<string, unknown>;
  }[];
  /** The id of the account the request is made as. */
  callerId: string;
}

let store: Store;

function emptyStore(): Store {
  return {
    settings: [],
    profiles: [],
    students: [],
    credentials: [],
    audit: [],
    passwords: [],
    profileWrites: [],
    credentialWrites: [],
    settingWrites: [],
    callerId: SUPER_ADMIN_ID,
  };
}

function filterValue(url: string, column: string): string | null {
  const match = new RegExp(`(?:[?&])${column}=eq\\.([^&]+)`).exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

function inFilterValues(url: string, column: string): string[] {
  const match = new RegExp(`(?:[?&])${column}=in\\.\\(([^)]*)\\)`).exec(url);
  if (!match) return [];
  return match[1]
    .split(",")
    .map(value => decodeURIComponent(value))
    .filter(Boolean);
}

function stubNetwork() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET");
    const body = (init?.body ? JSON.parse(String(init.body)) : {}) as Record<
      string,
      unknown
    >;

    /* The signed-in person. */
    if (url.includes("/auth/v1/user")) {
      return Response.json({ id: store.callerId, email: "kaizxark@gmail.com" });
    }

    if (url.includes("/auth/v1/admin/users/")) {
      const id = decodeURIComponent(url.split("/auth/v1/admin/users/")[1]);
      if (method === "PUT") {
        store.passwords.push({ id, password: String(body.password ?? "") });
        return Response.json({ id });
      }
      return Response.json({ id });
    }

    if (url.includes("/rest/v1/settings")) {
      if (method === "PATCH") {
        store.settingWrites.push({ method, url, body });
        const byKey = filterValue(url, "key");
        const row = store.settings.find(candidate => candidate.key === byKey);
        if (row) Object.assign(row, body);
        const wants = String(
          (init?.headers as Record<string, string> | undefined)?.Prefer ?? ""
        );
        if (wants.includes("return=representation")) {
          return Response.json(row ? [row] : []);
        }
        return new Response(null, { status: 204 });
      }
      if (method === "POST") {
        store.settingWrites.push({ method, url, body });
        const byKey = String(body.key ?? "");
        if (store.settings.some(candidate => candidate.key === byKey)) {
          return new Response("duplicate", { status: 409 });
        }
        store.settings.push({ key: byKey, value: body.value });
        return Response.json([{ key: byKey, value: body.value }], {
          status: 201,
        });
      }
      const byKey = filterValue(url, "key");
      return Response.json(
        store.settings.filter(row => !byKey || row.key === byKey)
      );
    }

    if (url.includes("/rest/v1/audit_logs")) {
      store.audit.push(body);
      return new Response(null, { status: 204 });
    }

    if (url.includes("/rest/v1/student_credentials")) {
      if (method === "PATCH" || method === "POST") {
        store.credentialWrites.push({ url, body });
        const byStudent = filterValue(url, "student_id");
        const row = byStudent
          ? store.credentials.find(
              candidate =>
                String(candidate.student_id) === decodeURIComponent(byStudent)
            )
          : undefined;
        if (row) Object.assign(row, body);
        return new Response(null, { status: 204 });
      }
      return Response.json(store.credentials);
    }

    if (url.includes("/rest/v1/profiles")) {
      if (method === "PATCH") {
        store.profileWrites.push({ url, body });
        const ids = inFilterValues(url, "student_id");
        for (const row of store.profiles) {
          if (ids.includes(String(row.student_id))) Object.assign(row, body);
        }
        return new Response(null, { status: 204 });
      }
      const byId = filterValue(url, "id");
      let rows = byId
        ? store.profiles.filter(row => String(row.id) === byId)
        : store.profiles;
      /* The pupil roll call: rows that belong to a pupil, and only those. */
      if (url.includes("student_id=not.is.null")) {
        rows = rows.filter(row => row.student_id);
      }
      /* A pupil's own account, found through the link that says it is theirs. */
      const byStudent = filterValue(url, "student_id");
      if (byStudent) {
        rows = rows.filter(row => String(row.student_id ?? "") === byStudent);
      }
      return Response.json(rows);
    }

    if (url.includes("/rest/v1/students")) {
      const byId = filterValue(url, "id");
      return Response.json(
        byId
          ? store.students.filter(row => String(row.id) === byId)
          : store.students
      );
    }

    return Response.json([]);
  }) as typeof fetch;
}

/** A request as the signed-in person. */
function request(url: string, method: string, body?: unknown) {
  return new Request(`https://erp.test${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${store.callerId}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  store = emptyStore();
  /*
   * The owner, and the school they belong to. Without the school there is
   * nothing to write the audit log against, and the route refuses to act.
   */
  store.profiles.push({
    id: SUPER_ADMIN_ID,
    organisation_id: "org-1",
    email: "kaizxark@gmail.com",
    full_name: "Ehtesham",
    role: "super_admin",
  });
  stubNetwork();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

/* ------------------------------------------------------------------ */

describe("GET /api/portal-admin?action=shared-name", () => {
  it("reports the name the school has set", async () => {
    store.settings.push({
      key: "portal_shared_username",
      value: "kaizxark@gmail.com",
    });
    const res = await GET(
      request("/api/portal-admin?action=shared-name", "GET")
    );
    const body = (await res.json()) as {
      sharedUsername: string;
      onSharedName: number;
      withOwnName: number;
    };

    expect(res.status).toBe(200);
    expect(body.sharedUsername).toBe("kaizxark@gmail.com");
  });

  it("counts the pupils on the shared name and the pupils with their own", async () => {
    store.settings.push({
      key: "portal_shared_username",
      value: "kaizxark@gmail.com",
    });
    store.profiles.push(
      { id: "auth-1", student_id: "student-1", username: "kaizxark@gmail.com" },
      { id: "auth-2", student_id: "student-2", username: "kaizxark@gmail.com" },
      { id: "auth-3", student_id: "student-3", username: "priya.menon" }
    );

    const res = await GET(
      request("/api/portal-admin?action=shared-name", "GET")
    );
    const body = (await res.json()) as {
      onSharedName: number;
      withOwnName: number;
    };

    expect(body.onSharedName).toBe(2);
    expect(body.withOwnName).toBe(1);
  });

  it("does not count the owner as a pupil", async () => {
    // The owner signs in with the same address, and has no pupil record.
    const res = await GET(
      request("/api/portal-admin?action=shared-name", "GET")
    );
    const body = (await res.json()) as { withOwnName: number };
    expect(body.withOwnName).toBe(0);
  });

  it("is closed to anybody who is not the school owner", async () => {
    store.callerId = "somebody-else";
    const res = await GET(
      request("/api/portal-admin?action=shared-name", "GET")
    );
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/portal-admin?action=shared-name", () => {
  it("stores the name and puts it on every pupil who has not claimed one", async () => {
    store.profiles.push(
      { id: "auth-1", student_id: "student-1", username: "old.name" },
      { id: "auth-2", student_id: "student-2", username: "old.name" }
    );
    store.credentials.push({
      student_id: "student-2",
      username_chosen_at: "2026-01-01T00:00:00.000Z",
    });

    const res = await PATCH(
      request("/api/portal-admin?action=shared-name", "PATCH", {
        sharedUsername: "kaizxark@gmail.com",
      })
    );
    const body = (await res.json()) as {
      ok: boolean;
      sharedUsername: string;
      applied: number;
    };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.sharedUsername).toBe("kaizxark@gmail.com");
    // Only the pupil who has not claimed a name of their own.
    expect(body.applied).toBe(1);
    const ids = inFilterValues(store.profileWrites[0].url, "student_id");
    expect(ids).toEqual(["student-1"]);
    expect(store.profileWrites[0].body.username).toBe("kaizxark@gmail.com");
  });

  it("writes it to the settings table", async () => {
    await PATCH(
      request("/api/portal-admin?action=shared-name", "PATCH", {
        sharedUsername: "kaizxark@gmail.com",
      })
    );
    const written = store.settings.find(
      row => row.key === "portal_shared_username"
    );
    expect(written?.value).toBe("kaizxark@gmail.com");
  });

  it("refuses a name that is not one", async () => {
    const res = await PATCH(
      request("/api/portal-admin?action=shared-name", "PATCH", {
        sharedUsername: "not a name!",
      })
    );
    expect(res.status).toBe(400);
    expect(store.settingWrites).toHaveLength(0);
  });

  it("refuses an empty name", async () => {
    const res = await PATCH(
      request("/api/portal-admin?action=shared-name", "PATCH", {
        sharedUsername: "   ",
      })
    );
    expect(res.status).toBe(400);
  });

  it("is closed to anybody who is not the school owner", async () => {
    store.callerId = "somebody-else";
    const res = await PATCH(
      request("/api/portal-admin?action=shared-name", "PATCH", {
        sharedUsername: "kaizxark@gmail.com",
      })
    );
    expect(res.status).toBe(403);
    expect(store.settingWrites).toHaveLength(0);
  });

  it("writes down what it did", async () => {
    await PATCH(
      request("/api/portal-admin?action=shared-name", "PATCH", {
        sharedUsername: "kaizxark@gmail.com",
      })
    );
    const action = store.audit[0]?.action;
    expect(action).toBe("portal.shared_username");
  });
});

describe("POST /api/portal-admin?action=reset-pupil-passwords", () => {
  beforeEach(() => {
    store.profiles.push(
      { id: "auth-1", student_id: "student-1", email: "priya@example.com" },
      { id: "auth-2", student_id: "student-2", email: "imran@example.com" }
    );
    store.students.push(
      {
        id: "student-1",
        usn: "adm26270001",
        first_name: "Priya",
        last_name: "Menon",
        email: "priya@example.com",
        date_of_birth: "2005-08-29",
        organisation_id: "org-1",
      },
      {
        id: "student-2",
        usn: "adm26270002",
        first_name: "Imran",
        last_name: "Khan",
        email: "imran@example.com",
        date_of_birth: "2009-01-14",
        organisation_id: "org-1",
      }
    );
  });

  it("puts every pupil's password back to their date of birth", async () => {
    const res = await POST(
      request("/api/portal-admin?action=reset-pupil-passwords", "POST")
    );
    const body = (await res.json()) as { ok: boolean; reset: number };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.reset).toBe(2);
    expect(store.passwords).toEqual([
      { id: "auth-1", password: "290805" },
      { id: "auth-2", password: "140109" },
    ]);
  });

  it("records the password on the school's own row, so the owner reads the one that works", async () => {
    await POST(
      request("/api/portal-admin?action=reset-pupil-passwords", "POST")
    );
    expect(store.credentialWrites).toHaveLength(2);
    expect(store.credentialWrites[0].body.password).toBe(PASSWORD_NOT_STORED);
  });

  it("leaves a pupil with no date of birth alone, and says so", async () => {
    store.students[1].date_of_birth = "";
    const res = await POST(
      request("/api/portal-admin?action=reset-pupil-passwords", "POST")
    );
    const body = (await res.json()) as { reset: number; skipped: number };

    expect(body.reset).toBe(1);
    expect(body.skipped).toBe(1);
    expect(store.passwords).toHaveLength(1);
  });

  it("is closed to anybody who is not the school owner", async () => {
    store.callerId = "somebody-else";
    const res = await POST(
      request("/api/portal-admin?action=reset-pupil-passwords", "POST")
    );
    expect(res.status).toBe(403);
    expect(store.passwords).toHaveLength(0);
  });

  it("writes down what it did", async () => {
    await POST(
      request("/api/portal-admin?action=reset-pupil-passwords", "POST")
    );
    expect(store.audit[0]?.action).toBe("portal.reset_pupil_passwords");
  });
});

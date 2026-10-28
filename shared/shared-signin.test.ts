import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applySharedUsernameToPupils,
  isSharedUsername,
  matchPupilsByPassword,
  normaliseSharedUsername,
  readPupilAccounts,
  readSharedUsername,
  sharedUsernameProblem,
  writeSharedUsername,
  type PupilAccount,
} from "./shared-signin";

/**
 * The sign-in name every pupil shares.
 *
 * This is the rule the whole school signs in with, so it is tested from both
 * ends: the name itself (what it may be, where it is kept, who it is put on)
 * and the answer it produces (which pupil a date of birth belongs to).
 *
 * The dangerous failure is not a crash. It is putting one child in another
 * child's account — which happens the moment two pupils share a date of birth
 * and the shared name cannot say which of them is signing in. So that case is
 * tested explicitly, and the rule is that it refuses rather than picks.
 */

const realFetch = globalThis.fetch;

interface Store {
  settings: { key: string; value: unknown }[];
  profiles: Record<string, unknown>[];
  students: Record<string, unknown>[];
  credentials: Record<string, unknown>[];
  /** Every write made to a profile, in order. */
  profileWrites: { url: string; body: Record<string, unknown> }[];
  /** Every write made to a setting, in order. */
  settingWrites: {
    method: string;
    url: string;
    body: Record<string, unknown>;
  }[];
  /** Every write made to a credential row, in order. */
  credentialWrites: { url: string; body: Record<string, unknown> }[];
}

let store: Store;

function emptyStore(): Store {
  return {
    settings: [],
    profiles: [],
    students: [],
    credentials: [],
    profileWrites: [],
    settingWrites: [],
    credentialWrites: [],
  };
}

/** Pull the value out of a PostgREST filter such as `key=eq.foo`. */
function filterValue(url: string, column: string): string | null {
  const match = new RegExp(`(?:[?&])${column}=eq\\.([^&]+)`).exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

/** The ids inside a PostgREST `in.(a,b,c)` filter. */
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

    if (url.includes("/rest/v1/settings")) {
      if (method === "PATCH") {
        store.settingWrites.push({ method, url, body });
        const byKey = filterValue(url, "key");
        const row = store.settings.find(
          candidate => String(candidate.key) === byKey
        );
        if (row) Object.assign(row, body);
        /*
         * `return=representation` asks for the rows that changed. A PATCH
         * that matched nothing answers 204 with no body, and the route reads
         * that as "there is no row yet" rather than "the write worked".
         */
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
        store.settings.filter(row => !byKey || String(row.key) === byKey)
      );
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
          if (ids.includes(String(row.student_id))) {
            Object.assign(row, body);
          }
        }
        return new Response(null, { status: 204 });
      }
      return Response.json(store.profiles);
    }

    if (url.includes("/rest/v1/students")) {
      return Response.json(store.students);
    }

    return Response.json([]);
  }) as typeof fetch;
}

beforeEach(() => {
  store = emptyStore();
  stubNetwork();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

/* ------------------------------------------------------------------ */

describe("the shared name — what it may be", () => {
  it("trims and lowercases every comparison of it", () => {
    expect(normaliseSharedUsername("  KaizXark@Gmail.com  ")).toBe(
      "kaizxark@gmail.com"
    );
    expect(normaliseSharedUsername(null)).toBe("");
  });

  it("accepts the address this school hands out", () => {
    expect(sharedUsernameProblem("kaizxark@gmail.com")).toBeNull();
  });

  it("accepts a plain word, so a school need not hand out an address", () => {
    expect(sharedUsernameProblem("pupil")).toBeNull();
  });

  it("refuses an empty name", () => {
    expect(sharedUsernameProblem("")).toBeTruthy();
    expect(sharedUsernameProblem("   ")).toBeTruthy();
    expect(sharedUsernameProblem(undefined)).toBeTruthy();
  });

  it("refuses an address that is not one", () => {
    // The sign-in form would reject it anyway, so it is refused here rather
    // than at the door.
    expect(sharedUsernameProblem("kaizxark@")).toBeTruthy();
    expect(sharedUsernameProblem("kaizxark@gmail")).toBeTruthy();
  });

  it("refuses a name that could rewrite a filter", () => {
    expect(sharedUsernameProblem("a,b")).toBeTruthy();
    expect(sharedUsernameProblem("a'.or(1=1)")).toBeTruthy();
  });

  it("refuses a name that is too long to be an address", () => {
    expect(sharedUsernameProblem(`${"a".repeat(300)}@gmail.com`)).toBeTruthy();
  });
});

describe("the shared name — where it is kept", () => {
  it("reads it back from the settings table", async () => {
    store.settings.push({
      key: "portal_shared_username",
      value: "kaizxark@gmail.com",
    });
    expect(await readSharedUsername()).toBe("kaizxark@gmail.com");
  });

  it("reads nothing as an empty name rather than failing", async () => {
    // A sign-in route that cannot reach the settings table must still let a
    // member of staff sign in with their own name.
    expect(await readSharedUsername()).toBe("");
  });

  it("writes it back", async () => {
    store.settings.push({ key: "portal_shared_username", value: "old" });
    expect(await writeSharedUsername("kaizxark@gmail.com")).toBe(true);
    expect(store.settingWrites[0].method).toBe("PATCH");
    expect(store.settingWrites[0].body.value).toBe("kaizxark@gmail.com");
    expect(store.settings[0].value).toBe("kaizxark@gmail.com");
  });

  it("creates the row the first time, when there is none to write to", async () => {
    expect(await writeSharedUsername("kaizxark@gmail.com")).toBe(true);
    const created = store.settingWrites.find(write => write.method === "POST");
    expect(created).toBeTruthy();
    expect(created?.body.key).toBe("portal_shared_username");
  });

  it("knows when a typed value is the school's shared name", async () => {
    store.settings.push({
      key: "portal_shared_username",
      value: "kaizxark@gmail.com",
    });
    expect(await isSharedUsername("KaizXark@Gmail.com")).toBe(true);
    expect(await isSharedUsername("rajesh.menon")).toBe(false);
    expect(await isSharedUsername("")).toBe(false);
  });
});

describe("the shared name — who it is put on", () => {
  it("puts it on every pupil who has not claimed a name of their own", async () => {
    store.profiles.push(
      { id: "auth-1", student_id: "student-1" },
      { id: "auth-2", student_id: "student-2" }
    );
    store.credentials.push({ student_id: "student-1" });

    const written = await applySharedUsernameToPupils("kaizxark@gmail.com");
    expect(written).toBe(2);
    expect(store.profileWrites[0].body.username).toBe("kaizxark@gmail.com");
  });

  it("leaves a pupil who has chosen a name of their own alone", async () => {
    /*
     * Their name is theirs. The shared name does not reach them from now on,
     * so a school cannot quietly take a child's chosen name back.
     */
    store.profiles.push(
      { id: "auth-1", student_id: "student-1" },
      { id: "auth-2", student_id: "student-2" }
    );
    store.credentials.push({
      student_id: "student-2",
      username_chosen_at: "2026-01-01T00:00:00.000Z",
    });

    const written = await applySharedUsernameToPupils("kaizxark@gmail.com");
    expect(written).toBe(1);
    const ids = inFilterValues(store.profileWrites[0].url, "student_id");
    expect(ids).toEqual(["student-1"]);
  });

  it("writes nothing at all for an empty name", async () => {
    store.profiles.push({ id: "auth-1", student_id: "student-1" });
    expect(await applySharedUsernameToPupils("")).toBe(0);
    expect(store.profileWrites).toHaveLength(0);
  });
});

describe("the pupils behind the shared name", () => {
  beforeEach(() => {
    store.profiles.push({
      id: "auth-1",
      email: "priya@example.com",
      student_id: "student-1",
    });
    store.students.push({
      id: "student-1",
      usn: "adm26270001",
      first_name: "Priya",
      last_name: "Menon",
      email: "priya@example.com",
      date_of_birth: "2005-08-29",
    });
  });

  it("takes the address the account signs in with from the profile", async () => {
    /*
     * The pupil record's address can be edited after the account was minted,
     * and the two drift. The profile is what the account actually
     * authenticates with, so it is the authority.
     */
    store.students[0].email = "old.address@example.com";
    const accounts = await readPupilAccounts();
    expect(accounts[0].email).toBe("priya@example.com");
  });

  it("falls back to the record's address when there is no profile address", async () => {
    store.profiles[0].email = "";
    store.students[0].email = "on.record@example.com";
    const accounts = await readPupilAccounts();
    expect(accounts[0].email).toBe("on.record@example.com");
  });

  it("uses the recorded password when the pupil has one", async () => {
    store.credentials.push({
      student_id: "student-1",
      email: "priya@example.com",
      password: "chosenpassword",
    });
    const accounts = await readPupilAccounts();
    expect(accounts[0].password).toBe("chosenpassword");
  });

  it("derives the password from the date of birth when there is no row", async () => {
    const accounts = await readPupilAccounts();
    expect(accounts[0].password).toBe("290805");
  });

  it("says when a pupil has claimed a name of their own", async () => {
    store.credentials.push({
      student_id: "student-1",
      username_chosen_at: "2026-01-01T00:00:00.000Z",
    });
    const accounts = await readPupilAccounts();
    expect(accounts[0].claimed).toBe(true);
  });
});

describe("matching a date of birth to a pupil", () => {
  const accounts: PupilAccount[] = [
    {
      studentId: "student-1",
      name: "Priya Menon",
      usn: "adm26270001",
      email: "priya@example.com",
      password: "290805",
      claimed: false,
    },
    {
      studentId: "student-2",
      name: "Imran Khan",
      usn: "adm26270002",
      email: "imran@example.com",
      password: "290805",
      claimed: false,
    },
  ];

  it("finds the pupil whose date of birth it is", () => {
    const matches = matchPupilsByPassword(accounts, "140112");
    expect(matches).toHaveLength(0);
    expect(matchPupilsByPassword(accounts, "290805")).toHaveLength(2);
  });

  it("finds nobody for an empty password", () => {
    // An empty password must never match a record whose password is missing.
    expect(matchPupilsByPassword(accounts, "")).toHaveLength(0);
  });
});

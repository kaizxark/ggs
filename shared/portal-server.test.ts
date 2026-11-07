import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PASSWORD_NOT_STORED } from "./portal-accounts";
import {
  changePortalCredentials,
  provisionPortalAccount,
  readAccountState,
  resetPupilPasswords,
} from "./portal-server";

/**
 * The account behind a record.
 *
 * Two things are checked here, and both of them were broken.
 *
 * The first is how a member of staff is found again. `staff.id` is the row's
 * own primary key and `staff.profile_id` is the account it belongs to; they
 * are different values for anybody the application created. The lookup used
 * both as an equality filter, which matched only the seeded rows — where the
 * two happen to carry the same value — and nothing else. A member of staff
 * added through the application was therefore treated as an administrator with
 * no record at all, and their changed password was written against the wrong
 * key.
 *
 * The second is what "created" means. An account that already existed was
 * reported as newly created, so a backfill run twice claimed to have made a
 * hundred accounts the second time round.
 */

const realFetch = globalThis.fetch;

interface Store {
  profiles: Record<string, unknown>[];
  staff: Record<string, unknown>[];
  students: Record<string, unknown>[];
  authUsers: { id: string; email: string }[];
  /** The pages the auth user list was asked for. */
  authPages: number[];
  /** Every write made to a profile, in order. */
  profileWrites: { url: string; body: Record<string, unknown> }[];
  /** The school's own record of each pupil's credential. */
  credentials: Record<string, unknown>[];
  /** Every write made to a credential row, in order. */
  credentialWrites: { url: string; body: Record<string, unknown> }[];
  /** Passwords written through the auth admin API. */
  passwordWrites: { id: string; password: string }[];
  /** The settings the school keeps. */
  settings: { key: string; value: unknown }[];
}

let store: Store;

function emptyStore(): Store {
  return {
    profiles: [],
    staff: [],
    students: [],
    authUsers: [],
    authPages: [],
    profileWrites: [],
    credentials: [],
    credentialWrites: [],
    passwordWrites: [],
    settings: [],
  };
}

/** The id inside a PostgREST `or=(a.eq.X,b.eq.Y)` filter. */
function orFilterValue(url: string, column: string): string | null {
  const match = new RegExp(`${column}\\.eq\\.([^,)]+)`).exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

function stubNetwork() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET");

    if (url.includes("/auth/v1/admin/users/")) {
      /* A password written to one account. */
      const id = decodeURIComponent(url.split("/auth/v1/admin/users/")[1]);
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        password?: string;
      };
      store.passwordWrites.push({ id, password: String(body.password ?? "") });
      return Response.json({ id });
    }

    if (url.includes("/auth/v1/admin/users")) {
      if (method === "POST") {
        const body = JSON.parse(String(init?.body)) as { email?: string };
        const email = String(body.email ?? "");
        if (store.authUsers.some(user => user.email === email)) {
          return Response.json(
            { msg: "User already registered" },
            { status: 422 }
          );
        }
        const id = `auth-${store.authUsers.length + 1}`;
        store.authUsers.push({ id, email });
        return Response.json({ id });
      }
      const page = Number(/[?&]page=(\d+)/.exec(url)?.[1] ?? "1");
      store.authPages.push(page);
      const start = (page - 1) * 200;
      return Response.json({
        users: store.authUsers.slice(start, start + 200),
      });
    }

    if (url.includes("/rest/v1/settings")) {
      const byKey = /[?&]key=eq\.([^&]+)/.exec(url);
      return Response.json(
        byKey
          ? store.settings.filter(
              row => row.key === decodeURIComponent(byKey[1])
            )
          : store.settings
      );
    }

    if (url.includes("/rest/v1/student_credentials")) {
      if (method === "PATCH" || method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        store.credentialWrites.push({ url, body });
        const byStudent = /[?&]student_id=eq\.([^&]+)/.exec(url);
        const row = byStudent
          ? store.credentials.find(
              candidate =>
                String(candidate.student_id) ===
                decodeURIComponent(byStudent[1])
            )
          : undefined;
        if (row) Object.assign(row, body);
        return new Response(null, { status: 204 });
      }
      return Response.json(store.credentials);
    }

    if (url.includes("/rest/v1/profiles")) {
      if (method === "PATCH") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        store.profileWrites.push({ url, body });
        const byId = /[?&]id=eq\.([^&]+)/.exec(url);
        const row = byId
          ? store.profiles.find(
              profile => String(profile.id) === decodeURIComponent(byId[1])
            )
          : undefined;
        if (row) Object.assign(row, body);
        return new Response(null, { status: 204 });
      }
      /*
       * A pupil's account is found through `profiles.student_id`, which is the
       * link that says the account belongs to that pupil.
       */
      const byStudent = /[?&]student_id=eq\.([^&]+)/.exec(url);
      if (byStudent) {
        return Response.json(
          store.profiles.filter(
            profile =>
              String(profile.student_id ?? "") ===
              decodeURIComponent(byStudent[1])
          )
        );
      }
      const byId = /[?&]id=eq\.([^&]+)/.exec(url);
      return Response.json(
        byId
          ? store.profiles.filter(
              profile => String(profile.id) === decodeURIComponent(byId[1])
            )
          : store.profiles
      );
    }

    if (url.includes("/rest/v1/staff")) {
      /*
       * The lookup is `or=(profile_id.eq.X,id.eq.X)`. A row matches when
       * either half of it is the account being looked for, which is what
       * PostgREST does with an `or` filter.
       */
      const byProfile = orFilterValue(url, "profile_id");
      const byId = orFilterValue(url, "id");
      if (byProfile || byId) {
        return Response.json(
          store.staff.filter(
            person =>
              (byProfile && String(person.profile_id) === byProfile) ||
              (byId && String(person.id) === byId)
          )
        );
      }
      const exact = /[?&]id=eq\.([^&]+)/.exec(url);
      return Response.json(
        exact
          ? store.staff.filter(
              person => String(person.id) === decodeURIComponent(exact[1])
            )
          : store.staff
      );
    }

    if (url.includes("/rest/v1/students")) {
      const byId = /[?&]id=eq\.([^&]+)/.exec(url);
      return Response.json(
        byId
          ? store.students.filter(
              pupil => String(pupil.id) === decodeURIComponent(byId[1])
            )
          : store.students
      );
    }
    if (url.includes("/rest/v1/organisations")) return Response.json([]);
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

describe("readAccountState — a member of staff", () => {
  it("finds the record through the link, not through its own key", async () => {
    /*
     * The shape the application creates: the staff row has its own uuid and
     * points at the account through `profile_id`. The two are different
     * values, and a lookup keyed on the row's own id finds nothing.
     */
    store.profiles.push({
      id: "auth-1",
      organisation_id: "org-1",
      full_name: "Anita Kulkarni",
      email: "anita.kulkarni@myschool.edu.in",
      role: "teacher",
      username: "anita.kulkarni",
    });
    store.staff.push({
      id: "staff-row-1",
      organisation_id: "org-1",
      name: "Anita Kulkarni",
      profile_id: "auth-1",
    });

    const state = await readAccountState("auth-1");
    expect(state).not.toBeNull();
    expect(state?.subject).toBe("staff");
    // The record's own key, because that is what a credential row is keyed on.
    expect(state?.recordId).toBe("staff-row-1");
    expect(state?.name).toBe("Anita Kulkarni");
  });

  it("still finds a record whose key and link happen to be the same", async () => {
    // The seeded rows were written with one uuid in both places.
    store.profiles.push({
      id: "auth-2",
      organisation_id: "org-1",
      full_name: "Rajesh Menon",
      email: "rajesh.menon@myschool.edu.in",
      role: "staff",
      username: "rajesh.menon",
    });
    store.staff.push({
      id: "auth-2",
      organisation_id: "org-1",
      name: "Rajesh Menon",
      profile_id: "auth-2",
    });

    const state = await readAccountState("auth-2");
    expect(state?.subject).toBe("staff");
    expect(state?.recordId).toBe("auth-2");
  });

  it("finds a pupil through their own record", async () => {
    store.profiles.push({
      id: "auth-3",
      organisation_id: "org-1",
      full_name: "Priya Menon",
      email: "priya@example.com",
      role: "student",
      username: "priya.menon",
      student_id: "student-1",
    });
    store.students.push({
      id: "student-1",
      organisation_id: "org-1",
      first_name: "Priya",
      last_name: "Menon",
      email: "priya@example.com",
    });

    const state = await readAccountState("auth-3");
    expect(state?.subject).toBe("student");
    expect(state?.recordId).toBe("student-1");
  });
});

describe("provisionPortalAccount — what it reports", () => {
  it("says an account was created when it made one", async () => {
    const result = await provisionPortalAccount({
      subject: "staff",
      recordId: "staff-row-1",
      organisationId: "org-1",
      email: "anita.kulkarni@myschool.edu.in",
      name: "Anita Kulkarni",
      role: "teacher",
      birthDate: "2015-03-01",
    });

    expect(result.ok).toBe(true);
    expect(result.created).toBe(true);
    expect(result.authUserId).toBe("auth-1");
  });

  it("does not claim to have created an account that was already there", async () => {
    /*
     * The record's own account, saved a second time. Nothing is minted, and
     * nothing is claimed to have been minted.
     */
    store.authUsers.push({
      id: "auth-9",
      email: "rajesh.menon@myschool.edu.in",
    });

    const result = await provisionPortalAccount({
      subject: "staff",
      recordId: "staff-row-9",
      organisationId: "org-1",
      email: "rajesh.menon@myschool.edu.in",
      name: "Rajesh Menon",
      birthDate: "2015-03-01",
      existingAuthUserId: "auth-9",
    });

    expect(result.ok).toBe(true);
    expect(result.created).toBe(false);
    expect(result.authUserId).toBe("auth-9");
  });
});

describe("provisionPortalAccount — an account that belongs to somebody else", () => {
  it("refuses an address that already has another person's account", async () => {
    /*
     * The account behind the address is somebody's: a colleague's, a
     * parent's, a pupil's, or somebody at another school. Adopting it would
     * replace their name, their role and the school they belong to, so the
     * address is refused and their account is left exactly as it was.
     */
    store.authUsers.push({
      id: "auth-9",
      email: "rajesh.menon@myschool.edu.in",
    });
    store.profiles.push({
      id: "auth-9",
      organisation_id: "org-1",
      full_name: "Rajesh Menon",
      email: "rajesh.menon@myschool.edu.in",
      role: "parent",
      username: "rajesh.menon",
    });

    const result = await provisionPortalAccount({
      subject: "staff",
      recordId: "staff-row-9",
      organisationId: "org-1",
      email: "rajesh.menon@myschool.edu.in",
      name: "Impostor",
      role: "admin",
      birthDate: "2015-03-01",
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("email_taken");
    expect(result.authUserId).toBe("");

    // Nothing at all was written to the account that was already there.
    expect(store.profileWrites).toHaveLength(0);
    const row = store.profiles.find(profile => profile.id === "auth-9");
    expect(row?.role).toBe("parent");
    expect(row?.full_name).toBe("Rajesh Menon");
  });

  it("refuses a pupil's record being put on somebody else's account", async () => {
    store.authUsers.push({
      id: "auth-9",
      email: "rajesh.menon@myschool.edu.in",
    });
    store.profiles.push({
      id: "auth-9",
      organisation_id: "org-1",
      full_name: "Rajesh Menon",
      email: "rajesh.menon@myschool.edu.in",
      role: "staff",
      username: "rajesh.menon",
    });

    const result = await provisionPortalAccount({
      subject: "student",
      recordId: "student-9",
      organisationId: "org-1",
      email: "rajesh.menon@myschool.edu.in",
      name: "Impostor",
      role: "student",
      birthDate: "2005-08-29",
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("email_taken");
    expect(store.profileWrites).toHaveLength(0);
  });

  it("keeps a record's own account in step", async () => {
    store.authUsers.push({
      id: "auth-9",
      email: "rajesh.menon@myschool.edu.in",
    });
    store.profiles.push({
      id: "auth-9",
      organisation_id: "org-1",
      full_name: "Rajesh Menon",
      email: "rajesh.menon@myschool.edu.in",
      role: "staff",
      username: "rajesh.menon",
    });

    const result = await provisionPortalAccount({
      subject: "staff",
      recordId: "staff-row-9",
      organisationId: "org-1",
      email: "rajesh.menon@myschool.edu.in",
      name: "Rajesh Menon",
      role: "teacher",
      birthDate: "2015-03-01",
      existingAuthUserId: "auth-9",
    });

    expect(result.ok).toBe(true);
    expect(result.created).toBe(false);
    expect(result.authUserId).toBe("auth-9");
    const row = store.profiles.find(profile => profile.id === "auth-9");
    expect(row?.role).toBe("teacher");
  });

  it("finds a pupil's own account through the record it belongs to", async () => {
    /*
     * `profiles.student_id` is the link that says the account is this
     * pupil's, so the account is kept in step rather than refused.
     */
    store.authUsers.push({ id: "auth-3", email: "priya@example.com" });
    store.profiles.push({
      id: "auth-3",
      organisation_id: "org-1",
      full_name: "Priya Menon",
      email: "priya@example.com",
      role: "student",
      username: "priya.menon",
      student_id: "student-1",
    });

    const result = await provisionPortalAccount({
      subject: "student",
      recordId: "student-1",
      organisationId: "org-1",
      email: "priya@example.com",
      name: "Priya Menon",
      role: "student",
      birthDate: "2005-08-29",
    });

    expect(result.ok).toBe(true);
    expect(result.created).toBe(false);
    expect(result.authUserId).toBe("auth-3");
  });
});

describe("finding an account by address", () => {
  it("looks past the first page of accounts", async () => {
    /*
     * The school has well over a hundred accounts and the admin API pages at
     * two hundred, so somebody further down the list was simply not found —
     * and their record then looked as though it had no account at all.
     */
    const many = Array.from({ length: 250 }, (_, index) => ({
      id: `auth-${index + 1}`,
      email: `person-${index + 1}@myschool.edu.in`,
    }));
    store.authUsers = many;

    const result = await provisionPortalAccount({
      subject: "staff",
      recordId: "staff-row-250",
      organisationId: "org-1",
      email: "person-240@myschool.edu.in",
      name: "Person 240",
      birthDate: "2015-03-01",
      // The record's own account, further down the list.
      existingAuthUserId: "auth-240",
    });

    expect(result.ok).toBe(true);
    expect(result.authUserId).toBe("auth-240");
    // More than one page had to be read to find them.
    expect(store.authPages.length).toBeGreaterThan(1);
  });
});

/* ------------------------------------------------------------------ *
 * The name a pupil signs in with
 * ------------------------------------------------------------------ */

describe("changePortalCredentials — a pupil choosing a name of their own", () => {
  beforeEach(() => {
    store.settings.push({
      key: "portal_shared_username",
      value: "kaizxark@gmail.com",
    });
    store.profiles.push({
      id: "auth-1",
      organisation_id: "org-1",
      full_name: "Priya Menon",
      email: "priya@example.com",
      role: "student",
      username: "kaizxark@gmail.com",
      student_id: "student-1",
    });
    store.credentials.push({
      student_id: "student-1",
      username: "priya@example.com",
      email: "priya@example.com",
      password: "290805",
    });
  });

  it("writes the name on the profile", async () => {
    const result = await changePortalCredentials({
      authUserId: "auth-1",
      username: "priya.menon",
      password: null,
      email: "priya@example.com",
      studentId: "student-1",
      organisationId: "org-1",
    });

    expect(result.ok).toBe(true);
    const write = store.profileWrites.find(write => write.body.username);
    expect(write?.body.username).toBe("priya.menon");
  });

  it("marks the name as theirs, so the shared name stops reaching them", async () => {
    /*
     * The shared name is held once, for the whole school. A pupil who has
     * chosen a name of their own is no longer reached through it, and this is
     * what says so.
     */
    await changePortalCredentials({
      authUserId: "auth-1",
      username: "priya.menon",
      password: null,
      email: "priya@example.com",
      studentId: "student-1",
      organisationId: "org-1",
    });

    expect(store.credentialWrites).toHaveLength(1);
    expect(store.credentialWrites[0].body.username_chosen_at).toBeTruthy();
  });

  it("does not mark the shared name as claimed", async () => {
    // The shared name belongs to the school, not to the pupil who still has
    // it, so it must not be recorded as somebody's own.
    await changePortalCredentials({
      authUserId: "auth-1",
      username: "kaizxark@gmail.com",
      password: null,
      email: "priya@example.com",
      studentId: "student-1",
      organisationId: "org-1",
    });

    expect(store.credentialWrites[0].body.username_chosen_at).toBeUndefined();
  });

  it("keeps the school's own record of the password in step", async () => {
    // The owner reads this row on the credentials screen. A row left behind
    // would show them a password that no longer works.
    await changePortalCredentials({
      authUserId: "auth-1",
      username: null,
      password: "newpassword1",
      email: "priya@example.com",
      studentId: "student-1",
      organisationId: "org-1",
    });

    expect(store.passwordWrites).toEqual([
      { id: "auth-1", password: "newpassword1" },
    ]);
    expect(store.credentialWrites[0].body.password).toBe(PASSWORD_NOT_STORED);
  });

  it("accepts the shared name, which is an address and not a legal username", async () => {
    // An address holds an "@", which the username pattern refuses. A pupil
    // whose name is still the shared one has to be able to save the form.
    const result = await changePortalCredentials({
      authUserId: "auth-1",
      username: "kaizxark@gmail.com",
      password: null,
      email: "priya@example.com",
      studentId: "student-1",
      organisationId: "org-1",
    });

    expect(result.ok).toBe(true);
  });

  it("refuses a name that is not a username at all", async () => {
    const result = await changePortalCredentials({
      authUserId: "auth-1",
      username: "not a name!",
      password: null,
      email: "priya@example.com",
      studentId: "student-1",
      organisationId: "org-1",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_username");
    expect(store.profileWrites).toHaveLength(0);
  });
});

describe("resetPupilPasswords — every pupil back to their date of birth", () => {
  beforeEach(() => {
    store.profiles.push({
      id: "auth-1",
      student_id: "student-1",
      email: "priya@example.com",
    });
    store.students.push({
      id: "student-1",
      usn: "adm26270001",
      first_name: "Priya",
      last_name: "Menon",
      email: "priya@example.com",
      date_of_birth: "2005-08-29",
      organisation_id: "org-1",
    });
  });

  it("writes the date of birth to the account", async () => {
    const result = await resetPupilPasswords("org-1");

    expect(result.reset).toBe(1);
    expect(result.skipped).toBe(0);
    expect(store.passwordWrites).toEqual([
      { id: "auth-1", password: "290805" },
    ]);
  });

  it("writes the same password to the school's own record", async () => {
    await resetPupilPasswords("org-1");
    expect(store.credentialWrites[0].body.password).toBe(PASSWORD_NOT_STORED);
  });

  it("creates that record when the pupil has none", async () => {
    store.credentials.length = 0;
    const result = await resetPupilPasswords("org-1");
    expect(result.reset).toBe(1);
    expect(store.credentialWrites[0].body.password).toBe(PASSWORD_NOT_STORED);
  });

  it("leaves a pupil with no date of birth alone, and says so", async () => {
    store.students[0].date_of_birth = "";
    const result = await resetPupilPasswords("org-1");

    expect(result.reset).toBe(0);
    expect(result.skipped).toBe(1);
    expect(store.passwordWrites).toHaveLength(0);
  });

  it("leaves a pupil with no account alone", async () => {
    store.profiles.length = 0;
    const result = await resetPupilPasswords("org-1");

    expect(result.reset).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

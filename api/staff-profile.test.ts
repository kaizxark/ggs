import { afterEach, beforeEach, describe, expect, it } from "vitest";
import handler from "./staff-profile";

/**
 * The staff profile.
 *
 * Three things are checked here.
 *
 * The first is that the record can be read at all. The route originally asked
 * PostgREST for `staff.full_name`, a column the table does not have; the query
 * came back 42703, the route reported "not found", and every member of staff
 * opened as an unavailable record while their row sat in the database. The
 * fixture below deliberately has no `full_name`, so a select that asks for one
 * fails here the same way it failed in production.
 *
 * The second is who may read what. A colleague may read a name, a department
 * and what somebody teaches; only an administrator may read another person's
 * sign-in details or the history of changes to their record.
 *
 * The third is that the stored temporary password never leaves the route. The
 * credential row exists so the school can tell a person their username, not so
 * a directory drawer can display the password.
 */

const realFetch = globalThis.fetch;

const ORG_ID = "org-1";
const OTHER_ORG_ID = "org-2";
const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const STAFF_ID = "22222222-2222-2222-2222-222222222222";
const TEACHER_PROFILE_ID = "33333333-3333-3333-3333-333333333333";
const CLASSROOM_ID = "44444444-4444-4444-4444-444444444444";
const TEMP_PASSWORD = "s3cret-temporary";

interface Store {
  profiles: Record<string, unknown>[];
  staff: Record<string, unknown>[];
  classrooms: Record<string, unknown>[];
  credentials: Record<string, unknown>[];
  audit: Record<string, unknown>[];
  callerRole: string;
}

let store: Store;

function emptyStore(): Store {
  return {
    profiles: [],
    staff: [],
    classrooms: [],
    credentials: [],
    audit: [],
    callerRole: "admin",
  };
}

/** The value of a PostgREST filter, for `eq.` and `in.(a,b)` alike. */
function filterValues(url: URL, column: string): string[] | null {
  const raw = url.searchParams.get(column);
  if (!raw) return null;
  if (raw.startsWith("eq.")) return [raw.slice(3)];
  if (raw.startsWith("in.(")) {
    return raw
      .slice(4, -1)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
}

function stubNetwork() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));

    if (url.pathname.includes("/auth/v1/user")) {
      return Response.json({ id: CALLER_ID, email: "head@school.test" });
    }

    const table = url.pathname.split("/rest/v1/")[1] ?? "";
    if (!table) return Response.json([]);

    if (table === "profiles") {
      const ids = filterValues(url, "id");
      const rows = store.profiles.filter((profile) => {
        if (!ids || !ids.length) return true;
        return ids.includes(String(profile.id));
      });
      // A real caller's own row carries the role the route resolves.
      if (rows.length && ids?.[0] === CALLER_ID) {
        rows[0] = { ...rows[0], role: store.callerRole };
      }
      return Response.json(rows);
    }

    if (table === "staff") {
      const ids = filterValues(url, "id");
      const org = filterValues(url, "organisation_id");
      return Response.json(
        store.staff.filter(
          (person) =>
            (!ids || ids.includes(String(person.id))) &&
            (!org || org.includes(String(person.organisation_id)))
        )
      );
    }

    if (table === "classrooms") {
      const ids = filterValues(url, "id");
      const teacher = filterValues(url, "class_teacher_id");
      return Response.json(
        store.classrooms.filter(
          (klass) =>
            (!ids || ids.includes(String(klass.id))) &&
            (!teacher || teacher.includes(String(klass.class_teacher_id)))
        )
      );
    }

    if (table === "staff_credentials") {
      const ids = filterValues(url, "staff_id");
      return Response.json(
        store.credentials.filter(
          (credential) => !ids || ids.includes(String(credential.staff_id))
        )
      );
    }

    if (table === "audit_logs") {
      const ids = filterValues(url, "entity_id");
      return Response.json(
        store.audit.filter((entry) => !ids || ids.includes(String(entry.entity_id)))
      );
    }

    // subjects and subject_teachers are empty in this fixture: this school has
    // no subject assignments, which is a real state and must not read as an
    // error.
    return Response.json([]);
  }) as typeof fetch;
}

function request(staffId: string, token = "test-token") {
  return handler(
    new Request(`https://erp.test/api/staff-profile?id=${staffId}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  );
}

beforeEach(() => {
  store = emptyStore();
  store.profiles.push({
    id: CALLER_ID,
    organisation_id: ORG_ID,
    full_name: "Head Teacher",
    email: "head@school.test",
  });
  store.staff.push({
    id: STAFF_ID,
    organisation_id: ORG_ID,
    name: "Anita Kulkarni",
    email: "anita.kulkarni@school.test",
    phone: "9845012345",
    designation: "Mathematics Teacher",
    department: "Mathematics",
    usn: "STF1003",
    joined_on: "2022-06-01",
    active: true,
    profile_id: TEACHER_PROFILE_ID,
  });
  store.profiles.push({
    id: TEACHER_PROFILE_ID,
    organisation_id: ORG_ID,
    full_name: "Anita Kulkarni",
    email: "anita.kulkarni@school.test",
    role: "teacher",
    username: "anita.kulkarni",
    avatar_url:
      "https://example.supabase.co/storage/v1/object/public/school-assets/staff-avatars/anita.jpg",
  });
  store.classrooms.push({
    id: CLASSROOM_ID,
    organisation_id: ORG_ID,
    grade: "6",
    section: "A",
    room: "R-101",
    class_teacher_id: STAFF_ID,
  });
  store.credentials.push({
    staff_id: STAFF_ID,
    organisation_id: ORG_ID,
    username: "anita.kulkarni",
    password: TEMP_PASSWORD,
    email: "anita.kulkarni@school.test",
    must_set_password: true,
    issued_at: "2026-10-01T09:00:00+00:00",
    username_chosen_at: null,
    last_rotated_at: null,
    revoked_at: null,
  });
  store.audit.push({
    action: "staff.update",
    actor_id: CALLER_ID,
    entity_type: "staff",
    entity_id: STAFF_ID,
    created_at: "2026-10-02T09:00:00+00:00",
  });
  stubNetwork();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

/* ------------------------------------------------------------------ */

describe("GET /api/staff-profile", () => {
  it("refuses a request with no session", async () => {
    const res = await request(STAFF_ID, "");
    expect(res.status).toBe(401);
  });

  it("returns the record, which is the regression this route was written for", async () => {
    // The staff fixture has no `full_name`, like the real table.
    const res = await request(STAFF_ID);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.staff.name).toBe("Anita Kulkarni");
    expect(body.staff.designation).toBe("Mathematics Teacher");
    expect(body.staff.usn).toBe("STF1003");
    expect(body.staff.photo_url).toBe(
      "https://example.supabase.co/storage/v1/object/public/school-assets/staff-avatars/anita.jpg"
    );
  });

  it("gives an administrator every section", async () => {
    const res = await request(STAFF_ID);
    const body = (await res.json()) as Record<string, any>;

    expect(body.sections).toEqual([
      "personal",
      "employment",
      "teaching",
      "account",
      "activity",
    ]);
    expect(body.viewer.is_manager).toBe(true);
    expect(body.withheld).toEqual([]);
  });

  it("names the class a teacher is responsible for", async () => {
    const res = await request(STAFF_ID);
    const body = (await res.json()) as Record<string, any>;

    expect(body.teaching.class_teacher_of).toHaveLength(1);
    expect(body.teaching.class_teacher_of[0]).toMatchObject({
      grade: "6",
      section: "A",
      room: "R-101",
    });
    // No subject assignments here, and an empty list is the honest answer.
    expect(body.teaching.subjects).toEqual([]);
  });

  it("resolves who made each recorded change", async () => {
    const res = await request(STAFF_ID);
    const body = (await res.json()) as Record<string, any>;

    expect(body.activity).toHaveLength(1);
    expect(body.activity[0].action).toBe("staff.update");
    expect(body.activity[0].actor_name).toBe("Head Teacher");
  });

  it("never sends the stored password", async () => {
    const res = await request(STAFF_ID);
    const text = await res.text();

    expect(text).not.toContain(TEMP_PASSWORD);
    // `must_set_password` is not a password; a `"password"` key would be.
    expect(text).not.toMatch(/"password"\s*:/);
    // The username is the thing an administrator needs to read out.
    expect(text).toContain("anita.kulkarni");
  });

  it("withholds a colleague's sign-in details and history from a teacher", async () => {
    store.callerRole = "teacher";
    const res = await request(STAFF_ID);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, any>;
    expect(body.sections).toEqual(["personal", "employment", "teaching"]);
    expect(body.account).toBeUndefined();
    expect(body.activity).toBeUndefined();
    expect(body.withheld.map((entry: { section: string }) => entry.section)).toEqual([
      "account",
      "activity",
    ]);
  });

  it("shows a teacher their own sign-in details", async () => {
    store.callerRole = "teacher";
    store.staff[0].profile_id = CALLER_ID;
    const res = await request(STAFF_ID);

    const body = (await res.json()) as Record<string, any>;
    expect(body.viewer.is_self).toBe(true);
    expect(body.sections).toContain("account");
    // Their own record, but not the audit trail of it.
    expect(body.sections).not.toContain("activity");
    expect(body.account.username).toBe("anita.kulkarni");
  });

  it("does not confirm that a record exists in another school", async () => {
    store.staff[0].organisation_id = OTHER_ORG_ID;
    const res = await request(STAFF_ID);
    expect(res.status).toBe(404);
  });

  it("refuses a role that cannot open the directory", async () => {
    store.callerRole = "parent";
    const res = await request(STAFF_ID);
    expect(res.status).toBe(403);
  });
});

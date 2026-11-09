import { afterEach, beforeEach, describe, expect, it } from "vitest";
import handler from "./attendance";

/**
 * The attendance route.
 *
 * The rule this file protects is the one the old screen got wrong: attendance
 * is taken by the class teacher of a class, not by whoever is signed in. An
 * administrator or the super admin may review a register, but a POST from them
 * is refused. A teacher who is not the assigned class teacher is refused too,
 * even though the browser could easily hide the button.
 *
 * The rest of the file checks that a register is honest: a pupil with no row
 * for the day is unmarked rather than assumed present, a partial register is
 * rejected, and a date in the future cannot be marked.
 */

const realFetch = globalThis.fetch;

const ORG_ID = "org-1";
const CALLER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_PROFILE_ID = "22222222-2222-2222-2222-222222222222";
const STAFF_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_STAFF_ID = "44444444-4444-4444-4444-444444444444";
const CLASSROOM_ID = "55555555-5555-5555-5555-555555555555";
const OTHER_CLASSROOM_ID = "66666666-6666-6666-6666-666666666666";
const STUDENT_1 = "77777777-7777-7777-7777-777777777777";
const STUDENT_2 = "88888888-8888-8888-8888-888888888888";

interface Write {
  table: string;
  body: unknown;
}

interface Store {
  staff: Record<string, unknown>[];
  classrooms: Record<string, unknown>[];
  enrollments: Record<string, unknown>[];
  students: Record<string, unknown>[];
  attendance: Record<string, unknown>[];
  writes: Write[];
  callerRole: string;
}

let store: Store;

function emptyStore(): Store {
  return {
    staff: [],
    classrooms: [],
    enrollments: [],
    students: [],
    attendance: [],
    writes: [],
    callerRole: "staff",
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
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));

    if (url.pathname.includes("/auth/v1/user")) {
      return Response.json({ id: CALLER_ID, email: "teacher@school.test" });
    }

    const table = url.pathname.split("/rest/v1/")[1] ?? "";
    if (!table) return Response.json([]);

    const method = String(init?.method ?? "GET").toUpperCase();
    if (method === "POST") {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      store.writes.push({ table, body });
      return Response.json(Array.isArray(body) ? body : [body]);
    }

    if (table === "profiles") {
      // `resolveCaller` asks for `select=id,role`, the route asks for
      // `select=organisation_id`. One row answers both.
      return Response.json([
        { id: CALLER_ID, organisation_id: ORG_ID, role: store.callerRole },
      ]);
    }

    if (table === "staff") return Response.json(store.staff);

    if (table === "classrooms") return Response.json(store.classrooms);

    if (table === "enrollments") {
      const classes = filterValues(url, "classroom_id");
      return Response.json(
        store.enrollments.filter(
          (enrollment) =>
            !classes || classes.includes(String(enrollment.classroom_id))
        )
      );
    }

    if (table === "students") {
      const ids = filterValues(url, "id");
      return Response.json(
        store.students.filter((student) => !ids || ids.includes(String(student.id)))
      );
    }

    if (table === "attendance") {
      const students = filterValues(url, "student_id");
      const dates = filterValues(url, "attendance_date");
      const classes = filterValues(url, "classroom_id");
      return Response.json(
        store.attendance.filter(
          (row) =>
            (!students || students.includes(String(row.student_id))) &&
            (!dates || dates.includes(String(row.attendance_date))) &&
            (!classes || classes.includes(String(row.classroom_id)))
        )
      );
    }

    return Response.json([]);
  }) as typeof fetch;
}

function get(query = "") {
  return handler(
    new Request(`https://erp.test/api/attendance${query}`, {
      headers: { authorization: "Bearer test-token" },
    })
  );
}

function post(body: unknown) {
  return handler(
    new Request("https://erp.test/api/attendance", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  store = emptyStore();

  store.staff.push(
    {
      id: STAFF_ID,
      organisation_id: ORG_ID,
      name: "Anita Kulkarni",
      profile_id: CALLER_ID,
      active: true,
    },
    {
      id: OTHER_STAFF_ID,
      organisation_id: ORG_ID,
      name: "Suresh Prabhu",
      profile_id: OTHER_PROFILE_ID,
      active: true,
    }
  );

  store.classrooms.push(
    {
      id: CLASSROOM_ID,
      organisation_id: ORG_ID,
      grade: "6",
      section: "A",
      room: "R-101",
      class_teacher_id: STAFF_ID,
    },
    {
      id: OTHER_CLASSROOM_ID,
      organisation_id: ORG_ID,
      grade: "7",
      section: "A",
      room: "R-102",
      class_teacher_id: OTHER_STAFF_ID,
    }
  );

  store.enrollments.push(
    {
      student_id: STUDENT_1,
      classroom_id: CLASSROOM_ID,
      roll_no: "1",
      active: true,
    },
    {
      student_id: STUDENT_2,
      classroom_id: CLASSROOM_ID,
      roll_no: "2",
      active: true,
    }
  );

  store.students.push(
    { id: STUDENT_1, first_name: "Aarav", last_name: "Iyengar", usn: "GGS2026001" },
    { id: STUDENT_2, first_name: "Diya", last_name: "Rao", usn: "GGS2026002" }
  );

  stubNetwork();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("who may mark", () => {
  it("refuses a manager's save and says why", async () => {
    store.callerRole = "admin";

    const response = await post({
      classroomId: CLASSROOM_ID,
      date: "2026-01-15",
      items: [
        { studentId: STUDENT_1, status: "present" },
        { studentId: STUDENT_2, status: "present" },
      ],
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("manager_read_only");
    expect(store.writes).toHaveLength(0);
  });

  it("refuses a teacher who is not the class teacher", async () => {
    // The signed-in teacher is linked to the *other* class.
    store.staff = store.staff.map((member) =>
      member.id === STAFF_ID
        ? { ...member, profile_id: OTHER_PROFILE_ID }
        : { ...member, profile_id: CALLER_ID }
    );

    const response = await post({
      classroomId: CLASSROOM_ID,
      date: "2026-01-15",
      items: [
        { studentId: STUDENT_1, status: "present" },
        { studentId: STUDENT_2, status: "present" },
      ],
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("not_class_teacher");
    expect(store.writes).toHaveLength(0);
  });

  it("saves a complete register from the class teacher", async () => {
    const response = await post({
      classroomId: CLASSROOM_ID,
      date: "2026-01-15",
      items: [
        { studentId: STUDENT_1, status: "present" },
        { studentId: STUDENT_2, status: "late" },
      ],
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.summary).toMatchObject({
      present: 1,
      late: 1,
      marked: 2,
      percent: 100,
    });

    const write = store.writes.find((entry) => entry.table === "attendance");
    expect(write).toBeTruthy();
    const rows = write?.body as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      organisation_id: ORG_ID,
      classroom_id: CLASSROOM_ID,
      attendance_date: "2026-01-15",
      recorded_by: CALLER_ID,
    });
  });

  it("refuses a partial register", async () => {
    const response = await post({
      classroomId: CLASSROOM_ID,
      date: "2026-01-15",
      items: [{ studentId: STUDENT_1, status: "present" }],
    });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe("incomplete_register");
    expect(body.missing).toBe(1);
    expect(store.writes).toHaveLength(0);
  });

  it("refuses a future date", async () => {
    const response = await post({
      classroomId: CLASSROOM_ID,
      date: "2999-01-01",
      items: [
        { studentId: STUDENT_1, status: "present" },
        { studentId: STUDENT_2, status: "present" },
      ],
    });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe("future_date");
    expect(store.writes).toHaveLength(0);
  });
});

describe("what the register shows", () => {
  it("gives a class teacher their own class and leaves pupils unmarked", async () => {
    const response = await get("?date=2026-01-15");
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.managerView).toBe(false);
    expect(body.canMarkAny).toBe(true);
    expect(body.classes).toHaveLength(1);
    expect(body.classes[0].id).toBe(CLASSROOM_ID);
    expect(body.classes[0].canMark).toBe(true);
    expect(body.roster).toHaveLength(2);
    expect(body.roster.every((pupil: { status: unknown }) => pupil.status === null)).toBe(
      true
    );
  });

  it("shows a manager every class read-only", async () => {
    store.callerRole = "admin";

    const response = await get("?date=2026-01-15");
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.managerView).toBe(true);
    expect(body.canMarkAny).toBe(false);
    expect(body.classes).toHaveLength(2);
    expect(
      body.classes.every((option: { canMark: boolean }) => option.canMark === false)
    ).toBe(true);
  });

  it("returns the saved mark and the term figure for the pupil", async () => {
    store.attendance.push({
      id: "attendance-1",
      student_id: STUDENT_1,
      classroom_id: CLASSROOM_ID,
      attendance_date: "2026-01-15",
      status: "present",
      notes: "On time",
    });

    const response = await get("?date=2026-01-15");
    const body = await response.json();
    const pupil = body.roster.find(
      (row: { id: string }) => row.id === STUDENT_1
    );

    expect(pupil.status).toBe("present");
    expect(pupil.notes).toBe("On time");
    expect(pupil.termTotal).toBe(1);
    expect(pupil.termPercent).toBe(100);
  });

  it("tells a teacher with no class that they cannot take attendance", async () => {
    // The signed-in teacher has a staff record, but no classroom points at it.
    store.staff = store.staff.map((member) =>
      member.id === STAFF_ID
        ? { ...member, profile_id: OTHER_PROFILE_ID }
        : member
    );
    store.staff.push({
      id: "99999999-9999-9999-9999-999999999999",
      organisation_id: ORG_ID,
      name: "Farida Sheikh",
      profile_id: CALLER_ID,
      active: true,
    });

    const response = await get();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.classes).toHaveLength(0);
    expect(body.canMarkAny).toBe(false);
    expect(body.message).toContain("not the class teacher of any class");
  });
});

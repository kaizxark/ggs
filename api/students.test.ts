import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./students";

/**
 * The directory route's job is to apply the permissions in `shared/student-access`
 * before anything is fetched, and to keep the service-key queries scoped to one
 * organisation.
 *
 * Both are testable here without a database, because the route talks to
 * PostgREST over `fetch` and the whole conversation can be intercepted. The
 * assertions that matter are the negative ones: a parent must not receive the
 * roll call, a teacher must not receive fee figures, and no query may leave the
 * caller's organisation.
 */

const REAL_FETCH = globalThis.fetch;

const ORG = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const OTHER_ORG = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const TEACHER = "22222222-2222-4222-8222-222222222222";
const PARENT = "33333333-3333-4333-8333-333333333333";

const STUDENT_1 = "44444444-4444-4444-8444-444444444444";
const STUDENT_2 = "55555555-5555-4555-8555-555555555555";

interface Row {
  [key: string]: unknown;
}

let callerId = ADMIN;
let callerRole = "admin";
let callerOrg = ORG;
let restCalls: string[] = [];
let students: Row[] = [];
let written: Row[] = [];
let patched: Array<{ url: string; body: Row }> = [];

function student(
  id: string,
  first: string,
  last: string,
  extra: Row = {}
): Row {
  return {
    id,
    organisation_id: ORG,
    usn: `adm2627${id.slice(0, 4)}`,
    first_name: first,
    last_name: last,
    status: "active",
    joined_on: "2026-04-01",
    address: {},
    ...extra,
  };
}

function makeFetch() {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    const method = String(init?.method ?? "GET").toUpperCase();
    restCalls.push(`${method} ${href}`);

    if (href.includes("/auth/v1/user")) {
      return Response.json({ id: callerId, email: "user@gks.edu" });
    }

    if (href.includes("/rest/v1/profiles")) {
      if (href.includes("student_id=eq.")) return Response.json([]);
      return Response.json([
        { id: callerId, role: callerRole, organisation_id: callerOrg },
      ]);
    }

    if (href.includes("/rest/v1/students")) {
      if (method === "POST") {
        written.push(JSON.parse(String(init?.body ?? "{}")));
        return Response.json([
          { ...written[written.length - 1], id: STUDENT_1 },
        ]);
      }
      if (method === "PATCH") {
        patched.push({
          url: href,
          body: JSON.parse(String(init?.body ?? "{}")),
        });
        // Tenant-aware: a PATCH for a pupil outside the organisation the route
        // filtered on returns nothing, exactly as PostgREST would.
        if (href.includes(`organisation_id=eq.${ORG}`)) {
          return Response.json([
            { id: STUDENT_1, ...patched[patched.length - 1].body },
          ]);
        }
        return Response.json([]);
      }
      if (href.includes("usn=ilike.")) {
        /*
         * The admission-number generator asks for the highest number in use,
         * so the answer depends on the ordering in the query: with one, the
         * database hands back the highest row; without one, it hands back
         * whichever row it reaches first, which is the lowest.
         */
        const rows = href.includes("order=usn.desc")
          ? [...students].sort((a, b) =>
              String(b.usn ?? "").localeCompare(
                String(a.usn ?? "")
              )
            )
          : students;
        return Response.json(rows.slice(0, 1));
      }
      if (href.includes("select=id&")) {
        // The "does this pupil exist in this org" existence probe. Honouring the
        // organisation filter here is what makes the cross-tenant test meaningful.
        if (!href.includes(`organisation_id=eq.${ORG}`))
          return Response.json([]);
        return Response.json(students.slice(0, 1).map(s => ({ id: s.id })));
      }
      if (!href.includes(`organisation_id=eq.${ORG}`)) return Response.json([]);
      return Response.json(students);
    }

    if (href.includes("/rest/v1/enrollments")) {
      return Response.json([
        {
          id: "e1",
          student_id: STUDENT_1,
          classroom_id: "c1",
          academic_year_id: "y1",
          roll_no: "7",
          active: true,
          enrolled_on: "2026-04-01",
        },
      ]);
    }
    if (href.includes("/rest/v1/classrooms")) {
      return Response.json([
        { id: "c1", grade: "Grade 5", section: "A", room: "R-1" },
      ]);
    }
    if (href.includes("/rest/v1/academic_years")) {
      return Response.json([{ id: "y1", name: "2026-27", is_current: true }]);
    }
    if (href.includes("/rest/v1/attendance")) {
      return Response.json([
        { student_id: STUDENT_1, status: "present" },
        { student_id: STUDENT_1, status: "absent" },
      ]);
    }
    if (href.includes("/rest/v1/examinations")) {
      return Response.json([{ id: "x1", name: "Term 1", published: true }]);
    }
    if (href.includes("/rest/v1/exam_results")) {
      return Response.json([
        {
          student_id: STUDENT_1,
          examination_id: "x1",
          subject: "Maths",
          marks: 80,
          max_marks: 100,
          grade: "A",
        },
      ]);
    }
    if (href.includes("/rest/v1/invoices")) {
      return Response.json([
        {
          student_id: STUDENT_1,
          invoice_no: "INV-1",
          total: 100,
          paid_amount: 40,
          due_on: "2026-01-01",
          status: "pending",
        },
      ]);
    }
    if (href.includes("/rest/v1/student_guardians")) {
      return Response.json([]);
    }
    if (href.includes("/rest/v1/staff")) return Response.json([]);
    if (href.includes("/rest/v1/audit_logs")) {
      return Response.json([]);
    }

    return Response.json([]);
  }) as unknown as typeof fetch;
}

function req(url: string, init: RequestInit = {}): Request {
  return new Request(`https://erp.test${url}`, {
    ...init,
    headers: { authorization: "Bearer test-token", ...(init.headers ?? {}) },
  });
}

describe("GET /api/students — authentication and directory access", () => {
  beforeEach(() => {
    callerId = ADMIN;
    callerRole = "admin";
    callerOrg = ORG;
    restCalls = [];
    students = [
      student(STUDENT_1, "Ananya", "Sharma"),
      student(STUDENT_2, "Bhuvan", "Kumar"),
    ];
    written = [];
    patched = [];
    globalThis.fetch = makeFetch();
  });

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it("refuses an unauthenticated request", async () => {
    const res = await handler(new Request("https://erp.test/api/students"));
    expect(res.status).toBe(401);
  });

  it("refuses a parent the whole directory", async () => {
    callerId = PARENT;
    callerRole = "parent";
    const res = await handler(req("/api/students"));
    // The failure this prevents: a parent reading every child's USN.
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("forbidden");
  });

  it("refuses a pupil the whole directory", async () => {
    callerId = PARENT;
    callerRole = "student";
    expect((await handler(req("/api/students"))).status).toBe(403);
  });

  it("returns the roll call to an administrator", async () => {
    const res = await handler(req("/api/students"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { students: Row[]; total: number };
    expect(body.total).toBe(2);
    // Sorted by last name ascending, which is the default the UI requests.
    expect(body.students.map(s => s.name)).toEqual([
      "Bhuvan Kumar",
      "Ananya Sharma",
    ]);
  });

  it("keeps every database query inside the caller's organisation", async () => {
    await handler(req("/api/students"));
    const studentQueries = restCalls.filter(c =>
      c.includes("/rest/v1/students?")
    );
    expect(studentQueries.length).toBeGreaterThan(0);
    for (const call of studentQueries) {
      // The service key bypasses RLS, so the organisation filter is the only thing
      // standing between this route and another school's roll call.
      expect(call, call).toContain(`organisation_id=eq.${ORG}`);
    }
  });

  it("withholds fee figures from a teacher at the route, not just the UI", async () => {
    callerId = TEACHER;
    callerRole = "teacher";
    const res = await handler(req("/api/students"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { students: Row[] };
    // The fixtures attach attendance and marks to STUDENT_1 specifically.
    const row = body.students.find(s => s.id === STUDENT_1)!;
    expect(row.attendance_percentage).toBe(50);
    expect(row.academic_average).toBe(80);
    // Absent rather than zeroed: the route must not pretend the figure is nil.
    expect(row.fees).toBeNull();
    expect(row.outstanding_fees).toBeUndefined();
  });

  it("gives fee figures to the accounts desk", async () => {
    callerId = TEACHER;
    callerRole = "accountant";
    const res = await handler(req("/api/students"));
    const body = (await res.json()) as { students: Row[] };
    const row = body.students.find(s => s.id === STUDENT_1)!;
    expect(row.fees).toBe("Overdue");
    expect(row.outstanding_fees).toBe(60);
  });

  it("withholds contact details from a teacher", async () => {
    callerId = TEACHER;
    callerRole = "teacher";
    students = [
      student(STUDENT_1, "A", "B", {
        phone: "999",
        guardian_phone: "888",
        address: { city: "Tumakuru" },
      }),
    ];
    const res = await handler(req("/api/students"));
    const body = (await res.json()) as { students: Row[] };
    expect(body.students[0].phone).toBeUndefined();
    expect(body.students[0].address).toBeUndefined();
  });

  it("gives contact details to an administrator", async () => {
    students = [
      student(STUDENT_1, "A", "B", {
        phone: "999",
        address: { city: "Tumakuru" },
      }),
    ];
    const res = await handler(req("/api/students"));
    const body = (await res.json()) as { students: Row[] };
    expect(body.students[0].phone).toBe("999");
    expect(body.students[0].address).toEqual({ city: "Tumakuru" });
  });

  it("treats leave as attendance credit, not an absence", async () => {
    students = [student(STUDENT_1, "A", "B")];
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.includes("/auth/v1/user"))
        return Response.json({ id: callerId });
      if (href.includes("/rest/v1/profiles"))
        return Response.json([
          { id: callerId, role: callerRole, organisation_id: ORG },
        ]);
      if (href.includes("/rest/v1/attendance")) {
        return Response.json([
          { student_id: STUDENT_1, status: "present" },
          { student_id: STUDENT_1, status: "leave" },
        ]);
      }
      if (href.includes("/rest/v1/students?select=id&"))
        return Response.json([]);
      if (href.includes("/rest/v1/students")) return Response.json(students);
      return Response.json([]);
    }) as unknown as typeof fetch;
    const res = await handler(req("/api/students"));
    const body = (await res.json()) as { students: Row[] };
    expect(body.students[0].attendance_percentage).toBe(100);
  });
});

describe("GET /api/students — pagination, sorting and search", () => {
  beforeEach(() => {
    callerId = ADMIN;
    callerRole = "admin";
    callerOrg = ORG;
    restCalls = [];
    written = [];
    patched = [];
    students = [];
    for (let i = 0; i < 60; i++) {
      students.push(
        student(
          `0000000${i}-4444-4444-8444-44444444444${i % 10}`,
          `Name${String(i).padStart(3, "0")}`,
          "Test"
        )
      );
    }
    globalThis.fetch = makeFetch();
  });

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it("returns only the requested page", async () => {
    const res = await handler(req("/api/students?page=2&pageSize=10"));
    const body = (await res.json()) as {
      students: Row[];
      page: number;
      pageSize: number;
      pageCount: number;
    };
    expect(body.students).toHaveLength(10);
    expect(body.page).toBe(2);
    expect(body.pageCount).toBe(6);
  });

  it("caps a page size a caller could use to ask for the whole school", async () => {
    const res = await handler(req("/api/students?pageSize=10000"));
    const body = (await res.json()) as { pageSize: number };
    expect(body.pageSize).toBe(200);
  });

  it("does not hand out a page beyond the end", async () => {
    const res = await handler(req("/api/students?page=99&pageSize=10"));
    const body = (await res.json()) as { students: Row[] };
    expect(body.students).toHaveLength(0);
  });

  it("ignores a sort column that is not in the allow-list", async () => {
    // `order` is spliced into the query string, so an arbitrary column would be an
    // injection point rather than a sort.
    await handler(req("/api/students?sort=first_name;drop%20table%20students"));
    for (const call of restCalls) {
      expect(call).not.toContain("drop table");
    }
  });

  it("sorts numerically inside a string column", async () => {
    const res = await handler(
      req("/api/students?sort=usn&direction=asc")
    );
    const body = (await res.json()) as { students: Row[] };
    const numbers = body.students.map(s =>
      Number(String(s.usn).slice(-1))
    );
    const sorted = [...numbers].sort((a, b) => a - b);
    expect(numbers).toEqual(sorted);
  });

  it("searches a USN without comparing it to the uuid column", async () => {
    await handler(req("/api/students?search=adm26270001"));
    const call = restCalls.find(entry => entry.includes("or="));
    expect(call).toBeTruthy();
    expect(decodeURIComponent(call!)).toContain("usn.ilike");
    expect(decodeURIComponent(call!)).not.toContain("id.eq.");

    restCalls = [];
    await handler(req(`/api/students?search=${STUDENT_1}`));
    const byId = restCalls.find(entry => entry.includes("or="));
    expect(decodeURIComponent(byId!)).toContain(`id.eq.${STUDENT_1}`);
  });

  it("never accepts a negative page", async () => {
    const res = await handler(req("/api/students?page=-5"));
    const body = (await res.json()) as { page: number };
    expect(body.page).toBe(1);
  });
});

describe("GET /api/students — export", () => {
  beforeEach(() => {
    callerId = ADMIN;
    callerRole = "admin";
    callerOrg = ORG;
    restCalls = [];
    written = [];
    patched = [];
    students = [
      student(STUDENT_1, "Ananya", "Sharma", { date_of_birth: "2014-05-06" }),
    ];
    globalThis.fetch = makeFetch();
  });

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it("sends a CSV attachment rather than JSON", async () => {
    const res = await handler(req("/api/students?export=1"));
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
  });

  it("omits a teacher's export of a pupil's date of birth", async () => {
    callerId = TEACHER;
    callerRole = "teacher";
    const res = await handler(req("/api/students?export=1"));
    const csv = await res.text();
    expect(csv).toContain("attendance_percentage");
    expect(csv).not.toContain("date_of_birth");
    expect(csv).not.toContain("2014-05-06");
  });

  it("neutralises a value that a spreadsheet would evaluate", async () => {
    students = [student(STUDENT_1, "=cmd|'/c calc'!A1", "Sharma")];
    const res = await handler(req("/api/students?export=1"));
    const csv = await res.text();
    // A leading = makes Excel treat the cell as a formula.
    expect(csv).not.toMatch(/,=cmd/);
    expect(csv).toContain("'=cmd");
  });

  it("does not export to a role that may not list students at all", async () => {
    callerId = PARENT;
    callerRole = "parent";
    expect((await handler(req("/api/students?export=1"))).status).toBe(403);
  });
});

describe("POST/PATCH/DELETE /api/students — writes", () => {
  beforeEach(() => {
    callerId = ADMIN;
    callerRole = "admin";
    callerOrg = ORG;
    restCalls = [];
    written = [];
    patched = [];
    students = [student(STUDENT_1, "Ananya", "Sharma")];
    globalThis.fetch = makeFetch();
  });

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it("refuses to create a pupil as a teacher", async () => {
    callerId = TEACHER;
    callerRole = "teacher";
    const res = await handler(
      req("/api/students", {
        method: "POST",
        body: JSON.stringify({ first_name: "X", last_name: "Y" }),
      })
    );
    expect(res.status).toBe(403);
    expect(written).toHaveLength(0);
  });

  it("reports a missing name as a field error, not a failure", async () => {
    const res = await handler(
      req("/api/students", {
        method: "POST",
        body: JSON.stringify({ first_name: "  " }),
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { fieldErrors: Record<string, string> };
    expect(body.fieldErrors.last_name).toBeTruthy();
  });

  it("hands out the USN after the highest one in use", async () => {
    /*
     * The roll call as the school has it. The number generator used to ask
     * for a single row with no ordering, so the database handed back the
     * lowest one and the number after it — 0002 — was already taken. The
     * insert was refused for being a duplicate and every enrolment came back
     * as "that USN is already in use".
     */
    students = [
      student("44444444-4444-4444-8444-000000000001", "Ananya", "Sharma", {
        usn: "GGS1001",
      }),
      student("55555555-5555-4555-8555-000000000100", "Bhuvan", "Kumar", {
        usn: "GGS1100",
      }),
    ];
    const res = await handler(
      req("/api/students", {
        method: "POST",
        body: JSON.stringify({
          first_name: "New",
          last_name: "Pupil",
          date_of_birth: "2012-04-01",
        }),
      })
    );
    expect(res.status).toBe(201);
    expect(written[0].usn).toBe("GGS1101");
  });

  it("rejects a status the table's own CHECK would refuse", async () => {
    const res = await handler(
      req("/api/students", {
        method: "POST",
        body: JSON.stringify({
          first_name: "A",
          last_name: "B",
          status: "expelled",
        }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects a date that is not a date", async () => {
    const res = await handler(
      req("/api/students", {
        method: "POST",
        body: JSON.stringify({
          first_name: "A",
          last_name: "B",
          date_of_birth: "yesterday",
        }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("strips control characters out of a written name", async () => {
    await handler(
      req("/api/students", {
        method: "POST",
        body: JSON.stringify({
          first_name: "Ananya \n Sharma",
          last_name: "B",
        }),
      })
    );
    // The newline is removed so it cannot break the PostgREST filter built from
    // this value later. trim() only strips the ends, so the interior spaces the
    // newline sat between legitimately remain.
    expect(written[0].first_name).not.toMatch(/[\u0000-\u001f]/);
    expect(written[0].first_name).toBe("Ananya  Sharma");
  });

  it("archives rather than deletes, so marks and fees survive", async () => {
    const res = await handler(
      req("/api/students", {
        method: "DELETE",
        body: JSON.stringify({ id: STUDENT_1 }),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { archived: boolean };
    expect(body.archived).toBe(true);
    expect(patched.some(p => p.body.status === "withdrawn")).toBe(true);
    // A DELETE must never reach the database.
    expect(restCalls.some(c => c.startsWith("DELETE"))).toBe(false);
  });

  it("writes an audit entry naming the actor on every change", async () => {
    await handler(
      req("/api/students", {
        method: "DELETE",
        body: JSON.stringify({ id: STUDENT_1 }),
      })
    );
    const audit = restCalls.find(c => c.includes("/rest/v1/audit_logs"));
    // Without this the change shows up in the audit history with a null actor,
    // because the service key means auth.uid() is null.
    expect(audit).toBeTruthy();
  });

  it("leaves a pupil's USN alone when it is submitted unchanged", async () => {
    students = [
      student(STUDENT_1, "Ananya", "Sharma", { usn: "adm26270001" }),
    ];
    const res = await handler(
      req("/api/students", {
        method: "PATCH",
        body: JSON.stringify({
          id: STUDENT_1,
          usn: "adm26270001",
          first_name: "Ananya",
        }),
      })
    );
    expect(res.status).toBe(200);
    expect(patched[0].body.usn).toBeUndefined();
    expect(patched[0].body.first_name).toBe("Ananya");
  });

  it("refuses to patch a pupil that is not in the caller's school", async () => {
    callerOrg = OTHER_ORG;
    const res = await handler(
      req("/api/students", {
        method: "PATCH",
        body: JSON.stringify({ id: STUDENT_1, first_name: "Hacked" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("refuses an unsupported method", async () => {
    expect(
      (await handler(req("/api/students", { method: "PUT" }))).status
    ).toBe(405);
  });
});

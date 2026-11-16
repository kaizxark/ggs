/**
 * Chairman / Managing Director Executive Wallboard API.
 *
 * Dedicated, ultra-fast aggregated endpoint for the institution Chairman's
 * wallboard TV display (/mdview).
 *
 * Provides real-time consolidated KPIs and class-by-class metrics for:
 * 1. Live Attendance (today / latest term day across all 24 classrooms)
 * 2. Live Fees & Revenue Collection (billed, collected, pending, defaulters, live stream)
 *
 * Credentials required: username 'admin', password 'admin123'.
 */

export const config = { runtime: "edge" };

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const ORG_ID = "2f6cbae9-ed79-45e3-819c-a8c80eee7a0f";
const MD_TOKEN = "md_chairman_authenticated_session";

function serviceHeaders(json = false): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function restRows<T = Record<string, unknown>>(
  table: string,
  query: string
): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: serviceHeaders(),
  });
  if (!res.ok) {
    throw new Error(`${table}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T[];
}

async function fetchAllRows<T = Record<string, unknown>>(
  table: string,
  cols: string,
  extraFilter = ""
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const query = `organisation_id=eq.${ORG_ID}&select=${cols}&limit=1000&offset=${offset}${extraFilter ? `&${extraFilter}` : ""}`;
    const rows = await restRows<T>(table, query);
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < 1000) break;
    offset += 1000;
  }
  return all;
}

// In-memory cache for 4 seconds to serve multi-TV setups instantaneously
let cachedData: unknown = null;
let cachedAt = 0;
const CACHE_TTL_MS = 4_000;

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const xMdAuth = req.headers.get("x-md-auth") ?? "";
  const cookieHeader = req.headers.get("cookie") ?? "";

  if (authHeader.includes(MD_TOKEN) || authHeader.includes("admin123")) return true;
  if (xMdAuth === "admin123" || xMdAuth === MD_TOKEN) return true;
  if (cookieHeader.includes(`md_token=${MD_TOKEN}`)) return true;

  const url = new URL(req.url, "http://localhost");
  const tokenParam = url.searchParams.get("token") || url.searchParams.get("auth");
  if (tokenParam === MD_TOKEN || tokenParam === "admin123") return true;

  return false;
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-MD-Auth",
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: { username?: string; password?: string; action?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "bad_request", message: "Invalid JSON" }, { status: 400 });
  }

  const u = String(body.username ?? "").trim().toLowerCase();
  const p = String(body.password ?? "").trim();

  if (u === "admin" && p === "admin123") {
    return Response.json(
      {
        ok: true,
        token: MD_TOKEN,
        role: "chairman",
        title: "Managing Director / Chairman",
        schoolName: "Global Kids School",
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Set-Cookie": `md_token=${MD_TOKEN}; Path=/; Max-Age=2592000; SameSite=Lax`,
        },
      }
    );
  }

  return Response.json(
    {
      error: "invalid_credentials",
      message: "Invalid username or password for Chairman Wallboard.",
    },
    { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return Response.json(
      {
        error: "unauthorized",
        message: "Sign in with Chairman credentials to view this wallboard.",
      },
      { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const now = Date.now();
  if (cachedData && now - cachedAt < CACHE_TTL_MS) {
    return Response.json(cachedData, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, must-revalidate",
        "X-Cache": "HIT",
      },
    });
  }

  try {
    // 1. Fetch classrooms, staff, students, enrollments
    const [classrooms, staff, students, enrollments] = await Promise.all([
      restRows<{ id: string; grade: string; section: string; room: string; class_teacher_id: string | null }>(
        "classrooms",
        `organisation_id=eq.${ORG_ID}&select=id,grade,section,room,class_teacher_id`
      ),
      restRows<{ id: string; name: string }>(
        "staff",
        `organisation_id=eq.${ORG_ID}&select=id,name`
      ),
      fetchAllRows<{ id: string; first_name: string; last_name: string; usn: string }>(
        "students",
        "id,first_name,last_name,usn"
      ),
      fetchAllRows<{ student_id: string; classroom_id: string }>(
        "enrollments",
        "student_id,classroom_id",
        "active=eq.true"
      ),
    ]);

    const staffMap = new Map(staff.map((s) => [s.id, s.name]));
    const studentMap = new Map(
      students.map((s) => [
        s.id,
        {
          name: `${s.first_name} ${s.last_name}`.trim(),
          usn: s.usn,
        },
      ])
    );

    // Map student to classroom
    const studentClassroom = new Map<string, string>();
    const classroomStudents = new Map<string, string[]>();
    for (const e of enrollments) {
      studentClassroom.set(e.student_id, e.classroom_id);
      const list = classroomStudents.get(e.classroom_id) ?? [];
      list.push(e.student_id);
      classroomStudents.set(e.classroom_id, list);
    }

    // 2. Fetch latest attendance
    const latestAttRow = await restRows<{ attendance_date: string }>(
      "attendance",
      `organisation_id=eq.${ORG_ID}&order=attendance_date.desc&limit=1&select=attendance_date`
    );
    const targetDate = latestAttRow[0]?.attendance_date || "2026-10-01";

    const attendanceRecords = await fetchAllRows<{
      student_id: string;
      status: "present" | "absent" | "late" | "leave";
    }>("attendance", "student_id,status", `attendance_date=eq.${targetDate}`);

    const attendanceByStudent = new Map(
      attendanceRecords.map((a) => [a.student_id, a.status])
    );

    // 3. Fetch Invoices and Payments
    const [invoices, payments] = await Promise.all([
      fetchAllRows<{
        id: string;
        invoice_no: string;
        student_id: string;
        total: number;
        paid_amount: number;
        status: string;
        due_on: string;
      }>("invoices", "id,invoice_no,student_id,total,paid_amount,status,due_on"),
      restRows<{
        id: string;
        invoice_id: string;
        amount: number;
        method: string;
        paid_at: string;
        receipt_no: string;
      }>(
        "payments",
        `organisation_id=eq.${ORG_ID}&order=paid_at.desc&limit=25&select=id,invoice_id,amount,method,paid_at,receipt_no`
      ),
    ]);

    // Student fees lookup
    const studentFees = new Map<
      string,
      { billed: number; paid: number; outstanding: number; overdue: number }
    >();
    let totalBilled = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let paidInvoicesCount = 0;
    let partialInvoicesCount = 0;
    let overdueInvoicesCount = 0;

    for (const inv of invoices) {
      const b = Number(inv.total) || 0;
      const p = Number(inv.paid_amount) || 0;
      const out = Math.max(0, b - p);
      const isOverdue = inv.status === "overdue" || (out > 0 && inv.due_on && inv.due_on < targetDate);

      totalBilled += b;
      totalCollected += p;
      totalOutstanding += out;
      if (isOverdue) totalOverdue += out;

      if (out === 0) paidInvoicesCount++;
      else if (p > 0) partialInvoicesCount++;
      else if (isOverdue) overdueInvoicesCount++;

      const cur = studentFees.get(inv.student_id) ?? {
        billed: 0,
        paid: 0,
        outstanding: 0,
        overdue: 0,
      };
      cur.billed += b;
      cur.paid += p;
      cur.outstanding += out;
      if (isOverdue) cur.overdue += out;
      studentFees.set(inv.student_id, cur);
    }

    // Sort classrooms logically: Grade 1..10, Section A..C
    const sortedClassrooms = [...classrooms].sort((a, b) => {
      const gA = parseInt(a.grade, 10) || 0;
      const gB = parseInt(b.grade, 10) || 0;
      if (gA !== gB) return gA - gB;
      return a.section.localeCompare(b.section);
    });

    // Compute class-by-class attendance & fees
    let totalStudentsPresent = 0;
    let totalStudentsLate = 0;
    let totalStudentsAbsent = 0;
    let totalStudentsLeave = 0;
    let classesReportedCount = 0;

    const classAttendanceMetrics = [];
    const classFeeMetrics = [];

    for (const cls of sortedClassrooms) {
      const studentIds = classroomStudents.get(cls.id) ?? [];
      const teacherName = cls.class_teacher_id
        ? staffMap.get(cls.class_teacher_id) || "Faculty Teacher"
        : "Unassigned";

      let pres = 0;
      let late = 0;
      let abs = 0;
      let leave = 0;
      const absentNames: string[] = [];

      let clsBilled = 0;
      let clsCollected = 0;
      let clsOutstanding = 0;
      let clsPaidPupils = 0;
      let clsPendingPupils = 0;

      for (const sId of studentIds) {
        const att = attendanceByStudent.get(sId);
        if (att === "present") pres++;
        else if (att === "late") late++;
        else if (att === "absent") {
          abs++;
          const stu = studentMap.get(sId);
          if (stu && absentNames.length < 6) absentNames.push(stu.name);
        } else if (att === "leave") leave++;

        const fee = studentFees.get(sId);
        if (fee) {
          clsBilled += fee.billed;
          clsCollected += fee.paid;
          clsOutstanding += fee.outstanding;
          if (fee.outstanding === 0) clsPaidPupils++;
          else clsPendingPupils++;
        }
      }

      totalStudentsPresent += pres;
      totalStudentsLate += late;
      totalStudentsAbsent += abs;
      totalStudentsLeave += leave;

      const totalMarked = pres + late + abs + leave;
      if (totalMarked > 0) classesReportedCount++;

      const attRate = studentIds.length > 0
        ? Math.round(((pres + late) / studentIds.length) * 1000) / 10
        : 0;

      const feeRate = clsBilled > 0
        ? Math.round((clsCollected / clsBilled) * 1000) / 10
        : 0;

      let attStatus: "high" | "average" | "low" = "high";
      if (attRate < 80) attStatus = "low";
      else if (attRate < 90) attStatus = "average";

      classAttendanceMetrics.push({
        id: cls.id,
        grade: cls.grade,
        section: cls.section,
        label: `Grade ${cls.grade}-${cls.section}`,
        room: cls.room,
        teacherName,
        enrolled: studentIds.length,
        present: pres,
        late,
        absent: abs,
        leave,
        rate: attRate,
        status: attStatus,
        absentees: absentNames,
      });

      classFeeMetrics.push({
        id: cls.id,
        grade: cls.grade,
        section: cls.section,
        label: `Grade ${cls.grade}-${cls.section}`,
        room: cls.room,
        teacherName,
        enrolled: studentIds.length,
        billed: clsBilled,
        collected: clsCollected,
        outstanding: clsOutstanding,
        rate: feeRate,
        paidStudents: clsPaidPupils,
        pendingStudents: clsPendingPupils,
      });
    }

    const totalEnrolled = students.length;
    const overallAttRate = totalEnrolled > 0
      ? Math.round(((totalStudentsPresent + totalStudentsLate) / totalEnrolled) * 1000) / 10
      : 0;

    const overallFeeRate = totalBilled > 0
      ? Math.round((totalCollected / totalBilled) * 1000) / 10
      : 0;

    // Recent payments stream with student name and grade
    const invoiceStudentMap = new Map(invoices.map((i) => [i.id, i.student_id]));
    const recentPaymentsStream = payments.map((p) => {
      const sId = invoiceStudentMap.get(p.invoice_id);
      const stu = sId ? studentMap.get(sId) : null;
      const cId = sId ? studentClassroom.get(sId) : null;
      const cls = cId ? classrooms.find((c) => c.id === cId) : null;
      return {
        id: p.id,
        receiptNo: p.receipt_no || "REC",
        studentName: stu?.name || "Student",
        usn: stu?.usn || "—",
        classLabel: cls ? `Grade ${cls.grade}-${cls.section}` : "Classroom",
        amount: Number(p.amount) || 0,
        method: p.method || "UPI",
        paidAt: p.paid_at,
      };
    });

    const responsePayload = {
      ok: true,
      timestamp: new Date().toISOString(),
      schoolName: "Global Kids School",
      academicYear: "2026-27",
      totalStudents: totalEnrolled,
      totalClassrooms: sortedClassrooms.length,
      attendance: {
        date: targetDate,
        overallRate: overallAttRate,
        presentCount: totalStudentsPresent,
        lateCount: totalStudentsLate,
        absentCount: totalStudentsAbsent,
        leaveCount: totalStudentsLeave,
        attendingCount: totalStudentsPresent + totalStudentsLate,
        classesReported: classesReportedCount,
        classesTotal: sortedClassrooms.length,
        classes: classAttendanceMetrics,
      },
      fees: {
        totalBilled,
        totalCollected,
        totalOutstanding,
        totalOverdue,
        collectionRate: overallFeeRate,
        paidInvoicesCount,
        partialInvoicesCount,
        overdueInvoicesCount,
        classes: classFeeMetrics,
        recentPayments: recentPaymentsStream,
      },
    };

    cachedData = responsePayload;
    cachedAt = now;

    return Response.json(responsePayload, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, must-revalidate",
        "X-Cache": "MISS",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("MD View API Error:", msg);
    return Response.json(
      { error: "server_error", message: msg },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return OPTIONS();
  if (req.method === "POST") return POST(req);
  if (req.method === "GET") return GET(req);
  return new Response("Method not allowed", { status: 405 });
}

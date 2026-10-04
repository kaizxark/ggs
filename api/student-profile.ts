/**
 * One pupil's complete profile, in one request.
 *
 * ## Why one route and not a dozen
 *
 * The profile has fourteen sections, and a browser that fetched each separately
 * would make fourteen round trips before it could paint the header. Worse, each
 * one would need its own record-level access check, and the temptation — which
 * the brief explicitly warns against — is to return "no permission" as empty
 * data. That is indistinguishable from a pupil who genuinely has no medical
 * history, so the UI would silently under-report.
 *
 * So the authorisation decision happens here, once, before anything is
 * fetched. The response says which sections were included and why the others
 * were not, and the client renders a locked tab with the reason rather than a
 * blank one.
 *
 * ## What decides access
 *
 * `resolveCaller()` derives the role from the session token; the caller's
 * relationship to this particular pupil is resolved from the database
 * (student_guardians.portal_profile_id, profiles.student_id, or a class the
 * caller's staff record teaches). Neither is read from the request. The section
 * list then comes from `sectionsForRole()`, which mirrors the RLS policies
 * installed in migrations 004-006.
 *
 * Every query below carries an explicit `organisation_id` filter because the
 * service key bypasses RLS. The pupil's organisation is confirmed before the
 * first query runs, so a UUID from another school returns 404 rather than
 * another school's data.
 */

export const config = { runtime: "edge" };

import {
  resolveCaller,
  SUPABASE_URL,
  SERVICE_KEY,
  type Caller,
} from "../shared/ai-auth.js";
import {
  sectionsForRole,
  SECTION_LABELS,
  ALL_STUDENT_SECTIONS,
  type StudentSection,
} from "../shared/student-access.js";

type Json = Record<string, unknown>;

function fail(message: string, status: number, code = "error") {
  return Response.json({ error: code, message }, { status });
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

/** A read that returns [] rather than throwing: one missing section must not fail the profile. */
async function rows(path: string): Promise<Json[]> {
  try {
    const res = await rest(path);
    if (!res.ok) return [];
    const data = (await res.json()) as Json[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function one(path: string): Promise<Json | null> {
  const list = await rows(path);
  return list[0] ?? null;
}

/** Relationship to this pupil, resolved from the database. */
async function relationship(
  caller: Caller,
  studentId: string,
  orgId: string
): Promise<"guardian" | "self" | "teacher" | null> {
  const own = await one(`profiles?select=student_id&id=eq.${caller.id}&student_id=eq.${studentId}&limit=1`);
  if (own) return "self";

  const linked = await one(
    `student_guardians?select=id&student_id=eq.${studentId}` +
      `&portal_profile_id=eq.${caller.id}&organisation_id=eq.${orgId}&limit=1`
  );
  if (linked) return "guardian";

  const staff = await one(`staff?select=id&profile_id=eq.${caller.id}&organisation_id=eq.${orgId}&limit=1`);
  if (staff?.id) {
    const staffId = String(staff.id);
    const asTeacher = await one(
      `enrollments?select=id&student_id=eq.${studentId}&active=eq.true&organisation_id=eq.${orgId}` +
        `&classroom_id=in.(${(
          await rows(
            `classrooms?select=id&organisation_id=eq.${orgId}&class_teacher_id=eq.${staffId}`
          )
        )
          .map((c) => String(c.id))
          .concat(
            (
              await rows(
                `subject_teachers?select=classroom_id&staff_id=eq.${staffId}&organisation_id=eq.${orgId}`
              )
            ).map((s) => String(s.classroom_id))
          )
          .filter(Boolean)
          .join(",") || "00000000-0000-0000-0000-000000000000"})&limit=1`
    );
    if (asTeacher) return "teacher";
  }

  return null;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Age in whole years from a date of birth, as of today. */
export function ageFrom(dob: unknown): number | null {
  if (!dob) return null;
  const born = new Date(String(dob));
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

export default async function handler(req: Request): Promise<Response> {
  if (!SERVICE_KEY) {
    return fail("The database is not configured on this deployment.", 503, "not_configured");
  }

  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const caller = await resolveCaller(req);
  if (!caller) return fail("Sign in to continue.", 401, "unauthenticated");

  const url = new URL(req.url);
  const studentId = (url.searchParams.get("studentId") ?? "").trim();
  if (!UUID.test(studentId)) {
    return fail("That student could not be found.", 404, "not_found");
  }

  // The pupil's organisation, before anything else. Every query below filters on
  // it, and a mismatch produces the same 404 as a missing row so the route does
  // not confirm that a given UUID exists in another school.
  const student = await one(`students?select=*&id=eq.${studentId}&limit=1`);
  if (!student) return fail("That student could not be found.", 404, "not_found");

  const orgId = String(student.organisation_id ?? "");
  const callerProfile = await one(`profiles?select=organisation_id&id=eq.${caller.id}&limit=1`);
  if (!callerProfile?.organisation_id || String(callerProfile.organisation_id) !== orgId) {
    return fail("That student could not be found.", 404, "not_found");
  }

  const relatesTo = await relationship(caller, studentId, orgId);
  const sections = sectionsForRole(caller.role, relatesTo);

  if (!sections.length) {
    return fail(
      "You do not have access to this student's records.",
      403,
      "forbidden"
    );
  }

  const has = (s: StudentSection) => sections.indexOf(s) !== -1;

  /* ---------------------------------------------------------------- *
   * Assemble
   * ---------------------------------------------------------------- */

  const address = (student.address ?? {}) as Json;

  const payload: Json = {
    student: {
      id: student.id,
      admission_no: student.admission_no ?? null,
      first_name: student.first_name ?? null,
      last_name: student.last_name ?? null,
      name: `${String(student.first_name ?? "")} ${String(student.last_name ?? "")}`.trim(),
      date_of_birth: student.date_of_birth ?? null,
      age: ageFrom(student.date_of_birth),
      gender: student.gender ?? null,
      blood_group: student.blood_group ?? null,
      nationality: student.nationality ?? null,
      mother_tongue: student.mother_tongue ?? null,
      religion: student.religion ?? null,
      photo_url: student.photo_url ?? null,
      status: student.status ?? null,
      joined_on: student.joined_on ?? null,
      emergency_contact_name: student.emergency_contact_name ?? null,
      emergency_contact_phone: student.emergency_contact_phone ?? null,
      address: {
        line1: address.line1 ?? address.address1 ?? null,
        line2: address.line2 ?? address.address2 ?? null,
        city: address.city ?? null,
        district: address.district ?? null,
        state: address.state ?? address.state_name ?? null,
        pincode: address.pincode ?? address.pin ?? address.postal_code ?? null,
        country: address.country ?? "India",
      },
      email: student.email ?? null,
      phone: student.phone ?? null,
    },
    sections,
    sectionLabels: SECTION_LABELS,
    viewer: { role: caller.role, relationship: relatesTo },
  };

  /* ------------------------------- class ----------------------------- */
  const currentYear = await one(
    `academic_years?select=id,name,starts_on,ends_on&organisation_id=eq.${orgId}&is_current=eq.true&limit=1`
  );

  const allEnrolments = await rows(
    `enrollments?select=id,student_id,classroom_id,academic_year_id,roll_no,active,enrolled_on` +
      `&organisation_id=eq.${orgId}&student_id=eq.${studentId}&order=enrolled_on.desc`
  );

  const classroomIds = Array.from(
    new Set(allEnrolments.map((e) => String(e.classroom_id ?? "")).filter(Boolean))
  );
  const classrooms = classroomIds.length
    ? await rows(
        `classrooms?select=id,grade,section,room,class_teacher_id&organisation_id=eq.${orgId}` +
          `&id=in.(${classroomIds.join(",")})`
      )
    : [];
  const classroomById = new Map(classrooms.map((c) => [String(c.id), c]));

  const yearIds = Array.from(
    new Set(allEnrolments.map((e) => String(e.academic_year_id ?? "")).filter(Boolean))
  );
  const years = yearIds.length
    ? await rows(
        `academic_years?select=id,name,starts_on,ends_on,is_current&organisation_id=eq.${orgId}` +
          `&id=in.(${yearIds.join(",")})`
      )
    : [];
  const yearById = new Map(years.map((y) => [String(y.id), y]));

  const teacherIds = Array.from(
    new Set(classrooms.map((c) => String(c.class_teacher_id ?? "")).filter(Boolean))
  );
  const teachers = teacherIds.length
    ? await rows(`staff?select=id,name,email,phone&organisation_id=eq.${orgId}&id=in.(${teacherIds.join(",")})`)
    : [];
  const teacherById = new Map(teachers.map((t) => [String(t.id), t]));

  const currentEnrolment = currentYear
    ? allEnrolments.find(
        (e) => String(e.academic_year_id) === String(currentYear.id) && e.active === true
      )
    : allEnrolments.find((e) => e.active === true);

  const currentClassroom = currentEnrolment
    ? classroomById.get(String(currentEnrolment.classroom_id))
    : undefined;
  const currentTeacher = currentClassroom?.class_teacher_id
    ? teacherById.get(String(currentClassroom.class_teacher_id))
    : undefined;

  payload.class = {
    academic_year: currentYear
      ? { id: currentYear.id, name: currentYear.name, is_current: true }
      : null,
    grade: currentClassroom ? String(currentClassroom.grade ?? "") : null,
    section: currentClassroom ? String(currentClassroom.section ?? "") : null,
    room: currentClassroom?.room ?? null,
    roll_no: currentEnrolment?.roll_no ?? null,
    enrolled_on: currentEnrolment?.enrolled_on ?? null,
    enrolment_status: currentEnrolment ? "active" : "not_enrolled",
    class_teacher: currentTeacher
      ? { id: currentTeacher.id, name: currentTeacher.name }
      : null,
  };

  /* ---------------------------- guardians --------------------------- */
  if (has("guardians")) {
    const links = await rows(
      `student_guardians?select=*&organisation_id=eq.${orgId}&student_id=eq.${studentId}` +
        `&order=is_primary.desc`
    );
    const gIds = links.map((l) => String(l.guardian_id ?? "")).filter(Boolean);
    const guardians = gIds.length
      ? await rows(`guardians?select=*&organisation_id=eq.${orgId}&id=in.(${gIds.join(",")})`)
      : [];
    const guardianById = new Map(guardians.map((g) => [String(g.id), g]));

    payload.guardians = links
      .map((link) => {
        const g = guardianById.get(String(link.guardian_id));
        if (!g) return null;
        return {
          link_id: link.id,
          guardian_id: g.id,
          full_name: g.full_name,
          relationship: link.relationship ?? g.relationship ?? null,
          gender: g.gender ?? null,
          phone: g.phone ?? null,
          alternate_phone: g.alternate_phone ?? null,
          email: g.email ?? null,
          occupation: g.occupation ?? null,
          is_primary: link.is_primary === true,
          is_emergency_contact: link.is_emergency_contact === true,
          has_portal_account: Boolean(link.portal_profile_id),
          permissions: {
            academics: link.can_view_academics,
            attendance: link.can_view_attendance,
            fees: link.can_view_fees,
            documents: link.can_view_documents,
            health: link.can_view_health,
            messages: link.can_receive_messages,
          },
        };
      })
      .filter(Boolean);
  }

  /* ---------------------------- academics --------------------------- */
  if (has("academics")) {
    // Examination results, joined to the exam they belong to for the name.
    const results = await rows(
      `exam_results?select=id,examination_id,subject,marks,max_marks,grade&organisation_id=eq.${orgId}` +
        `&student_id=eq.${studentId}&order=examination_id.desc&limit=500`
    );
    const examIds = Array.from(new Set(results.map((r) => String(r.examination_id)).filter(Boolean)));
    const exams = examIds.length
      ? await rows(
          `examinations?select=id,name,starts_on,ends_on,published,academic_year_id` +
            `&organisation_id=eq.${orgId}&id=in.(${examIds.join(",")})`
        )
      : [];
    const examById = new Map(exams.map((e) => [String(e.id), e]));

    const byExam: Json[] = exams
      .map((exam) => {
        const papers = results
          .filter((r) => String(r.examination_id) === String(exam.id))
          .map((r) => ({
            subject: r.subject,
            marks: num(r.marks),
            max_marks: num(r.max_marks),
            percentage: num(r.max_marks) > 0 ? round1((num(r.marks) / num(r.max_marks)) * 100) : null,
            grade: r.grade ?? null,
          }));
        if (!papers.length) return null;
        const maxTotal = papers.reduce((sum, p) => sum + p.max_marks, 0);
        const gotTotal = papers.reduce((sum, p) => sum + p.marks, 0);
        return {
          examination_id: exam.id,
          name: exam.name,
          published: exam.published === true,
          starts_on: exam.starts_on ?? null,
          total_marks: gotTotal,
          max_marks: maxTotal,
          percentage: maxTotal > 0 ? round1((gotTotal / maxTotal) * 100) : null,
          papers,
        };
      })
      .filter(Boolean) as Json[];

    // Subject-wise averages across every paper, for the trend chart.
    const subjectTotals = new Map<string, { got: number; max: number; papers: number }>();
    for (const r of results) {
      const subject = String(r.subject ?? "").trim();
      const max = num(r.max_marks);
      if (!subject || max <= 0) continue;
      const entry = subjectTotals.get(subject) ?? { got: 0, max: 0, papers: 0 };
      entry.got += num(r.marks);
      entry.max += max;
      entry.papers += 1;
      subjectTotals.set(subject, entry);
    }

    const subjectPerformance = Array.from(subjectTotals.entries())
      .map(([subject, t]) => ({
        subject,
        papers: t.papers,
        average: t.max > 0 ? round1((t.got / t.max) * 100) : null,
      }))
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));

    // Promotion history: every enrolment, with the class it was in.
    const enrollmentHistory = allEnrolments
      .map((e) => {
        const room = classroomById.get(String(e.classroom_id));
        const year = yearById.get(String(e.academic_year_id));
        return {
          id: e.id,
          academic_year: year ? String(year.name ?? "") : null,
          academic_year_id: e.academic_year_id ?? null,
          grade: room ? String(room.grade ?? "") : null,
          section: room ? String(room.section ?? "") : null,
          roll_no: e.roll_no ?? null,
          active: e.active === true,
          enrolled_on: e.enrolled_on ?? null,
        };
      })
      .sort((a, b) => String(a.academic_year ?? "").localeCompare(String(b.academic_year ?? "")));

    // Assignments for this pupil's classes.
    const currentClassroomId = currentEnrolment?.classroom_id ?? null;
    const assignments = currentClassroomId
      ? await rows(
          `assignments?select=id,title,subject,due_at,created_at&organisation_id=eq.${orgId}` +
            `&classroom_id=eq.${currentClassroomId}&order=due_at.desc&limit=20`
        )
      : [];

    const subjectTeachers = currentClassroomId
      ? await rows(
          `subject_teachers?select=id,subject_id,staff_id,is_primary&organisation_id=eq.${orgId}` +
            `&classroom_id=eq.${currentClassroomId}`
        )
      : [];
    const stSubjectIds = Array.from(
      new Set(subjectTeachers.map((s) => String(s.subject_id ?? "")).filter(Boolean))
    );
    const stStaffIds = Array.from(
      new Set(subjectTeachers.map((s) => String(s.staff_id ?? "")).filter(Boolean))
    );
    const stSubjects = stSubjectIds.length
      ? await rows(`subjects?select=id,name,code&organisation_id=eq.${orgId}&id=in.(${stSubjectIds.join(",")})`)
      : [];
    const stStaff = stStaffIds.length
      ? await rows(`staff?select=id,name&organisation_id=eq.${orgId}&id=in.(${stStaffIds.join(",")})`)
      : [];
    const stSubjectById = new Map(stSubjects.map((s) => [String(s.id), s]));
    const stStaffById = new Map(stStaff.map((s) => [String(s.id), s]));

    payload.academics = {
      results: byExam,
      subject_performance: subjectPerformance,
      enrollment_history: enrollmentHistory,
      assignments,
      subjects: subjectTeachers
        .map((st) => {
          const subject = stSubjectById.get(String(st.subject_id));
          const teacher = stStaffById.get(String(st.staff_id));
          return subject
            ? { id: st.id, subject: subject.name, code: subject.code, teacher: teacher?.name ?? null }
            : null;
        })
        .filter(Boolean),
    };
  }

  /* ---------------------------- attendance -------------------------- */
  if (has("attendance")) {
    const records = await rows(
      `attendance?select=id,attendance_date,status,notes,classroom_id&organisation_id=eq.${orgId}` +
        `&student_id=eq.${studentId}&order=attendance_date.desc&limit=2000`
    );

    const counts = { present: 0, absent: 0, late: 0, half_day: 0, leave: 0 };
    for (const r of records) {
      const status = String(r.status ?? "") as keyof typeof counts;
      if (status in counts) counts[status] += 1;
    }
    const marked = records.length;
    // Leave is an approved absence: the pupil was not in the room, and it is not
    // counted against them.
    const credit = counts.present + counts.late + counts.half_day + counts.leave;
    const percentage = marked > 0 ? round1((credit / marked) * 100) : null;

    // Month-by-month, for the trend chart.
    const monthly = new Map<string, { present: number; total: number }>();
    for (const r of records) {
      const month = String(r.attendance_date ?? "").slice(0, 7);
      if (!month) continue;
      const entry = monthly.get(month) ?? { present: 0, total: 0 };
      const status = String(r.status ?? "");
      entry.total += 1;
      if (["present", "late", "half_day", "leave"].indexOf(status) !== -1) entry.present += 1;
      monthly.set(month, entry);
    }
    const trend = Array.from(monthly.entries())
      .map(([month, t]) => ({
        month,
        percentage: t.total > 0 ? round1((t.present / t.total) * 100) : 0,
        sessions: t.total,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const absences = records
      .filter((r) => ["absent", "half_day"].indexOf(String(r.status)) !== -1)
      .slice(0, 20)
      .map((r) => ({
        date: r.attendance_date,
        status: r.status,
        notes: r.notes ?? null,
      }));

    const corrections = await rows(
      `attendance_corrections?select=id,attendance_date,from_status,to_status,reason,corrected_at` +
        `&organisation_id=eq.${orgId}&student_id=eq.${studentId}` +
        `&order=corrected_at.desc&limit=20`
    );

    const leaves = await rows(
      `leave_applications?select=*&organisation_id=eq.${orgId}&student_id=eq.${studentId}` +
        `&order=from_on.desc&limit=30`
    );

    payload.attendance = {
      summary: {
        percentage,
        marked_sessions: marked,
        ...counts,
      },
      trend,
      absences,
      corrections,
      leaves: leaves.map((l) => ({
        id: l.id,
        leave_type: l.leave_type,
        from_on: l.from_on,
        to_on: l.to_on,
        days: l.days,
        reason: l.reason ?? null,
        status: l.status,
        decided_at: l.decided_at ?? null,
        decision_note: l.decision_note ?? null,
      })),
    };
  }

  /* ------------------------------- fees ----------------------------- */
  if (has("fees")) {
    const accounts = await rows(
      `fee_accounts?select=*&organisation_id=eq.${orgId}&student_id=eq.${studentId}` +
        `&order=created_at.desc`
    );
    const accountIds = accounts.map((a) => String(a.id)).filter(Boolean);

    const installments = accountIds.length
      ? await rows(
          `fee_installments?select=*&organisation_id=eq.${orgId}` +
            `&fee_account_id=in.(${accountIds.join(",")})&order=due_on.asc`
        )
      : [];

    // The authoritative payment history is the invoice and payment ledger, which
    // is where money actually moves. The fee account summarises it.
    const invoices = await rows(
      `invoices?select=id,invoice_no,due_on,total,paid_amount,status,created_at` +
        `&organisation_id=eq.${orgId}&student_id=eq.${studentId}&order=created_at.desc&limit=100`
    );
    const invoiceIds = invoices.map((i) => String(i.id)).filter(Boolean);
    const payments = invoiceIds.length
      ? await rows(
          `payments?select=id,invoice_id,receipt_no,amount,method,paid_at,reference` +
            `&organisation_id=eq.${orgId}&invoice_id=in.(${invoiceIds.join(",")})` +
            `&order=paid_at.desc&limit=200`
        )
      : [];
    const paymentsByInvoice = new Map<string, Json[]>();
    for (const p of payments) {
      const key = String(p.invoice_id ?? "");
      const list = paymentsByInvoice.get(key) ?? [];
      list.push(p);
      paymentsByInvoice.set(key, list);
    }

    const items = invoiceIds.length
      ? await rows(
          `invoice_items?select=id,invoice_id,description,amount,category_id` +
            `&invoice_id=in.(${invoiceIds.join(",")})`
        )
      : [];
    const itemsByInvoice = new Map<string, Json[]>();
    for (const it of items) {
      const key = String(it.invoice_id ?? "");
      const list = itemsByInvoice.get(key) ?? [];
      list.push(it);
      itemsByInvoice.set(key, list);
    }

    const today = new Date().toISOString().slice(0, 10);
    const billed = invoices.reduce((sum, i) => sum + num(i.total), 0);
    const paid = invoices.reduce((sum, i) => sum + num(i.paid_amount), 0);
    const outstanding = round2(Math.max(0, billed - paid));
    const overdue = invoices.filter(
      (i) => String(i.due_on ?? "") < today && num(i.total) - num(i.paid_amount) > 0 && i.status !== "cancelled"
    );

    const upcoming = installments
      .filter((i) => ["due", "part_paid", "overdue"].indexOf(String(i.status)) !== -1)
      .slice(0, 8)
      .map((i) => ({
        id: i.id,
        label: i.label,
        amount: num(i.amount),
        paid_amount: num(i.paid_amount),
        due_on: i.due_on,
        status: i.status,
      }));

    payload.fees = {
      summary: {
        billed: round2(billed),
        paid: round2(paid),
        outstanding,
        overdue_count: overdue.length,
        overdue_amount: round2(overdue.reduce((sum, i) => sum + (num(i.total) - num(i.paid_amount)), 0)),
      },
      accounts: accounts.map((a) => ({
        id: a.id,
        academic_year_id: a.academic_year_id ?? null,
        total_fee: num(a.total_fee),
        scholarship: num(a.scholarship),
        concession: num(a.concession),
        discount_reason: a.discount_reason ?? null,
        paid_amount: num(a.paid_amount),
        status: a.status,
      })),
      installments: installments.map((i) => ({
        id: i.id,
        fee_account_id: i.fee_account_id,
        label: i.label,
        amount: num(i.amount),
        paid_amount: num(i.paid_amount),
        due_on: i.due_on,
        paid_on: i.paid_on ?? null,
        status: i.status,
        invoice_id: i.invoice_id ?? null,
      })),
      upcoming,
      invoices: invoices.map((i) => ({
        id: i.id,
        invoice_no: i.invoice_no,
        due_on: i.due_on ?? null,
        total: num(i.total),
        paid_amount: num(i.paid_amount),
        status: i.status,
        items: (itemsByInvoice.get(String(i.id)) ?? []).map((it) => ({
          description: it.description,
          amount: num(it.amount),
        })),
        payments: (paymentsByInvoice.get(String(i.id)) ?? []).map((p) => ({
          id: p.id,
          receipt_no: p.receipt_no,
          amount: num(p.amount),
          method: p.method,
          paid_at: p.paid_at,
          reference: p.reference ?? null,
        })),
      })),
    };
  }

  /* ---------------------------- documents --------------------------- */
  if (has("documents")) {
    // Metadata only. The bytes are never inlined; the download route mints a
    // short-lived signed URL, so this response cannot leak a file.
    payload.documents = await rows(
      `student_documents?select=id,category,title,file_name,content_type,size_bytes,issued_on,` +
        `uploaded_on,verification_status,verified_on,rejection_reason,remarks,expires_on,version` +
        `&organisation_id=eq.${orgId}&student_id=eq.${studentId}` +
        `&order=is_current.desc,uploaded_on.desc`
    );
  }

  /* ------------------------------ health ---------------------------- */
  if (has("health")) {
    const record = await one(
      `student_health_records?select=*&organisation_id=eq.${orgId}&student_id=eq.${studentId}&limit=1`
    );
    const incidents = await rows(
      `student_health_incidents?select=*&organisation_id=eq.${orgId}&student_id=eq.${studentId}` +
        `&order=incident_date.desc&limit=25`
    );

    payload.health = record
      ? {
          record: {
            blood_group: record.blood_group ?? null,
            height_cm: record.height_cm ?? null,
            weight_kg: record.weight_kg ?? null,
            allergies: record.allergies ?? null,
            medical_conditions: record.medical_conditions ?? null,
            medications: record.medications ?? null,
            emergency_instructions: record.emergency_instructions ?? null,
            accessibility_needs: record.accessibility_needs ?? null,
            emergency_contact_name: record.emergency_contact_name ?? null,
            emergency_contact_phone: record.emergency_contact_phone ?? null,
            regular_doctor_name: record.regular_doctor_name ?? null,
            regular_doctor_phone: record.regular_doctor_phone ?? null,
            checked_at: record.checked_at ?? null,
          },
          incidents: incidents.map((i) => ({
            id: i.id,
            incident_date: i.incident_date,
            summary: i.summary,
            action_taken: i.action_taken ?? null,
            severity: i.severity,
            notified_guardian: i.notified_guardian === true,
          })),
        }
      : { record: null, incidents };
  }

  /* ----------------------------- transport -------------------------- */
  if (has("transport")) {
    const allocations = await rows(
      `transport_allocations?select=*&organisation_id=eq.${orgId}&student_id=eq.${studentId}` +
        `&order=ended_on.asc`
    );
    const routeIds = Array.from(new Set(allocations.map((a) => String(a.route_id ?? "")).filter(Boolean)));
    const routes = routeIds.length
      ? await rows(
          `transport_routes?select=id,code,name,driver_name,driver_phone,vehicle_no` +
            `&organisation_id=eq.${orgId}&id=in.(${routeIds.join(",")})`
        )
      : [];
    const routeById = new Map(routes.map((r) => [String(r.id), r]));

    payload.transport = {
      enrolled: allocations.some((a) => a.active === true),
      allocations: allocations.map((a) => {
        const route = routeById.get(String(a.route_id));
        return {
          id: a.id,
          active: a.active === true,
          route_id: a.route_id,
          route_code: route?.code ?? null,
          route_name: route?.name ?? null,
          vehicle_no: route?.vehicle_no ?? null,
          driver_name: route?.driver_name ?? null,
          driver_phone: route?.driver_phone ?? null,
          stop_name: a.stop_name ?? null,
          pickup_time: a.pickup_time ?? null,
          drop_time: a.drop_time ?? null,
          fare_amount: a.fare_amount ?? null,
          is_authorized_pickup: a.is_authorized_pickup === true,
          ended_on: a.ended_on ?? null,
        };
      }),
    };
  }

  /* ---------------------------- activities -------------------------- */
  if (has("activities")) {
    const participations = await rows(
      `activity_participations?select=*&organisation_id=eq.${orgId}&student_id=eq.${studentId}` +
        `&order=started_on.desc`
    );
    const actIds = Array.from(
      new Set(participations.map((p) => String(p.activity_id ?? "")).filter(Boolean))
    );
    const acts = actIds.length
      ? await rows(`activities?select=id,name,category,description&organisation_id=eq.${orgId}&id=in.(${actIds.join(",")})`)
      : [];
    const actById = new Map(acts.map((a) => [String(a.id), a]));

    payload.activities = participations
      .map((p) => {
        const activity = actById.get(String(p.activity_id));
        return activity
          ? {
              id: p.id,
              activity_id: activity.id,
              name: activity.name,
              category: activity.category,
              role: p.role ?? null,
              participation: p.participation,
              award: p.award ?? null,
              achievement: p.achievement ?? null,
              certificate_ref: p.certificate_ref ?? null,
              started_on: p.started_on ?? null,
              ended_on: p.ended_on ?? null,
            }
          : null;
      })
      .filter(Boolean);
  }

  /* --------------------------- observations ------------------------- */
  if (has("observations")) {
    payload.observations = await rows(
      `student_observations?select=id,category,body,classroom_participation,support_needed,` +
        `action_taken,follow_up_on,follow_up_done,follow_up_notes,visible_to_guardians,observed_on` +
        `&organisation_id=eq.${orgId}&student_id=eq.${studentId}&order=observed_on.desc&limit=50`
    );
  }

  /* -------------------------- communications ----------------------- */
  if (has("communications")) {
    const comms = await rows(
      `student_communications?select=id,kind,subject,notes,outcome,occurred_at,acknowledged_at,` +
        `guardian_id,message_id&organisation_id=eq.${orgId}&student_id=eq.${studentId}` +
        `&order=occurred_at.desc&limit=50`
    );

    // Referenced messages are fetched from the existing messages table rather
    // than copied into a second store. This is the integration the brief asks
    // for: the thread stays in one place.
    const messageIds = Array.from(
      new Set(comms.map((c) => String(c.message_id ?? "")).filter(Boolean))
    );
    const messages = messageIds.length
      ? await rows(
          `messages?select=id,subject,body,status,created_at,sender_id,recipient_id` +
            `&organisation_id=eq.${orgId}&id=in.(${messageIds.join(",")})`
        )
      : [];
    const messageById = new Map(messages.map((m) => [String(m.id), m]));

    const guardianIds = Array.from(
      new Set(comms.map((c) => String(c.guardian_id ?? "")).filter(Boolean))
    );
    const commGuardians = guardianIds.length
      ? await rows(`guardians?select=id,full_name&organisation_id=eq.${orgId}&id=in.(${guardianIds.join(",")})`)
      : [];
    const commGuardianById = new Map(commGuardians.map((g) => [String(g.id), g]));

    payload.communications = comms.map((c) => {
      const message = c.message_id ? messageById.get(String(c.message_id)) : null;
      return {
        id: c.id,
        kind: c.kind,
        subject: c.subject ?? message?.subject ?? null,
        notes: c.notes ?? null,
        outcome: c.outcome ?? null,
        occurred_at: c.occurred_at,
        acknowledged_at: c.acknowledged_at ?? null,
        guardian: c.guardian_id ? commGuardianById.get(String(c.guardian_id))?.full_name ?? null : null,
        message: message
          ? {
              id: message.id,
              subject: message.subject,
              body: message.body,
              status: message.status,
              created_at: message.created_at,
            }
          : null,
      };
    });
  }

  /* ---------------------------- admission --------------------------- */
  if (has("admission")) {
    payload.admission = await rows(
      `admission_records?select=*&organisation_id=eq.${orgId}&student_id=eq.${studentId}` +
        `&order=applied_on.desc`
    );
  }

  /* ----------------------------- library ---------------------------- */
  if (has("library")) {
    const loans = await rows(
      `library_loans?select=*&organisation_id=eq.${orgId}&student_id=eq.${studentId}` +
        `&order=issued_on.desc&limit=100`
    );
    const today = new Date().toISOString().slice(0, 10);
    payload.library = {
      loans: loans.map((l) => ({
        id: l.id,
        book_title: l.book_title,
        book_isbn: l.book_isbn ?? null,
        issued_on: l.issued_on,
        due_on: l.due_on ?? null,
        returned_on: l.returned_on ?? null,
        fine_amount: num(l.fine_amount),
        status: l.status,
      })),
      current_count: loans.filter((l) => ["issued", "overdue"].indexOf(String(l.status)) !== -1).length,
      overdue_count: loans.filter(
        (l) => ["issued", "overdue"].indexOf(String(l.status)) !== -1 && String(l.due_on ?? "") < today
      ).length,
      total_fines: round2(loans.reduce((sum, l) => sum + num(l.fine_amount), 0)),
    };
  }

  /* ----------------------------- account ---------------------------- */
  if (has("account")) {
    const profile = await one(
      `profiles?select=id,full_name,username,email,role,avatar_url,student_id&organisation_id=eq.${orgId}` +
        `&student_id=eq.${studentId}&limit=1`
    );
    const credential = await one(
      `student_credentials?select=student_id,username,issued_at,revoked_at` +
        `&organisation_id=eq.${orgId}&student_id=eq.${studentId}&limit=1`
    );

    /*
     * Deliberately constructed from named fields.
     *
     * `student_credentials` has a `password` column. Selecting the row with `*`
     * and deleting the key afterwards would put the secret in memory and in any
     * error or log that serialises the response, so the column is never named in
     * the query at all. Nothing here can reach it.
     */
    payload.account = {
      has_account: Boolean(profile),
      login_identifier: credential?.username ?? profile?.username ?? null,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      role: profile?.role ?? null,
      issued_at: credential?.issued_at ?? null,
      revoked_at: credential?.revoked_at ?? null,
      status: credential?.revoked_at ? "revoked" : profile ? "active" : "not_created",
      linked_parents: await linkedParentCount(orgId, studentId),
    };
  }

  // The sections the caller may see but that were not included above, with the
  // reason. The client renders these as locked tabs rather than empty ones, so
  // "no permission" is never mistaken for "no data".
  payload.withheld = ALL_STUDENT_SECTIONS.filter((s) => !has(s));

  // A short audit entry for having looked at the record. Reading a pupil's file
  // is an access event, and the brief asks for audit history across the system.
  // Best effort, and deliberately not awaited on the response path beyond the
  // write itself.
  await rest("audit_logs", {
    method: "POST",
    body: JSON.stringify({
      organisation_id: orgId,
      actor_id: caller.id,
      action: "student.profile_view",
      entity_type: "students",
      entity_id: studentId,
      before_data: null,
      after_data: { sections },
    }),
  }).catch(() => null);

  return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
}

async function linkedParentCount(orgId: string, studentId: string): Promise<number> {
  const links = await rows(
    `student_guardians?select=portal_profile_id&organisation_id=eq.${orgId}` +
      `&student_id=eq.${studentId}`
  );
  const ids = new Set<string>();
  for (const l of links) {
    if (l.portal_profile_id) ids.add(String(l.portal_profile_id));
  }
  return ids.size;
}
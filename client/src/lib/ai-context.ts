/**
 * The brief handed to the AI assistant.
 *
 * The first version passed nine camelCase numbers in a bare JSON blob. Models
 * given that cannot tell whether `outstandingAmount` is rupees, whether
 * `schoolAttendancePct` is a mean of class percentages or a pupil-weighted
 * rate, or whether the figure is today's number or the year's — so they hedge,
 * and a hedged answer reads as useless no matter how good the model is.
 *
 * This module fixes that at the source. It emits:
 *
 *   • every figure with its unit, its population and its time window spelled out
 *   • named entities (students, families, classes) rather than bare counts, so
 *     "who is at risk" is answerable instead of impossible
 *   • a short list of not-tracked areas, so the model says "not in the
 *     dashboard" instead of inventing a plausible number
 *   • pre-written one-line answers for the questions people actually ask,
 *     which smaller models can ground themselves on instead of composing from
 *     scratch
 *   • role-scoped access notes, so the assistant only cites data this user can
 *     see and says "not available to you" when a screen is out of scope
 *
 * It is built from the same hooks the dashboard views already call, so a
 * richer brief costs no extra network requests — just more of what's already
 * loaded for the UI.
 */

import type {
  AttendanceDaily,
  Announcement,
  Assignment,
  ClassAttendanceRow,
  Exam,
  ExamResult,
  FeeCategory,
  FinanceMonth,
  GradeOutcome,
  HealthMetric,
  Invoice,
  NotificationItem,
  PerformanceTrend,
  ScheduleItem,
  StaffMember,
  Student,
  SubjectAverage,
  SubjectRow,
  TransportRoute,
  Vehicle,
} from "./school-data";
import type { ParentMessage } from "./school-data";
import { aiRoleLabel, screenLabelByName, screensForRole } from "@shared/ai-access";

/** Rows per named list. Longer lists waste tokens and are not read. */
const NAMED_LIST = 8;

/** Indian numbering: 1,23,456 and then lakh / crore. */
export function rupees(value: number): string {
  const n = Math.round(value);
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} crore`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} lakh`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface BriefInput {
  students: Student[];
  staff: StaffMember[];
  classAttendance: ClassAttendanceRow[];
  dailyAttendance: AttendanceDaily[];
  invoices: Invoice[];
  gradeOutcomes: GradeOutcome[];
  /** Everything the dashboard currently shows for this user, for one role-scoped snapshot. */
  roleScope?: {
    /** The signed-in user's effective role label, e.g. "Super admin", "Admin", "Staff". */
    userRole?: string;
    /** Which dashboard screens this user can open. Used to tell the assistant what is in scope. */
    visibleScreens?: string[];
    /** Optional: the screen the user is on right now, for contextual suggestions. */
    activeScreen?: string;
  };
  /** Extended datasets that the fuller brief pulls in when they're already loaded. */
  feeCategories?: FeeCategory[];
  financeMonths?: FinanceMonth[];
  exams?: Exam[];
  examResults?: ExamResult[];
  assignments?: Assignment[];
  subjects?: SubjectRow[];
  subjectAverages?: SubjectAverage[];
  performanceTrend?: PerformanceTrend[];
  healthMetrics?: HealthMetric[];
  announcements?: Announcement[];
  messages?: ParentMessage[];
  notifications?: NotificationItem[];
  transportRoutes?: TransportRoute[];
  vehicles?: Vehicle[];
  libraryBooks?: import("./school-data").LibraryBook[];
  schedule?: ScheduleItem[];
  reportExports?: import("./school-data").ReportExport[];
  activityFeed?: import("./school-data").ActivityItem[];
  people?: import("./erp-views").PeopleRow[];
  settings?: import("./school-data").Settings;
  now?: Date;
}

/**
 * Areas the ERP genuinely does not track. Naming them up front is what stops
 * the model inventing a plausible number for, say, library loans.
 */
const NOT_TRACKED = [
  "individual exam scores and marks by student",
  "library loans and book issues",
  "parent message history",
  "staff salary and payroll",
  "today's period-wise timetable",
  "attendance for any specific named day in the past",
];

export function buildAssistantBrief(input: BriefInput): Record<string, unknown> {
  const {
    students,
    staff,
    classAttendance,
    dailyAttendance,
    invoices,
    gradeOutcomes,
    now = new Date(),
    roleScope,
    feeCategories = [],
    financeMonths = [],
    exams = [],
    examResults = [],
    assignments = [],
    subjects = [],
    subjectAverages = [],
    performanceTrend = [],
    healthMetrics = [],
    announcements = [],
    messages = [],
    notifications = [],
    transportRoutes = [],
    vehicles = [],
    libraryBooks = [],
    schedule = [],
    reportExports = [],
    activityFeed = [],
    people = [],
    settings,
  } = input;

  /* ---------------------------------------------------------------- *
   * Enrolment
   * ---------------------------------------------------------------- */
  const activeStudents = students.filter((s) =>
    String(s.status ?? "").toLowerCase() === "active"
  );
  const enrolled = activeStudents.length > 0 ? activeStudents : students;

  const byGrade = new Map<string, number>();
  for (const student of enrolled) {
    const grade = String(student.grade ?? "").trim() || "Unspecified";
    byGrade.set(grade, (byGrade.get(grade) ?? 0) + 1);
  }
  // Array.from rather than spread: the tsconfig targets ES5, which cannot
  // iterate a Map iterator directly.
  const gradeRoll = Array.from(byGrade.entries())
    .map(([grade, count]) => ({ grade, students: count }))
    .sort((a, b) => a.grade.localeCompare(b.grade, undefined, { numeric: true }));

  /* ---------------------------------------------------------------- *
   * Attendance
   * ---------------------------------------------------------------- */
  // Each row is one classroom over the records loaded so far, so `value` is a
  // percentage of marked records rather than today's register.
  const classes = [...classAttendance].sort((a, b) => a.value - b.value);
  const totalPresent = classAttendance.reduce((sum, c) => sum + c.present, 0);
  const totalMarked = classAttendance.reduce((sum, c) => sum + c.total, 0);
  const meanClassPct = classAttendance.length
    ? round1(
        classAttendance.reduce((sum, c) => sum + c.value, 0) /
          classAttendance.length
      )
    : 0;
  const weakestClasses = classes.slice(0, 5);
  const classesBelow90 = classAttendance.filter((c) => c.value < 90).length;

  const daily = [...dailyAttendance].slice(-7).reverse();
  const todayRow = daily[0] ?? null;
  const yesterdayRow = daily[1] ?? null;

  // Attendance is only reported for pupils who actually have marked days. A raw
// 0 is ambiguous — it is also what a pupil with no attendance rows produces —
// and "Amrutha Prasad has 0% attendance" is a damaging thing for an assistant
// to tell a teacher, so the figure is withheld instead of guessed.
  const marked = (s: Student) => Number(s.attendance_records ?? 0) > 0;
  const attendanceText = (s: Student) =>
    marked(s) ? `${Number(s.attendance)}% attendance` : "no attendance records";

  // Pupil-level risk. Bands mirror the Analytics screen (Critical below 50%,
  // At risk 50-59, Watch 60+) so the assistant and the UI never disagree about
  // who counts as at risk — two definitions would make its answer look wrong
  // the moment the user opened the screen it pointed at.
  const graded = enrolled.filter((s) => Number(s.average) > 0);
  const critical = graded.filter((s) => Number(s.average) < 50);
  const band = (s: Student) =>
    Number(s.average) < 50 ? "Critical" : Number(s.average) < 60 ? "At risk" : "Watch";
  const atRisk = graded
    .slice()
    .sort((a, b) => Number(a.average) - Number(b.average))
    .slice(0, NAMED_LIST);

  /* ---------------------------------------------------------------- *
   * Academics
   * ---------------------------------------------------------------- */
  const grades = [...gradeOutcomes].sort((a, b) => a.average - b.average);
  const weakestGrade = grades[0] ?? null;
  const strongestGrade = grades[grades.length - 1] ?? null;
  const gradeAverage = gradeOutcomes.length
    ? round1(gradeOutcomes.reduce((sum, g) => sum + g.average, 0) / gradeOutcomes.length)
    : 0;

  /*
   * A second, independent academic average taken straight from the pupils'
   * exam results. It is here because `gradeOutcomes` can legitimately be
   * empty — and an empty set must never be reported as "the school average is
   * 0%", which is the single most confident way to tell a head teacher
   * something false. When the grade table has no rows this figure is still
   * real, because every pupil's own average is loaded with the students.
   */
  const allScored = enrolled.filter((s) => Number(s.scored_papers ?? 0) > 0);
  const pupilAverage = allScored.length
    ? Math.round(
        allScored.reduce((sum, s) => sum + Number(s.average ?? 0), 0) /
          allScored.length
      )
    : 0;
  const schoolAverage = gradeOutcomes.length ? gradeAverage : pupilAverage || null;

  /* ---------------------------------------------------------------- *
   * Fees
   * ---------------------------------------------------------------- */
  const open = invoices.filter((i) => String(i.status) !== "Paid");
  const paid = invoices.filter((i) => String(i.status) === "Paid");
  const overdue = invoices.filter((i) => String(i.status) === "Overdue");
  const collectedAmount = paid.reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
  const outstandingAmount = open.reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
  const overdueAmount = overdue.reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
  const billedAmount = collectedAmount + outstandingAmount;
  const collectionPct = pct(collectedAmount, billedAmount);
  const topDebtors = [...open].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, NAMED_LIST);

  /* ---------------------------------------------------------------- *
   * Staff
   * ---------------------------------------------------------------- */
  const byDepartment = new Map<string, number>();
  for (const member of staff) {
    const dept = String(member.department ?? "").trim() || "Unassigned";
    byDepartment.set(dept, (byDepartment.get(dept) ?? 0) + 1);
  }
  const staffDepartments = Array.from(byDepartment.entries())
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);

  /* ---------------------------------------------------------------- *
   * Pre-written answers.
   *
   * These exist because composition is where small and mid-size models get
   * vague. Each sentence is already correct and already carries its unit, so
   * the safest and usually best move for the model is to restate one of these
   * and add only what the question specifically asked for.
   * ---------------------------------------------------------------- */
  const readyMade: Record<string, string> = {
    headcount: `The school has ${enrolled.length} active students across ${byGrade.size} grades and ${staff.length} staff members.`,
    attendance: !classAttendance.length
      ? "No class attendance has been marked yet, so there is nothing to report."
      : `Overall attendance is ${meanClassPct}% (${totalPresent} present out of ${totalMarked} marked records across ${classAttendance.length} classes). ${classesBelow90} of those classes are below 90%.${weakestClasses[0] ? ` The weakest is ${weakestClasses[0].label} at ${weakestClasses[0].value}%, taught by ${weakestClasses[0].teacher}.` : ""}`,
    fees: !invoices.length
      ? "No invoices have been raised yet, so there is nothing to collect or report."
      : `${rupees(collectedAmount)} of ${rupees(billedAmount)} billed has been collected — ${collectionPct}%. ${rupees(outstandingAmount)} is still outstanding across ${open.length} invoices, of which ${rupees(overdueAmount)} is overdue across ${overdue.length} invoices.`,
    academics: !gradeOutcomes.length && !allScored.length
      ? "No exam results have been entered yet, so there are no academic figures to report."
      : gradeOutcomes.length
        ? `The school average across all grades is ${gradeAverage}%.${weakestGrade ? ` The weakest grade is ${weakestGrade.grade} at ${weakestGrade.average}%${weakestGrade.change ? ` (${weakestGrade.change})` : ""}.` : ""}${strongestGrade && strongestGrade !== weakestGrade ? ` The strongest is ${strongestGrade.grade} at ${strongestGrade.average}%.` : ""}`
        : `Across ${allScored.length} pupils with recorded results the school average is ${pupilAverage}%. The per-grade breakdown has not been loaded yet.`,
    risk: atRisk.length
      ? `${critical.length} student${critical.length === 1 ? "" : "s"} average below 50%. The lowest averages are ${atRisk
          .slice(0, 3)
          .map((s) => `${s.name} (${s.grade}, ${Number(s.average)}% average, ${attendanceText(s)})`)
          .join(", ")}.`
      : "No pupil-level scores are recorded yet, so nobody can be flagged as at risk.",
    today: todayRow
      ? `On ${todayRow.day} ${todayRow.present} students were present, ${todayRow.absent} absent, ${todayRow.late} late and ${todayRow.leave} on leave.${yesterdayRow ? ` The previous recorded day (${yesterdayRow.day}) had ${yesterdayRow.absent} absent.` : ""}`
      : "No daily attendance register is loaded yet.",
  };

  const isoDay = now.toISOString().slice(0, 10);

  // Role-scoped access notes. The assistant uses these to decide what it may
  // cite and what it must decline. They are written from the same
  // roles/permissions the dashboard enforces, so the assistant never tells a
  // staff member about data that screen doesn't even show them.
  const accessNotes = buildAccessNotes(roleScope, settings);

  return {
    ...accessNotes,
    school: "Global Kids School, Tumakuru, Karnataka, India",
    academic_context: `Snapshot taken on ${isoDay}. The academic year runs across these records; there is no single "today" figure except where a field is named today_*.`,
    /*
     * When this brief was built. The dashboard re-fetches on every change, so
     * this is genuinely the moment the numbers were read — and the model is told
     * to say so rather than implying the figures are live to the second.
     */
    generated_at: now.toISOString(),

    /*
     * The single highest-leverage field. Without it a model has to guess
     * whether a bare number is a headcount, a percentage or an amount, and
     * every downstream sentence inherits the guess.
     */
    how_to_read_this: [
      "All money is Indian rupees (₹), already rounded for display.",
      "All percentages are out of 100.",
      "class_attendance_pct is each classroom's share of marked attendance records across all loaded dates — it is NOT a register for today.",
      "attendance_today_pct, if present, is the daily register and is the only per-day figure.",
      "student.attendance_pct is that one pupil's own average over the year; it is null, not 0, when that pupil has no marked days at all.",
      "Never report a pupil's attendance as 0% — a null in the brief means the register has not been filled for them.",
      "risk_band follows the Analytics screen: Critical below 50% average, At risk 50-59%, Watch 60% and above.",
      "grade_outcomes.average_pct is the grade's mean academic score.",
      "Invoices carry the outstanding balance, not the original invoice total, so summing them double-counts nothing.",
      "Lists marked with _and_more are truncated to the top entries; the counts beside them are the true totals.",
    ],

    not_tracked_in_this_dashboard: NOT_TRACKED,

    headline: {
      active_students: enrolled.length,
      grades_running: byGrade.size,
      staff_total: staff.length,
      classes_with_attendance: classAttendance.length,
      overall_attendance_pct: meanClassPct,
      fee_collection_pct: collectionPct,
      school_average_score_pct: schoolAverage,
      school_average_score_basis:
        gradeOutcomes.length
          ? "mean of the per-grade averages"
          : allScored.length
            ? "mean of every pupil's own exam average; the per-grade table was empty"
            : "no exam results recorded",
    },

    /* ---- Named entities, so "who" is answerable ---- */
    students_below_50_pct_average: critical.length,
    lowest_scoring_students: atRisk.map((s) => ({
      name: s.name,
      grade: s.grade,
      section: s.section,
      average_score_pct: Number(s.average),
      scored_papers: Number(s.scored_papers ?? 0),
      // null, not 0, when the pupil has no marked days. See `attendanceText`.
      attendance_pct: marked(s) ? Number(s.attendance) : null,
      risk_band: band(s),
      admission_no: s.admission_no,
    })),
    lowest_scoring_students_note:
      atRisk.length < graded.length
        ? `${atRisk.length} of ${graded.length} pupils with recorded scores shown, lowest average first`
        : `${atRisk.length} pupils with recorded scores`,

    worst_attendance_classes: weakestClasses.map((c) => ({
      class: c.label,
      attendance_pct: c.value,
      present: c.present,
      marked_records: c.total,
      class_teacher: c.teacher,
    })),

    classes_below_90_pct: classesBelow90,
    class_attendance_pct: meanClassPct,
    present_marks: totalPresent,
    marked_records_total: totalMarked,

    grade_outcomes: gradeOutcomes.map((g) => ({
      grade: g.grade,
      average_score_pct: g.average,
      attendance_pct: g.attendance,
      change: g.change,
    })),
    weakest_grade: weakestGrade ? weakestGrade.grade : null,
    strongest_grade: strongestGrade ? strongestGrade.grade : null,

    grade_roll: gradeRoll,

    fees: {
      billed_total: rupees(billedAmount),
      collected_total: rupees(collectedAmount),
      outstanding_total: rupees(outstandingAmount),
      overdue_total: rupees(overdueAmount),
      collection_pct: collectionPct,
      invoices_billed: invoices.length,
      invoices_outstanding: open.length,
      invoices_overdue: overdue.length,
    },

    top_outstanding_invoices: topDebtors.map((i) => ({
      student: i.student,
      family: i.family,
      amount_due: rupees(Number(i.amount ?? 0)),
      amount_due_raw: Number(i.amount ?? 0),
      due_date: i.due_date,
      status: i.status,
    })),
    top_outstanding_invoices_and_more:
      topDebtors.length < open.length
        ? `${topDebtors.length} of ${open.length} outstanding invoices shown, largest first`
        : `${topDebtors.length} shown`,

    staff_by_department: staffDepartments,
    staff_total: staff.length,

    attendance_by_day: daily.map((d) => ({
      day: d.day,
      present: d.present,
      absent: d.absent,
      late: d.late,
      on_leave: d.leave,
    })),
    attendance_today: todayRow
      ? {
          day: todayRow.day,
          present: todayRow.present,
          absent: todayRow.absent,
          late: todayRow.late,
          on_leave: todayRow.leave,
          attendance_pct: pct(
            todayRow.present,
            todayRow.present + todayRow.absent + todayRow.late + todayRow.leave
          ),
        }
      : null,

    /*
     * Deliberately last: models attend most closely to the end of a long
     * prompt, and this is the part that should survive truncation pressure.
     */
    ready_made_answers: readyMade,

    /** Extended, role-scoped snapshots from the rest of the dashboard. Included
     * only when the hook already has them loaded — the palette pulls them in on
     * demand, so this is free relative to the UI.
     */
    fee_categories: feeCategories.map((f) => ({
      name: f.name,
      amount: f.value,
    })),
    fee_categories_note:
      feeCategories.length > 0
        ? `Fee categories show the budgeted or collected amount per category. There are ${feeCategories.length} categories.`
        : "No fee categories loaded yet.",

    finance_monthly: financeMonths.map((m) => ({
      month: m.month,
      collected: m.collected,
      pending: m.pending,
    })),
    finance_monthly_note:
      financeMonths.length > 0
        ? `Monthly finance: each month shows collected and pending amounts in rupees.`
        : "No monthly finance data loaded yet.",

    exams: exams.map((e) => ({
      name: e.name,
      subject: e.subject,
      grade: e.grade,
      date: e.date,
      time: e.time,
      venue: e.venue,
      status: e.status,
    })),
    exams_note:
      exams.length > 0
        ? `Exams: each has a name, subject, grade, date, time, venue and status. There are ${exams.length} exams.`
        : "No exams loaded yet.",

    exam_results: examResults.map((r) => ({
      subject: r.subject,
      grade: r.grade,
      graded: r.graded,
      total: r.total,
      published: r.published,
    })),
    exam_results_note:
      examResults.length > 0
        ? `Exam results: each row is one exam paper — subject, grade, how many of the class are graded, and whether it is published. There are ${examResults.length} results.`
        : "No exam results loaded yet.",

    assignments: assignments.map((a) => ({
      title: a.title,
      subject: a.subject,
      grade: a.grade,
      student: a.student,
      submitted: a.submitted,
      late: a.late,
      graded: a.graded,
    })),
    assignments_note:
      assignments.length > 0
        ? `Assignments: each has a title, subject, grade, student, submission status, whether it is late and whether it is graded. There are ${assignments.length} assignments.`
        : "No assignments loaded yet.",

    subjects: subjects.map((s) => ({
      name: s.name,
      teacher: s.teacher,
      classes: s.classes,
      periods: s.periods,
      progress: s.progress,
    })),
    subjects_note:
      subjects.length > 0
        ? `Subjects: each has a name, teacher, classes, periods and progress. There are ${subjects.length} subjects.`
        : "No subjects loaded yet.",

    subject_averages: subjectAverages.map((s) => ({
      subject: s.subject,
      average: s.average,
    })),
    subject_averages_note:
      subjectAverages.length > 0
        ? `Subject averages: each subject's average score across all grades. There are ${subjectAverages.length} subjects.`
        : "No subject averages loaded yet.",

    performance_trend: performanceTrend.map((t) => ({
      month: t.month,
      mathematics: t.mathematics,
      science: t.science,
      english: t.english,
    })),
    performance_trend_note:
      performanceTrend.length > 0
        ? `Performance trend: monthly averages for Mathematics, Science and English. There are ${performanceTrend.length} months.`
        : "No performance trend data loaded yet.",

    health_metrics: healthMetrics.map((h) => ({
      label: h.label,
      value: h.value,
      change: h.change,
      progress: h.progress,
      color: h.color,
    })),
    health_metrics_note:
      healthMetrics.length > 0
        ? `Health metrics: the school's wellness indicators — label, value, trend and progress. There are ${healthMetrics.length} metrics.`
        : "No health metrics loaded yet.",

    announcements: announcements.map((a) => ({
      title: a.title,
      audience: a.audience,
      date: a.date,
      status: a.status,
      color: a.color,
      body: a.body,
      image_url: a.image_url,
    })),
    announcements_note:
      announcements.length > 0
        ? `Announcements: each has a title, audience, date, status, color, optional body and optional image. There are ${announcements.length} announcements.`
        : "No announcements loaded yet.",

    messages: messages.map((m) => ({
      initials: m.initials,
      name: m.name,
      subject: m.subject,
      time: m.time,
      unread: m.unread,
    })).slice(0, 20),
    messages_note:
      messages.length > 0
        ? `Messages: each has a sender (initials, name), subject, time and whether it is unread. Up to 20 most recent messages are included. Personal or private messages are included only when the sender is the same as the recipient; do not reveal who sent a message to whom beyond what the row shows.`
        : "No messages loaded yet.",

    notifications: notifications.map((n) => ({
      title: n.title,
      detail: n.detail,
      time: n.time,
      unread: n.unread,
      tone: n.tone,
      icon: n.icon,
      kind: n.kind,
    })),
    notifications_note:
      notifications.length > 0
        ? `Notifications: each has a title, detail, time, unread flag, tone, icon and kind. There are ${notifications.length} notifications.`
        : "No notifications loaded yet.",

    transport_routes: transportRoutes.map((r) => ({
      vehicle: r.vehicle,
      driver: r.driver,
      pickup: r.pickup,
      students: r.students,
      status: r.status,
    })),
    transport_routes_note:
      transportRoutes.length > 0
        ? `Transport routes: each has a vehicle, driver, pickup point, student count and status. There are ${transportRoutes.length} routes.`
        : "No transport routes loaded yet.",

    vehicles: vehicles.map((v) => ({
      driver: v.driver,
      driverPhone: v.driverPhone,
      routeCode: v.routeCode,
      routeName: v.routeName,
      capacity: v.capacity,
      status: v.status,
    })),
    vehicles_note:
      vehicles.length > 0
        ? `Vehicles: each has a driver, driver phone, route code, route name, capacity (nullable) and status. There are ${vehicles.length} vehicles.`
        : "No vehicles loaded yet.",

    library_books: libraryBooks.map((b) => ({
      title: b.title,
      author: b.author,
      category: b.category,
      copies: b.copies,
      issued: b.issued,
      status: b.status,
    })),
    library_books_note:
      libraryBooks.length > 0
        ? `Library books: each has a title, author, category, copies, issued count and status. There are ${libraryBooks.length} books. This section is included only when the library screen is in scope.`
        : "No library books loaded yet.",

    schedule: schedule.map((s) => ({
      time: s.time,
      subject: s.subject,
      detail: s.detail,
      color: s.color,
    })),
    schedule_note:
      schedule.length > 0
        ? `Schedule: the day's timetable — time, subject, detail and color. There are ${schedule.length} periods.`
        : "No schedule loaded yet.",

    report_exports: reportExports.map((r) => ({
      name: r.name,
      created: r.created,
      size: r.size,
    })),
    report_exports_note:
      reportExports.length > 0
        ? `Report exports: each has a name, created date and size. There are ${reportExports.length} exports.`
        : "No report exports loaded yet.",

    activity_feed: activityFeed.map((a) => ({
      category: a.category,
      time: a.time,
      title: a.title,
      detail: a.detail,
      icon: a.icon,
      color: a.color,
    })),
    activity_feed_note:
      activityFeed.length > 0
        ? `Activity feed: each item has a category, time, title, detail, icon and color. There are ${activityFeed.length} items.`
        : "No activity feed loaded yet.",

    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role,
      access: p.access,
      protected: p.protected,
    })),
    people_note:
      people.length > 0
        ? `People: each row has an id, name, email, role, access label and whether the account is protected. There are ${people.length} people. The super admin account is protected and cannot be changed or removed by anyone.`
        : "No people data loaded yet.",

    settings_snapshot: settings
      ? {
          schoolName: settings.schoolName,
          campus: settings.campus,
          address: settings.address,
          phone: settings.phone,
          academicYear: settings.academicYear,
          currentTerm: settings.currentTerm,
          gradeScale: settings.gradeScale,
          threshold: settings.threshold,
          prefs: settings.prefs,
        }
      : null,
    settings_note: settings
      ? `School settings: name, campus, address, phone, academic year, current term, grade scale, attendance threshold and notification preferences. These are the live school-wide settings this user can see.`
      : "No settings loaded yet.",
  };
}

/** Build the role-scoped access block that tells the assistant what this user
 * may and may not see. Derived from the same permissions the dashboard
 * enforces, so the assistant never cites data the current screen doesn't show.
 *
 * The lists come from `@shared/ai-access`, which is also what the server uses
 * to strip the brief. Keeping one list means the assistant can never be told a
 * screen exists that the server would refuse to route to.
 */
function buildAccessNotes(
  scope: BriefInput["roleScope"] | undefined,
  _settings: BriefInput["settings"]
): Record<string, unknown> {
  const userRole = scope?.userRole ?? "staff";
  const roleKey = String(userRole ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const derived = screensForRole(roleKey);
  const visibleScreens = (scope?.visibleScreens?.length ? scope.visibleScreens : derived)
    .map((label) => screenLabelByName(label) ?? label)
    .filter((label): label is string => Boolean(label));
  const activeScreen = scope?.activeScreen ?? null;

  return {
    /** The role whose permissions shaped this brief. The assistant uses this
     * to decide what it may answer about.
     */
    assistant_role: roleKey,
    assistant_role_label: aiRoleLabel(roleKey),

    /** Screens this user can open. The assistant restricts its answers to data
     * from these screens and says "not available to you" for anything else.
     */
    screens_available_to_this_user: visibleScreens,

    /** The screen the user is on right now, if any. The assistant uses this to
     * prefer contextual, in-screen answers and suggestions.
     */
    active_screen: activeScreen,

    /** What each screen contains, so the assistant can point the user at the
     * right place without guessing.
     */
    screen_index: [
      {
        name: "Overview",
        what_is_here: [
          "school-wide headline numbers: enrolment, attendance, fees, academics",
          "headline health and activity indicators",
          "quick-access cards to every other screen",
        ],
        typical_questions: [
          "How is the school doing overall?",
          "What are the headline numbers today?",
          "Where do I record attendance / fees / exams?",
        ],
      },
      {
        name: "Students",
        what_is_here: [
          "every enrolled student: name, grade, section, admission number, attendance average, academics average, status",
          "per-student attendance records and scored papers counts",
          "search and filter by name, grade, section",
        ],
        typical_questions: [
          "Which students are in Grade 5?",
          "Who has the lowest attendance?",
          "Find a student by admission number",
        ],
        role_note: "Every role that can see this screen sees the full student list the school is allowed to show them.",
      },
      {
        name: "Documents",
        what_is_here: [
          "the document checklist per student: which required documents are on file and which are missing",
          "progress per class and across the school",
        ],
        typical_questions: [
          "Which students are missing documents?",
          "How complete are the document records?",
        ],
        role_note: "Identity documents are restricted to admin and super-admin accounts on this screen.",
      },
      {
        name: "Attendance",
        what_is_here: [
          "class-wise attendance percentages across loaded dates",
          "today's daily register: present, absent, late, on leave",
          "weakest and below-threshold classes",
        ],
        typical_questions: [
          "Which class has the lowest attendance?",
          "How many students were present today?",
          "Which classes are below 90% attendance?",
        ],
      },
      {
        name: "Fees & Finance",
        what_is_here: [
          "every invoice: family, student, due date, amount, status",
          "fee categories with amounts",
          "monthly collected vs pending totals",
          "collection percentage, outstanding and overdue totals",
        ],
        typical_questions: [
          "Which fees are still outstanding?",
          "Who owes the most?",
          "What is the collection rate?",
        ],
      },
      {
        name: "Analytics",
        what_is_here: [
          "grade-wise academic averages and attendance",
          "subject-wise averages",
          "year-long performance trend for Math, Science, English",
          "health and wellness metrics",
          "named students at risk, lowest averages first",
        ],
        typical_questions: [
          "Which grade is weakest academically?",
          "How has performance trended this year?",
          "Which subjects are strongest?",
        ],
      },
      {
        name: "Staff",
        what_is_here: [
          "every staff member: name, role, department, email, status",
          "timetable, exams, exam results, assignments visible to this role",
          "subjects, transport routes and vehicles visible to this role",
        ],
        typical_questions: [
          "Who teaches Science?",
          "Which staff are on campus today?",
          "Who is in the accounts department?",
        ],
        role_note: "Staff see their own department more closely; the assistant should not name a staff member's private details beyond what this screen shows.",
      },
      {
        name: "Academics",
        what_is_here: [
          "timetable for the selected day",
          "exams, exam results, assignments",
          "subjects on offer",
          "transport routes and vehicles relevant to this role",
        ],
        typical_questions: [
          "What is on the timetable today?",
          "Which exams are coming up?",
          "Which assignments are still unsubmitted?",
        ],
      },
      {
        name: "Examinations",
        what_is_here: [
          "exam schedule: name, subject, grade, date, time, venue, status",
          "exam results publishing queue",
          "assignment queue relevant to this role",
          "transport routes and vehicles relevant to this role",
        ],
        typical_questions: [
          "When is the next Grade 10 exam?",
          "Which exam results are still unpublished?",
          "What is the exam schedule this week?",
        ],
      },
      {
        name: "Assignments",
        what_is_here: [
          "assignment queue: title, subject, grade, student, submission status, late, graded",
          "transport routes and vehicles relevant to this role",
          "activity feed items for transport",
        ],
        typical_questions: [
          "Which assignments are still unsubmitted?",
          "Which students have late assignments?",
          "Show me the assignments for Grade 7",
        ],
      },
      {
        name: "Transport",
        what_is_here: [
          "routes: vehicle, driver, pickup point, student count, status",
          "vehicles: driver, driver phone, route code, route name, capacity, status",
          "transport activity feed",
        ],
        typical_questions: [
          "Which vehicle goes to a given pickup?",
          "Who is the driver on route X?",
          "Which routes are active?",
        ],
      },
      {
        name: "Reports",
        what_is_here: [
          "exported report list: name, created date, size",
        ],
        typical_questions: [
          "Which reports have been exported recently?",
          "Download the last fee report",
        ],
      },
      {
        name: "User management",
        what_is_here: [
          "people: id, name, email, role, access label, protected flag",
          "student portal login issuer",
          "invite workflow for staff and admins",
        ],
        typical_questions: [
          "Who has admin access?",
          "Invite a new staff member",
          "Who is the super admin?",
        ],
        role_note: "Only super admins and admins can invite and change roles. Staff see a restricted view. The assistant must not tell anyone how to escalate their own access.",
      },
      {
        name: "Settings",
        what_is_here: [
          "school-wide settings: name, campus, address, phone, academic year, term, grade scale, attendance threshold, notification preferences",
          "AI assistant provider configuration (super admin only)",
          "password and profile controls for the signed-in user",
        ],
        typical_questions: [
          "What are the school's current settings?",
          "Change the attendance threshold",
          "Configure the AI assistant",
        ],
        role_note: "AI assistant configuration is visible only to the super admin. The assistant should not describe or change that panel for anyone else.",
      },
    ],
  };
}
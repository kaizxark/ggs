import { describe, expect, it } from "vitest";
import { buildAssistantBrief, rupees } from "./ai-context";
import type {
  AttendanceDaily,
  ClassAttendanceRow,
  GradeOutcome,
  Invoice,
  StaffMember,
  Student,
} from "./school-data";

/**
 * These assertions encode the two things that made the assistant useless: an
 * unlabelled number the model could misread, and a fact the model simply did
 * not have. Each test names one of those failures.
 */

const students = [
  { id: "1", name: "Aarav Sharma", initials: "AS", grade: "5", section: "B", attendance: 71, attendance_records: 60, average: 64, scored_papers: 5, fees: "Due", transport: "—", status: "Active", tone: "teal", admission_no: "GKS-0111" },
  { id: "2", name: "Diya Nair", initials: "DN", grade: "8", section: "A", attendance: 73, attendance_records: 58, average: 81, scored_papers: 6, fees: "Paid", transport: "Bus 2", status: "Active", tone: "blue", admission_no: "GKS-0204" },
  { id: "3", name: "Rohan Iyer", initials: "RI", grade: "3", section: "C", attendance: 0, attendance_records: 0, average: 58, scored_papers: 2, fees: "Due", transport: "—", status: "Active", tone: "violet", admission_no: "GKS-0342" },
  { id: "4", name: "Sara Khan", initials: "SK", grade: "5", section: "B", attendance: 96, attendance_records: 62, average: 92, scored_papers: 6, fees: "Paid", transport: "Van 1", status: "Active", tone: "amber", admission_no: "GKS-0112" },
  { id: "5", name: "Inactive Pupil", initials: "IP", grade: "5", section: "B", attendance: 40, attendance_records: 50, average: 20, scored_papers: 3, fees: "Due", transport: "—", status: "Inactive", tone: "slate", admission_no: "GKS-0999" },
] as unknown as Student[];

const staff = [
  { id: "s1", name: "Meera Rao", initials: "MR", role: "Teacher", department: "Mathematics", email: "m@g", attendance: 98, status: "Active", tone: "teal" },
  { id: "s2", name: "Anil Das", initials: "AD", role: "Teacher", department: "Mathematics", email: "a@g", attendance: 97, status: "Active", tone: "blue" },
  { id: "s3", name: "Kiran Bhat", initials: "KB", role: "Clerk", department: "Administration", email: "k@g", attendance: 95, status: "Active", tone: "violet" },
] as unknown as StaffMember[];

const classAttendance = [
  { id: "c1", label: "Grade 5 — B", value: 88.1, present: 47, total: 53, teacher: "Meera Rao" },
  { id: "c2", label: "Grade 3 — C", value: 94.2, present: 51, total: 54, teacher: "Anil Das" },
  { id: "c3", label: "Grade 8 — A", value: 96.4, present: 53, total: 55, teacher: "Kiran Bhat" },
] as unknown as ClassAttendanceRow[];

const dailyAttendance = [
  { id: "d1", day: "Wed", present: 1200, absent: 40, late: 12, leave: 8 },
  { id: "d2", day: "Thu", present: 1180, absent: 55, late: 15, leave: 6 },
] as unknown as AttendanceDaily[];

const invoices = [
  { id: "i1", family: "Menon family", student: "Kabir Menon", due_date: "12 Sep", amount: 62000, status: "Overdue" },
  { id: "i2", family: "Bhat family", student: "Ira Bhat", due_date: "05 Oct", amount: 48500, status: "Overdue" },
  { id: "i3", family: "Nair family", student: "Diya Nair", due_date: "01 Oct", amount: 12000, status: "Partial" },
  { id: "i4", family: "Rao family", student: "Meera Rao", due_date: "01 Aug", amount: 40000, status: "Paid" },
] as unknown as Invoice[];

const gradeOutcomes = [
  { id: "g1", grade: "5", average: 62, attendance: 88, change: "-3.1" },
  { id: "g2", grade: "8", average: 79, attendance: 96, change: "+1.4" },
  { id: "g3", grade: "3", average: 71, attendance: 94, change: "0.0" },
] as unknown as GradeOutcome[];

function brief() {
  return buildAssistantBrief({
    students,
    staff,
    classAttendance,
    dailyAttendance,
    invoices,
    gradeOutcomes,
    now: new Date("2026-10-03T09:00:00Z"),
  }) as Record<string, never> & {
    [key: string]: any;
  };
}

describe("rupees", () => {
  it("uses lakh and crore rather than million", () => {
    expect(rupees(482000)).toBe("₹4.82 lakh");
    expect(rupees(3100000)).toBe("₹31.00 lakh");
    expect(rupees(12500000)).toBe("₹1.25 crore");
  });

  it("keeps small amounts exact with Indian digit grouping", () => {
    expect(rupees(62000)).toBe("₹62,000");
    expect(rupees(12000)).toBe("₹12,000");
    expect(rupees(120000)).toBe("₹1.20 lakh");
    expect(rupees(0)).toBe("₹0");
  });
});

describe("buildAssistantBrief", () => {
  it("labels every figure with its unit and population", () => {
    const b = brief();
    expect(b.school).toContain("Global Kids School");
    expect(b.how_to_read_this.join(" ")).toContain("rupees");
    expect(b.academic_context).toContain("2026-10-03");
  });

  it("names the areas the ERP does not track, so the model stops inventing", () => {
    const b = brief();
    expect(b.not_tracked_in_this_dashboard.length).toBeGreaterThan(3);
    expect(b.not_tracked_in_this_dashboard.join(" ")).toMatch(/library loans/i);
  });

  it("includes student names so 'who' questions are answerable", () => {
    const b = brief();
    const names = b.lowest_scoring_students.map((s: { name: string }) => s.name);
    expect(names).toContain("Rohan Iyer");
    expect(names).toContain("Aarav Sharma");
    // Lowest average first.
    expect(names[0]).toBe("Rohan Iyer");
    expect(b.lowest_scoring_students[0]).toMatchObject({
      grade: "3",
      average_score_pct: 58,
      risk_band: "At risk",
    });
  });

  it("excludes inactive students from the roll", () => {
    const b = brief();
    expect(b.headline.active_students).toBe(4);
    expect(
      b.lowest_scoring_students.some(
        (s: { name: string }) => s.name === "Inactive Pupil"
      )
    ).toBe(false);
  });

  it("attaches the class teacher to the weakest classes", () => {
    const b = brief();
    expect(b.worst_attendance_classes[0]).toMatchObject({
      class: "Grade 5 — B",
      attendance_pct: 88.1,
      class_teacher: "Meera Rao",
    });
  });

  it("separates collected, outstanding and overdue money in rupees", () => {
    const b = brief();
    // Paid 40,000; open 62,000 + 48,500 + 12,000 = 122,500; billed 162,500.
    expect(b.fees.collected_total).toBe("₹40,000");
    expect(b.fees.outstanding_total).toBe("₹1.23 lakh");
    expect(b.fees.overdue_total).toBe("₹1.10 lakh");
    expect(b.fees.collection_pct).toBe(24.6);
    expect(b.fees.invoices_overdue).toBe(2);
  });

  it("ranks the largest debtors first and names the family", () => {
    const b = brief();
    expect(b.top_outstanding_invoices[0]).toMatchObject({
      family: "Menon family",
      amount_due: "₹62,000",
      status: "Overdue",
    });
  });

  it("states how much of a truncated list is being shown", () => {
    const b = brief();
    // Three outstanding invoices and all three fit, so nothing is withheld.
    expect(b.top_outstanding_invoices_and_more).toBe("3 shown");
    // All four scored pupils fit under the cap, so the whole set is shown.
    expect(b.lowest_scoring_students_note).toContain("4 pupils");
  });

  it("counts below-50% averages the same way the Analytics screen does", () => {
    const b = brief();
    // Rohan 58 and Aarav 64 and Sara 92 and Diya 81 — nobody is below 50.
    expect(b.students_below_50_pct_average).toBe(0);
    expect(b.how_to_read_this.join(" ")).toMatch(/Critical below 50%/);
  });

  it("never reports an unmarked pupil as 0% attendance", () => {
    const b = brief();
    const rohan = b.lowest_scoring_students.find(
      (s: { name: string }) => s.name === "Rohan Iyer"
    );
    // He has no marked days, so the figure is withheld rather than zeroed.
    expect(rohan.attendance_pct).toBeNull();
    expect(rohan.scored_papers).toBe(2);
    expect(rohan.average_score_pct).toBe(58);

    // Sara is marked, so her real figure survives.
    const sara = b.lowest_scoring_students.find(
      (s: { name: string }) => s.name === "Sara Khan"
    );
    expect(sara.attendance_pct).toBe(96);

    // And the ready-made sentence says so in words rather than implying 0%.
    expect(b.ready_made_answers.risk).toContain("no attendance records");
    expect(b.ready_made_answers.risk).not.toMatch(/Rohan Iyer[^)]*0% attendance/);
  });

  it("pre-writes grounded sentences that carry their own units", () => {
    const b = brief();
    const ready = b.ready_made_answers;
    expect(ready.headcount).toContain("4 active students");
    expect(ready.fees).toContain("₹40,000");
    expect(ready.fees).toContain("24.6%");
    expect(ready.attendance).toContain("Grade 5 — B");
    expect(ready.risk).toContain("Rohan Iyer");
    expect(ready.academics).toContain("62%");
  });

  it("exposes the latest register separately from the class averages", () => {
    const b = brief();
    // The loader returns oldest-first, so the most recent recorded day wins —
    // here Thursday, not Wednesday.
    expect(b.attendance_today).toMatchObject({ day: "Thu", absent: 55 });
    expect(b.attendance_by_day[0].day).toBe("Thu");
    expect(b.how_to_read_this.join(" ")).toMatch(/NOT a register for today/i);
  });

  it("identifies weakest and strongest grades", () => {
    const b = brief();
    expect(b.weakest_grade).toBe("5");
    expect(b.strongest_grade).toBe("8");
  });

  it("counts staff by department", () => {
    const b = brief();
    expect(b.staff_by_department[0]).toEqual({
      department: "Mathematics",
      count: 2,
    });
    expect(b.staff_total).toBe(3);
  });

  it("does not report an empty dataset as a confident zero", () => {
    // The failure this guards: with no grade-outcome rows the brief used to say
    // "the school average across all grades is 0%", which reads as a real
    // finding rather than an absent one.
    const b = buildAssistantBrief({
      students,
      staff,
      classAttendance: [],
      dailyAttendance: [],
      invoices: [],
      gradeOutcomes: [],
    }) as Record<string, any>;

    expect(b.ready_made_answers.academics).not.toMatch(/average.*is 0%/);
    expect(b.ready_made_answers.attendance).toMatch(/No class attendance/);
    expect(b.ready_made_answers.fees).toMatch(/No invoices/);
    // Falls back to the pupils' own exam results rather than reporting zero.
    expect(b.headline.school_average_score_pct).toBeGreaterThan(0);
    expect(b.headline.school_average_score_basis).toMatch(/every pupil/);
  });

  it("says so plainly when nothing at all has been recorded", () => {
    const b = buildAssistantBrief({
      students: [],
      staff: [],
      classAttendance: [],
      dailyAttendance: [],
      invoices: [],
      gradeOutcomes: [],
    }) as Record<string, any>;
    expect(b.headline.school_average_score_pct).toBeNull();
    expect(b.headline.school_average_score_basis).toBe("no exam results recorded");
    expect(b.ready_made_answers.academics).toMatch(/No exam results/);
    expect(b.ready_made_answers.risk).toMatch(/No pupil-level scores/);
    expect(b.ready_made_answers.today).toMatch(/No daily attendance register/);
  });

  it("survives data that has not loaded yet", () => {
    // The palette mounts before the views resolve, so an empty brief must not
    // throw or produce NaN, which would reach the model as a confident lie.
    const empty = buildAssistantBrief({
      students: [],
      staff: [],
      classAttendance: [],
      dailyAttendance: [],
      invoices: [],
      gradeOutcomes: [],
    }) as Record<string, any>;
    expect(empty.headline.active_students).toBe(0);
    expect(empty.headline.overall_attendance_pct).toBe(0);
    expect(empty.fees.collection_pct).toBe(0);
    expect(empty.weakest_grade).toBeNull();
    expect(empty.attendance_today).toBeNull();
    expect(JSON.stringify(empty)).not.toMatch(/NaN|Infinity|null null/);
  });

  it("produces a brief small enough to send on every question", () => {
    const b = brief();
    expect(JSON.stringify(b).length).toBeLessThan(24000);
  });
});
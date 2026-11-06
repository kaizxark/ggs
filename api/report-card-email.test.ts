import { describe, it, expect, vi } from "vitest";
import handler, { buildReportCardHtml, type ReportCardPayload } from "./report-card-email";

const sampleReportCard: ReportCardPayload = {
  studentName: "Aarav Sharma",
  studentEmail: "aarav.sharma@example.com",
  usn: "GGS-2627-0104",
  grade: "Grade 8",
  section: "A",
  examTitle: "Term 1 Midterm Examination 2026",
  academicTerm: "Term 1 (2026–2027)",
  subjects: [
    { subject: "Mathematics", maxMarks: 100, passMarks: 40, marks: 92, grade: "A+", remarks: "Outstanding analytical work" },
    { subject: "Science", maxMarks: 100, passMarks: 40, marks: 88, grade: "A", remarks: "Excellent lab skills" },
    { subject: "English", maxMarks: 100, passMarks: 40, marks: 85, grade: "A", remarks: "Articulate writer" },
  ],
  grandTotal: 265,
  totalMaxMarks: 300,
  percentage: 88.3,
  overallGrade: "A+",
  resultStatus: "Promoted with Distinction",
  attendancePct: 96,
};

describe("api/report-card-email", () => {
  it("rejects non-POST methods", async () => {
    const req = new Request("http://localhost/api/report-card-email", { method: "GET" });
    const res = await handler(req);
    expect(res.status).toBe(405);
    const json = await res.json();
    expect(json.error).toBe("method_not_allowed");
  });

  it("rejects missing report card payload", async () => {
    const req = new Request("http://localhost/api/report-card-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("missing_fields");
  });

  it("successfully dispatches single report card", async () => {
    const req = new Request("http://localhost/api/report-card-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "single",
        reportCard: sampleReportCard,
      }),
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.sent).toBe(true);
    expect(json.count).toBe(1);
    expect(json.recipients).toContain("aarav.sharma@example.com");
  });

  it("successfully dispatches batch report cards", async () => {
    const secondCard: ReportCardPayload = {
      ...sampleReportCard,
      studentName: "Diya Patel",
      studentEmail: "diya.patel@example.com",
      usn: "GGS-2627-0105",
      subjects: [
        { subject: "Mathematics", maxMarks: 100, passMarks: 40, marks: null, grade: "ABS", remarks: "Absent", isAbsent: true },
      ],
      resultStatus: "Absent",
    };

    const req = new Request("http://localhost/api/report-card-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "batch",
        reportCards: [sampleReportCard, secondCard],
      }),
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.count).toBe(2);
    expect(json.recipients).toContain("aarav.sharma@example.com");
    expect(json.recipients).toContain("diya.patel@example.com");
  });

  it("builds valid HTML report card representation", () => {
    const html = buildReportCardHtml(sampleReportCard);
    expect(html).toContain("GLOBAL KIDS SCHOOL");
    expect(html).toContain("Aarav Sharma");
    expect(html).toContain("GGS-2627-0104");
    expect(html).toContain("Mathematics");
    expect(html).toContain("92 / 100");
    expect(html).toContain("Outstanding analytical work");
    expect(html).toContain("88.3%");
  });
});

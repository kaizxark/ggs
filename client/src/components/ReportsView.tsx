import { useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  IndianRupee,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useStudentsView,
  useInvoicesView,
  useStaffView,
  type Student,
  type Invoice,
  type StaffMember,
} from "../lib/erp-views";

export interface ReportsViewProps {
  onBack: () => void;
}

export type ReportType = "fees" | "attendance" | "students" | "staff";

interface ExportHistoryItem {
  id: string;
  name: string;
  type: ReportType;
  recordCount: number;
  timestamp: string;
  size: string;
}

/** Utility to generate and download real CSV files in UTF-8 with BOM */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };
  const csvContent = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatInr(val: number): string {
  return "₹" + Math.round(val).toLocaleString("en-IN");
}

export function ReportsView({ onBack }: ReportsViewProps) {
  const { rows: students, loading: studentsLoading } = useStudentsView();
  const { rows: invoices, loading: invoicesLoading } = useInvoicesView();
  const { rows: staff, loading: staffLoading } = useStaffView();

  const [activePreview, setActivePreview] = useState<ReportType | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [filterDefaultersOnly, setFilterDefaultersOnly] = useState(false);
  const [filterBelowThresholdOnly, setFilterBelowThresholdOnly] = useState(false);

  // Session export history tracking user-initiated downloads
  const [history, setHistory] = useState<ExportHistoryItem[]>([]);

  const recordExport = (name: string, type: ReportType, count: number) => {
    const item: ExportHistoryItem = {
      id: `hist-${Date.now()}`,
      name,
      type,
      recordCount: count,
      timestamp: "Just now",
      size: `${Math.max(12, Math.round(count * 0.28))} KB`,
    };
    setHistory((prev) => [item, ...prev]);
  };

  // --- Calculations for Fee Report ---
  const feeStats = useMemo(() => {
    let totalAssessed = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let defaulterCount = 0;

    if (invoices.length > 0) {
      invoices.forEach((inv) => {
        const amt = Number(inv.total ?? inv.amount ?? 0);
        const paid = Number(inv.paid ?? (inv.status?.toLowerCase() === "paid" ? amt : 0));
        const out = Number(inv.outstanding ?? Math.max(0, amt - paid));
        totalAssessed += amt;
        totalCollected += paid;
        if (out > 0) {
          totalPending += out;
          defaulterCount++;
        }
      });
    }

    return {
      totalAssessed,
      totalCollected,
      totalPending,
      defaulterCount,
    };
  }, [invoices]);

  // --- Calculations for Attendance Report ---
  const attendanceStats = useMemo(() => {
    if (!students.length) return { average: 0, belowThresholdCount: 0, total: 0 };
    const valid = students.filter((s) => typeof s.attendance === "number" && s.attendance > 0);
    const sum = valid.reduce((acc, s) => acc + s.attendance, 0);
    const average = valid.length ? Math.round((sum / valid.length) * 10) / 10 : 0;
    const belowThresholdCount = students.filter((s) => (s.attendance ?? 100) < 75).length;
    return { average, belowThresholdCount, total: students.length };
  }, [students]);

  // --- Calculations for Student Directory Report ---
  const studentStats = useMemo(() => {
    const gradesSet = new Set(students.map((s) => s.grade).filter(Boolean));
    return {
      total: students.length,
      gradeCount: gradesSet.size,
    };
  }, [students]);

  // --- Calculations for Staff Report ---
  const staffStats = useMemo(() => {
    const depts = new Set(staff.map((s) => s.department).filter(Boolean));
    return {
      total: staff.length,
      deptCount: depts.size,
    };
  }, [staff]);

  // Available grades for filtering
  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.grade) set.add(s.grade);
    });
    return Array.from(set).sort();
  }, [students]);

  // Export Handlers
  const handleExportFees = () => {
    const headers = [
      "Student USN",
      "Student Name",
      "Grade",
      "Section",
      "Total Assessed (INR)",
      "Paid Amount (INR)",
      "Outstanding Due (INR)",
      "Status",
    ];
    const rows = students.map((s) => {
      const inv = invoices.find((i) => i.student_id === s.id || i.student === s.name);
      const total = inv ? Number(inv.total ?? inv.amount ?? 0) : 0;
      const paid = inv ? Number(inv.paid ?? (inv.status?.toLowerCase() === "paid" ? total : 0)) : 0;
      const due = inv ? Number(inv.outstanding ?? Math.max(0, total - paid)) : 0;
      const isPaid = s.fees?.toLowerCase() === "paid" || due === 0;
      return [
        s.usn || `STU-${s.id}`,
        s.name,
        s.grade || "Unassigned",
        s.section || "—",
        total,
        paid,
        due,
        isPaid ? "Paid" : "Pending",
      ];
    });
    const filename = `Fee_Collection_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, headers, rows);
    recordExport(filename, "fees", rows.length);
    toast.success("Fee Collection Summary downloaded", {
      description: `${rows.length} records exported to CSV.`,
    });
  };

  const handleExportAttendance = () => {
    const headers = [
      "Student USN",
      "Student Name",
      "Grade",
      "Section",
      "Attendance Rate (%)",
      "Statutory Compliance",
      "Records Marked",
    ];
    const rows = students.map((s) => {
      const rate = s.attendance ?? 0;
      const compliance = rate >= 75 ? "Compliant (>=75%)" : "At-Risk (<75% CBSE Threshold)";
      return [
        s.usn || `STU-${s.id}`,
        s.name,
        s.grade || "Unassigned",
        s.section || "—",
        `${rate}%`,
        compliance,
        s.attendance_records ?? 0,
      ];
    });
    const filename = `Attendance_Compliance_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, headers, rows);
    recordExport(filename, "attendance", rows.length);
    toast.success("Attendance Compliance report downloaded", {
      description: `${rows.length} pupil attendance records exported.`,
    });
  };

  const handleExportStudents = () => {
    const headers = [
      "USN / Admission ID",
      "Full Name",
      "Enrolled Grade",
      "Section",
      "Enrollment Status",
      "Attendance (%)",
      "Fee Status",
    ];
    const rows = students.map((s) => [
      s.usn || `STU-${s.id}`,
      s.name,
      s.grade || "Unassigned",
      s.section || "—",
      s.status || "Active",
      `${s.attendance ?? 0}%`,
      s.fees || "Unpaid",
    ]);
    const filename = `Student_Census_Directory_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, headers, rows);
    recordExport(filename, "students", rows.length);
    toast.success("Student Census Directory downloaded", {
      description: `${rows.length} enrolled student rows exported.`,
    });
  };

  const handleExportStaff = () => {
    const headers = [
      "Staff USN",
      "Faculty / Officer Name",
      "Designation / Role",
      "Department",
      "Official Email",
      "Status",
    ];
    const rows = staff.map((member) => [
      member.usn || `STF-${member.id}`,
      member.name,
      member.role || "Faculty",
      member.department || "General",
      member.email || "—",
      member.status || "On campus",
    ]);
    const filename = `Staff_Faculty_Roster_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, headers, rows);
    recordExport(filename, "staff", rows.length);
    toast.success("Staff & Faculty Roster downloaded", {
      description: `${rows.length} faculty and officer records exported.`,
    });
  };

  // Dispatch export by type
  const triggerExportByType = (type: ReportType) => {
    if (type === "fees") handleExportFees();
    else if (type === "attendance") handleExportAttendance();
    else if (type === "students") handleExportStudents();
    else if (type === "staff") handleExportStaff();
  };

  return (
    <div className="page-stack">
      {/* Header with Title and Action */}
      <div className="page-intro">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-1">
            <span
              onClick={onBack}
              role="button"
              tabIndex={0}
              className="hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            >
              Global Kids School
            </span>
            <span>/</span>
            <span className="text-[var(--text-primary)] font-semibold">Reports</span>
          </div>
          <h1 className="page-title">Reports & Data Exports</h1>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => setBuilderOpen(true)}
        >
          <Plus size={15} />
          Custom report builder
        </button>
      </div>

      {/* 4 Core High-Utility School Reports */}
      <div className="report-card-grid">
        {/* Card 1: Fee Collection & Defaulters */}
        <div className="report-card flex flex-col justify-between group hover:border-[var(--brand)] transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="report-icon orange flex items-center justify-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning)]">
                <IndianRupee size={20} />
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning-border)]">
                {feeStats.defaulterCount} Defaulters
              </span>
            </div>
            <h3 className="mt-4 text-[15px] font-bold text-[var(--text-primary)]">
              Fee Collections & Defaulters
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              Term 1 fee collection ledger, tracking {formatInr(feeStats.totalPending)} pending dues and overdue accounts.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-[var(--border)] flex items-center gap-2">
            <button
              type="button"
              className="secondary-button compact flex-1 text-xs"
              onClick={() => setActivePreview("fees")}
            >
              Preview
            </button>
            <button
              type="button"
              className="primary-button compact text-xs flex items-center gap-1.5 px-3"
              onClick={handleExportFees}
              title="Download CSV"
            >
              <Download size={13} />
              CSV
            </button>
          </div>
        </div>

        {/* Card 2: Attendance Compliance */}
        <div className="report-card flex flex-col justify-between group hover:border-[var(--brand)] transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="report-icon teal flex items-center justify-center rounded-xl bg-[var(--success-soft)] text-[var(--success)]">
                <ShieldCheck size={20} />
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
                  attendanceStats.average >= 90
                    ? "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success-border)]"
                    : attendanceStats.average >= 75
                      ? "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning-border)]"
                      : "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger-border)]"
                }`}
              >
                {attendanceStats.average}% Average
              </span>
            </div>
            <h3 className="mt-4 text-[15px] font-bold text-[var(--text-primary)]">
              Attendance & Compliance Audit
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              Statutory attendance register flagging {attendanceStats.belowThresholdCount} pupils below the 75% CBSE threshold.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-[var(--border)] flex items-center gap-2">
            <button
              type="button"
              className="secondary-button compact flex-1 text-xs"
              onClick={() => setActivePreview("attendance")}
            >
              Preview
            </button>
            <button
              type="button"
              className="primary-button compact text-xs flex items-center gap-1.5 px-3"
              onClick={handleExportAttendance}
              title="Download CSV"
            >
              <Download size={13} />
              CSV
            </button>
          </div>
        </div>

        {/* Card 3: Student Census & Demographics */}
        <div className="report-card flex flex-col justify-between group hover:border-[var(--brand)] transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="report-icon blue flex items-center justify-center rounded-xl bg-[var(--info-soft)] text-[var(--info)]">
                <Users size={20} />
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[var(--info-soft)] text-[var(--info)] border border-[var(--info-border)]">
                {studentStats.total} Enrolled
              </span>
            </div>
            <h3 className="mt-4 text-[15px] font-bold text-[var(--text-primary)]">
              Student Census & Demographics
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              Institutional roster with USNs, enrolled grades, section allotments, and contact records across {studentStats.gradeCount} grades.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-[var(--border)] flex items-center gap-2">
            <button
              type="button"
              className="secondary-button compact flex-1 text-xs"
              onClick={() => setActivePreview("students")}
            >
              Preview
            </button>
            <button
              type="button"
              className="primary-button compact text-xs flex items-center gap-1.5 px-3"
              onClick={handleExportStudents}
              title="Download CSV"
            >
              <Download size={13} />
              CSV
            </button>
          </div>
        </div>

        {/* Card 4: Staff & Faculty Allocation */}
        <div className="report-card flex flex-col justify-between group hover:border-[var(--brand)] transition-all">
          <div>
            <div className="flex items-center justify-between">
              <span className="report-icon violet flex items-center justify-center rounded-xl bg-[var(--violet-soft)] text-[var(--violet)]">
                <GraduationCap size={20} />
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[var(--violet-soft)] text-[var(--violet)] border border-[var(--violet-border)]">
                {staffStats.total} Faculty
              </span>
            </div>
            <h3 className="mt-4 text-[15px] font-bold text-[var(--text-primary)]">
              Staff & Faculty Directory
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              Complete faculty roster with staff USNs, department designations, official emails, and campus duty status.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-[var(--border)] flex items-center gap-2">
            <button
              type="button"
              className="secondary-button compact flex-1 text-xs"
              onClick={() => setActivePreview("staff")}
            >
              Preview
            </button>
            <button
              type="button"
              className="primary-button compact text-xs flex items-center gap-1.5 px-3"
              onClick={handleExportStaff}
              title="Download CSV"
            >
              <Download size={13} />
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Export History Table with 1-Click Re-Download */}
      <section className="panel mt-3">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Export history</h2>
          </div>
        </div>
        <div className="history-list">
          {history.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No exports generated in this session. Generate a CSV export above to track download history.
            </div>
          ) : (
            history.map((item) => (
              <div className="history-row" key={item.id}>
                <span className="file-icon flex items-center justify-center rounded-lg bg-[var(--bg-input)] text-[var(--brand)]">
                  <FileSpreadsheet size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {item.name}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {item.timestamp} · {item.recordCount} rows · {item.size}
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary-button compact flex items-center gap-1.5 text-xs"
                  onClick={() => triggerExportByType(item.type)}
                >
                  <Download size={12} />
                  Download CSV
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODAL 1: Interactive Report Preview & Print Dialog                       */}
      {/* ========================================================================= */}
      {activePreview && (
        <div
          className="modal-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Report preview dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActivePreview(null);
          }}
        >
          <div
            className="modal printable-report-dialog"
            style={{
              width: "min(960px, 95vw)",
              height: "min(780px, 92vh)",
              maxHeight: "min(780px, 92vh)",
              display: "flex",
              flexDirection: "column",
              borderRadius: 18,
              overflow: "hidden",
              background: "var(--bg-panel)",
              backdropFilter: "blur(36px) saturate(190%)",
              WebkitBackdropFilter: "blur(36px) saturate(190%)",
              border: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow-dialog)",
            }}
          >
            {/* Header */}
            <div
              className="modal-header no-print"
              style={{
                padding: "16px 22px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-panel)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="panel-title" style={{ fontSize: 17, margin: 0 }}>
                    {activePreview === "fees" && "Fee Collections & Defaulters Summary"}
                    {activePreview === "attendance" && "Attendance Compliance & Risk Audit"}
                    {activePreview === "students" && "Student Census & Demographics Directory"}
                    {activePreview === "staff" && "Faculty & Staff Institutional Roster"}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand-border)]">
                    Live Database
                  </span>
                </div>
                <p className="panel-subtitle" style={{ margin: "2px 0 0", fontSize: 12 }}>
                  Generated on {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · Confidential Institutional Record
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="secondary-button compact text-xs flex items-center gap-1.5"
                  onClick={() => window.print()}
                >
                  <Printer size={13} />
                  Print / PDF
                </button>
                <button
                  type="button"
                  className="primary-button compact text-xs flex items-center gap-1.5"
                  onClick={() => triggerExportByType(activePreview)}
                >
                  <Download size={13} />
                  Download CSV
                </button>
                <button
                  type="button"
                  className="search-clear ml-2"
                  onClick={() => setActivePreview(null)}
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Print Only Header (Visible only when printing) */}
            <div className="hidden print:block p-6 border-b border-black text-black">
              <h1 className="text-xl font-bold">Global Kids School — Official Institutional Report</h1>
              <p className="text-sm text-gray-600 mt-1">
                Report: {activePreview.toUpperCase()} · Generated on {new Date().toLocaleString()}
              </p>
            </div>

            {/* Filter Bar */}
            <div
              className="no-print p-3 sm:px-6 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-panel)]/40"
            >
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
                <div className="relative w-full">
                  <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search pupil, staff or USN…"
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2 text-[var(--text-muted)] hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activePreview !== "staff" && (
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="text-xs py-1.5 px-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)] outline-none focus:border-[var(--brand)] cursor-pointer"
                  >
                    <option value="all">All Grades</option>
                    {availableGrades.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                )}

                {activePreview === "fees" && (
                  <button
                    type="button"
                    onClick={() => setFilterDefaultersOnly((prev) => !prev)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                      filterDefaultersOnly
                        ? "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning-border)]"
                        : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border)]"
                    }`}
                  >
                    Defaulters only
                  </button>
                )}

                {activePreview === "attendance" && (
                  <button
                    type="button"
                    onClick={() => setFilterBelowThresholdOnly((prev) => !prev)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                      filterBelowThresholdOnly
                        ? "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger-border)]"
                        : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border)]"
                    }`}
                  >
                    Below 75% threshold only
                  </button>
                )}
              </div>
            </div>

            {/* Modal Body: Table Preview */}
            <div className="modal-body overflow-y-auto p-0 flex-1">
              {activePreview === "fees" && (
                <table className="data-table w-full text-left">
                  <thead className="sticky top-0 z-10 bg-[var(--bg-raised)]">
                    <tr className="bg-[var(--bg-raised)]">
                      <th className="bg-[var(--bg-raised)]">Pupil USN</th>
                      <th className="bg-[var(--bg-raised)]">Student Name</th>
                      <th className="bg-[var(--bg-raised)]">Class</th>
                      <th className="bg-[var(--bg-raised)]">Assessed</th>
                      <th className="bg-[var(--bg-raised)]">Paid</th>
                      <th className="bg-[var(--bg-raised)]">Outstanding</th>
                      <th className="bg-[var(--bg-raised)]">Fee Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .filter((s) => {
                        if (searchQuery) {
                          const q = searchQuery.toLowerCase();
                          if (!s.name.toLowerCase().includes(q) && !s.usn?.toLowerCase().includes(q)) {
                            return false;
                          }
                        }
                        if (selectedGrade !== "all" && s.grade !== selectedGrade) return false;
                        if (filterDefaultersOnly && s.fees?.toLowerCase() === "paid") return false;
                        return true;
                      })
                      .map((s) => {
                        const inv = invoices.find((i) => i.student_id === s.id || i.student === s.name);
                        const total = inv ? Number(inv.total ?? inv.amount ?? 0) : 0;
                        const paid = inv ? Number(inv.paid ?? (inv.status?.toLowerCase() === "paid" ? total : 0)) : 0;
                        const due = inv ? Number(inv.outstanding ?? Math.max(0, total - paid)) : 0;
                        const isPaid = s.fees?.toLowerCase() === "paid" || due === 0;
                        return (
                          <tr key={s.id}>
                            <td className="font-mono text-xs text-[var(--brand)]">{s.usn || `STU-${s.id}`}</td>
                            <td className="font-semibold text-[var(--text-primary)]">{s.name}</td>
                            <td>{s.grade || "Unassigned"} - {s.section || "—"}</td>
                            <td>₹{total.toLocaleString("en-IN")}</td>
                            <td className="text-[var(--success)]">₹{paid.toLocaleString("en-IN")}</td>
                            <td className={due > 0 ? "text-[var(--warning)] font-semibold" : "text-[var(--text-muted)]"}>
                              {due > 0 ? `₹${due.toLocaleString("en-IN")}` : "₹0"}
                            </td>
                            <td>
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  isPaid
                                    ? "bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success-border)]"
                                    : "bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning-border)]"
                                }`}
                              >
                                {isPaid ? "Paid in full" : "Pending due"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}

              {activePreview === "attendance" && (
                <table className="data-table w-full text-left">
                  <thead className="sticky top-0 z-10 bg-[var(--bg-raised)]">
                    <tr className="bg-[var(--bg-raised)]">
                      <th className="bg-[var(--bg-raised)]">Pupil USN</th>
                      <th className="bg-[var(--bg-raised)]">Student Name</th>
                      <th className="bg-[var(--bg-raised)]">Class</th>
                      <th className="bg-[var(--bg-raised)]">Attendance</th>
                      <th className="bg-[var(--bg-raised)]">Statutory Compliance</th>
                      <th className="bg-[var(--bg-raised)]">Marked Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .filter((s) => {
                        if (searchQuery) {
                          const q = searchQuery.toLowerCase();
                          if (!s.name.toLowerCase().includes(q) && !s.usn?.toLowerCase().includes(q)) {
                            return false;
                          }
                        }
                        if (selectedGrade !== "all" && s.grade !== selectedGrade) return false;
                        const rate = s.attendance ?? 0;
                        if (filterBelowThresholdOnly && rate >= 75) return false;
                        return true;
                      })
                      .map((s) => {
                        const rate = s.attendance ?? 0;
                        const atRisk = rate < 75;
                        return (
                          <tr key={s.id}>
                            <td className="font-mono text-xs text-[var(--brand)]">{s.usn || `STU-${s.id}`}</td>
                            <td className="font-semibold text-[var(--text-primary)]">{s.name}</td>
                            <td>{s.grade || "Unassigned"} - {s.section || "—"}</td>
                            <td>
                              <span
                                className={`font-semibold ${
                                  atRisk ? "text-[var(--danger)]" : rate >= 90 ? "text-[var(--success)]" : "text-[var(--warning)]"
                                }`}
                              >
                                {rate}%
                              </span>
                            </td>
                            <td>
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5 w-fit ${
                                  atRisk
                                    ? "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger-border)]"
                                    : "bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success-border)]"
                                }`}
                              >
                                {atRisk ? <ShieldAlert size={12} /> : <Check size={12} />}
                                {atRisk ? "At-Risk (<75% CBSE Threshold)" : "Compliant"}
                              </span>
                            </td>
                            <td className="text-[var(--text-muted)]">{s.attendance_records ?? 0} recorded</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}

              {activePreview === "students" && (
                <table className="data-table w-full text-left">
                  <thead className="sticky top-0 z-10 bg-[var(--bg-raised)]">
                    <tr className="bg-[var(--bg-raised)]">
                      <th className="bg-[var(--bg-raised)]">Pupil USN</th>
                      <th className="bg-[var(--bg-raised)]">Student Name</th>
                      <th className="bg-[var(--bg-raised)]">Enrolled Class</th>
                      <th className="bg-[var(--bg-raised)]">Section</th>
                      <th className="bg-[var(--bg-raised)]">Status</th>
                      <th className="bg-[var(--bg-raised)]">Attendance</th>
                      <th className="bg-[var(--bg-raised)]">Fee Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .filter((s) => {
                        if (searchQuery) {
                          const q = searchQuery.toLowerCase();
                          if (!s.name.toLowerCase().includes(q) && !s.usn?.toLowerCase().includes(q)) {
                            return false;
                          }
                        }
                        if (selectedGrade !== "all" && s.grade !== selectedGrade) return false;
                        return true;
                      })
                      .map((s) => (
                        <tr key={s.id}>
                          <td className="font-mono text-xs text-[var(--brand)]">{s.usn || `STU-${s.id}`}</td>
                          <td className="font-semibold text-[var(--text-primary)]">{s.name}</td>
                          <td>{s.grade || "Unassigned"}</td>
                          <td>{s.section ? `Section ${s.section}` : "—"}</td>
                          <td>
                            <span className="capitalize px-2 py-0.5 rounded text-[11px] bg-[var(--info-soft)] text-[var(--info)] border border-[var(--info-border)]">
                              {s.status || "Active"}
                            </span>
                          </td>
                          <td>{s.attendance ?? 0}%</td>
                          <td>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                s.fees?.toLowerCase() === "paid"
                                  ? "bg-[var(--success-soft)] text-[var(--success)]"
                                  : "bg-[var(--warning-soft)] text-[var(--warning)]"
                              }`}
                            >
                              {s.fees || "Unpaid"}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}

              {activePreview === "staff" && (
                <table className="data-table w-full text-left">
                  <thead className="sticky top-0 z-10 bg-[var(--bg-raised)]">
                    <tr className="bg-[var(--bg-raised)]">
                      <th className="bg-[var(--bg-raised)]">Staff USN</th>
                      <th className="bg-[var(--bg-raised)]">Faculty Name</th>
                      <th className="bg-[var(--bg-raised)]">Designation</th>
                      <th className="bg-[var(--bg-raised)]">Department</th>
                      <th className="bg-[var(--bg-raised)]">Official Email</th>
                      <th className="bg-[var(--bg-raised)]">Campus Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff
                      .filter((m) => {
                        if (searchQuery) {
                          const q = searchQuery.toLowerCase();
                          if (
                            !m.name.toLowerCase().includes(q) &&
                            !m.usn?.toLowerCase().includes(q) &&
                            !m.department?.toLowerCase().includes(q)
                          ) {
                            return false;
                          }
                        }
                        return true;
                      })
                      .map((m) => (
                        <tr key={m.id}>
                          <td className="font-mono text-xs text-[var(--brand)]">{m.usn || `STF-${m.id}`}</td>
                          <td className="font-semibold text-[var(--text-primary)]">{m.name}</td>
                          <td>{m.role || "Faculty"}</td>
                          <td>{m.department || "General"}</td>
                          <td className="text-[var(--text-secondary)]">{m.email || "—"}</td>
                          <td>
                            <span className="px-2 py-0.5 rounded text-[11px] bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success-border)]">
                              {m.status || "On campus"}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className="modal-footer no-print"
              style={{
                borderTop: "1px solid var(--border)",
                padding: "14px 22px",
                flexShrink: 0,
                background: "var(--bg-panel)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div className="text-xs text-[var(--text-muted)]">
                Showing live institutional data from active academic session.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setActivePreview(null)}
                >
                  Close preview
                </button>
                <button
                  type="button"
                  className="primary-button flex items-center gap-1.5"
                  onClick={() => triggerExportByType(activePreview)}
                >
                  <Download size={14} />
                  Export to CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Custom Report Builder Dialog                                    */}
      {/* ========================================================================= */}
      {builderOpen && (
        <div
          className="modal-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Custom report builder dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBuilderOpen(false);
          }}
        >
          <div
            className="modal"
            style={{
              width: "min(560px, 94vw)",
              borderRadius: 18,
              background: "var(--bg-panel)",
              backdropFilter: "blur(36px) saturate(190%)",
              WebkitBackdropFilter: "blur(36px) saturate(190%)",
              border: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow-dialog)",
            }}
          >
            <div
              className="modal-header"
              style={{
                padding: "16px 22px",
                background: "var(--bg-panel)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <h2 className="panel-title" style={{ fontSize: 17, margin: 0 }}>
                  Build Custom Institutional Report
                </h2>
                <p className="panel-subtitle" style={{ margin: "2px 0 0", fontSize: 12 }}>
                  Configure scope, filters, and target dataset for instantaneous export.
                </p>
              </div>
              <button
                type="button"
                className="search-clear"
                onClick={() => setBuilderOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                  Target Dataset
                </label>
                <select
                  id="builder-dataset-select"
                  className="w-full text-xs py-2 px-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
                  defaultValue="fees"
                >
                  <option value="fees">Fee Collections & Outstanding Balances</option>
                  <option value="attendance">Statutory Attendance & Compliance Register</option>
                  <option value="students">Student Census & Demographics Directory</option>
                  <option value="staff">Staff, Educators & Faculty Directory</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                  Academic Grade Filter
                </label>
                <select
                  id="builder-grade-select"
                  className="w-full text-xs py-2 px-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
                  defaultValue="all"
                >
                  <option value="all">All Enrolled Classes (Grade 6–10)</option>
                  {availableGrades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-[var(--brand)] bg-[var(--brand-soft)]/20 flex items-center gap-2.5">
                    <FileSpreadsheet size={18} className="text-[var(--brand)]" />
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">CSV Spreadsheet</div>
                      <div className="text-[10.5px] text-[var(--text-muted)]">Excel & Google Sheets ready</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] flex items-center gap-2.5 opacity-80">
                    <Printer size={18} className="text-[var(--text-muted)]" />
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">Printable PDF</div>
                      <div className="text-[10.5px] text-[var(--text-muted)]">Formal school letterhead</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                borderTop: "1px solid var(--border)",
                padding: "14px 22px",
                background: "var(--bg-panel)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={() => setBuilderOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button flex items-center gap-1.5"
                onClick={() => {
                  const sel = (document.getElementById("builder-dataset-select") as HTMLSelectElement)?.value as ReportType || "fees";
                  setBuilderOpen(false);
                  setActivePreview(sel);
                  toast.success("Report generated", {
                    description: `Loaded preview for ${sel.toUpperCase()} report.`,
                  });
                }}
              >
                <Check size={14} />
                Open Live Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

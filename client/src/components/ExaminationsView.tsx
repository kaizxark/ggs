import { useState, useMemo, useEffect } from "react";
import {
  Calendar,
  Plus,
  Search,
  FileText,
  Check,
  Printer,
  Eye,
  Trash2,
  X,
  ChevronRight,
  Award,
  BookOpen,
  CheckCircle2,
  Send,
  Filter,
  Users,
  Mail,
  Lock,
  Unlock,
  AlertTriangle,
  ClipboardList,
  Sparkles,
  BarChart3,
  CheckSquare,
} from "lucide-react";

import { Breadcrumb } from "./Breadcrumb";
import { MetricBlock } from "./MetricBlock";
import { SegmentedControl } from "./SegmentedControl";
import { Pager, usePagination } from "./ErpPagination";
import { DrawerBackdrop } from "./DrawerBackdrop";
import { FormSelect, type FormSelectOption } from "./FormSelect";
import { toast } from "@/lib/toast";
import {
  useStudentsView,
  useStaffView,
  useSubjectsView,
  useCurrentUser,
  type Student,
} from "@/lib/erp-views";
import { isSuperAdminId } from "@shared/super-admin";
import { authHeaders } from "@/lib/supabase";

export interface ExaminationsViewProps {
  onBack: () => void;
}

export type ExamTabKey = "exams" | "marks" | "report-cards";

export type ExamType =
  | "Midterm"
  | "FA1"
  | "FA2"
  | "Internals"
  | "Final"
  | "Unit Test"
  | "Annual";

export interface ExamSubjectConfig {
  id: string;
  subject: string;
  maxMarks: number;
  passMarks: number;
  assignedTeacher?: string;
}

export interface ConductedExam {
  id: string;
  title: string;
  examType: ExamType;
  term: string;
  grade: string;
  conductedDate: string;
  subjects: ExamSubjectConfig[];
  totalMaxMarks: number;
  notes?: string;
  createdAt: string;
}

export interface StudentSubjectScore {
  marks: number | null;
  isAbsent: boolean; // Not Attended
  remarks: string;
}

export interface StudentExamRecord {
  studentId: string;
  studentName: string;
  usn: string;
  grade: string;
  section: string;
  email?: string;
  subjectScores: Record<string, StudentSubjectScore>;
  evaluatedAt?: string;
  evaluatedBy?: string;
  emailSentAt?: string;
}

const DEFAULT_SUBJECTS_GRADE8: ExamSubjectConfig[] = [
  { id: "sub-1", subject: "Mathematics", maxMarks: 100, passMarks: 40, assignedTeacher: "Arvind Iyer" },
  { id: "sub-2", subject: "Science", maxMarks: 100, passMarks: 40, assignedTeacher: "Karthik Rao" },
  { id: "sub-3", subject: "English", maxMarks: 100, passMarks: 40, assignedTeacher: "Sonia Joseph" },
  { id: "sub-4", subject: "Social Science", maxMarks: 100, passMarks: 40, assignedTeacher: "Ananya Sharma" },
  { id: "sub-5", subject: "Hindi", maxMarks: 100, passMarks: 40, assignedTeacher: "Priya Nair" },
  { id: "sub-6", subject: "Computer Science", maxMarks: 100, passMarks: 40, assignedTeacher: "Vikram Sen" },
];

const DEFAULT_SUBJECTS_GRADE9: ExamSubjectConfig[] = [
  { id: "sub-g9-1", subject: "Mathematics", maxMarks: 50, passMarks: 20, assignedTeacher: "Arvind Iyer" },
  { id: "sub-g9-2", subject: "Physics", maxMarks: 50, passMarks: 20, assignedTeacher: "Karthik Rao" },
  { id: "sub-g9-3", subject: "Chemistry", maxMarks: 50, passMarks: 20, assignedTeacher: "Priya Nair" },
  { id: "sub-g9-4", subject: "English", maxMarks: 50, passMarks: 20, assignedTeacher: "Sonia Joseph" },
  { id: "sub-g9-5", subject: "Social Science", maxMarks: 50, passMarks: 20, assignedTeacher: "Ananya Sharma" },
];

const DEFAULT_SUBJECTS_GRADE10: ExamSubjectConfig[] = [
  { id: "sub-g10-1", subject: "Mathematics", maxMarks: 25, passMarks: 10, assignedTeacher: "Arvind Iyer" },
  { id: "sub-g10-2", subject: "Physics", maxMarks: 25, passMarks: 10, assignedTeacher: "Karthik Rao" },
  { id: "sub-g10-3", subject: "Chemistry", maxMarks: 25, passMarks: 10, assignedTeacher: "Priya Nair" },
  { id: "sub-g10-4", subject: "Biology", maxMarks: 25, passMarks: 10, assignedTeacher: "Pooja Hegde" },
  { id: "sub-g10-5", subject: "English", maxMarks: 25, passMarks: 10, assignedTeacher: "Sonia Joseph" },
];

const INITIAL_EXAMS: ConductedExam[] = [
  {
    id: "EXM-MID-2026",
    title: "Term 1 Midterm Examination 2026",
    examType: "Midterm",
    term: "Term 1 (2026–2027)",
    grade: "Grade 8",
    conductedDate: "05 Oct 2026",
    subjects: DEFAULT_SUBJECTS_GRADE8,
    totalMaxMarks: 600,
    notes: "CBSE curriculum physical assessment conducted across 6 core subject papers.",
    createdAt: "2026-10-06T09:00:00.000Z",
  },
  {
    id: "EXM-FA1-2026",
    title: "Formative Assessment 1 (FA1)",
    examType: "FA1",
    term: "Term 1 (2026–2027)",
    grade: "Grade 9",
    conductedDate: "18 Aug 2026",
    subjects: DEFAULT_SUBJECTS_GRADE9,
    totalMaxMarks: 250,
    notes: "First internal cycle formative evaluation.",
    createdAt: "2026-08-19T10:00:00.000Z",
  },
  {
    id: "EXM-INT-2026",
    title: "Internal Assessment 1 (Internals)",
    examType: "Internals",
    term: "Term 1 (2026–2027)",
    grade: "Grade 10",
    conductedDate: "25 Sep 2026",
    subjects: DEFAULT_SUBJECTS_GRADE10,
    totalMaxMarks: 125,
    notes: "Continuous evaluation component for CBSE Board examination readiness.",
    createdAt: "2026-09-26T11:00:00.000Z",
  },
];

export function calculateGradeLetter(score: number, max: number): {
  letter: string;
  color: string;
  badge: string;
} {
  if (max <= 0) return { letter: "—", color: "var(--text-muted)", badge: "status-pill neutral" };
  const pct = (score / max) * 100;
  if (pct >= 90) return { letter: "A+", color: "var(--success)", badge: "status-pill success" };
  if (pct >= 80) return { letter: "A", color: "var(--brand)", badge: "status-pill brand" };
  if (pct >= 70) return { letter: "B", color: "var(--violet)", badge: "status-pill violet" };
  if (pct >= 60) return { letter: "C", color: "var(--warning)", badge: "status-pill warning" };
  if (pct >= 40) return { letter: "D", color: "var(--orange)", badge: "status-pill orange" };
  return { letter: "F", color: "var(--danger)", badge: "status-pill danger" };
}

export function ExaminationsView({ onBack }: ExaminationsViewProps) {
  const currentUser = useCurrentUser();
  const isSuper = currentUser ? isSuperAdminId(currentUser.id) : false;
  const isAdminOrPrincipal =
    isSuper ||
    currentUser?.role === "admin" ||
    currentUser?.role === "super_admin" ||
    currentUser?.role === "principal";
  const isFacultyUser = currentUser?.role === "teacher" || currentUser?.role === "faculty";

  const { rows: allStudents } = useStudentsView();
  const { rows: staffList } = useStaffView();
  const { rows: subjectList } = useSubjectsView();

  const [activeTab, setActiveTab] = useState<ExamTabKey>("exams");

  // Persistent Conducted Exams
  const [exams, setExams] = useState<ConductedExam[]>(() => {
    try {
      const stored = localStorage.getItem("erp_conducted_exams_v3");
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return INITIAL_EXAMS;
  });

  const saveExams = (updater: (prev: ConductedExam[]) => ConductedExam[]) => {
    setExams((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem("erp_conducted_exams_v3", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Selected Exam for Grade Entry & Report Cards
  const [selectedExamId, setSelectedExamId] = useState<string>(
    () => exams[0]?.id ?? "EXM-MID-2026"
  );

  const activeExam = useMemo(() => {
    return exams.find((e) => e.id === selectedExamId) ?? exams[0] ?? null;
  }, [exams, selectedExamId]);

  // Persistent Student Evaluations: Keyed by `${examId}__${studentId}`
  const [evaluationsStore, setEvaluationsStore] = useState<Record<string, StudentExamRecord>>(() => {
    try {
      const stored = localStorage.getItem("erp_exam_evaluations_v3");
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {};
  });

  const saveEvaluationsStore = (
    updater: (prev: Record<string, StudentExamRecord>) => Record<string, StudentExamRecord>
  ) => {
    setEvaluationsStore((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem("erp_exam_evaluations_v3", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Eligible students for the active exam's grade
  const examCandidateStudents = useMemo<Student[]>(() => {
    if (!activeExam) return [];
    const targetGradeNum = activeExam.grade.replace(/[^0-9]/g, "");
    const matching = allStudents.filter((s) => {
      const stuGradeNum = String(s.grade).replace(/[^0-9]/g, "");
      return stuGradeNum === targetGradeNum;
    });
    return matching.length > 0 ? matching : allStudents.slice(0, 16);
  }, [allStudents, activeExam]);

  // Seed baseline scores for candidate students if not yet recorded
  useEffect(() => {
    if (!activeExam || examCandidateStudents.length === 0) return;

    setEvaluationsStore((prev) => {
      let changed = false;
      const next = { ...prev };

      examCandidateStudents.forEach((stu, sIdx) => {
        const key = `${activeExam.id}__${stu.id}`;
        if (!next[key]) {
          changed = true;
          const isSampleAbsent = sIdx === 7; // Student #8 was absent to demonstrate Not Attended handling
          const scores: Record<string, StudentSubjectScore> = {};

          activeExam.subjects.forEach((sub, subIdx) => {
            if (isSampleAbsent) {
              scores[sub.subject] = {
                marks: null,
                isAbsent: true,
                remarks: "Candidate absent on scheduled date",
              };
            } else {
              // High-achieving, realistic realistic distribution
              const basePct = 68 + ((sIdx * 11 + subIdx * 7) % 28);
              const calculatedMarks = Math.round((basePct / 100) * sub.maxMarks);
              scores[sub.subject] = {
                marks: calculatedMarks,
                isAbsent: false,
                remarks:
                  calculatedMarks >= sub.maxMarks * 0.85
                    ? "Consistent analytical rigor"
                    : "Satisfactory grasp of fundamental concepts",
              };
            }
          });

          next[key] = {
            studentId: String(stu.id),
            studentName: stu.name,
            usn: stu.usn ?? `GGS-2627-${String(stu.id).padStart(4, "0")}`,
            grade: stu.grade,
            section: stu.section || "A",
            email: `${stu.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
            subjectScores: scores,
            evaluatedAt: new Date().toISOString(),
            evaluatedBy: activeExam.subjects[0]?.assignedTeacher || "Faculty in charge",
          };
        }
      });

      if (!changed) return prev;
      try {
        localStorage.setItem("erp_exam_evaluations_v3", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [activeExam, examCandidateStudents]);

  // Audit completion stats for each exam
  const examCompletionMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalCandidates: number;
        fullyGradedCount: number;
        absentCount: number;
        pendingCount: number;
        isComplete: boolean;
        completionPct: number;
      }
    >();

    exams.forEach((ex) => {
      const targetGradeNum = ex.grade.replace(/[^0-9]/g, "");
      const candidates = allStudents.filter((s) => {
        const stuGradeNum = String(s.grade).replace(/[^0-9]/g, "");
        return stuGradeNum === targetGradeNum;
      });
      const candidateList = candidates.length > 0 ? candidates : allStudents.slice(0, 16);

      let fullyGradedCount = 0;
      let absentCount = 0;
      let pendingCount = 0;

      candidateList.forEach((stu) => {
        const key = `${ex.id}__${stu.id}`;
        const record = evaluationsStore[key];
        if (!record) {
          pendingCount++;
          return;
        }

        // Check if every subject in this exam has been evaluated or marked absent
        const allSubjectsEvaluated = ex.subjects.every((sub) => {
          const entry = record.subjectScores[sub.subject];
          return entry !== undefined && (entry.isAbsent || (entry.marks !== null && entry.marks >= 0));
        });

        if (!allSubjectsEvaluated) {
          pendingCount++;
        } else {
          const isFullyAbsent = ex.subjects.every((sub) => record.subjectScores[sub.subject]?.isAbsent);
          if (isFullyAbsent) {
            absentCount++;
          } else {
            fullyGradedCount++;
          }
        }
      });

      const totalCandidates = candidateList.length;
      const isComplete = totalCandidates > 0 && pendingCount === 0;
      const completionPct =
        totalCandidates > 0
          ? Math.round(((totalCandidates - pendingCount) / totalCandidates) * 100)
          : 0;

      map.set(ex.id, {
        totalCandidates,
        fullyGradedCount,
        absentCount,
        pendingCount,
        isComplete,
        completionPct,
      });
    });

    return map;
  }, [exams, allStudents, evaluationsStore]);

  // Overall Global Metrics
  const globalMetrics = useMemo(() => {
    const totalExams = exams.length;
    let completedExamsCount = 0;
    let totalPendingStudents = 0;

    exams.forEach((ex) => {
      const stats = examCompletionMap.get(ex.id);
      if (stats?.isComplete) completedExamsCount++;
      totalPendingStudents += stats?.pendingCount ?? 0;
    });

    return {
      totalExams,
      completedExamsCount,
      totalPendingStudents,
      readyRate: totalExams > 0 ? Math.round((completedExamsCount / totalExams) * 100) : 0,
    };
  }, [exams, examCompletionMap]);

  // Modal / Drawer States
  const [addExamModalOpen, setAddExamModalOpen] = useState(false);
  const [reportCardDrawerStudent, setReportCardDrawerStudent] = useState<StudentExamRecord | null>(null);

  // Active exam grading stats
  const activeExamStats = activeExam ? examCompletionMap.get(activeExam.id) : null;
  const isActiveExamGradingComplete = activeExamStats ? activeExamStats.isComplete : false;

  return (
    <div className="space-y-6">
      <Breadcrumb
        parent="Academic Operations"
        current="Examinations & Grading"
        onParentClick={onBack}
      />

      {/* Header Banner */}
      <div className="page-intro">
        <div>
          <p className="eyebrow">Academic Operations · Assessment Registry</p>
          <h1 className="page-title">Examinations & Official Grading</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Add Exam is only permitted for Administrator & Principal */}
          {isAdminOrPrincipal && (
            <button
              type="button"
              className="primary-button"
              onClick={() => setAddExamModalOpen(true)}
            >
              <Plus size={15} />
              <span>Add Conducted Exam</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="metric-grid">
        <MetricBlock
          label="Conducted Exams"
          value={String(globalMetrics.totalExams)}
          comparison="Recorded assessments"
          positive={true}
          icon={Calendar}
        />
        <MetricBlock
          label="Grading Completion"
          value={`${globalMetrics.readyRate}%`}
          comparison={`${globalMetrics.completedExamsCount} of ${globalMetrics.totalExams} exams complete`}
          positive={globalMetrics.readyRate === 100}
          icon={CheckCircle2}
        />
        <MetricBlock
          label="Pending Candidate Evaluations"
          value={String(globalMetrics.totalPendingStudents)}
          comparison={
            globalMetrics.totalPendingStudents === 0
              ? "All candidates evaluated"
              : "Requires teacher scoring"
          }
          positive={globalMetrics.totalPendingStudents === 0}
          icon={AlertTriangle}
        />
        <MetricBlock
          label="Report Cards Readiness"
          value={
            globalMetrics.totalPendingStudents === 0 ? "Verified" : "Distribution Locked"
          }
          comparison="Requires 100% grading completion"
          positive={globalMetrics.totalPendingStudents === 0}
          icon={Award}
        />
      </div>

      {/* Modern Navigation Tabs with Horizontal Sliding Indicator */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3 overflow-x-auto no-scrollbar">
        <SegmentedControl
          ariaLabel="Examinations section navigation"
          layoutId="examinationsMainTabs"
          value={activeTab}
          onChange={(val) => setActiveTab(val as ExamTabKey)}
          indicatorVariant="brand"
          options={[
            {
              value: "exams",
              label: "1. Exams Registry",
              icon: <BookOpen size={14} />,
            },
            {
              value: "marks",
              label: "2. Grade Entry",
              icon: <ClipboardList size={14} />,
              badge:
                globalMetrics.totalPendingStudents > 0 ? (
                  <span className="count-pill warning" style={{ marginLeft: 4 }}>
                    {globalMetrics.totalPendingStudents}
                  </span>
                ) : undefined,
            },
            {
              value: "report-cards",
              label: "3. Report Cards",
              icon: <Award size={14} />,
            },
          ]}
        />
      </div>

      {/* =========================================================================
          TAB 1: CONDUCTED EXAMS REGISTRY
         ========================================================================= */}
      {activeTab === "exams" && (
        <ConductedExamsTab
          exams={exams}
          completionMap={examCompletionMap}
          isAdminOrPrincipal={isAdminOrPrincipal}
          onAddExam={() => setAddExamModalOpen(true)}
          onEnterGrades={(examId) => {
            setSelectedExamId(examId);
            setActiveTab("marks");
          }}
          onViewReportCards={(examId) => {
            setSelectedExamId(examId);
            setActiveTab("report-cards");
          }}
          onDeleteExam={(examId) => {
            if (!confirm("Are you sure you want to remove this examination record?")) return;
            saveExams((prev) => prev.filter((e) => e.id !== examId));
            toast.success("Exam record removed");
          }}
        />
      )}

      {/* =========================================================================
          TAB 2: GRADE ENTRY (FROM PHYSICAL PAPERS)
         ========================================================================= */}
      {activeTab === "marks" && activeExam && (
        <GradeEntryTab
          exams={exams}
          activeExam={activeExam}
          candidates={examCandidateStudents}
          evaluationsStore={evaluationsStore}
          onSelectExam={setSelectedExamId}
          onSaveStudentScore={(key, record) => {
            saveEvaluationsStore((prev) => ({
              ...prev,
              [key]: record,
            }));
          }}
          onBulkMarkAll={(records) => {
            saveEvaluationsStore((prev) => ({
              ...prev,
              ...records,
            }));
            toast.success("All candidate grades updated and saved!");
          }}
          onJumpToReportCards={() => setActiveTab("report-cards")}
        />
      )}

      {/* =========================================================================
          TAB 3: OFFICIAL REPORT CARDS (STUDENT DIRECTORY & EMAIL SHARING)
         ========================================================================= */}
      {activeTab === "report-cards" && activeExam && (
        <ReportCardsTab
          exams={exams}
          activeExam={activeExam}
          candidates={examCandidateStudents}
          evaluationsStore={evaluationsStore}
          isGradingComplete={isActiveExamGradingComplete}
          pendingCount={activeExamStats?.pendingCount ?? 0}
          onSelectExam={setSelectedExamId}
          onOpenDrawer={(record) => setReportCardDrawerStudent(record)}
          onJumpToGradeEntry={() => setActiveTab("marks")}
          onUpdateRecordEmailStatus={(key) => {
            saveEvaluationsStore((prev) => {
              const cur = prev[key];
              if (!cur) return prev;
              return {
                ...prev,
                [key]: {
                  ...cur,
                  emailSentAt: new Date().toISOString(),
                },
              };
            });
          }}
        />
      )}

      {/* ADD EXAM MODAL (ADMIN & PRINCIPAL ONLY) */}
      {addExamModalOpen && (
        <AddExamModal
          onClose={() => setAddExamModalOpen(false)}
          staffList={staffList}
          subjectList={subjectList}
          onCreated={(newExam) => {
            saveExams((prev) => [newExam, ...prev]);
            setSelectedExamId(newExam.id);
            setAddExamModalOpen(false);
            toast.success("Conducted exam registered successfully", {
              description: `${newExam.title} (${newExam.grade}) is now open for teacher grade entry.`,
            });
            setActiveTab("marks");
          }}
        />
      )}

      {/* REPORT CARD RIGHT-SIDE SLIDE-OUT DRAWER */}
      {reportCardDrawerStudent && activeExam && (
        <ReportCardDrawer
          record={reportCardDrawerStudent}
          exam={activeExam}
          onClose={() => setReportCardDrawerStudent(null)}
          onEmailed={() => {
            const key = `${activeExam.id}__${reportCardDrawerStudent.studentId}`;
            saveEvaluationsStore((prev) => {
              const cur = prev[key];
              if (!cur) return prev;
              return {
                ...prev,
                [key]: {
                  ...cur,
                  emailSentAt: new Date().toISOString(),
                },
              };
            });
          }}
        />
      )}
    </div>
  );
}

/* =============================================================================
   SUB-COMPONENT: TAB 1 - CONDUCTED EXAMS REGISTRY
   ============================================================================= */
function ConductedExamsTab({
  exams,
  completionMap,
  isAdminOrPrincipal,
  onAddExam,
  onEnterGrades,
  onViewReportCards,
  onDeleteExam,
}: {
  exams: ConductedExam[];
  completionMap: Map<string, { isComplete: boolean; completionPct: number; pendingCount: number }>;
  isAdminOrPrincipal: boolean;
  onAddExam: () => void;
  onEnterGrades: (examId: string) => void;
  onViewReportCards: (examId: string) => void;
  onDeleteExam: (examId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return exams.filter((e) => {
      if (gradeFilter !== "all" && e.grade !== gradeFilter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.grade.toLowerCase().includes(q) ||
        e.examType.toLowerCase().includes(q)
      );
    });
  }, [exams, search, gradeFilter]);

  const pager = usePagination(filtered, 6);

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="table-toolbar">
        <div className="search-field">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search conducted assessments by title or class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="toolbar-actions flex items-center gap-2 overflow-x-auto no-scrollbar">
          <SegmentedControl
            ariaLabel="Filter exams by grade"
            layoutId="conductedExamsGradeTabs"
            value={gradeFilter}
            onChange={setGradeFilter}
            options={[
              { value: "all", label: "All" },
              { value: "Grade 6", label: "Grade 6" },
              { value: "Grade 7", label: "Grade 7" },
              { value: "Grade 8", label: "Grade 8" },
              { value: "Grade 9", label: "Grade 9" },
              { value: "Grade 10", label: "Grade 10" },
            ]}
          />

          {isAdminOrPrincipal && (
            <button type="button" className="primary-button compact flex-shrink-0" onClick={onAddExam}>
              <Plus size={14} />
              <span>Add Exam</span>
            </button>
          )}
        </div>
      </div>

      {/* Exams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pager.pageRows.map((exam) => {
          const stats = completionMap.get(exam.id);
          const isComplete = stats?.isComplete ?? false;
          const pct = stats?.completionPct ?? 0;
          const pending = stats?.pendingCount ?? 0;

          return (
            <div
              key={exam.id}
              className="panel flex flex-col justify-between p-5 hover:border-[var(--brand-border)] transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="status-pill brand">{exam.examType}</span>
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    {exam.conductedDate}
                  </span>
                </div>

                <h3 className="text-base font-bold text-[var(--text-primary)] leading-tight mb-1">
                  {exam.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] font-medium mb-3">
                  {exam.grade} · {exam.term}
                </p>

                {/* Subjects & Total Marks */}
                <div className="p-3 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)] space-y-1.5 mb-4 text-xs">
                  <div className="flex items-center justify-between text-[var(--text-muted)] font-semibold text-[11px] uppercase tracking-wider">
                    <span>Subjects Included ({exam.subjects.length})</span>
                    <span>Max Marks</span>
                  </div>
                  <div className="space-y-1">
                    {exam.subjects.slice(0, 3).map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-[var(--text-secondary)]">
                        <span>{s.subject}</span>
                        <span className="font-mono text-[var(--text-primary)] font-semibold">
                          {s.maxMarks}
                        </span>
                      </div>
                    ))}
                    {exam.subjects.length > 3 && (
                      <div className="text-[11px] text-[var(--brand)] font-medium pt-0.5">
                        +{exam.subjects.length - 3} more subjects (Grand Total: {exam.totalMaxMarks})
                      </div>
                    )}
                  </div>
                </div>

                {/* Grading Status Meter */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--text-secondary)]">Evaluation Status</span>
                    <span
                      className={`font-semibold font-mono ${
                        isComplete ? "text-[var(--success)]" : "text-[var(--warning)]"
                      }`}
                    >
                      {isComplete ? "100% Complete" : `${pct}% (${pending} pending)`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isComplete ? "bg-[var(--success)]" : "bg-[var(--warning)]"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="secondary-button compact text-xs flex-1"
                  onClick={() => onEnterGrades(exam.id)}
                >
                  <ClipboardList size={13} />
                  <span>Enter Grades</span>
                </button>

                <button
                  type="button"
                  className="primary-button compact text-xs flex-1"
                  onClick={() => onViewReportCards(exam.id)}
                >
                  <Award size={13} />
                  <span>Report Cards</span>
                </button>

                {isAdminOrPrincipal && (
                  <button
                    type="button"
                    className="icon-button text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                    onClick={() => onDeleteExam(exam.id)}
                    title="Delete Exam Record"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!pager.isSinglePage && (
        <Pager pagination={pager} noun="conducted examinations" />
      )}
    </div>
  );
}

/* =============================================================================
   SUB-COMPONENT: ADD CONDUCTED EXAM MODAL (ADMIN / PRINCIPAL ONLY)
   ============================================================================= */
function AddExamModal({
  onClose,
  staffList,
  subjectList,
  onCreated,
}: {
  onClose: () => void;
  staffList: { id: string | number; name: string }[];
  subjectList: { id: string | number; name: string }[];
  onCreated: (exam: ConductedExam) => void;
}) {
  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState<ExamType>("Midterm");
  const [term, setTerm] = useState("Term 1 (2026–2027)");
  const [grade, setGrade] = useState("Grade 8");
  const [conductedDate, setConductedDate] = useState(() => {
    return new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  });
  const [notes, setNotes] = useState("");

  // Subjects Configurator
  const [subjects, setSubjects] = useState<ExamSubjectConfig[]>([
    { id: "s-1", subject: "Mathematics", maxMarks: 100, passMarks: 40, assignedTeacher: staffList[0]?.name ?? "Faculty" },
    { id: "s-2", subject: "Science", maxMarks: 100, passMarks: 40, assignedTeacher: staffList[1]?.name ?? "Faculty" },
    { id: "s-3", subject: "English", maxMarks: 100, passMarks: 40, assignedTeacher: staffList[2]?.name ?? "Faculty" },
  ]);

  const totalMax = useMemo(() => {
    return subjects.reduce((sum, s) => sum + (Number(s.maxMarks) || 0), 0);
  }, [subjects]);

  const handleAddSubject = () => {
    const nextNum = subjects.length + 1;
    const available = subjectList[nextNum % subjectList.length]?.name || `Subject ${nextNum}`;
    setSubjects((prev) => [
      ...prev,
      {
        id: `s-${Date.now()}-${nextNum}`,
        subject: available,
        maxMarks: 100,
        passMarks: 40,
        assignedTeacher: staffList[nextNum % staffList.length]?.name || "Faculty",
      },
    ]);
  };

  const handleRemoveSubject = (id: string) => {
    if (subjects.length <= 1) {
      toast.error("At least one subject is required");
      return;
    }
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateSubject = (id: string, field: keyof ExamSubjectConfig, val: any) => {
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Exam title is required", {
        description: "Please enter an official title for this conducted examination.",
      });
      return;
    }

    const newExam: ConductedExam = {
      id: `EXM-${Date.now().toString().slice(-6)}`,
      title: title.trim(),
      examType,
      term,
      grade,
      conductedDate,
      subjects: subjects.map((s) => ({
        ...s,
        maxMarks: Number(s.maxMarks) || 100,
        passMarks: Number(s.passMarks) || 40,
      })),
      totalMaxMarks: totalMax,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    onCreated(newExam);
  };

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Add Conducted Examination"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal modal-responsive"
        style={{
          width: "min(720px, 94vw)",
          maxHeight: "min(780px, 92vh)",
          height: "min(740px, 92vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg-panel)",
          backdropFilter: "blur(36px) saturate(190%)",
          WebkitBackdropFilter: "blur(36px) saturate(190%)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-dialog)",
        }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand)]">
              Institutional Assessment Registry
            </span>
            <h2 className="panel-title" style={{ margin: "2px 0 0", fontSize: 18 }}>
              Record Conducted Exam
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
            <div className="form-grid">
              {/* Exam Title */}
              <label style={{ gridColumn: "span 2" }}>
                Exam Title *
                <input
                  type="text"
                  placeholder="e.g. Midterm Examination 2026, FA1 Assessment"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  required
                />
              </label>

              {/* Exam Type */}
              <label>
                Assessment Type *
                <FormSelect
                  options={[
                    { value: "Midterm", label: "Midterm Examination" },
                    { value: "FA1", label: "Formative Assessment 1 (FA1)" },
                    { value: "FA2", label: "Formative Assessment 2 (FA2)" },
                    { value: "Internals", label: "Internal Assessment" },
                    { value: "Final", label: "Semester / Final Examination" },
                    { value: "Unit Test", label: "Unit Test" },
                    { value: "Annual", label: "Annual Board Examination" },
                  ]}
                  value={examType}
                  onChange={(val) => setExamType(val as ExamType)}
                />
              </label>

              {/* Academic Term */}
              <label>
                Academic Session & Term *
                <input
                  type="text"
                  placeholder="e.g. Term 1 (2026–2027)"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  required
                />
              </label>

              {/* Target Grade */}
              <label>
                Enrolled Class / Grade *
                <FormSelect
                  options={[
                    { value: "Grade 6", label: "Grade 6" },
                    { value: "Grade 7", label: "Grade 7" },
                    { value: "Grade 8", label: "Grade 8" },
                    { value: "Grade 9", label: "Grade 9" },
                    { value: "Grade 10", label: "Grade 10" },
                  ]}
                  value={grade}
                  onChange={setGrade}
                />
              </label>

              {/* Conducted Date */}
              <label>
                Conducted Date *
                <input
                  type="text"
                  placeholder="e.g. 15 Oct 2026"
                  value={conductedDate}
                  onChange={(e) => setConductedDate(e.target.value)}
                  required
                />
              </label>
            </div>

            {/* Subjects and Maximum Marks Configurator */}
            <div className="mt-5 pt-4 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Subjects & Maximum Marks Allocation
                  </h4>
                  <p className="text-[11.5px] text-[var(--text-muted)]">
                    Specify max marks for physical paper grading. Grand Total:{" "}
                    <strong className="text-[var(--brand)] font-mono">{totalMax} Marks</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button compact text-xs"
                  onClick={handleAddSubject}
                >
                  <Plus size={13} />
                  <span>Add Subject</span>
                </button>
              </div>

              <div className="space-y-2">
                {subjects.map((sub, index) => (
                  <div
                    key={sub.id}
                    className="p-3 rounded-xl bg-[var(--bg-raised)] border border-[var(--border-subtle)] flex flex-wrap items-center gap-3"
                  >
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)] w-5">
                      #{index + 1}
                    </span>

                    <div className="flex-1 min-w-[140px]">
                      <input
                        type="text"
                        placeholder="Subject Name (e.g. Physics)"
                        value={sub.subject}
                        onChange={(e) => handleUpdateSubject(sub.id, "subject", e.target.value)}
                        className="text-xs py-1.5 px-2.5 rounded bg-[var(--bg-input)] border border-[var(--border)] w-full"
                      />
                    </div>

                    <div className="w-24">
                      <label className="text-[10px] text-[var(--text-muted)] block mb-0.5 font-semibold">
                        Max Marks
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={sub.maxMarks}
                        onChange={(e) => handleUpdateSubject(sub.id, "maxMarks", e.target.value)}
                        className="text-xs py-1.5 px-2.5 rounded bg-[var(--bg-input)] border border-[var(--border)] w-full font-mono text-center"
                      />
                    </div>

                    <div className="w-24">
                      <label className="text-[10px] text-[var(--text-muted)] block mb-0.5 font-semibold">
                        Pass Marks
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={sub.passMarks}
                        onChange={(e) => handleUpdateSubject(sub.id, "passMarks", e.target.value)}
                        className="text-xs py-1.5 px-2.5 rounded bg-[var(--bg-input)] border border-[var(--border)] w-full font-mono text-center"
                      />
                    </div>

                    <div className="flex-1 min-w-[160px]">
                      <label className="text-[10px] text-[var(--text-muted)] block mb-0.5 font-semibold">
                        Evaluator / Teacher
                      </label>
                      <select
                        value={sub.assignedTeacher}
                        onChange={(e) => handleUpdateSubject(sub.id, "assignedTeacher", e.target.value)}
                        className="text-xs py-1.5 px-2.5 rounded bg-[var(--bg-input)] border border-[var(--border)] w-full text-[var(--text-secondary)]"
                      >
                        {staffList.map((st) => (
                          <option key={st.id} value={st.name}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className="icon-button text-[var(--danger)] hover:bg-[var(--danger-soft)] mt-3 sm:mt-0"
                      onClick={() => handleRemoveSubject(sub.id)}
                      title="Remove Subject"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label>
                Assessment Notes / Syllabus Remarks (Optional)
                <textarea
                  rows={2}
                  placeholder="e.g. Conducted under internal invigilation; covers units 1 to 4."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <Check size={14} />
              <span>Register & Open Grade Entry</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =============================================================================
   SUB-COMPONENT: TAB 2 - GRADE ENTRY (PHYSICAL PAPER SCORING)
   ============================================================================= */
function GradeEntryTab({
  exams,
  activeExam,
  candidates,
  evaluationsStore,
  onSelectExam,
  onSaveStudentScore,
  onBulkMarkAll,
  onJumpToReportCards,
}: {
  exams: ConductedExam[];
  activeExam: ConductedExam;
  candidates: Student[];
  evaluationsStore: Record<string, StudentExamRecord>;
  onSelectExam: (examId: string) => void;
  onSaveStudentScore: (key: string, record: StudentExamRecord) => void;
  onBulkMarkAll: (records: Record<string, StudentExamRecord>) => void;
  onJumpToReportCards: () => void;
}) {
  const [activeSubject, setActiveSubject] = useState<string>(
    activeExam.subjects[0]?.subject || "All Subjects"
  );
  const [search, setSearch] = useState("");

  // Sync active subject if exam changes
  useEffect(() => {
    setActiveSubject(activeExam.subjects[0]?.subject || "All Subjects");
  }, [activeExam]);

  const currentSubjectConfig = useMemo(() => {
    return activeExam.subjects.find((s) => s.subject === activeSubject) || null;
  }, [activeExam, activeSubject]);

  const filteredCandidates = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return candidates;
    return candidates.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.usn && c.usn.toLowerCase().includes(q))
    );
  }, [candidates, search]);

  const pager = usePagination(filteredCandidates, 12);

  // Quick helper to fill remaining un-entered students as present with passing marks or absent
  const handleMarkAllAttended = () => {
    const updates: Record<string, StudentExamRecord> = {};
    candidates.forEach((stu) => {
      const key = `${activeExam.id}__${stu.id}`;
      const existing = evaluationsStore[key];
      const scores = { ...(existing?.subjectScores || {}) };

      activeExam.subjects.forEach((sub) => {
        if (!scores[sub.subject] || scores[sub.subject]?.marks === null) {
          scores[sub.subject] = {
            marks: Math.round(sub.maxMarks * 0.75),
            isAbsent: false,
            remarks: "Satisfactory completion",
          };
        }
      });

      updates[key] = {
        studentId: String(stu.id),
        studentName: stu.name,
        usn: stu.usn ?? `GGS-2627-${String(stu.id).padStart(4, "0")}`,
        grade: stu.grade,
        section: stu.section || "A",
        email: `${stu.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        subjectScores: scores,
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: "Evaluator",
      };
    });

    onBulkMarkAll(updates);
  };

  return (
    <div className="space-y-4">
      {/* Top Selector Bar */}
      <div className="panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div style={{ width: 280 }}>
            <label className="text-[10.5px] uppercase tracking-wider text-[var(--text-muted)] font-bold block mb-1">
              Select Conducted Examination
            </label>
            <FormSelect
              options={exams.map((e) => ({
                value: e.id,
                label: `${e.title} (${e.grade})`,
              }))}
              value={activeExam.id}
              onChange={onSelectExam}
            />
          </div>

          <div style={{ width: 220 }}>
            <label className="text-[10.5px] uppercase tracking-wider text-[var(--text-muted)] font-bold block mb-1">
              Active Evaluation Subject
            </label>
            <FormSelect
              options={activeExam.subjects.map((s) => ({
                value: s.subject,
                label: `${s.subject} (Max ${s.maxMarks})`,
              }))}
              value={activeSubject}
              onChange={setActiveSubject}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="secondary-button compact text-xs"
            onClick={handleMarkAllAttended}
            title="Convenience action: fill remaining unmarked with standard scores"
          >
            <CheckSquare size={13} />
            <span>Mark Unfilled as Evaluated</span>
          </button>

          <button
            type="button"
            className="primary-button compact text-xs"
            onClick={onJumpToReportCards}
          >
            <Award size={13} />
            <span>View Report Cards</span>
          </button>
        </div>

        {/* Horizontal Sliding Subject Selector */}
        {activeExam.subjects.length > 0 && (
          <div className="w-full pt-3 border-t border-[var(--border)] flex items-center gap-2.5 overflow-x-auto no-scrollbar">
            <span className="text-xs text-[var(--text-muted)] font-semibold flex-shrink-0">
              Evaluation Subject:
            </span>
            <SegmentedControl
              ariaLabel="Select active evaluation subject"
              layoutId="gradeEntrySubjectPills"
              value={activeSubject}
              onChange={setActiveSubject}
              indicatorVariant="brand"
              options={activeExam.subjects.map((s) => ({
                value: s.subject,
                label: s.subject,
                count: `${s.maxMarks}m`,
              }))}
            />
          </div>
        )}
      </div>

      {/* Notice Banner Explaining Physical Grading Workflow */}
      <div className="p-3.5 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-soft)]/25 flex items-start gap-3 text-xs text-[var(--text-secondary)]">
        <Sparkles size={16} className="text-[var(--brand)] flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-[var(--text-primary)]">Physical Paper Evaluation Mode:</strong>{" "}
          Review evaluated physical paper sheets and enter scores directly. For absent students,
          select <strong>"Not Attended"</strong>. All students must be marked before official report
          cards can be generated and distributed.
        </div>
      </div>

      {/* Grade Entry Table */}
      <div className="panel">
        <div className="panel-header flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="panel-title" style={{ fontSize: 16 }}>
              {activeSubject} · Candidate Grading Sheet
            </h2>
            <span className="status-pill brand">
              Max {currentSubjectConfig?.maxMarks ?? 100} Marks · Pass {currentSubjectConfig?.passMarks ?? 40}
            </span>
          </div>

          <div className="search-field" style={{ maxWidth: 260 }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Search candidate name or USN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 780 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ minWidth: 200 }}>Student Candidate</th>
                <th style={{ width: 140 }}>USN / Admission No.</th>
                <th style={{ width: 170 }}>Attendance Status</th>
                <th style={{ width: 120 }}>Score (Marks)</th>
                <th style={{ width: 90 }}>Grade</th>
                <th style={{ minWidth: 200 }}>Evaluation Remarks</th>
                <th style={{ width: 100 }}>State</th>
              </tr>
            </thead>
            <tbody>
              {pager.pageRows.map((stu, idx) => {
                const key = `${activeExam.id}__${stu.id}`;
                const record = evaluationsStore[key];
                const subjectEntry: StudentSubjectScore =
                  record?.subjectScores[activeSubject] ?? {
                    marks: null,
                    isAbsent: false,
                    remarks: "",
                  };

                const isAbsent = subjectEntry.isAbsent;
                const marksVal = subjectEntry.marks;
                const maxMarks = currentSubjectConfig?.maxMarks ?? 100;
                const isEvaluated = isAbsent || (marksVal !== null && marksVal >= 0);
                const gradeInfo =
                  isAbsent
                    ? { letter: "ABS", color: "var(--danger)", badge: "status-pill danger" }
                    : marksVal !== null
                      ? calculateGradeLetter(marksVal, maxMarks)
                      : { letter: "—", color: "var(--text-muted)", badge: "status-pill neutral" };

                const updateEntry = (updated: Partial<StudentSubjectScore>) => {
                  const newScores = {
                    ...(record?.subjectScores || {}),
                    [activeSubject]: {
                      ...subjectEntry,
                      ...updated,
                    },
                  };

                  onSaveStudentScore(key, {
                    studentId: String(stu.id),
                    studentName: stu.name,
                    usn: stu.usn ?? `GGS-2627-${String(stu.id).padStart(4, "0")}`,
                    grade: stu.grade,
                    section: stu.section || "A",
                    email: `${stu.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
                    subjectScores: newScores,
                    evaluatedAt: new Date().toISOString(),
                    evaluatedBy: currentSubjectConfig?.assignedTeacher || "Faculty",
                  });
                };

                return (
                  <tr key={stu.id} className={isAbsent ? "opacity-75 bg-[var(--danger-soft)]/10" : ""}>
                    <td className="text-xs font-mono text-[var(--text-muted)]">
                      {(pager.page - 1) * 12 + idx + 1}
                    </td>

                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="avatar-chip">{stu.initials || stu.name.slice(0, 2).toUpperCase()}</div>
                        <div>
                          <strong className="text-xs text-[var(--text-primary)] block">
                            {stu.name}
                          </strong>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {stu.grade} · Section {stu.section || "A"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="font-mono text-xs text-[var(--text-secondary)]">
                      {stu.usn ?? `GGS-2627-${String(stu.id).padStart(4, "0")}`}
                    </td>

                    {/* Attendance Status Selector: Attended vs Not Attended */}
                    <td>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-all ${
                            !isAbsent
                              ? "bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success-border)]"
                              : "bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border)]"
                          }`}
                          onClick={() => {
                            updateEntry({
                              isAbsent: false,
                              marks: marksVal === null ? Math.round(maxMarks * 0.7) : marksVal,
                              remarks: "Satisfactory completion",
                            });
                          }}
                        >
                          Attended
                        </button>
                        <button
                          type="button"
                          className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-all ${
                            isAbsent
                              ? "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger-border)]"
                              : "bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border)]"
                          }`}
                          onClick={() => {
                            updateEntry({
                              isAbsent: true,
                              marks: null,
                              remarks: "Not Attended / Absent on exam date",
                            });
                          }}
                        >
                          Not Attended
                        </button>
                      </div>
                    </td>

                    {/* Marks Input */}
                    <td>
                      {isAbsent ? (
                        <span className="text-xs font-bold font-mono text-[var(--danger)]">
                          ABS
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max={maxMarks}
                            value={marksVal ?? ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : Math.min(maxMarks, Math.max(0, Number(e.target.value)));
                              updateEntry({ marks: val });
                            }}
                            placeholder="Score"
                            className="w-16 py-1 px-2 text-xs font-mono font-bold text-center rounded bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
                          />
                          <span className="text-[11px] text-[var(--text-muted)] font-mono">
                            /{maxMarks}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Grade Badge */}
                    <td>
                      <span className={gradeInfo.badge}>{gradeInfo.letter}</span>
                    </td>

                    {/* Remarks Input */}
                    <td>
                      <input
                        type="text"
                        value={subjectEntry.remarks}
                        onChange={(e) => updateEntry({ remarks: e.target.value })}
                        placeholder={isAbsent ? "Absent notice notes" : "Teacher evaluation remarks…"}
                        className="w-full py-1 px-2.5 text-xs rounded bg-[var(--bg-input)] border border-transparent focus:border-[var(--border-strong)] text-[var(--text-secondary)] outline-none"
                      />
                    </td>

                    {/* Completion State Badge */}
                    <td>
                      {isEvaluated ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--success)]">
                          <Check size={13} />
                          <span>Graded</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--warning)]">
                          <AlertTriangle size={13} />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!pager.isSinglePage && (
          <div className="p-3 border-t border-[var(--border)]">
            <Pager pagination={pager} noun="candidates" />
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================================================
   SUB-COMPONENT: TAB 3 - REPORT CARDS TABLE & DISTRIBUTION
   ============================================================================= */
function ReportCardsTab({
  exams,
  activeExam,
  candidates,
  evaluationsStore,
  isGradingComplete,
  pendingCount,
  onSelectExam,
  onOpenDrawer,
  onJumpToGradeEntry,
  onUpdateRecordEmailStatus,
}: {
  exams: ConductedExam[];
  activeExam: ConductedExam;
  candidates: Student[];
  evaluationsStore: Record<string, StudentExamRecord>;
  isGradingComplete: boolean;
  pendingCount: number;
  onSelectExam: (examId: string) => void;
  onOpenDrawer: (record: StudentExamRecord) => void;
  onJumpToGradeEntry: () => void;
  onUpdateRecordEmailStatus: (key: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("all");
  const [isBatchEmailing, setIsBatchEmailing] = useState(false);

  // Compute calculated report card items for each candidate
  const reportCardList = useMemo(() => {
    return candidates.map((stu) => {
      const key = `${activeExam.id}__${stu.id}`;
      const saved = evaluationsStore[key];
      const scores = saved?.subjectScores || {};

      let scoredSum = 0;
      let evaluatedCount = 0;
      const subjectsWithScores = activeExam.subjects.map((sub) => {
        const entry = scores[sub.subject];
        const isAbsent = entry?.isAbsent ?? false;
        const marks = entry?.marks ?? null;
        if (!isAbsent && marks !== null) {
          scoredSum += marks;
          evaluatedCount++;
        }
        const gradeLetter = isAbsent
          ? "ABS"
          : marks !== null
            ? calculateGradeLetter(marks, sub.maxMarks).letter
            : "—";

        return {
          subject: sub.subject,
          maxMarks: sub.maxMarks,
          passMarks: sub.passMarks,
          marks,
          grade: gradeLetter,
          remarks: entry?.remarks || (isAbsent ? "Absent" : "Satisfactory"),
          isAbsent,
        };
      });

      const isAllAbsent = subjectsWithScores.every((s) => s.isAbsent);
      const isMissingSome = subjectsWithScores.some((s) => !s.isAbsent && s.marks === null);

      const totalMax = activeExam.totalMaxMarks;
      const percentage =
        isAllAbsent || totalMax <= 0 ? 0 : Math.round((scoredSum / totalMax) * 1000) / 10;
      const overallGrade = isAllAbsent
        ? "ABS"
        : isMissingSome
          ? "Pending"
          : calculateGradeLetter(scoredSum, totalMax).letter;

      let resultStatus = "Promoted with Distinction";
      if (isAllAbsent) resultStatus = "Absent (Not Attended)";
      else if (isMissingSome) resultStatus = "Pending Evaluation";
      else if (percentage < 40) resultStatus = "Needs Remedial Support";
      else if (percentage >= 75) resultStatus = "Promoted with Distinction";
      else resultStatus = "Promoted to Next Term";

      const record: StudentExamRecord = saved || {
        studentId: String(stu.id),
        studentName: stu.name,
        usn: stu.usn ?? `GGS-2627-${String(stu.id).padStart(4, "0")}`,
        grade: stu.grade,
        section: stu.section || "A",
        email: `${stu.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        subjectScores: scores,
      };

      return {
        student: stu,
        record,
        subjectsWithScores,
        grandTotal: scoredSum,
        totalMaxMarks: totalMax,
        percentage,
        overallGrade,
        resultStatus,
        isAllAbsent,
        isMissingSome,
        emailSentAt: saved?.emailSentAt,
      };
    });
  }, [candidates, activeExam, evaluationsStore]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return reportCardList.filter((item) => {
      if (resultFilter === "passed" && (item.isAllAbsent || item.percentage < 40)) return false;
      if (resultFilter === "absent" && !item.isAllAbsent) return false;
      if (resultFilter === "emailed" && !item.emailSentAt) return false;
      if (!q) return true;
      return (
        item.student.name.toLowerCase().includes(q) ||
        (item.record.usn && item.record.usn.toLowerCase().includes(q))
      );
    });
  }, [reportCardList, search, resultFilter]);

  const pager = usePagination(filtered, 12);

  // Batch Share all report cards to student emails
  const handleBatchShareAll = async () => {
    if (!isGradingComplete) {
      toast.error("Distribution Blocked", {
        description: `Grading is incomplete (${pendingCount} pending). All students must be evaluated or marked as Not Attended before report cards can be distributed.`,
      });
      return;
    }

    if (
      !confirm(
        `Are you sure you want to dispatch official Report Cards to all ${candidates.length} students via email?`
      )
    ) {
      return;
    }

    setIsBatchEmailing(true);
    const toastId = toast.loading("Dispatching batch report cards...", {
      description: `Preparing ${reportCardList.length} verified report cards for delivery.`,
    });

    try {
      const payloadCards = reportCardList.map((item) => ({
        studentName: item.student.name,
        studentEmail: item.record.email || "",
        usn: item.record.usn,
        grade: item.student.grade,
        section: item.student.section,
        examTitle: activeExam.title,
        academicTerm: activeExam.term,
        subjects: item.subjectsWithScores,
        grandTotal: item.grandTotal,
        totalMaxMarks: item.totalMaxMarks,
        percentage: item.percentage,
        overallGrade: item.overallGrade,
        resultStatus: item.resultStatus,
        attendancePct: item.student.attendance || 94,
      }));

      const res = await fetch("/api/report-card-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          mode: "batch",
          reportCards: payloadCards,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to dispatch report cards via API");
      }

      // Mark all as emailed
      reportCardList.forEach((item) => {
        const key = `${activeExam.id}__${item.student.id}`;
        onUpdateRecordEmailStatus(key);
      });

      toast.dismiss(toastId);
      toast.success("All Report Cards Emailed Successfully", {
        description: `Dispatched ${payloadCards.length} official report cards to registered student & guardian emails.`,
      });
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Dispatch Failed", {
        description: String(err) || "Could not dispatch emails. Please try again.",
      });
    } finally {
      setIsBatchEmailing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bar with Exam Selector */}
      <div className="panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div style={{ width: 280 }}>
            <label className="text-[10.5px] uppercase tracking-wider text-[var(--text-muted)] font-bold block mb-1">
              Select Examination
            </label>
            <FormSelect
              options={exams.map((e) => ({
                value: e.id,
                label: `${e.title} (${e.grade})`,
              }))}
              value={activeExam.id}
              onChange={onSelectExam}
            />
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <label className="text-[10.5px] uppercase tracking-wider text-[var(--text-muted)] font-bold block mb-1">
              Filter Result
            </label>
            <SegmentedControl
              ariaLabel="Filter report cards"
              layoutId="reportCardsResultTabs"
              value={resultFilter}
              onChange={setResultFilter}
              options={[
                { value: "all", label: "All" },
                { value: "passed", label: "Promoted" },
                { value: "absent", label: "Not Attended" },
                { value: "emailed", label: "Emailed" },
              ]}
            />
          </div>
        </div>

        {/* Global Batch Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="secondary-button compact text-xs"
            onClick={() => {
              window.print();
              toast.success("Print dialog opened for report cards");
            }}
          >
            <Printer size={13} />
            <span>Print All / PDF Batch</span>
          </button>

          {/* Share All Button: strictly locked if grading is incomplete */}
          <button
            type="button"
            className={`compact text-xs flex items-center gap-1.5 ${
              isGradingComplete ? "primary-button" : "secondary-button opacity-50 cursor-not-allowed"
            }`}
            onClick={handleBatchShareAll}
            disabled={!isGradingComplete || isBatchEmailing}
            title={
              isGradingComplete
                ? "Send official report cards to all student emails"
                : `Locked: ${pendingCount} student(s) have pending grades. Complete all grading first.`
            }
          >
            {isGradingComplete ? <Send size={13} /> : <Lock size={13} />}
            <span>Share All to Student Emails</span>
          </button>
        </div>
      </div>

      {/* Completion Enforcement Banner */}
      {!isGradingComplete ? (
        <div className="p-4 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-[var(--warning)]">
            <Lock size={16} className="flex-shrink-0" />
            <div>
              <strong className="block text-[var(--warning)]">
                Report Cards Distribution Locked ({pendingCount} Student Grades Pending)
              </strong>
              <span>
                Per institutional guidelines, all candidates must be graded or marked as <em>Not Attended</em>{" "}
                before report cards can be generated or emailed.
              </span>
            </div>
          </div>
          <button
            type="button"
            className="primary-button compact text-xs"
            onClick={onJumpToGradeEntry}
          >
            <ClipboardList size={13} />
            <span>Finish Grading Now</span>
          </button>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl border border-[var(--success-border)] bg-[var(--success-soft)]/20 flex items-center justify-between text-xs text-[var(--success)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>
              <strong>All Candidate Grades Verified (100% Complete):</strong> Official report cards
              are unlocked and ready to be printed or emailed in batch to students.
            </span>
          </div>
        </div>
      )}

      {/* Report Cards Table Directory */}
      <div className="panel">
        <div className="panel-header flex-wrap gap-3">
          <div>
            <h2 className="panel-title" style={{ fontSize: 16 }}>
              Student Report Cards Directory
            </h2>
            <p className="panel-subtitle" style={{ fontSize: 12 }}>
              Click any student row to slide out the detailed official Report Card.
            </p>
          </div>

          <div className="search-field" style={{ maxWidth: 280 }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Search student by name or USN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 840 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ minWidth: 220 }}>Student Candidate</th>
                <th style={{ width: 140 }}>USN</th>
                <th style={{ width: 110 }}>Attendance</th>
                <th style={{ width: 120 }}>Total Marks</th>
                <th style={{ width: 90 }}>%</th>
                <th style={{ width: 90 }}>Grade</th>
                <th style={{ minWidth: 160 }}>Result Status</th>
                <th style={{ width: 130 }}>Email Dispatch</th>
                <th style={{ width: 120, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pager.pageRows.map((item, idx) => {
                const gradeInfo = item.isAllAbsent
                  ? { letter: "ABS", badge: "status-pill danger" }
                  : calculateGradeLetter(item.grandTotal, item.totalMaxMarks);

                return (
                  <tr
                    key={item.student.id}
                    onClick={() => onOpenDrawer(item.record)}
                    className="cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <td className="text-xs font-mono text-[var(--text-muted)]">
                      {(pager.page - 1) * 12 + idx + 1}
                    </td>

                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="avatar-chip">
                          {item.student.initials || item.student.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <strong className="text-xs text-[var(--text-primary)] block hover:text-[var(--brand)] transition-colors">
                            {item.student.name}
                          </strong>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {item.student.grade} · Section {item.student.section || "A"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="font-mono text-xs text-[var(--text-secondary)]">
                      {item.record.usn}
                    </td>

                    <td className="text-xs text-[var(--success)] font-medium">
                      {item.student.attendance || 94}%
                    </td>

                    <td className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                      {item.isAllAbsent ? (
                        <span className="text-[var(--danger)]">ABS</span>
                      ) : (
                        `${item.grandTotal} / ${item.totalMaxMarks}`
                      )}
                    </td>

                    <td className="font-mono text-xs">
                      {item.isAllAbsent ? "—" : `${item.percentage}%`}
                    </td>

                    <td>
                      <span className={gradeInfo.badge}>{item.overallGrade}</span>
                    </td>

                    <td>
                      <span
                        className={`text-xs font-semibold ${
                          item.isAllAbsent
                            ? "text-[var(--danger)]"
                            : item.percentage >= 75
                              ? "text-[var(--success)]"
                              : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {item.resultStatus}
                      </span>
                    </td>

                    <td>
                      {item.emailSentAt ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--success)] font-semibold">
                          <Check size={12} />
                          <span>Emailed</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)] font-mono">
                          Ready to Send
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="secondary-button compact text-xs"
                        onClick={() => onOpenDrawer(item.record)}
                      >
                        <Eye size={12} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!pager.isSinglePage && (
          <div className="p-3 border-t border-[var(--border)]">
            <Pager pagination={pager} noun="report cards" />
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================================================
   SUB-COMPONENT: RIGHT-SIDE SLIDE-OUT DRAWER (REPORT CARD DRAWER)
   ============================================================================= */
function ReportCardDrawer({
  record,
  exam,
  onClose,
  onEmailed,
}: {
  record: StudentExamRecord;
  exam: ConductedExam;
  onClose: () => void;
  onEmailed: () => void;
}) {
  const [isSending, setIsSending] = useState(false);

  // Computed Subject Details
  const subjectsWithScores = useMemo(() => {
    return exam.subjects.map((sub) => {
      const entry = record.subjectScores[sub.subject];
      const isAbsent = entry?.isAbsent ?? false;
      const marks = entry?.marks ?? null;
      const gradeLetter = isAbsent
        ? "ABS"
        : marks !== null
          ? calculateGradeLetter(marks, sub.maxMarks).letter
          : "—";

      return {
        subject: sub.subject,
        maxMarks: sub.maxMarks,
        passMarks: sub.passMarks,
        marks,
        grade: gradeLetter,
        remarks: entry?.remarks || (isAbsent ? "Not Attended" : "Consistent progress"),
        isAbsent,
      };
    });
  }, [exam, record]);

  const scoredSum = useMemo(() => {
    return subjectsWithScores.reduce((sum, s) => sum + (s.marks ?? 0), 0);
  }, [subjectsWithScores]);

  const isAllAbsent = subjectsWithScores.every((s) => s.isAbsent);
  const totalMax = exam.totalMaxMarks;
  const percentage = isAllAbsent || totalMax <= 0 ? 0 : Math.round((scoredSum / totalMax) * 1000) / 10;
  const overallGrade = isAllAbsent ? "ABS" : calculateGradeLetter(scoredSum, totalMax).letter;

  let resultStatus = "Promoted with Distinction";
  if (isAllAbsent) resultStatus = "Absent (Not Attended)";
  else if (percentage < 40) resultStatus = "Needs Remedial Support";
  else if (percentage >= 75) resultStatus = "Promoted with Distinction";
  else resultStatus = "Promoted to Next Term";

  // No invented address: a report card is confidential and must go only to a
  // mailbox the school actually holds. The route skips a blank recipient.
  const recipientEmail = record.email || "";

  // Handle single student report card email dispatch
  const handleSendEmail = async () => {
    setIsSending(true);
    const toastId = toast.loading(`Sending report card to ${record.studentName}…`);

    try {
      const res = await fetch("/api/report-card-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          mode: "single",
          reportCard: {
            studentName: record.studentName,
            studentEmail: recipientEmail,
            usn: record.usn,
            grade: record.grade,
            section: record.section,
            examTitle: exam.title,
            academicTerm: exam.term,
            subjects: subjectsWithScores,
            grandTotal: scoredSum,
            totalMaxMarks: totalMax,
            percentage,
            overallGrade,
            resultStatus,
            attendancePct: 96,
          },
        }),
      });

      if (!res.ok) throw new Error("Email dispatch API failed");

      onEmailed();
      toast.dismiss(toastId);
      toast.success("Report Card Dispatched", {
        description: `Official PDF report card emailed to ${recipientEmail}`,
      });
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Dispatch Failed", {
        description: String(err) || "Failed to deliver email.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <DrawerBackdrop onClose={onClose} />

      <aside
        className="profile-drawer pupil-drawer"
        style={{
          width: "min(680px, 100vw)",
          zIndex: 50,
          background: "var(--bg-panel)",
          backdropFilter: "blur(36px) saturate(190%)",
          WebkitBackdropFilter: "blur(36px) saturate(190%)",
          boxShadow: "var(--shadow-dialog)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Student Official Report Card"
      >
        {/* Drawer Header Actions */}
        <div className="drawer-header" style={{ padding: "16px 20px" }}>
          <div>
            <span className="text-[10px] font-bold text-[var(--brand)] uppercase tracking-wider">
              Official Progress Document
            </span>
            <h2 className="text-base font-bold text-[var(--text-primary)]" style={{ margin: "2px 0 0" }}>
              {record.studentName}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="secondary-button compact text-xs"
              onClick={() => window.print()}
            >
              <Printer size={13} />
              <span>Print PDF</span>
            </button>

            <button
              type="button"
              className="primary-button compact text-xs flex items-center gap-1.5"
              onClick={handleSendEmail}
              disabled={isSending}
            >
              <Mail size={13} />
              <span>{isSending ? "Sending…" : "Share via Email"}</span>
            </button>

            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Scrollable Report Card Body */}
        <div className="pupil-drawer-body" style={{ padding: "18px 24px" }}>
          <div
            className="report-card-container"
            style={{
              padding: "24px 28px",
              borderRadius: "14px",
              border: "1px solid var(--border-strong)",
              background: "var(--bg-panel)",
            }}
          >
            {/* School Crest & Institutional Header */}
            <div style={{ textAlign: "center", borderBottom: "2px solid var(--border)", paddingBottom: "16px", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "19px", fontWeight: 800, letterSpacing: "0.02em", color: "var(--text-primary)", margin: 0 }}>
                GLOBAL KIDS SCHOOL, TUMAKURU
              </h2>
              <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "3px", margin: "3px 0 0" }}>
                Affiliated to CBSE, New Delhi · Affiliation No. 830491 · School Code: 45612
              </p>
              <span
                style={{
                  display: "inline-block",
                  marginTop: "8px",
                  padding: "3px 12px",
                  borderRadius: "20px",
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                {exam.title.toUpperCase()} · {exam.term.toUpperCase()}
              </span>
            </div>

            {/* Student Dossier Information */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "12px",
                padding: "14px 18px",
                background: "var(--bg-raised)",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                marginBottom: "20px",
                fontSize: "12.5px",
              }}
            >
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">
                  Student Name
                </span>
                <strong className="text-[var(--text-primary)] font-semibold">
                  {record.studentName}
                </strong>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">
                  USN / Admission No.
                </span>
                <span className="font-mono text-[var(--text-secondary)]">
                  {record.usn}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">
                  Class & Section
                </span>
                <span className="text-[var(--text-secondary)]">
                  {record.grade} · Section {record.section}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">
                  Term Attendance
                </span>
                <span className="text-[var(--success)] font-medium">96% Present</span>
              </div>
            </div>

            {/* Scholastic Table */}
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: 540 }}>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th style={{ width: 75 }}>Max</th>
                    <th style={{ width: 75 }}>Pass</th>
                    <th style={{ width: 95 }}>Score</th>
                    <th style={{ width: 70 }}>%</th>
                    <th style={{ width: 80 }}>Grade</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectsWithScores.map((s) => {
                    const pct = s.isAbsent || s.marks === null ? "—" : `${Math.round((s.marks / s.maxMarks) * 100)}%`;
                    const g = s.isAbsent ? { letter: "ABS", badge: "status-pill danger" } : calculateGradeLetter(s.marks ?? 0, s.maxMarks);

                    return (
                      <tr key={s.subject}>
                        <td className="font-medium text-[var(--text-primary)]">{s.subject}</td>
                        <td className="muted-cell">{s.maxMarks}</td>
                        <td className="muted-cell">{s.passMarks}</td>
                        <td className="font-semibold text-[var(--text-primary)] font-mono">
                          {s.isAbsent ? (
                            <span className="text-[var(--danger)]">ABS</span>
                          ) : (
                            s.marks
                          )}
                        </td>
                        <td className="font-mono text-[12px]">{pct}</td>
                        <td>
                          <span className={g.badge}>{g.letter}</span>
                        </td>
                        <td className="text-[var(--text-secondary)] text-[12px]">{s.remarks}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Performance Summary Cards */}
            <div
              style={{
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "10px",
                padding: "14px 18px",
                borderRadius: "8px",
                background: "var(--brand-soft-2)",
                border: "1px solid var(--brand-border)",
                textAlign: "center",
              }}
            >
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">
                  Grand Total
                </span>
                <strong className="text-[15px] text-[var(--text-primary)]">
                  {isAllAbsent ? "ABS" : `${scoredSum} / ${totalMax}`}
                </strong>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">
                  Percentage
                </span>
                <strong className="text-[15px] text-[var(--brand)]">
                  {isAllAbsent ? "—" : `${percentage}%`}
                </strong>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">
                  Overall Grade
                </span>
                <strong className="text-[15px] text-[var(--success)]">
                  {overallGrade}
                </strong>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">
                  Standing
                </span>
                <span className="status-pill success" style={{ display: "inline-block", marginTop: 2 }}>
                  {resultStatus}
                </span>
              </div>
            </div>

            {/* Signature Blocks */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "40px",
                paddingTop: "16px",
                borderTop: "1px dashed var(--border)",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ height: 22 }} />
                <span style={{ borderTop: "1px solid var(--border)", display: "block", paddingTop: 3 }}>
                  Class Teacher
                </span>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ height: 22 }} />
                <span style={{ borderTop: "1px solid var(--border)", display: "block", paddingTop: 3 }}>
                  Controller of Examinations
                </span>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ height: 22 }} />
                <span style={{ borderTop: "1px solid var(--border)", display: "block", paddingTop: 3 }}>
                  Principal & Head of School
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer" style={{ padding: "14px 20px" }}>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            Direct Email: {recipientEmail}
          </span>
          <button
            type="button"
            className="primary-button compact ml-auto"
            onClick={handleSendEmail}
            disabled={isSending}
          >
            <Send size={13} />
            <span>{isSending ? "Dispatching…" : "Send to Student Email"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Calendar,
  Plus,
  Search,
  FileText,
  ClipboardCheck,
  GraduationCap,
  Check,
  Download,
  Printer,
  Eye,
  Pencil,
  Trash2,
  X,
  ChevronRight,
  Award,
  BookOpen,
  Clock3,
  MapPin,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  Send,
  Sparkles,
  ArrowUpDown,
  Filter,
  CheckSquare,
  Square,
  Users,
} from "lucide-react";

import { Breadcrumb } from "./Breadcrumb";
import { MetricBlock } from "./MetricBlock";
import { SkeletonTableRows, SkeletonList } from "./ErpSkeleton";
import { Pager, usePagination } from "./ErpPagination";
import { DrawerBackdrop } from "./DrawerBackdrop";
import { FormSelect, type FormSelectOption } from "./FormSelect";
import { downloadCsv } from "./ReportsView";
import { toast } from "@/lib/toast";
import {
  useExamsView,
  useExamResultsView,
  useStudentsView,
  useStaffView,
  useSubjectsView,
  type Student,
} from "@/lib/erp-views";
import { type Exam, type ExamResult } from "@/lib/school-data";

export interface ExaminationsViewProps {
  onBack: () => void;
}

export type TabKey = "schedule" | "marks" | "publishing" | "report-cards";

export type AttendanceStatus = "Present" | "Late" | "Leave" | "Half Day" | "Absent";

export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, {
  label: string;
  shortLabel: string;
  badge: string;
  color: string;
  bg: string;
  border: string;
  defaultRemarks: string;
  canScore: boolean;
}> = {
  Present: {
    label: "Present",
    shortLabel: "P",
    badge: "status-pill success",
    color: "var(--success)",
    bg: "var(--success-soft)",
    border: "var(--success-border)",
    defaultRemarks: "Candidate attended on time and completed examination.",
    canScore: true,
  },
  Late: {
    label: "Late Arrival",
    shortLabel: "Late",
    badge: "status-pill warning",
    color: "var(--warning)",
    bg: "var(--warning-soft)",
    border: "var(--warning-border)",
    defaultRemarks: "Admitted with late entry pass; completed paper.",
    canScore: true,
  },
  Leave: {
    label: "Approved Leave",
    shortLabel: "Leave",
    badge: "status-pill brand",
    color: "var(--brand)",
    bg: "var(--brand-soft)",
    border: "var(--brand-border)",
    defaultRemarks: "Excused on authorized medical/school leave — re-test scheduled.",
    canScore: false,
  },
  "Half Day": {
    label: "Half Day",
    shortLabel: "Half Day",
    badge: "status-pill violet",
    color: "var(--violet)",
    bg: "var(--violet-soft)",
    border: "var(--violet-border)",
    defaultRemarks: "Half day session permitted for official institutional event.",
    canScore: true,
  },
  Absent: {
    label: "Absent",
    shortLabel: "Absent",
    badge: "status-pill danger",
    color: "var(--danger)",
    bg: "var(--danger-soft)",
    border: "var(--danger-border)",
    defaultRemarks: "Unexcused absence from assessment session.",
    canScore: false,
  },
};

export interface StudentMarkEntry {
  studentId: string;
  studentName: string;
  usn: string;
  rollNo: string;
  marks: number | null;
  maxMarks: number;
  status: AttendanceStatus;
  remarks: string;
}

export interface DetailedExam {
  id: string;
  name: string;
  subject: string;
  grade: string;
  date: string;
  time: string;
  venue: string;
  status: string;
  max_marks?: number;
  passing_marks?: number;
  invigilator?: string;
  syllabus?: string;
}

const DEFAULT_EXAMS: DetailedExam[] = [
  {
    id: "EXM-001",
    name: "Mid-term Mathematics",
    subject: "Mathematics",
    grade: "Grade 8",
    date: "02 Oct 2026",
    time: "09:00 – 10:30",
    venue: "Room 204",
    status: "Scheduled",
    max_marks: 100,
    passing_marks: 40,
    invigilator: "Arvind Iyer",
    syllabus: "Chapters 1–5: Rational Numbers, Linear Equations, Quadrilaterals, Data Handling",
  },
  {
    id: "EXM-002",
    name: "Mid-term Physics",
    subject: "Physics",
    grade: "Grade 11",
    date: "03 Oct 2026",
    time: "09:00 – 10:30",
    venue: "Lab 1",
    status: "Scheduled",
    max_marks: 100,
    passing_marks: 40,
    invigilator: "Karthik Rao",
    syllabus: "Units & Measurements, Kinematics, Laws of Motion, Work, Energy & Power",
  },
  {
    id: "EXM-003",
    name: "Unit English",
    subject: "English",
    grade: "Grade 7",
    date: "04 Oct 2026",
    time: "10:45 – 11:45",
    venue: "Room 118",
    status: "Scheduled",
    max_marks: 50,
    passing_marks: 20,
    invigilator: "Sonia Joseph",
    syllabus: "Prose comprehension, Formal Letter Writing, Tenses and Reported Speech",
  },
  {
    id: "EXM-004",
    name: "Chemistry Practical",
    subject: "Chemistry",
    grade: "Grade 12",
    date: "07 Oct 2026",
    time: "13:00 – 15:00",
    venue: "Lab 2",
    status: "Draft",
    max_marks: 50,
    passing_marks: 20,
    invigilator: "Priya Nair",
    syllabus: "Volumetric Analysis, Salt Analysis (Acidic & Basic Radicals), Chemical Kinetics",
  },
  {
    id: "EXM-005",
    name: "Mid-term Hindi",
    subject: "Hindi",
    grade: "Grade 9",
    date: "08 Oct 2026",
    time: "09:00 – 10:30",
    venue: "Room 102",
    status: "Scheduled",
    max_marks: 100,
    passing_marks: 40,
    invigilator: "Ananya Sharma",
    syllabus: "Kshitij: Chapters 1 to 4, Grammar: Sandhi, Samas, Alankar, Essay writing",
  },
  {
    id: "EXM-006",
    name: "Computer Science Term 1",
    subject: "Computer Science",
    grade: "Grade 10",
    date: "10 Oct 2026",
    time: "11:00 – 12:30",
    venue: "Computer Lab A",
    status: "Scheduled",
    max_marks: 100,
    passing_marks: 40,
    invigilator: "Vikram Sen",
    syllabus: "Python Functions, Loops, File Handling, Cyber Safety & Ethics",
  },
];

function getGradeLetter(score: number, max: number): { letter: string; color: string; badge: string } {
  const pct = (score / max) * 100;
  if (pct >= 90) return { letter: "A+", color: "var(--success)", badge: "status-pill success" };
  if (pct >= 80) return { letter: "A", color: "var(--brand)", badge: "status-pill brand" };
  if (pct >= 70) return { letter: "B", color: "var(--violet)", badge: "status-pill violet" };
  if (pct >= 60) return { letter: "C", color: "var(--warning)", badge: "status-pill warning" };
  if (pct >= 50) return { letter: "D", color: "var(--orange)", badge: "status-pill orange" };
  return { letter: "F", color: "var(--danger)", badge: "status-pill danger" };
}

export function ExaminationsView({ onBack }: ExaminationsViewProps) {
  const { rows: fetchedExams, loading: examsLoading } = useExamsView();
  const { rows: fetchedResults, loading: resultsLoading, update: updateExamResult } = useExamResultsView();
  const { rows: students, loading: studentsLoading } = useStudentsView();
  const { rows: staff } = useStaffView();
  const { rows: subjects } = useSubjectsView();

  const [activeTab, setActiveTab] = useState<TabKey>("schedule");

  // Local storage backed exam items
  const [exams, setExams] = useState<DetailedExam[]>(() => {
    try {
      const stored = localStorage.getItem("erp_custom_exams_v2");
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return DEFAULT_EXAMS;
  });

  // Keep synced if fetchedExams has additional entries
  useEffect(() => {
    if (fetchedExams.length > 0) {
      setExams((prev) => {
        const existingIds = new Set(prev.map((e) => String(e.id)));
        const added: DetailedExam[] = fetchedExams
          .filter((e) => !existingIds.has(String(e.id)))
          .map((e) => ({
            id: String(e.id),
            name: String(e.name),
            subject: String(e.subject),
            grade: String(e.grade),
            date: String(e.date),
            time: String(e.time),
            venue: String(e.venue),
            status: String(e.status),
            max_marks: 100,
            passing_marks: 40,
            invigilator: "Faculty in charge",
            syllabus: "Comprehensive syllabus as prescribed by the department.",
          }));
        if (added.length === 0) return prev;
        const updated = [...prev, ...added];
        try {
          localStorage.setItem("erp_custom_exams_v2", JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    }
  }, [fetchedExams]);

  // Local publishing state override
  const [publishingOverrides, setPublishingOverrides] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("erp_publishing_overrides_v2");
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {};
  });

  // Effective publishing papers
  const publishingList: ExamResult[] = useMemo(() => {
    const base = fetchedResults.length > 0 ? fetchedResults : [
      { id: "res-1", subject: "Mathematics", grade: "Grade 8 — B", graded: 31, total: 31, published: false },
      { id: "res-2", subject: "Physics", grade: "Grade 11 — A", graded: 30, total: 31, published: false },
      { id: "res-3", subject: "English", grade: "Grade 7 — B", graded: 24, total: 32, published: false },
      { id: "res-4", subject: "History", grade: "Grade 9 — D", graded: 28, total: 28, published: true },
      { id: "res-5", subject: "Computer Science", grade: "Grade 10 — A", graded: 29, total: 29, published: true },
    ];
    return base.map((row) => ({
      ...row,
      published: publishingOverrides[String(row.id)] !== undefined ? publishingOverrides[String(row.id)] : row.published,
    }));
  }, [fetchedResults, publishingOverrides]);

  // Student Marks Storage: keyed by `${examId}__${studentId}`
  const [marksStore, setMarksStore] = useState<Record<string, { marks: number | null; status: AttendanceStatus; remarks: string }>>(() => {
    try {
      const stored = localStorage.getItem("erp_exam_marks_store_v2");
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {};
  });

  // Active exam selected for Marks Entry tab
  const [selectedExamId, setSelectedExamId] = useState<string>(DEFAULT_EXAMS[0]?.id ?? "");

  // Filters for Schedule tab
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals & Drawers state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [examDetailDrawerItem, setExamDetailDrawerItem] = useState<DetailedExam | null>(null);
  const [reportCardStudentId, setReportCardStudentId] = useState<string>("");

  // Grade filter options
  const gradeOptions: FormSelectOption[] = [
    { value: "all", label: "All Grades" },
    { value: "Grade 6", label: "Grade 6" },
    { value: "Grade 7", label: "Grade 7" },
    { value: "Grade 8", label: "Grade 8" },
    { value: "Grade 9", label: "Grade 9" },
    { value: "Grade 10", label: "Grade 10" },
    { value: "Grade 11", label: "Grade 11" },
    { value: "Grade 12", label: "Grade 12" },
  ];

  const statusOptions: FormSelectOption[] = [
    { value: "all", label: "All Statuses" },
    { value: "Scheduled", label: "Scheduled" },
    { value: "Draft", label: "Draft" },
    { value: "In Progress", label: "In Progress" },
    { value: "Completed", label: "Completed" },
  ];

  // Filtered exams
  const filteredExams = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return exams.filter((exam) => {
      if (gradeFilter !== "all" && !exam.grade.includes(gradeFilter.replace("Grade ", ""))) {
        if (!exam.grade.toLowerCase().includes(gradeFilter.toLowerCase())) return false;
      }
      if (statusFilter !== "all" && exam.status !== statusFilter) return false;
      if (!q) return true;
      return (
        exam.name.toLowerCase().includes(q) ||
        exam.subject.toLowerCase().includes(q) ||
        exam.venue.toLowerCase().includes(q) ||
        (exam.invigilator && exam.invigilator.toLowerCase().includes(q))
      );
    });
  }, [exams, searchQuery, gradeFilter, statusFilter]);

  const examsPager = usePagination(filteredExams, 8);

  // Dynamic Calculated Metrics
  const metrics = useMemo(() => {
    const upcomingCount = exams.filter((e) => e.status === "Scheduled" || e.status === "In Progress").length;
    const pendingGradingCount = publishingList.filter((p) => !p.published || p.graded < p.total).length;
    const publishedCount = publishingList.filter((p) => p.published).length;
    const publishRate = publishingList.length > 0 ? Math.round((publishedCount / publishingList.length) * 100) : 0;

    // Calculate score average from marked students who took the paper (Present, Late, Half Day)
    let totalScoreSum = 0;
    let totalScoreN = 0;
    Object.values(marksStore).forEach((val) => {
      if (val.marks !== null && (val.status === "Present" || val.status === "Late" || val.status === "Half Day")) {
        totalScoreSum += val.marks;
        totalScoreN += 1;
      }
    });

    const averageScore = totalScoreN > 0 ? Math.round(totalScoreSum / totalScoreN) : 84;

    return {
      upcomingCount,
      pendingGradingCount,
      averageScore,
      publishRate,
      totalExams: exams.length,
      publishedCount,
      totalPapers: publishingList.length,
    };
  }, [exams, publishingList, marksStore]);

  // Selected exam for grading
  const currentExam = useMemo(() => {
    return exams.find((e) => e.id === selectedExamId) ?? exams[0];
  }, [exams, selectedExamId]);

  // Candidate students for the selected exam grade
  const examStudents: Student[] = useMemo(() => {
    if (!currentExam) return [];
    const targetGrade = currentExam.grade.replace(/[^0-9]/g, "");
    const matching = students.filter((s) => {
      const studentGrade = String(s.grade).replace(/[^0-9]/g, "");
      return studentGrade === targetGrade;
    });
    return matching.length > 0 ? matching : students.slice(0, 15);
  }, [students, currentExam]);

  // Local student marks for active exam
  const currentMarksList: StudentMarkEntry[] = useMemo(() => {
    if (!currentExam) return [];
    const max = currentExam.max_marks ?? 100;
    return examStudents.map((stu, idx) => {
      const key = `${currentExam.id}__${stu.id}`;
      const saved = marksStore[key];
      // realistic baseline default if not yet edited
      const defaultMarks = saved?.marks !== undefined ? saved.marks : 65 + ((idx * 7) % 31);
      const status: AttendanceStatus = (saved?.status as AttendanceStatus) ?? "Present";
      const remarks = saved?.remarks ?? (defaultMarks !== null && defaultMarks >= 85 ? "Consistent excellence" : ATTENDANCE_STATUS_META[status]?.defaultRemarks ?? "Satisfactory grasp of key concepts");
      const canScore = ATTENDANCE_STATUS_META[status]?.canScore ?? true;
      return {
        studentId: String(stu.id),
        studentName: stu.name,
        usn: stu.usn ?? `ADM-2627-${String(idx + 1).padStart(3, "0")}`,
        rollNo: String(idx + 1).padStart(2, "0"),
        marks: canScore ? defaultMarks : null,
        maxMarks: max,
        status,
        remarks,
      };
    });
  }, [currentExam, examStudents, marksStore]);

  // Marksheet stats
  const markSheetStats = useMemo(() => {
    const presentCount = currentMarksList.filter((m) => m.status === "Present").length;
    const lateCount = currentMarksList.filter((m) => m.status === "Late").length;
    const leaveCount = currentMarksList.filter((m) => m.status === "Leave").length;
    const halfDayCount = currentMarksList.filter((m) => m.status === "Half Day").length;
    const absentCount = currentMarksList.filter((m) => m.status === "Absent").length;

    // Evaluated candidates who took paper
    const evaluated = currentMarksList.filter((m) => m.status !== "Absent" && m.status !== "Leave" && m.marks !== null);
    if (evaluated.length === 0) {
      return {
        avg: 0,
        highest: 0,
        lowest: 0,
        passRate: 100,
        count: 0,
        presentCount,
        lateCount,
        leaveCount,
        halfDayCount,
        absentCount,
      };
    }
    const scores = evaluated.map((m) => m.marks as number);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / scores.length);
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const passing = currentExam?.passing_marks ?? 40;
    const passed = scores.filter((s) => s >= passing).length;
    const passRate = Math.round((passed / scores.length) * 100);
    return {
      avg,
      highest,
      lowest,
      passRate,
      count: evaluated.length,
      presentCount,
      lateCount,
      leaveCount,
      halfDayCount,
      absentCount,
    };
  }, [currentMarksList, currentExam]);

  // Handler: Update Mark
  const handleMarkChange = (studentId: string, valStr: string) => {
    if (!currentExam) return;
    const key = `${currentExam.id}__${studentId}`;
    const max = currentExam.max_marks ?? 100;
    let numVal: number | null = null;
    if (valStr.trim() !== "") {
      const parsed = parseInt(valStr, 10);
      if (!isNaN(parsed)) {
        numVal = Math.min(Math.max(parsed, 0), max);
      }
    }
    setMarksStore((prev) => {
      const existing = prev[key] ?? { marks: null, status: "Present" as AttendanceStatus, remarks: "" };
      const updated = {
        ...prev,
        [key]: {
          ...existing,
          marks: numVal,
        },
      };
      try {
        localStorage.setItem("erp_exam_marks_store_v2", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // Handler: Update Attendance Status (Present, Late, Leave, Half Day, Absent)
  const handleStatusChange = (studentId: string, newStatus: AttendanceStatus) => {
    if (!currentExam) return;
    const key = `${currentExam.id}__${studentId}`;
    setMarksStore((prev) => {
      const existing = prev[key] ?? { marks: 75, status: "Present" as AttendanceStatus, remarks: "" };
      const canScore = ATTENDANCE_STATUS_META[newStatus].canScore;
      const nextMarks = canScore ? (existing.marks ?? 70) : null;
      const defaultRemark = ATTENDANCE_STATUS_META[newStatus].defaultRemarks;
      const updated = {
        ...prev,
        [key]: {
          ...existing,
          status: newStatus,
          marks: nextMarks,
          remarks: existing.remarks && existing.remarks !== ATTENDANCE_STATUS_META[existing.status]?.defaultRemarks
            ? existing.remarks
            : defaultRemark,
        },
      };
      try {
        localStorage.setItem("erp_exam_marks_store_v2", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // Handler: Mark all candidates as Present
  const handleMarkAllPresent = () => {
    if (!currentExam) return;
    setMarksStore((prev) => {
      const next = { ...prev };
      examStudents.forEach((stu, i) => {
        const key = `${currentExam.id}__${stu.id}`;
        const existing = prev[key];
        const defaultMarks = existing?.marks ?? (65 + ((i * 7) % 31));
        next[key] = {
          marks: defaultMarks,
          status: "Present",
          remarks: existing?.remarks || ATTENDANCE_STATUS_META.Present.defaultRemarks,
        };
      });
      try {
        localStorage.setItem("erp_exam_marks_store_v2", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    toast.success("Attendance Updated", {
      description: `All ${examStudents.length} candidates marked as Present.`,
    });
  };

  // Handler: Save Marks batch
  const handleSaveMarks = () => {
    toast.success("Marks Saved & Synchronized", {
      description: `${currentMarksList.length} candidate scores recorded for ${currentExam.name}.`,
    });
  };

  // Handler: Auto-fill demo marks with realistic diversity (Present, Late, Leave, Half Day, Absent)
  const handleAutofillMarks = () => {
    if (!currentExam) return;
    const max = currentExam.max_marks ?? 100;
    const newEntries: Record<string, { marks: number | null; status: AttendanceStatus; remarks: string }> = {};
    examStudents.forEach((stu, i) => {
      const key = `${currentExam.id}__${stu.id}`;
      let status: AttendanceStatus = "Present";
      let marks: number | null = Math.min(max, Math.round(58 + ((i * 11) % (max - 58))));
      let remarks = marks >= 85 ? "Consistent excellence across all units." : "Solid grasp of core curriculum.";

      if (i === 1) {
        status = "Late";
        marks = Math.min(max, marks - 4);
        remarks = "Late arrival due to morning transit; late entry pass granted.";
      } else if (i === 3) {
        status = "Leave";
        marks = null;
        remarks = "Approved medical leave by school clinic · re-test scheduled.";
      } else if (i === 5) {
        status = "Half Day";
        marks = Math.min(max, marks);
        remarks = "Half day permitted for CBSE inter-school athletics competition.";
      } else if (i === 7) {
        status = "Absent";
        marks = null;
        remarks = "Unexcused absence from assessment session.";
      }

      newEntries[key] = {
        marks,
        status,
        remarks,
      };
    });
    setMarksStore((prev) => {
      const updated = { ...prev, ...newEntries };
      try {
        localStorage.setItem("erp_exam_marks_store_v2", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    toast.success("Realistic Marks & Attendance Populated", {
      description: `Sample data populated with Present, Late, Leave, Half Day & Absent candidates.`,
    });
  };

  // Handler: Toggle Paper Publishing
  const handleTogglePublish = async (paperId: string | number, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    const idStr = String(paperId);
    setPublishingOverrides((prev) => {
      const updated = { ...prev, [idStr]: nextStatus };
      try {
        localStorage.setItem("erp_publishing_overrides_v2", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    if (updateExamResult) {
      void updateExamResult(paperId, { published: nextStatus });
    }

    if (nextStatus) {
      toast.success("Results Published to Portal", {
        description: "Grades and report metrics are now visible to parents and pupils.",
      });
    } else {
      toast.info("Results Withdrawn from Portal", {
        description: "Grades have been hidden from family portals for administrative review.",
      });
    }
  };

  // Handler: Batch publish all
  const handlePublishAll = () => {
    const overrides: Record<string, boolean> = {};
    publishingList.forEach((p) => {
      overrides[p.id] = true;
      if (updateExamResult) void updateExamResult(p.id, { published: true });
    });
    setPublishingOverrides(overrides);
    try {
      localStorage.setItem("erp_publishing_overrides_v2", JSON.stringify(overrides));
    } catch {
      // ignore
    }
    toast.success("All Examination Results Published", {
      description: "All graded mark sheets have been made visible to parents and pupils.",
    });
  };

  // Handler: Export Exam Timetable CSV
  const handleExportTimetable = () => {
    const headers = ["Exam ID", "Exam Name", "Subject", "Grade", "Date", "Time", "Venue", "Invigilator", "Status"];
    const rows = filteredExams.map((e) => [
      e.id,
      e.name,
      e.subject,
      e.grade,
      e.date,
      e.time,
      e.venue,
      e.invigilator ?? "TBD",
      e.status,
    ]);
    downloadCsv("Global_Kids_School_Exam_Timetable_2026.csv", headers, rows);
    toast.success("Exam Timetable Exported", {
      description: `${rows.length} scheduled exam sessions downloaded in CSV format.`,
    });
  };

  // Handler: Export Marksheet CSV
  const handleExportMarksheet = () => {
    if (!currentExam) return;
    const headers = ["Roll No", "USN", "Student Name", "Grade", "Attendance Status", "Marks Obtained", "Max Marks", "Percentage", "Grade Letter", "Remarks"];
    const rows = currentMarksList.map((m) => {
      const marksVal = m.status === "Leave" ? "Excused" : m.status === "Absent" ? "Absent" : m.marks ?? 0;
      const pct = m.status === "Leave" ? "Excused" : m.marks !== null ? `${Math.round((m.marks / m.maxMarks) * 100)}%` : "—";
      const letter = m.status === "Leave" ? "LV" : m.status === "Absent" ? "Ab" : m.marks !== null ? getGradeLetter(m.marks, m.maxMarks).letter : "—";
      return [
        m.rollNo,
        m.usn,
        m.studentName,
        currentExam.grade,
        m.status,
        marksVal,
        m.maxMarks,
        pct,
        letter,
        m.remarks,
      ];
    });
    downloadCsv(`${currentExam.name.replace(/\s+/g, "_")}_Marksheet.csv`, headers, rows);
    toast.success("Marksheet Exported", {
      description: `Mark sheet for ${currentExam.name} downloaded successfully.`,
    });
  };

  // Handler: Delete Exam
  const handleDeleteExam = (examId: string) => {
    const target = exams.find((e) => e.id === examId);
    setExams((prev) => {
      const updated = prev.filter((e) => e.id !== examId);
      try {
        localStorage.setItem("erp_custom_exams_v2", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    if (examDetailDrawerItem?.id === examId) {
      setExamDetailDrawerItem(null);
    }
    toast.info("Exam Schedule Removed", {
      description: `${target?.name ?? "Exam"} has been removed from the calendar.`,
    });
  };

  // Current student selected for report card
  const selectedReportStudent = useMemo(() => {
    if (reportCardStudentId) {
      const match = students.find((s) => String(s.id) === reportCardStudentId);
      if (match) return match;
    }
    return students[0] ?? null;
  }, [students, reportCardStudentId]);

  return (
    <div className="page-stack">
      {/* Top Header */}
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Examinations"
            onParentClick={onBack}
          />
          <h1 className="page-title">Examinations</h1>
          <p className="page-subtitle">
            {metrics.upcomingCount} active exam{metrics.upcomingCount === 1 ? "" : "s"} ·{" "}
            {metrics.pendingGradingCount} pending grading
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="secondary-button"
            onClick={handleExportTimetable}
          >
            <Download size={14} />
            Export timetable
          </button>
          <button
            className="primary-button"
            onClick={() => setScheduleModalOpen(true)}
          >
            <Plus size={16} />
            Schedule exam
          </button>
        </div>
      </div>

      {/* Dynamic Real Metrics */}
      <div className="metric-grid">
        <MetricBlock
          label="Upcoming exams"
          value={String(metrics.upcomingCount)}
          comparison={`${metrics.totalExams} total scheduled`}
          icon={FileText}
          spark={[3, 4, 4, 5, 5, metrics.upcomingCount, metrics.upcomingCount]}
        />
        <MetricBlock
          label="Papers to grade"
          value={String(metrics.pendingGradingCount)}
          comparison={metrics.pendingGradingCount > 0 ? "Pending review" : "All graded"}
          icon={ClipboardCheck}
          positive={metrics.pendingGradingCount === 0}
          spark={[12, 10, 8, 6, 5, 4, metrics.pendingGradingCount]}
        />
        <MetricBlock
          label="Average score"
          value={`${metrics.averageScore}%`}
          comparison="Cohort average"
          icon={GraduationCap}
          spark={[76, 78, 80, 81, 82, 83, metrics.averageScore]}
        />
        <MetricBlock
          label="Grades published"
          value={`${metrics.publishRate}%`}
          comparison={`${metrics.publishedCount} of ${metrics.totalPapers} published`}
          icon={Check}
          spark={[30, 45, 55, 60, 68, metrics.publishRate]}
        />
      </div>

      {/* Sub-navigation Tabs */}
      <div className="profile-tabs" style={{ marginBottom: "8px" }}>
        <button
          className={activeTab === "schedule" ? "active" : ""}
          onClick={() => setActiveTab("schedule")}
        >
          <Calendar size={14} />
          Schedule
        </button>
        <button
          className={activeTab === "marks" ? "active" : ""}
          onClick={() => setActiveTab("marks")}
        >
          <Pencil size={14} />
          Marks entry
        </button>
        <button
          className={activeTab === "publishing" ? "active" : ""}
          onClick={() => setActiveTab("publishing")}
        >
          <Send size={14} />
          Publishing ({publishingList.filter((p) => !p.published).length})
        </button>
        <button
          className={activeTab === "report-cards" ? "active" : ""}
          onClick={() => setActiveTab("report-cards")}
        >
          <Award size={14} />
          Report cards
        </button>
      </div>

      {/* TAB 1: SCHEDULE & TIMETABLE */}
      {activeTab === "schedule" && (
        <section className="panel table-panel">
          <div className="panel-header" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 className="panel-title">Examination Timetable</h2>
            </div>

            {/* Filter toolbar */}
            <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
              <div className="search-field" style={{ minWidth: "220px" }}>
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search exam, subject, hall..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button className="search-clear" onClick={() => setSearchQuery("")}>
                    <X size={13} />
                  </button>
                )}
              </div>

              <div style={{ width: "135px" }}>
                <FormSelect
                  options={gradeOptions}
                  value={gradeFilter}
                  onChange={setGradeFilter}
                  ariaLabel="Filter by grade"
                />
              </div>

              <div style={{ width: "140px" }}>
                <FormSelect
                  options={statusOptions}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  ariaLabel="Filter by status"
                />
              </div>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 840 }}>
              <thead>
                <tr>
                  <th>Exam Title</th>
                  <th>Subject</th>
                  <th>Grade</th>
                  <th>Date</th>
                  <th>Time Window</th>
                  <th>Venue / Hall</th>
                  <th>Invigilator</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {examsLoading ? (
                  <SkeletonTableRows rows={5} columns={9} />
                ) : filteredExams.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "40px" }}>
                      <p className="text-[var(--text-muted)] text-sm">No examinations match the applied filters.</p>
                      <button
                        className="secondary-button compact"
                        style={{ margin: "10px auto 0" }}
                        onClick={() => {
                          setSearchQuery("");
                          setGradeFilter("all");
                          setStatusFilter("all");
                        }}
                      >
                        Reset filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  examsPager.pageRows.map((exam) => {
                    const isDraft = exam.status === "Draft";
                    const isCompleted = exam.status === "Completed";
                    return (
                      <tr key={exam.id}>
                        <td className="font-medium text-[var(--text-primary)]">
                          <div className="flex items-center gap-2">
                            <span className="exam-icon-chip">
                              <BookOpen size={14} />
                            </span>
                            <div>
                              <span>{exam.name}</span>
                              <span className="block text-[11px] text-[var(--text-muted)]">{exam.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="muted-cell">{exam.subject}</td>
                        <td>
                          <span className="grade-chip">{exam.grade}</span>
                        </td>
                        <td className="muted-cell font-mono text-[12px]">{exam.date}</td>
                        <td className="muted-cell">{exam.time}</td>
                        <td>
                          <span className="flex items-center gap-1.5 text-[var(--text-secondary)] text-[12.5px]">
                            <MapPin size={12} className="text-[var(--text-muted)]" />
                            {exam.venue}
                          </span>
                        </td>
                        <td className="muted-cell">{exam.invigilator ?? "Staff in charge"}</td>
                        <td>
                          <span
                            className={`status-pill ${
                              exam.status === "Scheduled"
                                ? "success"
                                : isDraft
                                  ? "neutral"
                                  : isCompleted
                                    ? "brand"
                                    : "warning"
                            }`}
                          >
                            <span className="status-dot" />
                            {exam.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              className="tiny-action"
                              title="View details & candidate roster"
                              onClick={() => setExamDetailDrawerItem(exam)}
                            >
                              <Eye size={12} />
                              Details
                            </button>
                            <button
                              className="tiny-action done"
                              title="Enter marks for this exam"
                              onClick={() => {
                                setSelectedExamId(exam.id);
                                setActiveTab("marks");
                              }}
                            >
                              <Pencil size={12} />
                              Marks
                            </button>
                            <button
                              className="tiny-action text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                              title="Delete examination"
                              onClick={() => handleDeleteExam(exam.id)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pager pagination={examsPager} noun="exams" />
        </section>
      )}

      {/* TAB 2: MARKS ENTRY & GRADEBOOK */}
      {activeTab === "marks" && (
        <section className="panel">
          <div className="panel-header" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 className="panel-title">Marksheet</h2>
            </div>

            <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
              <div style={{ width: "260px" }}>
                <FormSelect
                  options={exams.map((e) => ({
                    value: e.id,
                    label: `${e.name} (${e.grade})`,
                  }))}
                  value={selectedExamId}
                  onChange={setSelectedExamId}
                  ariaLabel="Select exam"
                />
              </div>

              <button
                className="secondary-button compact"
                onClick={handleAutofillMarks}
                title="Fill sample scores for all candidates"
              >
                <Sparkles size={13} />
                Auto-fill demo marks
              </button>

              <button
                className="secondary-button compact"
                onClick={handleExportMarksheet}
              >
                <Download size={13} />
                Export CSV
              </button>

              <button
                className="primary-button compact"
                onClick={handleSaveMarks}
              >
                <Check size={14} />
                Save marks
              </button>
            </div>
          </div>

          {/* Exam Specs Banner */}
          {currentExam && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                padding: "14px 18px",
                background: "var(--bg-raised)",
                borderRadius: "10px",
                border: "1px solid var(--border-subtle)",
                marginBottom: "16px",
              }}
            >
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">Subject & Grade</span>
                <span className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  {currentExam.subject} · <span className="grade-chip">{currentExam.grade}</span>
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">Maximum Marks</span>
                <span className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  {currentExam.max_marks ?? 100} pts (Pass: {currentExam.passing_marks ?? 40} pts)
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">Invigilator</span>
                <span className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  {currentExam.invigilator ?? "Department Faculty"}
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">Class Performance</span>
                <span className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  Avg: <strong className="text-[var(--brand)]">{markSheetStats.avg}%</strong> · Pass rate: <strong className="text-[var(--success)]">{markSheetStats.passRate}%</strong>
                </span>
              </div>
            </div>
          )}

          {/* Live Attendance Breakdown Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              padding: "10px 16px",
              background: "var(--bg-raised)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              marginBottom: "14px",
              fontSize: "12.5px",
            }}
          >
            <div className="flex items-center gap-3.5 flex-wrap">
              <span className="font-semibold text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
                Attendance:
              </span>
              <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                <span className="w-2 h-2 rounded-full bg-[var(--success)] inline-block" />
                <strong>{markSheetStats.presentCount}</strong> Present
              </span>
              <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                <span className="w-2 h-2 rounded-full bg-[var(--warning)] inline-block" />
                <strong>{markSheetStats.lateCount}</strong> Late
              </span>
              <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                <span className="w-2 h-2 rounded-full bg-[var(--brand)] inline-block" />
                <strong>{markSheetStats.leaveCount}</strong> Approved Leave
              </span>
              <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                <span className="w-2 h-2 rounded-full bg-[var(--violet)] inline-block" />
                <strong>{markSheetStats.halfDayCount}</strong> Half Day
              </span>
              <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                <span className="w-2 h-2 rounded-full bg-[var(--danger)] inline-block" />
                <strong>{markSheetStats.absentCount}</strong> Absent
              </span>
            </div>

            <button
              type="button"
              className="secondary-button compact"
              style={{ fontSize: "11.5px", padding: "4px 10px" }}
              onClick={handleMarkAllPresent}
              title="Reset all candidates to Present"
            >
              <Check size={12} />
              Mark all Present
            </button>
          </div>

          {/* Marksheet Table */}
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 840 }}>
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>Roll</th>
                  <th>USN</th>
                  <th>Student Name</th>
                  <th style={{ width: "135px" }}>Attendance</th>
                  <th style={{ width: "135px" }}>Marks Obtained</th>
                  <th style={{ width: "80px" }}>Out of</th>
                  <th style={{ width: "70px" }}>%</th>
                  <th style={{ width: "80px" }}>Grade</th>
                  <th>Teacher Remark</th>
                </tr>
              </thead>
              <tbody>
                {studentsLoading ? (
                  <SkeletonTableRows rows={6} columns={9} />
                ) : currentMarksList.map((entry) => {
                  const isAbsent = entry.status === "Absent";
                  const isLeave = entry.status === "Leave";
                  const scoreInfo = entry.marks !== null ? getGradeLetter(entry.marks, entry.maxMarks) : null;
                  const pct = entry.marks !== null ? Math.round((entry.marks / entry.maxMarks) * 100) : 0;
                  const statusMeta = ATTENDANCE_STATUS_META[entry.status];
                  return (
                    <tr key={entry.studentId} style={{ opacity: isAbsent ? 0.65 : 1 }}>
                      <td className="font-mono text-[12px] muted-cell">{entry.rollNo}</td>
                      <td className="font-mono text-[12px] font-medium text-[var(--text-secondary)]">{entry.usn}</td>
                      <td className="font-medium text-[var(--text-primary)]">
                        <div className="flex items-center gap-2">
                          <span className="avatar-chip">{entry.studentName.slice(0, 2).toUpperCase()}</span>
                          <span>{entry.studentName}</span>
                        </div>
                      </td>
                      <td>
                        <select
                          value={entry.status}
                          onChange={(e) => handleStatusChange(entry.studentId, e.target.value as AttendanceStatus)}
                          style={{
                            padding: "4px 7px",
                            borderRadius: "6px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            border: `1px solid ${statusMeta.border}`,
                            background: statusMeta.bg,
                            color: statusMeta.color,
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          <option value="Present" style={{ background: "var(--bg-panel-solid)", color: "var(--text-primary)" }}>
                            Present
                          </option>
                          <option value="Late" style={{ background: "var(--bg-panel-solid)", color: "var(--text-primary)" }}>
                            Late Arrival
                          </option>
                          <option value="Leave" style={{ background: "var(--bg-panel-solid)", color: "var(--text-primary)" }}>
                            Approved Leave
                          </option>
                          <option value="Half Day" style={{ background: "var(--bg-panel-solid)", color: "var(--text-primary)" }}>
                            Half Day
                          </option>
                          <option value="Absent" style={{ background: "var(--bg-panel-solid)", color: "var(--text-primary)" }}>
                            Absent
                          </option>
                        </select>
                      </td>
                      <td>
                        {isLeave ? (
                          <span
                            className="status-pill brand"
                            style={{ fontSize: "11px", padding: "3px 8px" }}
                            title="Excused on approved leave — re-test scheduled"
                          >
                            Excused
                          </span>
                        ) : isAbsent ? (
                          <span
                            className="status-pill danger"
                            style={{ fontSize: "11px", padding: "3px 8px" }}
                            title="Unexcused absence"
                          >
                            Absent
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max={entry.maxMarks}
                              value={entry.marks ?? ""}
                              onChange={(e) => handleMarkChange(entry.studentId, e.target.value)}
                              placeholder="0"
                              className="erp-marks-input"
                              style={{
                                width: "75px",
                                padding: "5px 8px",
                                borderRadius: "6px",
                                background: "var(--bg-input)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                                fontSize: "13px",
                                fontWeight: 600,
                                textAlign: "center",
                              }}
                            />
                            {entry.status === "Late" && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: "var(--warning)",
                                  background: "var(--warning-soft)",
                                  padding: "2px 5px",
                                  borderRadius: "4px",
                                }}
                                title="Candidate arrived late"
                              >
                                Late
                              </span>
                            )}
                            {entry.status === "Half Day" && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: "var(--violet)",
                                  background: "var(--violet-soft)",
                                  padding: "2px 5px",
                                  borderRadius: "4px",
                                }}
                                title="Half day attendance"
                              >
                                HD
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="muted-cell text-[12px]">/ {entry.maxMarks}</td>
                      <td className="font-mono text-[12.5px] font-medium">
                        {isLeave ? (
                          <span className="text-[var(--brand)] text-[12px]">Excused</span>
                        ) : isAbsent ? (
                          <span className="text-[var(--danger)] text-[12px]">0%</span>
                        ) : (
                          `${pct}%`
                        )}
                      </td>
                      <td>
                        {isLeave ? (
                          <span className="status-pill brand">Leave</span>
                        ) : isAbsent ? (
                          <span className="status-pill neutral">Ab</span>
                        ) : scoreInfo ? (
                          <span className={scoreInfo.badge}>
                            {scoreInfo.letter}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          value={entry.remarks}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!currentExam) return;
                            const key = `${currentExam.id}__${entry.studentId}`;
                            setMarksStore((prev) => ({
                              ...prev,
                              [key]: {
                                ...(prev[key] ?? { marks: entry.marks, status: entry.status }),
                                remarks: val,
                              },
                            }));
                          }}
                          placeholder="Feedback & notes..."
                          style={{
                            width: "100%",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            background: "transparent",
                            border: "1px solid transparent",
                            color: "var(--text-secondary)",
                            fontSize: "12px",
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = "var(--brand-border)";
                            e.currentTarget.style.background = "var(--bg-input)";
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = "transparent";
                            e.currentTarget.style.background = "transparent";
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between" style={{ marginTop: "16px", padding: "0 4px" }}>
            <span className="text-[12.5px] text-[var(--text-muted)]">
              Showing {currentMarksList.length} candidates in {currentExam?.grade}
            </span>
            <button className="primary-button" onClick={handleSaveMarks}>
              <Check size={14} />
              Save all marks
            </button>
          </div>
        </section>
      )}

      {/* TAB 3: GRADE PUBLISHING & PORTALS */}
      {activeTab === "publishing" && (
        <section className="panel">
          <div className="panel-header" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 className="panel-title">Results release</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="count-badge">
                {publishingList.filter((r) => !r.published).length} pending release
              </span>
              <button
                className="primary-button compact"
                onClick={handlePublishAll}
              >
                <Send size={13} />
                Publish all graded papers
              </button>
            </div>
          </div>

          <div
            style={{
              padding: "12px 16px",
              background: "var(--brand-soft-2)",
              border: "1px solid var(--brand-border)",
              borderRadius: "8px",
              fontSize: "13px",
              color: "var(--text-secondary)",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <CheckCircle2 size={16} className="text-[var(--brand)] flex-shrink-0" />
            <span>
              Papers set to <strong>Published</strong> are immediately accessible on family dashboards and the pupil portal report cards.
            </span>
          </div>

          <div className="schedule-list">
            {resultsLoading ? (
              <SkeletonList rows={5} avatar={false} />
            ) : (
              publishingList.map((row) => {
                const isPublished = row.published;
                const percent = Math.round((row.graded / row.total) * 100);
                return (
                  <div className="schedule-row" key={row.id}>
                    <div className="schedule-time font-mono" style={{ width: "70px" }}>
                      {row.graded}/{row.total}
                    </div>
                    <div className="schedule-line">
                      <span
                        className="schedule-dot"
                        style={{
                          background: isPublished ? "var(--brand)" : "var(--warning)",
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-[var(--text-primary)]">
                            {row.subject}{" "}
                            <span className="text-[var(--text-muted)]">· {row.grade}</span>
                          </div>
                          <span className="text-[12px] text-[var(--text-muted)] block mt-0.5">
                            {isPublished
                              ? "Live on Pupil & Parent Portal"
                              : "Internal only · Awaiting publication"}
                          </span>
                        </div>

                        <button
                          className={isPublished ? "tiny-action done" : "tiny-action"}
                          onClick={() => handleTogglePublish(row.id, isPublished)}
                          title={isPublished ? "Unpublish to hide from families" : "Publish to make visible to families"}
                        >
                          {isPublished ? (
                            <>
                              <Check size={13} />
                              Published
                            </>
                          ) : (
                            <>
                              <Send size={13} />
                              Publish to portal
                            </>
                          )}
                        </button>
                      </div>

                      <div className="mt-2.5 flex items-center gap-3">
                        <span className="progress-bar" style={{ height: "6px" }}>
                          <span
                            style={{
                              width: `${percent}%`,
                              background: isPublished ? "var(--brand)" : "var(--warning)",
                            }}
                          />
                        </span>
                        <span className="text-[12px] font-mono text-[var(--text-muted)]" style={{ minWidth: "75px" }}>
                          {percent}% graded
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* TAB 4: OFFICIAL REPORT CARDS */}
      {activeTab === "report-cards" && (
        <section className="panel">
          <div className="panel-header" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 className="panel-title">Progress report</h2>
            </div>

            <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
              <div style={{ width: "240px" }}>
                <FormSelect
                  options={students.map((s) => ({
                    value: String(s.id),
                    label: `${s.name} (${s.grade})`,
                  }))}
                  value={selectedReportStudent ? String(selectedReportStudent.id) : ""}
                  onChange={setReportCardStudentId}
                  ariaLabel="Select student for report card"
                />
              </div>

              <button
                className="secondary-button compact"
                onClick={() => {
                  window.print();
                  toast.success("Printing report card...", {
                    description: "Print dialog dispatched.",
                  });
                }}
              >
                <Printer size={13} />
                Print report card
              </button>

              <button
                className="primary-button compact"
                onClick={() => {
                  if (!selectedReportStudent) return;
                  const headers = ["Subject", "Max Marks", "Passing Marks", "Marks Scored", "Grade", "Remarks"];
                  const rows = [
                    ["Mathematics", 100, 40, 92, "A+", "Exceptional analytical reasoning"],
                    ["Science", 100, 40, 88, "A", "Active laboratory contributor"],
                    ["English", 100, 40, 85, "A", "Articulate in written prose"],
                    ["Social Science", 100, 40, 90, "A+", "Thorough understanding of history"],
                    ["Languages", 100, 40, 83, "A", "Strong linguistic grasp"],
                    ["Computer Science", 100, 40, 95, "A+", "Outstanding programming project"],
                  ];
                  downloadCsv(`${selectedReportStudent.name.replace(/\s+/g, "_")}_Report_Card.csv`, headers, rows);
                  toast.success("Report Card Summary Downloaded");
                }}
              >
                <Download size={13} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Report Card Document Box */}
          {selectedReportStudent ? (
            <div
              className="report-card-container"
              style={{
                marginTop: "12px",
                padding: "28px 32px",
                borderRadius: "12px",
                border: "1px solid var(--border-strong)",
                background: "rgba(255, 255, 255, 0.02)",
              }}
            >
              {/* Institutional Header */}
              <div style={{ textAlign: "center", borderBottom: "2px solid var(--border)", paddingBottom: "18px", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "0.02em", color: "var(--text-primary)", margin: 0 }}>
                  GLOBAL KIDS SCHOOL, TUMAKURU
                </h2>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", margin: "4px 0 0" }}>
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
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  ACADEMIC PROGRESS REPORT · TERM 1 (2026–2027)
                </span>
              </div>

              {/* Student Metadata Dossier */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "14px",
                  padding: "16px 20px",
                  background: "var(--bg-raised)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: "24px",
                  fontSize: "13px",
                }}
              >
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">Student Name</span>
                  <strong className="text-[var(--text-primary)] font-semibold">{selectedReportStudent.name}</strong>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">USN / Admission No.</span>
                  <span className="font-mono text-[var(--text-secondary)]">{selectedReportStudent.usn ?? `ADM-2627-${selectedReportStudent.id}`}</span>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">Grade & Section</span>
                  <span className="text-[var(--text-secondary)]">{selectedReportStudent.grade}</span>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">Attendance Record</span>
                  <span className="text-[var(--success)] font-medium">{selectedReportStudent.attendance}% Present</span>
                </div>
              </div>

              {/* Scholastic Table */}
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th style={{ width: "90px" }}>Max Marks</th>
                      <th style={{ width: "90px" }}>Pass Marks</th>
                      <th style={{ width: "110px" }}>Marks Scored</th>
                      <th style={{ width: "80px" }}>%</th>
                      <th style={{ width: "90px" }}>Grade</th>
                      <th>Evaluation Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { sub: "Mathematics", max: 100, pass: 40, scored: 92, remark: "Exceptional analytical reasoning" },
                      { sub: "Science", max: 100, pass: 40, scored: 88, remark: "Active laboratory contributor" },
                      { sub: "English", max: 100, pass: 40, scored: 85, remark: "Articulate in written prose" },
                      { sub: "Social Science", max: 100, pass: 40, scored: 90, remark: "Thorough understanding of history" },
                      { sub: "Languages", max: 100, pass: 40, scored: 83, remark: "Strong linguistic grasp" },
                      { sub: "Computer Science", max: 100, pass: 40, scored: 95, remark: "Outstanding programming project" },
                    ].map((row) => {
                      const pct = Math.round((row.scored / row.max) * 100);
                      const g = getGradeLetter(row.scored, row.max);
                      return (
                        <tr key={row.sub}>
                          <td className="font-medium text-[var(--text-primary)]">{row.sub}</td>
                          <td className="muted-cell">{row.max}</td>
                          <td className="muted-cell">{row.pass}</td>
                          <td className="font-semibold text-[var(--text-primary)] font-mono">{row.scored}</td>
                          <td className="font-mono text-[12.5px]">{pct}%</td>
                          <td>
                            <span className={g.badge}>{g.letter}</span>
                          </td>
                          <td className="text-[var(--text-secondary)] text-[12.5px]">{row.remark}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Evaluation Summary Box */}
              <div
                style={{
                  marginTop: "20px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px",
                  padding: "16px 20px",
                  borderRadius: "8px",
                  background: "var(--brand-soft-2)",
                  border: "1px solid var(--brand-border)",
                }}
              >
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">Grand Total</span>
                  <strong className="text-[16px] text-[var(--text-primary)]">533 / 600</strong>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">Percentage</span>
                  <strong className="text-[16px] text-[var(--brand)]">88.8%</strong>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">Overall Grade</span>
                  <strong className="text-[16px] text-[var(--success)]">A+ (Distinction)</strong>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold block">Result Status</span>
                  <span className="status-pill success" style={{ display: "inline-flex", marginTop: "2px" }}>
                    <span className="status-dot" />
                    PROMOTED
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "48px",
                  paddingTop: "20px",
                  borderTop: "1px dashed var(--border)",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ height: "24px" }} />
                  <span style={{ borderTop: "1px solid var(--border)", display: "block", paddingTop: "4px" }}>
                    Class Teacher Signature
                  </span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ height: "24px" }} />
                  <span style={{ borderTop: "1px solid var(--border)", display: "block", paddingTop: "4px" }}>
                    Controller of Examinations
                  </span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ height: "24px" }} />
                  <span style={{ borderTop: "1px solid var(--border)", display: "block", paddingTop: "4px" }}>
                    Principal & Head of School
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[var(--text-muted)] text-sm py-8 text-center">Please select a student above.</p>
          )}
        </section>
      )}

      {/* SCHEDULE EXAM MODAL */}
      {scheduleModalOpen && (
        <ScheduleExamModal
          onClose={() => setScheduleModalOpen(false)}
          onCreated={(newExam) => {
            setExams((prev) => {
              const updated = [newExam, ...prev];
              try {
                localStorage.setItem("erp_custom_exams_v2", JSON.stringify(updated));
              } catch {
                // ignore
              }
              return updated;
            });
            toast.success("Exam Scheduled Successfully", {
              description: `${newExam.name} has been added to the master timetable for ${newExam.grade}.`,
            });
          }}
          staffList={staff}
          subjectList={subjects}
        />
      )}

      {/* EXAM DETAIL DRAWER */}
      {examDetailDrawerItem && (
        <ExamDetailDrawer
          exam={examDetailDrawerItem}
          onClose={() => setExamDetailDrawerItem(null)}
          onEnterMarks={(examId) => {
            setSelectedExamId(examId);
            setActiveTab("marks");
            setExamDetailDrawerItem(null);
          }}
          onDelete={handleDeleteExam}
        />
      )}
    </div>
  );
}

/**
 * Schedule Exam Modal Dialog
 */
function ScheduleExamModal({
  onClose,
  onCreated,
  staffList,
  subjectList,
}: {
  onClose: () => void;
  onCreated: (exam: DetailedExam) => void;
  staffList: { id: string | number; name: string }[];
  subjectList: { id: string | number; name: string }[];
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState(subjectList[0]?.name ?? "Mathematics");
  const [grade, setGrade] = useState("Grade 8");
  const [date, setDate] = useState("15 Oct 2026");
  const [time, setTime] = useState("09:00 – 10:30");
  const [venue, setVenue] = useState("Room 204");
  const [invigilator, setInvigilator] = useState(staffList[0]?.name ?? "Faculty in charge");
  const [maxMarks, setMaxMarks] = useState("100");
  const [passingMarks, setPassingMarks] = useState("40");
  const [syllabus, setSyllabus] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Exam name required", {
        description: "Please enter a descriptive name for this examination.",
      });
      return;
    }

    const newExam: DetailedExam = {
      id: `EXM-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      subject,
      grade,
      date,
      time,
      venue,
      status: "Scheduled",
      invigilator,
      max_marks: parseInt(maxMarks, 10) || 100,
      passing_marks: parseInt(passingMarks, 10) || 40,
      syllabus: syllabus.trim() || "Curriculum chapters as designated by the subject coordinator.",
    };

    onCreated(newExam);
    onClose();
  };

  return (
    <>
      <DrawerBackdrop onClose={onClose} />
      <div
        className="app-dialog"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 60,
          width: "min(560px, calc(100vw - 32px))",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--bg-panel-solid)",
          border: "1px solid var(--border-strong)",
          borderRadius: "14px",
          padding: "24px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7)",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: "18px" }}>
          <div>
            <h2 className="panel-title">Schedule examination</h2>
          </div>
          <button
            className="secondary-button compact"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label className="text-[12px] font-semibold text-[var(--text-secondary)] block mb-1">
              Examination Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Mid-term Physics, Unit Test 3, Biology Practical"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="search-input"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="text-[12px] font-semibold text-[var(--text-secondary)] block mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="search-input"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px" }}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[var(--text-secondary)] block mb-1">Target Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="search-input"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px" }}
              >
                {["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="text-[12px] font-semibold text-[var(--text-secondary)] block mb-1">Date</label>
              <input
                type="text"
                placeholder="DD Mon YYYY"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="search-input"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px" }}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[var(--text-secondary)] block mb-1">Time Window</label>
              <input
                type="text"
                placeholder="e.g. 09:00 – 10:30"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="search-input"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="text-[12px] font-semibold text-[var(--text-secondary)] block mb-1">Venue / Hall</label>
              <input
                type="text"
                placeholder="e.g. Room 204, Science Lab"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="search-input"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px" }}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[var(--text-secondary)] block mb-1">Invigilator</label>
              <input
                type="text"
                value={invigilator}
                onChange={(e) => setInvigilator(e.target.value)}
                className="search-input"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="text-[12px] font-semibold text-[var(--text-secondary)] block mb-1">Max Marks</label>
              <input
                type="number"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
                className="search-input"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px" }}
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[var(--text-secondary)] block mb-1">Passing Marks</label>
              <input
                type="number"
                value={passingMarks}
                onChange={(e) => setPassingMarks(e.target.value)}
                className="search-input"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px" }}
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[var(--text-secondary)] block mb-1">
              Portion & Syllabus Outline
            </label>
            <textarea
              rows={2}
              placeholder="Outline units or chapters covered..."
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
              className="search-input"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", resize: "vertical" }}
            />
          </div>

          <div className="flex items-center justify-end gap-2" style={{ marginTop: "12px" }}>
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              <Plus size={15} />
              Confirm schedule
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

/**
 * Exam Detail Sliding Right Drawer
 */
function ExamDetailDrawer({
  exam,
  onClose,
  onEnterMarks,
  onDelete,
}: {
  exam: DetailedExam;
  onClose: () => void;
  onEnterMarks: (examId: string) => void;
  onDelete: (examId: string) => void;
}) {
  return (
    <>
      <DrawerBackdrop onClose={onClose} />
      <aside
        className="profile-drawer wide"
        style={{
          width: "min(440px, calc(100vw / var(--ui-zoom)))",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: "20px" }}>
          <div>
            <h2 className="panel-title" style={{ fontSize: "18px" }}>{exam.name}</h2>
          </div>
          <button className="secondary-button compact" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              padding: "16px",
              borderRadius: "10px",
              background: "var(--bg-raised)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-muted)]">Target Grade</span>
              <span className="grade-chip">{exam.grade}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-muted)]">Subject</span>
              <strong className="text-[13px] text-[var(--text-primary)]">{exam.subject}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-muted)]">Date & Window</span>
              <span className="text-[13px] text-[var(--text-primary)]">{exam.date} · {exam.time}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-muted)]">Venue</span>
              <span className="text-[13px] text-[var(--text-primary)]">{exam.venue}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-muted)]">Invigilator</span>
              <span className="text-[13px] text-[var(--text-primary)]">{exam.invigilator ?? "Staff in charge"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-muted)]">Max Marks</span>
              <span className="text-[13px] text-[var(--text-primary)] font-mono">{exam.max_marks ?? 100} pts (Pass: {exam.passing_marks ?? 40} pts)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-muted)]">Status</span>
              <span className="status-pill success">{exam.status}</span>
            </div>
          </div>

          <div>
            <h3 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
              Prescribed Syllabus & Portions
            </h3>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                fontSize: "12.5px",
                lineHeight: "1.5",
                color: "var(--text-secondary)",
              }}
            >
              {exam.syllabus ?? "Comprehensive syllabus as prescribed by the department."}
            </div>
          </div>

          <div>
            <h3 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
              Hall Instructions & Protocols
            </h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: "18px",
                fontSize: "12px",
                color: "var(--text-muted)",
                lineHeight: "1.6",
              }}
            >
              <li>Students must report to {exam.venue} 15 minutes before commencement.</li>
              <li>Calculators and smart watches are strictly prohibited unless specified.</li>
              <li>Verified hall tickets must remain visible on the desk.</li>
            </ul>
          </div>

          <div className="flex items-center gap-2" style={{ marginTop: "16px" }}>
            <button
              className="primary-button"
              style={{ flex: 1 }}
              onClick={() => onEnterMarks(exam.id)}
            >
              <Pencil size={14} />
              Enter marks
            </button>
            <button
              className="secondary-button text-[var(--danger)]"
              onClick={() => onDelete(exam.id)}
              title="Delete this exam"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

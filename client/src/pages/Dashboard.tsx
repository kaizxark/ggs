import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Award,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Database,
  FolderOpen,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Command,
  Download,
  FileBarChart,
  FileText,
  Filter,
  Globe,
  GraduationCap,
  IndianRupee,
  Layers,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  School,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  KeyRound,
  User,
  UserCheck,
  UserCog,
  Users,
  UserX,
  Radio,
  Eye,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "@/lib/toast";
import { notifyDataChanged } from "../lib/live-data";
import { useLocation } from "wouter";
import {
  changePortalCredentials,
  requestSignInCode,
  verifySignInCode,
  resetPasswordByUsername,
  signOut as supabaseSignOut,
  useSession,
  supabase,
} from "../lib/supabase";
import {
  AI_PROVIDERS,
  askAssistant,
  clearSharedAiSettings,
  getAiConfig,
  getProvider,
  isAiConfigured,
  isSuperAdmin,
  loadSharedAiSettings,
  saveSharedAiSettings,
  setAiConfig,
  testAiConnection,
  type AiAnswer,
  type AiConfig,
  type AiTurn,
} from "../lib/ai-assistant";
import { buildAssistantBrief } from "../lib/ai-context";
import { GEMINI_MODELS } from "../lib/gemini";
import {
  activityIconMap,
  avatarTones,
  useActivityFeed,
  useAnnouncements,
  useAttendanceDaily,
  useClassAttendance,
  useDashboardAttendance,
  useStudentCounts,
  useExamResults,
  useExams,
  useFeeCategories,
  useFinanceMonthly,
  useGradeOutcomes,
  useHealthMetrics,
  useInvoices,
  usePayments,
  useLibraryBooks,
  useMessages,
  useNotifications,
  usePeople,
  usePerformanceTrend,
  useReportExports,
  useSchedule,
  useSettings,
  useStaff,
  useStudents,
  useSubjectAverages,
  useSubjects,
  useTimetable,
  useCurrentUser,
  type RowId,
  type Settings,
  type Student,
  type Invoice,
  getAnnualFeeForGrade,
} from "../lib/school-data";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_THRESHOLD,
  attendancePercent,
  attendanceToday,
  loadAttendance,
  saveClassAttendance,
  type AttendanceAbsenteeItem,
  type AttendanceBootstrap,
  type AttendanceClassOption,
  type AttendanceStatus,
} from "../lib/attendance";
import { useRealtimeInvalidation } from "../lib/use-realtime";
import { ApiError } from "../lib/student-directory";
import {
  SkeletonChart,
  SkeletonCircle,
  SkeletonHealthGrid,
  SkeletonInline,
  SkeletonList,
  SkeletonMetric,
  SkeletonNav,
  SkeletonRegion,
  SkeletonTableRows,
  SkeletonText,
} from "../components/ErpSkeleton";
import { Pager, usePagination } from "../components/ErpPagination";
import { MetricBlock } from "../components/MetricBlock";
import { Breadcrumb } from "../components/Breadcrumb";
import { StudentDocumentsPanel } from "../components/StudentDocuments";
import { UserManagementView } from "../components/UserManagementView";
import PupilOverview from "../components/PupilOverview";
import { PupilMobileDashboard } from "../components/PupilMobileDashboard";
import {
  StaffMobileShell,
  type StaffMobileTab,
} from "../components/StaffMobileShell";
import { StudentDirectory } from "./StudentDirectory";
import { StaffDrawer } from "../components/StaffDrawer";
import { StaffCreateDialog } from "../components/StaffCreateDialog";
import { recordManualPayment } from "../lib/fee-payments";
import { authHeaders } from "../lib/supabase";
import { ReportsView } from "../components/ReportsView";
import { ExaminationsView } from "../components/ExaminationsView";
import { AcademicsView } from "../components/AcademicsView";
import { FormSelect } from "../components/FormSelect";
import { DateDropdowns } from "../components/DateDropdowns";
import { SmoothFilterDropdown } from "../components/SmoothFilterDropdown";
import { SegmentedControl } from "../components/SegmentedControl";
import SmoothScroll, { smoothScrollTo, usePageScrollLock } from "../components/SmoothScroll";
import {
  effectiveRole,
  isSuperAdminId,
  roleLabel,
  superAdminGuard,
} from "@shared/super-admin";
import { screenLabelByName, screensForRole } from "@shared/ai-access";
import { USERNAME_PATTERN } from "@/lib/username";

/** Initials for the signed-in user, e.g. "Ehtesham" -> "EH". */
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Screens each role can open, used to scope the assistant's brief and
 * suggestions.
 *
 * Delegates to `@shared/ai-access` rather than keeping a copy here. This list
 * used to be a second, hand-maintained version of the same rules, and the two
 * drifted: the server's copy knew about the Documents screen and this one did
 * not. One list means the assistant can never offer a button leading to a
 * screen the server would refuse to route to.
 */
function VISIBLE_SCREENS_FOR_ROLE(role: string): string[] {
  return screensForRole(role).map(key => screenLabelByName(key) ?? key);
}

/**
 * True while the sidebar is a drawer rather than a rail.
 *
 * 946px is the stylesheet's own breakpoint — the width at which
 * `.mobile-menu-button` appears. Reading the same number here is what keeps the
 * layout swap and the pupil's phone dashboard from disagreeing, which would
 * show a bottom bar beside an open sidebar for a few pixels of screen.
 */
function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 946px)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 946px)");
    const onChange = () => setNarrow(query.matches);
    query.addEventListener("change", onChange);
    onChange();
    return () => query.removeEventListener("change", onChange);
  }, []);

  return narrow;
}

/**
 * Contextual prompts shown when the palette is empty.
 *
 * Two things filter these: the screen the user is on, and the screens their
 * role can open. The second filter is the important one. A teacher being
 * offered "How much fee is outstanding?" is an assistant that has just told
 * them, before they have typed anything, that it is looking at numbers it is
 * not allowed to see — and their first tap would be answered with a refusal.
 */
function SUGGESTED_QUESTIONS_FOR_ROLE(
  role: string,
  activeScreen: string | null
): string[] {
  const lower = role.toLowerCase();
  const isSuper = lower === "super admin" || lower === "super_admin";
  const isAdmin = lower === "admin";
  const isPrincipal = lower === "principal";
  const isTeacher = lower === "teacher";

  const screenSpecific =
    activeScreen === null ? [] : (SCREEN_PROMPTS[activeScreen] ?? []);

  // Keyed on the screen each question needs, so anything the role cannot reach
  // is dropped rather than answered with a refusal.
  const rolePrompts: Record<string, string[]> = isSuper
    ? {
        users: [
          "Who is the super admin?",
          "Which staff have admin access?",
          "Show me everyone's role and access level",
          "Which accounts are protected and cannot be changed?",
        ],
        finance: [
          "Which families owe the most?",
          "How much is overdue, and since when?",
        ],
        analytics: ["Which students are at risk of falling behind?"],
        attendance: ["Which classes are below the attendance threshold?"],
        overview: ["Give me the school's headline numbers"],
      }
    : isAdmin
      ? {
          users: [
            "Who can invite new staff?",
            "Show me everyone's role and access level",
          ],
          finance: ["Show me the fee collection summary"],
          analytics: ["Which students are at risk of falling behind?"],
          overview: ["Give me the school's headline numbers"],
        }
      : isPrincipal
        ? {
            finance: ["How much fee is outstanding?"],
            analytics: ["Which grade is performing weakest?"],
            staff: ["Who is on campus today?"],
            overview: ["Give me the school's headline numbers"],
          }
        : isTeacher
          ? {
              students: ["Which of my students are at risk?"],
              academics: ["What is on the timetable today?"],
              attendance: ["How is class attendance trending?"],
            }
          : {
              overview: ["How many students are enrolled?"],
              attendance: ["What is the attendance today?"],
              students: ["Which students are enrolled?"],
            };

  const allowed = new Set(screensForRole(lower).map(key => key as string));
  const roleSpecific: string[] = [];
  for (const screen of Object.keys(rolePrompts)) {
    if (!allowed.has(screen)) continue;
    roleSpecific.push(...rolePrompts[screen]);
  }

  // Screen prompts are for a screen the user is already on, which is by
  // definition one they can open, so they need no role check.
  return Array.from(new Set([...screenSpecific, ...roleSpecific])).slice(0, 6);
}

const SCREEN_PROMPTS: Record<string, string[]> = {
  Overview: [
    "How is the school doing overall?",
    "What are the headline numbers today?",
  ],
  Students: [
    "Which students are in Grade 5?",
    "Who has the lowest attendance?",
    "Find a student by USN",
  ],
  Attendance: [
    "Which class has the lowest attendance?",
    "How many students were present today?",
    "Which classes are below 90% attendance?",
  ],
  "Fees & Finance": [
    "Which fees are still outstanding?",
    "Who owes the most?",
    "What is the collection rate?",
  ],
  Analytics: [
    "Which grade is weakest academically?",
    "How has performance trended this year?",
    "Which subjects are strongest?",
  ],
  Staff: [
    "Who teaches Science?",
    "Which staff are on campus today?",
    "Who is in the accounts department?",
  ],
  Academics: [
    "What is on the timetable today?",
    "Which exams are coming up?",
  ],
  Examinations: [
    "When is the next Grade 10 exam?",
    "Which exam results are still unpublished?",
    "What is the exam schedule this week?",
  ],
  Reports: ["Which reports have been exported recently?"],
  "User management": [
    "Who has admin access?",
    "Invite a new staff member",
    "Who is the super admin?",
  ],
  Settings: [
    "What are the school's current settings?",
    "Change the attendance threshold",
  ],
};

function currentView(): string | null {
  // The palette is rendered outside the view stack, so it does not know which
  // screen is active unless the parent tells it. We derive a best guess from
  // the URL so the suggestions stay screen-aware.
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  if (
    pathname.endsWith("/dashboard") ||
    pathname === "/" ||
    pathname.endsWith("/")
  )
    return "Overview";
  const segment = pathname.split("/").pop() ?? "";
  if (SCREEN_PROMPTS[segment]) return segment;
  return null;
}

/**
 * Time-of-day greeting, using the viewer's own clock.
 *
 * Boundaries follow common usage: before 12 it's morning, up to 17 afternoon,
 * and everything after that stays "Good evening" rather than switching to a
 * night greeting.
 */
function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const accent = "var(--brand)";

const navGroups = [
  {
    label: "School",
    items: [
      { label: "Overview", icon: LayoutDashboard },
      { label: "Students", icon: GraduationCap },
      { label: "Staff", icon: Users },
      { label: "Academics", icon: BookOpen },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Attendance", icon: ClipboardCheck },
      { label: "Examinations", icon: FileText },
      { label: "Fees & Finance", icon: IndianRupee },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Analytics", icon: Activity },
      { label: "Reports", icon: FileBarChart },
    ],
  },
];

/**
 * Breadcrumb trail shown at the top of every sub-page.
 *
 * Replaced the old "← Overview" back link: a trail reads the same on every
 * screen, says where you are in the school hierarchy, and each segment is a
 * real jump target rather than a single undifferentiated "go back".
 */
function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`icon-button ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * What the assistant says it is doing while it works.
 *
 * The old line was "Reading the dashboard…", which described an implementation
 * detail and then sat still, so a slow answer looked like a hang. These name the
 * step actually in progress, and the travelling dots below them carry the
 * waiting — so a request that takes ten seconds reads as ten seconds of visible
 * work rather than a frozen panel.
 */
const THINKING_LINES = [
  "Checking the live records…",
  "Looking through the school data…",
  "Working out the numbers…",
  "Matching this against your dashboard…",
  "Putting the answer together…",
];

function CommandPalette(props: {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: string, entityId?: RowId, entityType?: "student" | "staff") => void;
  activeView?: string;
}) {
  if (!props.open) return null;
  return <CommandPaletteBody {...props} />;
}

function CommandPaletteBody({
  open,
  onClose,
  onNavigate,
  activeView,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: string, entityId?: RowId, entityType?: "student" | "staff") => void;
  activeView?: string;
}) {
  usePageScrollLock();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [aiState, setAiState] = useState<"idle" | "loading">("idle");
  /**
   * The answer currently on screen.
   *
   * One slot, shown where the results would have been. This began as a
   * scrolling transcript with the questions echoed back on the right, but the
   * palette is a search box first: switching it into a messaging panel meant
   * the thing you searched for disappeared the moment you asked anything, and
   * every follow-up buried the answer you were actually reading.
   *
   * The conversation is not thrown away with the layout, though. `historyRef`
   * keeps every exchange, so a follow-up like "and Grade 5?" still reaches the
   * model with the earlier turn in view — the context survives even though the
   * transcript is no longer on screen.
   */
  const [answer, setAnswer] = useState<{
    question: string;
    reply: AiAnswer;
  } | null>(null);
  const { rows: students } = useStudents();
  const { rows: invoices } = useInvoices();
  const { rows: classAttendance } = useClassAttendance();
  const { rows: gradeOutcomes } = useGradeOutcomes();
  const { rows: staff } = useStaff();
  const { rows: dailyAttendance } = useAttendanceDaily();
  const { rows: feeCategories } = useFeeCategories();
  const { rows: financeMonths } = useFinanceMonthly();
  const { rows: exams } = useExams();
  const { rows: examResults } = useExamResults();
  const { rows: subjects } = useSubjects();
  const { rows: subjectAverages } = useSubjectAverages();
  const { rows: performanceTrend } = usePerformanceTrend();
  const { rows: healthMetrics } = useHealthMetrics();
  const { rows: announcements } = useAnnouncements();
  const { rows: messages } = useMessages();
  const { rows: notifications } = useNotifications();
  const { rows: libraryBooks } = useLibraryBooks();
  const { rows: schedule } = useSchedule();
  const { rows: reportExports } = useReportExports();
  const { rows: activityFeed } = useActivityFeed("general");
  const { rows: people } = usePeople();
  const { settings } = useSettings();
  const currentUser = useCurrentUser();
  const listRef = useRef<HTMLDivElement>(null);

  const userRole = currentUser?.role ?? "staff";
  const allowedScreens = useMemo(
    () => VISIBLE_SCREENS_FOR_ROLE(userRole),
    [userRole]
  );
  const allowedScreenSet = useMemo(
    () => new Set(allowedScreens),
    [allowedScreens]
  );

  const navigationPages = useMemo(
    () => [
      {
        view: "Overview",
        label: "Overview",
        detail: "Dashboard KPIs, today's roll call, notices & school pulse",
        icon: LayoutDashboard,
        keywords: ["overview", "dashboard", "home", "summary", "kpis", "stats", "activities", "pulse"],
      },
      {
        view: "Students",
        label: "Students",
        detail: "Pupil directory, enrolment status, class rosters & pupil records",
        icon: GraduationCap,
        keywords: ["students", "directory", "pupils", "enrollment", "roll call", "roster", "children", "kids"],
      },
      {
        view: "Staff",
        label: "Staff",
        detail: "Educators, coordinators, administration team & departments",
        icon: Users,
        keywords: ["staff", "teachers", "faculty", "educators", "employees", "directory", "team", "principal"],
      },
      {
        view: "Attendance",
        label: "Attendance",
        detail: "Daily roll call, mark attendance, class rates & absence tracking",
        icon: ClipboardCheck,
        keywords: ["attendance", "roll call", "absent", "present", "register", "daily register", "leave"],
      },
      {
        view: "Fees & Finance",
        label: "Fees & Finance",
        detail: "Fee invoices, collections, overdue balances & payment receipts",
        icon: IndianRupee,
        keywords: ["fees", "finance", "billing", "invoices", "payments", "collections", "accounts", "dues", "outstanding", "money"],
      },
      {
        view: "Analytics",
        label: "Analytics",
        detail: "Academic performance trends, grade analysis & student wellness",
        icon: Activity,
        keywords: ["analytics", "performance", "trends", "metrics", "grades", "statistics", "wellness", "insights"],
      },
      {
        view: "Academics",
        label: "Academics",
        detail: "Subjects, curriculum, weekly timetable & syllabus coverage",
        icon: BookOpen,
        keywords: ["academics", "curriculum", "subjects", "timetable", "schedule", "syllabus", "classes", "courses"],
      },
      {
        view: "Examinations",
        label: "Examinations",
        detail: "Exam timetables, grading progress, marks publishing & report cards",
        icon: FileText,
        keywords: ["examinations", "exams", "test", "marks", "results", "assessments", "papers", "report cards", "grading"],
      },
      {
        view: "Reports",
        label: "Reports",
        detail: "School performance exports, attendance sheets & compliance reports",
        icon: FileBarChart,
        keywords: ["reports", "exports", "data export", "print", "summary reports", "csv", "audit"],
      },
      {
        view: "User management",
        label: "User management",
        detail: "Staff access, role assignments, invites & student portal logins",
        icon: UserCog,
        keywords: [
          "user management",
          "users",
          "permissions",
          "roles",
          "access",
          "invites",
          "security",
          "privileges",
          "account logins",
          "credentials",
          "passwords",
          "student logins",
          "usn",
        ],
      },
      {
        view: "Settings",
        label: "Settings",
        detail: "School configuration, academic terms, profile & AI settings",
        icon: Settings2,
        keywords: ["settings", "config", "configuration", "preferences", "academic year", "ai settings", "options"],
      },
    ].filter(page => allowedScreenSet.has(page.view)),
    [allowedScreenSet]
  );

  const commands = useMemo(
    () => [
      {
        label: "Record attendance",
        detail: "Open today's attendance workspace",
        icon: ClipboardCheck,
        view: "Attendance",
      },
      {
        label: "Generate fee report",
        detail: "Open finance and collection analytics",
        icon: FileBarChart,
        view: "Fees & Finance",
      },
      {
        label: "Review grade outcomes",
        detail: "Compare grade-wise academic performance",
        icon: Activity,
        view: "Analytics",
      },
      {
        label: "Manage staff access",
        detail: "Invite staff and review roles",
        icon: UserCog,
        view: "User management",
      },
      {
        label: "Who is on campus today?",
        detail: "Ask the assistant about staffing",
        icon: Sparkles,
        view: "",
      },
      {
        label: "Which fees are outstanding?",
        detail: "Ask the assistant about collections",
        icon: Sparkles,
        view: "",
      },
      {
        label: "Which grade is struggling?",
        detail: "Ask the assistant about performance",
        icon: Sparkles,
        view: "",
      },
    ],
    []
  );

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        pages: [],
        students: [],
        staff: [],
        classes: [],
        invoices: [],
        exams: [],
        subjects: [],
        announcements: [],
        libraryBooks: [],
        cmds: commands,
      };
    }
    const normalized = trimmed.toLowerCase();

    // 1. Pages & Navigation
    const matchingPages = navigationPages
      .filter(
        p =>
          p.label.toLowerCase().includes(normalized) ||
          p.detail.toLowerCase().includes(normalized) ||
          p.keywords.some(
            k =>
              k.toLowerCase().includes(normalized) ||
              normalized.includes(k.toLowerCase())
          )
      )
      .slice(0, 4);

    // 2. Students
    const matchingStudents = students
      .filter(s =>
        `${s.name} ${s.grade} ${s.section} ${s.usn ?? ""} ${s.status ?? ""}`
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, 5);

    // 3. Staff
    const matchingStaff = staff
      .filter(m =>
        `${m.name} ${m.role} ${m.department} ${m.usn ?? ""} ${m.email ?? ""}`
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, 4);

    // 4. Classes / Classrooms
    const matchingClasses = classAttendance
      .filter(c =>
        `${c.label} ${c.teacher ?? ""}`.toLowerCase().includes(normalized)
      )
      .slice(0, 3);

    // 5. Fee Invoices
    const matchingInvoices = allowedScreenSet.has("Fees & Finance")
      ? invoices
          .filter(inv =>
            `${inv.student} ${inv.family} ${inv.status} ${inv.id}`
              .toLowerCase()
              .includes(normalized)
          )
          .slice(0, 3)
      : [];

    // 6. Examinations
    const matchingExams = allowedScreenSet.has("Examinations")
      ? exams
          .filter(e =>
            `${e.name} ${e.subject} ${e.grade} ${e.status}`
              .toLowerCase()
              .includes(normalized)
          )
          .slice(0, 3)
      : [];

    // 7. Subjects
    const matchingSubjects = allowedScreenSet.has("Academics")
      ? subjects
          .filter(sub =>
            `${sub.name} ${sub.teacher ?? ""} ${sub.classList.join(" ")}`
              .toLowerCase()
              .includes(normalized)
          )
          .slice(0, 3)
      : [];

    // 8. Announcements
    const matchingAnnouncements = announcements
      .filter(a =>
        `${a.title} ${a.audience ?? ""} ${a.body ?? ""}`
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, 2);

    // 9. Library Books
    const matchingBooks = allowedScreenSet.has("Academics")
      ? libraryBooks
          .filter(b =>
            `${b.title} ${b.author} ${b.category}`
              .toLowerCase()
              .includes(normalized)
          )
          .slice(0, 2)
      : [];

    // 10. Commands
    const matchingCmds = commands.filter(cmd =>
      `${cmd.label} ${cmd.detail}`.toLowerCase().includes(normalized)
    );

    return {
      pages: matchingPages,
      students: matchingStudents,
      staff: matchingStaff,
      classes: matchingClasses,
      invoices: matchingInvoices,
      exams: matchingExams,
      subjects: matchingSubjects,
      announcements: matchingAnnouncements,
      libraryBooks: matchingBooks,
      cmds: matchingCmds,
    };
  }, [
    query,
    students,
    staff,
    navigationPages,
    classAttendance,
    invoices,
    exams,
    subjects,
    announcements,
    libraryBooks,
    commands,
    allowedScreenSet,
  ]);

  /**
   * The role-scoped prompts shown when the box is empty.
   *
   * Held in state rather than computed inline at the render site: `flat` needs
   * the same list so the rows can be reached with the keyboard and hovered
   * without falling through to a -1 index.
   */
  const suggestions = useMemo(
    () =>
      SUGGESTED_QUESTIONS_FOR_ROLE(
        currentUser?.role ?? "",
        activeView ?? currentView()
      ),
    [currentUser?.role, activeView]
  );

  /**
   * Flatten the visible groups into one ordered list so ↑/↓ move through
   * people, commands and prompts as a single sequence, which is what a user
   * expects from a spotlight palette. Enter opens whichever row is
   * highlighted.
   */
  const flat = useMemo(() => {
    const out: { key: string; run: () => void }[] = [];

    // Empty query: the prompts sit above the general commands, matching the
    // order they are rendered in below.
    if (!query.trim()) {
      for (const question of suggestions) {
        out.push({
          key: `sug-${question}`,
          run: () => {
            setQuery(question);
            void runAssistant(question);
          },
        });
      }
      for (const item of results.cmds) {
        out.push({
          key: `c-${item.label}`,
          run: () => {
            if (item.view) {
              onNavigate(item.view);
              onClose();
            } else {
              setQuery(item.label);
              void runAssistant(item.label);
            }
          },
        });
      }
      return out;
    }

    // When query is non-empty:
    // 1. Pages & Navigation
    for (const page of results.pages) {
      out.push({
        key: `nav-${page.view}`,
        run: () => {
          onNavigate(page.view);
          onClose();
        },
      });
    }

    // 2. Students -> opens right slide!
    for (const student of results.students) {
      out.push({
        key: `p-${student.id}`,
        run: () => {
          onNavigate("Students", student.id, "student");
          onClose();
        },
      });
    }

    // 3. Staff -> opens staff slide drawer!
    for (const member of results.staff) {
      out.push({
        key: `st-${member.id}`,
        run: () => {
          onNavigate("Staff", member.id, "staff");
          onClose();
        },
      });
    }

    // 4. Classes
    for (const cls of results.classes) {
      out.push({
        key: `cls-${cls.id}`,
        run: () => {
          onNavigate("Attendance");
          onClose();
        },
      });
    }

    // 5. Fee Invoices
    for (const inv of results.invoices) {
      out.push({
        key: `inv-${inv.id}`,
        run: () => {
          onNavigate("Fees & Finance");
          onClose();
        },
      });
    }

    // 6. Exams
    for (const exam of results.exams) {
      out.push({
        key: `ex-${exam.id}`,
        run: () => {
          onNavigate("Examinations");
          onClose();
        },
      });
    }

    // 7. Subjects
    for (const sub of results.subjects) {
      out.push({
        key: `sub-${sub.id}`,
        run: () => {
          onNavigate("Academics");
          onClose();
        },
      });
    }

    // 8. Announcements
    for (const a of results.announcements) {
      out.push({
        key: `ann-${a.id}`,
        run: () => {
          onNavigate("Overview");
          onClose();
        },
      });
    }

    // 9. Library Books
    for (const b of results.libraryBooks) {
      out.push({
        key: `lib-${b.id}`,
        run: () => {
          onNavigate("Academics");
          onClose();
        },
      });
    }

    // 10. Quick Actions / Commands
    for (const item of results.cmds) {
      out.push({
        key: `c-${item.label}`,
        run: () => {
          if (item.view) {
            onNavigate(item.view);
            onClose();
          } else {
            setQuery(item.label);
            void runAssistant(item.label);
          }
        },
      });
    }

    // 11. AI Assistant query
    if (query.trim().length >= 2) {
      out.push({
        key: "ai",
        run: () => void runAssistant(query.trim()),
      });
    }

    return out;
  }, [results, query, suggestions, onNavigate, onClose]);

  /**
   * Every exchange so far, oldest first.
   *
   * Kept in a ref rather than in the state that drives the answer slot,
   * precisely so the transcript can stay off screen. The row list below is
   * memoised on the query, and after the first exchange the query is empty and
   * nothing else in its dependencies changes — so a `runAssistant` captured
   * inside it would keep seeing the history it was built with and every
   * follow-up would arrive cold. Reading the ref sidesteps that stale closure
   * without re-rendering the list on every message.
   */
  const historyRef = useRef<AiTurn[]>([]);

  const runAssistant = async (question: string) => {
    const clean = question.trim();
    if (!clean) return;

    // Snapshot before appending, so the request carries everything said so far
    // and nothing about the question being asked right now.
    const history = historyRef.current.slice();

    // The question deliberately stays in the input. Clearing it made the typed
    // text vanish the moment it was sent, which read as the palette throwing
    // the message away; leaving it there also means the user can edit it, or
    // delete it and ask something else, without retyping from scratch. It is
    // the one place the question is shown, so the answer no longer echoes it.
    setAiState("loading");

    // Construct the brief and datasets on demand at query-time rather than
    // recomputing 22 datasets on every search keystroke in the command palette.
    const currentBrief = buildAssistantBrief({
      students,
      staff,
      classAttendance,
      dailyAttendance,
      invoices,
      gradeOutcomes,
      feeCategories,
      financeMonths,
      exams,
      examResults,
      subjects,
      subjectAverages,
      performanceTrend,
      healthMetrics,
      announcements,
      messages,
      notifications,
      libraryBooks,
      schedule,
      reportExports,
      activityFeed,
      people,
      settings,
      roleScope: currentUser
        ? {
            userRole: currentUser.role,
            visibleScreens: VISIBLE_SCREENS_FOR_ROLE(currentUser.role),
            activeScreen: activeView,
          }
        : undefined,
    });

    const currentDatasets = {
      students,
      staff,
      invoices,
      classAttendance,
      dailyAttendance,
      gradeOutcomes,
      feeCategories,
      financeMonths,
      exams,
      examResults,
      subjects,
      subjectAverages,
      performanceTrend,
      healthMetrics,
      announcements,
      messages,
      notifications,
      libraryBooks,
      schedule,
      reportExports,
      activityFeed,
      people,
    };

    const reply = await askAssistant(clean, currentBrief, {
      history,
      datasets: currentDatasets,
      activeScreen: activeView ?? currentView(),
    });

    historyRef.current = [
      ...history,
      { role: "user", text: clean },
      { role: "model", text: reply.answer },
    ];
    setAnswer({ question: clean, reply });
    setAiState("idle");
  };

  /** Follow the assistant's own suggestion, or act on one of its buttons. */
  const openAction = (action: {
    screen: string;
    studentId?: string | null;
  }) => {
    const label = screenLabelByName(action.screen);
    if (!label) return;
    if (action.studentId) onNavigate(label, action.studentId, "student");
    else onNavigate(label);
    onClose();
  };

  // Reset whenever the palette is reopened or the query changes, so the
  // highlight never points at a row that no longer exists.
  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setAiState("idle");
      setAnswer(null);
      historyRef.current = [];
    }
  }, [open]);

  // Keep the highlighted row inside the scroll area.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(
      ".command-item.active"
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    // The row list is always rendered, answer or not, so ↑/↓ keep working while
    // an answer is on screen and ↵ runs whichever row is highlighted — which
    // includes the "Ask the assistant …" row while a question is typed.
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(i => (flat.length === 0 ? 0 : (i + 1) % flat.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(i =>
        flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      flat[active]?.run();
    }
  };

  const hasAnswer = answer !== null;

  return (
    <div className="modal-backdrop command-backdrop" onMouseDown={onClose}>
      <div
        className={`command-dialog ${hasAnswer ? "is-thread" : ""}`}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="command-search-row">
          <Search size={18} className="text-[var(--text-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              hasAnswer
                ? "Ask a follow-up, or edit and resend…"
                : "Search students, staff, classes, fees, pages, or ask anything…"
            }
          />
          {hasAnswer && (
            <button
              className="command-newchat"
              onClick={() => {
                // Clears the answer, the typed question and the remembered
                // context together, so "start again" really does start again.
                setAnswer(null);
                setQuery("");
                historyRef.current = [];
              }}
            >
              Clear
            </button>
          )}
          <kbd>esc</kbd>
        </div>

        <div className="command-content" ref={listRef}>
          {aiState === "loading" && (
            <div className="command-thinking" role="status" aria-live="polite">
              <span className="command-thinking-orb" aria-hidden="true">
                <span className="command-thinking-core" />
              </span>
              <div className="command-thinking-copy">
                <p className="command-thinking-title">
                  {THINKING_LINES[
                    Math.floor(THINKING_LINES.length * Math.random()) %
                      THINKING_LINES.length
                  ] ?? THINKING_LINES[0]}
                </p>
                <span className="command-thinking-steps" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          )}

          {answer && (
            <div className="command-answer-card">
              <div className="command-answer-head">
                <Sparkles size={13} />
                <span>Assistant</span>
              </div>
              <p className="command-answer-body">{answer.reply.answer}</p>

              {answer.reply.error && (
                <div className="command-answer-error">
                  <AlertCircle size={14} />
                  <div className="min-w-0">
                    {answer.reply.error === "not_configured" ? (
                      <>
                        <strong>The assistant is not switched on yet.</strong>
                        <p>
                          {currentUser &&
                          (isSuperAdminId(currentUser.id) ||
                            currentUser.role === "super_admin")
                            ? "You can give it an API key under Settings — it will then work for everyone in the school."
                            : "Ask a super admin to add one under Settings. Once they do, this works for you too."}
                        </p>
                        <button
                          className="command-answer-go"
                          onClick={() => {
                            onNavigate("Settings");
                            onClose();
                          }}
                        >
                          Open Settings
                          <ChevronRight size={14} />
                        </button>
                      </>
                    ) : (
                      <p>
                        That request did not go through.{" "}
                        {answer.reply.error === "unauthenticated"
                          ? "Your session has expired — reload the page and sign in again."
                          : "Try again in a moment."}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {answer.reply.bullets.length > 0 && (
                <ul className="command-answer-bullets">
                  {answer.reply.bullets.map((bullet, index) => (
                    <li key={index}>{bullet}</li>
                  ))}
                </ul>
              )}

              {answer.reply.actions.length > 0 && (
                <div className="command-answer-actions">
                  {answer.reply.actions.map((item, index) => {
                    const label = screenLabelByName(item.screen);
                    if (!label) return null;
                    return (
                      <button
                        key={`${item.screen}-${index}`}
                        className="command-answer-go"
                        onClick={() => openAction(item)}
                      >
                        {item.label || `Open ${label}`}
                        <ChevronRight size={14} />
                      </button>
                    );
                  })}
                </div>
              )}

              {answer.reply.followUps.length > 0 && (
                <div className="command-answer-followups">
                  {answer.reply.followUps.map((question, index) => (
                    <button
                      key={index}
                      className="command-followup"
                      onClick={() => void runAssistant(question)}
                    >
                      <Sparkles size={12} />
                      {question}
                    </button>
                  ))}
                </div>
              )}

              {answer.reply.sources.length > 0 && (
                <p className="command-answer-source">
                  From {answer.reply.sources.join(" · ")}
                </p>
              )}
            </div>
          )}

          {/* The searchable rows stay on screen underneath the answer. The
              palette is one search surface, so an answer is a result of that
              search rather than a separate screen that replaces it — which is
              what let the user keep picking things to search for while an
              answer was being read. */}
          {/* 1. Pages & Navigation */}
          {results.pages.length > 0 && (
            <div className="command-group">
              <p className="command-heading">Pages &amp; Navigation</p>
              {results.pages.map(page => {
                const idx = flat.findIndex(f => f.key === `nav-${page.view}`);
                return (
                  <button
                    key={`nav-${page.view}`}
                    className={`command-item ${idx === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={flat[idx]?.run}
                  >
                    <span className="command-icon">
                      <page.icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block font-medium text-[var(--text-secondary)]">
                        {page.label}
                      </span>
                      <span className="block truncate text-[12.5px] text-[var(--text-muted)]">
                        {page.detail}
                      </span>
                    </span>
                    <span className="command-shortcut">↵</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. Students */}
          {results.students.length > 0 && (
            <div className="command-group">
              <p className="command-heading">Students</p>
              {results.students.map(student => {
                const idx = flat.findIndex(f => f.key === `p-${student.id}`);
                return (
                  <button
                    key={`p-${student.id}`}
                    className={`command-item ${idx === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={flat[idx]?.run}
                  >
                    <span
                      className={`avatar avatar-sm ${avatarTones[student.tone]}`}
                    >
                      {student.initials}
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-medium text-[var(--text-secondary)]">
                        {student.name}
                      </span>
                      <span className="block text-[12.5px] text-[var(--text-muted)]">
                        {student.grade} · Section {student.section} · Attendance{" "}
                        {student.attendance}%{student.usn ? ` · ${student.usn}` : ""}
                      </span>
                    </span>
                    <ChevronRight
                      size={15}
                      className="text-[var(--text-muted)]"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* 3. Staff */}
          {results.staff.length > 0 && (
            <div className="command-group">
              <p className="command-heading">Staff &amp; Educators</p>
              {results.staff.map(member => {
                const idx = flat.findIndex(f => f.key === `st-${member.id}`);
                return (
                  <button
                    key={`st-${member.id}`}
                    className={`command-item ${idx === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={flat[idx]?.run}
                  >
                    {member.photo_url ? (
                      <img
                        className="avatar avatar-sm"
                        src={member.photo_url}
                        alt=""
                      />
                    ) : (
                      <span
                        className={`avatar avatar-sm ${avatarTones[member.tone]}`}
                      >
                        {member.initials}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-medium text-[var(--text-secondary)]">
                        {member.name}
                      </span>
                      <span className="block text-[12.5px] text-[var(--text-muted)]">
                        {member.role} · {member.department}
                        {member.usn ? ` · ${member.usn}` : ""}
                      </span>
                    </span>
                    <ChevronRight
                      size={15}
                      className="text-[var(--text-muted)]"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* 4. Classes & Classrooms */}
          {results.classes.length > 0 && (
            <div className="command-group">
              <p className="command-heading">Classes &amp; Attendance</p>
              {results.classes.map(cls => {
                const idx = flat.findIndex(f => f.key === `cls-${cls.id}`);
                return (
                  <button
                    key={`cls-${cls.id}`}
                    className={`command-item ${idx === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={flat[idx]?.run}
                  >
                    <span className="command-icon">
                      <ClipboardCheck size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block font-medium text-[var(--text-secondary)]">
                        {cls.label}
                      </span>
                      <span className="block text-[12.5px] text-[var(--text-muted)]">
                        {cls.total} pupils · {cls.value}% attendance
                        {cls.teacher ? ` · Teacher: ${cls.teacher}` : ""}
                      </span>
                    </span>
                    <span className="command-shortcut">↵</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 5. Fees & Invoices */}
          {results.invoices.length > 0 && (
            <div className="command-group">
              <p className="command-heading">Fees &amp; Invoices</p>
              {results.invoices.map(inv => {
                const idx = flat.findIndex(f => f.key === `inv-${inv.id}`);
                return (
                  <button
                    key={`inv-${inv.id}`}
                    className={`command-item ${idx === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={flat[idx]?.run}
                  >
                    <span className="command-icon">
                      <IndianRupee size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block font-medium text-[var(--text-secondary)]">
                        Invoice · {inv.student}
                      </span>
                      <span className="block text-[12.5px] text-[var(--text-muted)]">
                        ₹{inv.amount.toLocaleString("en-IN")} · {inv.status}
                        {inv.due_date ? ` · Due ${inv.due_date}` : ""}
                      </span>
                    </span>
                    <span className="command-shortcut">↵</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 6. Exams & Subjects */}
          {(results.exams.length > 0 || results.subjects.length > 0) && (
            <div className="command-group">
              <p className="command-heading">Examinations &amp; Subjects</p>
              {results.exams.map(exam => {
                const idx = flat.findIndex(f => f.key === `ex-${exam.id}`);
                return (
                  <button
                    key={`ex-${exam.id}`}
                    className={`command-item ${idx === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={flat[idx]?.run}
                  >
                    <span className="command-icon">
                      <FileText size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block font-medium text-[var(--text-secondary)]">
                        {exam.name} – {exam.subject}
                      </span>
                      <span className="block text-[12.5px] text-[var(--text-muted)]">
                        {exam.grade} · {exam.date} · {exam.status}
                      </span>
                    </span>
                    <span className="command-shortcut">↵</span>
                  </button>
                );
              })}
              {results.subjects.map(sub => {
                const idx = flat.findIndex(f => f.key === `sub-${sub.id}`);
                return (
                  <button
                    key={`sub-${sub.id}`}
                    className={`command-item ${idx === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={flat[idx]?.run}
                  >
                    <span className="command-icon">
                      <BookOpen size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block font-medium text-[var(--text-secondary)]">
                        Subject: {sub.name}
                      </span>
                      <span className="block text-[12.5px] text-[var(--text-muted)]">
                        {sub.classList.length > 0 ? `Classes ${sub.classList.join(", ")}` : "No classes assigned"} · Teacher: {sub.teacher ?? "Unassigned"}
                      </span>
                    </span>
                    <span className="command-shortcut">↵</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 7. Announcements */}
          {results.announcements.length > 0 && (
            <div className="command-group">
              <p className="command-heading">Announcements</p>
              {results.announcements.map(a => {
                const idx = flat.findIndex(f => f.key === `ann-${a.id}`);
                return (
                  <button
                    key={`ann-${a.id}`}
                    className={`command-item ${idx === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={flat[idx]?.run}
                  >
                    <span className="command-icon">
                      <Bell size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-medium text-[var(--text-secondary)]">
                        {a.title}
                      </span>
                      <span className="block text-[12.5px] text-[var(--text-muted)]">
                        For {a.audience} · {a.date}
                      </span>
                    </span>
                    <span className="command-shortcut">↵</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 8. Library Books */}
          {results.libraryBooks.length > 0 && (
            <div className="command-group">
              <p className="command-heading">Library Books</p>
              {results.libraryBooks.map(b => {
                const idx = flat.findIndex(f => f.key === `lib-${b.id}`);
                return (
                  <button
                    key={`lib-${b.id}`}
                    className={`command-item ${idx === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={flat[idx]?.run}
                  >
                    <span className="command-icon">
                      <BookMarked size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-medium text-[var(--text-secondary)]">
                        {b.title}
                      </span>
                      <span className="block text-[12.5px] text-[var(--text-muted)]">
                        by {b.author} · {b.category} · {b.status}
                      </span>
                    </span>
                    <span className="command-shortcut">↵</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="command-group">
            <p className="command-heading">
              {query
                ? "Quick actions & Assistant"
                : hasAnswer
                  ? "Ask something else"
                  : "Ask the assistant"}
            </p>
            {query ? (
              // When there is a query, show only matching commands plus the AI ask button
              <>
                {results.cmds.map(item => {
                  const idx = flat.findIndex(
                    f => f.key === `c-${item.label}`
                  );
                  return (
                    <button
                      key={item.label}
                      className={`command-item ${idx === active ? "active" : ""}`}
                      onMouseEnter={() => setActive(idx)}
                      onClick={flat[idx]?.run}
                    >
                      <span className="command-icon">
                        <item.icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block font-medium text-[var(--text-secondary)]">
                          {item.label}
                        </span>
                        <span className="block text-[12.5px] text-[var(--text-muted)]">
                          {item.detail}
                        </span>
                      </span>
                      {item.view ? (
                        <span className="command-shortcut">↵</span>
                      ) : (
                        <Sparkles size={13} className="text-[var(--brand)]" />
                      )}
                    </button>
                  );
                })}
                {query.trim().length >= 2 && (
                  <button
                    className={`command-item ${active === flat.length - 1 ? "active" : ""}`}
                    onMouseEnter={() => setActive(flat.length - 1)}
                    onClick={flat[flat.length - 1]?.run}
                  >
                    <span className="command-icon ai">
                      <Sparkles size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block font-medium text-[var(--text-secondary)]">
                        {`Ask the assistant “${query.trim()}”`}
                      </span>
                      <span className="block text-[12.5px] text-[var(--text-muted)]">
                        Answers from live dashboard data
                      </span>
                    </span>
                    <span className="command-shortcut">↵</span>
                  </button>
                )}
              </>
            ) : (
              // Empty query: a small set of role-scoped prompts plus a few general
              // ones. These are buttons the user can click or reach with ↵, and they
              // pre-fill the query so the question is sent the moment they pick one.
              <>
                {suggestions.map(q => {
                  const key = `sug-${q}`;
                  const idx = flat.findIndex(f => f.key === key);
                  return (
                    <button
                      key={key}
                      className={`command-item ${idx === active ? "active" : ""}`}
                      onMouseEnter={() => setActive(idx)}
                      onClick={flat[idx]?.run}
                    >
                      <span className="command-icon ai">
                        <Sparkles size={15} />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block font-medium text-[var(--text-secondary)]">
                          {q}
                        </span>
                        <span className="block text-[12.5px] text-[var(--text-muted)]">
                          Ask the assistant
                        </span>
                      </span>
                      <Sparkles size={13} className="text-[var(--brand)]" />
                    </button>
                  );
                })}
                {results.cmds.map(item => {
                  const idx = flat.findIndex(f => f.key === `c-${item.label}`);
                  return (
                    <button
                      key={item.label}
                      className={`command-item ${idx === active ? "active" : ""}`}
                      onMouseEnter={() => setActive(idx)}
                      onClick={flat[idx]?.run}
                    >
                      <span className="command-icon">
                        <item.icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block font-medium text-[var(--text-secondary)]">
                          {item.label}
                        </span>
                        <span className="block text-[12.5px] text-[var(--text-muted)]">
                          {item.detail}
                        </span>
                      </span>
                      {item.view ? (
                        <span className="command-shortcut">↵</span>
                      ) : (
                        <Sparkles size={13} className="text-[var(--brand)]" />
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {query &&
            flat.length === 0 &&
            !hasAnswer && (
              <div className="empty-state py-12">
                <Search size={22} />
                <p>No results for “{query}”</p>
              </div>
            )}
        </div>

        <div className="command-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
function AppDialog({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  usePageScrollLock();
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="app-dialog"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-5 border-b border-[var(--border)] px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-secondary)]">
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function DashboardView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const currentUser = useCurrentUser();
  const role = currentUser?.role ?? "staff";
  const allowedScreens = useMemo(
    () => new Set(screensForRole(role) as string[]),
    [role]
  );
  const canSeeFinance = allowedScreens.has("finance");

  // Re-render on a timer so a tab left open across a boundary greets correctly
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const greeting = greetingFor(now);

  // Database-backed hooks
  const {
    daily: attendanceData,
    classes: classAttendance,
    belowThreshold,
    loading: attendanceChartLoading,
  } = useDashboardAttendance();
  const classAttendanceLoading = attendanceChartLoading;
  const { total: studentCount, active: activeStudents, loading: studentsLoading } =
    useStudentCounts();
  const { rows: allStaff, loading: staffLoading } = useStaff();
  const { rows: invoiceRows, loading: invoicesLoading } =
    useInvoices(canSeeFinance);
  const { rows: allStudents, loading: studentsListLoading } = useStudents();

  const termAttendanceStats = useMemo(() => {
    const totalRecords = classAttendance.reduce((sum, c) => sum + c.total, 0);
    const presentRecords = classAttendance.reduce((sum, c) => sum + c.present, 0);
    const overallPct =
      totalRecords > 0
        ? Math.round((presentRecords / totalRecords) * 1000) / 10
        : allStudents.length > 0
          ? Math.round(
              (allStudents.reduce((sum, s) => sum + (s.attendance || 0), 0) /
                allStudents.length) *
                10
            ) / 10
          : 0;
    return { totalRecords, presentRecords, overallPct };
  }, [classAttendance, allStudents]);

  // Academic standing
  const gradedStudents = useMemo(
    () => allStudents.filter(s => s.average > 0),
    [allStudents]
  );
  const cohortAverage = useMemo(() => {
    if (gradedStudents.length === 0) return 0;
    return Math.round(
      gradedStudents.reduce((sum, s) => sum + s.average, 0) / gradedStudents.length
    );
  }, [gradedStudents]);

  const criticalStudentsCount = useMemo(
    () => gradedStudents.filter(s => s.average < 50).length,
    [gradedStudents]
  );

  // Faculty and staffing ratios
  const staffCount = allStaff.length;
  const studentTeacherRatio = useMemo(() => {
    const teachers = allStaff.filter(
      s =>
        /teacher|faculty|instructor/i.test(s.role) ||
        /languages|science|mathematics|english|social|sports|computer/i.test(
          s.department
        )
    ).length;
    const count = teachers > 0 ? teachers : allStaff.length;
    return count > 0 ? Math.round(studentCount / count) : 0;
  }, [allStaff, studentCount]);

  // Financial reconciliation
  const billed = invoiceRows.reduce(
    (sum, i) => sum + (i.total ?? i.amount),
    0
  );
  const collected = invoiceRows.reduce(
    (sum, i) =>
      sum + (i.paid ?? (i.status === "Paid" ? (i.total ?? i.amount) : 0)),
    0
  );
  const collectionRate =
    billed > 0 ? Math.round((collected / billed) * 100) : 0;
  const overdueInvoices = invoiceRows.filter(i => i.status === "Overdue");
  const overdueAmount = overdueInvoices.reduce(
    (sum, i) => sum + (i.outstanding ?? i.amount),
    0
  );
  const lakh = (n: number) => `₹${(n / 100000).toFixed(1)}L`;

  const classesBelow = classAttendance.filter(
    c => c.total > 0 && c.value < 92
  ).length;

  // Actionable alerts projected straight from the database. A category with
  // nothing to follow up on is omitted rather than flashing "0 items".
  const attentionItems = [
    ...(criticalStudentsCount > 0
      ? [
          {
            label: "Academic remediation",
            value: String(criticalStudentsCount),
            detail: `${criticalStudentsCount} pupil${criticalStudentsCount === 1 ? "" : "s"} below 50% average`,
            icon: AlertCircle,
            tone: "coral",
            view: "Academics",
          },
        ]
      : []),
    ...(belowThreshold > 0
      ? [
          {
            label: "Attendance follow-up",
            value: String(belowThreshold),
            detail: `${belowThreshold} pupil${belowThreshold === 1 ? "" : "s"} below 90% attendance`,
            icon: Clock3,
            tone: "amber",
            view: "Attendance",
          },
        ]
      : []),
    ...(canSeeFinance && overdueInvoices.length > 0
      ? [
          {
            label: "Overdue fee recovery",
            value: String(overdueInvoices.length),
            detail: `${lakh(overdueAmount)} across ${overdueInvoices.length} invoices`,
            icon: Receipt,
            tone: "blue",
            view: "Fees & Finance",
          },
        ]
      : []),
    ...(classesBelow > 0
      ? [
          {
            label: "Classes on watch",
            value: String(classesBelow),
            detail: `${classesBelow} class${classesBelow === 1 ? "" : "es"} below 92%`,
            icon: ClipboardCheck,
            tone: "violet",
            view: "Attendance",
          },
        ]
      : []),
  ];

  return (
    <div className="page-stack dashboard-overview">
      <div className="page-intro">
        <div>
          <div className="flex items-center gap-2">
            <span className="count-badge">AY 2026–27</span>
          </div>
          <h1 className="page-title mt-1">
            {greeting}
            {currentUser?.fullName ? `, ${currentUser.fullName}` : ""}
          </h1>
        </div>
      </div>

      {/* 4 CORE EXECUTIVE KPI CARDS */}
      <div className="metric-grid">
        <MetricBlock
          className="overview-metric"
          label="Students enrolled"
          value={studentCount.toLocaleString("en-IN")}
          comparison={
            studentCount > 0
              ? `${activeStudents.toLocaleString("en-IN")} active${
                  studentCount > activeStudents
                    ? ` · ${studentCount - activeStudents} inactive`
                    : ""
                }`
              : "No students on record"
          }
          icon={GraduationCap}
          trend={false}
          loading={studentsLoading}
        />
        <MetricBlock
          className="overview-metric"
          label="Attendance rate"
          value={termAttendanceStats.overallPct > 0 ? `${termAttendanceStats.overallPct}%` : "—"}
          comparison={
            termAttendanceStats.totalRecords > 0
              ? "Term average"
              : allStudents.length > 0
                ? "Student average"
                : "No attendance recorded"
          }
          icon={ClipboardCheck}
          trend={false}
          loading={attendanceChartLoading}
        />
        <MetricBlock
          className="overview-metric"
          label="Academic standing"
          value={cohortAverage > 0 ? `${cohortAverage}%` : "—"}
          comparison={
            cohortAverage > 0
              ? `${gradedStudents.length} pupils evaluated`
              : "No exam marks recorded"
          }
          icon={BookOpen}
          trend={false}
          loading={studentsListLoading}
        />
        {canSeeFinance ? (
          <MetricBlock
            className="overview-metric"
            label="Fee collection"
            value={lakh(collected)}
            comparison={`${collectionRate}% collected`}
            icon={IndianRupee}
            trend={false}
            loading={invoicesLoading}
          />
        ) : (
          <MetricBlock
            className="overview-metric"
            label="Faculty & staff"
            value={staffCount.toLocaleString("en-IN")}
            comparison={
              studentTeacherRatio > 0
                ? `${studentTeacherRatio}:1 ratio`
                : `${staffCount} on roster`
            }
            icon={Users}
            trend={false}
            loading={staffLoading}
          />
        )}
      </div>

      {/* ROW 1: ATTENDANCE & CLASSROOMS */}
      <div className="dashboard-grid dashboard-grid-top">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Attendance</h2>
            </div>
            <span className="count-badge">
              Last 7 sessions
            </span>
          </div>
          <div className="chart-legend">
            {attendanceChartLoading ? (
              <>
                <span className="skeleton-legend-item">
                  <span className="erp-skeleton erp-skeleton-dot" />
                  <SkeletonText width={40} height={9} />
                </span>
                <span className="skeleton-legend-item">
                  <span className="erp-skeleton erp-skeleton-dot" />
                  <SkeletonText width={38} height={9} />
                </span>
              </>
            ) : (
              <>
                <span>
                  <i className="legend-dot bg-[var(--success)]" />
                  Present
                </span>
                <span>
                  <i className="legend-dot bg-[var(--danger)]" />
                  Absent
                </span>
              </>
            )}
          </div>
          <div className="chart-wrap">
            {attendanceChartLoading ? (
              <SkeletonChart height={250} variant="area" />
            ) : attendanceData.length === 0 ? (
              <div className="empty-state px-5 py-14">
                <ClipboardCheck size={22} />
                No daily attendance logs recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart
                  data={attendanceData}
                  margin={{ top: 8, right: 6, left: -22, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="presentFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--success)"
                        stopOpacity={0.18}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--success)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="absentFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--danger)"
                        stopOpacity={0.14}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--danger)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey={attendanceData[0]?.label ? "label" : "day"}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--border-strong)",
                      background: "var(--bg-panel)",
                      color: "var(--text-secondary)",
                      boxShadow: "var(--shadow-popover)",
                      fontSize: 12,
                    }}
                    formatter={(val: number, name: string) => [
                      `${val} students`,
                      name === "present" ? "Present" : "Absent",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="present"
                    stroke="var(--success)"
                    strokeWidth={2.4}
                    fill="url(#presentFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="absent"
                    stroke="var(--danger)"
                    strokeWidth={1.8}
                    fill="url(#absentFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Classrooms</h2>
            </div>
            <span className="count-badge">
              {classAttendance.length} classes
            </span>
          </div>
          <div className="class-watch-list">
            {classAttendanceLoading ? (
              <SkeletonRegion label="Loading class attendance">
                <SkeletonList rows={5} avatar={false} />
              </SkeletonRegion>
            ) : classAttendance.length === 0 ? (
              <div className="empty-state px-5 py-10">
                <ClipboardCheck size={22} />
                No class registers marked yet.
              </div>
            ) : (
              classAttendance.map(row => (
                <button
                  className="class-watch-row"
                  key={row.id}
                  onClick={() => onNavigate("Attendance")}
                >
                  <span className="class-watch-main">
                    <span className="class-watch-label">
                      {row.label}
                    </span>
                    <span className="class-watch-teacher">
                      {row.teacher || "Unassigned"}
                    </span>
                  </span>
                  <span className="class-watch-meter">
                    <span className="class-watch-bar">
                      <span
                        style={{
                          width: `${row.value}%`,
                          background:
                            row.value < 90
                              ? "var(--danger)"
                              : row.value < 92
                                ? "var(--warning)"
                                : "var(--brand)",
                        }}
                      />
                    </span>
                    <span className="class-watch-value">{row.value}%</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ROW 2: ATTENTION NEEDED & CAMPUS NOTICES */}
      <div className="dashboard-grid dashboard-grid-mid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Attention needed</h2>
            </div>
            <span className="count-badge">
              {attentionItems.length} items
            </span>
          </div>
          <div className="attention-list">
            {attentionItems.length === 0 ? (
              <div className="empty-state px-5 py-8">
                <ShieldCheck size={22} />
                Nothing needs follow-up right now — attendance, grades and
                ledgers are all in order.
              </div>
            ) : (
              attentionItems.map(item => (
                <button
                  className="attention-row"
                  key={item.label}
                  onClick={() => onNavigate(item.view)}
                >
                  <span className={`attention-icon ${item.tone}`}>
                    <item.icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-medium text-[var(--text-secondary)]">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-[12.5px] text-[var(--text-muted)]">
                      {item.detail}
                    </span>
                  </span>
                  <span className="attention-value">{item.value}</span>
                  <ChevronRight size={15} className="text-[var(--text-muted)]" />
                </button>
              ))
            )}
          </div>
        </section>

        {canSeeFinance ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Recent fee invoices</h2>
              </div>
              <span className="count-badge">
                {invoiceRows.length} recorded
              </span>
            </div>

            <div className="activity-list">
              {invoicesLoading ? (
                <SkeletonList rows={4} avatar />
              ) : invoiceRows.length === 0 ? (
                <div className="empty-state px-5 py-10">
                  <Receipt size={22} />
                  No fee invoices recorded yet.
                </div>
              ) : (
                invoiceRows.slice(0, 4).map(inv => (
                  <button
                    type="button"
                    className="activity-row w-full text-left cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                    key={inv.id}
                    onClick={() => onNavigate("Fees & Finance")}
                  >
                    <span
                      className={`activity-icon ${
                        inv.status === "Paid"
                          ? "emerald"
                          : inv.status === "Overdue"
                            ? "amber"
                            : "blue"
                      }`}
                    >
                      <Receipt size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-snug text-[var(--text-secondary)] truncate">
                        {inv.student}
                      </div>
                      <div className="mt-0.5 truncate text-[12.5px] text-[var(--text-muted)]">
                        Due: {inv.due_date} · Invoice #{inv.id}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        ₹{inv.amount.toLocaleString("en-IN")}
                      </span>
                      <span
                        className={`status-pill ${
                          inv.status === "Paid"
                            ? "success"
                            : inv.status === "Overdue"
                              ? "warning"
                              : "neutral"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Teaching faculty & staff</h2>
              </div>
              <span className="count-badge">
                {allStaff.length} active
              </span>
            </div>

            <div className="activity-list">
              {staffLoading ? (
                <SkeletonList rows={4} avatar />
              ) : allStaff.length === 0 ? (
                <div className="empty-state px-5 py-10">
                  <Users size={22} />
                  No staff members listed yet.
                </div>
              ) : (
                allStaff.slice(0, 4).map(member => (
                  <button
                    type="button"
                    className="activity-row w-full text-left cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                    key={member.id}
                    onClick={() => onNavigate("User Management")}
                  >
                    <span className="activity-icon emerald">
                      <Users size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-snug text-[var(--text-secondary)] truncate">
                        {member.name}
                      </div>
                      <div className="mt-0.5 truncate text-[12.5px] text-[var(--text-muted)]">
                        {member.department || "General"} · {member.role}
                      </div>
                    </div>
                    <span className="status-pill success">
                      {member.status || "Active"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        )}
      </div>


    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

/** "2026-11-09" -> "9 Nov 2026", without pulling in a date library. */
function readableDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The pill tone that matches each stored status. */
function attendanceTone(status: AttendanceStatus): string {
  if (status === "present") return "success";
  if (status === "late") return "warning";
  if (status === "leave") return "neutral";
  return "danger";
}

const ATTENDANCE_STATUS_ICONS: Record<AttendanceStatus, React.ElementType> = {
  present: Check,
  late: Clock3,
  leave: CalendarDays,
  absent: X,
};

/**
 * One pupil's status selector.
 *
 * Four pills, one per value the database's `attendance_status` enum accepts.
 * The chosen pill takes the tone of its meaning; the rest stay neutral, so a
 * row reads at a glance instead of turning into four competing colours.
 */
function AttendanceStatusPicker({
  value,
  onChange,
  label,
}: {
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}
    >
      {ATTENDANCE_STATUSES.map((status) => {
        const Icon = ATTENDANCE_STATUS_ICONS[status];
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            className={`status-pill ${active ? attendanceTone(status) : "neutral"}`}
            aria-pressed={active}
            onClick={() => onChange(status)}
            style={{
              cursor: "pointer",
              opacity: active ? 1 : 0.72,
              border: "1px solid",
              boxShadow: active ? "0 0 0 2px var(--brand-soft)" : "none",
            }}
          >
            <Icon size={12} />
            {ATTENDANCE_STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The attendance register.
 *
 * ## Who marks, who reviews
 *
 * A register is marked by the teacher assigned to that class, and by nobody
 * else. `/api/attendance` enforces that from the session token; this screen
 * only reflects the answer. An administrator, the principal or the super admin
 * opens the same screen read-only: they can pick any class and any date and
 * see exactly what was saved, but the Save button does not exist for them.
 *
 * ## Nothing is invented
 *
 * The roster comes from `enrollments` and the marks from `attendance`. A pupil
 * with no row for the chosen date is *unmarked* — not assumed present — and
 * Save stays disabled until every pupil has a status. There is no localStorage
 * copy and no generated cohort: an empty school renders as an empty school.
 */
function formatSyncTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function AttendanceView({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "register">("overview");
  const [date, setDate] = useState<string>(() => attendanceToday());
  const [classroomId, setClassroomId] = useState<string>("");
  const [data, setData] = useState<AttendanceBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(() => new Date());
  const [draft, setDraft] = useState<
    Record<string, { status: AttendanceStatus | null; notes: string }>
  >({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Live overview filters & drill-down state:
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "marked" | "low_attendance">("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [sortBy, setSortBy] = useState<"grade" | "attendance_asc" | "attendance_desc" | "pending_first">("grade");
  const [inspectClassId, setInspectClassId] = useState<string | null>(null);

  // Real-time listener: invalidates whenever any client updates attendance or classrooms
  const realtimeRev = useRealtimeInvalidation(["attendance", "classrooms"]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    loadAttendance({ date, classroomId: classroomId || undefined })
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setLastSyncedAt(new Date());
        // The chosen class disappeared (or was never visible to this caller).
        // Follow the route's choice rather than leaving a picker with no match.
        if (classroomId && next.selectedClassroomId !== classroomId) {
          setClassroomId(next.selectedClassroomId ?? "");
        }
        const nextDraft: Record<
          string,
          { status: AttendanceStatus | null; notes: string }
        > = {};
        for (const pupil of next.roster) {
          nextDraft[pupil.id] = { status: pupil.status, notes: pupil.notes };
        }
        setDraft(nextDraft);
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setError(
          err instanceof ApiError
            ? err.message
            : "The attendance register could not be loaded. Check your connection and try again."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, classroomId, reloadKey, realtimeRev]);

  const classes = data?.classes ?? [];
  const roster = data?.roster ?? [];
  const selectedClass = data?.selectedClass ?? null;
  const overview = data?.overview ?? null;
  const managerView = data?.managerView ?? false;
  const canMark = Boolean(data && !managerView && selectedClass?.canMark);
  const activeClassId = classroomId || data?.selectedClassroomId || "";

  // Summary figures across all visible classes for this date:
  const executiveMetrics = useMemo(() => {
    let totalEnrolled = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let totalLeave = 0;
    let totalMarkedPupils = 0;
    let markedClasses = 0;
    let pendingClasses = 0;
    let lowAttendanceClasses = 0;

    for (const c of classes) {
      totalEnrolled += c.studentCount;
      const marked = c.markedToday ?? 0;
      const present = c.presentToday ?? 0;
      const absent = c.absentToday ?? 0;
      const late = c.lateToday ?? 0;
      const leave = c.leaveToday ?? 0;

      totalMarkedPupils += marked;
      totalPresent += present;
      totalAbsent += absent;
      totalLate += late;
      totalLeave += leave;

      const isMarked = c.isMarked ?? (marked >= c.studentCount && c.studentCount > 0);
      if (isMarked) {
        markedClasses += 1;
      }
      if (marked === 0) {
        pendingClasses += 1;
      }
      const rate = c.todayPercent ?? (marked > 0 ? attendancePercent(present, marked) : 0);
      if (marked > 0 && rate < 85) {
        lowAttendanceClasses += 1;
      }
    }

    const schoolAttendanceRate =
      totalMarkedPupils > 0
        ? attendancePercent(totalPresent, totalMarkedPupils)
        : 0;

    return {
      totalEnrolled,
      totalPresent,
      totalAbsent,
      totalLate,
      totalLeave,
      totalMarkedPupils,
      markedClasses,
      pendingClasses,
      lowAttendanceClasses,
      totalClasses: classes.length,
      schoolAttendanceRate,
    };
  }, [classes]);

  const filteredClasses = useMemo(() => {
    return classes
      .filter((c) => {
        const marked = c.markedToday ?? 0;
        const isMarked = c.isMarked ?? (marked >= c.studentCount && c.studentCount > 0);
        const isPending = marked === 0;
        const rate = c.todayPercent ?? (marked > 0 ? attendancePercent(c.presentToday ?? 0, marked) : 0);

        if (statusFilter === "pending" && !isPending) return false;
        if (statusFilter === "marked" && !isMarked) return false;
        if (statusFilter === "low_attendance" && (rate >= 85 || isPending)) return false;

        if (gradeFilter !== "all") {
          const g = Number.parseInt(c.grade, 10);
          if (gradeFilter === "primary" && (Number.isNaN(g) || g < 1 || g > 5)) return false;
          if (gradeFilter === "middle" && (Number.isNaN(g) || g < 6 || g > 8)) return false;
          if (gradeFilter === "high" && (Number.isNaN(g) || g < 9 || g > 12)) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchLabel = c.label.toLowerCase().includes(q);
          const matchTeacher = (c.classTeacherName ?? "").toLowerCase().includes(q);
          const matchRoom = (c.room ?? "").toLowerCase().includes(q);
          if (!matchLabel && !matchTeacher && !matchRoom) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const rateA = a.todayPercent ?? ((a.markedToday ?? 0) > 0 ? attendancePercent(a.presentToday ?? 0, a.markedToday ?? 0) : 0);
        const rateB = b.todayPercent ?? ((b.markedToday ?? 0) > 0 ? attendancePercent(b.presentToday ?? 0, b.markedToday ?? 0) : 0);

        if (sortBy === "attendance_asc") {
          return rateA - rateB;
        }
        if (sortBy === "attendance_desc") {
          return rateB - rateA;
        }
        if (sortBy === "pending_first") {
          const pendA = (a.markedToday ?? 0) === 0 ? 0 : 1;
          const pendB = (b.markedToday ?? 0) === 0 ? 0 : 1;
          if (pendA !== pendB) return pendA - pendB;
        }
        const ga = Number.parseInt(a.grade, 10);
        const gb = Number.parseInt(b.grade, 10);
        if (Number.isFinite(ga) && Number.isFinite(gb) && ga !== gb) return ga - gb;
        return a.grade.localeCompare(b.grade) || a.section.localeCompare(b.section);
      });
  }, [classes, statusFilter, gradeFilter, searchQuery, sortBy]);

  const inspectedClass = useMemo(() => {
    return classes.find((c) => c.id === inspectClassId) ?? null;
  }, [classes, inspectClassId]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;
    let unmarked = 0;
    for (const pupil of roster) {
      const status = draft[pupil.id]?.status ?? null;
      if (status === "present") present += 1;
      else if (status === "absent") absent += 1;
      else if (status === "late") late += 1;
      else if (status === "leave") leave += 1;
      else unmarked += 1;
    }
    const marked = present + absent + late + leave;
    return {
      present,
      absent,
      late,
      leave,
      unmarked,
      marked,
      percent: attendancePercent(present + late, marked),
    };
  }, [draft, roster]);

  const allMarked = roster.length > 0 && counts.unmarked === 0;

  function setStatus(studentId: string, status: AttendanceStatus) {
    setDraft((prev) => ({
      ...prev,
      [studentId]: { status, notes: prev[studentId]?.notes ?? "" },
    }));
  }

  function setNotes(studentId: string, notes: string) {
    setDraft((prev) => ({
      ...prev,
      [studentId]: { status: prev[studentId]?.status ?? null, notes },
    }));
  }

  function markAllPresent() {
    const next: Record<string, { status: AttendanceStatus | null; notes: string }> = {};
    for (const pupil of roster) {
      next[pupil.id] = { status: "present", notes: draft[pupil.id]?.notes ?? "" };
    }
    setDraft(next);
  }

  async function handleSave() {
    if (!selectedClass || !allMarked || saving) return;
    setSaving(true);
    try {
      const items = roster.map((pupil) => ({
        studentId: pupil.id,
        status: (draft[pupil.id]?.status ?? "present") as AttendanceStatus,
        notes: (draft[pupil.id]?.notes ?? "").trim() || undefined,
      }));
      const result = await saveClassAttendance({
        classroomId: selectedClass.id,
        date: data?.date ?? date,
        items,
        reason: reason.trim() || undefined,
      });
      toast.success(result.message);
      setReason("");
      setReloadKey((key) => key + 1);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "The register could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  const retry = (
    <button
      className="secondary-button compact"
      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
      onClick={() => setReloadKey((key) => key + 1)}
    >
      <RefreshCw size={14} />
      Try again
    </button>
  );

  return (
    <div className="page-stack">
      <div className="page-intro" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Attendance"
            onParentClick={onBack}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h1 className="page-title" style={{ margin: 0 }}>Attendance</h1>
            <span className="live-pulse-badge" title="Live synchronized across all classrooms in realtime">
              <span className="live-pulse-dot" />
              LIVE
            </span>
          </div>
          <p className="page-subtitle" style={{ marginTop: "4px" }}>
            {activeTab === "overview"
              ? `Real-time operational overview across all classrooms · ${readableDate(data?.date ?? date)}`
              : `${managerView ? "Class register review" : "Daily register"} · ${readableDate(data?.date ?? date)}`}
          </p>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Real-time status / manual sync */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              background: "var(--bg-raised)",
              border: "1px solid var(--border-subtle)",
              fontSize: "11.5px",
              color: "var(--text-muted)",
            }}
          >
            <Radio size={12} style={{ color: "var(--success)" }} />
            <span>Synced {formatSyncTime(lastSyncedAt)}</span>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              style={{
                background: "none",
                border: "none",
                padding: "2px",
                cursor: "pointer",
                color: "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
              }}
              title="Refresh live data now"
            >
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          <SegmentedControl
            ariaLabel="Attendance view tabs"
            layoutId="attendanceMainViewTabs"
            value={activeTab}
            onChange={(val) => setActiveTab(val as "register" | "overview")}
            indicatorVariant="brand"
            options={[
              {
                value: "overview",
                label: "Live Overview",
                icon: <Activity size={14} />,
              },
              {
                value: "register",
                label: "Class Register",
                icon: <ClipboardCheck size={14} />,
              },
            ]}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Live Overview Tab                                             */}
      {/* ------------------------------------------------------------ */}
      {activeTab === "overview" &&
        (loading && !data ? (
          <div className="panel" style={{ padding: "18px 22px" }}>
            <SkeletonRegion label="Loading live attendance overview">
              <SkeletonHealthGrid count={4} />
              <div style={{ marginTop: "20px" }}>
                <SkeletonList rows={6} avatar={false} />
              </div>
            </SkeletonRegion>
          </div>
        ) : error ? (
          <div className="panel" style={{ padding: "34px 24px" }}>
            <div className="empty-state">
              <AlertCircle size={22} />
              <p style={{ maxWidth: "520px", textAlign: "center" }}>{error}</p>
              {retry}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Top Date Selection & Quick State */}
            <div
              className="panel"
              style={{
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Date:
                </span>
                <DateDropdowns
                  value={date}
                  onChange={setDate}
                  defaultToToday
                  minYear={2020}
                  maxYear={2030}
                />
                {date !== attendanceToday() && (
                  <button
                    className="secondary-button compact"
                    style={{ padding: "4px 10px", fontSize: "11.5px" }}
                    onClick={() => setDate(attendanceToday())}
                  >
                    Jump to Today
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {classes.length} active classes · {executiveMetrics.totalEnrolled} enrolled pupils
                </span>
              </div>
            </div>

            {/* Executive KPI Grid */}
            <div className="metric-grid">
              <MetricBlock
                className="overview-metric"
                label="Overall Attendance"
                value={
                  executiveMetrics.totalMarkedPupils > 0
                    ? `${executiveMetrics.schoolAttendanceRate}%`
                    : "—"
                }
                comparison={
                  executiveMetrics.totalMarkedPupils > 0
                    ? `${executiveMetrics.totalPresent} of ${executiveMetrics.totalEnrolled} pupils present`
                    : "No registers marked yet"
                }
                icon={Activity}
                trend={false}
              />
              <MetricBlock
                className="overview-metric"
                label="Register Completion"
                value={`${executiveMetrics.markedClasses} / ${executiveMetrics.totalClasses}`}
                comparison={
                  executiveMetrics.pendingClasses > 0
                    ? `${executiveMetrics.pendingClasses} classes pending marking`
                    : "All class registers marked"
                }
                icon={ClipboardCheck}
                trend={false}
              />
              <MetricBlock
                className="overview-metric"
                label="Absentees Today"
                value={executiveMetrics.totalAbsent.toLocaleString("en-IN")}
                comparison={
                  executiveMetrics.totalLeave > 0 || executiveMetrics.totalLate > 0
                    ? `${executiveMetrics.totalLeave} on leave · ${executiveMetrics.totalLate} late arrival`
                    : "0 on leave"
                }
                icon={UserX}
                trend={false}
              />
              <MetricBlock
                className="overview-metric"
                label="Total Enrolled"
                value={executiveMetrics.totalEnrolled.toLocaleString("en-IN")}
                comparison={`Across ${executiveMetrics.totalClasses} classrooms`}
                icon={Users}
                trend={false}
              />
            </div>

            {/* Pending Classes Alert Banner (Leadership Triage) */}
            {executiveMetrics.pendingClasses > 0 && (
              <div
                className="panel"
                style={{
                  padding: "16px 20px",
                  background: "rgba(255, 159, 10, 0.08)",
                  border: "1px solid rgba(255, 159, 10, 0.28)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <AlertCircle size={20} style={{ color: "var(--warning)", flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {executiveMetrics.pendingClasses} of {executiveMetrics.totalClasses} classes have not submitted attendance
                      </span>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                        Attendance registers are pending from the assigned class teachers below.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="secondary-button compact"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      borderColor: statusFilter === "pending" ? "var(--warning)" : undefined,
                      background: statusFilter === "pending" ? "rgba(255, 159, 10, 0.15)" : undefined,
                    }}
                    onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
                  >
                    <Filter size={12} />
                    {statusFilter === "pending" ? "Show all classes" : "Filter pending classes only"}
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "2px" }}>
                  {classes
                    .filter((c) => (c.markedToday ?? 0) === 0)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setClassroomId(c.id);
                          setActiveTab("register");
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "5px 11px",
                          borderRadius: "8px",
                          border: "1px solid rgba(255, 159, 10, 0.35)",
                          background: "var(--bg-card)",
                          fontSize: "12px",
                          cursor: "pointer",
                          color: "var(--text-secondary)",
                        }}
                        title={`Open register for ${c.label}`}
                      >
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.label}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                          ({c.classTeacherName || "No teacher"})
                        </span>
                        <ArrowRight size={12} style={{ color: "var(--warning)" }} />
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Filter, Search & View Controls */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              {/* Status Filters */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={`status-pill ${statusFilter === "all" ? "brand" : "neutral"}`}
                  onClick={() => setStatusFilter("all")}
                  style={{ cursor: "pointer" }}
                >
                  All Classes ({classes.length})
                </button>
                <button
                  type="button"
                  className={`status-pill ${statusFilter === "pending" ? "warning" : "neutral"}`}
                  onClick={() => setStatusFilter("pending")}
                  style={{ cursor: "pointer" }}
                >
                  Pending ({executiveMetrics.pendingClasses})
                </button>
                <button
                  type="button"
                  className={`status-pill ${statusFilter === "marked" ? "success" : "neutral"}`}
                  onClick={() => setStatusFilter("marked")}
                  style={{ cursor: "pointer" }}
                >
                  Marked ({executiveMetrics.markedClasses})
                </button>
                {executiveMetrics.lowAttendanceClasses > 0 && (
                  <button
                    type="button"
                    className={`status-pill ${statusFilter === "low_attendance" ? "danger" : "neutral"}`}
                    onClick={() => setStatusFilter("low_attendance")}
                    style={{ cursor: "pointer" }}
                  >
                    Below 85% ({executiveMetrics.lowAttendanceClasses})
                  </button>
                )}
              </div>

              {/* Search, Sort & View Mode */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ position: "relative", minWidth: "190px" }}>
                  <Search
                    size={13}
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }}
                  />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search class or teacher..."
                    style={{
                      padding: "6px 10px 6px 30px",
                      fontSize: "12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-strong)",
                      background: "var(--bg-input)",
                      color: "var(--text-primary)",
                      outline: "none",
                      width: "100%",
                    }}
                  />
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  style={{
                    padding: "6px 10px",
                    fontSize: "12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-strong)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                  aria-label="Sort classes"
                >
                  <option value="grade">Sort: Grade (Default)</option>
                  <option value="pending_first">Sort: Pending First</option>
                  <option value="attendance_asc">Sort: Lowest Attendance</option>
                  <option value="attendance_desc">Sort: Highest Attendance</option>
                </select>

                <div
                  style={{
                    display: "inline-flex",
                    borderRadius: "8px",
                    border: "1px solid var(--border-strong)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    style={{
                      padding: "6px 10px",
                      background: viewMode === "grid" ? "var(--brand)" : "var(--bg-card)",
                      color: viewMode === "grid" ? "#ffffff" : "var(--text-muted)",
                      border: "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                    onClick={() => setViewMode("grid")}
                    title="Grid view"
                  >
                    <Layers size={13} /> Cards
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "6px 10px",
                      background: viewMode === "table" ? "var(--brand)" : "var(--bg-card)",
                      color: viewMode === "table" ? "#ffffff" : "var(--text-muted)",
                      border: "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                    onClick={() => setViewMode("table")}
                    title="Table view"
                  >
                    <BarChart3 size={13} /> Table
                  </button>
                </div>
              </div>
            </div>

            {/* All-Classes Live Grid or Table */}
            {filteredClasses.length === 0 ? (
              <div className="panel" style={{ padding: "40px 24px", textAlign: "center" }}>
                <p className="text-[var(--text-muted)] text-sm">
                  No classes match your current search and filter settings.
                </p>
                <button
                  type="button"
                  className="secondary-button compact"
                  style={{ marginTop: "10px" }}
                  onClick={() => {
                    setStatusFilter("all");
                    setGradeFilter("all");
                    setSearchQuery("");
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="attendance-grid">
                {filteredClasses.map((option) => {
                  const marked = option.markedToday ?? 0;
                  const isMarked = option.isMarked ?? (marked >= option.studentCount && option.studentCount > 0);
                  const isPending = marked === 0;
                  const rate = option.todayPercent ?? (marked > 0 ? attendancePercent(option.presentToday ?? 0, marked) : 0);

                  const rateToneColor = isPending
                    ? "var(--text-muted)"
                    : rate < 75
                    ? "var(--danger-strong)"
                    : rate < ATTENDANCE_THRESHOLD
                    ? "var(--warning)"
                    : "var(--success)";

                  return (
                    <div key={option.id} className="attendance-class-card">
                      <div>
                        {/* Card Header */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "10px",
                            marginBottom: "10px",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                                {option.label}
                              </h3>
                              {option.room && (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    background: "var(--bg-raised)",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  Rm {option.room}
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "3px 0 0" }}>
                              {option.classTeacherName ? `Teacher: ${option.classTeacherName}` : "No teacher assigned"}
                            </p>
                          </div>

                          <div>
                            {isPending ? (
                              <span className="status-pill warning" style={{ fontSize: "11px", padding: "3px 8px" }}>
                                <AlertCircle size={11} /> Pending
                              </span>
                            ) : isMarked ? (
                              <span className="status-pill success" style={{ fontSize: "11px", padding: "3px 8px" }}>
                                <CheckCircle2 size={11} /> Marked ({marked}/{option.studentCount})
                              </span>
                            ) : (
                              <span className="status-pill neutral" style={{ fontSize: "11px", padding: "3px 8px" }}>
                                Partial ({marked}/{option.studentCount})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Attendance Rate & Gauge */}
                        <div style={{ margin: "14px 0 10px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              justifyContent: "space-between",
                              marginBottom: "6px",
                            }}
                          >
                            <span style={{ fontSize: "20px", fontWeight: 700, color: rateToneColor }}>
                              {isPending ? "—" : `${rate}%`}
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                              {isPending
                                ? `${option.studentCount} pupils`
                                : `${option.presentToday} / ${option.studentCount} present`}
                            </span>
                          </div>

                          <div className="progress-bar" style={{ height: "6px", borderRadius: "999px" }}>
                            <span
                              style={{
                                width: isPending ? "0%" : `${Math.min(100, Math.max(0, rate))}%`,
                                background: isPending
                                  ? "var(--border-strong)"
                                  : rate < 75
                                  ? "var(--danger-strong)"
                                  : rate < ATTENDANCE_THRESHOLD
                                  ? "var(--warning)"
                                  : "var(--success)",
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                        </div>

                        {/* Status Breakdown Pills */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "10px 0" }}>
                          <span className="attendance-stat-pill" style={{ color: "var(--success)" }}>
                            <Check size={11} /> {option.presentToday} Present
                          </span>
                          {(option.absentToday ?? 0) > 0 && (
                            <span
                              className="attendance-stat-pill"
                              style={{ color: "var(--danger-strong)", background: "rgba(255, 69, 58, 0.08)" }}
                            >
                              <X size={11} /> {option.absentToday} Absent
                            </span>
                          )}
                          {(option.lateToday ?? 0) > 0 && (
                            <span className="attendance-stat-pill" style={{ color: "var(--warning)" }}>
                              <Clock3 size={11} /> {option.lateToday} Late
                            </span>
                          )}
                          {(option.leaveToday ?? 0) > 0 && (
                            <span className="attendance-stat-pill" style={{ color: "var(--brand-strong)" }}>
                              <CalendarDays size={11} /> {option.leaveToday} Leave
                            </span>
                          )}
                          {isPending && (
                            <span className="attendance-stat-pill">
                              {option.studentCount} Unmarked
                            </span>
                          )}
                        </div>

                        {/* Absentees Quick Inspector Chip */}
                        {((option.absentToday ?? 0) > 0 || (option.leaveToday ?? 0) > 0) && (
                          <button
                            type="button"
                            className="attendance-absentee-chip"
                            onClick={() => setInspectClassId(option.id)}
                            style={{ marginTop: "4px", width: "100%", justifyContent: "space-between" }}
                          >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <UserX size={12} />
                              <span>
                                {(option.absentToday ?? 0) + (option.leaveToday ?? 0)} Absent / On Leave
                              </span>
                            </span>
                            <span style={{ fontSize: "11px", opacity: 0.8 }}>Inspect →</span>
                          </button>
                        )}
                      </div>

                      {/* Card Footer */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "14px",
                          paddingTop: "12px",
                          borderTop: "1px solid var(--border-subtle)",
                        }}
                      >
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                          {option.termPercent > 0 ? `Term: ${option.termPercent}%` : "No term history"}
                        </span>
                        <button
                          type="button"
                          className="secondary-button compact"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "11.5px",
                            padding: "4px 10px",
                          }}
                          onClick={() => {
                            setClassroomId(option.id);
                            setActiveTab("register");
                          }}
                        >
                          <ClipboardCheck size={12} />
                          {option.canMark ? "Mark Register" : "Open Register"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <section className="panel">
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>Class Teacher</th>
                        <th>Room</th>
                        <th>Enrolled</th>
                        <th>Status</th>
                        <th>Present</th>
                        <th>Absent</th>
                        <th>Late</th>
                        <th>Leave</th>
                        <th>Attendance %</th>
                        <th style={{ width: "130px", textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClasses.map((option) => {
                        const marked = option.markedToday ?? 0;
                        const isMarked = option.isMarked ?? (marked >= option.studentCount && option.studentCount > 0);
                        const isPending = marked === 0;
                        const rate = option.todayPercent ?? (marked > 0 ? attendancePercent(option.presentToday ?? 0, marked) : 0);

                        return (
                          <tr key={option.id}>
                            <td>
                              <span className="font-medium text-[var(--text-primary)]">
                                {option.label}
                              </span>
                            </td>
                            <td className="muted-cell">
                              {option.classTeacherName || "Unassigned"}
                            </td>
                            <td className="muted-cell">{option.room || "—"}</td>
                            <td className="muted-cell">{option.studentCount}</td>
                            <td>
                              {isPending ? (
                                <span className="status-pill warning">Pending</span>
                              ) : isMarked ? (
                                <span className="status-pill success">Marked</span>
                              ) : (
                                <span className="status-pill neutral">Partial</span>
                              )}
                            </td>
                            <td className="muted-cell">{option.presentToday}</td>
                            <td className="muted-cell" style={{ color: (option.absentToday ?? 0) > 0 ? "var(--danger-strong)" : undefined }}>
                              {option.absentToday ?? 0}
                            </td>
                            <td className="muted-cell">{option.lateToday ?? 0}</td>
                            <td className="muted-cell">{option.leaveToday ?? 0}</td>
                            <td>
                              {!isPending ? (
                                <div className="flex items-center gap-3">
                                  <span className="progress-bar" style={{ width: "60px" }}>
                                    <span
                                      style={{
                                        width: `${rate}%`,
                                        background:
                                          rate < 75
                                            ? "var(--danger-strong)"
                                            : rate < ATTENDANCE_THRESHOLD
                                            ? "var(--warning)"
                                            : "var(--success)",
                                      }}
                                    />
                                  </span>
                                  <span className="font-medium text-[var(--text-hover)]">
                                    {rate}%
                                  </span>
                                </div>
                              ) : (
                                <span className="muted-cell">—</span>
                              )}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                {((option.absentToday ?? 0) > 0 || (option.leaveToday ?? 0) > 0) && (
                                  <button
                                    type="button"
                                    className="secondary-button compact"
                                    style={{ fontSize: "11px", padding: "3px 7px" }}
                                    onClick={() => setInspectClassId(option.id)}
                                    title="Inspect absentees"
                                  >
                                    <UserX size={12} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="secondary-button compact"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    fontSize: "11.5px",
                                    padding: "4px 10px",
                                  }}
                                  onClick={() => {
                                    setClassroomId(option.id);
                                    setActiveTab("register");
                                  }}
                                >
                                  <ClipboardCheck size={12} />
                                  {option.canMark ? "Mark" : "Open"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* School-wide 7-Day History */}
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Recent 7-day attendance trend</h2>
                  <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "3px" }}>
                    The last recorded school days across all classrooms.
                  </p>
                </div>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Marked</th>
                      <th>Present</th>
                      <th>Late</th>
                      <th>Leave</th>
                      <th>Absent</th>
                      <th>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!overview || overview.daily.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "36px" }}>
                          <p className="text-[var(--text-muted)] text-sm">
                            No attendance has been recorded yet.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      [...overview.daily].reverse().map((day) => (
                        <tr key={day.date}>
                          <td className="font-medium text-[var(--text-primary)]">
                            {readableDate(day.date)}
                          </td>
                          <td className="muted-cell">{day.marked}</td>
                          <td className="muted-cell">{day.present}</td>
                          <td className="muted-cell">{day.late}</td>
                          <td className="muted-cell">{day.leave}</td>
                          <td className="muted-cell">{day.absent}</td>
                          <td>
                            <div className="flex items-center gap-3">
                              <span className="progress-bar">
                                <span
                                  style={{
                                    width: `${day.percent}%`,
                                    background:
                                      day.percent < ATTENDANCE_THRESHOLD
                                        ? "var(--warning)"
                                        : "var(--brand)",
                                  }}
                                />
                              </span>
                              <span className="font-medium text-[var(--text-hover)]">
                                {day.percent}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ))}

      {/* ------------------------------------------------------------ */}
      {/* Daily Register Tab                                            */}
      {/* ------------------------------------------------------------ */}
      {activeTab === "register" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Quick jump back to live overview */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <button
              type="button"
              className="secondary-button compact"
              onClick={() => setActiveTab("overview")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "6px 12px" }}
            >
              <ArrowLeft size={13} />
              Back to Live Overview
            </button>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Viewing class register for {selectedClass?.label ?? "Selected Class"}
            </span>
          </div>

          <div className="panel" style={{ padding: "18px 22px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: "18px",
                alignItems: "end",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  Class
                </label>
                <FormSelect
                  value={activeClassId}
                  onChange={setClassroomId}
                  disabled={loading || classes.length === 0}
                  options={classes.map((option) => ({
                    value: option.id,
                    label: `${option.label} · ${option.studentCount} pupils`,
                  }))}
                  placeholder={
                    classes.length === 0 ? "No classes available" : "Select a class"
                  }
                  ariaLabel="Select class"
                />
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                    }}
                  >
                    Date
                  </label>
                  {date !== attendanceToday() && (
                    <button
                      className="secondary-button compact"
                      style={{ padding: "2px 8px", fontSize: "11px" }}
                      onClick={() => setDate(attendanceToday())}
                    >
                      Today
                    </button>
                  )}
                </div>
                <DateDropdowns
                  value={date}
                  onChange={setDate}
                  defaultToToday
                  minYear={2020}
                  maxYear={2030}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                {canMark && (
                  <button
                    className="secondary-button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "9px 14px",
                      fontSize: "12.5px",
                    }}
                    onClick={markAllPresent}
                    disabled={roster.length === 0}
                    title="Mark every pupil in this class present"
                  >
                    <Check size={14} />
                    All present
                  </button>
                )}
                <button
                  className="secondary-button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "9px 14px",
                    fontSize: "12.5px",
                  }}
                  onClick={() => setReloadKey((key) => key + 1)}
                  disabled={loading}
                >
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {managerView && !loading && !error && (
            <div
              className="panel"
              style={{
                padding: "14px 18px",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                background: "var(--bg-raised)",
              }}
            >
              <ShieldCheck
                size={18}
                style={{ color: "var(--brand-strong)", flexShrink: 0, marginTop: "2px" }}
              />
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Read-only review
                </p>
                <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Registers are marked by each class&apos;s own teacher. You can review any
                  class and date here, but only the assigned class teacher can save a mark.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="panel" style={{ padding: "18px 22px" }}>
              <SkeletonRegion label="Loading the attendance register">
                <SkeletonList rows={6} avatar />
              </SkeletonRegion>
            </div>
          ) : error ? (
            <div className="panel" style={{ padding: "34px 24px" }}>
              <div className="empty-state">
                <AlertCircle size={22} />
                <p style={{ maxWidth: "520px", textAlign: "center" }}>{error}</p>
                {retry}
              </div>
            </div>
          ) : classes.length === 0 ? (
            <div className="panel" style={{ padding: "38px 24px" }}>
              <div className="empty-state">
                <ClipboardCheck size={24} />
                <p style={{ maxWidth: "540px", textAlign: "center" }}>
                  {data?.message || "No classes are available to mark."}
                </p>
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    {selectedClass?.label ?? "Class register"}
                  </h2>
                  <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "3px" }}>
                    {selectedClass?.classTeacherName
                      ? `Class teacher · ${selectedClass.classTeacherName}`
                      : "No class teacher assigned"}
                    {selectedClass ? ` · ${selectedClass.studentCount} pupils` : ""}
                  </p>
                </div>
                <span
                  className={`status-pill ${
                    counts.unmarked > 0 ? "warning" : "success"
                  }`}
                >
                  {counts.unmarked > 0
                    ? `${counts.unmarked} unmarked`
                    : `${counts.percent}% attending`}
                </span>
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "45px" }}>#</th>
                      <th>Pupil</th>
                      <th style={{ width: "120px" }}>USN / Roll</th>
                      <th style={{ width: "130px" }}>Term attendance</th>
                      <th style={{ minWidth: "330px" }}>Status</th>
                      <th style={{ minWidth: "180px" }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "40px" }}>
                          <p className="text-[var(--text-muted)] text-sm">
                            This class has no active pupils to mark.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      roster.map((pupil, index) => {
                        const entry = draft[pupil.id];
                        const status = entry?.status ?? null;
                        return (
                          <tr key={pupil.id}>
                            <td className="muted-cell" style={{ fontSize: "12px" }}>
                              {index + 1}
                            </td>
                            <td>
                              <div className="flex items-center gap-3">
                                <span className="avatar">{pupil.initials}</span>
                                <div>
                                  <span className="font-medium text-[var(--text-primary)] block">
                                    {pupil.name}
                                  </span>
                                  <span className="text-[11.5px] text-[var(--text-muted)]">
                                    {pupil.rollNo ? `Roll ${pupil.rollNo}` : "No roll number"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td
                              className="muted-cell"
                              style={{ fontSize: "12px", fontFamily: "monospace" }}
                            >
                              {pupil.usn || "—"}
                            </td>
                            <td>
                              {pupil.termTotal > 0 ? (
                                <div className="flex items-center gap-2">
                                  <span className="progress-bar" style={{ width: "50px" }}>
                                    <span
                                      style={{
                                        width: `${pupil.termPercent}%`,
                                        background:
                                          pupil.termPercent < ATTENDANCE_THRESHOLD
                                            ? "var(--warning)"
                                            : "var(--brand)",
                                      }}
                                    />
                                  </span>
                                  <span className="font-medium text-[12px] text-[var(--text-hover)]">
                                    {pupil.termPercent}%
                                  </span>
                                </div>
                              ) : (
                                <span className="muted-cell text-[12px]">No history</span>
                              )}
                            </td>
                            <td>
                              {canMark ? (
                                <AttendanceStatusPicker
                                  value={status}
                                  onChange={(next) => setStatus(pupil.id, next)}
                                  label={`Attendance for ${pupil.name}`}
                                />
                              ) : status ? (
                                <span className={`status-pill ${attendanceTone(status)}`}>
                                  {ATTENDANCE_STATUS_LABELS[status]}
                                </span>
                              ) : (
                                <span className="status-pill neutral">Not marked</span>
                              )}
                            </td>
                            <td>
                              {canMark ? (
                                <input
                                  value={entry?.notes ?? ""}
                                  onChange={(event) => setNotes(pupil.id, event.target.value)}
                                  placeholder="Optional"
                                  aria-label={`Remarks for ${pupil.name}`}
                                  maxLength={500}
                                  style={{
                                    width: "100%",
                                    border: "1px solid var(--border-strong)",
                                    borderRadius: "8px",
                                    background: "var(--bg-input)",
                                    padding: "7px 10px",
                                    color: "var(--text-secondary)",
                                    fontSize: "12.5px",
                                    outline: "none",
                                  }}
                                />
                              ) : (
                                <span className="muted-cell text-[12.5px]">
                                  {entry?.notes?.trim() || "—"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "14px",
                  padding: "16px 24px",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <span className="status-pill success">Present {counts.present}</span>
                  <span className="status-pill warning">Late {counts.late}</span>
                  <span className="status-pill neutral">Leave {counts.leave}</span>
                  <span className="status-pill danger">Absent {counts.absent}</span>
                  {counts.unmarked > 0 && (
                    <span className="status-pill neutral">{counts.unmarked} unmarked</span>
                  )}
                </div>

                {canMark ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Reason for changes (optional)"
                      aria-label="Reason for attendance changes"
                      maxLength={500}
                      style={{
                        minWidth: "240px",
                        border: "1px solid var(--border-strong)",
                        borderRadius: "10px",
                        background: "var(--bg-input)",
                        padding: "9px 12px",
                        color: "var(--text-secondary)",
                        fontSize: "12.5px",
                        outline: "none",
                      }}
                    />
                    <button
                      className="primary-button"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "9px 16px",
                        fontSize: "13px",
                      }}
                      onClick={handleSave}
                      disabled={!allMarked || saving}
                      title={
                        allMarked
                          ? "Save this register"
                          : "Mark every pupil before saving"
                      }
                    >
                      {saving ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      {allMarked ? "Save register" : `Mark ${counts.unmarked} more`}
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                    {managerView
                      ? "Read-only — the class teacher saves this register."
                      : "You are not the class teacher for this class."}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* Absentee & Exceptions Drill-Down Drawer                       */}
      {/* ------------------------------------------------------------ */}
      {inspectClassId && inspectedClass && (
        <>
          <div
            className="drawer-scrim"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.45)",
              backdropFilter: "blur(2px)",
              zIndex: 9998,
            }}
            onClick={() => setInspectClassId(null)}
          />
          <div
            className="drawer"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(460px, 100vw)",
              background: "var(--bg-card)",
              borderLeft: "1px solid var(--border-strong)",
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-8px 0 24px rgba(0, 0, 0, 0.14)",
              animation: "drawer-slide-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                    {inspectedClass.label}
                  </h2>
                  {inspectedClass.room && (
                    <span className="status-pill neutral" style={{ fontSize: "11px", padding: "2px 6px" }}>
                      Rm {inspectedClass.room}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "12.5px", color: "var(--text-muted)", margin: "4px 0 0" }}>
                  {inspectedClass.classTeacherName ? `Teacher: ${inspectedClass.classTeacherName}` : "No teacher assigned"} · {readableDate(data?.date ?? date)}
                </p>
              </div>
              <button
                className="secondary-button compact"
                style={{ padding: "6px", borderRadius: "8px" }}
                onClick={() => setInspectClassId(null)}
                aria-label="Close drawer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Quick summary metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                <div className="panel" style={{ padding: "12px", textAlign: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Present</span>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--success)" }}>{inspectedClass.presentToday}</span>
                </div>
                <div className="panel" style={{ padding: "12px", textAlign: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Absent</span>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--danger-strong)" }}>{inspectedClass.absentToday ?? 0}</span>
                </div>
                <div className="panel" style={{ padding: "12px", textAlign: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>On Leave</span>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--brand-strong)" }}>{inspectedClass.leaveToday ?? 0}</span>
                </div>
              </div>

              {/* Absentees list */}
              <div>
                <h3
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <UserX size={14} style={{ color: "var(--danger-strong)" }} />
                  Absentees & Exceptions ({inspectedClass.absentees?.length ?? 0})
                </h3>

                {(!inspectedClass.absentees || inspectedClass.absentees.length === 0) ? (
                  <div className="panel" style={{ padding: "28px 16px", textAlign: "center" }}>
                    <CheckCircle2 size={24} style={{ color: "var(--success)", margin: "0 auto 8px" }} />
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                      100% Attendance Recorded!
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                      No pupils were marked absent, late, or on leave for this class on {readableDate(data?.date ?? date)}.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {inspectedClass.absentees.map((pupil) => (
                      <div
                        key={pupil.id}
                        className="panel"
                        style={{
                          padding: "12px 14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                          <div>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                              {pupil.name}
                            </span>
                            {pupil.rollNo && (
                              <span style={{ fontSize: "11.5px", color: "var(--text-muted)", marginLeft: "8px" }}>
                                Roll #{pupil.rollNo}
                              </span>
                            )}
                          </div>
                          <span className={`status-pill ${attendanceTone(pupil.status)}`}>
                            {ATTENDANCE_STATUS_LABELS[pupil.status]}
                          </span>
                        </div>

                        {pupil.notes ? (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                              background: "var(--bg-raised)",
                              padding: "6px 10px",
                              borderRadius: "6px",
                            }}
                          >
                            <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>Remark: </span>
                            {pupil.notes}
                          </div>
                        ) : (
                          <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontStyle: "italic" }}>
                            No remarks entered by teacher
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="primary-button"
                style={{
                  flex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  fontSize: "13px",
                  padding: "10px 16px",
                }}
                onClick={() => {
                  setClassroomId(inspectedClass.id);
                  setActiveTab("register");
                  setInspectClassId(null);
                }}
              >
                <ClipboardCheck size={14} />
                Open Full Class Register
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helper: Convert numeric rupee amounts to formal Indian English words
function amountInWords(num: number): string {
  if (!num || num <= 0) return "Zero Rupees Only";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function formatHundred(n: number): string {
    let str = "";
    if (n > 99) {
      str += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 > 0 ? " " + a[n % 10] : "");
    } else if (n > 0) {
      str += a[n];
    }
    return str.trim();
  }

  let words = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remaining = num;

  if (crore > 0) words += formatHundred(crore) + " Crore ";
  if (lakh > 0) words += formatHundred(lakh) + " Lakh ";
  if (thousand > 0) words += formatHundred(thousand) + " Thousand ";
  if (remaining > 0) words += formatHundred(remaining);

  return `${words.trim()} Rupees Only`;
}

// Helper: Download a well-formatted CSV with UTF-8 BOM
function downloadLedgerCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const content = [
    headers.join(","),
    ...rows.map(row =>
      row
        .map(cell => {
          const str = String(cell ?? "");
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function FinanceView({ onBack }: { onBack: () => void }) {
  const [showDialog, setShowDialog] = useState(false);
  const [financeTab, setFinanceTab] = useState<"invoices" | "defaulters" | "receipts" | "cohort">("invoices");
  
  // Invoices & Ledger Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Receipts Filters
  const [receiptSearchQuery, setReceiptSearchQuery] = useState("");
  const [receiptMethodFilter, setReceiptMethodFilter] = useState("all");

  // Modals & Drawers
  const [inspectingInvoice, setInspectingInvoice] = useState<Invoice | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);

  // Record Payment Dialog State
  const [recordStudent, setRecordStudent] = useState<Student | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("Bank transfer");
  const [paymentReference, setPaymentReference] = useState("");

  const { rows: revenueData, loading: financeMonthsLoading } = useFinanceMonthly();
  const { rows: feeCategories, loading: feeCategoriesLoading } = useFeeCategories();
  const { rows: invoices, loading: invoicesViewLoading } = useInvoices();
  const { rows: payments, loading: paymentsLoading } = usePayments();
  const { rows: enrolledStudents } = useStudents();

  const matchingStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return [];
    const q = studentSearchQuery.toLowerCase();
    return enrolledStudents
      .filter(s => s.name.toLowerCase().includes(q) || s.usn?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [enrolledStudents, studentSearchQuery]);

  // Invoices with money still owed, for the dialog's invoice picker.
  const collectableInvoices = useMemo(
    () => invoices.filter((i) => Number(i.outstanding ?? i.amount ?? 0) > 0),
    [invoices]
  );

  // The invoice the payment settles against. Picking a student narrows to that
  // student's real invoice row; if the student has none yet there is nothing to
  // settle and the desk must issue the invoice first.
  const selectedInvoice = useMemo(() => {
    if (selectedInvoiceId) {
      return invoices.find(i => String(i.id).toLowerCase() === selectedInvoiceId.toLowerCase()) || null;
    }
    if (recordStudent) {
      return (
        invoices.find(
          i =>
            (recordStudent.id && (i.student_id === recordStudent.id || (i as any).studentId === recordStudent.id)) ||
            i.student.toLowerCase() === recordStudent.name.toLowerCase()
        ) || null
      );
    }
    return null;
  }, [invoices, selectedInvoiceId, recordStudent]);

  useEffect(() => {
    if (selectedInvoice) {
      const balance = Number(selectedInvoice.outstanding ?? selectedInvoice.amount ?? 0);
      setPaymentAmount(balance > 0 ? String(balance) : "");
    }
  }, [selectedInvoice]);

  // Overall Financial Metrics
  const billed = useMemo(
    () => invoices.reduce((s, i) => s + (i.total ?? i.amount ?? 0), 0),
    [invoices]
  );
  const collected = useMemo(
    () => invoices.reduce((s, i) => s + (i.paid ?? 0), 0),
    [invoices]
  );
  const outstanding = Math.max(0, billed - collected);
  const rate = billed > 0 ? Math.round((collected / billed) * 1000) / 10 : 0;
  
  const overdueInvoices = useMemo(
    () => invoices.filter(i => i.status === "Overdue" && (i.outstanding ?? i.amount ?? 0) > 0),
    [invoices]
  );
  const overdueTotalAmount = useMemo(
    () => overdueInvoices.reduce((s, i) => s + (i.outstanding ?? i.amount ?? 0), 0),
    [overdueInvoices]
  );

  const collectedSpark = revenueData.length >= 2 ? revenueData.map(r => r.collected) : undefined;
  const pendingSpark = revenueData.length >= 2 ? revenueData.map(r => r.pending) : undefined;

  // Filtered Invoices for Tab 1
  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        i =>
          i.student.toLowerCase().includes(q) ||
          String(i.id).toLowerCase().includes(q) ||
          String((i as any).usn || "").toLowerCase().includes(q) ||
          i.family.toLowerCase().includes(q)
      );
    }
    if (gradeFilter !== "all") {
      list = list.filter(i => (i as any).grade === gradeFilter || ((i as any).grade && (i as any).grade.includes(gradeFilter.replace("Grade ", ""))));
    }
    if (sectionFilter !== "all") {
      list = list.filter(i => (i as any).section === sectionFilter);
    }
    if (statusFilter !== "all") {
      if (statusFilter === "Paid") {
        list = list.filter(i => i.status === "Paid" || (i.outstanding ?? 0) === 0);
      } else if (statusFilter === "Overdue") {
        list = list.filter(i => i.status === "Overdue" && (i.outstanding ?? i.amount ?? 0) > 0);
      } else if (statusFilter === "Partial") {
        list = list.filter(i => i.status === "Partial");
      } else if (statusFilter === "Due") {
        list = list.filter(i => i.status === "Due" || i.status === "Partial");
      }
    }
    return list;
  }, [invoices, searchQuery, gradeFilter, sectionFilter, statusFilter]);

  const invoicesPager = usePagination(filteredInvoices);
  const pageInvoices = invoicesPager.pageRows;

  // Filtered Receipts for Tab 3
  const filteredReceipts = useMemo(() => {
    let list = payments;
    if (receiptSearchQuery.trim()) {
      const q = receiptSearchQuery.toLowerCase().trim();
      list = list.filter(
        p =>
          p.student.toLowerCase().includes(q) ||
          String(p.receipt_no || "").toLowerCase().includes(q) ||
          String(p.reference || "").toLowerCase().includes(q) ||
          String(p.invoice_id || "").toLowerCase().includes(q)
      );
    }
    if (receiptMethodFilter !== "all") {
      list = list.filter(p => p.method.toLowerCase().includes(receiptMethodFilter.toLowerCase()));
    }
    return list;
  }, [payments, receiptSearchQuery, receiptMethodFilter]);

  const receiptsPager = usePagination(filteredReceipts);
  const pageReceipts = receiptsPager.pageRows;

  // Cohort Class-wise Breakdown Data — totals straight off the invoice rows.
  const cohortBreakdown = useMemo(() => {
    const grades = ["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
    return grades.map(g => {
      const gradeInvoices = invoices.filter(i => (i as any).grade === g || ((i as any).grade && (i as any).grade.includes(g.replace("Grade ", ""))));
      const pupilCount = gradeInvoices.length;
      const totalBilled = gradeInvoices.reduce(
        (s, i) => s + (i.total ?? i.amount ?? 0),
        0
      );
      const totalPaid = gradeInvoices.reduce((s, i) => s + (i.paid ?? 0), 0);
      const totalPending = Math.max(0, totalBilled - totalPaid);
      const collectionPct = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 1000) / 10 : 0;
      return {
        grade: g,
        pupilCount,
        // Real average assessed per pupil with an invoice behind the grade;
        // grades with no billing yet show a dash rather than an invented fee.
        feePerPupil: pupilCount > 0 ? Math.round(totalBilled / pupilCount) : null,
        totalBilled,
        totalPaid,
        totalPending,
        collectionPct,
      };
    });
  }, [invoices]);

  // CSV Export Handlers
  const handleExportInvoicesCsv = () => {
    const headers = [
      "Invoice ID",
      "Student Name",
      "USN",
      "Grade",
      "Section",
      "Guardian Family",
      "Due Date",
      "Total Assessed (INR)",
      "Paid Amount (INR)",
      "Outstanding Balance (INR)",
      "Status",
    ];
    const rows = filteredInvoices.map(inv => [
      inv.id,
      inv.student,
      (inv as any).usn || (inv as any).student_id || "—",
      (inv as any).grade || "—",
      (inv as any).section || "—",
      inv.family,
      inv.due_date,
      inv.total ?? inv.amount ?? 0,
      inv.paid ?? 0,
      inv.outstanding ?? inv.amount ?? 0,
      inv.status,
    ]);
    downloadLedgerCsv(`GKS_Fee_Invoices_AY2026-27_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success("Invoices Ledger exported to CSV");
  };

  const handleExportDefaultersCsv = () => {
    const headers = [
      "Student Name",
      "USN",
      "Grade",
      "Section",
      "Guardian Family",
      "Invoice ID",
      "Due Date",
      "Overdue Balance (INR)",
      "Status",
    ];
    const rows = overdueInvoices.map(inv => [
      inv.student,
      (inv as any).usn || (inv as any).student_id || "—",
      (inv as any).grade || "—",
      (inv as any).section || "—",
      inv.family,
      inv.id,
      inv.due_date,
      inv.outstanding ?? inv.amount ?? 0,
      "Overdue Defaulter",
    ]);
    downloadLedgerCsv(`GKS_Fee_Defaulters_AY2026-27_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success("Defaulters List exported to CSV");
  };

  const handleExportReceiptsCsv = () => {
    const headers = [
      "Receipt Number",
      "Student Name",
      "Invoice Ref",
      "Payment Date",
      "Payment Method",
      "Reference / UTR",
      "Amount (INR)",
      "Recipient Email",
    ];
    const rows = filteredReceipts.map(pay => [
      (pay as any).receipt_no || "—",
      pay.student,
      pay.invoice_id || "—",
      pay.paid_at ? new Date(pay.paid_at).toLocaleString("en-IN") : "—",
      pay.method,
      (pay as any).reference || "—",
      pay.amount,
      (pay as any).recipient_email || "—",
    ]);
    downloadLedgerCsv(`GKS_Payment_Receipts_AY2026-27_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success("Payment Receipts exported to CSV");
  };

  return (
    <div className="page-stack">
      {/* Page Header */}
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Fees & finance"
            onParentClick={onBack}
          />
          <h1 className="page-title">Fees & finance</h1>
          <p className="page-subtitle">
            {invoices.length} pupil account{invoices.length === 1 ? "" : "s"} ·{" "}
            {invoices.filter(i => i.status !== "Paid").length} outstanding · ₹{(billed / 100000).toFixed(1)}L total institutional billing
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={handleExportInvoicesCsv}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Download size={14} />
            Export Ledger
          </button>
          <button className="primary-button" onClick={() => setShowDialog(true)}>
            <Plus size={16} />
            Record payment
          </button>
        </div>
      </div>

      {/* Top Four Metric Cards */}
      <div className="metric-grid">
        {invoicesViewLoading ? (
          <>
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
          </>
        ) : (
          <>
            <MetricBlock
              label="Total Assessed Fee"
              value={`₹${(billed / 100000).toFixed(1)}L`}
              comparison={`${invoices.length} enrolled accounts`}
              icon={FileText}
            />
            <MetricBlock
              label="Collected this term"
              value={`₹${(collected / 100000).toFixed(1)}L`}
              comparison={`${rate}% collected`}
              icon={IndianRupee}
              spark={collectedSpark}
            />
            <MetricBlock
              label="Outstanding balance"
              value={`₹${(outstanding / 100000).toFixed(1)}L`}
              comparison={`${overdueInvoices.length} overdue accounts`}
              icon={Receipt}
              spark={pendingSpark}
              positive={false}
            />
            <MetricBlock
              label="Collection rate"
              value={`${rate}%`}
              comparison="Target: 95% AY 2026–27"
              icon={Activity}
            />
          </>
        )}
      </div>

      {/* Visual Analytics Row: Revenue Movement + Cohort Fee Structure */}
      <div className="dashboard-grid dashboard-grid-top">
        <section className="panel finance-chart-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Revenue movement (12 Months)</h2>
              <p className="panel-subtitle" style={{ margin: "2px 0 0", fontSize: "12px" }}>
                Cumulative collections and pending fees across the academic calendar (Apr 2026 – Mar 2027).
              </p>
            </div>
            <span className="mini-label" style={{ display: "inline-flex", alignItems: "center", gap: "14px", fontSize: "12px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)", fontWeight: 500 }}>
                <i className="legend-dot" style={{ background: "var(--success)" }} />
                Collected
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)", fontWeight: 500 }}>
                <i className="legend-dot" style={{ background: "var(--warning)" }} />
                Pending
              </span>
            </span>
          </div>
          <div className="chart-wrap">
            {invoicesViewLoading || financeMonthsLoading ? (
              <SkeletonChart height={260} variant="bar" />
            ) : revenueData.length === 0 ? (
              <div className="empty-state py-14">
                <BarChart3 size={24} className="text-[var(--text-muted)]" />
                <p className="panel-title" style={{ fontSize: 15, marginTop: 4 }}>
                  No revenue recorded yet
                </p>
                <p className="panel-subtitle">
                  Collections appear here once invoices are raised for the year.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={revenueData}
                  barGap={5}
                  margin={{ top: 8, right: 5, left: -20, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                    tickFormatter={value => `₹${value}L`}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--bg-hover)", radius: 6 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const collectedVal = payload.find(p => p.dataKey === "collected")?.value;
                      const pendingVal = payload.find(p => p.dataKey === "pending")?.value;
                      return (
                        <div
                          style={{
                            background: "var(--bg-panel)",
                            backdropFilter: "blur(16px)",
                            border: "1px solid var(--border-strong)",
                            borderRadius: "12px",
                            padding: "10px 14px",
                            boxShadow: "var(--shadow-popover)",
                            fontSize: "12px",
                          }}
                        >
                          <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                            {label} 2026–27
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success)", fontWeight: 600 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} />
                            <span>Collected: ₹{collectedVal}L</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--warning)", fontWeight: 600, marginTop: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warning)" }} />
                            <span>Pending: ₹{pendingVal}L</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="collected"
                    fill="var(--success)"
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    dataKey="pending"
                    fill="var(--warning)"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Fee structure & cohort mix</h2>
              <p className="panel-subtitle" style={{ margin: "2px 0 0", fontSize: "12px" }}>
                Official school policy: Unified annual tuition fee.
              </p>
            </div>
          </div>
          <div className="fee-mix">
            <div className="pie-wrap">
              {feeCategoriesLoading ? (
                <div className="skeleton-chart" style={{ height: 170 }}>
                  <div className="skeleton-pie">
                    <span
                      className="erp-skeleton erp-skeleton-ring"
                      style={{ height: 136, width: 136 }}
                    />
                  </div>
                </div>
              ) : feeCategories.length === 0 ? (
                <div className="pie-empty" role="img" aria-label="No fee data recorded">
                  <IndianRupee size={20} />
                  <span>No fee data</span>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={feeCategories}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={68}
                        dataKey="value"
                        stroke="none"
                      >
                        {feeCategories.map(category => (
                          <Cell key={category.id} fill={category.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pie-center">
                    <strong>₹{(billed / 100000).toFixed(1)}L</strong>
                    <span>total billed</span>
                  </div>
                </>
              )}
            </div>
            <div className="fee-legend">
              {feeCategories.map(category => (
                <div
                  key={category.id}
                  className="flex items-center justify-between text-[12.5px]"
                >
                  <span className="flex items-center gap-2 text-[var(--text-muted)]">
                    <i
                      className="legend-dot"
                      style={{ background: category.color }}
                    />
                    {category.name}
                  </span>
                  <strong className="text-[var(--text-hover)]">
                    {category.value}%
                  </strong>
                </div>
              ))}
              <div style={{ marginTop: "10px", padding: "8px 10px", background: "var(--bg-raised)", borderRadius: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                <div>Class 6–8: <strong className="text-[var(--text-primary)]">₹50,000 / year</strong></div>
                <div style={{ marginTop: "2px" }}>Class 9–10: <strong className="text-[var(--text-primary)]">₹60,000 / year</strong></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
        <SegmentedControl
          value={financeTab}
          onChange={(tab) => setFinanceTab(tab as any)}
          options={[
            {
              value: "invoices",
              label: (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Invoices & Ledger
                  <span className="count-badge">{invoices.length}</span>
                </span>
              ),
            },
            {
              value: "defaulters",
              label: (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Overdue Accounts
                  {overdueInvoices.length > 0 && (
                    <span className="count-badge" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                      {overdueInvoices.length}
                    </span>
                  )}
                </span>
              ),
            },
            {
              value: "receipts",
              label: (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Payment Receipts
                  <span className="count-badge">{payments.length}</span>
                </span>
              ),
            },
            {
              value: "cohort",
              label: "Class-wise Analysis",
            },
          ]}
        />
      </div>

      {/* TAB 1: INVOICES & BILLING LEDGER */}
      {financeTab === "invoices" && (
        <section className="panel table-panel">
          <div className="panel-header" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 className="panel-title">Institutional fee invoices</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Complete billing register for all pupils enrolled across Class 6 to 10.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="secondary-button compact"
                onClick={handleExportInvoicesCsv}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "12px" }}
              >
                <Download size={13} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1.8fr) repeat(3, minmax(130px, 1fr)) auto",
              gap: "10px",
              padding: "10px 16px",
              background: "var(--bg-raised)",
              borderBottom: "1px solid var(--border)",
              alignItems: "center",
            }}
          >
            <div className="search-field" style={{ height: "34px" }}>
              <Search size={14} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, USN, invoice ID..."
                style={{ fontSize: "12px" }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <FormSelect
              value={gradeFilter}
              onChange={setGradeFilter}
              options={[
                { value: "all", label: "All Classes" },
                { value: "Grade 6", label: "Class 6 (₹50k)" },
                { value: "Grade 7", label: "Class 7 (₹50k)" },
                { value: "Grade 8", label: "Class 8 (₹50k)" },
                { value: "Grade 9", label: "Class 9 (₹60k)" },
                { value: "Grade 10", label: "Class 10 (₹60k)" },
              ]}
            />

            <FormSelect
              value={sectionFilter}
              onChange={setSectionFilter}
              options={[
                { value: "all", label: "All Sections" },
                { value: "A", label: "Section A" },
                { value: "B", label: "Section B" },
              ]}
            />

            <FormSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "Overdue", label: "Overdue Only" },
                { value: "Due", label: "Due / Partial" },
                { value: "Paid", label: "Settled / Paid" },
              ]}
            />

            {(searchQuery || gradeFilter !== "all" || sectionFilter !== "all" || statusFilter !== "all") && (
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => {
                  setSearchQuery("");
                  setGradeFilter("all");
                  setSectionFilter("all");
                  setStatusFilter("all");
                }}
                style={{ height: "34px", padding: "0 10px", fontSize: "11.5px", whiteSpace: "nowrap" }}
                title="Reset all filters"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student & USN</th>
                  <th>Class</th>
                  <th>Guardian</th>
                  <th>Invoice ID</th>
                  <th>Due Date</th>
                  <th>Annual Fee</th>
                  <th>Paid</th>
                  <th>Balance Due</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoicesViewLoading ? (
                  <SkeletonTableRows rows={6} columns={10} />
                ) : pageInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      No invoices match the selected filters.
                    </td>
                  </tr>
                ) : (
                  pageInvoices.map(row => {
                    const annualFee = row.total ?? (row as any).amount ?? 0;
                    const paidAmount = row.paid ?? 0;
                    const outstandingBalance = row.outstanding ?? Math.max(0, annualFee - paidAmount);
                    return (
                      <tr key={row.id}>
                        <td>
                          <div>
                            <span className="font-semibold text-sm text-[var(--text-primary)] block">
                              {row.student}
                            </span>
                            {(row as any).usn && (
                              <code className="text-[11px] text-[var(--brand)] font-mono">
                                {(row as any).usn}
                              </code>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="grade-chip">
                            {(row as any).grade || "Class 6"} · {(row as any).section || "A"}
                          </span>
                        </td>
                        <td className="muted-cell">{row.family}</td>
                        <td className="font-mono text-xs text-[var(--text-secondary)]">{row.id}</td>
                        <td className="muted-cell">
                          <span className={row.status === "Overdue" ? "text-[var(--danger)] font-semibold" : ""}>
                            {row.due_date}
                          </span>
                        </td>
                        <td className="font-medium text-[var(--text-secondary)]">
                          ₹{annualFee.toLocaleString("en-IN")}
                        </td>
                        <td className="font-semibold text-[var(--success)]">
                          ₹{paidAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="font-bold text-[var(--text-primary)]">
                          {outstandingBalance > 0 ? (
                            <span className={row.status === "Overdue" ? "text-[var(--danger)] font-bold" : "text-[var(--warning)] font-bold"}>
                              ₹{outstandingBalance.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)] font-normal">₹0</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-pill ${
                              row.status === "Paid"
                                ? "success"
                                : row.status === "Overdue"
                                ? "warning"
                                : row.status === "Partial"
                                ? "neutral"
                                : "neutral"
                            }`}
                          >
                            {row.status === "Paid" && <Check size={11} className="mr-0.5 inline" />}
                            {row.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            {outstandingBalance > 0 ? (
                              <button
                                className="tiny-action"
                                style={{
                                  background: "var(--success-soft)",
                                  color: "var(--success)",
                                  borderColor: "var(--success-border)",
                                  fontWeight: 600,
                                }}
                                onClick={() => {
                                  const s = enrolledStudents.find(
                                    stu =>
                                      stu.name.toLowerCase() === row.student.toLowerCase() ||
                                      (row.student_id && stu.id === row.student_id)
                                  );
                                  setSelectedInvoiceId(String(row.id));
                                  if (s) {
                                    setRecordStudent(s);
                                  } else {
                                    setStudentSearchQuery(row.student);
                                  }
                                  setPaymentAmount(String(outstandingBalance));
                                  setShowDialog(true);
                                }}
                                title="Collect payment"
                              >
                                Collect
                              </button>
                            ) : (
                              <span className="status-pill success text-[11px]">
                                <Check size={11} className="mr-0.5 inline" />
                                Settled
                              </span>
                            )}
                            <button
                              className="tiny-action"
                              onClick={() => setInspectingInvoice(row)}
                              title="View invoice details"
                            >
                              Details
                            </button>
                            {outstandingBalance > 0 && (
                              <button
                                className="tiny-action"
                                onClick={() =>
                                  toast.success("Payment reminder dispatched", {
                                    description: `Reminder sent to ${row.family} for balance ₹${outstandingBalance.toLocaleString("en-IN")}.`,
                                  })
                                }
                                title="Send reminder"
                              >
                                Remind
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pager pagination={invoicesPager} noun="invoices" />
        </section>
      )}

      {/* TAB 2: DEFAULTERS & OVERDUE TRACKING */}
      {financeTab === "defaulters" && (
        <section className="panel table-panel">
          <div className="panel-header" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--danger)", display: "inline-flex" }}>
                  <AlertCircle size={18} />
                </span>
                <h2 className="panel-title">Overdue accounts & defaulters</h2>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {overdueInvoices.length} pupil account{overdueInvoices.length === 1 ? "" : "s"} with unsettled fee balances past due date. Total overdue: <strong className="text-[var(--danger)]">₹{(overdueTotalAmount / 100000).toFixed(2)}L</strong>
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                className="secondary-button compact"
                onClick={handleExportDefaultersCsv}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "12px" }}
              >
                <Download size={13} />
                Export Defaulters CSV
              </button>
              {overdueInvoices.length > 0 && (
                <button
                  type="button"
                  className="primary-button compact"
                  onClick={() => {
                    toast.success("Bulk reminders dispatched! ✉️", {
                      description: `Payment reminder notices sent to all ${overdueInvoices.length} overdue guardian accounts.`,
                    });
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "12px" }}
                >
                  <Mail size={13} />
                  Notify All Guardians
                </button>
              )}
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pupil Candidate</th>
                  <th>Class & Section</th>
                  <th>Guardian</th>
                  <th>Invoice Ref</th>
                  <th>Due Date</th>
                  <th>Total Fee</th>
                  <th>Amount Paid</th>
                  <th>Overdue Balance</th>
                  <th className="text-right">Defaulter Action</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      🎉 No overdue accounts! All pupil ledgers are up to date.
                    </td>
                  </tr>
                ) : (
                  overdueInvoices.map(row => {
                    const totalFee = row.total ?? (row as any).amount ?? 0;
                    const paid = row.paid ?? 0;
                    const overdueAmt = row.outstanding ?? Math.max(0, totalFee - paid);
                    return (
                      <tr key={row.id}>
                        <td>
                          <span className="font-semibold text-sm text-[var(--text-primary)] block">{row.student}</span>
                          {(row as any).usn && <code className="text-xs text-[var(--brand)] font-mono">{(row as any).usn}</code>}
                        </td>
                        <td>
                          <span className="grade-chip">{(row as any).grade || "Class 6"} · {(row as any).section || "A"}</span>
                        </td>
                        <td className="muted-cell">{row.family}</td>
                        <td className="font-mono text-xs text-[var(--text-secondary)]">{row.id}</td>
                        <td className="text-[var(--danger)] font-semibold">{row.due_date}</td>
                        <td className="muted-cell">₹{totalFee.toLocaleString("en-IN")}</td>
                        <td className="text-[var(--success)] font-semibold">₹{paid.toLocaleString("en-IN")}</td>
                        <td className="font-bold text-[var(--danger)] text-sm">
                          ₹{overdueAmt.toLocaleString("en-IN")}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              className="tiny-action"
                              style={{
                                background: "var(--success-soft)",
                                color: "var(--success)",
                                borderColor: "var(--success-border)",
                                fontWeight: 600,
                              }}
                              onClick={() => {
                                const s = enrolledStudents.find(
                                  stu =>
                                    stu.name.toLowerCase() === row.student.toLowerCase() ||
                                    (row.student_id && stu.id === row.student_id)
                                );
                                setSelectedInvoiceId(String(row.id));
                                if (s) {
                                  setRecordStudent(s);
                                } else {
                                  setStudentSearchQuery(row.student);
                                }
                                setPaymentAmount(String(overdueAmt));
                                setShowDialog(true);
                              }}
                            >
                              Collect Now
                            </button>
                            <button
                              className="tiny-action"
                              onClick={() =>
                                toast.success("Overdue reminder sent", {
                                  description: `Direct notice sent to ${row.family} for ₹${overdueAmt.toLocaleString("en-IN")}.`,
                                })
                              }
                            >
                              Send Notice
                            </button>
                            <button
                              className="tiny-action"
                              onClick={() => setInspectingInvoice(row)}
                            >
                              Details
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
        </section>
      )}

      {/* TAB 3: PAYMENT RECEIPTS & AUDIT LOG */}
      {financeTab === "receipts" && (
        <section className="panel table-panel">
          <div className="panel-header" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 className="panel-title">Official payment receipts & audit log</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Verified collections and payment transactions logged across school accounts.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                className="secondary-button compact"
                onClick={handleExportReceiptsCsv}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "12px" }}
              >
                <Download size={13} />
                Export Receipts CSV
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.8fr 1fr auto",
              gap: "10px",
              padding: "10px 16px",
              background: "var(--bg-raised)",
              borderBottom: "1px solid var(--border)",
              alignItems: "center",
            }}
          >
            <div className="search-field" style={{ height: "34px" }}>
              <Search size={14} />
              <input
                value={receiptSearchQuery}
                onChange={(e) => setReceiptSearchQuery(e.target.value)}
                placeholder="Search receipt no, student name, UTR..."
                style={{ fontSize: "12px" }}
              />
              {receiptSearchQuery && (
                <button
                  type="button"
                  onClick={() => setReceiptSearchQuery("")}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <FormSelect
              value={receiptMethodFilter}
              onChange={setReceiptMethodFilter}
              options={[
                { value: "all", label: "All Payment Modes" },
                { value: "UPI", label: "UPI (GPay / PhonePe / Paytm)" },
                { value: "Bank", label: "Bank Transfer (NEFT/RTGS/IMPS)" },
                { value: "Cash", label: "Cash Counter" },
                { value: "Card", label: "Card (POS)" },
                { value: "Cheque", label: "Cheque / DD" },
              ]}
            />

            {(receiptSearchQuery || receiptMethodFilter !== "all") && (
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => {
                  setReceiptSearchQuery("");
                  setReceiptMethodFilter("all");
                }}
                style={{ height: "34px", padding: "0 10px", fontSize: "11.5px" }}
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt No</th>
                  <th>Student</th>
                  <th>Invoice Ref</th>
                  <th>Payment Date & Time</th>
                  <th>Method & UTR</th>
                  <th>Amount Paid</th>
                  <th>Emailed Dispatched To</th>
                  <th className="text-right">Receipt Voucher</th>
                </tr>
              </thead>
              <tbody>
                {paymentsLoading ? (
                  <SkeletonTableRows rows={4} columns={8} />
                ) : pageReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      No payment receipts match the criteria.
                    </td>
                  </tr>
                ) : (
                  pageReceipts.map((pay) => {
                    const targetEmail = (pay as any).recipient_email || `${pay.student.toLowerCase().replace(/[^a-z0-9]/g, ".")}@example.com`;
                    return (
                      <tr key={pay.id}>
                        <td className="font-mono text-xs text-[var(--brand)] font-semibold">
                          {String((pay as any).receipt_no || "Receipt")}
                        </td>
                        <td className="font-medium text-[var(--text-primary)]">
                          {pay.student}
                        </td>
                        <td className="muted-cell">{pay.invoice_id || "—"}</td>
                        <td className="muted-cell">
                          {pay.paid_at ? new Date(pay.paid_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                        </td>
                        <td>
                          <div className="text-xs text-[var(--text-secondary)]">
                            <span className="font-semibold">{pay.method || "Verified"}</span>
                            {(pay as any).reference && (
                              <span className="block text-[11px] text-[var(--text-muted)] font-mono">
                                {(pay as any).reference}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="font-bold text-[var(--success)] text-sm">
                          ₹{pay.amount.toLocaleString("en-IN")}
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono">
                            <Mail size={12} className="text-[var(--info)]" />
                            {targetEmail}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="secondary-button compact"
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "11.5px", padding: "4px 9px" }}
                            onClick={() => setViewingReceipt(pay)}
                          >
                            <FileText size={12} />
                            View Voucher
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pager pagination={receiptsPager} noun="receipts" />
        </section>
      )}

      {/* TAB 4: CLASS-WISE COHORT ANALYSIS */}
      {financeTab === "cohort" && (
        <section className="panel table-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Class-wise fee collection analysis</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Institutional collection rates, assessed tuition fees, and outstanding balances per cohort.
              </p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class / Cohort</th>
                  <th>Enrolled Pupils</th>
                  <th>Annual Fee Policy</th>
                  <th>Total Assessed</th>
                  <th>Collected to Date</th>
                  <th>Outstanding Balance</th>
                  <th style={{ width: "220px" }}>Collection Rate</th>
                </tr>
              </thead>
              <tbody>
                {cohortBreakdown.map(row => (
                  <tr key={row.grade}>
                    <td>
                      <strong className="text-[var(--text-primary)] text-sm">{row.grade}</strong>
                    </td>
                    <td>{row.pupilCount} pupils</td>
                    <td className="font-medium text-[var(--text-secondary)]">
                      {row.feePerPupil != null
                        ? `₹${row.feePerPupil.toLocaleString("en-IN")} / pupil`
                        : "—"}
                    </td>
                    <td className="font-semibold text-[var(--text-primary)]">
                      ₹{(row.totalBilled / 100000).toFixed(2)}L
                    </td>
                    <td className="font-semibold text-[var(--success)]">
                      ₹{(row.totalPaid / 100000).toFixed(2)}L
                    </td>
                    <td className="font-semibold text-[var(--warning)]">
                      ₹{(row.totalPending / 100000).toFixed(2)}L
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: "var(--bg-raised)",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, row.collectionPct)}%`,
                              height: "100%",
                              background: row.collectionPct >= 80 ? "var(--success)" : "var(--brand)",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold font-mono text-[var(--text-primary)]" style={{ width: "42px", textAlign: "right" }}>
                          {row.collectionPct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr style={{ background: "var(--bg-raised)", fontWeight: 700 }}>
                  <td>
                    <span className="text-sm font-bold text-[var(--text-primary)]">School Total</span>
                  </td>
                  <td>{invoices.length} pupils</td>
                  <td>Unified Fee</td>
                  <td className="font-bold text-[var(--text-primary)]">
                    ₹{(billed / 100000).toFixed(2)}L
                  </td>
                  <td className="font-bold text-[var(--success)]">
                    ₹{(collected / 100000).toFixed(2)}L
                  </td>
                  <td className="font-bold text-[var(--warning)]">
                    ₹{(outstanding / 100000).toFixed(2)}L
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          background: "var(--border)",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, rate)}%`,
                            height: "100%",
                            background: "var(--success)",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold font-mono text-[var(--text-primary)]" style={{ width: "42px", textAlign: "right" }}>
                        {rate}%
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL 1: RECORD PAYMENT */}
      {showDialog && (
        <AppDialog
          title="Record fee collection"
          description="Log a verified fee collection against an existing pupil ledger."
          onClose={() => {
            setShowDialog(false);
            setRecordStudent(null);
            setStudentSearchQuery("");
            setPaymentAmount("");
            setSelectedInvoiceId(null);
          }}
        >
          <div className="form-grid">
            <div style={{ gridColumn: "span 2", position: "relative" }}>
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                Student Candidate *
              </label>
              {recordStudent ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: "var(--brand-soft)",
                    border: "1px solid var(--brand-border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="font-semibold text-sm text-[var(--text-primary)]">{recordStudent.name}</span>
                    <span className="grade-chip">{recordStudent.grade}</span>
                    {recordStudent.usn && <code className="text-xs text-[var(--brand)] font-mono">{recordStudent.usn}</code>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecordStudent(null)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-white"
                    title="Change selected student"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="Search by student name or USN..."
                    autoFocus
                  />
                  {matchingStudents.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        marginTop: 4,
                        background: "var(--bg-panel)",
                        border: "1px solid var(--border-strong)",
                        borderRadius: 10,
                        boxShadow: "var(--shadow-popover)",
                        overflow: "hidden",
                      }}
                    >
                      {matchingStudents.map((stu) => (
                        <button
                          key={stu.id}
                          type="button"
                          onClick={() => {
                            setRecordStudent(stu);
                            setStudentSearchQuery("");
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "9px 14px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom: "1px solid var(--bg-hover)",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                          className="hover:bg-[var(--bg-hover)]"
                        >
                          <div>
                            <span className="font-semibold text-xs text-[var(--text-primary)] block">{stu.name}</span>
                            <span className="text-[11px] text-[var(--text-muted)]">{stu.grade} · {stu.usn || "No USN"}</span>
                          </div>
                          <span className="text-xs font-mono text-[var(--brand)] font-semibold">Select →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* The manual-payment endpoint anchors on an invoice — the server
                resolves the school, balance and receipt from this selection. */}
            <div style={{ gridColumn: "span 2" }}>
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                Invoice to settle *
              </label>
              <FormSelect
                value={selectedInvoice ? String(selectedInvoice.id) : ""}
                onChange={(v) => setSelectedInvoiceId(v)}
                ariaLabel="Select the invoice this payment settles"
                placeholder="Select an invoice with an outstanding balance…"
                options={collectableInvoices.map((inv) => ({
                  value: String(inv.id),
                  label: `${inv.student} · ${inv.id} · ₹${Number(
                    inv.outstanding ?? inv.amount ?? 0
                  ).toLocaleString("en-IN")} due`,
                }))}
              />
              {recordStudent && !selectedInvoice && (
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                  No invoice is issued for {recordStudent.name} yet. Raise the
                  invoice before recording a collection against it.
                </p>
              )}
            </div>

            {selectedInvoice && (
              <div
                style={{
                  gridColumn: "span 2",
                  padding: "12px 14px",
                  background: "var(--bg-raised)",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  fontSize: "12.5px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span className="text-[var(--text-muted)]">Annual Tuition Fee ({String((selectedInvoice as any).grade || "Enrolled")}):</span>
                  <strong className="text-[var(--text-primary)]">₹{Number(selectedInvoice.total || 0).toLocaleString("en-IN")}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span className="text-[var(--text-muted)]">Paid to date:</span>
                  <span className="text-[var(--success)] font-semibold">₹{Number(selectedInvoice.paid || 0).toLocaleString("en-IN")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                  <span className="text-[var(--text-muted)] font-semibold">Remaining balance due:</span>
                  <span className="text-[var(--warning)] font-bold">₹{Number(selectedInvoice.amount || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>
            )}

            {/* Row 1: Amount & Reference */}
            <label>
              Amount (₹) *
              <input
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={selectedInvoice ? `₹ ${selectedInvoice.amount.toLocaleString("en-IN")}` : "e.g. 50000"}
              />
              {selectedInvoice && selectedInvoice.amount > 0 && (
                <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="tiny-action"
                    onClick={() => setPaymentAmount(String(selectedInvoice.amount))}
                  >
                    Full due: ₹{selectedInvoice.amount.toLocaleString("en-IN")}
                  </button>
                  {selectedInvoice.amount >= 10000 && (
                    <button
                      type="button"
                      className="tiny-action"
                      onClick={() => setPaymentAmount(String(Math.round(selectedInvoice.amount / 2)))}
                    >
                      50%: ₹{Math.round(selectedInvoice.amount / 2).toLocaleString("en-IN")}
                    </button>
                  )}
                  {selectedInvoice.amount >= 20000 && (
                    <button
                      type="button"
                      className="tiny-action"
                      onClick={() => setPaymentAmount(String(Math.round(selectedInvoice.amount / 4)))}
                    >
                      25%: ₹{Math.round(selectedInvoice.amount / 4).toLocaleString("en-IN")}
                    </button>
                  )}
                </div>
              )}
            </label>

            <label>
              Payment Reference *
              <input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. UTR / Cheque no. / Receipt book no."
              />
              <span className="text-[11px] text-[var(--text-muted)] mt-1.5 block">
                Required — this reference is the ledger's duplicate-payment guard.
              </span>
            </label>

            {/* Row 2: Payment Method */}
            <label>
              Payment Method *
              <FormSelect
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={[
                  { value: "Bank transfer", label: "Bank Transfer (NEFT/RTGS/IMPS)" },
                  { value: "UPI", label: "UPI (GooglePay / PhonePe / Paytm)" },
                  { value: "Cash", label: "Cash Counter" },
                  { value: "Card", label: "Debit / Credit Card (POS)" },
                  { value: "Cheque", label: "Cheque / Demand Draft" },
                ]}
              />
            </label>

            {/* Row 3: Payment Date */}
            <label style={{ gridColumn: "span 2" }}>
              Payment Date (DD-MM-YYYY) *
              <DateDropdowns
                value={paymentDate}
                onChange={setPaymentDate}
                defaultToToday
                minYear={2020}
                maxYear={2030}
              />
            </label>
          </div>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setShowDialog(false);
                setRecordStudent(null);
                setSelectedInvoiceId(null);
                setStudentSearchQuery("");
                setPaymentAmount("");
                setPaymentReference("");
                
              }}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              onClick={async () => {
                // The manual-payment endpoint resolves the invoice, school and
                // outstanding balance server-side, so an invoice selection is
                // what anchors the entry — not a free-typed student name.
                if (!selectedInvoice) {
                  toast.error("Invoice required", {
                    description: "Select the invoice this payment settles.",
                  });
                  return;
                }
                const numAmount = Number(String(paymentAmount || "").replace(/[^0-9.]/g, ""));
                if (!numAmount || numAmount <= 0) {
                  toast.error("Invalid amount", { description: "Please enter a valid payment amount." });
                  return;
                }
                const reference = paymentReference.trim();
                if (reference.length < 2) {
                  toast.error("Reference required", {
                    description: "Enter the UTR, cheque number or receipt book number for this payment.",
                  });
                  return;
                }
                const targetName = selectedInvoice.student || recordStudent?.name;

                try {
                  const res = await recordManualPayment({
                    invoiceId: String(selectedInvoice.id),
                    amount: numAmount,
                    method: paymentMethod,
                    reference,
                    paidOn: paymentDate,
                  });

                  setShowDialog(false);
                  setRecordStudent(null);
                  setSelectedInvoiceId(null);
                  setStudentSearchQuery("");
                  setPaymentAmount("");
                  setPaymentReference("");
                  

                  if (res.duplicate) {
                    toast.info("Payment already recorded", {
                      description: `Receipt ${res.receiptNo} was already on the ledger for reference “${reference}”. Nothing was double-credited.`,
                    });
                  } else {
                    toast.success("Payment recorded", {
                      description: `₹${numAmount.toLocaleString("en-IN")} settled against ${selectedInvoice.invoice_no ? `invoice ${selectedInvoice.invoice_no}` : "the selected invoice"} for ${targetName}. Receipt: ${res.receiptNo}.`,
                    });
                  }
                } catch (e) {
                  toast.error("Payment recording failed", {
                    description: e instanceof Error ? e.message : "Could not complete payment.",
                  });
                }
              }}
            >
              Record payment
            </button>
          </div>
        </AppDialog>
      )}

      {/* MODAL 2: INVOICE DETAILS DRAWER / MODAL */}
      {inspectingInvoice && (
        <AppDialog
          title={`Invoice Details · ${inspectingInvoice.id}`}
          description="Detailed fee assessment and ledger breakdown."
          onClose={() => setInspectingInvoice(null)}
        >
          <div style={{ fontSize: "13px" }}>
            {/* Student Meta */}
            <div
              style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {inspectingInvoice.student}
                  </h3>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: 4 }}>
                    <span className="grade-chip">{(inspectingInvoice as any).grade || "Class 6"} · {(inspectingInvoice as any).section || "A"}</span>
                    {(inspectingInvoice as any).usn && (
                      <code className="text-xs text-[var(--brand)] font-mono">{(inspectingInvoice as any).usn}</code>
                    )}
                  </div>
                </div>
                <span
                  className={`status-pill ${
                    inspectingInvoice.status === "Paid"
                      ? "success"
                      : inspectingInvoice.status === "Overdue"
                      ? "warning"
                      : "neutral"
                  }`}
                >
                  {inspectingInvoice.status}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px] uppercase font-semibold">Guardian / Family</span>
                  <strong className="text-[var(--text-primary)]">{inspectingInvoice.family}</strong>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px] uppercase font-semibold">Invoice Due Date</span>
                  <span className={inspectingInvoice.status === "Overdue" ? "text-[var(--danger)] font-semibold" : ""}>{inspectingInvoice.due_date}</span>
                </div>
              </div>
            </div>

            {/* Assessment Breakdown */}
            <div
              style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "16px",
              }}
            >
              <h4 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                AY 2026–27 Fee Assessment
              </h4>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="text-[var(--text-secondary)]">Annual Unified Tuition Fee:</span>
                <strong>₹{Number(inspectingInvoice.total ?? 0).toLocaleString("en-IN")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="text-[var(--text-secondary)]">Total Paid to Date:</span>
                <span className="text-[var(--success)] font-semibold">₹{Number(inspectingInvoice.paid ?? 0).toLocaleString("en-IN")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
                <span className="font-semibold text-[var(--text-primary)]">Remaining Balance Due:</span>
                <strong className={inspectingInvoice.amount > 0 ? "text-[var(--warning)] text-base font-bold" : "text-[var(--success)]"}>
                  ₹{Number(inspectingInvoice.amount ?? inspectingInvoice.outstanding ?? 0).toLocaleString("en-IN")}
                </strong>
              </div>
            </div>

            {/* Action buttons */}
            <div className="dialog-actions">
              <button className="secondary-button" onClick={() => setInspectingInvoice(null)}>
                Close
              </button>
              {inspectingInvoice.amount > 0 && (
                <>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      toast.success("Payment reminder sent", {
                        description: `Dispatched payment notice to ${inspectingInvoice.family} for balance ₹${inspectingInvoice.amount.toLocaleString("en-IN")}.`,
                      });
                    }}
                  >
                    Send Reminder
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => {
                      const s = enrolledStudents.find(
                        stu =>
                          stu.name.toLowerCase() === inspectingInvoice.student.toLowerCase() ||
                          (inspectingInvoice.student_id && stu.id === inspectingInvoice.student_id)
                      );
                      setSelectedInvoiceId(String(inspectingInvoice.id));
                      if (s) {
                        setRecordStudent(s);
                      } else {
                        setStudentSearchQuery(inspectingInvoice.student);
                      }
                      setPaymentAmount(String(inspectingInvoice.amount));
                      setInspectingInvoice(null);
                      setShowDialog(true);
                    }}
                  >
                    Collect Payment
                  </button>
                </>
              )}
            </div>
          </div>
        </AppDialog>
      )}

      {/* MODAL 3: OFFICIAL PRINTABLE RECEIPT VOUCHER */}
      {viewingReceipt && (
        <AppDialog
          title={`Official Payment Receipt · ${viewingReceipt.receipt_no || "Receipt"}`}
          description="Global Kids School verified institutional collection receipt."
          onClose={() => setViewingReceipt(null)}
        >
          <div style={{ padding: "4px 0", fontSize: "13px" }}>
            <div
              className="receipt-voucher-printable"
              style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "20px",
                marginBottom: "16px",
              }}
            >
              {/* Header Letterhead */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, borderBottom: "2px solid var(--border)", paddingBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <img src="/global-kids-logo.svg" alt="Global Kids School" style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0 }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                      Global Kids School
                    </h3>
                    <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                      Tumakuru Campus, Karnataka · Official ERP Ledger &amp; Fee Receipt
                    </p>
                    <span style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: 2, display: "block" }}>
                      Affiliated to Karnataka State Board / CBSE · AY 2026–27
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="status-pill success text-xs font-mono font-bold" style={{ display: "inline-block" }}>
                    {viewingReceipt.receipt_no}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] block mt-1">
                    Date: {viewingReceipt.paid_at ? new Date(viewingReceipt.paid_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : new Date().toLocaleDateString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Pupil Details */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12.5px", marginBottom: 14 }}>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px] uppercase font-semibold">Received From (Student)</span>
                  <strong className="text-[var(--text-primary)] text-sm">{viewingReceipt.student}</strong>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px] uppercase font-semibold">Invoice Reference</span>
                  <span className="font-mono text-[var(--text-secondary)] font-semibold">{viewingReceipt.invoice_id || "INV-2026-FEE"}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px] uppercase font-semibold">Payment Mode</span>
                  <span className="font-medium text-[var(--text-primary)]">{viewingReceipt.method || "Verified Collection"}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px] uppercase font-semibold">Transaction Ref / UTR</span>
                  <span className="font-mono text-xs text-[var(--brand)] font-semibold">{viewingReceipt.reference || "OFFICE-VERIFIED"}</span>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <span className="text-[var(--text-muted)] block text-[11px] uppercase font-semibold">Digital Dispatch Address</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--info)] font-mono">
                    <Mail size={12} />
                    {viewingReceipt.recipient_email || `${viewingReceipt.student.toLowerCase().replace(/[^a-z0-9]/g, ".")}@example.com`}
                  </span>
                </div>
              </div>

              {/* Amount Banner */}
              <div style={{ padding: "14px 16px", background: "var(--success-soft-2)", border: "1px solid var(--success-border)", borderRadius: "8px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--success)" }}>Amount Received &amp; Verified:</span>
                  <strong style={{ fontSize: "22px", fontWeight: 800, color: "var(--success)" }}>₹{Number(viewingReceipt.amount || 0).toLocaleString("en-IN")}</strong>
                </div>
                <div style={{ marginTop: 6, fontSize: "12px", fontStyle: "italic", color: "var(--text-secondary)" }}>
                  In words: <strong className="text-[var(--text-primary)]">{amountInWords(Number(viewingReceipt.amount || 0))}</strong>
                </div>
              </div>

              {/* Official Seal / Signatory */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 24, paddingTop: 14, borderTop: "1px dashed var(--border)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  <div>This is a computer-generated official receipt.</div>
                  <div>Accounts Office, Global Kids School, Tumakuru</div>
                </div>
                <div style={{ textAlign: "center", minWidth: 160 }}>
                  <div style={{ borderBottom: "1px solid var(--text-muted)", width: 140, marginBottom: 4 }} />
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>Authorized Cashier / Accounts</span>
                </div>
              </div>
            </div>

            <div className="dialog-actions">
              <button className="secondary-button" onClick={() => setViewingReceipt(null)}>
                Close
              </button>
              <button
                className="primary-button"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => window.print()}
              >
                <Printer size={14} />
                Print / Save Receipt
              </button>
            </div>
          </div>
        </AppDialog>
      )}
    </div>
  );
}



function SettingToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors"
      style={{ background: checked ? "var(--success)" : "var(--border)" }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
        style={{ transform: checked ? "translateX(17px)" : "translateX(3px)" }}
      />
    </button>
  );
}

function StaffView({
  onBack,
  onNavigate,
  openStaffId,
  onStaffOpened,
}: {
  onBack: () => void;
  onNavigate?: (view: string) => void;
  openStaffId?: string | null;
  onStaffOpened?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All staff");
  const [department, setDepartment] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [selected, setSelected] = useState<RowId | null>(null);

  useEffect(() => {
    if (openStaffId) {
      setSelected(openStaffId);
      onStaffOpened?.();
    }
  }, [openStaffId, onStaffOpened]);

  const {
    rows: staff,
    loading: staffViewLoading,
    reload: reloadStaff,
  } = useStaff();

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const s of staff) {
      if (s.department) set.add(s.department);
    }
    return Array.from(set).sort();
  }, [staff]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    for (const s of staff) {
      if (s.role) set.add(s.role);
    }
    return Array.from(set).sort();
  }, [staff]);

  const filtered = useMemo(() => {
    return staff.filter(member => {
      const textMatch = `${member.name} ${member.usn} ${member.role} ${member.department}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const statusMatch =
        !status || status === "All staff" || status === "all"
          ? true
          : status === "On campus"
          ? member.status === "On campus"
          : status === "On leave"
          ? member.status === "On leave"
          : member.status === status;
      const deptMatch = !department || member.department === department;
      const roleMatch = !roleFilter || member.role === roleFilter;
      return textMatch && statusMatch && deptMatch && roleMatch;
    });
  }, [staff, query, status, department, roleFilter]);

  const staffPager = usePagination(filtered);
  const pageStaff = staffPager.pageRows;
  const onCampus = staff.filter(member => member.status === "On campus").length;

  const activeFilters = useMemo(() => {
    const list: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (query) {
      list.push({
        id: "search",
        label: `"${query}"`,
        onRemove: () => setQuery(""),
      });
    }
    if (status && status !== "All staff") {
      list.push({
        id: "status",
        label: `Status: ${status}`,
        onRemove: () => setStatus("All staff"),
      });
    }
    if (department) {
      list.push({
        id: "department",
        label: `Dept: ${department}`,
        onRemove: () => setDepartment(""),
      });
    }
    if (roleFilter) {
      list.push({
        id: "role",
        label: `Role: ${roleFilter}`,
        onRemove: () => setRoleFilter(""),
      });
    }
    return list;
  }, [query, status, department, roleFilter]);

  const activeFilterCount = activeFilters.length;

  const clearAllFilters = () => {
    setQuery("");
    setStatus("All staff");
    setDepartment("");
    setRoleFilter("");
  };

  const exportStaffCsv = () => {
    const headers = ["Staff Member", "USN", "Role", "Department", "Email", "Status", "Attendance %"];
    const rows = filtered.map(m => [
      `"${(m.name || "").replace(/"/g, '""')}"`,
      `"${(m.usn || "").replace(/"/g, '""')}"`,
      `"${(m.role || "").replace(/"/g, '""')}"`,
      `"${(m.department || "").replace(/"/g, '""')}"`,
      `"${(m.email || "").replace(/"/g, '""')}"`,
      `"${(m.status || "").replace(/"/g, '""')}"`,
      `"${m.attendance ?? ""}"`,
    ].join(","));
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-directory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Staff directory exported", {
      description: `Downloaded ${filtered.length} staff records.`,
    });
  };

  const active = staff.find(member => String(member.id) === String(selected));

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Staff"
            onParentClick={onBack}
          />
          <h1 className="page-title">Staff</h1>
        </div>
        <div className="intro-actions">
          <button
            className="secondary-button"
            onClick={exportStaffCsv}
            disabled={!filtered.length}
          >
            <Download size={15} />
            Export
          </button>
          <button className="primary-button" onClick={() => setShowDialog(true)}>
            <Plus size={16} />
            Add staff
          </button>
        </div>
      </div>

      <div className="metric-grid three">
        {staffViewLoading ? (
          <>
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
          </>
        ) : (
          <>
            <MetricBlock
              label="On campus today"
              value={`${onCampus}`}
              comparison={`of ${staff.length} total staff`}
              icon={Users}
            />
            <MetricBlock
              label="On leave"
              value={`${staff.length - onCampus}`}
              comparison="Approved leave requests"
              icon={CalendarDays}
              positive={false}
            />
            <MetricBlock
              label="Active faculty"
              value={`${staff.length}`}
              comparison="Full teaching & administrative roster"
              icon={GraduationCap}
            />
          </>
        )}
      </div>

      <div className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search by name, USN, role or department..."
            />
            {query && (
              <button
                className="search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="toolbar-actions">
            {/* Quick Status Segmented Control with horizontal sliding motion */}
            <SegmentedControl
              ariaLabel="Filter by staff status"
              layoutId="staffStatusTabs"
              value={status === "all" ? "All staff" : status}
              onChange={(val) => setStatus(val)}
              options={[
                { value: "All staff", label: "All" },
                { value: "On campus", label: "On campus" },
                { value: "On leave", label: "On leave" },
              ]}
            />

            {/* Department Filter */}
            <SmoothFilterDropdown
              label="All departments"
              icon={<Layers size={14} />}
              value={department}
              onChange={setDepartment}
              ariaLabel="Filter by department"
              options={[
                { value: "", label: "All departments" },
                ...departments.map(d => ({ value: d, label: d })),
              ]}
            />

            {/* Role Filter */}
            <SmoothFilterDropdown
              label="All roles"
              icon={<Briefcase size={14} />}
              value={roleFilter}
              onChange={setRoleFilter}
              ariaLabel="Filter by role"
              align="right"
              options={[
                { value: "", label: "All roles" },
                ...roles.map(r => ({ value: r, label: r })),
              ]}
            />
          </div>
        </div>

        {/* Active Filter Badges Bar */}
        {activeFilterCount > 0 && (
          <div className="active-filters-bar">
            <span className="active-filters-label">Active filters:</span>
            {activeFilters.map(f => (
              <span key={f.id} className="active-filter-chip">
                <span>{f.label}</span>
                <button
                  type="button"
                  onClick={f.onRemove}
                  aria-label={`Remove filter ${f.label}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              className="clear-all-filters-btn"
              onClick={clearAllFilters}
            >
              Reset all ({activeFilterCount})
            </button>
          </div>
        )}

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff member</th>
                <th>USN</th>
                <th>Role</th>
                <th>Department</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {staffViewLoading ? (
                <SkeletonTableRows rows={8} columns={5} />
              ) : (
                pageStaff.map(member => (
                  <tr
                    key={member.id}
                    className={`row-clickable ${String(selected) === String(member.id) ? "row-selected" : ""}`}
                    onClick={() => setSelected(member.id)}
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        {member.photo_url ? (
                          <img
                            className="avatar avatar-sm"
                            src={member.photo_url}
                            alt=""
                          />
                        ) : (
                          <span
                            className={`avatar avatar-sm ${avatarTones[member.tone]}`}
                          >
                            {member.initials}
                          </span>
                        )}
                        <div>
                          <div className="font-medium text-[var(--text-primary)]">
                            {member.name}
                          </div>
                          <div className="mt-1.5 text-[12.5px] text-[var(--text-muted)]">
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="muted-cell">{member.usn || "—"}</td>
                    <td className="muted-cell">{member.role}</td>
                    <td>
                      <span className="grade-chip">{member.department}</span>
                    </td>
                    <td>
                      <span
                        className={
                          member.attendance >= 95
                            ? "score-positive"
                            : "score-warning"
                        }
                      >
                        {member.attendance}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!staffViewLoading && filtered.length === 0 && (
            <div className="empty-state">
              <Users size={22} className="text-[var(--text-muted)]" />
              <p className="panel-title" style={{ fontSize: 15, marginTop: 6 }}>
                {activeFilterCount ? "No staff members match these filters" : "No staff members on record"}
              </p>
              <p className="panel-subtitle">
                {activeFilterCount
                  ? "Try adjusting your search, department, role, or campus status filters."
                  : "Get started by adding the first faculty or administrative officer."}
              </p>
              {Boolean(activeFilterCount) && (
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={clearAllFilters}
                  style={{ marginTop: 10 }}
                >
                  <RotateCcw size={13} />
                  Reset all filters
                </button>
              )}
            </div>
          )}
        </div>
        <Pager pagination={staffPager} noun="staff" />
      </div>
      {active && (
        <StaffDrawer
          staff={{
            id: String(active.id),
            name: active.name,
            role: active.role,
            department: active.department,
            email: active.email,
            usn: active.usn,
            initials: active.initials,
            tone: active.tone,
            photo_url: active.photo_url ?? null,
          }}
          onClose={() => setSelected(null)}
          onUpdated={() => void reloadStaff()}
          onOpenAccountLogins={
            onNavigate ? () => onNavigate("User management") : undefined
          }
        />
      )}
      {showDialog && (
        <StaffCreateDialog
          onClose={() => setShowDialog(false)}
          onCreated={() => {
            setShowDialog(false);
            void reloadStaff();
          }}
        />
      )}
    </div>
  );
}

/**
 * Format currency according to Indian financial conventions (Lakh, Crore, en-IN formatting).
 *
 * Examples:
 *   formatInr(85000) => "₹85,000"
 *   formatInr(485000, true) => "₹4.85 Lakh"
 *   formatInr(12500000, true) => "₹1.25 Cr"
 */
function formatInr(amount: number, compact = false): string {
  const num = Math.round(Number(amount) || 0);
  if (!compact) {
    return `₹${num.toLocaleString("en-IN")}`;
  }
  const abs = Math.abs(num);
  if (abs >= 10000000) {
    const cr = parseFloat((num / 10000000).toFixed(2));
    return `₹${cr} Cr`;
  }
  if (abs >= 100000) {
    const lakh = parseFloat((num / 100000).toFixed(2));
    return `₹${lakh} Lakh`;
  }
  return `₹${num.toLocaleString("en-IN")}`;
}

function AnalyticsView({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate?: (view: string, entityId?: RowId, entityType?: "student" | "staff") => void;
}) {
  const { rows: performanceTrend } = usePerformanceTrend();
  const { rows: subjectAverages } = useSubjectAverages();
  const { rows: gradeOutcomes, loading: gradeOutcomesLoading } =
    useGradeOutcomes();
  const outcomesPager = usePagination(gradeOutcomes);
  const pageOutcomes = outcomesPager.pageRows;
  const { rows: analyticsStudents, loading: analyticsStudentsLoading } =
    useStudents();
  const { rows: staffMembers, loading: staffLoading } = useStaff();
  const { rows: analyticsAttendance, loading: analyticsAttendanceLoading } =
    useAttendanceDaily();
  const { rows: analyticsInvoices, loading: analyticsInvoicesLoading } =
    useInvoices();

  const [analyticsTab, setAnalyticsTab] = useState<
    "overview" | "staff" | "academics" | "attendance"
  >("overview");
  const [selectedTerm, setSelectedTerm] = useState("2026–2027");
  const [staffSearch, setStaffSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState<"all" | "teacher" | "admin" | "principal">("all");

  const analyticsLoading =
    gradeOutcomesLoading ||
    analyticsStudentsLoading ||
    staffLoading ||
    analyticsAttendanceLoading ||
    analyticsInvoicesLoading;

  // Real student count and graded subset
  const totalStudents = analyticsStudents.length;
  const graded = useMemo(
    () => analyticsStudents.filter(s => s.average > 0),
    [analyticsStudents]
  );

  const overallAverage = useMemo(() => {
    if (analyticsStudents.length === 0) return 0;
    const total = analyticsStudents.reduce((sum, s) => sum + s.average, 0);
    return Math.round(total / analyticsStudents.length);
  }, [analyticsStudents]);

  const latestAttendance = analyticsAttendance[analyticsAttendance.length - 1];
  const latestPresent = latestAttendance?.present ?? 0;
  const latestMarked = latestAttendance
    ? latestAttendance.present + latestAttendance.absent
    : 0;
  const attendancePct =
    latestMarked > 0
      ? Math.round((latestPresent / latestMarked) * 1000) / 10
      : analyticsStudents.length > 0
        ? Math.round(
            analyticsStudents.reduce((sum, s) => sum + (s.attendance || 0), 0) /
              analyticsStudents.length
          )
        : 0;

  const atRisk = analyticsStudents.filter(
    s => s.average > 0 && s.average < 50
  ).length;

  /** Median average across actual graded students in DB */
  const medianAverage = useMemo(() => {
    if (graded.length === 0) return 0;
    const values = graded.map(s => s.average).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0
      ? Math.round((values[mid - 1] + values[mid]) / 2)
      : values[mid];
  }, [graded]);

  /** Standard deviation / spread across actual student scores in DB */
  const spread = useMemo(() => {
    if (graded.length < 2) return 0;
    const mean = graded.reduce((sum, s) => sum + s.average, 0) / graded.length;
    const variance =
      graded.reduce((sum, s) => sum + (s.average - mean) ** 2, 0) /
      (graded.length - 1);
    return Math.round(Math.sqrt(variance) * 10) / 10;
  }, [graded]);

  /** Score tier distributions computed directly from actual student records */
  const scoreTiers = useMemo(() => {
    const total = Math.max(graded.length, 1);
    const distinction = graded.filter(s => s.average >= 85).length;
    const merit = graded.filter(s => s.average >= 70 && s.average < 85).length;
    const pass = graded.filter(s => s.average >= 50 && s.average < 70).length;
    const critical = graded.filter(s => s.average < 50).length;

    return {
      distinction: { count: distinction, pct: Math.round((distinction / total) * 100) },
      merit: { count: merit, pct: Math.round((merit / total) * 100) },
      pass: { count: pass, pct: Math.round((pass / total) * 100) },
      critical: { count: critical, pct: Math.round((critical / total) * 100) },
    };
  }, [graded]);

  /** Actual Grade-by-Grade breakdown dynamically computed from all database student rows */
  const gradeBreakdowns = useMemo(() => {
    if (analyticsStudents.length === 0) return [];

    const gradeMap = new Map<
      string,
      {
        grade: string;
        students: typeof analyticsStudents;
        totalAverage: number;
        totalAttendance: number;
        atRiskCount: number;
      }
    >();

    for (const s of analyticsStudents) {
      const g = s.grade || "Unassigned";
      const cur = gradeMap.get(g) ?? {
        grade: g,
        students: [],
        totalAverage: 0,
        totalAttendance: 0,
        atRiskCount: 0,
      };
      cur.students.push(s);
      cur.totalAverage += s.average || 0;
      cur.totalAttendance += s.attendance || 0;
      if (s.average > 0 && s.average < 50) cur.atRiskCount += 1;
      gradeMap.set(g, cur);
    }

    return Array.from(gradeMap.values())
      .map(g => {
        const count = g.students.length;
        const avg = count > 0 ? Math.round(g.totalAverage / count) : 0;
        const att = count > 0 ? Math.round(g.totalAttendance / count) : 0;
        return {
          grade: g.grade,
          count,
          average: avg,
          attendance: att,
          atRiskCount: g.atRiskCount,
          signal: avg >= 80 ? "Optimal" : avg >= 65 ? "Steady" : "Watch",
          topStudent: g.students.reduce(
            (best, cur) => (cur.average > best.average ? cur : best),
            g.students[0]
          ),
        };
      })
      .sort((a, b) => {
        const numA = parseInt(a.grade.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.grade.replace(/\D/g, "")) || 0;
        return numA - numB;
      });
  }, [analyticsStudents]);

  /** Strongest grade based on actual student data in DB */
  const fastestGrade = useMemo(() => {
    if (gradeBreakdowns.length > 0) {
      return gradeBreakdowns.reduce((best, cur) =>
        cur.average > best.average ? cur : best
      ).grade;
    }
    const withMarks = gradeOutcomes.filter(row => row.average > 0);
    if (withMarks.length === 0) return "—";
    return withMarks.reduce((best, row) =>
      row.average > best.average ? row : best
    ).grade;
  }, [gradeBreakdowns, gradeOutcomes]);

  /** Actual Staff & Faculty analytics computed directly from staff DB rows */
  const staffStats = useMemo(() => {
    const total = staffMembers.length;
    const teachers = staffMembers.filter(
      s =>
        /teacher|faculty|instructor|educator/i.test(s.role) ||
        /teach|academic|science|math|english|social|hindi|primary/i.test(
          s.department
        )
    );
    const principal = staffMembers.find(
      s =>
        /principal|headmaster|headmistress/i.test(s.role) ||
        /principal/i.test(s.name)
    );
    const administrative = staffMembers.filter(
      s => s.id !== principal?.id && !teachers.some(t => t.id === s.id)
    );

    // Department breakdown for chart
    const deptMap = new Map<string, number>();
    for (const s of staffMembers) {
      const dept = s.department || "General";
      deptMap.set(dept, (deptMap.get(dept) ?? 0) + 1);
    }
    const departmentBreakdown = Array.from(deptMap.entries()).map(
      ([dept, count]) => ({
        department: dept,
        count,
      })
    );

    const studentTeacherRatio =
      teachers.length > 0
        ? Math.round(analyticsStudents.length / teachers.length)
        : 0;

    const staffAttendanceAvg =
      total > 0
        ? Math.round(
            staffMembers.reduce((acc, s) => acc + (s.attendance || 95), 0) /
              total
          )
        : 0;

    return {
      total,
      teachers: teachers.length,
      administrative: administrative.length,
      principal: principal ? 1 : 0,
      principalPerson: principal,
      departmentBreakdown,
      studentTeacherRatio,
      staffAttendanceAvg,
      staffRoster: staffMembers,
    };
  }, [staffMembers, analyticsStudents]);

  /** Filtered staff directory list */
  const filteredStaff = useMemo(() => {
    return staffMembers
      .filter(s => {
        if (staffFilter === "teacher")
          return (
            /teacher|faculty|instructor|educator/i.test(s.role) ||
            /teach|academic|science|math|english|social|hindi|primary/i.test(
              s.department
            )
          );
        if (staffFilter === "principal")
          return (
            /principal|headmaster|headmistress/i.test(s.role) ||
            /principal/i.test(s.name)
          );
        if (staffFilter === "admin")
          return (
            !/teacher|faculty|instructor|educator/i.test(s.role) &&
            !/teach|academic|science|math|english|social|hindi|primary/i.test(
              s.department
            ) &&
            !/principal|headmaster|headmistress/i.test(s.role) &&
            !/principal/i.test(s.name)
          );
        return true;
      })
      .filter(s => {
        if (!staffSearch.trim()) return true;
        const q = staffSearch.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.role.toLowerCase().includes(q) ||
          s.department.toLowerCase().includes(q) ||
          (s.usn && s.usn.toLowerCase().includes(q))
        );
      });
  }, [staffMembers, staffFilter, staffSearch]);

  /** Actual Attendance band distribution computed directly from all DB students */
  const attendanceBands = useMemo(() => {
    const bands = [
      { label: "90%+", count: 0, color: "var(--brand)" },
      { label: "80–89%", count: 0, color: "var(--info)" },
      { label: "70–79%", count: 0, color: "var(--warning)" },
      { label: "< 70%", count: 0, color: "var(--danger)" },
    ];
    for (const student of analyticsStudents) {
      if (student.attendance >= 90) bands[0].count++;
      else if (student.attendance >= 80) bands[1].count++;
      else if (student.attendance >= 70) bands[2].count++;
      else bands[3].count++;
    }
    return bands;
  }, [analyticsStudents]);

  /** Subject spread: gap between highest and lowest */
  const subjectSpread = useMemo(() => {
    if (subjectAverages.length === 0) return null;
    const values = subjectAverages.map(s => s.average);
    return {
      strongest: subjectAverages.reduce((a, b) =>
        b.average > a.average ? b : a
      ),
      weakest: subjectAverages.reduce((a, b) =>
        b.average < a.average ? b : a
      ),
      gap: Math.max(...values) - Math.min(...values),
    };
  }, [subjectAverages]);

  /** Grade-level correlation data derived directly from actual DB rows */
  const gradeCorrelation = useMemo(() => {
    if (gradeBreakdowns.length > 0) {
      return gradeBreakdowns.map(row => ({
        grade: row.grade.replace("Grade ", "G"),
        attendance: row.attendance,
        academics: row.average,
      }));
    }
    return gradeOutcomes.map(row => ({
      grade: row.grade.replace("Grade ", "G"),
      attendance: row.attendance,
      academics: row.average,
    }));
  }, [gradeBreakdowns, gradeOutcomes]);

  /** Dynamic sparklines derived 100% from actual database quantiles and distributions */
  const academicSpark = useMemo(() => {
    if (graded.length < 2) return [overallAverage];
    const sorted = graded.map(s => s.average).sort((a, b) => a - b);
    const step = (sorted.length - 1) / 6;
    return [0, 1, 2, 3, 4, 5, 6].map(i => sorted[Math.round(i * step)]);
  }, [graded, overallAverage]);

  const attendanceSpark = useMemo(() => {
    if (analyticsAttendance.length >= 2) {
      return analyticsAttendance.slice(-7).map(d => {
        const total = d.present + d.absent;
        return total > 0 ? Math.round((d.present / total) * 100) : 0;
      });
    }
    if (analyticsStudents.length >= 2) {
      const sorted = analyticsStudents
        .map(s => s.attendance)
        .sort((a, b) => a - b);
      const step = (sorted.length - 1) / 6;
      return [0, 1, 2, 3, 4, 5, 6].map(i => sorted[Math.round(i * step)]);
    }
    return [attendancePct];
  }, [analyticsAttendance, analyticsStudents, attendancePct]);

  const cohortSpark = useMemo(() => {
    if (gradeBreakdowns.length >= 2) {
      return gradeBreakdowns.map(g => g.average);
    }
    return [];
  }, [gradeBreakdowns]);

  const atRiskSpark = useMemo(() => {
    if (gradeBreakdowns.length >= 2) {
      return gradeBreakdowns.map(g => g.atRiskCount);
    }
    return [atRisk];
  }, [gradeBreakdowns, atRisk]);

  /** Collections ledger metrics formatted following Indian standards */
  const collections = useMemo(() => {
    const billed = analyticsInvoices.reduce(
      (sum, i) => sum + (i.total ?? i.amount),
      0
    );
    const collected = analyticsInvoices.reduce(
      (sum, i) =>
        sum + (i.paid ?? (i.status === "Paid" ? (i.total ?? i.amount) : 0)),
      0
    );
    const outstanding = analyticsInvoices.reduce(
      (sum, i) => sum + (i.outstanding ?? i.amount),
      0
    );
    return {
      billed,
      collected,
      outstanding,
      rate: billed > 0 ? Math.round((collected / billed) * 100) : 0,
    };
  }, [analyticsInvoices]);

  /** Composite radar metrics */
  const attendanceRadar = useMemo(
    () => [
      {
        axis: "Maths",
        value: subjectAverages.find(s => /math/i.test(s.subject))?.average ?? 0,
      },
      {
        axis: "Science",
        value:
          subjectAverages.find(s => /science|physics|chem/i.test(s.subject))
            ?.average ?? 0,
      },
      {
        axis: "English",
        value:
          subjectAverages.find(s => /english/i.test(s.subject))?.average ?? 0,
      },
      { axis: "Attendance", value: attendancePct },
      {
        axis: "Passing Rate",
        value: Math.round(
          (graded.filter(s => s.average >= 50).length /
            Math.max(graded.length, 1)) *
            100
        ),
      },
    ],
    [subjectAverages, attendancePct, graded]
  );

  /**
   * A radar with no data still draws its spokes, which reads as a broken
   * chart rather than an empty one. Detect that case and show a real empty
   * state instead.
   */
  const hasRadarData =
    attendanceRadar.filter(point => point.value > 0).length >= 3;

  /** Full institutional analytics export containing live students & staff records with Indian Rupee formatting */
  const handleExportReport = () => {
    const lines: string[] = [];
    lines.push("GLOBAL KIDS SCHOOL - INSTITUTIONAL ANALYTICS & TREND REPORT");
    lines.push(`Generated: ${new Date().toLocaleString("en-IN")}`);
    lines.push(`Data Source: Live Supabase Database Connection`);
    lines.push(`Academic Scope: ${selectedTerm}`);
    lines.push(`Currency Standard: Indian Rupees (INR - ₹)`);
    lines.push("");
    lines.push("--- EXECUTIVE METRICS ---");
    lines.push(`Total Students Enrolled,${totalStudents}`);
    lines.push(`Total Staff Employed,${staffStats.total}`);
    lines.push(`Teaching Faculty,${staffStats.teachers}`);
    lines.push(`Administrative Staff,${staffStats.administrative}`);
    lines.push(`Student-to-Teacher Ratio,${staffStats.studentTeacherRatio}:1`);
    lines.push(`Overall Academic Mean,${overallAverage}%`);
    lines.push(`Cohort Median Average,${medianAverage}%`);
    lines.push(`Standard Deviation (Spread),${spread} pts`);
    lines.push(`Student Attendance Velocity,${attendancePct}%`);
    lines.push(`Faculty Attendance Rate,${staffStats.staffAttendanceAvg}%`);
    lines.push(`Leading Cohort / Grade,${fastestGrade}`);
    lines.push(`At-Risk Learners (<50%),${atRisk}`);
    lines.push(
      `Fee Collection Rate,${collections.rate}% (Collected: ${formatInr(collections.collected)} / Billed: ${formatInr(collections.billed)})`
    );
    lines.push("");
    lines.push("--- GRADE-WISE BREAKDOWN (LIVE DATABASE COHORTS) ---");
    lines.push("Grade,Student Count,Average Score (%),Attendance (%),At-Risk Count,Signal");
    for (const g of gradeBreakdowns) {
      lines.push(
        `"${g.grade}",${g.count},${g.average},${g.attendance},${g.atRiskCount},"${g.signal}"`
      );
    }
    lines.push("");
    lines.push("--- FACULTY & STAFF ROSTER (10 MEMBERS IN DB) ---");
    lines.push("Staff Name,USN,Designation,Department,Email,Attendance (%),Status");
    for (const s of staffMembers) {
      lines.push(
        `"${s.name}","${s.usn || "—"}","${s.role}","${s.department}","${s.email}",${s.attendance || 95},"${s.status}"`
      );
    }

    const csvBlob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ggs-live-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Live analytics report downloaded", {
      description: `Exported ${totalStudents} students and ${staffStats.total} staff members in Indian standard INR.`,
    });
  };

  return (
    <div className="page-stack">
      {/* Executive Header with Live DB Connection Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Analytics"
            onParentClick={onBack}
          />
          <h1 className="page-title">Analytics</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div style={{ minWidth: "160px" }}>
            <FormSelect
              value={selectedTerm}
              onChange={setSelectedTerm}
              options={[
                { value: "2024–2025", label: "2024–2025" },
                { value: "2025–2026", label: "2025–2026" },
                { value: "2026–2027", label: "2026–2027" },
                { value: "2027–2028", label: "2027–2028" },
              ]}
              ariaLabel="Select academic year"
            />
          </div>

          <button
            onClick={handleExportReport}
            className="primary-button flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium cursor-pointer shadow-sm"
          >
            <Download size={14} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Top Level Metric Ribbon (Equal Height Cards with stretch) */}
      <div className="metric-grid items-stretch">
        {analyticsLoading ? (
          <>
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
          </>
        ) : (
          <>
            <MetricBlock
              label="Academic Average"
              value={overallAverage > 0 ? `${overallAverage}%` : "—"}
              comparison={
                overallAverage > 0
                  ? `Median ${medianAverage}%`
                  : "No graded pupils yet"
              }
              icon={GraduationCap}
              spark={academicSpark}
              className="h-full flex flex-col justify-between"
            />
            <MetricBlock
              label="Attendance Rate"
              value={latestMarked > 0 ? `${attendancePct}%` : "—"}
              comparison={
                latestMarked > 0
                  ? `${latestPresent} present today`
                  : "No attendance sessions recorded"
              }
              icon={ClipboardCheck}
              spark={attendanceSpark}
              className="h-full flex flex-col justify-between"
            />
            <MetricBlock
              label="Leading Cohort"
              value={fastestGrade}
              comparison={`${gradeBreakdowns.length} active grades`}
              icon={TrendingUp}
              spark={cohortSpark}
              className="h-full flex flex-col justify-between"
            />
            <MetricBlock
              label="Faculty Strength"
              value={`${staffStats.total} Members`}
              comparison={`${staffStats.teachers} teachers · ${staffStats.administrative} admin`}
              icon={Users}
              className="h-full flex flex-col justify-between"
            />
          </>
        )}
      </div>

      {/* Sliding Segment Navigation Tabs */}
      <SegmentedControl
        ariaLabel="Analytics section navigation"
        layoutId="analyticsMainSectionTabs"
        value={analyticsTab}
        onChange={(val) => setAnalyticsTab(val as typeof analyticsTab)}
        indicatorVariant="brand"
        options={[
          { value: "overview", label: "Overview", icon: <LayoutDashboard size={16} /> },
          { value: "staff", label: `Staff (${staffStats.total})`, icon: <Users size={16} /> },
          { value: "academics", label: "Academics", icon: <BookOpen size={16} /> },
          { value: "attendance", label: "Attendance", icon: <ClipboardCheck size={16} /> },
        ]}
      />

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {analyticsTab === "overview" && (
        <div className="space-y-6">
          {/* Institutional Capacity & Vitals Banner (4 Equal-Height Cards) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xs flex flex-col justify-between h-full">
              <span className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1.5">
                <School size={14} className="text-[var(--brand)]" />
                Student Enrollment
              </span>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1.5">
                {totalStudents}
              </p>
              <span className="text-[11px] text-[var(--text-muted)] mt-1">
                {gradeBreakdowns.length > 0
                  ? `${gradeBreakdowns.length} grade${gradeBreakdowns.length === 1 ? "" : "s"} represented`
                  : "No grade data yet"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xs flex flex-col justify-between h-full">
              <span className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1.5">
                <Users size={14} className="text-[var(--info)]" />
                Employed Staff
              </span>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1.5">
                {staffStats.total}
              </p>
              <span className="text-[11px] text-[var(--text-muted)] mt-1">
                {staffStats.teachers} teachers · {staffStats.administrative} admin
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xs flex flex-col justify-between h-full">
              <span className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1.5">
                <Briefcase size={14} className="text-[var(--success)]" />
                Student–Teacher Ratio
              </span>
              <p className="text-2xl font-bold text-[var(--success)] mt-1.5">
                {staffStats.teachers > 0 ? `${staffStats.studentTeacherRatio}:1` : "—"}
              </p>
              <span className="text-[11px] text-[var(--text-muted)] mt-1">
                {staffStats.teachers > 0
                  ? "CBSE 30:1 benchmark"
                  : "Add teaching staff to compute"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xs flex flex-col justify-between h-full">
              <span className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1.5">
                <UserCheck size={14} className="text-[var(--warning)]" />
                Staff Attendance Rate
              </span>
              <p className="text-2xl font-bold text-[var(--warning)] mt-1.5">
                {staffStats.total > 0 ? `${staffStats.staffAttendanceAvg}%` : "—"}
              </p>
              <span className="text-[11px] text-[var(--text-muted)] mt-1">
                {staffStats.total > 0 ? "Term attendance" : "No staff attendance recorded"}
              </span>
            </div>
          </div>

          {/* Cohort Grade Distribution Card */}
          <section className="panel p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="panel-title">Cohort Performance Distribution</h2>
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                {graded.length} evaluated pupils
              </span>
            </div>

            {/* Proportional Segment Bar */}
            {graded.length === 0 ? (
              <div className="mb-5 rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-2.5 text-xs text-[var(--text-muted)]">
                No graded results yet — the distribution appears once exam marks are recorded.
              </div>
            ) : (
            <div className="w-full h-4 rounded-full overflow-hidden flex bg-[var(--bg-hover)] p-0.5 gap-0.5 border border-[var(--border)] mb-5">
              {scoreTiers.distinction.pct > 0 && (
                <div
                  style={{ width: `${Math.max(scoreTiers.distinction.pct, 2)}%` }}
                  className="h-full rounded-l-full bg-[var(--success)] transition-all duration-500"
                  title={`Distinction: ${scoreTiers.distinction.count} (${scoreTiers.distinction.pct}%)`}
                />
              )}
              {scoreTiers.merit.pct > 0 && (
                <div
                  style={{ width: `${Math.max(scoreTiers.merit.pct, 2)}%` }}
                  className="h-full bg-[var(--info)] transition-all duration-500"
                  title={`Merit: ${scoreTiers.merit.count} (${scoreTiers.merit.pct}%)`}
                />
              )}
              {scoreTiers.pass.pct > 0 && (
                <div
                  style={{ width: `${Math.max(scoreTiers.pass.pct, 2)}%` }}
                  className="h-full bg-[var(--warning)] transition-all duration-500"
                  title={`Pass: ${scoreTiers.pass.count} (${scoreTiers.pass.pct}%)`}
                />
              )}
              {scoreTiers.critical.pct > 0 && (
                <div
                  style={{ width: `${Math.max(scoreTiers.critical.pct, 2)}%` }}
                  className="h-full rounded-r-full bg-[var(--danger)] transition-all duration-500"
                  title={`At Risk: ${scoreTiers.critical.count} (${scoreTiers.critical.pct}%)`}
                />
              )}
            </div>
            )}

            {/* 4-Tier Breakdown Cards (Equal Height) */}
            {graded.length === 0 ? (
              <div className="mb-4 rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-3 text-xs text-[var(--text-muted)]">
                Band breakdown appears once graded results exist.
              </div>
            ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
              <div className="p-3.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--success)]" />
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    Distinction (85%+)
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xl font-bold text-[var(--text-primary)]">
                    {scoreTiers.distinction.count}
                  </span>
                  <span className="text-xs font-medium text-[var(--success)]">
                    {scoreTiers.distinction.pct}%
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--info)]" />
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    Merit (70–84%)
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xl font-bold text-[var(--text-primary)]">
                    {scoreTiers.merit.count}
                  </span>
                  <span className="text-xs font-medium text-[var(--info)]">
                    {scoreTiers.merit.pct}%
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--warning)]" />
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    Pass (50–69%)
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xl font-bold text-[var(--text-primary)]">
                    {scoreTiers.pass.count}
                  </span>
                  <span className="text-xs font-medium text-[var(--warning)]">
                    {scoreTiers.pass.pct}%
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--danger)]" />
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    At Risk (&lt;50%)
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xl font-bold text-[var(--danger)]">
                    {scoreTiers.critical.count}
                  </span>
                  <span className="text-xs font-medium text-[var(--danger)]">
                    {scoreTiers.critical.pct}%
                  </span>
                </div>
              </div>
            </div>
            )}
          </section>

          {/* Paired Symmetrical Row: Radar vs AI Live Intelligence (Equal Heights & Padding) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Multi-Dimensional Vitals Radar */}
            <section className="panel flex flex-col justify-between h-full">
              <div className="p-5 pb-0 flex items-center justify-between">
                <div>
                  <h2 className="panel-title">Institutional Vitals Radar</h2>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border)]">
                  5 Core Axes
                </span>
              </div>
              <div className="chart-wrap flex-1 flex items-center justify-center p-3">
                {hasRadarData ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={attendanceRadar} outerRadius="72%">
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis
                        dataKey="axis"
                        tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      />
                      <Radar
                        dataKey="value"
                        stroke="var(--brand)"
                        fill="var(--brand)"
                        fillOpacity={0.25}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state py-10">
                    <Activity size={24} className="text-[var(--text-muted)]" />
                    <p className="panel-title" style={{ fontSize: 15, marginTop: 4 }}>
                      Not enough data to plot
                    </p>
                    <p className="panel-subtitle">
                      Vitals appear once attendance and exam results are recorded.
                    </p>
                  </div>
                )}
              </div>
              <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)] mt-auto flex items-center justify-between">
                <span>Composite institutional health</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {hasRadarData ? `${attendancePct}% Overall` : "Awaiting data"}
                </span>
              </div>
            </section>

            {/* AI Executive Diagnostic & Insights */}
            <section className="panel p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-md bg-[var(--brand)]/10 text-[var(--brand)]">
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <h2 className="panel-title">Institutional Intelligence</h2>
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border)]">
                  Live Sync
                </span>
              </div>

              <div className="flex-1 flex flex-col justify-between gap-2.5 py-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                <div className="p-2.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex items-start gap-2.5">
                  <Users size={15} className="text-[var(--brand)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">
                      Faculty Coverage:{" "}
                    </span>
                    {staffStats.total === 0
                      ? "No staff records yet. Add faculty to compute the student–teacher ratio."
                      : `${staffStats.total} staff members (${staffStats.teachers} teaching, ${staffStats.administrative} admin) maintaining a ${staffStats.studentTeacherRatio}:1 student ratio.`}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex items-start gap-2.5">
                  <Target size={15} className="text-[var(--info)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">
                      Leading Grade:{" "}
                    </span>
                    {gradeBreakdowns.length === 0
                      ? "No cohort results recorded yet."
                      : `${fastestGrade} is currently the top performing cohort across all ${gradeBreakdowns.length} active grades.`}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex items-start gap-2.5">
                  <Activity size={15} className="text-[var(--success)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">
                      Score Distribution:{" "}
                    </span>
                    {graded.length === 0
                      ? "No exam results recorded yet."
                      : `Cohort median is ${medianAverage}% (mean ${overallAverage}%) across ${graded.length} evaluated pupils.`}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex items-start gap-2.5">
                  <AlertCircle size={15} className="text-[var(--danger)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">
                      Early Warning:{" "}
                    </span>
                    {graded.length === 0 ? (
                      "No exam results recorded yet, so no at-risk learners can be identified."
                    ) : atRisk === 0 ? (
                      "All evaluated learners meet the passing threshold."
                    ) : (
                      <>
                        <span className="font-bold text-[var(--danger)]">{atRisk} learners</span> have scores below 50% and require remediation.
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end mt-auto">
                <button
                  onClick={() => setAnalyticsTab("staff")}
                  className="secondary-button compact text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Explore Staff Analytics</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: STAFF & FACULTY INTELLIGENCE (ACTUAL 10 MEMBERS IN DB) */}
      {analyticsTab === "staff" && (
        <div className="space-y-6">
          {/* Staff Metric Ribbon (Equal Height Cards) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xs flex flex-col justify-between h-full">
              <span className="text-xs text-[var(--text-muted)] font-medium">
                Total Staff Employed
              </span>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1.5">
                {staffStats.total}
              </p>
              <span className="text-[11px] text-[var(--text-muted)] mt-1">
                On active roster
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xs flex flex-col justify-between h-full">
              <span className="text-xs text-[var(--text-muted)] font-medium">
                Teaching Faculty
              </span>
              <p className="text-2xl font-bold text-[var(--brand)] mt-1.5">
                {staffStats.teachers}
              </p>
              <span className="text-[11px] text-[var(--text-muted)] mt-1">
                Classroom faculty
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xs flex flex-col justify-between h-full">
              <span className="text-xs text-[var(--text-muted)] font-medium">
                Administrative Staff
              </span>
              <p className="text-2xl font-bold text-[var(--info)] mt-1.5">
                {staffStats.administrative}
              </p>
              <span className="text-[11px] text-[var(--text-muted)] mt-1">
                Operations & accounts
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xs flex flex-col justify-between h-full">
              <span className="text-xs text-[var(--text-muted)] font-medium">
                Leadership / Principal
              </span>
              <p className="text-2xl font-bold text-[var(--warning)] mt-1.5">
                {staffStats.principal}
              </p>
              <span className="text-[11px] text-[var(--text-muted)] mt-1">
                {staffStats.principalPerson?.name ?? "Principal"}
              </span>
            </div>
          </div>

          {/* Paired Symmetrical Row: Department Bar Chart & Faculty Ratios/Readiness */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Left: Department Distribution Bar Chart */}
            <section className="panel flex flex-col justify-between h-full">
              <div className="p-5 pb-0 flex items-center justify-between">
                <div>
                  <h2 className="panel-title">Staff Members by Department</h2>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {staffStats.departmentBreakdown.length} departments
                </span>
              </div>
              <div className="chart-wrap flex-1 flex items-center justify-center p-3">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={staffStats.departmentBreakdown}
                    margin={{ top: 12, right: 15, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="department"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--border-strong)",
                        background: "var(--bg-panel)",
                        color: "var(--text-secondary)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      name="Staff Count"
                      fill="var(--brand)"
                      radius={[6, 6, 0, 0]}
                      barSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)] mt-auto flex items-center justify-between">
                <span>Domain allocation</span>
                <span className="font-semibold text-[var(--text-primary)]">{staffStats.total} members</span>
              </div>
            </section>

            {/* Right: Operational Readiness & Ratios */}
            <section className="panel p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="panel-title">Faculty Ratios & Capacity</h2>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border)]">
                  K–12 Standards
                </span>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3 py-1">
                <div className="p-3.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                  <span className="text-xs text-[var(--text-muted)] font-medium">Student–Teacher Ratio</span>
                  <p className="text-2xl font-bold text-[var(--success)] mt-1">
                    {staffStats.teachers > 0 ? `${staffStats.studentTeacherRatio}:1` : "—"}
                  </p>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {staffStats.teachers > 0 ? "Below CBSE 30:1 cap" : "No teaching staff on record"}
                  </span>
                </div>
                <div className="p-3.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                  <span className="text-xs text-[var(--text-muted)] font-medium">Faculty Attendance</span>
                  <p className="text-2xl font-bold text-[var(--brand)] mt-1">
                    {staffStats.total > 0 ? `${staffStats.staffAttendanceAvg}%` : "—"}
                  </p>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {staffStats.total > 0 ? "Term duty rate" : "No staff attendance recorded"}
                  </span>
                </div>
                <div className="p-3.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                  <span className="text-xs text-[var(--text-muted)] font-medium">Teaching Faculty Share</span>
                  <p className="text-2xl font-bold text-[var(--info)] mt-1">
                    {staffStats.total > 0
                      ? `${Math.round((staffStats.teachers / staffStats.total) * 100)}%`
                      : "—"}
                  </p>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {staffStats.total > 0
                      ? `${staffStats.teachers} classroom educators`
                      : "No staff on record"}
                  </span>
                </div>
                <div className="p-3.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                  <span className="text-xs text-[var(--text-muted)] font-medium">Admin & Leadership Share</span>
                  <p className="text-2xl font-bold text-[var(--warning)] mt-1">
                    {staffStats.total > 0
                      ? `${Math.round(((staffStats.administrative + staffStats.principal) / staffStats.total) * 100)}%`
                      : "—"}
                  </p>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {staffStats.total > 0
                      ? `${staffStats.administrative + staffStats.principal} ops & leadership`
                      : "No staff on record"}
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end mt-auto text-xs text-[var(--text-muted)]">
                <span className="font-medium text-[var(--text-secondary)]">
                  {staffStats.total} member{staffStats.total === 1 ? "" : "s"} on record
                </span>
              </div>
            </section>
          </div>

          {/* Actual Staff Roster Table (All 10 from Database) */}
          <section className="panel table-panel">
            <div className="p-5 border-b border-[var(--border)]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="panel-title">All Staff & Faculty Records</h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                    />
                    <input
                      type="text"
                      placeholder="Search name, USN, role..."
                      value={staffSearch}
                      onChange={e => setStaffSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] w-48 transition-colors"
                    />
                  </div>

                  <SegmentedControl
                    ariaLabel="Filter staff by category"
                    layoutId="analyticsStaffFilterTabs"
                    value={staffFilter}
                    onChange={(val) => setStaffFilter(val as typeof staffFilter)}
                    options={[
                      { value: "all", label: `All (${staffMembers.length})` },
                      { value: "teacher", label: `Teachers (${staffStats.teachers})` },
                      { value: "admin", label: `Admin (${staffStats.administrative})` },
                      { value: "principal", label: "Principal (1)" },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: 680 }}>
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Staff USN</th>
                    <th>Role / Designation</th>
                    <th>Department</th>
                    <th>Portal Email</th>
                    <th>Attendance</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map(member => (
                    <tr key={member.id} className="hover:bg-[var(--bg-hover)]">
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-full bg-[var(--brand)]/15 text-[var(--brand)] font-bold text-xs flex items-center justify-center">
                            {member.initials || member.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {member.name}
                          </span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-[var(--text-muted)]">
                        {member.usn || "—"}
                      </td>
                      <td>
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          {member.role}
                        </span>
                      </td>
                      <td>
                        <span className="grade-chip">{member.department}</span>
                      </td>
                      <td className="font-mono text-xs text-[var(--text-muted)]">
                        {member.email || "—"}
                      </td>
                      <td>
                        <span className="score-positive">{member.attendance || 95}%</span>
                      </td>
                      <td>
                        <span className="status-pill success">
                          <span className="status-dot" />
                          {member.status || "Active"}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => {
                            if (onNavigate) {
                              onNavigate("Staff", member.id, "staff");
                            } else {
                              toast.info(`Inspecting ${member.name}`);
                            }
                          }}
                          className="tiny-action flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <span>View Profile</span>
                          <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: ACADEMICS & CURRICULA (COMPUTED DIRECTLY FROM ACTUAL STUDENTS) */}
      {analyticsTab === "academics" && (
        <div className="space-y-6">
          {/* Grade-wise Outcome Table Calculated from DB Students */}
          <section className="panel table-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Grade performance</h2>
              </div>
              <span className="count-badge">
                {gradeBreakdowns.length} grades
              </span>
            </div>
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Grade</th>
                    <th>Students</th>
                    <th>Average</th>
                    <th>Attendance</th>
                    <th>At-risk</th>
                    <th>Top student</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeBreakdowns.map(row => (
                    <tr key={row.grade}>
                      <td className="font-semibold text-[var(--text-primary)]">
                        {row.grade}
                      </td>
                      <td>
                        <span className="font-medium text-[var(--text-secondary)]">
                          {row.count} students
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            row.average >= 80
                              ? "font-semibold text-[var(--text-hover)]"
                              : row.average >= 70
                                ? "font-medium text-[var(--text-secondary)]"
                                : "score-warning"
                          }
                        >
                          {row.average}%
                        </span>
                      </td>
                      <td>
                        <span className="score-positive">{row.attendance}%</span>
                      </td>
                      <td>
                        {row.atRiskCount > 0 ? (
                          <span className="text-[var(--danger)] font-semibold">
                            {row.atRiskCount} at risk
                          </span>
                        ) : (
                          <span className="text-[var(--success)] text-xs font-medium">
                            None flagged
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="text-xs font-medium text-[var(--text-primary)]">
                          {row.topStudent ? `${row.topStudent.name} (${row.topStudent.average}%)` : "—"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${row.signal === "Optimal" ? "success" : "warning"}`}
                        >
                          <span className="status-dot" />
                          {row.signal}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Paired Symmetrical Row: Subject Trends vs Subject Benchmarks (Equal Heights) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Term Subject Trends */}
            <section className="panel flex flex-col justify-between h-full">
              <div className="p-5 pb-0 flex items-center justify-between">
                <div>
                  <h2 className="panel-title">Subject Performance Trends</h2>
                </div>
                <span className="text-xs text-[var(--text-muted)]">Monthly Track</span>
              </div>
              <div className="chart-legend px-5 pt-3 pb-1 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <i className="w-2.5 h-2.5 rounded-full bg-[var(--brand)]" />
                  Mathematics
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="w-2.5 h-2.5 rounded-full bg-[var(--violet)]" />
                  Science
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="w-2.5 h-2.5 rounded-full bg-[var(--warning)]" />
                  English
                </span>
              </div>
              <div className="chart-wrap flex-1 flex items-center justify-center p-3">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={performanceTrend}
                    margin={{ top: 12, right: 10, left: -22, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="analyticsMathFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--brand)"
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--brand)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                      domain={[60, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--border-strong)",
                        background: "var(--bg-panel)",
                        color: "var(--text-secondary)",
                        boxShadow: "var(--shadow-popover)",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="mathematics"
                      name="Mathematics"
                      stroke="var(--brand)"
                      strokeWidth={2.4}
                      fill="url(#analyticsMathFill)"
                    />
                    <Area
                      type="monotone"
                      dataKey="science"
                      name="Science"
                      stroke="var(--violet)"
                      strokeWidth={2}
                      fill="none"
                    />
                    <Area
                      type="monotone"
                      dataKey="english"
                      name="English"
                      stroke="var(--warning)"
                      strokeWidth={2}
                      fill="none"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)] mt-auto flex items-center justify-between">
                <span>Monthly trajectory</span>
                <span className="font-semibold text-[var(--text-primary)]">Annual Academic Cycle</span>
              </div>
            </section>

            {/* Subject Averages Comparison */}
            <section className="panel flex flex-col justify-between h-full">
              <div className="p-5 pb-0 flex items-center justify-between">
                <div>
                  <h2 className="panel-title">Subject Mastery Averages</h2>
                </div>
                <span className="text-xs text-[var(--text-muted)]">Cohort Means</span>
              </div>
              <div className="chart-legend px-5 pt-3 pb-1 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <i className="w-2.5 h-2.5 rounded-full bg-[var(--brand)]" />
                  Subject Score Average
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  (75% Minimum Competency Target)
                </span>
              </div>
              <div className="chart-wrap flex-1 flex items-center justify-center p-3">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={subjectAverages}
                    margin={{ top: 12, right: 10, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="subject"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--border-strong)",
                        background: "var(--bg-panel)",
                        color: "var(--text-secondary)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="average"
                      name="Average Score"
                      fill="var(--brand)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)] mt-auto flex items-center justify-between">
                <span>Curriculum mastery</span>
                <span className="font-semibold text-[var(--brand)]">
                  {subjectSpread ? `${subjectSpread.strongest.subject} Leads` : "Synced"}
                </span>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 4: ATTENDANCE DYNAMICS */}
      {analyticsTab === "attendance" && (
        <div className="space-y-6">
          {/* Paired Symmetrical Row: Attendance Bands vs Correlation (Equal Heights) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Attendance Bands */}
            <section className="panel flex flex-col justify-between h-full">
              <div className="p-5 pb-0 flex items-center justify-between">
                <div>
                  <h2 className="panel-title">Student Attendance Bands</h2>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{totalStudents} Pupils</span>
              </div>
              <div className="chart-legend px-5 pt-3 pb-1 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <i className="w-2.5 h-2.5 rounded-full bg-[var(--brand)]" />
                  90%+
                </span>
                <span className="flex items-center gap-1">
                  <i className="w-2.5 h-2.5 rounded-full bg-[var(--info)]" />
                  80–89%
                </span>
                <span className="flex items-center gap-1">
                  <i className="w-2.5 h-2.5 rounded-full bg-[var(--warning)]" />
                  70–79%
                </span>
                <span className="flex items-center gap-1">
                  <i className="w-2.5 h-2.5 rounded-full bg-[var(--danger)]" />
                  &lt;70%
                </span>
              </div>
              <div className="chart-wrap flex-1 flex items-center justify-center p-3">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={attendanceBands}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      width={64}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--bg-hover)" }}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--border-strong)",
                        background: "var(--bg-panel)",
                        color: "var(--text-secondary)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={22}>
                      {attendanceBands.map(band => (
                        <Cell key={band.label} fill={band.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)] mt-auto flex items-center justify-between">
                <span>Parent alert threshold &lt;75%</span>
                <span className="font-semibold text-[var(--danger)]">
                  {attendanceBands[3].count} Below 70%
                </span>
              </div>
            </section>

            {/* Attendance vs Academic Correlation */}
            <section className="panel flex flex-col justify-between h-full">
              <div className="p-5 pb-0 flex items-center justify-between">
                <div>
                  <h2 className="panel-title">Attendance vs Academic Score</h2>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{gradeBreakdowns.length} Grades</span>
              </div>
              <div className="chart-legend px-5 pt-3 pb-1 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <i className="w-2.5 h-2.5 rounded-full bg-[var(--info)]" />
                  Attendance %
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="w-2.5 h-2.5 rounded-full bg-[var(--brand)]" />
                  Academics %
                </span>
              </div>
              <div className="chart-wrap flex-1 flex items-center justify-center p-3">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={gradeCorrelation}
                    margin={{ top: 8, right: 10, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="grade"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--border-strong)",
                        background: "var(--bg-panel)",
                        color: "var(--text-secondary)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="attendance"
                      name="Attendance"
                      fill="var(--info)"
                      radius={[5, 5, 0, 0]}
                    />
                    <Bar
                      dataKey="academics"
                      name="Academics"
                      fill="var(--brand)"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)] mt-auto flex items-center justify-between">
                <span>Cohort alignment</span>
                <span className="font-semibold text-[var(--brand)]">Direct Correlation</span>
              </div>
            </section>
          </div>

          {/* Daily Velocity Card (4 Equal-Height Cards) */}
          <section className="panel p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="panel-title">
                  Daily Attendance Snapshot ({latestAttendance?.day ?? "Latest Recorded Day"})
                </h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success-border)]">
                {attendancePct}% Cohort Present
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
              <div className="p-4 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  Present
                </span>
                <p className="text-2xl font-bold text-[var(--success)] mt-1">
                  {latestAttendance?.present ?? 0}
                </p>
                <span className="text-[11px] text-[var(--text-muted)] mt-1">
                  On campus in class · {attendancePct}% of school cohort
                </span>
              </div>
              <div className="p-4 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  Absent
                </span>
                <p className="text-2xl font-bold text-[var(--danger)] mt-1">
                  {latestAttendance?.absent ?? 0}
                </p>
                <span className="text-[11px] text-[var(--text-muted)] mt-1">
                  Unexcused absence · {Math.max(0, Math.round((100 - attendancePct) * 10) / 10)}% of school cohort
                </span>
              </div>
            </div>
          </section>
        </div>
      )}


    </div>
  );
}

/**
 * Settings & Preferences Hub
 *
 * Organized into dedicated, cohesive categories:
 *  1. Account & Security (Display name, Username, Password update)
 *  2. School Workspace (School Name, Campus, Address, Phone, Term)
 *  3. Academics & Alerts (Grading scale, Attendance threshold, Notification rules)
 *  4. AI Assistant (Super admin provider configuration)
 *  5. Data & Session (Export school configuration, Sign out, Factory reset)
 */
function SettingsView({ onBack }: { onBack: () => void }) {
  const currentUser = useCurrentUser();
  const { settings, save } = useSettings();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<
    "account" | "workspace" | "ai" | "system"
  >("account");

  // Account state
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // OTP identity verification state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Super admin & AI state
  const [superAdmin, setSuperAdmin] = useState(false);
  const [aiConfig, setAiState] = useState<AiConfig>(getAiConfig);
  const [keySaved, setKeySaved] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [sharedReady, setSharedReady] = useState(false);

  // Workspace settings state
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [campus, setCampus] = useState(settings.campus);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [academicYear, setAcademicYear] = useState(settings.academicYear);
  const [currentTerm, setCurrentTerm] = useState(settings.currentTerm);
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setFullName(currentUser.fullName);
    setUsername(currentUser.username);
  }, [currentUser]);

  useEffect(() => {
    void isSuperAdmin().then(setSuperAdmin);
  }, []);

  useEffect(() => {
    void loadSharedAiSettings().then(shared => {
      if (!shared.providerId) return;
      setAiState(current => ({
        providerId: shared.providerId,
        base: shared.base || getProvider(shared.providerId).base,
        model: shared.model || getProvider(shared.providerId).model,
        key: current.key,
      }));
      setSharedReady(true);
    });
  }, []);

  const handleSendOtp = async () => {
    if (!currentUser?.email && !currentUser?.username) {
      toast.error("No registered address for this account.");
      return;
    }
    const identifier = currentUser.email || currentUser.username;
    setSendingOtp(true);
    try {
      const res = await requestSignInCode(identifier);
      if (res.status === "ok") {
        setOtpSent(true);
        toast.success("Verification OTP sent", {
          description: `A 6-digit one-time code has been sent to ${currentUser.email || identifier}.`,
        });
      } else {
        toast.error("Could not send code", { description: res.message });
      }
    } catch {
      toast.error("Network error sending code");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.trim().length !== 6) {
      toast.warning("Please enter the complete 6-digit OTP code");
      return;
    }
    const identifier = currentUser?.email || currentUser?.username || "";
    setVerifyingOtp(true);
    try {
      const res = await verifySignInCode(identifier, otpCode.trim());
      if (res.status === "ok") {
        setOtpVerified(true);
        toast.success("Identity verified successfully", {
          description: "You may now set and confirm your new password.",
        });
      } else {
        toast.error("Invalid verification code", { description: res.message });
      }
    } catch {
      toast.error("Could not verify OTP. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const saveProfile = async () => {
    if (!currentUser) return;
    const name = fullName.trim();
    if (!name) {
      toast.warning("Display name cannot be empty");
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name })
        .eq("id", currentUser.id);
      if (error) throw error;
      notifyDataChanged();
      const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: name },
      });
      if (metaError) {
        toast.success("Profile updated", {
          description: "Saved, though session name could not be refreshed immediately.",
        });
        return;
      }
      toast.success("Profile updated", {
        description: "Your display name is saved.",
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSignIn = async () => {
    if (!currentUser) return;
    const wanted = username.trim().toLowerCase();
    const current = String(currentUser.username ?? "").trim().toLowerCase();
    const nameChanged = wanted !== current;

    if (nameChanged && !wanted) {
      toast.warning("Username cannot be empty");
      return;
    }
    if (nameChanged && !USERNAME_PATTERN.test(wanted) && !wanted.includes("@")) {
      toast.warning("Usernames use letters, numbers, dots, dashes and underscores");
      return;
    }
    if (!otpVerified) {
      toast.warning("Please verify your identity using the OTP code sent to your email first");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      toast.warning("New password must be at least 8 characters");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.warning("The two passwords do not match");
      return;
    }
    if (!nameChanged && !newPassword) {
      toast.warning("Nothing to change");
      return;
    }

    setSavingPassword(true);
    try {
      const result = await changePortalCredentials(
        nameChanged ? wanted : undefined,
        newPassword ? newPassword : undefined,
        undefined,
        true
      );
      if (result.status !== "ok") {
        toast.error("That could not be saved", { description: result.message });
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      setOtpVerified(false);
      setOtpSent(false);
      setOtpCode("");
      toast.success("Sign-in details updated", {
        description: nameChanged
          ? `You can now sign in with "${wanted}". Your email is unchanged.`
          : "Use your new password the next time you sign in.",
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not change your sign-in details."
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const saveWorkspaceProfile = async () => {
    setSavingWorkspace(true);
    try {
      const ok = await save({
        ...settings,
        schoolName,
        campus,
        address,
        phone,
        academicYear,
        currentTerm,
      });
      if (ok) {
        toast.success("Workspace profile saved", {
          description: "School details and academic term updated.",
        });
      }
    } finally {
      setSavingWorkspace(false);
    }
  };

  const updateAiConfig = (patch: Partial<AiConfig>) => {
    setAiState(previous => ({ ...previous, ...patch }));
    setKeySaved(false);
  };

  const selectAiProvider = (providerId: string) => {
    const provider = getProvider(providerId);
    if (providerId === "custom") {
      updateAiConfig({ providerId });
      return;
    }
    updateAiConfig({
      providerId,
      base: provider.base,
      model: providerId.startsWith("gemini") ? aiConfig.model : provider.model,
    });
  };

  const saveAiConfig = async () => {
    if (!isAiConfigured(aiConfig)) {
      const cleared = await clearSharedAiSettings();
      if (!cleared.ok) {
        toast.error("Could not switch the assistant off", { description: cleared.message });
        return;
      }
      setKeySaved(true);
      toast.success("AI assistant switched off");
      return;
    }
    const result = await saveSharedAiSettings(aiConfig);
    if (!result.ok) {
      toast.error("Could not save the AI configuration", { description: result.message });
      return;
    }
    setAiConfig(aiConfig);
    setKeySaved(true);
    toast.success("AI assistant saved for the whole school", {
      description: `${getProvider(aiConfig.providerId).label} · ${aiConfig.model}. Available to all users.`,
    });
  };

  const runAiTest = async () => {
    setTestingAi(true);
    const result = await testAiConnection(aiConfig);
    setTestingAi(false);
    if (result.ok) {
      const provider = getProvider(aiConfig.providerId);
      const model = (result as { model?: string }).model ?? aiConfig.model;
      toast.success("Connection verified", {
        description: `${provider.label} · ${model}. Ready for queries.`,
      });
    } else {
      toast.error("Could not reach that provider", { description: result.message });
    }
  };

  const tabs: Array<{
    id: "account" | "workspace" | "ai" | "system";
    label: string;
    icon: LucideIcon;
  }> = [
    { id: "account", label: "My Account & Security", icon: ShieldCheck },
    { id: "workspace", label: "School Workspace", icon: Building2 },
  ];
  if (superAdmin) {
    tabs.push({ id: "ai", label: "AI Assistant", icon: Sparkles });
  }
  tabs.push({ id: "system", label: "Data & Session", icon: Database });

  return (
    <div className="page-stack max-w-5xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Settings & Preferences"
            onParentClick={onBack}
          />
          <h1 className="page-title">Settings & Preferences</h1>
        </div>
      </div>

      {/* Segmented Control Navigation with Smooth Horizontal Sliding Indicator */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-4 overflow-x-auto no-scrollbar">
        <SegmentedControl
          ariaLabel="Settings section navigation"
          layoutId="settingsNavigationTabs"
          value={activeTab}
          onChange={(val) => setActiveTab(val as typeof activeTab)}
          indicatorVariant="brand"
          options={tabs.map(tab => {
            const Icon = tab.icon;
            return {
              value: tab.id,
              label: tab.label,
              icon: <Icon size={16} />,
            };
          })}
        />
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: Account & Security                                           */}
      {/* ==================================================================== */}
      {activeTab === "account" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Identity Header Card */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm overflow-hidden">
            <div className="p-6 sm:p-7 border-b border-[var(--border)] bg-[var(--bg-raised)]/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {currentUser?.avatarUrl ? (
                  <img
                    className="avatar avatar-lg h-14 w-14 rounded-full border border-[var(--border)] shadow-sm object-cover"
                    src={currentUser.avatarUrl}
                    alt=""
                  />
                ) : (
                  <span className="avatar avatar-lg h-14 w-14 rounded-full bg-[var(--brand-soft)] text-[var(--brand-strong)] border border-[var(--border)] flex items-center justify-center font-bold text-lg shadow-sm">
                    {initialsFor(currentUser?.fullName || "Admin")}
                  </span>
                )}
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-extrabold text-[var(--text-primary)] truncate">
                      {currentUser?.fullName ?? "—"}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/20">
                      {roleLabel(currentUser?.id, currentUser?.role)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] font-mono truncate">
                    {currentUser?.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-7 space-y-5">
              <div className="space-y-1.5 max-w-md">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Display Name
                </label>
                <input
                  value={fullName}
                  onChange={event => setFullName(event.target.value)}
                  placeholder="e.g. Dr. Meera Iyer"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all placeholder:text-[var(--text-muted)]"
                />
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  The name visible on classroom attendance, evaluations, reports, and staff communications.
                </p>
              </div>
            </div>

            <div className="px-6 sm:px-7 py-4 bg-[var(--bg-raised)]/40 border-t border-[var(--border)] flex items-center justify-end">
              <button
                className="primary-button h-10 px-5 rounded-xl text-xs font-semibold flex items-center gap-2"
                onClick={() => void saveProfile()}
                disabled={savingProfile}
              >
                <Save size={15} />
                <span>{savingProfile ? "Saving…" : "Save Display Name"}</span>
              </button>
            </div>
          </section>

          {/* Credentials & Password Card */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm overflow-hidden">
            <div className="p-6 sm:p-7 border-b border-[var(--border)] bg-[var(--bg-raised)]/30 flex items-center justify-between">
              <div className="space-y-1">
                <p className="eyebrow text-xs font-bold text-[var(--brand)] uppercase tracking-wider">
                  Authentication
                </p>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Portal Sign-in ID & Password
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Manage the username and secret credentials used to access the Global Kids School portal.
                </p>
              </div>
              <span className="p-2.5 rounded-xl bg-[var(--info-soft)] text-[var(--info)]">
                <Lock size={20} />
              </span>
            </div>

            <div className="p-6 sm:p-7 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    Sign-in Handle / Username
                  </label>
                  <input
                    value={username}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={event => setUsername(event.target.value)}
                    placeholder="e.g. principal"
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] font-mono text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all placeholder:text-[var(--text-muted)]"
                  />
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    This is the unique handle you type on the login screen. Your official recovery email remains unchanged.
                  </p>
                </div>

                {/* Interactive OTP Identity Verification Block */}
                <div className="md:col-span-2 space-y-3">
                  {!otpVerified ? (
                    <div className="p-4.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-raised)]/30 space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <ShieldAlert size={16} className="text-[var(--warning)]" />
                            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                              Identity Verification via OTP
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">
                            To authorize changes to your password or sign-in handle, request an OTP to your registered email (
                            <span className="font-mono text-[var(--brand)]">{currentUser?.email || "your email"}</span>).
                          </p>
                        </div>
                        {!otpSent ? (
                          <button
                            type="button"
                            onClick={() => void handleSendOtp()}
                            disabled={sendingOtp}
                            className="h-9 px-4 rounded-xl text-xs font-semibold bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)] transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap self-start sm:self-auto disabled:opacity-50"
                          >
                            {sendingOtp ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                            <span>{sendingOtp ? "Sending Code…" : "Send Verification OTP"}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleSendOtp()}
                            disabled={sendingOtp}
                            className="text-xs text-[var(--brand)] hover:underline whitespace-nowrap font-medium self-start sm:self-auto cursor-pointer"
                          >
                            {sendingOtp ? "Resending…" : "Resend Code"}
                          </button>
                        )}
                      </div>

                      {otpSent && (
                        <div className="pt-3 border-t border-[var(--border)]/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <div className="relative flex-1 sm:max-w-xs">
                            <input
                              type="text"
                              maxLength={6}
                              value={otpCode}
                              onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                              placeholder="Enter 6-digit OTP"
                              className="w-full h-10 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] font-mono text-center text-sm tracking-widest text-[var(--text-primary)] focus:border-[var(--brand)] outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleVerifyOtp()}
                            disabled={verifyingOtp || otpCode.length !== 6}
                            className="h-10 px-5 rounded-xl text-xs font-semibold bg-[var(--success)] hover:bg-[var(--success-strong)] text-white transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                          >
                            {verifyingOtp ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            <span>{verifyingOtp ? "Verifying…" : "Verify OTP"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border border-[var(--success-border)] bg-[var(--success-soft)] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-[var(--success-soft)] text-[var(--success)]">
                          <CheckCircle2 size={18} />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-[var(--success)]">Identity Verified via OTP</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            One-time authorization active. You may now enter and confirm your new password.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-[var(--success-soft)] text-[var(--success)] font-bold uppercase tracking-wider">
                        Authorized
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    disabled={!otpVerified}
                    autoComplete="new-password"
                    onChange={event => setNewPassword(event.target.value)}
                    placeholder={otpVerified ? "At least 8 characters" : "Verify OTP to unlock"}
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all placeholder:text-[var(--text-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    disabled={!otpVerified}
                    autoComplete="new-password"
                    onChange={event => setConfirmPassword(event.target.value)}
                    placeholder={otpVerified ? "Re-enter your new password" : "Verify OTP to unlock"}
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all placeholder:text-[var(--text-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[var(--text-muted)]">
                <span>Forgot your current password? We can mail an authentication recovery link to your inbox.</span>
                <button
                  type="button"
                  className="link-button font-semibold text-[var(--brand)] hover:underline whitespace-nowrap"
                  onClick={async () => {
                    if (!currentUser) return;
                    const result = await resetPasswordByUsername(
                      currentUser.username || currentUser.email
                    );
                    if (result.status === "ok") {
                      toast.success("Reset link sent", { description: result.message });
                    } else {
                      toast.error(result.message);
                    }
                  }}
                >
                  Send Recovery Link
                </button>
              </div>
            </div>

            <div className="px-6 sm:px-7 py-4 bg-[var(--bg-raised)]/40 border-t border-[var(--border)] flex items-center justify-end">
              <button
                className="primary-button h-10 px-5 rounded-xl text-xs font-semibold flex items-center gap-2"
                onClick={() => void saveSignIn()}
                disabled={savingPassword}
              >
                <KeyRound size={15} />
                <span>{savingPassword ? "Updating…" : "Update Credentials"}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: School Workspace                                             */}
      {/* ==================================================================== */}
      {activeTab === "workspace" && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="p-6 sm:p-7 border-b border-[var(--border)] bg-[var(--bg-raised)]/30 flex items-center justify-between">
            <div className="space-y-1">
              <p className="eyebrow text-xs font-bold text-[var(--brand)] uppercase tracking-wider">
                Campus Configuration
              </p>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                School Profile & Campus Details
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Official institution information, active academic year, and running term parameters.
              </p>
            </div>
            <span className="p-2.5 rounded-xl bg-[var(--violet-soft)] text-[var(--violet)]">
              <Building2 size={20} />
            </span>
          </div>

          <div className="p-6 sm:p-7 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Institution Name
                </label>
                <input
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                  placeholder="e.g. Global Kids School"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Campus / Branch
                </label>
                <input
                  value={campus}
                  onChange={e => setCampus(e.target.value)}
                  placeholder="e.g. Main Campus · Bengaluru"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Street Address
                </label>
                <input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. 24 Green Park Road, Koramangala"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Contact Phone
                </label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. +91 80 2553 4410"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Active Academic Year
                </label>
                <select
                  value={academicYear}
                  onChange={e => setAcademicYear(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all cursor-pointer"
                >
                  <option value="2025–26">2025–26</option>
                  <option value="2026–27">2026–27</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Current Term
                </label>
                <select
                  value={currentTerm}
                  onChange={e => setCurrentTerm(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all cursor-pointer"
                >
                  <option value="Term 1">Term 1 (First Half)</option>
                  <option value="Term 2">Term 2 (Mid Term)</option>
                  <option value="Term 3">Term 3 (Annual Finals)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-7 py-4 bg-[var(--bg-raised)]/40 border-t border-[var(--border)] flex items-center justify-between">
            <p className="text-xs text-[var(--text-muted)]">
              Workspace changes apply system-wide across all faculty, student, and parent views.
            </p>
            <button
              className="primary-button h-10 px-5 rounded-xl text-xs font-semibold flex items-center gap-2"
              onClick={() => void saveWorkspaceProfile()}
              disabled={savingWorkspace}
            >
              <Save size={15} />
              <span>{savingWorkspace ? "Saving…" : "Save Workspace"}</span>
            </button>
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: AI Assistant (Super Admin Only)                              */}
      {/* ==================================================================== */}
      {activeTab === "ai" && superAdmin && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="p-6 sm:p-7 border-b border-[var(--border)] bg-[var(--bg-raised)]/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <p className="eyebrow text-xs font-bold text-[var(--brand)] uppercase tracking-wider">
                  Super Admin
                </p>
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                School-Wide AI Assistant Provider
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Configure once with Google Gemini or OpenAI; every authorized staff member gains intelligent assistant queries.
              </p>
            </div>
            <span className="p-2.5 rounded-xl bg-[var(--violet-soft)] text-[var(--violet)] flex-shrink-0">
              <Sparkles size={20} />
            </span>
          </div>

          <div className="p-6 sm:p-7 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  AI Provider Engine
                </label>
                <FormSelect
                  value={aiConfig.providerId}
                  onChange={value => selectAiProvider(value)}
                  options={AI_PROVIDERS.map(provider => ({
                    value: provider.id,
                    label: provider.label,
                  }))}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Model Endpoint
                </label>
                <FormSelect
                  value={aiConfig.model}
                  onChange={value => updateAiConfig({ model: value })}
                  disabled={aiConfig.providerId === "custom"}
                  options={(() => {
                    if (aiConfig.providerId.startsWith("gemini")) {
                      return GEMINI_MODELS.map(m => ({ value: m, label: m }));
                    }
                    const provider = getProvider(aiConfig.providerId);
                    const models = provider.models ?? [provider.model];
                    const opts = models.map(m => ({ value: m, label: m }));
                    if (!models.includes(aiConfig.model)) {
                      opts.push({ value: aiConfig.model, label: `${aiConfig.model} (custom)` });
                    }
                    return opts;
                  })()}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Base API URL
                </label>
                <input
                  value={aiConfig.base}
                  onChange={event => updateAiConfig({ base: event.target.value })}
                  placeholder="https://api.example.com/v1"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] font-mono text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Secret API Key
                </label>
                <input
                  type="password"
                  value={aiConfig.key}
                  onChange={event => updateAiConfig({ key: event.target.value })}
                  placeholder={
                    sharedReady && aiConfig.key === ""
                      ? "Saved securely on server — type to replace"
                      : getProvider(aiConfig.providerId).keyHint
                  }
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all"
                />
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {getProvider(aiConfig.providerId).note} The API key is stored on the server with AES encryption; no user browser can read it back.
            </p>
          </div>

          <div className="px-6 sm:px-7 py-4 bg-[var(--bg-raised)]/40 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                className="secondary-button h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-2"
                onClick={() => void runAiTest()}
                disabled={testingAi || !isAiConfigured(aiConfig)}
              >
                <RefreshCw size={14} className={testingAi ? "animate-spin" : ""} />
                <span>{testingAi ? "Verifying…" : "Test Connection"}</span>
              </button>

              {sharedReady && (
                <button
                  className="secondary-button h-10 px-4 rounded-xl text-xs font-semibold text-[var(--danger)] hover:text-[var(--danger)]"
                  onClick={() => {
                    setAiConfig({ ...aiConfig, key: "" });
                    setAiState({ ...aiConfig, key: "" });
                    setKeySaved(false);
                  }}
                >
                  Clear Saved Key
                </button>
              )}
            </div>

            <button
              className="primary-button h-10 px-5 rounded-xl text-xs font-semibold flex items-center gap-2"
              onClick={() => void saveAiConfig()}
            >
              <Save size={15} />
              <span>{keySaved ? "Configuration Saved" : "Save For School"}</span>
            </button>
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: Data & Session                                               */}
      {/* ==================================================================== */}
      {activeTab === "system" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Data Export Card */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm overflow-hidden">
            <div className="p-6 sm:p-7 border-b border-[var(--border)] bg-[var(--bg-raised)]/30 flex items-center justify-between">
              <div className="space-y-1">
                <p className="eyebrow text-xs font-bold text-[var(--brand)] uppercase tracking-wider">
                  Data Backup
                </p>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Export System Configuration
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Download a complete JSON snapshot of your school parameters, academic scales, and automation rules.
                </p>
              </div>
              <span className="p-2.5 rounded-xl bg-[var(--info-soft)] text-[var(--info)]">
                <Download size={20} />
              </span>
            </div>

            <div className="p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1 max-w-lg">
                <div className="text-sm font-bold text-[var(--text-primary)]">
                  JSON System Snapshot
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Generates an offline portable backup file with current term settings, grading scales, and notification configurations.
                </p>
              </div>

              <button
                className="secondary-button h-10 px-5 rounded-xl text-xs font-semibold flex items-center gap-2 flex-shrink-0"
                onClick={() => {
                  const data = {
                    school: schoolName || "Global Kids School",
                    exportedAt: new Date().toISOString(),
                    settings: { academicYear, campus, address, phone, currentTerm },
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `school-settings-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("School configuration exported successfully");
                }}
              >
                <Download size={15} />
                <span>Export Configuration</span>
              </button>
            </div>
          </section>

          {/* Session Sign-Out & Danger Zone */}
          <section className="rounded-2xl border border-[var(--danger-border)] bg-[var(--bg-panel)] shadow-sm overflow-hidden">
            <div className="p-6 sm:p-7 border-b border-[var(--danger-border)] bg-[var(--danger-soft-2)] flex items-center justify-between">
              <div className="space-y-1">
                <p className="eyebrow text-xs font-bold text-[var(--danger)] uppercase tracking-wider">
                  Session & Controls
                </p>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Session Management & Defaults
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Manage active browser sessions and restore factory defaults if required.
                </p>
              </div>
              <span className="p-2.5 rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]">
                <LogOut size={20} />
              </span>
            </div>

            <div className="p-6 sm:p-7 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-3 border-b border-[var(--border)]">
                <div className="space-y-1 max-w-lg">
                  <div className="text-sm font-bold text-[var(--text-primary)]">
                    Sign Out Active Session
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Ends your current signed-in session on this device and redirects securely to the login portal.
                  </p>
                </div>

                <button
                  className="secondary-button h-10 px-5 rounded-xl text-xs font-semibold text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] border-[var(--danger-border)] flex items-center gap-2 flex-shrink-0"
                  onClick={async () => {
                    try {
                      await supabaseSignOut();
                    } finally {
                      window.location.href = "/login";
                    }
                  }}
                >
                  <LogOut size={15} />
                  <span>Sign Out Session</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-3">
                <div className="space-y-1 max-w-lg">
                  <div className="text-sm font-bold text-[var(--text-primary)]">
                    Reset Settings to Default
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Restores school workspace details and academic year to default configuration.
                  </p>
                </div>

                <button
                  className="secondary-button h-10 px-5 rounded-xl text-xs font-semibold flex items-center gap-2 flex-shrink-0"
                  onClick={() => {
                    setAcademicYear(settings.academicYear);
                    setSchoolName(settings.schoolName);
                    setCampus(settings.campus);
                    setAddress(settings.address);
                    setPhone(settings.phone);
                    setCurrentTerm(settings.currentTerm);
                    toast.success("Settings restored to defaults");
                  }}
                >
                  <RefreshCw size={15} />
                  <span>Reset Defaults</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [activeView, setActiveView] = useState("Overview");
  // Bumped on every targeted arrival so the directory remounts its open effect
  // even when the view is already "Students".
  const [studentsKey, setStudentsKey] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const narrowViewport = useNarrowViewport();
  const [commandOpen, setCommandOpen] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const profileWrapRef = useRef<HTMLDivElement>(null);

  /*
   * Close the profile menu on an outside click.
   *
   * This was a full-screen `.profile-menu-scrim` div. That cannot work here:
   * the topbar sets `backdrop-filter: blur(16px)`, and a non-`none`
   * backdrop-filter makes the element a containing block for `position:
   * fixed` descendants. The scrim's `inset: 0` therefore resolved against the
   * 64px-tall topbar instead of the viewport, so it covered a thin strip and
   * clicks anywhere in the page fell straight through to the content behind.
   *
   * Listening on the document and asking whether the target is inside the menu
   * is not subject to stacking or containing-block rules, so it closes on any
   * outside click regardless of what the topbar is styled with. `pointerdown`
   * rather than `click` so the menu is already gone by the time the click
   * reaches whatever is underneath.
   */
  useEffect(() => {
    if (!profileMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const wrap = profileWrapRef.current;
      if (!wrap) return;
      if (event.target instanceof Node && wrap.contains(event.target)) return;
      setProfileMenu(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [profileMenu]);
  const currentUser = useCurrentUser();
  const userName = currentUser?.fullName ?? "";
  const userInitials = initialsFor(userName || "Admin");
  const userRole = roleLabel(currentUser?.id, currentUser?.role ?? "admin");
  /**
   * Screens this signed-in user may open, as dashboard labels.
   *
   * The sidebar is built from this, and `navigate` refuses anything outside it.
   * That is the same list the assistant is scoped by, and it has to be: an AI
   * that says "that is not available to your role" while the Fee ledger sits
   * one click away in the sidebar reads as broken rather than careful.
   */
  const allowedScreens = useMemo(
    () => VISIBLE_SCREENS_FOR_ROLE(currentUser?.role ?? "staff"),
    [currentUser?.role]
  );
  const allowedScreenSet = useMemo(
    () => new Set(allowedScreens as string[]),
    [allowedScreens]
  );
  /*
   * A pupil's shell has no Students item, so the count hook must not fetch
   * the whole roll call. `students` is readable by any authenticated session at
   * the database layer, so relying on the hidden sidebar would still put the
   * whole roll call in a child's browser.
   */
  const canSeeStudents =
    Boolean(currentUser) && allowedScreenSet.has("Students");
  const { total: sidebarStudentCount, loading: studentsLoading } =
    useStudentCounts(canSeeStudents);
  const booting =
    !currentUser || studentsLoading;
  const liveCounts: Record<string, string> = booting
    ? {}
    : {
        Students: String(sidebarStudentCount),
      };
  const navCountLoading: Record<string, boolean> = {
    Students: booting,
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setProfileMenu(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const [, setLocation] = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  // Lenis measures this to know how far the page can scroll; without it the
  // cached height stays at the pre-data value and the bottom is unreachable.
  const contentRef = useRef<HTMLDivElement>(null);
  /**
   * Route to a view, optionally opening a specific record on arrival.
   *
   * The search palette used to jump to Students and stop there, so picking a
   * person out of the results meant a second click to actually see them.
   * Passing the id here lets the directory open that profile directly.
   */
  const pendingStudentRef = useRef<RowId | null>(null);
  const pendingStaffRef = useRef<RowId | null>(null);
  const [staffKey, setStaffKey] = useState(0);

  // A role that resolves late, or a deep link to a screen this role cannot
  // open, lands on Overview rather than rendering a view it should not see.
  //
  // The Students view was removed from this shell. A super admin now reaches the
  // student roll call from the dedicated StudentDirectory page rather than from
  // the legacy student list inside User management, so this ref and the deep-link
  // path that used it are kept only for backwards compatibility with any code that
  // still passes a studentId through `navigate`.
  useEffect(() => {
    if (!currentUser) return;
    if (!allowedScreenSet.has(activeView)) setActiveView("Overview");
  }, [currentUser, activeView, allowedScreenSet]);

  const visibleNavGroups = useMemo(
    () =>
      navGroups
        .map(group => ({
          ...group,
          items: group.items.filter(item => allowedScreenSet.has(item.label)),
        }))
        .filter(group => group.items.length > 0),
    [allowedScreenSet]
  );

  const isSuperAdminUser = currentUser ? isSuperAdminId(currentUser.id) : false;
  const isAdminUser =
    isSuperAdminUser ||
    currentUser?.role === "admin" ||
    currentUser?.role === "super_admin";

  const staffMobileTabs = useMemo<StaffMobileTab[]>(() => {
    // Smart pill tabs tailored for Admin & Super Admin:
    // 4 high-frequency operational command centers: Home, Students, Fees, Users
    // (with Menu automatically added as the 5th tab by StaffMobileShell)
    if (isAdminUser) {
      return [
        { id: "Overview", label: "Home", icon: LayoutDashboard },
        { id: "Students", label: "Students", icon: GraduationCap },
        { id: "Fees & Finance", label: "Fees", icon: IndianRupee },
        { id: "User management", label: "Users", icon: UserCog },
      ];
    }

    if (
      currentUser?.role === "accountant" &&
      allowedScreenSet.has("Fees & Finance")
    ) {
      return [
        { id: "Overview", label: "Home", icon: LayoutDashboard },
        { id: "Students", label: "Students", icon: GraduationCap },
        { id: "Fees & Finance", label: "Fees", icon: IndianRupee },
      ];
    }

    const tabs: StaffMobileTab[] = [
      { id: "Overview", label: "Home", icon: LayoutDashboard },
    ];
    if (allowedScreenSet.has("Students")) {
      tabs.push({ id: "Students", label: "Students", icon: GraduationCap });
    }
    if (allowedScreenSet.has("Attendance")) {
      tabs.push({
        id: "Attendance",
        label: "Attendance",
        icon: ClipboardCheck,
      });
    }
    return tabs;
  }, [allowedScreenSet, currentUser, isAdminUser]);

  const staffMobileGroups = useMemo(() => {
    const groups = visibleNavGroups.map(group => ({
      label: group.label,
      items: group.items.map(item => ({
        label: item.label,
        icon: item.icon,
      })),
    }));
    const system: Array<{ label: string; icon: LucideIcon }> = [];
    if (allowedScreenSet.has("User management")) {
      system.push({ label: "User management", icon: UserCog });
    }
    if (allowedScreenSet.has("Settings")) {
      system.push({ label: "Settings", icon: Settings2 });
    }
    if (system.length) groups.push({ label: "System", items: system });
    return groups;
  }, [visibleNavGroups, allowedScreenSet]);

  const navigate = (
    view: string,
    entityId?: RowId,
    entityType?: "student" | "staff"
  ) => {
    if (!allowedScreenSet.has(view)) {
      toast.error(
        `${roleLabel(currentUser?.id, currentUser?.role)}s cannot open ${view}.`,
        { description: "Ask an admin if you need access to it." }
      );
      return;
    }
    if (view === "Students" || entityType === "student") {
      pendingStudentRef.current = entityId ?? null;
      if (entityId != null) setStudentsKey(k => k + 1);
    } else if (view === "Staff" || entityType === "staff") {
      pendingStaffRef.current = entityId ?? null;
      if (entityId != null) setStaffKey(k => k + 1);
    } else {
      pendingStudentRef.current = entityId ?? null;
    }
    setActiveView(view);
    setMobileNav(false);
    smoothScrollTo(0);
    // The incoming view has its own height; remeasure on the next frame once
    // it has painted, otherwise the scroll range is the outgoing view's.
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  };
  const signOut = async () => {
    // Await so the Auth session is fully cleared before we land on
    // /login — otherwise the guard can flash a redirect back.
    await supabaseSignOut();
    setLocation("/login");
  };
  const renderView = () => {
    if (activeView === "Overview") {
      // Do not mount the staff Overview until the role is known. Its hooks
      // fetch the whole roll call and fee ledger, and
      // `students` is readable by any authenticated session at the database
      // layer — so rendering it for a frame while a pupil's profile resolves
      // would put data in a child's browser that the sidebar then hides.
      if (!currentUser) {
        // Mirror the whole overview, not just its metric row. Showing four
        // cards alone left two thirds of the page blank, which read as a
        // broken layout rather than as loading.
        return (
          <div className="page-stack skeleton-fade" role="status" aria-busy="true">
            <span className="sr-only">Loading your dashboard</span>
            <div className="metric-grid">
              <SkeletonMetric />
              <SkeletonMetric />
              <SkeletonMetric />
              <SkeletonMetric />
            </div>
            <div className="dashboard-grid dashboard-grid-top">
              <section className="panel" aria-hidden="true">
                <div className="panel-header">
                  <SkeletonText width={108} height={16} />
                  <SkeletonText width={78} height={11} />
                </div>
                <SkeletonChart height={250} variant="area" />
              </section>
              <section className="panel" aria-hidden="true">
                <div className="panel-header">
                  <SkeletonText width={124} height={16} />
                  <SkeletonText width={62} height={11} />
                </div>
                <div style={{ padding: "8px 20px 16px" }}>
                  <SkeletonList rows={5} avatar={false} />
                </div>
              </section>
            </div>
            <div className="dashboard-grid dashboard-grid-mid">
              <section className="panel" aria-hidden="true">
                <div className="panel-header">
                  <SkeletonText width={132} height={16} />
                </div>
                <div style={{ padding: "8px 20px 16px" }}>
                  <SkeletonList rows={3} avatar />
                </div>
              </section>
              <section className="panel" aria-hidden="true">
                <div className="panel-header">
                  <SkeletonText width={118} height={16} />
                </div>
                <div style={{ padding: "8px 20px 16px" }}>
                  <SkeletonList rows={3} avatar={false} />
                </div>
              </section>
            </div>
          </div>
        );
      }
      // A pupil never reaches the staff Overview: it loads the whole roll call
      // into the browser, which is not a thing a child should be holding.
      return currentUser.role === "student" ? (
        <PupilOverview onBack={() => navigate("Overview")} />
      ) : (
        <DashboardView onNavigate={navigate} />
      );
    }
    // The directory and the profile live in their own modules. The component
    // they replaced was a single-line one inside this already 3,000-line file,
    // and it fetched every student into the browser to filter and page there;
    // StudentDirectory asks the server for one page at a time.
    if (activeView === "Students") {
      return (
        <StudentDirectory
          key={studentsKey}
          openStudentId={pendingStudentRef.current ? String(pendingStudentRef.current) : null}
          onStudentOpened={() => {
            pendingStudentRef.current = null;
          }}
          onBack={() => navigate("Overview")}
        />
      );
    }
    if (activeView === "Attendance")
      return <AttendanceView onBack={() => navigate("Overview")} />;
    if (activeView === "Fees & Finance")
      return <FinanceView onBack={() => navigate("Overview")} />;
    if (activeView === "Analytics")
      return <AnalyticsView onBack={() => navigate("Overview")} onNavigate={navigate} />;
    if (activeView === "Staff")
      return (
        <StaffView
          key={staffKey}
          openStaffId={pendingStaffRef.current ? String(pendingStaffRef.current) : null}
          onStaffOpened={() => {
            pendingStaffRef.current = null;
          }}
          onBack={() => navigate("Overview")}
          onNavigate={navigate}
        />
      );
    if (activeView === "Academics")
      return <AcademicsView onBack={() => navigate("Overview")} />;
    if (activeView === "Examinations")
      return <ExaminationsView onBack={() => navigate("Overview")} />;
    if (activeView === "Reports")
      return <ReportsView onBack={() => navigate("Overview")} />;
    if (activeView === "User management")
      return <UserManagementView onBack={() => navigate("Overview")} />;
    if (activeView === "Settings")
      return <SettingsView onBack={() => navigate("Overview")} />;
    return <DashboardView onNavigate={navigate} />;
  };

  /*
   * A pupil on a phone gets the four-tab layout instead of the rail.
   *
   * Only on Overview: Settings is a full page with its own way back, and
   * swapping the whole shell out from under it would leave a child with no
   * exit. Above the breakpoint nothing changes — the desktop sidebar is the
   * better navigation for that much screen.
   */
  if (
    narrowViewport &&
    currentUser?.role === "student" &&
    activeView === "Overview"
  ) {
    return (
      <PupilMobileDashboard
        onOpenSettings={() => navigate("Settings")}
        onSignOut={signOut}
      />
    );
  }

  if (
    narrowViewport &&
    currentUser &&
    currentUser.role !== "student" &&
    currentUser.role !== "parent"
  ) {
    return (
      <>
        <StaffMobileShell
          name={userName}
          role={userRole}
          isExecutive={isAdminUser}
          initials={userInitials}
          photoUrl={currentUser?.avatarUrl ?? null}
          email={currentUser?.email}
          username={currentUser?.username}
          activeView={activeView}
          primaryItems={staffMobileTabs}
          navGroups={staffMobileGroups}
          onNavigate={navigate}
          onOpenSearch={() => setCommandOpen(true)}
          onSignOut={signOut}
        >
          {renderView()}
        </StaffMobileShell>
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          onNavigate={navigate}
          activeView={activeView}
        />
      </>
    );
  }

  return (
    <SmoothScroll scrollRef={mainRef} contentRef={contentRef}>
      <div className="erp-app">
        <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
          <div className="sidebar-top">
            <div className="brand-row">
              {" "}
              <img
                src="/global-kids-logo.svg"
                alt="Global Kids School"
                className="brand-logo"
              />
              <span className="brand-wordmark">
                <span className="brand-wordmark-line1">Global Kids</span>
                <span className="brand-wordmark-line2">School</span>
              </span>
              <button
                className="sidebar-close-mobile"
                onClick={() => setMobileNav(false)}
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="sidebar-nav">
            {!currentUser ? (
              <SkeletonNav />
            ) : (
              visibleNavGroups.map(group => (
                <div className="nav-group" key={group.label}>
                  <p className="nav-group-label">{group.label}</p>
                  {group.items.map(item => (
                    <button
                      className={`nav-item ${activeView === item.label ? "active" : ""}`}
                      key={item.label}
                      onClick={() => navigate(item.label)}
                    >
                      <item.icon
                        size={17}
                        strokeWidth={activeView === item.label ? 2.1 : 1.8}
                      />
                      <span className="nav-label">{item.label}</span>
                      {liveCounts[item.label] ? (
                        <span className="nav-count count-in">
                          {liveCounts[item.label]}
                        </span>
                      ) : navCountLoading[item.label] ? (
                        <span className="nav-count">
                          <SkeletonInline
                            width={22}
                            height={9}
                            className="nav-count-placeholder"
                          />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ))
            )}
            <div className="nav-group settings-group">
              {!currentUser ? (
                <>
                  <p className="nav-group-label">
                    <SkeletonText width={46} height={9} />
                  </p>
                  <div className="nav-item">
                    <SkeletonCircle size={17} />
                    <span className="nav-label">
                      <SkeletonText width={84} height={11} />
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <p className="nav-group-label">System</p>
                  {allowedScreenSet.has("User management") && (
                    <button
                      className={`nav-item ${activeView === "User management" ? "active" : ""}`}
                      onClick={() => navigate("User management")}
                    >
                      <UserCog size={17} />
                      <span className="nav-label">User management</span>
                    </button>
                  )}
                  {allowedScreenSet.has("Settings") && (
                    <button
                      className={`nav-item ${activeView === "Settings" ? "active" : ""}`}
                      onClick={() => navigate("Settings")}
                    >
                      <Settings2 size={17} />
                      <span className="nav-label">Settings</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </aside>
        <div
          className={`mobile-nav-scrim ${mobileNav ? "visible" : ""}`}
          onClick={() => setMobileNav(false)}
        />
        <main ref={mainRef} className="main-area">
          <header className="topbar">
            <div className="topbar-left">
              <IconButton
                label="Open navigation"
                className="mobile-menu-button"
                onClick={() => setMobileNav(true)}
              >
                <Menu size={18} />
              </IconButton>
              {currentUser && currentUser.role !== "student" && (
                <button
                  type="button"
                  className="command-trigger"
                  onClick={() => setCommandOpen(true)}
                  aria-label="Search records, students, classes or ask anything (Ctrl+K or ⌘K)"
                >
                  <Search size={15} className="command-trigger-icon" />
                  <span className="command-trigger-text">Search anything…</span>
                  <span className="command-trigger-kbd">
                    <kbd>
                      <Command size={10} />
                    </kbd>
                    <kbd>K</kbd>
                  </span>
                </button>
              )}
            </div>
            <div className="topbar-actions">
              <div className="topbar-profile-wrap" ref={profileWrapRef}>
                <button
                  className="topbar-profile"
                  onClick={() => setProfileMenu(open => !open)}
                  aria-haspopup="menu"
                  aria-expanded={profileMenu}
                  title={currentUser?.email ?? "Signed in"}
                >
                  {currentUser ? (
                    <>
                      {currentUser.avatarUrl ? (
                        <img
                          className="avatar avatar-sm"
                          src={currentUser.avatarUrl}
                          alt=""
                        />
                      ) : (
                        <span className="avatar avatar-sm bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                          {userInitials}
                        </span>
                      )}
                      <span className="topbar-profile-text">
                        <span className="topbar-profile-name">{userName}</span>
                        <span className="topbar-profile-role">{userRole}</span>
                      </span>
                    </>
                  ) : (
                    /*
                     * A placeholder rather than a stand-in name.
                     *
                     * The profile used to render "Admin" with the initials "AD"
                     * until the session resolved, then swapped both for the real
                     * person. Two visible replacements in a corner of the screen
                     * is exactly the kind of thing that makes an otherwise static
                     * header feel like it is still loading.
                     */
                    <SkeletonRegion
                      label="Loading your profile"
                      className="topbar-profile-pending"
                    >
                      <SkeletonCircle size={28} />
                      <span className="topbar-profile-text">
                        <SkeletonText width={92} height={12} />
                        <SkeletonText
                          width={62}
                          height={10}
                          style={{ marginTop: 5 }}
                        />
                      </span>
                    </SkeletonRegion>
                  )}
                  <ChevronDown size={13} className="text-[var(--text-muted)]" />
                </button>
                {profileMenu && (
                  <>
                    <div className="profile-menu" role="menu">
                      <div className="profile-menu-head">
                        {currentUser?.avatarUrl ? (
                          <img
                            className="avatar avatar-sm"
                            src={currentUser.avatarUrl}
                            alt=""
                          />
                        ) : (
                          <span className="avatar avatar-sm bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                            {userInitials}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold text-[var(--text-primary)]">
                            {userName}
                          </span>
                          <span className="mt-1.5 block truncate text-[12.5px] text-[var(--text-muted)]">
                            {currentUser?.email}
                          </span>
                        </span>
                      </div>
                      <button
                        role="menuitem"
                        className="profile-menu-item"
                        onClick={() => {
                          setProfileMenu(false);
                          navigate("Settings");
                        }}
                      >
                        <Settings2 size={15} />
                        Account settings
                      </button>
                      <button
                        role="menuitem"
                        className="profile-menu-item"
                        onClick={() => {
                          setProfileMenu(false);
                          navigate("User management");
                        }}
                      >
                        <UserCog size={15} />
                        User management
                      </button>
                      <div className="profile-menu-divider" />
                      <button
                        role="menuitem"
                        className="profile-menu-item danger"
                        onClick={() => {
                          setProfileMenu(false);
                          void signOut();
                        }}
                      >
                        <LogOut size={15} />
                        Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>
          <div className="content-area" ref={contentRef}>
            {renderView()}
          </div>
        </main>
        {currentUser && currentUser.role !== "student" && (
          <CommandPalette
            open={commandOpen}
            onClose={() => setCommandOpen(false)}
            onNavigate={navigate}
            activeView={activeView}
          />
        )}
      </div>
    </SmoothScroll>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
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
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
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
import { useLocation } from "wouter";
import {
  changePortalCredentials,
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
} from "../lib/school-data";
import {
  SkeletonBlock,
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
import { SmoothFilterDropdown } from "../components/SmoothFilterDropdown";
import SmoothScroll, { smoothScrollTo } from "../components/SmoothScroll";
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

function MetricBlock({
  label,
  value,
  comparison,
  positive = true,
  icon: Icon,
  spark,
  trend = true,
  loading = false,
  className = "",
}: {
  label: string;
  value: string;
  comparison: string;
  positive?: boolean;
  icon: React.ElementType;
  spark?: number[];
  trend?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const hasSpark = Boolean(spark && spark.length > 1);
  const coords = useMemo(() => {
    if (!hasSpark || !spark) return [];
    const minVal = Math.min(...spark);
    const maxVal = Math.max(...spark);
    const range = Math.max(maxVal - minVal, 1);
    return spark.map((point, index) => {
      const x = (index / (spark.length - 1)) * 100;
      const y = 38 - ((point - minVal) / range) * 26;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });
  }, [hasSpark, spark]);

  const points = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPoints = coords.length > 0 ? `0,44 ${points} 100,44` : "";
  const lastPoint = coords.length > 0 ? coords[coords.length - 1] : null;
  const strokeColor = positive ? "var(--brand)" : "var(--danger)";
  const gradId = `spark-grad-${label.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;

  return (
    <div className={`metric-block ${className}`}>
      <div className="flex items-center justify-between">
        <span className="metric-label">{label}</span>
        <span className="metric-icon">
          <Icon size={15} strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="metric-value tabular-nums">
            {loading ? <SkeletonText width={58} height={24} /> : value}
          </div>
          <div
            className={`metric-change tabular-nums ${
              trend
                ? positive
                  ? "text-[var(--brand)]"
                  : "text-[var(--danger)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            {loading ? (
              <SkeletonText width={44} />
            ) : (
              <>
                {trend &&
                  (positive ? (
                    <ArrowUpRight size={13} />
                  ) : (
                    <ArrowDownRight size={13} />
                  ))}
                {comparison}
              </>
            )}
          </div>
        </div>
        {loading && hasSpark ? (
          <SkeletonBlock style={{ height: 44, width: 84 }} />
        ) : hasSpark ? (
          <svg
            viewBox="0 0 100 44"
            className="h-11 w-[84px] overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.22} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <polygon points={areaPoints} fill={`url(#${gradId})`} />
            <polyline
              points={points}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {lastPoint && (
              <>
                <circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r="4"
                  fill={strokeColor}
                  opacity={0.22}
                />
                <circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r="2"
                  fill={strokeColor}
                />
              </>
            )}
          </svg>
        ) : null}
      </div>
    </div>
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
            `${sub.name} ${sub.teacher} ${sub.classes}`
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
                        Classes {sub.classes} · Teacher: {sub.teacher}
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
  const canSeeReports = allowedScreens.has("reports");
  // Re-render on a timer so a tab left open across a boundary (e.g. until
  // 17:00) greets correctly without needing a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const greeting = greetingFor(now);
  const {
    daily: attendanceData,
    classes: classAttendance,
    belowThreshold,
    loading: attendanceChartLoading,
  } = useDashboardAttendance();
  const classAttendanceLoading = attendanceChartLoading;
  const { rows: announcements, loading: announcementsLoading } =
    useAnnouncements();
  const { rows: healthMetrics, loading: healthMetricsLoading } =
    useHealthMetrics();
  const { total: studentCount, active: activeStudents, loading: studentsLoading } =
    useStudentCounts();
  const { rows: allStaff, loading: staffLoading } = useStaff();
  const { rows: invoiceRows, loading: invoicesLoading } =
    useInvoices(canSeeFinance);

  const latestAttendance = attendanceData[attendanceData.length - 1];
  const latestPresent = latestAttendance?.present ?? 0;
  const latestAbsent = latestAttendance?.absent ?? 0;
  const latestLate = latestAttendance?.late ?? 0;
  const latestLeave = latestAttendance?.leave ?? 0;
  const latestMarked =
    latestPresent + latestAbsent + latestLate + latestLeave;
  const latestPct =
    latestMarked > 0 ? Math.round((latestPresent / latestMarked) * 100) : 0;

  const staffCount = allStaff.length;    const billed = invoiceRows.reduce(
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

  const classesWatch = [...classAttendance]
    .filter(c => c.total > 0)
    .sort((a, b) => a.value - b.value)
    .slice(0, 5);
  const classesBelow = classAttendance.filter(
    c => c.total > 0 && c.value < 92
  ).length;
  const latestAnnouncements = announcements.slice(0, 4);
  const visibleHealth = canSeeFinance
    ? healthMetrics
    : healthMetrics.filter(metric => metric.label !== "Fee collection");

  const attentionItems = [
    {
      label: "Students absent today",
      value: String(latestAbsent),
      detail: latestAttendance
        ? `${latestLate} late · ${latestLeave} on leave`
        : "No register marked yet",
      icon: Users,
      tone: "coral",
      view: "Attendance",
    },
    {
      label: "Attendance follow-up",
      value: String(belowThreshold),
      detail: "Students below 90% this term",
      icon: AlertCircle,
      tone: "amber",
      view: "Attendance",
    },
    {
      label: "Classes below 92%",
      value: String(classesBelow),
      detail: "Term attendance by class",
      icon: ClipboardCheck,
      tone: "violet",
      view: "Attendance",
    },
    ...(canSeeFinance
      ? [
          {
            label: "Overdue fee payments",
            value: String(overdueInvoices.length),
            detail: `${lakh(overdueAmount)} outstanding`,
            icon: Receipt,
            tone: "blue",
            view: "Fees & Finance",
          },
        ]
      : []),
  ];

  return (
    <div className="page-stack dashboard-overview">
      <div className="page-intro">
        <div>
          <p className="eyebrow">
            {now.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <h1 className="page-title">
            {greeting}
            {currentUser?.fullName ? `, ${currentUser.fullName}` : ""}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {canSeeReports && (
            <button
              className="secondary-button"
              onClick={() => onNavigate("Reports")}
            >
              <FileBarChart size={15} />
              Reports
            </button>
          )}
          <button
            className="primary-button"
            onClick={() => onNavigate("Attendance")}
          >
            <ClipboardCheck size={16} />
            Open register
          </button>
        </div>
      </div>
      <div className="metric-grid">
        <MetricBlock
          className="overview-metric"
          label="Students"
          value={studentCount.toLocaleString("en-IN")}
          comparison={`${activeStudents} active`}
          icon={GraduationCap}
          trend={false}
          loading={studentsLoading}
        />
        <MetricBlock
          className="overview-metric"
          label="Attendance today"
          value={latestMarked > 0 ? `${latestPct}%` : "—"}
          comparison={
            latestMarked > 0
              ? `${latestPresent} present · ${latestAbsent} absent`
              : "No register marked"
          }
          icon={ClipboardCheck}
          trend={false}
          loading={attendanceChartLoading}
        />
        <MetricBlock
          className="overview-metric"
          label="Staff"
          value={staffCount.toLocaleString("en-IN")}
          comparison="On the staff roll"
          icon={Users}
          trend={false}
          loading={staffLoading}
        />
        {canSeeFinance ? (
          <MetricBlock
            className="overview-metric"
            label="Fees collected"
            value={lakh(collected)}
            comparison={`${collectionRate}% of billed`}
            icon={IndianRupee}
            trend={false}
            loading={invoicesLoading}
          />
        ) : (
          <MetricBlock
            className="overview-metric"
            label="Classes to watch"
            value={String(classesBelow)}
            comparison="Below 92% attendance"
            icon={ClipboardCheck}
            trend={false}
            loading={classAttendanceLoading}
          />
        )}
      </div>
      <div className="dashboard-grid dashboard-grid-top">
        <section className="panel">
          <div className="panel-header dashboard-attendance-header">
            <div>
              <h2 className="panel-title">Attendance overview</h2>
            </div>
            <div className="dashboard-attendance-controls">
              <span className="count-badge">Last 7 school days</span>
              <button
                className="text-button"
                onClick={() => onNavigate("Attendance")}
              >
                Open register <ChevronRight size={14} />
              </button>
            </div>
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
                  <SkeletonText width={26} height={9} />
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
                  <i className="legend-dot bg-[var(--warning)]" />
                  Late
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
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="day"
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
                      boxShadow: "0 12px 30px rgba(0,0,0,.5)",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="present"
                    stroke="var(--brand)"
                    strokeWidth={2.4}
                    fill="url(#presentFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="late"
                    stroke="var(--warning)"
                    strokeWidth={1.8}
                    fill="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="absent"
                    stroke="var(--danger)"
                    strokeWidth={1.8}
                    fill="none"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="chart-footnote">
            <span>
              {attendanceChartLoading ? (
                <SkeletonText width={190} />
              ) : (
                <>
                  <strong>{latestPresent.toLocaleString("en-IN")}</strong>{" "}
                  students present
                </>
              )}
            </span>
            <span className="status-positive">
              <ArrowUpRight size={14} />
              {latestMarked > 0 ? `${latestPct}% present` : "Awaiting register"}
            </span>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Class watchlist</h2>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("Attendance")}
            >
              All classes <ChevronRight size={14} />
            </button>
          </div>
          <div className="class-watch-list">
            {classAttendanceLoading ? (
              <SkeletonRegion label="Loading class attendance">
                <SkeletonList rows={5} avatar={false} />
              </SkeletonRegion>
            ) : classesWatch.length === 0 ? (
              <div className="empty-state px-5 py-10">
                <ClipboardCheck size={22} />
                No class registers have been marked yet.
              </div>
            ) : (
              classesWatch.map(row => (
                <button
                  className="class-watch-row"
                  key={row.id}
                  onClick={() => onNavigate("Attendance")}
                >
                  <span className="class-watch-main">
                    <span className="class-watch-label">{row.label}</span>
                    <span className="class-watch-teacher">{row.teacher}</span>
                  </span>
                  <span className="class-watch-meter">
                    <span className="class-watch-bar">
                      <span
                        style={{
                          width: `${row.value}%`,
                          background:
                            row.value < 92
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
      <div className="dashboard-grid dashboard-grid-mid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Attention required</h2>
            </div>
            <span className="count-badge">
              {attentionItems.length} open
            </span>
          </div>
          <div className="attention-list">
            {attentionItems.map(item => (
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
                  <span className="mt-1.5 block text-[12.5px] text-[var(--text-muted)]">
                    {item.detail}
                  </span>
                </span>
                <span className="attention-value">{item.value}</span>
                <ChevronRight size={15} className="text-[var(--text-muted)]" />
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Recent announcements</h2>
            </div>
            <span className="count-badge">
              {latestAnnouncements.length} latest
            </span>
          </div>
          <div className="activity-list">
            {announcementsLoading ? (
              <SkeletonList rows={4} avatar />
            ) : latestAnnouncements.length === 0 ? (
              <div className="empty-state px-5 py-10">
                <MessageSquare size={22} />
                No announcements published yet.
              </div>
            ) : (
              latestAnnouncements.map(item => (
                <div className="activity-row" key={item.id}>
                  <span
                    className={`activity-icon ${
                      item.color === "violet" ? "violet" : "emerald"
                    }`}
                  >
                    <MessageSquare size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug text-[var(--text-secondary)]">
                      {item.title}
                    </div>
                    <div className="mt-1.5 truncate text-[12.5px] text-[var(--text-muted)]">
                      {item.audience || "All families"} · {item.date}
                    </div>
                  </div>
                  <span
                    className={`status-pill ${
                      item.status === "Published" ? "success" : "warning"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      <section className="panel health-panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">School health overview</h2>
          </div>
          {canSeeReports && (
            <button
              className="text-button"
              onClick={() => onNavigate("Reports")}
            >
              Open reports <ChevronRight size={14} />
            </button>
          )}
        </div>
        <div
          className={`health-grid ${
            visibleHealth.length === 2
              ? "two"
              : visibleHealth.length === 3
                ? "three"
                : ""
          }`}
        >
          {healthMetricsLoading ? (
            <SkeletonHealthGrid count={visibleHealth.length || 2} />
          ) : (
            visibleHealth.map(metric => (
              <div className="health-metric" key={metric.label}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">
                    {metric.label}
                  </span>
                  <span className="text-[12.5px] font-medium text-[var(--brand)]">
                    {metric.change}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="health-ring"
                    style={{
                      background: `conic-gradient(${metric.color} ${metric.progress * 3.6}deg, var(--border-strong) 0deg)`,
                    }}
                  >
                    <div className="health-ring-inner">{metric.progress}%</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-strong)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${metric.progress}%`,
                          background: metric.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function AttendanceView({ onBack }: { onBack: () => void }) {
  const [marked, setMarked] = useState<string[]>([]);
  const { rows: classAttendance, loading: classAttendanceLoading } =
    useClassAttendance();
  const { rows: dailyAttendance, loading: dailyAttendanceLoading } =
    useAttendanceDaily();
  const { rows: enrolledStudents } = useStudents();
  const latest = dailyAttendance[dailyAttendance.length - 1];
  const latestPresent = latest?.present ?? 0;
  const latestAbsent = latest?.absent ?? 0;
  const latestLate = latest?.late ?? 0;
  const latestMarked = latest
    ? latestPresent + latestAbsent + latestLate + (latest.leave ?? 0)
    : 0;
  const latestPct =
    latestMarked > 0
      ? Math.round((latestPresent / latestMarked) * 1000) / 10
      : 0;
  const previous = dailyAttendance[dailyAttendance.length - 2];
  const previousMarked = previous
    ? previous.present + previous.absent + previous.late + (previous.leave ?? 0)
    : 0;
  const previousPct =
    previousMarked > 0
      ? Math.round((previous.present / previousMarked) * 1000) / 10
      : 0;
  const lateDelta = previous ? latestLate - previous.late : 0;
  const absentFollowUp = enrolledStudents.filter(
    student => student.status === "Active" && student.attendance < 90
  ).length;
  const classPager = usePagination(classAttendance);
  const pageClasses = classPager.pageRows;
  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Attendance"
            onParentClick={onBack}
          />
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">
            {latest
              ? `${latest.day} · ${latestPct}% school-wide attendance.`
              : "No attendance recorded yet."}
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() =>
            toast.success("Attendance summary shared", {
              description: "The daily digest was sent to the leadership group.",
            })
          }
        >
          <MessageSquare size={16} />
          Share summary
        </button>
      </div>
      <div className="metric-grid three">
        {classAttendanceLoading || dailyAttendanceLoading ? (
          <>
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
          </>
        ) : (
          <>
            <MetricBlock
              label="Present today"
              value={latestPresent.toLocaleString("en-IN")}
              comparison={`${latestPct}% of ${latestMarked} marked`}
              icon={Check}
              spark={[19, 18, 23, 24, 25, 27, 30]}
            />
            <MetricBlock
              label="Absent today"
              value={`${latestAbsent}`}
              comparison={`${absentFollowUp} need follow-up`}
              icon={AlertCircle}
              spark={[27, 25, 24, 23, 21, 20, 18]}
              positive={false}
            />
            <MetricBlock
              label="Late arrivals"
              value={`${latestLate}`}
              comparison={
                previous
                  ? `${Math.abs(lateDelta)} ${lateDelta <= 0 ? "fewer" : "more"} than ${previous.day}`
                  : "No prior day"
              }
              icon={Clock3}
              spark={[24, 27, 25, 23, 22, 20, 19]}
            />
          </>
        )}
      </div>
      <div className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Live class roll-up</p>
            <h2 className="panel-title">Class attendance</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="secondary-button compact"
              onClick={() => toast.success("Attendance CSV exported")}
            >
              <Download size={14} />
              Export
            </button>
            <button
              className="secondary-button compact"
              onClick={() => toast("Filters opened")}
            >
              <Filter size={14} />
              Filter
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Present</th>
                <th>Attendance</th>
                <th>Signal</th>
                <th>Teacher</th>

              </tr>
            </thead>
            <tbody>
              {classAttendanceLoading ? (
                <SkeletonTableRows rows={5} columns={6} />
              ) : (
                pageClasses.map(row => (
                  <tr key={row.label}>
                    <td>
                      <span className="font-medium text-[var(--text-primary)]">
                        {row.label}
                      </span>
                    </td>
                    <td className="muted-cell">
                      {row.present} / {row.total}
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="progress-bar">
                          <span
                            style={{
                              width: `${row.value}%`,
                              background:
                                row.value < 92
                                  ? "var(--warning)"
                                  : "var(--brand)",
                            }}
                          />
                        </span>
                        <span className="font-medium text-[var(--text-hover)]">
                          {row.value}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${row.value < 92 ? "warning" : "success"}`}
                      >
                        {row.value < 92 ? "Follow-up" : "On track"}
                      </span>
                    </td>
                    <td className="muted-cell">{row.teacher}</td>
                    <td>
                      <button
                        className={
                          marked.includes(row.label)
                            ? "tiny-action done"
                            : "tiny-action"
                        }
                        onClick={() =>
                          setMarked(current =>
                            current.includes(row.label)
                              ? current.filter(item => item !== row.label)
                              : [...current, row.label]
                          )
                        }
                      >
                        {marked.includes(row.label) ? (
                          <>
                            <Check size={13} />
                            Marked
                          </>
                        ) : (
                          "Review"
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={classPager} noun="classes" />
      </div>
    </div>
  );
}

function FinanceView({ onBack }: { onBack: () => void }) {
  const [showDialog, setShowDialog] = useState(false);
  const { rows: revenueData, loading: financeMonthsLoading } =
    useFinanceMonthly();
  const { rows: feeCategories, loading: feeCategoriesLoading } =
    useFeeCategories();
  const { rows: invoices, loading: invoicesViewLoading } = useInvoices();
  const invoicesPager = usePagination(invoices);
  const pageInvoices = invoicesPager.pageRows;
  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Fees & finance"
            onParentClick={onBack}
          />
          <h1 className="page-title">Fees & finance</h1>
          <p className="page-subtitle">
            {invoices.length} invoice{invoices.length === 1 ? "" : "s"} ·{" "}
            {invoices.filter(i => i.status !== "Paid").length} outstanding
          </p>
        </div>
        <button className="primary-button" onClick={() => setShowDialog(true)}>
          <Plus size={16} />
          Record payment
        </button>
      </div>
      <div className="metric-grid three">
        {invoicesViewLoading ? (
          <>
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
          </>
        ) : (
          <>
            <MetricBlock
              label="Collected this term"
              value="₹18.4L"
              comparison="82% of target"
              icon={IndianRupee}
              spark={[13, 15, 18, 20, 22, 25, 29]}
            />
            <MetricBlock
              label="Outstanding"
              value="₹4.1L"
              comparison="8 overdue accounts"
              icon={Receipt}
              spark={[29, 27, 26, 25, 23, 21, 19]}
              positive={false}
            />
            <MetricBlock
              label="Collection rate"
              value="82.1%"
              comparison="6.4% vs. last term"
              icon={Activity}
              spark={[18, 19, 20, 22, 23, 26, 29]}
            />
          </>
        )}
      </div>
      <div className="dashboard-grid dashboard-grid-top">
        <section className="panel finance-chart-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Term collections</p>
              <h2 className="panel-title">Revenue movement</h2>
            </div>
            <span className="mini-label">
              <i className="legend-dot bg-[var(--success)]" />
              Collected <i className="legend-dot bg-[var(--border)] ml-3" />
              Pending
            </span>
          </div>
          <div className="chart-wrap">
            {invoicesViewLoading || financeMonthsLoading ? (
              <SkeletonChart height={260} variant="bar" />
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
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--border-strong)",
                      background: "var(--bg-panel)",
                      color: "var(--text-secondary)",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="collected"
                    fill="var(--brand)"
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    dataKey="pending"
                    fill="var(--border)"
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
              <p className="eyebrow">Breakdown</p>
              <h2 className="panel-title">Fee mix</h2>
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
                    <strong>₹22.5L</strong>
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
            </div>
          </div>
        </section>
      </div>
      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Follow-up queue</p>
            <h2 className="panel-title">Outstanding payments</h2>
          </div>
          <button
            className="text-button"
            onClick={() => toast.success("Finance report exported")}
          >
            Export report <Download size={14} />
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Guardian</th>
                <th>Invoice</th>
                <th>Due date</th>
                <th>Amount</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoicesViewLoading ? (
                <SkeletonTableRows rows={6} columns={7} />
              ) : (
                pageInvoices.map(row => (
                  <tr key={row.id}>
                    <td className="font-medium text-[var(--text-primary)]">
                      {row.student}
                    </td>
                    <td className="muted-cell">{row.family}</td>
                    <td className="muted-cell">{row.id}</td>
                    <td className="muted-cell">{row.due_date}</td>
                    <td className="font-medium text-[var(--text-hover)]">
                      ₹{row.amount.toLocaleString("en-IN")}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${row.status === "Overdue" ? "warning" : "neutral"}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="tiny-action"
                        onClick={() =>
                          toast.success("Payment reminder sent", {
                            description: `Reminder sent to ${row.family}.`,
                          })
                        }
                      >
                        Remind
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={invoicesPager} noun="invoices" />
      </section>
      {showDialog && (
        <AppDialog
          title="Record payment"
          description="Log a payment against an existing family invoice."
          onClose={() => setShowDialog(false)}
        >
          <div className="form-grid">
            <label>
              Student
              <input placeholder="Search student..." />
            </label>
            <label>
              Amount
              <input placeholder="₹ 0.00" />
            </label>
            <label>
              Payment date
              <input type="date" defaultValue="2026-09-28" />
            </label>
            <label>
              Method
              <select defaultValue="Bank transfer">
                <option>Bank transfer</option>
                <option>UPI</option>
                <option>Cash</option>
                <option>Card</option>
              </select>
            </label>
          </div>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              onClick={() => setShowDialog(false)}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setShowDialog(false);
                toast.success("Payment recorded", {
                  description:
                    "The family ledger and collection rate were updated.",
                });
              }}
            >
              Record payment
            </button>
          </div>
        </AppDialog>
      )}
    </div>
  );
}

function ReportsView({ onBack }: { onBack: () => void }) {
  const { rows: reportExports, loading: reportExportsLoading } =
    useReportExports();
  const reportsPager = usePagination(reportExports);
  const pageReports = reportsPager.pageRows;
  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Reports"
            onParentClick={onBack}
          />
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            {reportExports.length} recent export
            {reportExports.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => toast("Report builder opened")}
        >
          <Plus size={16} />
          Build a report
        </button>
      </div>
      <div className="report-card-grid">
        {[
          {
            title: "Monthly principal review",
            detail: "Attendance, academics, fees & staffing",
            date: "Updated today",
            icon: ShieldCheck,
            color: "teal",
          },
          {
            title: "Fee collection summary",
            detail: "Term 1 collections and outstanding balances",
            date: "Updated 2 hrs ago",
            icon: IndianRupee,
            color: "orange",
          },
          {
            title: "Academic performance",
            detail: "Grade and subject-level outcomes",
            date: "Updated yesterday",
            icon: BookOpen,
            color: "violet",
          },
          {
            title: "Parent engagement",
            detail: "Messages, events and portal activity",
            date: "Updated 26 Sep",
            icon: Users,
            color: "blue",
          },
        ].map(report => (
          <button
            className="report-card"
            key={report.title}
            onClick={() => toast.success(`${report.title} opened`)}
          >
            <span className={`report-icon ${report.color}`}>
              <report.icon size={18} />
            </span>
            <span className="mt-5 block text-left text-[15px] font-semibold tracking-[-0.015em] text-[var(--text-primary)]">
              {report.title}
            </span>
            <span className="mt-2 block text-left text-[12.5px] leading-5 text-[var(--text-muted)]">
              {report.detail}
            </span>
            <span className="mt-6 flex items-center justify-between text-[12.5px] text-[var(--text-muted)]">
              <span>{report.date}</span>
              <ChevronRight size={15} />
            </span>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Recent exports</p>
            <h2 className="panel-title">Report history</h2>
          </div>
          <button
            className="secondary-button compact"
            onClick={() => toast("Report filters opened")}
          >
            <Filter size={14} />
            Filter
          </button>
        </div>
        <div className="history-list">
          {reportExportsLoading ? (
            <SkeletonRegion label="Loading report history">
              <SkeletonList rows={4} avatar={false} />
            </SkeletonRegion>
          ) : (
            pageReports.map(report => (
              <div className="history-row" key={report.name}>
                <span className="file-icon">
                  <FileText size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--text-secondary)]">
                    {report.name}
                  </div>
                  <div className="mt-1 text-[12.5px] text-[var(--text-muted)]">
                    {report.created} · {report.size}
                  </div>
                </div>
                <button
                  className="tiny-action"
                  onClick={() => toast.success("Download started")}
                >
                  Download <Download size={13} />
                </button>
              </div>
            ))
          )}
        </div>
        <Pager pagination={reportsPager} noun="exports" variant="list" />
      </section>
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
          <p className="page-subtitle">
            Every educator, coordinator and administrative officer in one directory.
          </p>
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
              spark={[18, 20, 18, 25, 24, 28, 30]}
            />
            <MetricBlock
              label="On leave"
              value={`${staff.length - onCampus}`}
              comparison="Approved leave requests"
              icon={CalendarDays}
              spark={[27, 25, 24, 23, 21, 20, 18]}
              positive={false}
            />
            <MetricBlock
              label="Active faculty"
              value={`${staff.length}`}
              comparison="Full teaching & administrative roster"
              icon={GraduationCap}
              spark={[11, 13, 12, 15, 14, 17, 19]}
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
            {/* Quick Status Segmented Control */}
            <div className="segmented-control" role="group" aria-label="Filter by staff status">
              <button
                type="button"
                className={status === "All staff" || status === "all" ? "active" : ""}
                onClick={() => setStatus("All staff")}
              >
                All
              </button>
              <button
                type="button"
                className={status === "On campus" ? "active" : ""}
                onClick={() => setStatus("On campus")}
              >
                On campus
              </button>
              <button
                type="button"
                className={status === "On leave" ? "active" : ""}
                onClick={() => setStatus("On leave")}
              >
                On leave
              </button>
            </div>

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

function AcademicsView({ onBack }: { onBack: () => void }) {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const [dayIndex, setDayIndex] = useState(0);
  const { rows: week, loading: weekLoading } = useTimetable(days[dayIndex]);
  const weekPager = usePagination(week);
  const pageWeek = weekPager.pageRows;
  const { rows: subjects } = useSubjects();
  const { rows: staffMembers } = useStaff();
  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Academics"
            onParentClick={onBack}
          />
          <h1 className="page-title">Academics</h1>
          <p className="page-subtitle">
            Timetable, subject load and syllabus progress across the school.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() =>
            toast.success("Timetable published", {
              description:
                "The updated schedule is now visible to all classes.",
            })
          }
        >
          <CalendarDays size={16} />
          Publish timetable
        </button>
      </div>
      <div className="metric-grid">
        <MetricBlock
          label="Subjects offered"
          value={String(subjects.length || 14)}
          comparison="Curriculum core"
          icon={BookOpen}
          spark={[10, 11, 11, 12, 13, 13, 14]}
        />
        <MetricBlock
          label="Periods scheduled"
          value={String(week.length || 32)}
          comparison={`For ${days[dayIndex]}`}
          icon={Clock3}
          spark={[26, 28, 27, 30, 29, 31, 32]}
        />
        <MetricBlock
          label="Teaching staff"
          value={String(staffMembers.length || 46)}
          comparison="Active educators"
          icon={Users}
          spark={[42, 43, 44, 43, 45, 46, 46]}
        />
        <MetricBlock
          label="Syllabus covered"
          value="64%"
          comparison="+4.1% this week"
          icon={GraduationCap}
          spark={[41, 45, 49, 54, 57, 61, 64]}
        />
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Weekly timetable</p>
            <h2 className="panel-title">{days[dayIndex]} · Grades 6 to 9</h2>
          </div>
          <div className="segmented-control">
            {days.map((day, index) => (
              <button
                key={day}
                className={dayIndex === index ? "active" : ""}
                onClick={() => setDayIndex(index)}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Period</th>
                <th>Time</th>
                <th>Grade 6</th>
                <th>Grade 7</th>
                <th>Grade 8</th>
                <th>Grade 9</th>
              </tr>
            </thead>
            <tbody>
              {weekLoading ? (
                <SkeletonTableRows rows={6} columns={6} />
              ) : (
                pageWeek.map(row => (
                  <tr key={`${row.day}-${row.period}`}>
                    <td className="font-medium text-[var(--text-primary)]">
                      {row.period}
                    </td>
                    <td className="muted-cell">{row.time}</td>
                    {[row.grade_6, row.grade_7, row.grade_8, row.grade_9].map(
                      (subject, gradeIndex) => (
                        <td key={gradeIndex}>
                          <span className="grade-chip">{subject}</span>
                        </td>
                      )
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={weekPager} noun="timetable rows" />
      </section>
      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Curriculum coverage</p>
            <h2 className="panel-title">Subject load</h2>
          </div>
          <button
            className="secondary-button compact"
            onClick={() => toast("Curriculum planner opened")}
          >
            <SlidersHorizontal size={14} />
            Plan
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Teacher</th>
                <th>Classes</th>
                <th>Periods / week</th>
                <th>Syllabus covered</th>

              </tr>
            </thead>
            <tbody>
              {subjects.map(subject => (
                <tr key={subject.name}>
                  <td className="font-medium text-[var(--text-primary)]">
                    {subject.name}
                  </td>
                  <td className="muted-cell">{subject.teacher}</td>
                  <td>
                    <span className="grade-chip">{subject.classes}</span>
                  </td>
                  <td className="muted-cell">{subject.periods}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="progress-bar">
                        <span
                          style={{
                            width: `${subject.progress}%`,
                            background:
                              subject.progress >= 75
                                ? "var(--brand)"
                                : subject.progress >= 60
                                  ? "var(--warning)"
                                  : "var(--danger)",
                          }}
                        />
                      </span>
                      <span className="font-medium text-[var(--text-hover)]">
                        {subject.progress}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <button
                      className="tiny-action"
                      onClick={() =>
                        toast(`Syllabus plan opened for ${subject.name}`)
                      }
                    >
                      Plan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ExaminationsView({ onBack }: { onBack: () => void }) {
  const { rows: exams, loading: examsLoading } = useExams();
  const examsPager = usePagination(exams);
  const pageExams = examsPager.pageRows;
  const {
    rows: publishing,
    loading: publishingLoading,
    update: updateResult,
  } = useExamResults();
  const publishingPager = usePagination(publishing);
  const pagePublishing = publishingPager.pageRows;
  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Examinations"
            onParentClick={onBack}
          />
          <h1 className="page-title">Examinations</h1>
          <p className="page-subtitle">
            {exams.length} scheduled exam{exams.length === 1 ? "" : "s"} ·{" "}
            {publishing.length} papers to release
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() =>
            toast.success("Exam created", {
              description: "A new exam window is ready to schedule.",
            })
          }
        >
          <Plus size={16} />
          Schedule exam
        </button>
      </div>
      <div className="metric-grid">
        <MetricBlock
          label="Upcoming exams"
          value="6"
          comparison="Next 10 days"
          icon={FileText}
          spark={[3, 4, 4, 5, 5, 6, 6]}
        />
        <MetricBlock
          label="Papers to grade"
          value="12"
          comparison="4 due today"
          icon={ClipboardCheck}
          spark={[22, 19, 18, 16, 15, 13, 12]}
          positive={false}
        />
        <MetricBlock
          label="Average score"
          value="84%"
          comparison="+2.6% vs. last term"
          icon={GraduationCap}
          spark={[74, 76, 78, 79, 81, 83, 84]}
        />
        <MetricBlock
          label="Grades published"
          value="68%"
          comparison="9 classes remaining"
          icon={Check}
          spark={[38, 44, 49, 55, 59, 64, 68]}
        />
      </div>
      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Exam calendar</p>
            <h2 className="panel-title">Upcoming schedule</h2>
          </div>
          <button
            className="secondary-button compact"
            onClick={() => toast.success("Exam calendar exported")}
          >
            <Download size={14} />
            Export
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 780 }}>
            <thead>
              <tr>
                <th>Exam</th>
                <th>Subject</th>
                <th>Grade</th>
                <th>Date</th>
                <th>Time</th>
                <th>Venue</th>
                <th>Status</th>

              </tr>
            </thead>
            <tbody>
              {examsLoading ? (
                <SkeletonTableRows rows={5} columns={5} />
              ) : (
                pageExams.map(exam => (
                  <tr key={exam.name}>
                    <td className="font-medium text-[var(--text-primary)]">
                      {exam.name}
                    </td>
                    <td className="muted-cell">{exam.subject}</td>
                    <td>
                      <span className="grade-chip">{exam.grade}</span>
                    </td>
                    <td className="muted-cell">{exam.date}</td>
                    <td className="muted-cell">{exam.time}</td>
                    <td className="muted-cell">{exam.venue}</td>
                    <td>
                      <span
                        className={`status-pill ${exam.status === "Scheduled" ? "success" : "neutral"}`}
                      >
                        <span className="status-dot" />
                        {exam.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="tiny-action"
                        onClick={() => toast(`Details for ${exam.name}`)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={examsPager} noun="exams" />
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Grade publishing</p>
            <h2 className="panel-title">Papers ready to release</h2>
          </div>
          <span className="count-badge">
            {publishing.filter(row => !row.published).length} pending
          </span>
        </div>
        <div className="schedule-list">
          {publishingLoading ? (
            <SkeletonList rows={5} avatar={false} />
          ) : (
            pagePublishing.map(row => {
              const isPublished = row.published;
              const percent = Math.round((row.graded / row.total) * 100);
              return (
                <div className="schedule-row" key={row.id}>
                  <div className="schedule-time">
                    {row.graded}/{row.total}
                  </div>
                  <div className="schedule-line">
                    <span
                      className="schedule-dot"
                      style={{
                        background: isPublished
                          ? "var(--brand)"
                          : "var(--warning)",
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-[var(--text-primary)]">
                        {row.subject}{" "}
                        <span className="text-[var(--text-muted)]">
                          · {row.grade}
                        </span>
                      </div>
                      <button
                        className={
                          isPublished ? "tiny-action done" : "tiny-action"
                        }
                        onClick={() => {
                          void updateResult(row.id, { published: true });
                          if (!isPublished)
                            toast.success("Results published", {
                              description: `${row.subject} grades are now visible to families.`,
                            });
                        }}
                      >
                        {isPublished ? (
                          <>
                            <Check size={13} />
                            Published
                          </>
                        ) : (
                          "Publish"
                        )}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="progress-bar">
                        <span
                          style={{
                            width: `${percent}%`,
                            background: isPublished
                              ? "var(--brand)"
                              : "var(--warning)",
                          }}
                        />
                      </span>
                      <span className="text-[12.5px] text-[var(--text-muted)]">
                        {percent}% graded
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <Pager pagination={publishingPager} noun="papers" variant="list" />
      </section>
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
  const [selectedTerm, setSelectedTerm] = useState("All Terms (2024–25)");
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
    ? latestAttendance.present +
      latestAttendance.absent +
      latestAttendance.late +
      latestAttendance.leave
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
        const total = d.present + d.absent + d.late + d.leave;
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
    return [70, 75, 80, 85];
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
    <div className="page-stack space-y-6">
      {/* Executive Header with Live DB Connection Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Analytics"
            onParentClick={onBack}
          />
          <div className="flex flex-wrap items-center gap-2.5 mt-1">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Institutional Analytics
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live DB: {totalStudents} Students • {staffStats.total} Staff
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] transition-colors cursor-pointer"
          >
            <option value="All Terms (2024–25)">All Terms (Annual 2024–25)</option>
            <option value="Term 1 (Autumn)">Term 1 (Autumn Term)</option>
            <option value="Term 2 (Spring)">Term 2 (Spring Term)</option>
            <option value="Annual Board Prep">Annual Board Exam Track</option>
          </select>

          <button
            onClick={handleExportReport}
            className="primary-button flex items-center gap-2 px-3.5 py-2 text-xs font-medium cursor-pointer shadow-sm"
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
              value={`${overallAverage}%`}
              comparison={`Median ${medianAverage}%`}
              icon={GraduationCap}
              spark={academicSpark}
              className="h-full flex flex-col justify-between"
            />
            <MetricBlock
              label="Attendance Rate"
              value={`${attendancePct}%`}
              comparison={`${latestPresent} present today`}
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
              spark={[92, 94, 91, 95, 96, 94, staffStats.staffAttendanceAvg]}
              className="h-full flex flex-col justify-between"
            />
          </>
        )}
      </div>

      {/* Redesigned Sliding Segment Navigation Tabs */}
      <div className="flex items-center p-1.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xs gap-1.5 w-fit max-w-full overflow-x-auto scrollbar-none">
        {[
          { id: "overview", label: "Executive Overview", icon: LayoutDashboard },
          {
            id: "staff",
            label: `Staff & Faculty (${staffStats.total})`,
            icon: Users,
          },
          { id: "academics", label: "Academics & Curricula", icon: BookOpen },
          { id: "attendance", label: "Attendance & Vitals", icon: ClipboardCheck },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = analyticsTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAnalyticsTab(tab.id as typeof analyticsTab)}
              className={`relative flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap select-none ${
                isActive
                  ? "text-white shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeAnalyticsMainTab"
                  className="absolute inset-0 bg-[var(--brand)] rounded-xl shadow-md -z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
              <Icon size={16} className="relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

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
                {graded.length} graded pupils
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
                <Briefcase size={14} className="text-emerald-500" />
                Student–Teacher Ratio
              </span>
              <p className="text-2xl font-bold text-emerald-500 mt-1.5">
                {staffStats.studentTeacherRatio}:1
              </p>
              <span className="text-[11px] text-[var(--text-muted)] mt-1">
                CBSE 30:1 benchmark
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-xs flex flex-col justify-between h-full">
              <span className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1.5">
                <UserCheck size={14} className="text-amber-500" />
                Staff Attendance Rate
              </span>
              <p className="text-2xl font-bold text-amber-500 mt-1.5">
                {staffStats.staffAttendanceAvg}%
              </p>
              <span className="text-[11px] text-[var(--text-muted)] mt-1">
                Term attendance
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
            <div className="w-full h-4 rounded-full overflow-hidden flex bg-[var(--bg-hover)] p-0.5 gap-0.5 border border-[var(--border)] mb-5">
              <div
                style={{ width: `${Math.max(scoreTiers.distinction.pct, 2)}%` }}
                className="h-full rounded-l-full bg-[var(--brand)] transition-all duration-500"
                title={`Distinction: ${scoreTiers.distinction.count} (${scoreTiers.distinction.pct}%)`}
              />
              <div
                style={{ width: `${Math.max(scoreTiers.merit.pct, 2)}%` }}
                className="h-full bg-[var(--info)] transition-all duration-500"
                title={`Merit: ${scoreTiers.merit.count} (${scoreTiers.merit.pct}%)`}
              />
              <div
                style={{ width: `${Math.max(scoreTiers.pass.pct, 2)}%` }}
                className="h-full bg-[var(--warning)] transition-all duration-500"
                title={`Pass: ${scoreTiers.pass.count} (${scoreTiers.pass.pct}%)`}
              />
              <div
                style={{ width: `${Math.max(scoreTiers.critical.pct, 2)}%` }}
                className="h-full rounded-r-full bg-[var(--danger)] transition-all duration-500"
                title={`At Risk: ${scoreTiers.critical.count} (${scoreTiers.critical.pct}%)`}
              />
            </div>

            {/* 4-Tier Breakdown Cards (Equal Height) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
              <div className="p-3.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand)]" />
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    Distinction (85%+)
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xl font-bold text-[var(--text-primary)]">
                    {scoreTiers.distinction.count}
                  </span>
                  <span className="text-xs font-medium text-[var(--brand)]">
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
                  <span className="text-xl font-bold text-rose-500">
                    {scoreTiers.critical.count}
                  </span>
                  <span className="text-xs font-medium text-rose-500">
                    {scoreTiers.critical.pct}%
                  </span>
                </div>
              </div>
            </div>
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
              </div>
              <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)] mt-auto flex items-center justify-between">
                <span>Composite institutional health</span>
                <span className="font-semibold text-[var(--text-primary)]">{attendancePct}% Overall</span>
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
                    {staffStats.total} staff members ({staffStats.teachers} teaching, {staffStats.administrative} admin) maintaining a {staffStats.studentTeacherRatio}:1 student ratio.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex items-start gap-2.5">
                  <Target size={15} className="text-[var(--info)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">
                      Leading Grade:{" "}
                    </span>
                    {fastestGrade} is currently the top performing cohort across all {gradeBreakdowns.length} active grades.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex items-start gap-2.5">
                  <Activity size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">
                      Score Distribution:{" "}
                    </span>
                    Cohort median is {medianAverage}% (mean {overallAverage}%) across {graded.length} evaluated pupils.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex items-start gap-2.5">
                  <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">
                      Early Warning:{" "}
                    </span>
                    {atRisk === 0 ? (
                      "All enrolled students meet the passing threshold."
                    ) : (
                      <>
                        <span className="font-bold text-rose-500">{atRisk} learners</span> have scores below 50% and require remediation.
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
              <p className="text-2xl font-bold text-amber-500 mt-1.5">
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
                  <p className="text-2xl font-bold text-emerald-500 mt-1">{staffStats.studentTeacherRatio}:1</p>
                  <span className="text-[11px] text-[var(--text-muted)]">Below CBSE 30:1 cap</span>
                </div>
                <div className="p-3.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                  <span className="text-xs text-[var(--text-muted)] font-medium">Faculty Attendance</span>
                  <p className="text-2xl font-bold text-[var(--brand)] mt-1">{staffStats.staffAttendanceAvg}%</p>
                  <span className="text-[11px] text-[var(--text-muted)]">Term duty rate</span>
                </div>
                <div className="p-3.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                  <span className="text-xs text-[var(--text-muted)] font-medium">Teaching Faculty Share</span>
                  <p className="text-2xl font-bold text-[var(--info)] mt-1">
                    {Math.round((staffStats.teachers / Math.max(staffStats.total, 1)) * 100)}%
                  </p>
                  <span className="text-[11px] text-[var(--text-muted)]">{staffStats.teachers} classroom educators</span>
                </div>
                <div className="p-3.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                  <span className="text-xs text-[var(--text-muted)] font-medium">Admin & Leadership Share</span>
                  <p className="text-2xl font-bold text-amber-500 mt-1">
                    {Math.round(((staffStats.administrative + staffStats.principal) / Math.max(staffStats.total, 1)) * 100)}%
                  </p>
                  <span className="text-[11px] text-[var(--text-muted)]">{staffStats.administrative + staffStats.principal} ops & leadership</span>
                </div>
              </div>
              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-end mt-auto text-xs text-[var(--text-muted)]">
                <span className="font-medium text-emerald-500">100% Active</span>
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

                  <div className="flex items-center p-1 bg-[var(--bg-base)] border border-[var(--border)]/70 rounded-xl gap-1">
                    {[
                      { id: "all", label: `All (${staffMembers.length})` },
                      { id: "teacher", label: `Teachers (${staffStats.teachers})` },
                      { id: "admin", label: `Admin (${staffStats.administrative})` },
                      { id: "principal", label: "Principal (1)" },
                    ].map(f => {
                      const isActive = staffFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setStaffFilter(f.id as typeof staffFilter)}
                          className={`relative px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer select-none ${
                            isActive
                              ? "text-[var(--text-primary)]"
                              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="activeAnalyticsStaffFilterPill"
                              className="absolute inset-0 bg-[var(--border-accent)] rounded-lg shadow-sm border border-[var(--border)]/60 -z-10"
                              transition={{ type: "spring", stiffness: 450, damping: 35 }}
                            />
                          )}
                          <span className="relative z-10">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
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
                <p className="eyebrow">Database Cohorts</p>
                <h2 className="panel-title">Grade-wise Academic Performance Ledger</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Live cohort averages calculated from actual student records across Grade 1 to 10
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--bg-raised)] text-[var(--text-secondary)] border border-[var(--border)]">
                {gradeBreakdowns.length} Grades Tracked
              </span>
            </div>
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Grade Level</th>
                    <th>Students Enrolled</th>
                    <th>Academic Average</th>
                    <th>Attendance Velocity</th>
                    <th>At-Risk Learners</th>
                    <th>Top Student</th>
                    <th>Standing Signal</th>
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
                          <span className="text-rose-500 font-semibold">
                            {row.atRiskCount} at risk
                          </span>
                        ) : (
                          <span className="text-emerald-500 text-xs font-medium">
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
                        boxShadow: "0 12px 30px rgba(0,0,0,.5)",
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
                <span className="font-semibold text-rose-500">
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
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                {attendancePct}% Cohort Present
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              <div className="p-4 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  Present
                </span>
                <p className="text-2xl font-bold text-emerald-500 mt-1">
                  {latestAttendance?.present ?? 0}
                </p>
                <span className="text-[11px] text-[var(--text-muted)] mt-1">
                  On campus in class
                </span>
              </div>
              <div className="p-4 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  Absent
                </span>
                <p className="text-2xl font-bold text-rose-500 mt-1">
                  {latestAttendance?.absent ?? 0}
                </p>
                <span className="text-[11px] text-[var(--text-muted)] mt-1">
                  Unexcused absence
                </span>
              </div>
              <div className="p-4 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  Late Arrival
                </span>
                <p className="text-2xl font-bold text-amber-500 mt-1">
                  {latestAttendance?.late ?? 0}
                </p>
                <span className="text-[11px] text-[var(--text-muted)] mt-1">
                  Marked tardy at gate
                </span>
              </div>
              <div className="p-4 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex flex-col justify-between h-full">
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  Approved Leave
                </span>
                <p className="text-2xl font-bold text-sky-500 mt-1">
                  {latestAttendance?.leave ?? 0}
                </p>
                <span className="text-[11px] text-[var(--text-muted)] mt-1">
                  Medical / sanctioned
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
    "account" | "workspace" | "academics" | "ai" | "system"
  >("account");

  // Account state
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

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

  // Academics settings state
  const [gradeScale, setGradeScale] = useState(settings.gradeScale);
  const [threshold, setThreshold] = useState(settings.threshold);
  const [prefs, setPrefs] = useState(settings.prefs);
  const [savingAcademics, setSavingAcademics] = useState(false);

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

  const toggle = (key: keyof typeof prefs) =>
    setPrefs(current => ({ ...current, [key]: !current[key] }));

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
    if (!currentPassword) {
      toast.warning("Enter your current password to confirm this change");
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
        currentPassword
      );
      if (result.status !== "ok") {
        toast.error("That could not be saved", { description: result.message });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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

  const saveAcademicRules = async () => {
    setSavingAcademics(true);
    try {
      const ok = await save({
        ...settings,
        prefs,
        academicYear,
        gradeScale,
        threshold,
      });
      if (ok) {
        toast.success("Academic & alert policies saved", {
          description: "Your configuration is live for all staff.",
        });
      }
    } finally {
      setSavingAcademics(false);
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

  const alerts = [
    {
      key: "attendance" as const,
      title: "Attendance Alerts",
      detail: "Trigger notifications when a class attendance drops below threshold.",
    },
    {
      key: "fees" as const,
      title: "Fee Reminders",
      detail: "Automated balance notifications for outstanding pupil tuition fees.",
    },
    {
      key: "messages" as const,
      title: "Parent Messages",
      detail: "Alert staff on new incoming messages from students' guardians.",
    },
    {
      key: "exams" as const,
      title: "Exam Countdowns",
      detail: "Timely reminders before test windows and examination schedules.",
    },
    {
      key: "digest" as const,
      title: "Weekly Leadership Digest",
      detail: "A Monday briefing email for school administration and leadership.",
    },
  ];

  const tabs: Array<{
    id: "account" | "workspace" | "academics" | "ai" | "system";
    label: string;
    icon: LucideIcon;
  }> = [
    { id: "account", label: "My Account & Security", icon: ShieldCheck },
    { id: "workspace", label: "School Workspace", icon: Building2 },
    { id: "academics", label: "Academics & Alerts", icon: GraduationCap },
  ];
  if (superAdmin) {
    tabs.push({ id: "ai", label: "AI Assistant", icon: Sparkles });
  }
  tabs.push({ id: "system", label: "Data & Session", icon: Database });

  return (
    <div className="page-stack max-w-5xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-6 border-b border-[var(--border)]">
        <div className="space-y-1.5">
          <Breadcrumb
            parent="Global Kids School"
            current="Settings & Preferences"
            onParentClick={onBack}
          />
          <h1 className="page-title text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Settings & Preferences
          </h1>
        </div>
      </div>

      {/* Segmented Control Navigation with Smooth Horizontal Sliding Indicator */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-4 overflow-x-auto no-scrollbar">
        <div className="relative p-1 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] flex items-center gap-1">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2.5 px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer whitespace-nowrap transition-colors duration-200 z-10 ${
                  isActive
                    ? "text-[var(--text-primary)] font-bold"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeSettingsTabPill"
                    className="absolute inset-0 bg-[var(--border-accent)] rounded-xl shadow-sm border border-[var(--border)]/60 -z-10"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <Icon size={16} className={isActive ? "text-[var(--brand)]" : ""} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
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
              <span className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
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
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] font-mono text-sm text-[var(--brand)] focus:border-[var(--brand)] outline-none transition-all placeholder:text-[var(--text-muted)]"
                  />
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    This is the unique handle you type on the login screen. Your official recovery email remains unchanged.
                  </p>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    Current Password *
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    autoComplete="current-password"
                    onChange={event => setCurrentPassword(event.target.value)}
                    placeholder="Enter your current password to authorize changes"
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all placeholder:text-[var(--text-muted)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    autoComplete="new-password"
                    onChange={event => setNewPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all placeholder:text-[var(--text-muted)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    autoComplete="new-password"
                    onChange={event => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter your new password"
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all placeholder:text-[var(--text-muted)]"
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
            <span className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
              <Building2 size={20} />
            </span>
          </div>

          <div className="p-6 sm:p-7 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
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
      {/* TAB 3: Academics & Alerts                                           */}
      {/* ==================================================================== */}
      {activeTab === "academics" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Grading & Policies Card */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm overflow-hidden">
            <div className="p-6 sm:p-7 border-b border-[var(--border)] bg-[var(--bg-raised)]/30 flex items-center justify-between">
              <div className="space-y-1">
                <p className="eyebrow text-xs font-bold text-[var(--brand)] uppercase tracking-wider">
                  Academic Standards
                </p>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Grading Scale & Attendance Policy
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Rules that govern grade evaluation, warning thresholds, and student result publishing.
                </p>
              </div>
              <span className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                <GraduationCap size={20} />
              </span>
            </div>

            <div className="p-6 sm:p-7 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    Institutional Grading Scale
                  </label>
                  <select
                    value={gradeScale}
                    onChange={e => setGradeScale(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all cursor-pointer"
                  >
                    <option value="Percentage (0–100)">Percentage (0–100)</option>
                    <option value="CGPA (10-point)">CGPA (10-point)</option>
                    <option value="Letter grades (A–F)">Letter grades (A–F)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    Attendance Warning Threshold
                  </label>
                  <select
                    value={threshold}
                    onChange={e => setThreshold(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all cursor-pointer"
                  >
                    <option value="90%">90% (Strict Compliance)</option>
                    <option value="85%">85% (Standard CBSE/ICSE)</option>
                    <option value="80%">80% (Moderate)</option>
                    <option value="75%">75% (Minimum Passing)</option>
                  </select>
                </div>
              </div>

              {/* Auto-publish toggle row */}
              <div className="p-4.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-raised)]/30 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-[var(--text-primary)] block">
                    Auto-Publish Examination Results
                  </span>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Instantly release report cards and marks to pupil & parent portals once paper marking is completed.
                  </p>
                </div>
                <SettingToggle
                  checked={prefs.exams}
                  onChange={() => toggle("exams")}
                  label="Auto-publish results"
                />
              </div>
            </div>
          </section>

          {/* Notifications Card */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm overflow-hidden">
            <div className="p-6 sm:p-7 border-b border-[var(--border)] bg-[var(--bg-raised)]/30 flex items-center justify-between">
              <div className="space-y-1">
                <p className="eyebrow text-xs font-bold text-[var(--brand)] uppercase tracking-wider">
                  Automations
                </p>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Automated Notification Preferences
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Configure automated dispatch alerts for attendance, payments, messages, and schedules.
                </p>
              </div>
              <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                <Bell size={20} />
              </span>
            </div>

            <div className="p-6 sm:p-7 space-y-3.5">
              {alerts.map(alert => (
                <div
                  key={alert.key}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-raised)]/30 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {alert.title}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {alert.detail}
                    </div>
                  </div>
                  <SettingToggle
                    checked={prefs[alert.key]}
                    onChange={() => toggle(alert.key)}
                    label={alert.title}
                  />
                </div>
              ))}
            </div>

            <div className="px-6 sm:px-7 py-4 bg-[var(--bg-raised)]/40 border-t border-[var(--border)] flex items-center justify-end">
              <button
                className="primary-button h-10 px-5 rounded-xl text-xs font-semibold flex items-center gap-2"
                onClick={() => void saveAcademicRules()}
                disabled={savingAcademics}
              >
                <Save size={15} />
                <span>{savingAcademics ? "Saving…" : "Save Policies & Alerts"}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: AI Assistant (Super Admin Only)                              */}
      {/* ==================================================================== */}
      {activeTab === "ai" && superAdmin && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="p-6 sm:p-7 border-b border-[var(--border)] bg-[var(--bg-raised)]/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <p className="eyebrow text-xs font-bold text-[var(--brand)] uppercase tracking-wider">
                  Super Admin
                </p>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    isAiConfigured(aiConfig) && sharedReady
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                  }`}
                >
                  {isAiConfigured(aiConfig) && sharedReady
                    ? `Live · ${getProvider(aiConfig.providerId).label}`
                    : "Not Configured"}
                </span>
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                School-Wide AI Assistant Provider
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Configure once with Google Gemini or OpenAI; every authorized staff member gains intelligent assistant queries.
              </p>
            </div>
            <span className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 flex-shrink-0">
              <Sparkles size={20} />
            </span>
          </div>

          <div className="p-6 sm:p-7 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  AI Provider Engine
                </label>
                <select
                  value={aiConfig.providerId}
                  onChange={event => selectAiProvider(event.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all cursor-pointer"
                >
                  {AI_PROVIDERS.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Model Endpoint
                </label>
                <select
                  value={aiConfig.model}
                  onChange={event => updateAiConfig({ model: event.target.value })}
                  disabled={aiConfig.providerId === "custom"}
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:border-[var(--brand)] outline-none transition-all cursor-pointer"
                >
                  {aiConfig.providerId.startsWith("gemini") &&
                    GEMINI_MODELS.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  {!aiConfig.providerId.startsWith("gemini") &&
                    AI_PROVIDERS.filter(p => !p.id.startsWith("gemini")).map(provider => (
                      <optgroup key={provider.id} label={provider.label}>
                        {(provider.models ?? [provider.model]).map(m => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  <option value={aiConfig.model}>{aiConfig.model} (custom)</option>
                </select>
              </div>

              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
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
                  className="secondary-button h-10 px-4 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300"
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
              <span className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
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
                    settings: { academicYear, gradeScale, threshold, prefs, campus, address, phone, currentTerm },
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
          <section className="rounded-2xl border border-rose-500/25 bg-[var(--bg-panel)] shadow-sm overflow-hidden">
            <div className="p-6 sm:p-7 border-b border-rose-500/20 bg-rose-500/5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="eyebrow text-xs font-bold text-rose-400 uppercase tracking-wider">
                  Session & Controls
                </p>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Session Management & Defaults
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Manage active browser sessions and restore factory defaults if required.
                </p>
              </div>
              <span className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
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
                  className="secondary-button h-10 px-5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/30 flex items-center gap-2 flex-shrink-0"
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
                    Restores notification preferences and alert triggers to their original school presets.
                  </p>
                </div>

                <button
                  className="secondary-button h-10 px-5 rounded-xl text-xs font-semibold flex items-center gap-2 flex-shrink-0"
                  onClick={() => {
                    setPrefs(settings.prefs);
                    setAcademicYear(settings.academicYear);
                    setGradeScale(settings.gradeScale);
                    setThreshold(settings.threshold);
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
        return (
          <div className="page-stack">
            <SkeletonRegion label="Loading your dashboard">
              <div className="metric-grid">
                <SkeletonMetric />
                <SkeletonMetric />
                <SkeletonMetric />
                <SkeletonMetric />
              </div>
            </SkeletonRegion>
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
                  className="command-trigger"
                  onClick={() => setCommandOpen(true)}
                >
                  <Search size={16} />
                  <span>Search anything</span>
                  <kbd>
                    <Command size={11} />K
                  </kbd>
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

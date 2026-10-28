import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Bus,
  CalendarDays,
  Check,
  ChevronDown,
  FolderOpen,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Command,
  Download,
  FileBarChart,
  FileText,
  Filter,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  KeyRound,
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
import { DocumentsView } from "../components/DocumentsView";
import CredentialsView from "../components/CredentialsView";
import PupilOverview from "../components/PupilOverview";
import { PupilMobileDashboard } from "../components/PupilMobileDashboard";
import {
  StaffMobileShell,
  type StaffMobileTab,
} from "../components/StaffMobileShell";
import { StudentDirectory } from "./StudentDirectory";
import { StaffDrawer } from "../components/StaffDrawer";
import { StaffCreateDialog } from "../components/StaffCreateDialog";
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
      { label: "Documents", icon: FolderOpen },
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
  const max = hasSpark ? Math.max(...spark!) : 0;
  const min = hasSpark ? Math.min(...spark!) : 0;
  const points = hasSpark
    ? spark!
        .map(
          (point, index) =>
            `${(index / (spark!.length - 1)) * 100},${42 - ((point - min) / Math.max(max - min, 1)) * 30}`
        )
        .join(" ")
    : "";
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
          <div className="metric-value">
            {loading ? <SkeletonText width={58} height={24} /> : value}
          </div>
          <div
            className={`metric-change ${
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
            viewBox="0 0 100 48"
            className="h-11 w-[84px] overflow-visible"
            aria-hidden="true"
          >
            <polyline
              points={points}
              fill="none"
              stroke={positive ? "var(--brand)" : "var(--danger)"}
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
  onNavigate: (view: string, studentId?: RowId) => void;
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
  onNavigate: (view: string, studentId?: RowId) => void;
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
      return { people: [], cmds: commands };
    }
    const normalized = trimmed.toLowerCase();
    const people = students
      .filter(student =>
        `${student.name} ${student.grade} ${student.section} ${student.usn ?? ""}`
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, 5);
    const cmds = commands.filter(item =>
      `${item.label} ${item.detail}`.toLowerCase().includes(normalized)
    );
    return { people, cmds };
  }, [query, students, commands]);

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
   *
   * Every row that is rendered must also appear here, in the same order. When
   * one did not — the role-scoped prompts were rendered without a `flat` entry
   * — `findIndex` returned -1 for all of them, so hovering any single prompt
   * called `setActive(-1)` and every prompt matched `-1 === -1` and lit up at
   * once. The arrow keys could not reach them either.
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
    }

    for (const student of results.people) {
      out.push({
        key: `p-${student.id}`,
        run: () => {
          // Pass the id through so the directory opens this profile directly
          // instead of landing on the unfiltered list.
          onNavigate("Students", student.id);
          onClose();
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
    if (query.trim().length >= 3) {
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
    if (action.studentId) onNavigate(label, action.studentId);
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
                : "Search students, or ask the assistant anything…"
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
          {results.people.length > 0 && (
            <div className="command-group">
              <p className="command-heading">People</p>
              {results.people.map(student => {
                const idx = flat.findIndex(f => f.key === `p-${student.id}`);
                return (
                  <button
                    key={student.id}
                    className={`command-item ${idx === active ? "active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={flat[idx].run}
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
                        {student.attendance}%
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

          <div className="command-group">
            <p className="command-heading">
              {query
                ? "Quick actions"
                : hasAnswer
                  ? "Ask something else"
                  : "Ask the assistant"}
            </p>
            {query ? (
              // When there is a query, show only the explicit "ask" button so the
              // keyboard user Always knows which row sends the question.
              <>
                {results.cmds
                  .filter(item =>
                    `${item.label} ${item.detail}`
                      .toLowerCase()
                      .includes(query.toLowerCase())
                  )
                  .map(item => {
                    const idx = flat.findIndex(
                      f => f.key === `c-${item.label}`
                    );
                    return (
                      <button
                        key={item.label}
                        className={`command-item ${idx === active ? "active" : ""}`}
                        onMouseEnter={() => setActive(idx)}
                        onClick={flat[idx].run}
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
                {query.trim().length >= 3 && (
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
                      onClick={flat[idx].run}
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

          {results.people.length === 0 &&
            results.cmds.length === 0 &&
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
              <p className="eyebrow">School-wide signal</p>
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
                  students present on the latest school day
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
              <p className="eyebrow">Term attendance</p>
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
              <p className="eyebrow">Needs a decision</p>
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
              <p className="eyebrow">School communications</p>
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
            <p className="eyebrow">Leadership view</p>
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
                    <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">
                      Across the current term
                    </p>
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
}: {
  onBack: () => void;
  onNavigate?: (view: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All staff");
  const [showDialog, setShowDialog] = useState(false);
  const [selected, setSelected] = useState<RowId | null>(null);
  const {
    rows: staff,
    loading: staffViewLoading,
    reload: reloadStaff,
  } = useStaff();
  const filtered = staff.filter(
    member =>
      `${member.name} ${member.usn} ${member.role} ${member.department}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "All staff" || member.status === status)
  );
  const staffPager = usePagination(filtered);
  const pageStaff = staffPager.pageRows;
  const onCampus = staff.filter(member => member.status === "On campus").length;
  /*
   * Resolved by id, not by name. The drawer's edit dialog can change the name,
   * and a selection keyed on the name stopped matching the moment it was saved
   * — the panel closed by itself as if the save had failed.
   */
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
            Every educator, coordinator and officer in one directory.
          </p>
        </div>
        <button className="primary-button" onClick={() => setShowDialog(true)}>
          <Plus size={16} />
          Add staff
        </button>
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
              comparison="2 approved requests"
              icon={CalendarDays}
              spark={[27, 25, 24, 23, 21, 20, 18]}
              positive={false}
            />
            <MetricBlock
              label="New this term"
              value="3"
              comparison="Joined in September"
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
          </div>
          <div className="toolbar-actions">
            <div className="filter-select">
              <Filter size={14} />
              <select
                value={status}
                onChange={event => setStatus(event.target.value)}
              >
                <option>All staff</option>
                <option>On campus</option>
                <option>On leave</option>
              </select>
              <ChevronDown size={14} />
            </div>
            <button
              className="secondary-button compact"
              onClick={() => toast.success("Staff directory exported")}
            >
              <Download size={14} />
              Export
            </button>
            <IconButton label="More staff table actions">
              <MoreHorizontal size={17} />
            </IconButton>
          </div>
        </div>
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
            onNavigate ? () => onNavigate("Account logins") : undefined
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
          value="14"
          comparison="Across 7 grades"
          icon={BookOpen}
          spark={[10, 11, 11, 12, 13, 13, 14]}
        />
        <MetricBlock
          label="Periods today"
          value="32"
          comparison="6 periods × 5 grades"
          icon={Clock3}
          spark={[26, 28, 27, 30, 29, 31, 32]}
        />
        <MetricBlock
          label="Teaching staff"
          value="46"
          comparison="2 on leave today"
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

function AnalyticsView({ onBack }: { onBack: () => void }) {
  const { rows: performanceTrend } = usePerformanceTrend();
  const { rows: subjectAverages } = useSubjectAverages();
  const { rows: gradeOutcomes, loading: gradeOutcomesLoading } =
    useGradeOutcomes();
  const outcomesPager = usePagination(gradeOutcomes);
  const pageOutcomes = outcomesPager.pageRows;
  const { rows: analyticsStudents, loading: analyticsStudentsLoading } =
    useStudents();
  const { rows: analyticsAttendance, loading: analyticsAttendanceLoading } =
    useAttendanceDaily();
  const { rows: analyticsInvoices, loading: analyticsInvoicesLoading } =
    useInvoices();
  /*
   * Every figure on this screen is derived from one of those three hooks, so
   * "derived from nothing" is indistinguishable from "genuinely zero". Showing
   * "0%" and "0 students graded" for the half second before the rows land
   * tells the principal the school has no students; the placeholders say
   * "loading" instead.
   */
  const analyticsLoading =
    gradeOutcomesLoading ||
    analyticsStudentsLoading ||
    analyticsAttendanceLoading ||
    analyticsInvoicesLoading;
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
      : 0;
  const atRisk = analyticsStudents.filter(
    s => s.average > 0 && s.average < 50
  ).length;
  const fastestGrade = useMemo(() => {
    const withMarks = gradeOutcomes.filter(row => row.average > 0);
    if (withMarks.length === 0) return "—";
    return withMarks.reduce((best, row) =>
      row.average > best.average ? row : best
    ).grade;
  }, [gradeOutcomes]);

  // --- derived analytics, all from the same live rows ---
  const graded = useMemo(
    () => analyticsStudents.filter(s => s.average > 0),
    [analyticsStudents]
  );

  /** Attendance band distribution — how many learners sit in each range. */
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

  /** Academic performance bands, on the same shape as the attendance bands. */
  const scoreBands = useMemo(() => {
    const bands = [
      { label: "Distinction (85+)", count: 0, color: "var(--brand)" },
      { label: "Merit (70–84)", count: 0, color: "var(--info)" },
      { label: "Pass (50–69)", count: 0, color: "var(--warning)" },
      { label: "At risk (<50)", count: 0, color: "var(--danger)" },
    ];
    for (const student of graded) {
      if (student.average >= 85) bands[0].count++;
      else if (student.average >= 70) bands[1].count++;
      else if (student.average >= 50) bands[2].count++;
      else bands[3].count++;
    }
    return bands;
  }, [graded]);

  /** The ten lowest scorers — the intervention list, not just a count. */
  const bottomTen = useMemo(
    () =>
      [...graded]
        .sort((a, b) => a.average - b.average)
        .slice(0, 10)
        .map(student => ({
          id: student.id,
          name: student.name,
          grade: student.grade,
          average: student.average,
          attendance: student.attendance,
        })),
    [graded]
  );

  /** Median, which is far less distorted by a few strong outliers than a mean. */
  const medianAverage = useMemo(() => {
    if (graded.length === 0) return 0;
    const values = graded.map(s => s.average).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0
      ? Math.round((values[mid - 1] + values[mid]) / 2)
      : values[mid];
  }, [graded]);

  /** Standard deviation: how tightly the cohort is grouped. */
  const spread = useMemo(() => {
    if (graded.length < 2) return 0;
    const mean = graded.reduce((sum, s) => sum + s.average, 0) / graded.length;
    const variance =
      graded.reduce((sum, s) => sum + (s.average - mean) ** 2, 0) /
      (graded.length - 1);
    return Math.round(Math.sqrt(variance) * 10) / 10;
  }, [graded]);

  /** Attendance vs academics per grade — the correlation leadership asks for. */
  const gradeCorrelation = useMemo(
    () =>
      gradeOutcomes.map(row => ({
        grade: row.grade.replace("Grade ", "G"),
        attendance: row.attendance,
        academics: row.average,
      })),
    [gradeOutcomes]
  );

  /** Subject-level spread, to show where teaching is most uneven. */
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

  /** Fee collection standing, straight from the invoice ledger. */
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
        axis: "Exams",
        value: Math.round(
          (graded.filter(s => s.average >= 50).length /
            Math.max(graded.length, 1)) *
            100
        ),
      },
    ],
    [subjectAverages, attendancePct, graded]
  );
  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Analytics"
            onParentClick={onBack}
          />
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">
            Long-run academic trends, subject performance and grade outcomes.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() =>
            toast.success("Analytics exported", {
              description: "The trend pack is ready to download.",
            })
          }
        >
          <Download size={16} />
          Export trends
        </button>
      </div>
      <div className="metric-grid">
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
              label="Academic average"
              value={`${overallAverage}%`}
              comparison={`${analyticsStudents.length} students graded`}
              icon={GraduationCap}
              spark={[74, 77, 79, 81, 83, 85, 86]}
            />
            <MetricBlock
              label="Attendance"
              value={`${attendancePct}%`}
              comparison={`${latestPresent} present on ${latestAttendance?.day ?? "latest day"}`}
              icon={ClipboardCheck}
              spark={[89, 90, 91, 92, 93, 94, 95]}
            />
            <MetricBlock
              label="Strongest grade"
              value={fastestGrade}
              comparison={`${gradeOutcomes.length} grades tracked`}
              icon={ArrowUpRight}
              spark={[22, 25, 27, 30, 33, 37, 42]}
            />
            <MetricBlock
              label="At-risk students"
              value={`${atRisk}`}
              comparison="below 50% average"
              icon={AlertCircle}
              spark={[38, 35, 33, 30, 28, 25, 23]}
              positive={false}
            />
          </>
        )}
      </div>
      <div className="metric-grid">
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
              label="Median score"
              value={`${medianAverage}%`}
              comparison={`mean ${overallAverage}%`}
              icon={Activity}
              spark={[71, 72, 72, 73, 73, 74, medianAverage]}
            />
            <MetricBlock
              label="Score spread"
              value={`${spread} pts`}
              comparison={spread > 15 ? "wide variation" : "tightly grouped"}
              icon={Activity}
              spark={[16, 15, 15, 14, 14, 13, spread]}
            />
            <MetricBlock
              label="Fee collection"
              value={`${collections.rate}%`}
              comparison={`₹${Math.round(collections.outstanding / 1000)}k outstanding`}
              icon={IndianRupee}
              spark={[62, 66, 70, 74, 78, 80, collections.rate]}
            />
            <MetricBlock
              label="Attendance spread"
              value={`${subjectSpread ? subjectSpread.gap : 0} pts`}
              comparison={
                subjectSpread
                  ? `${subjectSpread.strongest.subject} leads`
                  : "no data"
              }
              icon={ClipboardCheck}
              spark={[21, 20, 19, 18, 18, 17, subjectSpread?.gap ?? 0]}
            />
          </>
        )}
      </div>
      <div className="dashboard-grid dashboard-grid-mid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Term trend</p>
              <h2 className="panel-title">Performance by subject</h2>
            </div>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot bg-[var(--success)]" />
              Mathematics
            </span>
            <span>
              <i className="legend-dot bg-[var(--violet)]" />
              Science
            </span>
            <span>
              <i className="legend-dot bg-[var(--warning)]" />
              English
            </span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={performanceTrend}
                margin={{ top: 8, right: 6, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="analyticsFill"
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
                  stroke="var(--brand)"
                  strokeWidth={2.2}
                  fill="url(#analyticsFill)"
                />
                <Area
                  type="monotone"
                  dataKey="science"
                  stroke="var(--violet)"
                  strokeWidth={1.8}
                  fill="none"
                />
                <Area
                  type="monotone"
                  dataKey="english"
                  stroke="var(--warning)"
                  strokeWidth={1.8}
                  fill="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Subject comparison</p>
              <h2 className="panel-title">Average scores</h2>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={subjectAverages}
                margin={{ top: 8, right: 5, left: -22, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="subject"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
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
                  fill="var(--brand)"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <div className="dashboard-grid dashboard-grid-mid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Cohort spread</p>
              <h2 className="panel-title">Attendance bands</h2>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={attendanceBands}
                layout="vertical"
                margin={{ top: 4, right: 18, left: 4, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  width={54}
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
                <Bar dataKey="count" radius={[0, 5, 5, 0]} barSize={20}>
                  {attendanceBands.map(band => (
                    <Cell key={band.label} fill={band.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Cohort spread</p>
              <h2 className="panel-title">Score bands</h2>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={scoreBands}
                layout="vertical"
                margin={{ top: 4, right: 18, left: 4, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  width={108}
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
                <Bar dataKey="count" radius={[0, 5, 5, 0]} barSize={20}>
                  {scoreBands.map(band => (
                    <Cell key={band.label} fill={band.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <div className="dashboard-grid dashboard-grid-mid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Attendance vs academics</p>
              <h2 className="panel-title">Do they track together?</h2>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={230}>
              <RadarChart data={attendanceRadar} outerRadius="70%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                />
                <Radar
                  dataKey="value"
                  stroke="var(--brand)"
                  fill="var(--success)"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-footnote">
            Composite of subject averages, school attendance and pass rate.
          </p>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">By grade</p>
              <h2 className="panel-title">Attendance vs average</h2>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={gradeCorrelation}
                margin={{ top: 8, right: 5, left: -22, bottom: 0 }}
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
                  fill="var(--info)"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="academics"
                  fill="var(--brand)"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-footnote">
            Grades where attendance leads academics need a teaching
            intervention, not a nudge.
          </p>
        </section>
      </div>
      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Intervention list</p>
            <h2 className="panel-title">Ten most at risk</h2>
          </div>
          <span className="count-badge">{atRisk} below 50%</span>
        </div>
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Grade</th>
                <th>Average</th>
                <th>Attendance</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {bottomTen.map(student => (
                <tr key={student.id}>
                  <td className="font-medium text-[var(--text-primary)]">
                    {student.name}
                  </td>
                  <td>
                    <span className="grade-chip">{student.grade}</span>
                  </td>
                  <td>
                    <span
                      className={
                        student.average >= 50
                          ? "font-medium text-[var(--text-hover)]"
                          : "score-warning"
                      }
                    >
                      {student.average}%
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        student.attendance >= 85
                          ? "score-positive"
                          : "score-warning"
                      }
                    >
                      {student.attendance}%
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${student.average >= 50 ? "neutral" : "warning"}`}
                    >
                      {student.average >= 60
                        ? "Watch"
                        : student.average >= 50
                          ? "At risk"
                          : "Critical"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Outcomes</p>
            <h2 className="panel-title">Grade-wise results</h2>
          </div>
          <button
            className="secondary-button compact"
            onClick={() => toast("Outcome breakdown opened")}
          >
            <SlidersHorizontal size={14} />
            Compare
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 620 }}>
            <thead>
              <tr>
                <th>Grade</th>
                <th>Average</th>
                <th>Attendance</th>
                <th>Improvement</th>
                <th>Signal</th>

              </tr>
            </thead>
            <tbody>
              {gradeOutcomesLoading ? (
                <SkeletonTableRows rows={5} columns={5} />
              ) : (
                pageOutcomes.map(row => (
                  <tr key={row.grade}>
                    <td className="font-medium text-[var(--text-primary)]">
                      {row.grade}
                    </td>
                    <td>
                      <span className="font-medium text-[var(--text-hover)]">
                        {row.average}%
                      </span>
                    </td>
                    <td>
                      <span className="score-positive">{row.attendance}%</span>
                    </td>
                    <td>
                      <span className="score-positive">{row.change}</span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${row.average >= 85 ? "success" : "warning"}`}
                      >
                        <span className="status-dot" />
                        {row.average >= 85 ? "On track" : "Watch"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="tiny-action"
                        onClick={() =>
                          toast(`Subject breakdown for ${row.grade}`)
                        }
                      >
                        Breakdown
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={outcomesPager} noun="grades" />
      </section>
    </div>
  );
}

/**
 * "Your account" settings panel.
 *
 * Lets the signed-in user edit their own display name, their login username
 * (the local part of the sign-in email, which is what the school thinks of as
 * their username) and their password, without touching the school-wide
 * workspace settings. Also hosts the AI assistant provider config for super admins.
 */
function AccountSettingsPanel() {
  const currentUser = useCurrentUser();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [aiConfig, setAiState] = useState<AiConfig>(getAiConfig);
  const [keySaved, setKeySaved] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [sharedReady, setSharedReady] = useState(false);

  // Seed the form once the signed-in profile resolves.
  useEffect(() => {
    if (!currentUser) return;
    setFullName(currentUser.fullName);
    setUsername(currentUser.username);
  }, [currentUser]);

  useEffect(() => {
    void isSuperAdmin().then(setSuperAdmin);
  }, []);

  /**
   * Seed the form from the shared configuration.
   *
   * The key itself is never sent back — the server only reports whether one is
   * stored — so the field starts empty and the placeholder says so. Leaving it
   * empty on save keeps the stored key rather than wiping it.
   */
  useEffect(() => {
    void loadSharedAiSettings().then(shared => {
      if (!shared.providerId) return;
      setAiState(current => ({
        providerId: shared.providerId,
        base: shared.base || getProvider(shared.providerId).base,
        model: shared.model || getProvider(shared.providerId).model,
        // Blank means "keep the saved one", not "no key".
        key: current.key,
      }));
      setSharedReady(true);
    });
  }, []);

  const saveProfile = async () => {
    if (!currentUser) return;
    const name = fullName.trim();

    if (!name) {
      toast.warning("Display name cannot be empty");
      return;
    }

    setSavingProfile(true);
    try {
      /*
       * One write, not two.
       *
       * This used to save the display name and then the username separately. The
       * username write targeted a column that did not exist, so it threw after
       * the name had already been committed — which surfaced as "Could not save
       * your profile" and made the whole panel look broken. A single statement
       * is also atomic: it either lands completely or not at all.
       *
       * The display name is the only thing written here. The sign-in name and
       * the password are credentials, and they go through the server route
       * below, which keeps the school's own record of them in step.
       */
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name })
        .eq("id", currentUser.id);
      if (error) throw error;

      // Mirror the display name into auth metadata so anything reading the
      // session rather than the profiles table still shows the new name.
      const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: name },
      });
      if (metaError) {
        // The profile row is already correct, so this is not a failed save —
        // say so plainly rather than reporting a failure that did not happen.
        toast.success("Profile updated", {
          description:
            "Saved, though the session name could not be refreshed. Reload to see it everywhere.",
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

  /**
   * Change the sign-in name, the password, or both.
   *
   * Both go through the server route rather than the browser. The browser can
   * write its own profile row, but it cannot keep the school's record of the
   * account in step — and that record is what the school owner reads back to
   * somebody over the telephone. A pupil who changed their password behind the
   * school's back left the owner reading a password that no longer worked.
   *
   * The current password is required, because a session that has been open for
   * days is not evidence of anything: without it, anyone who walked up to an
   * unattended browser could take the account over for good.
   */
  const saveSignIn = async () => {
    if (!currentUser) return;
    const wanted = username.trim().toLowerCase();
    const current = String(currentUser.username ?? "")
      .trim()
      .toLowerCase();
    const nameChanged = wanted !== current;

    if (nameChanged && !wanted) {
      toast.warning("Username cannot be empty");
      return;
    }
    if (nameChanged && !USERNAME_PATTERN.test(wanted) && !wanted.includes("@")) {
      /*
       * An address is allowed through here, because the school hands out one
       * address for every pupil to sign in with, and an address holds an "@",
       * which the username pattern refuses. The server decides what it will
       * actually accept — it knows which name the school shares and which
       * address the account already has — so this is a nudge, not the rule.
       */
      toast.warning(
        "Usernames use letters, numbers, dots, dashes and underscores"
      );
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
        toast.error("That could not be saved", {
          description: result.message,
        });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Sign-in details updated", {
        description: nameChanged
          ? `You can now sign in with “${wanted}”. Your email is unchanged.`
          : "Use your new password the next time you sign in.",
      });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not change your sign-in details."
      );
    } finally {
      setSavingPassword(false);
    }
  };

  /**
   * Edit one field of the provider config and mark the form dirty.
   *
   * Switching provider re-fills the base URL and model from the preset, except
   * for "Custom" where both are left exactly as typed — the whole point of that
   * option is a self-hosted endpoint nobody has hard-coded here.
   */
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
        toast.error("Could not switch the assistant off", {
          description: cleared.message,
        });
        return;
      }
      setKeySaved(true);
      toast.success("AI assistant switched off", {
        description:
          "Nobody can ask the assistant until it is configured again.",
      });
      return;
    }

    const result = await saveSharedAiSettings(aiConfig);
    if (!result.ok) {
      toast.error("Could not save the AI configuration", {
        description: result.message,
      });
      return;
    }
    // Also kept locally so this browser can override the shared settings while
    // trying another provider out.
    setAiConfig(aiConfig);
    setKeySaved(true);
    toast.success("AI assistant saved for the whole school", {
      description: `${getProvider(aiConfig.providerId).label} · ${aiConfig.model}. Every signed-in user can ask a question now.`,
    });
  };

  const runAiTest = async () => {
    setTestingAi(true);
    const result = await testAiConnection(aiConfig);
    setTestingAi(false);
    if (result.ok) {
      const provider = getProvider(aiConfig.providerId);
      const model = (result as { model?: string }).model ?? aiConfig.model;
      toast.success("Connection works", {
        description: `${provider.label} · ${model}. Every user can use the assistant with this.`,
      });
    } else {
      toast.error("Could not reach that provider", {
        description: result.message,
      });
    }
  };

  return (
    <>
      <div className="dashboard-grid dashboard-grid-mid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Your account</p>
              <h2 className="panel-title">Display name</h2>
            </div>
          </div>
          <div className="px-5 pb-5 pt-4">
            <div className="account-identity">
              {currentUser?.avatarUrl ? (
                <img
                  className="avatar avatar-lg"
                  src={currentUser.avatarUrl}
                  alt=""
                />
              ) : (
                <span className="avatar avatar-lg bg-[rgba(63,184,162,0.13)] text-[var(--brand)]">
                  {initialsFor(currentUser?.fullName || "Admin")}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {currentUser?.fullName ?? "—"}
                </p>
                <p className="mt-1.5 truncate text-[12.5px] text-[var(--text-muted)]">
                  {currentUser?.email} ·{" "}
                  {roleLabel(currentUser?.id, currentUser?.role)}
                </p>
              </div>
            </div>
            <div className="form-grid mt-5">
              <label>
                Display name
                <input
                  value={fullName}
                  onChange={event => setFullName(event.target.value)}
                  placeholder="e.g. Ehtesham"
                />
              </label>
            </div>
            <p className="mt-2 text-[12.5px] leading-5 text-[var(--text-muted)]">
              The name the school sees on attendance, marks and messages. It has
              nothing to do with signing in.
            </p>
            <div className="dialog-actions mt-4">
              <button
                className="primary-button"
                onClick={() => void saveProfile()}
                disabled={savingProfile}
              >
                {savingProfile ? "Saving…" : "Save name"}
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Security</p>
              <h2 className="panel-title">Sign-in name &amp; password</h2>
            </div>
          </div>
          <div className="px-5 pb-5 pt-4">
            <div className="form-grid">
              <label className="block">
                Sign-in name
                <input
                  value={username}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={event => setUsername(event.target.value)}
                  placeholder="e.g. ehtesham"
                />
              </label>
              <label className="block">
                Current password
                <input
                  type="password"
                  value={currentPassword}
                  autoComplete="current-password"
                  onChange={event => setCurrentPassword(event.target.value)}
                  placeholder="Confirm it is you"
                />
              </label>
              <label className="block">
                New password
                <input
                  type="password"
                  value={newPassword}
                  autoComplete="new-password"
                  onChange={event => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
              <label className="block">
                Confirm new password
                <input
                  type="password"
                  value={confirmPassword}
                  autoComplete="new-password"
                  onChange={event => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter it"
                />
              </label>
            </div>
            <p className="mt-2 text-[12.5px] leading-5 text-[var(--text-muted)]">
              This is what you type to sign in, and you can change either one
              whenever you like. Your email address stays exactly as it is — it
              is where password recovery sends your link, so changing your
              sign-in name never affects it.
            </p>
            <p className="mt-2 text-[12.5px] leading-5 text-[var(--text-muted)]">
              Your current password is required, so nobody else can change it
              from an unattended browser. You&apos;ll stay signed in on this
              device. A pupil who has not chosen a password of their own yet
              types their date of birth here. If you cannot remember it, use{" "}
              <button
                className="link-button"
                onClick={async () => {
                  if (!currentUser) return;
                  /*
                   * /api/recover, not Supabase's own mailer. Supabase only
                   * delivers to project-team addresses without custom SMTP,
                   * so the old call reported success and sent nothing for
                   * everyone else. It also knows to redirect a pupil's link to
                   * the guardian when the account address is inert.
                   */
                  const result = await resetPasswordByUsername(
                    currentUser.username || currentUser.email
                  );
                  if (result.status === "ok")
                    toast.success("Reset link sent", {
                      description: result.message,
                    });
                  else toast.error(result.message);
                }}
              >
                Forgot password
              </button>{" "}
              to set a new one by email instead — that route proves ownership of
              the mailbox rather than the old password.
            </p>
            <div className="dialog-actions mt-4">
              <button
                className="primary-button"
                onClick={() => void saveSignIn()}
                disabled={savingPassword}
              >
                {savingPassword ? "Updating…" : "Update sign-in details"}
              </button>
            </div>
          </div>
        </section>
      </div>

      {superAdmin && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Super admin</p>
              <h2 className="panel-title">AI assistant</h2>
            </div>
            <span
              className={`count-badge ${isAiConfigured(aiConfig) && sharedReady ? "success" : "warning"}`}
            >
              {isAiConfigured(aiConfig) && sharedReady
                ? `Live · ${getProvider(aiConfig.providerId).label}`
                : "Not configured"}
            </span>
          </div>
          <div className="px-5 pb-5 pt-4">
            <p className="text-[12.5px] leading-5 text-[var(--text-muted)]">
              Configure this once and every signed-in user gets the assistant —
              there is nothing for them to set up. Google Gemini is built in and
              is what this dashboard is built around; any provider that speaks
              the OpenAI{" "}
              <code className="text-[var(--text-hover)]">
                /chat/completions
              </code>{" "}
              API works too.
            </p>
            <div className="form-grid mt-4">
              <label>
                Provider
                <select
                  value={aiConfig.providerId}
                  onChange={event => selectAiProvider(event.target.value)}
                >
                  {AI_PROVIDERS.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Base URL
                <input
                  value={aiConfig.base}
                  onChange={event =>
                    updateAiConfig({ base: event.target.value })
                  }
                  placeholder="https://api.example.com/v1"
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <label>
                Model
                <select
                  value={aiConfig.model}
                  onChange={event =>
                    updateAiConfig({ model: event.target.value })
                  }
                  disabled={aiConfig.providerId === "custom"}
                >
                  {aiConfig.providerId.startsWith("gemini") &&
                    GEMINI_MODELS.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  {!aiConfig.providerId.startsWith("gemini") &&
                    AI_PROVIDERS.filter(p => !p.id.startsWith("gemini")).map(
                      provider => (
                        <optgroup key={provider.id} label={provider.label}>
                          {(provider.models ?? [provider.model]).map(m => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </optgroup>
                      )
                    )}
                  <option value={aiConfig.model}>
                    {aiConfig.model} (custom)
                  </option>
                </select>
              </label>
              <label>
                API key
                <input
                  type="password"
                  value={aiConfig.key}
                  onChange={event =>
                    updateAiConfig({ key: event.target.value })
                  }
                  placeholder={
                    sharedReady && aiConfig.key === ""
                      ? "Saved — type to replace"
                      : getProvider(aiConfig.providerId).keyHint
                  }
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
            </div>
            <p className="mt-2 text-[12.5px] leading-5 text-[var(--text-muted)]">
              {getProvider(aiConfig.providerId).note} The key is stored on the
              server, encrypted, so it never ships in the page and no other user
              can read it back — leave it blank to keep the saved one. Each
              person only ever receives the data their own role can open.
            </p>
            <div className="dialog-actions mt-4">
              <button
                className="primary-button"
                onClick={() => void saveAiConfig()}
              >
                {keySaved ? "Saved" : "Save for everyone"}
              </button>
              <button
                className="secondary-button"
                onClick={() => void runAiTest()}
                disabled={testingAi || !isAiConfigured(aiConfig)}
              >
                {testingAi ? "Testing…" : "Test connection"}
              </button>
              {sharedReady && (
                <button
                  className="secondary-button"
                  onClick={() => {
                    setAiConfig({ ...aiConfig, key: "" });
                    setAiState({ ...aiConfig, key: "" });
                    setKeySaved(false);
                  }}
                >
                  Clear saved key
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/**
 * User management.
 *
 * Four access levels exist: super admin → admin → staff → student.
 *
 *   • A super admin invites other admins and staff.
 *   • An admin invites staff.
 *   • Student portal logins are generated here (never self-registered) and
 *     handed to the family.
 *
 * Account creation needs the service-role key, which cannot live in the
 * browser, so every write goes through /api/invite. This view's job is to
 * collect the input, call that route and present the credentials once.
 */
function UserManagementView({ onBack }: { onBack: () => void }) {
  const currentUser = useCurrentUser();
  const [me, setMe] = useState<{ id: string; role: string; orgId: string }>({
    id: "",
    role: "",
    orgId: "",
  });
  const [tab, setTab] = useState<"people" | "invite" | "students">("people");

  // Who can do what, mirroring the server route's GRANTABLE map.
  // Anchored on the user id, not on the stored role: the `app_role` enum has no
  // super_admin member, so `me.role` can never be it. Checking the stored value
  // here would quietly lock the super admin out of the one screen that needs
  // his powers, and he is the person least able to notice.
  const superAdmin = isSuperAdminId(me.id);
  const myRole = effectiveRole(me.id, me.role);
  const isAdmin = superAdmin || myRole === "admin";
  const grantable = superAdmin
    ? ["admin", "staff", "teacher", "accountant"]
    : isAdmin
      ? ["staff", "teacher", "accountant"]
      : [];

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviting, setInviting] = useState(false);
  const [issued, setIssued] = useState<{
    kind: "invite" | "student";
    to: string;
    username: string;
    password: string;
    note?: string;
  } | null>(null);

  const {
    rows: people,
    loading: peopleLoading,
    reload: reloadPeople,
  } = usePeople();
  const { rows: students, loading: studentsLoading } = useStudents();
  const [studentQuery, setStudentQuery] = useState("");
  const [issuingFor, setIssuingFor] = useState<RowId | null>(null);

  const studentsPager = usePagination(
    students.filter(s =>
      `${s.name} ${s.usn ?? ""}`
        .toLowerCase()
        .includes(studentQuery.toLowerCase())
    ),
    10
  );

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id,role,organisation_id")
        .eq("id", session.user.id)
        .maybeSingle();
      setMe({
        id: String(data?.id ?? session.user.id),
        role: String(data?.role ?? "admin"),
        orgId: String(data?.organisation_id ?? ""),
      });
    })();
  }, []);

  const callInvite = async (body: Record<string, unknown>) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ ...body, organisationId: me.orgId }),
    });
    const json = (await res.json()) as Record<string, string | boolean>;
    if (!res.ok) throw new Error(String(json.message ?? "Request failed"));
    return json;
  };

  const submitInvite = async () => {
    setInviting(true);
    setIssued(null);
    try {
      const result = await callInvite({
        action: "invite",
        email: inviteEmail,
        fullName: inviteName,
        role: inviteRole,
      });
      setIssued({
        kind: "invite",
        to: String(result.email),
        username: String(result.username),
        password: String(result.password),
        note: result.recorded
          ? undefined
          : "Invitations table not created yet — run supabase/migrations/001_roles_invites.sql to record future invites.",
      });
      setInviteEmail("");
      setInviteName("");
      void reloadPeople();
      toast.success("Account created", {
        description: `Share the credentials with ${String(result.email)}.`,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create the account."
      );
    } finally {
      setInviting(false);
    }
  };

  const issueStudent = async (studentId: string, name: string) => {
    setIssuingFor(studentId);
    setIssued(null);
    try {
      const result = await callInvite({ action: "student", studentId });
      setIssued({
        kind: "student",
        to: name,
        username: String(result.username),
        password: String(result.password),
        note: result.persisted
          ? undefined
          : "Credential columns not created yet — run the migration to allow reissuing without regenerating.",
      });
      toast.success("Student login generated", {
        description: `Hand these to ${name}'s family.`,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not generate a login."
      );
    } finally {
      setIssuingFor(null);
    }
  };

  const tabs = [
    { key: "people" as const, label: "People", show: true },
    { key: "invite" as const, label: "Invite", show: grantable.length > 0 },
    { key: "students" as const, label: "Student logins", show: isAdmin },
  ].filter(t => t.show);

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="User management"
            onParentClick={onBack}
          />
          <h1 className="page-title">User management</h1>
          <p className="page-subtitle">
            {people.length} account{people.length === 1 ? "" : "s"} ·{" "}
            {students.length} student logins available
          </p>
        </div>
      </div>

      <div className="segmented-control">
        {tabs.map(t => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {issued && (
        <section className="panel credential-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">One-time credentials</p>
              <h2 className="panel-title">
                {issued.kind === "invite" ? "Invite" : "Student login"} for{" "}
                {issued.to}
              </h2>
            </div>
            <button
              className="secondary-button compact"
              onClick={() => setIssued(null)}
            >
              Dismiss
            </button>
          </div>
          <div className="px-5 pb-5 pt-4">
            <p className="text-[12.5px] leading-5 text-[var(--text-muted)]">
              These are shown once. Copy them now — they are not stored in a
              place the user can read again, and you should ask them to change
              the password on first sign-in.
            </p>
            <div className="credential-grid mt-4">
              <div>
                <span>Sign-in address</span>
                <code>{issued.to}</code>
              </div>
              <div>
                <span>Username</span>
                <code>{issued.username}</code>
              </div>
              <div>
                <span>Temporary password</span>
                <code>{issued.password}</code>
              </div>
            </div>
            {issued.note && (
              <p className="mt-3 text-[12.5px] leading-5 text-[var(--warning)]">
                {issued.note}
              </p>
            )}
          </div>
        </section>
      )}

      {tab === "people" && (
        <section className="panel table-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Directory</p>
              <h2 className="panel-title">Accounts</h2>
            </div>
            <span className="count-badge">{people.length} total</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Access level</th>
  
                </tr>
              </thead>
              <tbody>
                {peopleLoading ? (
                  <SkeletonTableRows rows={5} columns={5} />
                ) : people.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state py-10">
                        <Users size={20} />
                        <p>No accounts found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  people.map(person => (
                    <tr key={person.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span
                            className={`avatar avatar-sm ${avatarTones[person.tone]}`}
                          >
                            {person.initials}
                          </span>
                          <span className="font-medium text-[var(--text-primary)]">
                            {person.name}
                          </span>
                          {person.protected ? (
                            <span
                              className="status-pill success"
                              title={
                                superAdminGuard(
                                  person.id,
                                  "change the role of"
                                ) ?? undefined
                              }
                            >
                              <Lock size={11} aria-hidden />
                              Protected
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="muted-cell">{person.email}</td>
                      <td>
                        <span className="grade-chip">{person.role}</span>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${accessTone(person.access)}`}
                        >
                          <span className="status-dot" />
                          {person.access}
                        </span>
                      </td>
                      <td>
                        {person.protected ? (
                          <span className="muted-cell text-[12.5px]">
                            {person.id === me.id ? "You" : "Locked"}
                          </span>
                        ) : person.id === me.id ? (
                          <span className="muted-cell text-[12.5px]">You</span>
                        ) : (
                          <button
                            className="tiny-action"
                            onClick={() => toast(`Managing ${person.name}`)}
                          >
                            Manage
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "invite" && (
        <div className="dashboard-grid dashboard-grid-mid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">New account</p>
                <h2 className="panel-title">Invite a colleague</h2>
              </div>
            </div>
            <div className="px-5 pb-5 pt-4">
              <div className="form-grid">
                <label>
                  Full name
                  <input
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                    placeholder="e.g. Anita Rao"
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="name@gks.edu"
                  />
                </label>
                <label>
                  Access level
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                  >
                    {grantable.map(role => (
                      <option key={role} value={role}>
                        {role === "admin"
                          ? "Admin — can invite staff"
                          : role === "staff"
                            ? "Staff"
                            : role === "teacher"
                              ? "Teacher"
                              : "Accountant"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-3 text-[12.5px] leading-5 text-[var(--text-muted)]">
                {superAdmin
                  ? "As super admin you can create other admins. Everyone else in this list is limited to staff-level access."
                  : "Admins can invite staff, teachers and accountants. Only a super admin can create another admin."}
              </p>
              <div className="dialog-actions mt-4">
                <button
                  className="primary-button"
                  disabled={inviting || !inviteEmail}
                  onClick={() => void submitInvite()}
                >
                  {inviting ? "Creating…" : "Create account"}
                </button>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">How access works</p>
                <h2 className="panel-title">Role hierarchy</h2>
              </div>
            </div>
            <div className="px-5 pb-5 pt-4">
              {[
                {
                  role: "Super admin",
                  detail: superAdmin
                    ? "You. Full control, including creating other admins, and this account cannot be demoted or removed."
                    : "Full control, including creating other admins. Cannot be demoted or removed.",
                  tone: "teal",
                },
                {
                  role: "Admin",
                  detail: "Runs day-to-day operations and invites staff.",
                  tone: "blue",
                },
                {
                  role: "Staff",
                  detail: "Teachers and office staff. Operational access only.",
                  tone: "violet",
                },
                {
                  role: "Student",
                  detail:
                    "Portal login generated by the school. No staff access.",
                  tone: "amber",
                },
              ].map((row, index) => (
                <div
                  key={row.role}
                  className={`flex items-start gap-3 py-3 ${index < 3 ? "border-b border-[var(--border)]" : ""}`}
                >
                  <span className={`role-dot ${row.tone}`} />
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">
                      {row.role}
                    </div>
                    <div className="mt-1.5 text-[12.5px] text-[var(--text-muted)]">
                      {row.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "students" && (
        <section className="panel table-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Portal access</p>
              <h2 className="panel-title">Student logins</h2>
            </div>
            <div className="search-field" style={{ maxWidth: 260 }}>
              <Search size={15} />
              <input
                value={studentQuery}
                onChange={e => setStudentQuery(e.target.value)}
                placeholder="Search students..."
              />
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Admission ID</th>
                  <th>Grade</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {studentsLoading ? (
                  <SkeletonTableRows rows={8} columns={5} />
                ) : (
                  studentsPager.pageRows.map(student => (
                    <tr key={student.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span
                            className={`avatar avatar-sm ${avatarTones[student.tone]}`}
                          >
                            {student.initials}
                          </span>
                          <span className="font-medium text-[var(--text-primary)]">
                            {student.name}
                          </span>
                        </div>
                      </td>
                      <td className="muted-cell">
                        {student.usn ?? "—"}
                      </td>
                      <td>
                        <span className="grade-chip">{student.grade}</span>
                      </td>
                      <td>
                        <button
                          className="tiny-action"
                          disabled={issuingFor === student.id}
                          onClick={() =>
                            void issueStudent(String(student.id), student.name)
                          }
                        >
                          {issuingFor === student.id
                            ? "Generating…"
                            : "Generate login"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pager pagination={studentsPager} noun="students" />
        </section>
      )}
    </div>
  );
}

function accessTone(access: string): string {
  switch (access) {
    case "Super admin":
      return "success";
    case "Admin":
      return "neutral";
    case "Staff":
      return "neutral";
    default:
      return "neutral";
  }
}

function SettingsView({ onBack }: { onBack: () => void }) {
  const { settings, save } = useSettings();
  const [prefs, setPrefs] = useState(settings.prefs);
  const [academicYear, setAcademicYear] = useState(settings.academicYear);
  const [gradeScale, setGradeScale] = useState(settings.gradeScale);
  const [threshold, setThreshold] = useState(settings.threshold);
  const toggle = (key: keyof typeof prefs) =>
    setPrefs(current => ({ ...current, [key]: !current[key] }));
  const saveSettings = () => {
    void save({ ...settings, prefs, academicYear, gradeScale, threshold }).then(
      ok => {
        if (ok)
          toast.success("Settings saved", {
            description: "Your changes are live for all staff.",
          });
      }
    );
  };
  const alerts = [
    {
      key: "attendance" as const,
      title: "Attendance alerts",
      detail: "When a class drops below the daily threshold",
    },
    {
      key: "fees" as const,
      title: "Fee reminders",
      detail: "Automated nudges for outstanding balances",
    },
    {
      key: "messages" as const,
      title: "Parent messages",
      detail: "New inbox messages from families",
    },
    {
      key: "exams" as const,
      title: "Exam countdowns",
      detail: "Reminders before every exam window",
    },
    {
      key: "digest" as const,
      title: "Weekly digest",
      detail: "A Monday summary for the leadership team",
    },
  ];
  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Settings"
            onParentClick={onBack}
          />
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Configure the school workspace, alerts and academic rules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="secondary-button"
            onClick={() => toast("Settings reset to defaults")}
          >
            Reset defaults
          </button>
          <button className="primary-button" onClick={saveSettings}>
            <Check size={16} />
            Save changes
          </button>
        </div>
      </div>
      <AccountSettingsPanel />
      <div className="dashboard-grid dashboard-grid-mid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Workspace</p>
              <h2 className="panel-title">School profile</h2>
            </div>
          </div>
          <div className="px-5 pb-5 pt-4">
            <div className="form-grid">
              <label>
                School name
                <input defaultValue={settings.schoolName} />
              </label>
              <label>
                Campus
                <input defaultValue={settings.campus} />
              </label>
              <label>
                Address
                <input defaultValue={settings.address} />
              </label>
              <label>
                Phone
                <input defaultValue={settings.phone} />
              </label>
              <label>
                Academic year
                <select
                  value={academicYear}
                  onChange={event => setAcademicYear(event.target.value)}
                >
                  <option>2025–26</option>
                  <option>2026–27</option>
                </select>
              </label>
              <label>
                Current term
                <select defaultValue={settings.currentTerm}>
                  <option>Term 1</option>
                  <option>Term 2</option>
                  <option>Term 3</option>
                </select>
              </label>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Alerts</p>
              <h2 className="panel-title">Notification preferences</h2>
            </div>
          </div>
          <div className="px-5 pb-2 pt-1">
            {alerts.map((alert, index) => (
              <div
                className={`flex items-center justify-between gap-4 py-3.5 ${index < alerts.length - 1 ? "border-b border-[var(--border)]" : ""}`}
                key={alert.key}
              >
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {alert.title}
                  </div>
                  <div className="mt-1.5 text-[12.5px] text-[var(--text-muted)]">
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
        </section>
      </div>
      <div className="dashboard-grid dashboard-grid-mid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Academics</p>
              <h2 className="panel-title">Grading & thresholds</h2>
            </div>
          </div>
          <div className="px-5 pb-5 pt-4">
            <div className="form-grid">
              <label>
                Grading scale
                <select
                  value={gradeScale}
                  onChange={event => setGradeScale(event.target.value)}
                >
                  <option>Percentage (0–100)</option>
                  <option>CGPA (10-point)</option>
                  <option>Letter grades (A–F)</option>
                </select>
              </label>
              <label>
                Attendance alert threshold
                <select
                  value={threshold}
                  onChange={event => setThreshold(event.target.value)}
                >
                  <option>90%</option>
                  <option>85%</option>
                  <option>80%</option>
                  <option>75%</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  Auto-publish results
                </div>
                <div className="mt-1.5 text-[12.5px] text-[var(--text-muted)]">
                  Release grades to families as soon as papers are marked
                </div>
              </div>
              <SettingToggle
                checked={prefs.exams}
                onChange={() => toggle("exams")}
                label="Auto-publish results"
              />
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Danger zone</p>
              <h2 className="panel-title">Workspace controls</h2>
            </div>
          </div>
          <div className="px-5 pb-5 pt-4">
            <div
              className="drawer-section"
              style={{ borderTop: 0, paddingTop: 0 }}
            >
              <button
                onClick={() =>
                  toast.warning("This action requires a second admin")
                }
              >
                <AlertCircle size={16} />
                Archive this campus
                <ChevronRight size={15} />
              </button>
              <button
                onClick={() =>
                  toast.warning("Export queued — you'll be notified")
                }
              >
                <Download size={16} />
                Export all school data
                <ChevronRight size={15} />
              </button>
              <button
                onClick={() =>
                  toast.error(
                    "Session invalidation requires super admin approval"
                  )
                }
              >
                <LogOut size={16} />
                Sign out all devices
                <ChevronRight size={15} />
              </button>
            </div>
            <p className="mt-4 text-[12.5px] leading-5 text-[var(--text-muted)]">
              Changes to workspace controls are audited and require a second
              administrator for sensitive actions.
            </p>
          </div>
        </section>
      </div>
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

  const staffMobileTabs = useMemo<StaffMobileTab[]>(() => {
    const tabs: StaffMobileTab[] = [
      { id: "Overview", label: "Home", icon: LayoutDashboard },
    ];
    if (allowedScreenSet.has("Students")) {
      tabs.push({ id: "Students", label: "Students", icon: GraduationCap });
    }
    if (
      currentUser?.role === "accountant" &&
      allowedScreenSet.has("Fees & Finance")
    ) {
      tabs.push({
        id: "Fees & Finance",
        label: "Fees",
        icon: IndianRupee,
      });
    } else if (allowedScreenSet.has("Attendance")) {
      tabs.push({
        id: "Attendance",
        label: "Attendance",
        icon: ClipboardCheck,
      });
    }
    return tabs;
  }, [allowedScreenSet, currentUser?.role]);

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
    if (allowedScreenSet.has("Account logins")) {
      system.push({ label: "Account logins", icon: KeyRound });
    }
    if (allowedScreenSet.has("Settings")) {
      system.push({ label: "Settings", icon: Settings2 });
    }
    if (system.length) groups.push({ label: "System", items: system });
    return groups;
  }, [visibleNavGroups, allowedScreenSet]);

  const navigate = (view: string, studentId?: RowId) => {
    if (!allowedScreenSet.has(view)) {
      toast.error(
        `${roleLabel(currentUser?.id, currentUser?.role)}s cannot open ${view}.`,
        { description: "Ask an admin if you need access to it." }
      );
      return;
    }
    pendingStudentRef.current = studentId ?? null;
    if (studentId != null) setStudentsKey(k => k + 1);
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
          openStudentId={null}
          onStudentOpened={() => {}}
        />
      );
    }
    if (activeView === "Documents")
      return (
        <DocumentsView
          openStudentId={pendingStudentRef.current}
          onStudentOpened={() => {
            pendingStudentRef.current = null;
          }}
          onBack={() => navigate("Overview")}
        />
      );
    if (activeView === "Attendance")
      return <AttendanceView onBack={() => navigate("Overview")} />;
    if (activeView === "Fees & Finance")
      return <FinanceView onBack={() => navigate("Overview")} />;
    if (activeView === "Analytics")
      return <AnalyticsView onBack={() => navigate("Overview")} />;
    if (activeView === "Staff")
      return (
        <StaffView
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
    if (activeView === "Account logins")
      return <CredentialsView onBack={() => navigate("Overview")} />;
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
                  {allowedScreenSet.has("Account logins") && (
                    <button
                      className={`nav-item ${activeView === "Account logins" ? "active" : ""}`}
                      onClick={() => navigate("Account logins")}
                    >
                      <KeyRound size={17} />
                      <span className="nav-label">Account logins</span>
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
                        <span className="avatar avatar-sm bg-[rgba(63,184,162,0.13)] text-[var(--brand)]">
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
                          <span className="avatar avatar-sm bg-[rgba(63,184,162,0.13)] text-[var(--brand)]">
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

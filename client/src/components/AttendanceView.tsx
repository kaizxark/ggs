/**
 * Attendance — the live command centre.
 *
 * ## Who marks, who reviews
 *
 * A register is marked by the teacher assigned to that class, and by nobody
 * else. `/api/attendance` enforces that from the session token; this screen
 * only reflects the answer. An administrator, the principal or the super admin
 * opens the same screen read-only: they can pick any class and any date and see
 * exactly what was saved, but the Save button does not exist for them.
 *
 * ## Nothing is invented
 *
 * The roster comes from `enrollments` and the marks from `attendance`. A pupil
 * with no row for the chosen date is *unmarked* — not assumed present — and
 * Save stays disabled until every pupil has a status. There is no localStorage
 * copy and no generated cohort: an empty school renders as an empty school.
 *
 * ## Why the layout is shaped this way
 *
 * The person who opens this screen most often is a school leader checking the
 * whole school, not one class. So the default view answers four questions in
 * one glance — how many pupils are in today, how many registers are in, who is
 * absent, and who is drifting below the threshold — then lets them drill into a
 * single class. The register itself is a second tab, used by the class teacher.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Layers,
  Loader2,
  Minus,
  Radio,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Users,
  UserX,
  X,
} from "lucide-react";

import { Breadcrumb } from "./Breadcrumb";
import { DateDropdowns } from "./DateDropdowns";
import { FormSelect } from "./FormSelect";
import { SegmentedControl } from "./SegmentedControl";
import {
  SkeletonHealthGrid,
  SkeletonList,
  SkeletonRegion,
} from "./ErpSkeleton";
import { ApiError } from "../lib/student-directory";
import { toast } from "@/lib/toast";
import { useCurrentUser } from "../lib/erp-views";
import { useDataRevision } from "../lib/live-data";
import { useRealtimeInvalidation } from "../lib/use-realtime";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_THRESHOLD,
  attendancePercent,
  attendanceToday,
  loadAttendance,
  saveClassAttendance,
  type AttendanceBootstrap,
  type AttendanceClassOption,
  type AttendanceDaySummary,
  type AttendanceRosterStudent,
  type AttendanceStatus,
} from "../lib/attendance";

/* ------------------------------------------------------------------ */
/* Small, pure helpers                                                 */
/* ------------------------------------------------------------------ */

/** "2026-11-09" -> "9 Nov 2026". */
function readableDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function weekdayLong(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
}

function weekdayShort(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
}

function dayMonth(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Move an ISO date by whole days without drifting across timezones. */
function shiftIsoDate(iso: string, days: number): string {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function formatSyncTime(value: Date): string {
  return value.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/** The pill tone that matches each stored status. */
function attendanceTone(status: AttendanceStatus): string {
  if (status === "present") return "success";
  if (status === "late") return "warning";
  // Leave is excused, not an offence: a cool tone keeps it from reading as a
  // second red next to "absent" in a stacked bar.
  if (status === "leave") return "info";
  return "danger";
}

const ATTENDANCE_STATUS_ICONS: Record<AttendanceStatus, React.ElementType> = {
  present: Check,
  late: Clock3,
  leave: CalendarDays,
  absent: X,
};

/** Attendance colour: green above the line, amber near it, red below 75. */
function rateColor(rate: number, marked: boolean): string {
  if (!marked) return "var(--text-muted)";
  if (rate < 75) return "var(--danger-strong)";
  if (rate < ATTENDANCE_THRESHOLD) return "var(--warning)";
  return "var(--success)";
}

type ClassState = "pending" | "partial" | "complete";

function classState(option: AttendanceClassOption): ClassState {
  const marked = option.markedToday ?? 0;
  if (marked === 0) return "pending";
  if (option.isMarked ?? (marked >= option.studentCount && option.studentCount > 0)) {
    return "complete";
  }
  return "partial";
}

/* ------------------------------------------------------------------ */
/* Presentational pieces                                               */
/* ------------------------------------------------------------------ */

/**
 * Four pills, one per value the database's `attendance_status` enum accepts.
 * The chosen pill takes the tone of its meaning; the rest stay quiet, so a row
 * reads at a glance instead of turning into four competing colours.
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
    <div className="att-status-group" role="group" aria-label={label}>
      {ATTENDANCE_STATUSES.map((status) => {
        const Icon = ATTENDANCE_STATUS_ICONS[status];
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            className={`att-status-option ${active ? attendanceTone(status) : ""}`}
            aria-pressed={active}
            onClick={() => onChange(status)}
          >
            <Icon size={12} />
            <span>{ATTENDANCE_STATUS_LABELS[status]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Seven school days, as a light CSS bar chart — no chart library, no jank. */
function TrendBars({ days }: { days: AttendanceDaySummary[] }) {
  if (days.length === 0) {
    return (
      <div className="att-empty-inline">
        <BarChart3 size={18} />
        <p>No attendance has been recorded for this period yet.</p>
      </div>
    );
  }

  return (
    <div className="att-trend" role="img" aria-label="Attendance over the last recorded school days">
      {days.map((day) => {
        const tone =
          day.percent < 75
            ? "var(--danger-strong)"
            : day.percent < ATTENDANCE_THRESHOLD
            ? "var(--warning)"
            : "var(--success)";
        return (
          <div
            className="att-trend-col"
            key={day.date}
            title={`${readableDate(day.date)} · ${day.percent}% (${day.present + day.late} of ${day.marked} attending)`}
          >
            <span className="att-trend-value">{day.percent}%</span>
            <div className="att-trend-track">
              <span
                className="att-trend-fill"
                style={{ height: `${Math.max(day.percent, 3)}%`, background: tone }}
              />
            </div>
            <span className="att-trend-day">{weekdayShort(day.date)}</span>
            <span className="att-trend-date">{dayMonth(day.date)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The screen                                                          */
/* ------------------------------------------------------------------ */

export default function AttendanceView({ onBack }: { onBack: () => void }) {
  const currentUser = useCurrentUser();

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

  // Overview filters and drill-down state.
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "marked" | "low_attendance"
  >("all");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [sortBy, setSortBy] = useState<
    "grade" | "attendance_asc" | "attendance_desc" | "pending_first"
  >("grade");
  const [inspectClassId, setInspectClassId] = useState<string | null>(null);
  const [inspectRoster, setInspectRoster] = useState<AttendanceRosterStudent[] | null>(
    null
  );
  const [inspectLoading, setInspectLoading] = useState(false);
  const [drawerRosterFilter, setDrawerRosterFilter] = useState<
    "all" | "absent" | "present"
  >("all");

  const dataRev = useDataRevision();
  // Any client writing attendance or changing a class or student re-reads this screen.
  const realtimeRev = useRealtimeInvalidation([
    "attendance",
    "attendance_corrections",
    "classrooms",
    "students",
    "enrollments",
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    loadAttendance({ date, classroomId: classroomId || undefined })
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setLastSyncedAt(new Date());
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
  }, [date, classroomId, reloadKey, realtimeRev, dataRev]);

  const classes = data?.classes ?? [];
  const roster = data?.roster ?? [];
  const selectedClass = data?.selectedClass ?? null;
  const overview = data?.overview ?? null;
  const managerView = data?.managerView ?? false;
  const isManager =
    currentUser?.role === "super_admin" ||
    currentUser?.role === "admin" ||
    currentUser?.role === "principal" ||
    managerView;
  const canMark = Boolean(data && !isManager && selectedClass?.canMark);
  const activeClassId = classroomId || data?.selectedClassroomId || "";
  const currentTab = activeTab;
  const today = data?.today ?? attendanceToday();
  const viewingToday = date === today;

  /* ---- derived overview figures ---- */
  const metrics = useMemo(() => {
    if (overview) {
      return {
        percent: overview.todayPercent,
        present: overview.todayPresent,
        marked: overview.todayMarked,
        totalStudents: overview.totalStudents ?? 0,
        absent: overview.todayAbsent ?? 0,
        late: overview.todayLate ?? 0,
        leave: overview.todayLeave ?? 0,
        markedClasses: overview.classesMarked ?? 0,
        pendingClasses: overview.classesPending ?? 0,
        totalClasses: overview.classesTotal ?? classes.length,
        belowThreshold: overview.belowThreshold,
        completionPercent: overview.completionPercent ?? 0,
        unmarkedToday: overview.unmarkedToday ?? 0,
        trendDelta: overview.trendDelta ?? 0,
        previousPercent: overview.previousPercent ?? null,
        lastMarkedAt: overview.lastMarkedAt ?? null,
        atRisk: overview.atRisk ?? [],
        daily: overview.daily ?? [],
      };
    }

    let totalStudents = 0;
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;
    let marked = 0;
    let markedClasses = 0;
    let pendingClasses = 0;
    for (const option of classes) {
      totalStudents += option.studentCount;
      marked += option.markedToday ?? 0;
      present += option.presentToday ?? 0;
      absent += option.absentToday ?? 0;
      late += option.lateToday ?? 0;
      leave += option.leaveToday ?? 0;
      if (option.isMarked) markedClasses += 1;
      if ((option.markedToday ?? 0) === 0) pendingClasses += 1;
    }
    return {
      percent: attendancePercent(present, marked),
      present,
      marked,
      totalStudents,
      absent,
      late,
      leave,
      markedClasses,
      pendingClasses,
      totalClasses: classes.length,
      belowThreshold: 0,
      completionPercent: attendancePercent(marked, totalStudents),
      unmarkedToday: Math.max(0, totalStudents - marked),
      trendDelta: 0,
      previousPercent: null as number | null,
      lastMarkedAt: null as string | null,
      atRisk: [] as NonNullable<typeof overview>["atRisk"],
      daily: [] as AttendanceDaySummary[],
    };
  }, [overview, classes]);

  const filteredClasses = useMemo(() => {
    return classes
      .filter((option) => {
        const state = classState(option);
        const rate =
          option.todayPercent ??
          ((option.markedToday ?? 0) > 0
            ? attendancePercent(option.presentToday ?? 0, option.markedToday ?? 0)
            : 0);

        if (statusFilter === "pending" && state !== "pending") return false;
        if (statusFilter === "marked" && state !== "complete") return false;
        if (
          statusFilter === "low_attendance" &&
          (state === "pending" || rate >= ATTENDANCE_THRESHOLD)
        ) {
          return false;
        }

        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matches =
            option.label.toLowerCase().includes(query) ||
            (option.classTeacherName ?? "").toLowerCase().includes(query) ||
            (option.room ?? "").toLowerCase().includes(query);
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const rateA =
          a.todayPercent ??
          ((a.markedToday ?? 0) > 0
            ? attendancePercent(a.presentToday ?? 0, a.markedToday ?? 0)
            : 0);
        const rateB =
          b.todayPercent ??
          ((b.markedToday ?? 0) > 0
            ? attendancePercent(b.presentToday ?? 0, b.markedToday ?? 0)
            : 0);

        if (sortBy === "attendance_asc") return rateA - rateB;
        if (sortBy === "attendance_desc") return rateB - rateA;
        if (sortBy === "pending_first") {
          const pendA = (a.markedToday ?? 0) === 0 ? 0 : 1;
          const pendB = (b.markedToday ?? 0) === 0 ? 0 : 1;
          if (pendA !== pendB) return pendA - pendB;
        }
        const gradeA = Number.parseInt(a.grade, 10);
        const gradeB = Number.parseInt(b.grade, 10);
        if (Number.isFinite(gradeA) && Number.isFinite(gradeB) && gradeA !== gradeB) {
          return gradeA - gradeB;
        }
        return a.grade.localeCompare(b.grade) || a.section.localeCompare(b.section);
      });
  }, [classes, statusFilter, searchQuery, sortBy]);

  const inspectedClass = useMemo(
    () => classes.find((option) => option.id === inspectClassId) ?? null,
    [classes, inspectClassId]
  );

  /**
   * Classes whose *today* rate is under the line. Kept separate from the
   * term-wide `belowThreshold` count on the KPI strip: one is "who is drifting
   * this year", the other is "which register needs a look right now".
   */
  const lowTodayClasses = useMemo(
    () =>
      classes.filter(
        (option) =>
          (option.markedToday ?? 0) > 0 &&
          (option.todayPercent ?? 0) < ATTENDANCE_THRESHOLD
      ),
    [classes]
  );

  useEffect(() => {
    if (!inspectClassId) {
      setInspectRoster(null);
      setDrawerRosterFilter("all");
      return;
    }
    let cancelled = false;
    setInspectLoading(true);
    loadAttendance({ date, classroomId: inspectClassId })
      .then((res) => {
        if (!cancelled) setInspectRoster(res.roster ?? []);
      })
      .catch(() => {
        if (!cancelled) setInspectRoster([]);
      })
      .finally(() => {
        if (!cancelled) setInspectLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inspectClassId, date]);

  const drawerStudents = useMemo(() => {
    if (!inspectRoster) return [];
    if (drawerRosterFilter === "absent") {
      return inspectRoster.filter(
        (pupil) =>
          pupil.status === "absent" || pupil.status === "late" || pupil.status === "leave"
      );
    }
    if (drawerRosterFilter === "present") {
      return inspectRoster.filter((pupil) => pupil.status === "present");
    }
    return inspectRoster;
  }, [inspectRoster, drawerRosterFilter]);

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

  /* ---- actions ---- */
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

  function shiftDate(delta: number) {
    const next = shiftIsoDate(date, delta);
    if (next > today) return;
    setDatePickerOpen(false);
    setDate(next);
  }

  // Escape closes the drill-down; the page behind it does not scroll.
  useEffect(() => {
    if (!inspectClassId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInspectClassId(null);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [inspectClassId]);

  // Escape closes the date picker. It does not steal focus or scroll lock.
  useEffect(() => {
    if (!datePickerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDatePickerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [datePickerOpen]);

  const refresh = (
    <button
      type="button"
      className="att-sync-btn"
      onClick={() => setReloadKey((key) => key + 1)}
      aria-label="Refresh attendance"
      title="Refresh now"
    >
      <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
    </button>
  );

  return (
    <div className="page-stack att-page">
      {/* ------------------------------------------------------------ */}
      {/* Header                                                       */}
      {/* ------------------------------------------------------------ */}
      <div className="page-intro att-intro">
        <div>
          <Breadcrumb parent="Global Kids School" current="Attendance" onParentClick={onBack} />
          <h1 className="page-title">
            Attendance
          </h1>
          <p className="page-subtitle" style={{ marginTop: "4px" }}>
            {isManager
              ? currentTab === "overview"
                ? "Every classroom, one live picture. Open any class to review its register."
                : "Reviewing any class and any date. Marking stays with each class's own teacher."
              : currentTab === "overview"
              ? "Your classes at a glance. Open a class to take its register."
              : "Mark every pupil, then save. Only the assigned class teacher can submit this register."}
          </p>
        </div>

        <div className="att-intro-actions">
          <span className="att-sync" title="Last successful read from the server">
            <Radio size={12} />
            <span>Synced {formatSyncTime(lastSyncedAt)}</span>
            {refresh}
          </span>
          <SegmentedControl
            ariaLabel="Attendance view tabs"
            layoutId="attendanceMainViewTabs"
            value={activeTab}
            onChange={(value) => setActiveTab(value as "register" | "overview")}
            indicatorVariant="brand"
            options={[
              { value: "overview", label: "Overview", icon: <Activity size={14} /> },
              { value: "register", label: "Class register", icon: <ClipboardCheck size={14} /> },
            ]}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Overview                                                     */}
      {/* ------------------------------------------------------------ */}
      {currentTab === "overview" &&
        (loading && !data ? (
          <div className="panel" style={{ padding: "20px 22px" }}>
            <SkeletonRegion label="Loading live attendance overview">
              <SkeletonHealthGrid count={4} />
              <div style={{ marginTop: "20px" }}>
                <SkeletonList rows={6} avatar={false} />
              </div>
            </SkeletonRegion>
          </div>
        ) : error ? (
          <div className="panel" style={{ padding: "40px 24px" }}>
            <div className="empty-state">
              <AlertCircle size={24} />
              <p style={{ maxWidth: "520px", textAlign: "center" }}>{error}</p>
              {refresh}
            </div>
          </div>
        ) : (
          <div className="att-stack-lg">
            {/* Date + sync command bar */}
            <section className="panel att-command" data-loading={loading || undefined}>
              <div className="att-date-nav">
                <button
                  type="button"
                  className="att-nav-btn"
                  onClick={() => shiftDate(-1)}
                  aria-label="Previous day"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="att-date-pick-wrap">
                  <button
                    type="button"
                    className="att-date-trigger"
                    onClick={() => setDatePickerOpen((open) => !open)}
                    aria-haspopup="dialog"
                    aria-expanded={datePickerOpen}
                    title="Choose another date"
                  >
                    <span className="att-date-block">
                      <span className="att-date-main">{readableDate(data?.date ?? date)}</span>
                      <span className="att-date-sub">
                        {viewingToday ? "Today" : weekdayLong(data?.date ?? date)}
                        {data?.academicYear ? ` · ${data.academicYear}` : ""}
                      </span>
                    </span>
                    <ChevronDown size={14} className="att-date-caret" />
                  </button>

                  {datePickerOpen && (
                    <>
                      <div
                        className="att-date-scrim"
                        onClick={() => setDatePickerOpen(false)}
                        aria-hidden="true"
                      />
                      <div
                        className="att-date-pop"
                        role="dialog"
                        aria-label="Choose a date"
                      >
                        <DateDropdowns
                          value={date}
                          onChange={setDate}
                          defaultToToday
                          minYear={2020}
                          maxYear={2030}
                          showPreview={false}
                        />
                        <div className="att-date-pop-foot">
                          <button
                            type="button"
                            className="att-link-btn"
                            onClick={() => {
                              setDate(today);
                              setDatePickerOpen(false);
                            }}
                          >
                            Jump to today
                          </button>
                          <button
                            type="button"
                            className="secondary-button compact"
                            onClick={() => setDatePickerOpen(false)}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  className="att-nav-btn"
                  onClick={() => shiftDate(1)}
                  disabled={viewingToday}
                  aria-label="Next day"
                >
                  <ChevronRight size={16} />
                </button>

                {!viewingToday && (
                  <button
                    type="button"
                    className="att-today-chip"
                    onClick={() => setDate(today)}
                  >
                    Back to today
                  </button>
                )}
              </div>

              <div className="att-command-meta">
                <span>
                  {classes.length} {classes.length === 1 ? "class" : "classes"} ·{" "}
                  {metrics.totalStudents} pupils
                </span>
                {metrics.lastMarkedAt && (
                  <span className="att-command-updated">
                    Last mark {formatClock(metrics.lastMarkedAt)}
                  </span>
                )}
              </div>
            </section>

            {/* Today's numbers, one quiet bar instead of four tiles */}
            <section className="att-stats" aria-label="Attendance at a glance">
              <div className="att-stat-cell">
                <span className="att-stat-label">Attendance</span>
                <span className="att-stat-value">
                  {metrics.marked > 0 ? `${metrics.percent}%` : "—"}
                  {metrics.marked > 0 && metrics.trendDelta !== 0 && (
                    <span
                      className={`att-stat-delta ${
                        metrics.trendDelta > 0 ? "up" : "down"
                      }`}
                      title={
                        metrics.previousPercent === null
                          ? undefined
                          : `Previous recorded day: ${metrics.previousPercent}%`
                      }
                    >
                      {metrics.trendDelta > 0 ? (
                        <ArrowUpRight size={12} />
                      ) : (
                        <ArrowDownRight size={12} />
                      )}
                      {Math.abs(metrics.trendDelta)}
                    </span>
                  )}
                </span>
                <span className="att-stat-note">
                  {metrics.marked > 0
                    ? `${metrics.present} of ${metrics.marked} in today`
                    : "No register marked yet"}
                </span>
              </div>

              <div className="att-stat-cell">
                <span className="att-stat-label">Registers in</span>
                <span className="att-stat-value">
                  {metrics.markedClasses}
                  <span className="att-stat-of">/{metrics.totalClasses}</span>
                </span>
                <span className="att-stat-note">
                  {metrics.pendingClasses > 0
                    ? `${metrics.pendingClasses} still pending`
                    : "Every class submitted"}
                </span>
              </div>

              <div className="att-stat-cell">
                <span className="att-stat-label">Absent</span>
                <span className="att-stat-value">
                  {metrics.absent.toLocaleString("en-IN")}
                </span>
                <span className="att-stat-note">
                  {metrics.late > 0 || metrics.leave > 0
                    ? `${metrics.late} late · ${metrics.leave} on leave`
                    : "No late arrivals or leave"}
                </span>
              </div>

              <div className="att-stat-cell">
                <span className="att-stat-label">Below {ATTENDANCE_THRESHOLD}%</span>
                <span className="att-stat-value">
                  {metrics.belowThreshold.toLocaleString("en-IN")}
                </span>
                <span className="att-stat-note">pupils this term</span>
              </div>
            </section>

            {/* Toolbar */}
            <section className="att-toolbar" aria-label="Filter classes">
              <div className="att-filter-row">
                <button
                  type="button"
                  className={`status-pill ${statusFilter === "all" ? "brand" : "neutral"}`}
                  onClick={() => setStatusFilter("all")}
                >
                  All classes ({classes.length})
                </button>
                <button
                  type="button"
                  className={`status-pill ${statusFilter === "pending" ? "warning" : "neutral"}`}
                  onClick={() => setStatusFilter("pending")}
                >
                  Pending ({metrics.pendingClasses})
                </button>
                <button
                  type="button"
                  className={`status-pill ${statusFilter === "marked" ? "success" : "neutral"}`}
                  onClick={() => setStatusFilter("marked")}
                >
                  Marked ({metrics.markedClasses})
                </button>
                {lowTodayClasses.length > 0 && (
                  <button
                    type="button"
                    className={`status-pill ${statusFilter === "low_attendance" ? "danger" : "neutral"}`}
                    onClick={() => setStatusFilter("low_attendance")}
                    title={`Classes under ${ATTENDANCE_THRESHOLD}% attendance today`}
                  >
                    Under {ATTENDANCE_THRESHOLD}% today ({lowTodayClasses.length})
                  </button>
                )}
              </div>

              <div className="att-tool-row">
                <label className="att-search">
                  <Search size={13} />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search class, teacher or room…"
                    aria-label="Search classes"
                  />
                </label>

                <div className="att-tool-right">
                  <select
                    className="att-select"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                    aria-label="Sort classes"
                  >
                    <option value="grade">Grade order</option>
                    <option value="pending_first">Pending first</option>
                    <option value="attendance_asc">Lowest attendance</option>
                    <option value="attendance_desc">Highest attendance</option>
                  </select>

                  <div className="att-view-toggle" role="group" aria-label="View mode">
                    <button
                      type="button"
                      className={viewMode === "grid" ? "active" : ""}
                      onClick={() => setViewMode("grid")}
                      aria-pressed={viewMode === "grid"}
                    >
                      <Layers size={13} /> Cards
                    </button>
                    <button
                      type="button"
                      className={viewMode === "table" ? "active" : ""}
                      onClick={() => setViewMode("table")}
                      aria-pressed={viewMode === "table"}
                    >
                      <BarChart3 size={13} /> Table
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Classes */}
            {filteredClasses.length === 0 ? (
              <div className="panel att-empty">
                <Search size={22} />
                <p>No class matches this filter.</p>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => {
                    setStatusFilter("all");
                    setSearchQuery("");
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="att-class-grid">
                {filteredClasses.map((option) => {
                  const state = classState(option);
                  const marked = option.markedToday ?? 0;
                  const pending = state === "pending";
                  const rate =
                    option.todayPercent ??
                    (marked > 0
                      ? attendancePercent(option.presentToday ?? 0, marked)
                      : 0);
                  const tone = rateColor(rate, marked > 0);
                  const late = option.lateToday ?? 0;
                  const leave = option.leaveToday ?? 0;
                  const absent = option.absentToday ?? 0;
                  const present = Math.max(0, (option.presentToday ?? 0) - late);
                  const unmarked = option.unmarkedToday ?? Math.max(0, option.studentCount - marked);
                  const exceptions = absent + leave;

                  return (
                    <article
                      key={option.id}
                      className="att-class-card"
                      data-state={state}
                      role="button"
                      tabIndex={0}
                      onClick={() => setInspectClassId(option.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setInspectClassId(option.id);
                        }
                      }}
                    >
                      <header className="att-class-top">
                        <div className="att-class-id">
                          <span className="att-class-badge">{option.grade}</span>
                          <div className="att-class-id-copy">
                            <h3 className="att-class-name">
                              Grade {option.grade} · {option.section}
                            </h3>
                            <p className="att-class-sub">
                              {option.classTeacherName ?? "No class teacher"}
                              {option.room ? ` · Room ${option.room}` : ""}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`status-pill ${
                            pending ? "warning" : state === "complete" ? "success" : "neutral"
                          }`}
                        >
                          {pending ? (
                            <>
                              <AlertCircle size={11} /> Pending
                            </>
                          ) : state === "complete" ? (
                            <>
                              <CheckCircle2 size={11} /> Marked
                            </>
                          ) : (
                            `${marked}/${option.studentCount}`
                          )}
                        </span>
                      </header>

                      <div className="att-rate-row">
                        <div>
                          <span className="att-rate" style={{ color: tone }}>
                            {pending ? "—" : `${rate}%`}
                          </span>
                          <span className="att-rate-note">
                            {pending
                              ? `${option.studentCount} pupils awaiting a register`
                              : `${option.presentToday} of ${option.studentCount} attending`}
                          </span>
                        </div>
                        {!pending && option.termPercent > 0 && (
                          <span className="att-term-chip" title="Term-to-date attendance">
                            Term {option.termPercent}%
                          </span>
                        )}
                      </div>

                      <div className="att-stack" aria-hidden="true">
                        {present > 0 && (
                          <span
                            className="att-stack-seg present"
                            style={{ flexGrow: present }}
                          />
                        )}
                        {late > 0 && (
                          <span className="att-stack-seg late" style={{ flexGrow: late }} />
                        )}
                        {leave > 0 && (
                          <span className="att-stack-seg leave" style={{ flexGrow: leave }} />
                        )}
                        {absent > 0 && (
                          <span
                            className="att-stack-seg absent"
                            style={{ flexGrow: absent }}
                          />
                        )}
                        {unmarked > 0 && (
                          <span
                            className="att-stack-seg unmarked"
                            style={{ flexGrow: unmarked }}
                          />
                        )}
                      </div>

                      <div className="att-stat-row">
                        {present > 0 && (
                          <span className="att-stat present">
                            <Check size={11} /> {present}
                          </span>
                        )}
                        {late > 0 && (
                          <span className="att-stat late">
                            <Clock3 size={11} /> {late}
                          </span>
                        )}
                        {leave > 0 && (
                          <span className="att-stat leave">
                            <CalendarDays size={11} /> {leave}
                          </span>
                        )}
                        {absent > 0 && (
                          <span className="att-stat absent">
                            <X size={11} /> {absent}
                          </span>
                        )}
                        {unmarked > 0 && (
                          <span className="att-stat unmarked">
                            <Minus size={11} /> {unmarked}
                          </span>
                        )}
                      </div>

                      {exceptions > 0 && (
                        <button
                          type="button"
                          className="att-exceptions"
                          onClick={(event) => {
                            event.stopPropagation();
                            setInspectClassId(option.id);
                            setDrawerRosterFilter("absent");
                          }}
                        >
                          <UserX size={12} />
                          <span>
                            {exceptions} {exceptions === 1 ? "pupil" : "pupils"} absent or
                            on leave
                          </span>
                          <ArrowRight size={12} />
                        </button>
                      )}

                      <footer className="att-card-foot">
                        <span className="att-foot-time">
                          {option.markedAt ? (
                            <>
                              <Clock3 size={11} /> Submitted {formatClock(option.markedAt)}
                            </>
                          ) : (
                            "Awaiting register"
                          )}
                        </span>
                        <span className="att-open">
                          Open <ArrowRight size={12} />
                        </span>
                      </footer>
                    </article>
                  );
                })}
              </div>
            ) : (
              <section className="panel att-table-panel">
                <div className="table-scroll">
                  <table className="data-table att-table">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>Class teacher</th>
                        <th>Room</th>
                        <th>Enrolled</th>
                        <th>Status</th>
                        <th>Present</th>
                        <th>Absent</th>
                        <th>Late</th>
                        <th>Leave</th>
                        <th>Attendance</th>
                        <th style={{ width: "110px", textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClasses.map((option) => {
                        const state = classState(option);
                        const pending = state === "pending";
                        const rate =
                          option.todayPercent ??
                          ((option.markedToday ?? 0) > 0
                            ? attendancePercent(
                                option.presentToday ?? 0,
                                option.markedToday ?? 0
                              )
                            : 0);
                        return (
                          <tr key={option.id} onClick={() => setInspectClassId(option.id)}>
                            <td>
                              <span className="att-table-class">{option.label}</span>
                            </td>
                            <td className="muted-cell">
                              {option.classTeacherName ?? "Unassigned"}
                            </td>
                            <td className="muted-cell">{option.room || "—"}</td>
                            <td className="muted-cell">{option.studentCount}</td>
                            <td>
                              <span
                                className={`status-pill ${
                                  pending
                                    ? "warning"
                                    : state === "complete"
                                    ? "success"
                                    : "neutral"
                                }`}
                              >
                                {pending
                                  ? "Pending"
                                  : state === "complete"
                                  ? "Marked"
                                  : "Partial"}
                              </span>
                            </td>
                            <td className="muted-cell">{option.presentToday}</td>
                            <td
                              className="muted-cell"
                              style={{
                                color:
                                  (option.absentToday ?? 0) > 0
                                    ? "var(--danger-strong)"
                                    : undefined,
                              }}
                            >
                              {option.absentToday ?? 0}
                            </td>
                            <td className="muted-cell">{option.lateToday ?? 0}</td>
                            <td className="muted-cell">{option.leaveToday ?? 0}</td>
                            <td>
                              {!pending ? (
                                <div className="att-table-rate">
                                  <span className="progress-bar">
                                    <span
                                      style={{
                                        width: `${rate}%`,
                                        background: rateColor(rate, true),
                                      }}
                                    />
                                  </span>
                                  <span style={{ color: rateColor(rate, true) }}>
                                    {rate}%
                                  </span>
                                </div>
                              ) : (
                                <span className="muted-cell">—</span>
                              )}
                            </td>
                            <td
                              style={{ textAlign: "right" }}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="secondary-button compact"
                                onClick={() => setInspectClassId(option.id)}
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Insights */}
            <div className="att-insights">
              <section className="panel att-trend-panel">
                <header className="panel-header">
                  <div>
                    <h2 className="panel-title">Last seven school days</h2>
                    <p className="att-panel-sub">
                      Present + late, across every class with a register.
                    </p>
                  </div>
                  {metrics.trendDelta !== 0 && (
                    <span
                      className={`att-delta ${metrics.trendDelta > 0 ? "up" : "down"}`}
                      title={
                        metrics.previousPercent === null
                          ? undefined
                          : `Previous recorded day: ${metrics.previousPercent}%`
                      }
                    >
                      {metrics.trendDelta > 0 ? (
                        <ArrowUpRight size={13} />
                      ) : (
                        <ArrowDownRight size={13} />
                      )}
                      {Math.abs(metrics.trendDelta)} pts
                    </span>
                  )}
                </header>
                <div className="att-trend-body">
                  <TrendBars days={metrics.daily} />
                </div>
              </section>

              <section className="panel att-risk-panel">
                <header className="panel-header">
                  <div>
                    <h2 className="panel-title">Needs attention</h2>
                    <p className="att-panel-sub">
                      Pupils below {ATTENDANCE_THRESHOLD}% this term.
                    </p>
                  </div>
                  <span className="att-risk-count">{metrics.belowThreshold}</span>
                </header>

                <div className="att-risk-body">
                  {metrics.atRisk.length === 0 ? (
                    <div className="att-empty-inline">
                      <ShieldCheck size={18} />
                      <p>Every pupil with a record is at or above the threshold.</p>
                    </div>
                  ) : (
                    <ul className="att-risk-list">
                      {metrics.atRisk.map((pupil) => (
                        <li key={pupil.id}>
                          <button
                            type="button"
                            className="att-risk-row"
                            onClick={() => {
                              setInspectClassId(pupil.classroomId);
                              setDrawerRosterFilter("absent");
                            }}
                            title={`Open ${pupil.classLabel}`}
                          >
                            <span className="att-risk-avatar">
                              {pupil.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="att-risk-copy">
                              <span className="att-risk-name">{pupil.name}</span>
                              <span className="att-risk-meta">
                                {pupil.classLabel} · {pupil.present}/{pupil.total} days
                              </span>
                            </span>
                            <span
                              className="att-risk-rate"
                              style={{
                                color:
                                  pupil.percent < 75
                                    ? "var(--danger-strong)"
                                    : "var(--warning)",
                              }}
                            >
                              {pupil.percent}%
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          </div>
        ))}

      {/* ------------------------------------------------------------ */}
      {/* Register                                                     */}
      {/* ------------------------------------------------------------ */}
      {currentTab === "register" && (
        <div className="att-stack-lg">
          <div className="att-register-back">
            <button
              type="button"
              className="secondary-button compact"
              onClick={() => setActiveTab("overview")}
            >
              <ArrowLeft size={13} />
              Back to overview
            </button>
            <span className="att-register-back-note">
              {selectedClass?.label ?? "Selected class"} ·{" "}
              {readableDate(data?.date ?? date)}
            </span>
          </div>

          <section className="panel att-register-head">
            <div className="att-register-grid">
              <div className="att-field">
                <label htmlFor="att-class">Class</label>
                <FormSelect
                  value={activeClassId}
                  onChange={setClassroomId}
                  disabled={loading || classes.length === 0}
                  options={classes.map((option) => ({
                    value: option.id,
                    label: `${option.label} · ${option.studentCount} pupils`,
                  }))}
                  placeholder={classes.length === 0 ? "No classes available" : "Select a class"}
                  ariaLabel="Select class"
                />
              </div>

              <div className="att-field">
                <div className="att-field-label">
                  <label>Date</label>
                  {date !== today && (
                    <button
                      type="button"
                      className="att-link-btn"
                      onClick={() => setDate(today)}
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
                  showPreview={false}
                />
              </div>

              <div className="att-register-actions">
                {canMark && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={markAllPresent}
                    disabled={roster.length === 0}
                    title="Mark every pupil present, then adjust exceptions"
                  >
                    <Check size={14} />
                    All present
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  disabled={loading}
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>
          </section>

          {managerView && !loading && !error && (
            <div className="att-readonly">
              <ShieldCheck size={18} />
              <div>
                <p className="att-readonly-title">Read-only review</p>
                <p className="att-readonly-sub">
                  Registers are marked by each class&rsquo;s own teacher. You can review any
                  class and date here, but only the assigned class teacher can save a mark.
                </p>
              </div>
            </div>
          )}

          {loading && !data ? (
            <div className="panel" style={{ padding: "18px 22px" }}>
              <SkeletonRegion label="Loading the attendance register">
                <SkeletonList rows={6} avatar />
              </SkeletonRegion>
            </div>
          ) : error ? (
            <div className="panel" style={{ padding: "40px 24px" }}>
              <div className="empty-state">
                <AlertCircle size={24} />
                <p style={{ maxWidth: "520px", textAlign: "center" }}>{error}</p>
                {refresh}
              </div>
            </div>
          ) : classes.length === 0 ? (
            <div className="panel att-empty">
              <ClipboardCheck size={24} />
              <p>{data?.message || "No classes are available to mark."}</p>
            </div>
          ) : (
            <section className="panel att-register-panel">
              <header className="panel-header">
                <div>
                  <h2 className="panel-title">{selectedClass?.label ?? "Class register"}</h2>
                  <p className="att-panel-sub">
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
              </header>

              <div className="att-progress-strip">
                <div className="att-progress-copy">
                  <span>
                    <strong>{counts.marked}</strong> of {roster.length} marked
                  </span>
                  <span>{counts.percent}% attending</span>
                </div>
                <div className="att-progress-track">
                  <span
                    className="att-progress-fill"
                    style={{
                      width: `${
                        roster.length > 0 ? (counts.marked / roster.length) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="table-scroll">
                <table className="data-table att-roster">
                  <thead>
                    <tr>
                      <th style={{ width: "42px" }}>#</th>
                      <th>Pupil</th>
                      <th style={{ width: "112px" }}>USN</th>
                      <th style={{ width: "132px" }}>Term</th>
                      <th style={{ minWidth: "330px" }}>Status</th>
                      <th style={{ minWidth: "190px" }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "44px" }}>
                          <p className="att-empty-text">
                            This class has no active pupils to mark.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      roster.map((pupil, index) => {
                        const entry = draft[pupil.id];
                        const status = entry?.status ?? null;
                        return (
                          <tr key={pupil.id} data-unmarked={status === null || undefined}>
                            <td className="muted-cell" style={{ fontSize: "12px" }}>
                              {index + 1}
                            </td>
                            <td>
                              <div className="att-pupil">
                                <span className="avatar">{pupil.initials}</span>
                                <div className="att-pupil-copy">
                                  <span className="att-pupil-name">{pupil.name}</span>
                                  <span className="att-pupil-sub">
                                    {pupil.rollNo
                                      ? `Roll ${pupil.rollNo}`
                                      : "No roll number"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="muted-cell att-mono">{pupil.usn || "—"}</td>
                            <td>
                              {pupil.termTotal > 0 ? (
                                <div className="att-table-rate">
                                  <span className="progress-bar">
                                    <span
                                      style={{
                                        width: `${pupil.termPercent}%`,
                                        background: rateColor(pupil.termPercent, true),
                                      }}
                                    />
                                  </span>
                                  <span style={{ color: rateColor(pupil.termPercent, true) }}>
                                    {pupil.termPercent}%
                                  </span>
                                </div>
                              ) : (
                                <span className="muted-cell att-mono">No history</span>
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
                                  className="att-notes"
                                  value={entry?.notes ?? ""}
                                  onChange={(event) => setNotes(pupil.id, event.target.value)}
                                  placeholder="Optional note"
                                  aria-label={`Remarks for ${pupil.name}`}
                                  maxLength={500}
                                />
                              ) : (
                                <span className="muted-cell" style={{ fontSize: "12.5px" }}>
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

              <footer className="att-savebar">
                <div className="att-savebar-counts">
                  <span className="att-count present">
                    <Check size={11} /> {counts.present}
                  </span>
                  <span className="att-count late">
                    <Clock3 size={11} /> {counts.late}
                  </span>
                  <span className="att-count leave">
                    <CalendarDays size={11} /> {counts.leave}
                  </span>
                  <span className="att-count absent">
                    <X size={11} /> {counts.absent}
                  </span>
                  {counts.unmarked > 0 && (
                    <span className="att-count unmarked">
                      <Minus size={11} /> {counts.unmarked} unmarked
                    </span>
                  )}
                </div>

                {canMark ? (
                  <div className="att-savebar-actions">
                    <input
                      className="att-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Reason for changes (optional)"
                      aria-label="Reason for attendance changes"
                      maxLength={500}
                    />
                    <button
                      className="primary-button"
                      onClick={handleSave}
                      disabled={!allMarked || saving}
                      title={
                        allMarked ? "Save this register" : "Mark every pupil before saving"
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
                  <span className="att-savebar-note">
                    {managerView
                      ? "Read-only — the class teacher saves this register."
                      : "You are not the class teacher for this class."}
                  </span>
                )}
              </footer>
            </section>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* Drill-down drawer                                            */}
      {/* ------------------------------------------------------------ */}
      {inspectClassId &&
        inspectedClass &&
        createPortal(
          <>
            <div
              className="att-drawer-scrim"
              onClick={() => setInspectClassId(null)}
              aria-hidden="true"
            />
            <aside
              className="att-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={`${inspectedClass.label} attendance`}
            >
              <header className="att-drawer-head">
                <div className="att-class-id">
                  <span className="att-class-badge att-class-badge-lg">
                    {inspectedClass.grade}
                  </span>
                  <div className="att-class-id-copy">
                    <div className="att-drawer-title-row">
                      <h2 className="att-drawer-title">
                        Grade {inspectedClass.grade} · {inspectedClass.section}
                      </h2>
                      <span
                        className={`status-pill ${
                          classState(inspectedClass) === "pending"
                            ? "warning"
                            : classState(inspectedClass) === "complete"
                            ? "success"
                            : "neutral"
                        }`}
                      >
                        {classState(inspectedClass) === "pending"
                          ? "Pending"
                          : classState(inspectedClass) === "complete"
                          ? "Marked"
                          : `${inspectedClass.markedToday}/${inspectedClass.studentCount}`}
                      </span>
                    </div>
                    <p className="att-class-sub">
                      {inspectedClass.classTeacherName ?? "No class teacher"}
                      {inspectedClass.room ? ` · Room ${inspectedClass.room}` : ""} ·{" "}
                      {readableDate(data?.date ?? date)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="att-icon-btn"
                  onClick={() => setInspectClassId(null)}
                  aria-label="Close details"
                >
                  <X size={17} />
                </button>
              </header>

              <div className="att-drawer-body">
                <div className="att-drawer-stats">
                  <div className="att-mini-stat">
                    <span>Enrolled</span>
                    <strong>{inspectedClass.studentCount}</strong>
                  </div>
                  <div className="att-mini-stat">
                    <span>Present</span>
                    <strong style={{ color: "var(--success)" }}>
                      {inspectedClass.presentToday}
                    </strong>
                  </div>
                  <div className="att-mini-stat">
                    <span>Absent</span>
                    <strong style={{ color: "var(--danger-strong)" }}>
                      {inspectedClass.absentToday ?? 0}
                    </strong>
                  </div>
                  <div className="att-mini-stat">
                    <span>Rate</span>
                    <strong style={{ color: "var(--brand-strong)" }}>
                      {(inspectedClass.markedToday ?? 0) > 0
                        ? `${inspectedClass.todayPercent}%`
                        : "—"}
                    </strong>
                  </div>
                </div>

                {classState(inspectedClass) === "pending" && (
                  <div className="att-inline-alert">
                    <AlertCircle size={16} />
                    <div>
                      <strong>Attendance pending</strong>
                      <p>
                        {inspectedClass.classTeacherName
                          ? `${inspectedClass.classTeacherName} has not submitted this register yet.`
                          : "No class teacher is assigned to submit this register."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="att-drawer-roster">
                  <div className="att-drawer-roster-head">
                    <h3>
                      Pupils
                      <span className="att-drawer-count">
                        {inspectRoster ? inspectRoster.length : inspectedClass.studentCount}
                      </span>
                    </h3>
                    <div className="att-drawer-filters">
                      <button
                        type="button"
                        className={`status-pill ${drawerRosterFilter === "all" ? "brand" : "neutral"}`}
                        onClick={() => setDrawerRosterFilter("all")}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={`status-pill ${drawerRosterFilter === "absent" ? "danger" : "neutral"}`}
                        onClick={() => setDrawerRosterFilter("absent")}
                      >
                        Exceptions
                      </button>
                      <button
                        type="button"
                        className={`status-pill ${drawerRosterFilter === "present" ? "success" : "neutral"}`}
                        onClick={() => setDrawerRosterFilter("present")}
                      >
                        Present
                      </button>
                    </div>
                  </div>

                  {inspectLoading ? (
                    <SkeletonRegion label="Loading pupils">
                      <SkeletonList rows={5} avatar />
                    </SkeletonRegion>
                  ) : !inspectRoster || inspectRoster.length === 0 ? (
                    <div className="att-empty-inline">
                      <Users size={18} />
                      <p>No pupils are enrolled in this class.</p>
                    </div>
                  ) : drawerStudents.length === 0 ? (
                    <div className="att-empty-inline">
                      <CheckCircle2 size={18} />
                      <p>No pupils match this filter.</p>
                    </div>
                  ) : (
                    <ul className="att-drawer-list">
                      {drawerStudents.map((pupil) => (
                        <li key={pupil.id} className="att-drawer-row">
                          <span className="att-drawer-avatar">{pupil.initials}</span>
                          <span className="att-drawer-pupil">
                            <span className="att-drawer-name">
                              {pupil.name}
                              {pupil.rollNo && (
                                <span className="att-drawer-roll">#{pupil.rollNo}</span>
                              )}
                            </span>
                            <span className="att-drawer-meta">
                              {pupil.notes
                                ? pupil.notes
                                : pupil.usn || "No USN recorded"}
                            </span>
                          </span>
                          {pupil.status ? (
                            <span
                              className={`status-pill ${attendanceTone(
                                pupil.status as AttendanceStatus
                              )}`}
                            >
                              {ATTENDANCE_STATUS_LABELS[pupil.status as AttendanceStatus]}
                            </span>
                          ) : (
                            <span className="status-pill neutral">Pending</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <footer className="att-drawer-foot">
                <span className="att-drawer-foot-note">
                  {inspectedClass.markedAt
                    ? `Submitted ${formatClock(inspectedClass.markedAt)}`
                    : "Register not submitted"}
                </span>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setInspectClassId(null)}
                >
                  Close
                </button>
              </footer>
            </aside>
          </>,
          document.body
        )}
    </div>
  );
}

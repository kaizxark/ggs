/**
 * Chairman / Managing Director Executive Wallboard — /mdview
 *
 * Designed as a 100vh television / wallboard executive display.
 * Fits entirely within the viewport without requiring page-level scroll,
 * featuring interactive Recharts graphs for both Attendance and Fees,
 * a top-level KPI executive summary strip, and a scrollable grade/class
 * breakdown panel with section absentee rosters and live payment receipts.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ChevronRight,
  LogOut,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";

import "./MdView.css";

/* ------------------------------------------------------------------ */
/* Data contract                                                       */
/* ------------------------------------------------------------------ */

interface ClassAttendanceItem {
  id: string;
  grade: string;
  section: string;
  label: string;
  room: string;
  teacherName: string;
  enrolled: number;
  present: number;
  absent: number;
  unmarked: number;
  rate: number;
  status: "high" | "average" | "low";
  absentees: string[];
}

interface ClassFeeItem {
  id: string;
  grade: string;
  section: string;
  label: string;
  room: string;
  teacherName: string;
  enrolled: number;
  billed: number;
  collected: number;
  outstanding: number;
  rate: number;
  paidStudents: number;
  pendingStudents: number;
}

interface RecentPaymentItem {
  id: string;
  receiptNo: string;
  studentName: string;
  usn: string;
  classLabel: string;
  amount: number;
  method: string;
  paidAt: string;
}

interface MdViewData {
  ok: boolean;
  timestamp: string;
  schoolName: string;
  academicYear: string;
  totalStudents: number;
  totalClassrooms: number;
  attendance: {
    date: string;
    overallRate: number;
    presentCount: number;
    absentCount: number;
    unmarkedCount: number;
    classesReported: number;
    classesTotal: number;
    classes: ClassAttendanceItem[];
  };
  fees: {
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    totalOverdue: number;
    collectionRate: number;
    paidInvoicesCount: number;
    partialInvoicesCount: number;
    overdueInvoicesCount: number;
    classes: ClassFeeItem[];
    recentPayments: RecentPaymentItem[];
  };
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

function money(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "₹0";
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)} L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function count(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString("en-IN");
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function prettyDate(iso: string): string {
  if (!iso) return "Today";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function clockTime(date: Date): string {
  return date
    .toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase();
}

function clockDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/* ------------------------------------------------------------------ */
/* Grade grouping logic                                                */
/* ------------------------------------------------------------------ */

interface GradeAttendance {
  grade: string;
  enrolled: number;
  present: number;
  absent: number;
  unmarked: number;
  rate: number;
  classes: ClassAttendanceItem[];
}

interface GradeFees {
  grade: string;
  enrolled: number;
  billed: number;
  collected: number;
  outstanding: number;
  rate: number;
  classes: ClassFeeItem[];
}

function gradeOrder(grade: string): [number, string] {
  const numeric = Number.parseInt(grade, 10);
  return [Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER, grade];
}

function groupAttendance(classes: ClassAttendanceItem[]): GradeAttendance[] {
  const groups = new Map<string, GradeAttendance>();

  for (const item of classes) {
    const unmark =
      item.unmarked ?? Math.max(0, item.enrolled - (item.present + item.absent));
    const group = groups.get(item.grade) ?? {
      grade: item.grade,
      enrolled: 0,
      present: 0,
      absent: 0,
      unmarked: 0,
      rate: 0,
      classes: [],
    };
    group.enrolled += item.enrolled;
    group.present += item.present;
    group.absent += item.absent;
    group.unmarked += unmark;
    group.classes.push(item);
    groups.set(item.grade, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      rate:
        group.enrolled > 0
          ? Math.round((group.present / group.enrolled) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => {
      const [aOrder, aGrade] = gradeOrder(a.grade);
      const [bOrder, bGrade] = gradeOrder(b.grade);
      return aOrder - bOrder || aGrade.localeCompare(bGrade);
    });
}

function groupFees(classes: ClassFeeItem[]): GradeFees[] {
  const groups = new Map<string, GradeFees>();

  for (const item of classes) {
    const group = groups.get(item.grade) ?? {
      grade: item.grade,
      enrolled: 0,
      billed: 0,
      collected: 0,
      outstanding: 0,
      rate: 0,
      classes: [],
    };
    group.enrolled += item.enrolled;
    group.billed += item.billed;
    group.collected += item.collected;
    group.outstanding += item.outstanding;
    group.classes.push(item);
    groups.set(item.grade, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      rate:
        group.billed > 0
          ? Math.round((group.collected / group.billed) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => {
      const [aOrder, aGrade] = gradeOrder(a.grade);
      const [bOrder, bGrade] = gradeOrder(b.grade);
      return aOrder - bOrder || aGrade.localeCompare(bGrade);
    });
}

const ATTENDANCE_TARGET = 85;
const COLLECTION_TARGET = 65;

/* ------------------------------------------------------------------ */
/* Chart Tooltips                                                      */
/* ------------------------------------------------------------------ */

interface AttendanceChartDatum {
  gradeLabel: string;
  gradeNum: string;
  rate: number;
  present: number;
  absent: number;
  unmarked: number;
  enrolled: number;
}

function AttendanceChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: AttendanceChartDatum }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const isGood = d.rate >= ATTENDANCE_TARGET;

  return (
    <div className="mdv-chart-tooltip">
      <div className="mdv-tooltip-head">
        <strong>Grade {d.gradeNum}</strong>
        <span className={`mdv-pill ${isGood ? "mdv-pill--good" : "mdv-pill--warn"}`}>
          {d.rate}% Rate
        </span>
      </div>
      <div className="mdv-tooltip-metrics">
        <div>
          <span>Present</span>
          <strong className="text-sage">{count(d.present)}</strong>
        </div>
        <div>
          <span>Absent</span>
          <strong className="text-crimson">{count(d.absent)}</strong>
        </div>
        <div>
          <span>Unmarked</span>
          <strong className="text-muted">{count(d.unmarked)}</strong>
        </div>
        <div>
          <span>Enrolled</span>
          <strong>{count(d.enrolled)}</strong>
        </div>
      </div>
    </div>
  );
}

interface FeesChartDatum {
  gradeLabel: string;
  gradeNum: string;
  billed: number;
  collected: number;
  outstanding: number;
  rate: number;
}

function FeesChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: FeesChartDatum }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const isGood = d.rate >= COLLECTION_TARGET;

  return (
    <div className="mdv-chart-tooltip">
      <div className="mdv-tooltip-head">
        <strong>Grade {d.gradeNum}</strong>
        <span className={`mdv-pill ${isGood ? "mdv-pill--good" : "mdv-pill--warn"}`}>
          {d.rate}% Collected
        </span>
      </div>
      <div className="mdv-tooltip-metrics">
        <div>
          <span>Collected</span>
          <strong className="text-sage">{money(d.collected)}</strong>
        </div>
        <div>
          <span>Outstanding</span>
          <strong className="text-amber">{money(d.outstanding)}</strong>
        </div>
        <div>
          <span>Total Billed</span>
          <strong>{money(d.billed)}</strong>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Attendance View                                                     */
/* ------------------------------------------------------------------ */

function AttendanceBoard({
  data,
  expanded,
  onToggleGrade,
  onOpenClass,
}: {
  data: MdViewData;
  expanded: Set<string>;
  onToggleGrade: (grade: string) => void;
  onOpenClass: (item: ClassAttendanceItem) => void;
}) {
  const { attendance, totalStudents } = data;
  const groups = useMemo(
    () => groupAttendance(attendance.classes),
    [attendance.classes]
  );

  const unmarked =
    attendance.unmarkedCount ??
    Math.max(
      0,
      totalStudents - (attendance.presentCount + attendance.absentCount)
    );

  const belowTargetCount = groups.filter((g) => g.rate < ATTENDANCE_TARGET).length;
  const highestGrade = useMemo(() => {
    if (!groups.length) return null;
    return [...groups].sort((a, b) => b.rate - a.rate)[0];
  }, [groups]);

  const chartData: AttendanceChartDatum[] = useMemo(() => {
    return groups.map((g) => ({
      gradeLabel: `Gr ${g.grade}`,
      gradeNum: g.grade,
      rate: g.rate,
      present: g.present,
      absent: g.absent,
      unmarked: g.unmarked,
      enrolled: g.enrolled,
    }));
  }, [groups]);

  return (
    <div className="mdv-board-container">
      {/* 1. Executive Summary Strip */}
      <section className="mdv-kpi-strip" aria-label="Attendance summary metrics">
        <div className="mdv-kpi-card mdv-kpi-card--primary">
          <span className="mdv-kpi-label">Overall Attendance</span>
          <div className="mdv-kpi-val">
            {attendance.overallRate.toFixed(1)}
            <small>%</small>
          </div>
          <span className="mdv-kpi-meta">
            Target: 85% · <b>{prettyDate(attendance.date)}</b>
          </span>
        </div>

        <div className="mdv-kpi-card">
          <span className="mdv-kpi-label">Present Today</span>
          <div className="mdv-kpi-val text-sage">
            {count(attendance.presentCount)}
          </div>
          <span className="mdv-kpi-meta">
            Verified in active classrooms
          </span>
        </div>

        <div className="mdv-kpi-card">
          <span className="mdv-kpi-label">Absent Today</span>
          <div className="mdv-kpi-val text-crimson">
            {count(attendance.absentCount)}
          </div>
          <span className="mdv-kpi-meta">
            Unexcused absences on record
          </span>
        </div>

        <div className="mdv-kpi-card">
          <span className="mdv-kpi-label">Unmarked</span>
          <div className="mdv-kpi-val text-muted">
            {count(unmarked)}
          </div>
          <span className="mdv-kpi-meta">
            Enrolled without roll-call log
          </span>
        </div>

        <div className="mdv-kpi-card">
          <span className="mdv-kpi-label">Grades on Target</span>
          <div className="mdv-kpi-val">
            {groups.length - belowTargetCount}
            <small> / {groups.length}</small>
          </div>
          <span className="mdv-kpi-meta">
            {belowTargetCount === 0 ? (
              <span className="text-sage font-medium">All grades ≥ 85%</span>
            ) : (
              <span className="text-amber font-medium">{belowTargetCount} grades below target</span>
            )}
          </span>
        </div>
      </section>

      {/* 2. Side-by-Side Chart and Drill-down Split */}
      <div className="mdv-split">
        {/* Left: Recharts BarChart */}
        <section className="mdv-panel mdv-panel--chart">
          <header className="mdv-panel-head">
            <div>
              <h2>Grade-Wise Attendance Rate</h2>
              <p>Live attendance percentage across Grades 1 through 10</p>
            </div>
            <div className="mdv-legend-pills">
              <span className="mdv-pill mdv-pill--good">
                <i /> ≥ 85% On Track
              </span>
              <span className="mdv-pill mdv-pill--warn">
                <i /> &lt; 85% Attention
              </span>
            </div>
          </header>

          <div className="mdv-chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 16, left: -16, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(36, 30, 24, 0.08)"
                />
                <XAxis
                  dataKey="gradeLabel"
                  axisLine={{ stroke: "rgba(36, 30, 24, 0.15)" }}
                  tickLine={false}
                  tick={{ fill: "#5a4f44", fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#7a6e5f", fontSize: 11 }}
                  unit="%"
                />
                <Tooltip
                  content={<AttendanceChartTooltip />}
                  cursor={{ fill: "rgba(36, 30, 24, 0.04)" }}
                />
                <ReferenceLine
                  y={ATTENDANCE_TARGET}
                  stroke="#b45309"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "85% Target",
                    fill: "#b45309",
                    fontSize: 10,
                    fontWeight: 700,
                    position: "insideTopRight",
                    offset: -8,
                  }}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={38}>
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={entry.rate >= ATTENDANCE_TARGET ? "#15803d" : "#d97706"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <footer className="mdv-panel-foot">
            {highestGrade && (
              <span>
                Highest attendance: <b>Grade {highestGrade.grade}</b> ({highestGrade.rate}%)
              </span>
            )}
            <span>Click any section in the breakdown table to view absent students</span>
          </footer>
        </section>

        {/* Right: Grade & Class Breakdown Table */}
        <section className="mdv-panel mdv-panel--table">
          <header className="mdv-panel-head">
            <div>
              <h2>Classrooms & Sections</h2>
              <p>Expand a grade to see section breakdown & absent rolls</p>
            </div>
            <span className="mdv-badge-count">{groups.length} Grades</span>
          </header>

          <div className="mdv-scrollable-content">
            <table className="mdv-table">
              <thead>
                <tr>
                  <th>Grade / Section</th>
                  <th className="num">Present</th>
                  <th className="num">Absent</th>
                  <th className="num">Rate</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const open = expanded.has(group.grade);
                  return (
                    <Fragment key={group.grade}>
                      <tr
                        className="mdv-row"
                        onClick={() => onToggleGrade(group.grade)}
                      >
                        <td>
                          <button
                            type="button"
                            className="mdv-row-btn"
                            aria-expanded={open}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleGrade(group.grade);
                            }}
                          >
                            <ChevronRight
                              size={14}
                              className={`mdv-chevron ${open ? "mdv-chevron--open" : ""}`}
                            />
                            <strong>Grade {group.grade}</strong>
                            <em>
                              {group.classes.length}{" "}
                              {group.classes.length === 1 ? "sec" : "secs"} · {group.enrolled} stu
                            </em>
                          </button>
                        </td>
                        <td className="num text-sage font-mono">
                          {count(group.present)}
                        </td>
                        <td className="num text-crimson font-mono">
                          {count(group.absent)}
                        </td>
                        <td className="num">
                          <span
                            className={`mdv-rate-tag ${
                              group.rate >= ATTENDANCE_TARGET
                                ? "mdv-rate-tag--good"
                                : "mdv-rate-tag--warn"
                            }`}
                          >
                            {percent(group.rate)}
                          </span>
                        </td>
                      </tr>

                      {open &&
                        group.classes.map((cls) => (
                          <tr
                            key={cls.id}
                            className="mdv-row mdv-row--sub"
                            onClick={() => onOpenClass(cls)}
                            title="Click to view absentee roster"
                          >
                            <td>
                              <div className="mdv-sub-label">
                                <span className="mdv-sub-tag">Sec {cls.section}</span>
                                <span className="mdv-sub-teacher">
                                  {cls.teacherName === "Unassigned"
                                    ? "No Class Teacher"
                                    : cls.teacherName}
                                  {cls.room ? ` · Rm ${cls.room}` : ""}
                                </span>
                              </div>
                            </td>
                            <td className="num text-sage font-mono">
                              {count(cls.present)}
                            </td>
                            <td className="num text-crimson font-mono">
                              {count(cls.absent)}
                            </td>
                            <td className="num">
                              <span className="mdv-sub-rate">
                                {percent(cls.rate)}
                                <ArrowUpRight size={11} className="mdv-sub-arrow" />
                              </span>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fees View                                                           */
/* ------------------------------------------------------------------ */

function FeesBoard({
  data,
  expanded,
  onToggleGrade,
}: {
  data: MdViewData;
  expanded: Set<string>;
  onToggleGrade: (grade: string) => void;
}) {
  const { fees } = data;
  const groups = useMemo(() => groupFees(fees.classes), [fees.classes]);
  const [activeTab, setActiveTab] = useState<"grades" | "receipts">("grades");

  const chartData: FeesChartDatum[] = useMemo(() => {
    return groups.map((g) => ({
      gradeLabel: `Gr ${g.grade}`,
      gradeNum: g.grade,
      billed: g.billed,
      collected: g.collected,
      outstanding: g.outstanding,
      rate: g.rate,
    }));
  }, [groups]);

  const topGradeCollection = useMemo(() => {
    if (!groups.length) return null;
    return [...groups].sort((a, b) => b.rate - a.rate)[0];
  }, [groups]);

  return (
    <div className="mdv-board-container">
      {/* 1. Executive Summary Strip */}
      <section className="mdv-kpi-strip" aria-label="Fee collection summary metrics">
        <div className="mdv-kpi-card mdv-kpi-card--primary">
          <span className="mdv-kpi-label">Collection Rate</span>
          <div className="mdv-kpi-val">
            {fees.collectionRate.toFixed(1)}
            <small>%</small>
          </div>
          <span className="mdv-kpi-meta">
            Target: 65% · <b>{money(fees.totalBilled)} billed</b>
          </span>
        </div>

        <div className="mdv-kpi-card">
          <span className="mdv-kpi-label">Total Collected</span>
          <div className="mdv-kpi-val text-sage">
            {money(fees.totalCollected)}
          </div>
          <span className="mdv-kpi-meta">
            Realized cash & digital receipts
          </span>
        </div>

        <div className="mdv-kpi-card">
          <span className="mdv-kpi-label">Outstanding Fees</span>
          <div className="mdv-kpi-val text-amber">
            {money(fees.totalOutstanding)}
          </div>
          <span className="mdv-kpi-meta">
            Balance pending collection
          </span>
        </div>

        <div className="mdv-kpi-card">
          <span className="mdv-kpi-label">Overdue Balance</span>
          <div className="mdv-kpi-val text-crimson">
            {money(fees.totalOverdue)}
          </div>
          <span className="mdv-kpi-meta">
            {fees.overdueInvoicesCount > 0 ? (
              <span className="text-crimson font-medium">{fees.overdueInvoicesCount} invoices past due</span>
            ) : (
              <span className="text-sage font-medium">No overdue invoices</span>
            )}
          </span>
        </div>

        <div className="mdv-kpi-card">
          <span className="mdv-kpi-label">Total Invoices</span>
          <div className="mdv-kpi-val">
            {count(fees.paidInvoicesCount)}
            <small> / {count(fees.paidInvoicesCount + fees.partialInvoicesCount + fees.overdueInvoicesCount)}</small>
          </div>
          <span className="mdv-kpi-meta">
            Fully settled student accounts
          </span>
        </div>
      </section>

      {/* 2. Side-by-Side Chart and Breakdown Split */}
      <div className="mdv-split">
        {/* Left: Recharts Grouped BarChart */}
        <section className="mdv-panel mdv-panel--chart">
          <header className="mdv-panel-head">
            <div>
              <h2>Grade-Wise Fee Collections</h2>
              <p>Collected vs Outstanding amounts across Grades 1 through 10</p>
            </div>
            <div className="mdv-legend-pills">
              <span className="mdv-pill mdv-pill--good">
                <i /> Collected
              </span>
              <span className="mdv-pill mdv-pill--amber">
                <i /> Outstanding
              </span>
            </div>
          </header>

          <div className="mdv-chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 16, left: 0, bottom: 4 }}
                barGap={4}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(36, 30, 24, 0.08)"
                />
                <XAxis
                  dataKey="gradeLabel"
                  axisLine={{ stroke: "rgba(36, 30, 24, 0.15)" }}
                  tickLine={false}
                  tick={{ fill: "#5a4f44", fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#7a6e5f", fontSize: 11 }}
                  tickFormatter={(val) => money(val)}
                />
                <Tooltip
                  content={<FeesChartTooltip />}
                  cursor={{ fill: "rgba(36, 30, 24, 0.04)" }}
                />
                <Bar
                  dataKey="collected"
                  name="Collected"
                  fill="#15803d"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
                <Bar
                  dataKey="outstanding"
                  name="Outstanding"
                  fill="#ea580c"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <footer className="mdv-panel-foot">
            {topGradeCollection && (
              <span>
                Leading grade: <b>Grade {topGradeCollection.grade}</b> ({topGradeCollection.rate}% collected · {money(topGradeCollection.collected)})
              </span>
            )}
            <span>Live payments sync automatically</span>
          </footer>
        </section>

        {/* Right: Grade Breakdown or Recent Receipts */}
        <section className="mdv-panel mdv-panel--table">
          <header className="mdv-panel-head">
            <div>
              <h2>{activeTab === "grades" ? "Grade Financials" : "Live Receipts Stream"}</h2>
              <p>
                {activeTab === "grades"
                  ? "Billed, collected and outstanding fee totals"
                  : "Latest 25 verified payment transactions"}
              </p>
            </div>
            <div className="mdv-tab-pills" role="tablist">
              <button
                type="button"
                className={`mdv-tab-btn ${activeTab === "grades" ? "mdv-tab-btn--active" : ""}`}
                onClick={() => setActiveTab("grades")}
              >
                <Layers size={13} />
                Grades
              </button>
              <button
                type="button"
                className={`mdv-tab-btn ${activeTab === "receipts" ? "mdv-tab-btn--active" : ""}`}
                onClick={() => setActiveTab("receipts")}
              >
                <Receipt size={13} />
                Receipts ({fees.recentPayments.length})
              </button>
            </div>
          </header>

          <div className="mdv-scrollable-content">
            {activeTab === "grades" ? (
              <table className="mdv-table">
                <thead>
                  <tr>
                    <th>Grade / Section</th>
                    <th className="num">Collected</th>
                    <th className="num">Pending</th>
                    <th className="num">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const open = expanded.has(group.grade);
                    return (
                      <Fragment key={group.grade}>
                        <tr
                          className="mdv-row"
                          onClick={() => onToggleGrade(group.grade)}
                        >
                          <td>
                            <button
                              type="button"
                              className="mdv-row-btn"
                              aria-expanded={open}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleGrade(group.grade);
                              }}
                            >
                              <ChevronRight
                                size={14}
                                className={`mdv-chevron ${open ? "mdv-chevron--open" : ""}`}
                              />
                              <strong>Grade {group.grade}</strong>
                              <em>
                                {group.classes.length}{" "}
                                {group.classes.length === 1 ? "sec" : "secs"} · {money(group.billed)}
                              </em>
                            </button>
                          </td>
                          <td className="num text-sage font-mono">
                            {money(group.collected)}
                          </td>
                          <td className="num text-amber font-mono">
                            {money(group.outstanding)}
                          </td>
                          <td className="num">
                            <span
                              className={`mdv-rate-tag ${
                                group.rate >= COLLECTION_TARGET
                                  ? "mdv-rate-tag--good"
                                  : "mdv-rate-tag--warn"
                              }`}
                            >
                              {percent(group.rate)}
                            </span>
                          </td>
                        </tr>

                        {open &&
                          group.classes.map((cls) => (
                            <tr
                              key={cls.id}
                              className="mdv-row mdv-row--sub mdv-row--static"
                            >
                              <td>
                                <div className="mdv-sub-label">
                                  <span className="mdv-sub-tag">Sec {cls.section}</span>
                                  <span className="mdv-sub-teacher">
                                    {cls.paidStudents} paid · {cls.pendingStudents} pending
                                  </span>
                                </div>
                              </td>
                              <td className="num text-sage font-mono">
                                {money(cls.collected)}
                              </td>
                              <td className="num text-amber font-mono">
                                {money(cls.outstanding)}
                              </td>
                              <td className="num">
                                <span className="mdv-sub-rate">
                                  {percent(cls.rate)}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="mdv-receipts-list">
                {fees.recentPayments.length === 0 ? (
                  <p className="mdv-empty-msg">No recent receipts on record.</p>
                ) : (
                  fees.recentPayments.map((p) => (
                    <div className="mdv-receipt-item" key={p.id}>
                      <div className="mdv-receipt-left">
                        <div className="mdv-receipt-name">{p.studentName}</div>
                        <div className="mdv-receipt-meta">
                          <span>{p.classLabel}</span>
                          <span>·</span>
                          <span className="font-mono">{p.receiptNo}</span>
                          <span>·</span>
                          <span className="mdv-pay-badge">{p.method}</span>
                        </div>
                      </div>
                      <div className="mdv-receipt-right">
                        <div className="mdv-receipt-amount">{money(p.amount)}</div>
                        <div className="mdv-receipt-time">
                          {p.paidAt
                            ? new Date(p.paidAt).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              })
                            : "—"}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Roster Dialog                                                       */
/* ------------------------------------------------------------------ */

function RosterDialog({
  item,
  onClose,
}: {
  item: ClassAttendanceItem;
  onClose: () => void;
}) {
  const hiddenCount = Math.max(0, item.absent - item.absentees.length);

  return (
    <div className="mdv-scrim" onClick={onClose}>
      <div
        className="mdv-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mdv-roster-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mdv-dialog-head">
          <div>
            <h2 id="mdv-roster-title">{item.label}</h2>
            <p>
              {item.teacherName === "Unassigned"
                ? "No Class Teacher"
                : item.teacherName}
              {item.room ? ` · Room ${item.room}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="mdv-dialog-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="mdv-dialog-stats">
          <div>
            <span>Enrolled</span>
            <strong>{item.enrolled}</strong>
          </div>
          <div>
            <span>Present</span>
            <strong className="text-sage">{item.present}</strong>
          </div>
          <div>
            <span>Absent</span>
            <strong className="text-crimson">{item.absent}</strong>
          </div>
          <div>
            <span>Rate</span>
            <strong>{percent(item.rate)}</strong>
          </div>
        </div>

        <div className="mdv-dialog-body">
          <h3>Absentees on Record ({item.absent})</h3>
          {item.absentees.length > 0 ? (
            <ul className="mdv-roster-list">
              {item.absentees.map((name, index) => (
                <li key={`${name}-${index}`}>
                  <span className="mdv-roster-name">{name}</span>
                  <span className="mdv-roster-status">Unexcused</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mdv-empty-msg">No students marked absent for this classroom today.</p>
          )}
          {hiddenCount > 0 && (
            <p className="mdv-dialog-more">and {hiddenCount} more unlisted absentees.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Wallboard Component                                            */
/* ------------------------------------------------------------------ */

const AUTH_KEY = "mdview_auth";
const AUTH_TOKEN = "admin123";
const POLL_MS = 10_000;

export default function MdView() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem(AUTH_KEY) === AUTH_TOKEN ||
        sessionStorage.getItem(AUTH_KEY) === AUTH_TOKEN
      );
    } catch {
      return false;
    }
  });

  const [usernameInput, setUsernameInput] = useState("admin");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [view, setView] = useState<"attendance" | "fees">("attendance");
  const [auto, setAuto] = useState(true);
  const [data, setData] = useState<MdViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassAttendanceItem | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* Clock tick */
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow((prev) => {
        const next = new Date();
        return next.getMinutes() === prev.getMinutes() ? prev : next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const fetchData = useCallback(
    async (initial = false) => {
      if (!isAuthenticated) return;
      if (initial) setLoading(true);
      try {
        const response = await fetch(`/api/mdview?auth=${AUTH_TOKEN}`, {
          headers: { "X-MD-Auth": AUTH_TOKEN },
        });

        if (response.status === 401) {
          localStorage.removeItem(AUTH_KEY);
          sessionStorage.removeItem(AUTH_KEY);
          setIsAuthenticated(false);
          return;
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = (await response.json()) as MdViewData;
        if (!mounted.current) return;
        setData(payload);
        setError(null);
        setLastUpdated(new Date());
      } catch {
        if (!mounted.current) return;
        setError("Connection lost — retrying");
      } finally {
        if (initial && mounted.current) setLoading(false);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchData(true);
  }, [isAuthenticated, fetchData]);

  /* Poll every 10 seconds */
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetchData(false);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, fetchData]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const response = await fetch("/api/mdview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (response.ok && payload.ok) {
        localStorage.setItem(AUTH_KEY, AUTH_TOKEN);
        sessionStorage.setItem(AUTH_KEY, AUTH_TOKEN);
        setIsAuthenticated(true);
      } else {
        setLoginError(payload.message ?? "Those details were not accepted.");
      }
    } catch {
      setLoginError("The wallboard could not reach the server.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
    setPasswordInput("");
    setData(null);
  };

  const toggleGrade = useCallback((grade: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(grade)) next.delete(grade);
      else next.add(grade);
      return next;
    });
  }, []);

  /* Keyboard shortcuts */
  useEffect(() => {
    if (!isAuthenticated || selectedClass) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "1") setView("attendance");
      else if (key === "2") setView("fees");
      else if (key === "r") void fetchData(false);
      else if (key === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAuthenticated, selectedClass, fetchData, toggleFullscreen]);

  useEffect(() => {
    if (!selectedClass) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedClass(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedClass]);

  /* ------------------------------------------------------------------ */
  /* Login Screen                                                        */
  /* ------------------------------------------------------------------ */

  if (!isAuthenticated) {
    return (
      <div className="mdv-login">
        <div className="mdv-login-inner">
          <div className="mdv-mark">
            <img src="/global-kids-logo.svg" alt="" />
          </div>

          <h1>Chairman's Wallboard</h1>
          <p className="mdv-lede">
            Global Kids School · Attendance & Finance Live Dashboard
          </p>

          <form onSubmit={handleLogin}>
            <label className="mdv-field">
              <span>Username</span>
              <input
                type="text"
                value={usernameInput}
                onChange={(event) => setUsernameInput(event.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className="mdv-field">
              <span>Password</span>
              <input
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
            </label>

            <button
              type="submit"
              className="mdv-submit"
              disabled={loginLoading}
            >
              {loginLoading ? "Verifying…" : "Open Executive Wallboard"}
              {!loginLoading && <ChevronRight size={15} />}
            </button>

            {loginError && (
              <p className="mdv-error" role="alert">
                {loginError}
              </p>
            )}
          </form>

          <p className="mdv-login-foot">Global Kids School · Tumakuru</p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Wallboard Screen (100vh)                                           */
  /* ------------------------------------------------------------------ */

  return (
    <div className="mdv">
      {/* 1. Header Bar */}
      <header className="mdv-bar">
        <div className="mdv-id">
          <span className="mdv-wordmark">Global Kids School</span>
          <span className="mdv-context">
            {data
              ? `${data.totalClassrooms} Classrooms · ${count(data.totalStudents)} Students`
              : "Loading Executive Wallboard"}
          </span>
        </div>

        <div className="mdv-mode">
          <div className="mdv-switch" role="group" aria-label="Select view">
            <button
              type="button"
              aria-pressed={view === "attendance"}
              onClick={() => setView("attendance")}
            >
              Attendance
            </button>
            <button
              type="button"
              aria-pressed={view === "fees"}
              onClick={() => setView("fees")}
            >
              Fees & Revenue
            </button>
          </div>

          <button
            type="button"
            className="mdv-auto"
            aria-pressed={auto}
            onClick={() => setAuto((current) => !current)}
            title={
              auto
                ? "Auto-cycling between views every 15s"
                : "Auto-cycle paused"
            }
          >
            Auto
            <span className="mdv-auto-track" aria-hidden="true">
              <i />
            </span>
          </button>
        </div>

        <div className="mdv-right">
          <div className="mdv-clock">
            <b>{clockTime(now)}</b>
            <span>{clockDate(now)}</span>
          </div>

          <div className="mdv-actions">
            <button
              type="button"
              onClick={() => void fetchData(false)}
              aria-label="Refresh data"
              title="Refresh data"
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              data-danger="true"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Auto-cycle Progress Line */}
      <div className="mdv-progress" aria-hidden="true">
        <i
          key={`${view}-${auto}`}
          data-paused={auto ? "false" : "true"}
          onAnimationEnd={() => {
            if (!auto) return;
            setView((current) =>
              current === "attendance" ? "fees" : "attendance"
            );
          }}
        />
      </div>

      {error && data && (
        <div className="mdv-notice" role="status">
          <b>{error}.</b>
          {lastUpdated && (
            <span>Displaying reading from {clockTime(lastUpdated)}.</span>
          )}
        </div>
      )}

      {/* 3. Main Dashboard Body (100vh container) */}
      {!data ? (
        <div className="mdv-standby">
          {loading ? (
            <>
              <div className="mdv-standby-line">
                <i />
              </div>
              <p>Connecting to Executive Wallboard…</p>
            </>
          ) : (
            <>
              <p>{error ?? "No data available"}</p>
              <button
                type="button"
                className="mdv-submit mdv-retry"
                onClick={() => void fetchData(true)}
              >
                Try Again
              </button>
            </>
          )}
        </div>
      ) : (
        <main className="mdv-main">
          {view === "attendance" ? (
            <AttendanceBoard
              data={data}
              expanded={expanded}
              onToggleGrade={toggleGrade}
              onOpenClass={setSelectedClass}
            />
          ) : (
            <FeesBoard
              data={data}
              expanded={expanded}
              onToggleGrade={toggleGrade}
            />
          )}
        </main>
      )}

      {/* 4. Footer */}
      <footer className="mdv-foot">
        <div className="mdv-foot-left">
          <span className="mdv-live-dot" />
          <span>Academic Year {data?.academicYear ?? "2026-27"}</span>
        </div>
        <div className="mdv-foot-center">
          <span className="mdv-kbd-hint">Shortcuts: <b>[1]</b> Attendance · <b>[2]</b> Fees · <b>[F]</b> Fullscreen · <b>[R]</b> Refresh</span>
        </div>
        <div className="mdv-foot-right">
          <span>
            {lastUpdated
              ? `Synced ${lastUpdated.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}`
              : "Connecting…"}
          </span>
        </div>
      </footer>

      {/* 5. Absentee Roster Modal */}
      {selectedClass && (
        <RosterDialog
          item={selectedClass}
          onClose={() => setSelectedClass(null)}
        />
      )}
    </div>
  );
}

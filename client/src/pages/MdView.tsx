/**
 * Chairman's wallboard — /mdview
 *
 * A single-screen read of the school: attendance today, and where the fees
 * stand. It is displayed on a television in the chairman's office, so the
 * page answers two questions at a glance — "is anything wrong today?" and
 * "which part of the school is it?" — and nothing else.
 *
 * The layout is one printed page rather than a grid of cards: a figure that
 * carries the view, a composition bar that explains it, then a table of
 * grades. Class-level detail is one click (or one tap) away instead of being
 * printed twenty-four times. That is the whole redesign: the previous screen
 * repeated the same four facts in four bordered boxes, then repeated the
 * class list in twenty-four more, and the repetition is what made it feel
 * loud.
 *
 * The data contract is unchanged; `api/mdview.ts` still owns it.
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
} from "lucide-react";

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
  late: number;
  absent: number;
  leave: number;
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
    lateCount: number;
    absentCount: number;
    leaveCount: number;
    attendingCount: number;
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
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Indian compact currency: ₹2.72 Cr, ₹41.2 L, ₹9,500. */
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
/* Grade grouping                                                      */
/* ------------------------------------------------------------------ */

/**
 * The wallboard is read at grade level, not class level.
 *
 * Ten grades fit on a screen and answer "how is the school doing?"; thirty
 * classrooms do not, and answering the same question with thirty rows turns
 * a glance into a scan. The sections are still here — one click down — for
 * the moment the chairman asks "which class?".
 */
interface GradeAttendance {
  grade: string;
  enrolled: number;
  attending: number;
  absent: number;
  rate: number;
  classes: ClassAttendanceItem[];
}

interface GradeFees {
  grade: string;
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
    const group = groups.get(item.grade) ?? {
      grade: item.grade,
      enrolled: 0,
      attending: 0,
      absent: 0,
      rate: 0,
      classes: [],
    };
    group.enrolled += item.enrolled;
    group.attending += item.present + item.late;
    group.absent += item.absent;
    group.classes.push(item);
    groups.set(item.grade, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      // Summed, not averaged: a grade with one small section and one large
      // one must not be pulled towards the small one.
      rate:
        group.enrolled > 0
          ? Math.round((group.attending / group.enrolled) * 1000) / 10
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
      billed: 0,
      collected: 0,
      outstanding: 0,
      rate: 0,
      classes: [],
    };
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

/** Where a figure stops being fine and starts needing a look. */
const ATTENDANCE_ATTENTION = 85;
const COLLECTION_ATTENTION = 65;

function share(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function Composition({
  label,
  segments,
}: {
  label: string;
  segments: { key: string; value: number; className: string }[];
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div className="mdv-composition" role="img" aria-label={label}>
      {segments.map((segment) => (
        <i
          key={segment.key}
          className={segment.className}
          style={{ width: share(segment.value, total) }}
        />
      ))}
    </div>
  );
}

function Rate({
  value,
  watch,
}: {
  value: number;
  watch: boolean;
}) {
  return (
    <div className="mdv-rate" data-watch={watch ? "true" : "false"}>
      <span className="mdv-track">
        <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className="mdv-pct">{percent(value)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
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

  const unmarked = Math.max(
    0,
    totalStudents -
      (attendance.presentCount +
        attendance.lateCount +
        attendance.leaveCount +
        attendance.absentCount)
  );

  const belowTarget = attendance.classes.filter(
    (item) => item.rate < ATTENDANCE_ATTENTION
  ).length;

  return (
    <>
      <section className="mdv-hero">
        <div>
          <div className="mdv-figure">
            {attendance.overallRate.toFixed(1)}
            <span>%</span>
          </div>
          <span className="mdv-figure-label">
            Attendance · <b>{prettyDate(attendance.date)}</b>
          </span>
        </div>

        <div>
          <Composition
            label={`Attendance: ${attendance.presentCount} present, ${attendance.lateCount} late, ${attendance.leaveCount} on leave, ${attendance.absentCount} absent`}
            segments={[
              {
                key: "present",
                value: attendance.presentCount,
                className: "mdv-seg-present",
              },
              {
                key: "late",
                value: attendance.lateCount,
                className: "mdv-seg-late",
              },
              {
                key: "leave",
                value: attendance.leaveCount,
                className: "mdv-seg-leave",
              },
              {
                key: "absent",
                value: attendance.absentCount,
                className: "mdv-seg-absent",
              },
              {
                key: "unmarked",
                value: unmarked,
                className: "mdv-seg-unmarked",
              },
            ]}
          />

          <dl className="mdv-legend">
            <div>
              <dt>Present</dt>
              <dd>{count(attendance.presentCount)}</dd>
            </div>
            <div>
              <dt>Late</dt>
              <dd>{count(attendance.lateCount)}</dd>
            </div>
            <div>
              <dt>On leave</dt>
              <dd>{count(attendance.leaveCount)}</dd>
            </div>
            <div>
              <dt>Absent</dt>
              <dd>{count(attendance.absentCount)}</dd>
            </div>
            {unmarked > 0 && (
              <div>
                <dt>Unmarked</dt>
                <dd>{count(unmarked)}</dd>
              </div>
            )}
          </dl>

          <p className="mdv-note" data-clear={belowTarget === 0 ? "true" : "false"}>
            {belowTarget === 0 ? (
              "Every class is above the 85% mark."
            ) : (
              <>
                <b>{belowTarget}</b> of {attendance.classesTotal} classes below 85%
              </>
            )}
          </p>
        </div>
      </section>

      <div className="mdv-table-wrap">
      <table className="mdv-table">
        <thead>
          <tr>
            <th>Grade</th>
            <th className="num mdv-col-optional">Enrolled</th>
            <th className="num">Attending</th>
            <th className="num mdv-col-optional">Absent</th>
            <th className="num">Attendance</th>
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
                      className="mdv-row-label"
                      aria-expanded={open}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleGrade(group.grade);
                      }}
                    >
                      <ChevronRight size={14} className="mdv-chevron" />
                      <strong>Grade {group.grade}</strong>
                      <em>
                        {group.classes.length}{" "}
                        {group.classes.length === 1 ? "class" : "classes"}
                      </em>
                    </button>
                  </td>
                  <td className="mdv-cell-num num mdv-col-optional">
                    {count(group.enrolled)}
                  </td>
                  <td className="mdv-cell-num num">{count(group.attending)}</td>
                  <td className="mdv-cell-num num mdv-col-optional">
                    {count(group.absent)}
                  </td>
                  <td>
                    <Rate
                      value={group.rate}
                      watch={group.rate < ATTENDANCE_ATTENTION}
                    />
                  </td>
                </tr>

                {open &&
                  group.classes.map((item) => (
                    <tr
                      key={item.id}
                      className="mdv-row mdv-row--section"
                      onClick={() => onOpenClass(item)}
                    >
                      <td>
                        <button
                          type="button"
                          className="mdv-row-label"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenClass(item);
                          }}
                        >
                          <span className="mdv-sub">
                            <strong>Section {item.section}</strong>
                            <em>
                              {item.teacherName === "Unassigned"
                                ? "No class teacher"
                                : item.teacherName}
                            </em>
                          </span>
                        </button>
                      </td>
                      <td className="mdv-cell-num num mdv-col-optional">
                        {count(item.enrolled)}
                      </td>
                      <td className="mdv-cell-num num">
                        {count(item.present + item.late)}
                      </td>
                      <td className="mdv-cell-num num mdv-col-optional">
                        {count(item.absent)}
                      </td>
                      <td>
                        <Rate
                          value={item.rate}
                          watch={item.rate < ATTENDANCE_ATTENTION}
                        />
                      </td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Fees                                                                */
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

  return (
    <>
      <section className="mdv-hero">
        <div>
          <div className="mdv-figure">
            {fees.collectionRate.toFixed(1)}
            <span>%</span>
          </div>
          <span className="mdv-figure-label">
            Collected · <b>{money(fees.totalBilled)} billed</b>
          </span>
        </div>

        <div>
          <Composition
            label={`Collected ${money(fees.totalCollected)} of ${money(fees.totalBilled)} billed`}
            segments={[
              {
                key: "collected",
                value: fees.totalCollected,
                className: "mdv-seg-collected",
              },
              {
                key: "outstanding",
                value: fees.totalOutstanding,
                className: "mdv-seg-outstanding",
              },
            ]}
          />

          <dl className="mdv-legend">
            <div>
              <dt>Billed</dt>
              <dd>{money(fees.totalBilled)}</dd>
            </div>
            <div>
              <dt>Collected</dt>
              <dd>{money(fees.totalCollected)}</dd>
            </div>
            <div>
              <dt>Outstanding</dt>
              <dd>{money(fees.totalOutstanding)}</dd>
            </div>
            <div>
              <dt>Overdue</dt>
              <dd>{money(fees.totalOverdue)}</dd>
            </div>
          </dl>

          <p
            className="mdv-note"
            data-clear={fees.overdueInvoicesCount === 0 ? "true" : "false"}
          >
            {fees.overdueInvoicesCount === 0 ? (
              "No invoice is past its due date."
            ) : (
              <>
                <b>{count(fees.overdueInvoicesCount)}</b> invoices past their
                due date · {money(fees.totalOverdue)}
              </>
            )}
          </p>
        </div>
      </section>

      <div className="mdv-table-wrap">
      <table className="mdv-table">
        <thead>
          <tr>
            <th>Grade</th>
            <th className="num mdv-col-optional">Billed</th>
            <th className="num">Collected</th>
            <th className="num mdv-col-optional">Outstanding</th>
            <th className="num">Collection</th>
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
                      className="mdv-row-label"
                      aria-expanded={open}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleGrade(group.grade);
                      }}
                    >
                      <ChevronRight size={14} className="mdv-chevron" />
                      <strong>Grade {group.grade}</strong>
                      <em>
                        {group.classes.length}{" "}
                        {group.classes.length === 1 ? "class" : "classes"}
                      </em>
                    </button>
                  </td>
                  <td className="mdv-cell-num num mdv-col-optional">
                    {money(group.billed)}
                  </td>
                  <td className="mdv-cell-num num">{money(group.collected)}</td>
                  <td className="mdv-cell-num num mdv-col-optional">
                    {money(group.outstanding)}
                  </td>
                  <td>
                    <Rate
                      value={group.rate}
                      watch={group.rate < COLLECTION_ATTENTION}
                    />
                  </td>
                </tr>

                {open &&
                  group.classes.map((item) => (
                    <tr
                      key={item.id}
                      className="mdv-row mdv-row--section"
                      data-static="true"
                    >
                      <td>
                        <span className="mdv-row-label mdv-row-label--static">
                          <span className="mdv-sub">
                            <strong>Section {item.section}</strong>
                            <em>
                              {item.paidStudents} paid · {item.pendingStudents}{" "}
                              pending
                            </em>
                          </span>
                        </span>
                      </td>
                      <td className="mdv-cell-num num mdv-col-optional">
                        {money(item.billed)}
                      </td>
                      <td className="mdv-cell-num num">
                        {money(item.collected)}
                      </td>
                      <td className="mdv-cell-num num mdv-col-optional">
                        {money(item.outstanding)}
                      </td>
                      <td>
                        <Rate
                          value={item.rate}
                          watch={item.rate < COLLECTION_ATTENTION}
                        />
                      </td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>

      {fees.recentPayments.length > 0 && (
        <section className="mdv-stream">
          <h3>Latest receipts</h3>
          <div className="mdv-receipts">
            {fees.recentPayments.slice(0, 4).map((payment) => (
              <div className="mdv-receipt" key={payment.id}>
                <div style={{ minWidth: 0 }}>
                  <b>{payment.studentName}</b>
                  <span>
                    {payment.classLabel} · {payment.method}
                  </span>
                </div>
                <em>{money(payment.amount)}</em>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Roster dialog                                                       */
/* ------------------------------------------------------------------ */

function RosterDialog({
  item,
  onClose,
}: {
  item: ClassAttendanceItem;
  onClose: () => void;
}) {
  const hidden = Math.max(0, item.absent - item.absentees.length);

  return (
    <div className="mdv-scrim" onClick={onClose}>
      <div
        className="mdv-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mdv-roster-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="mdv-roster-title">{item.label}</h2>
            <p>
              {item.teacherName === "Unassigned"
                ? "No class teacher"
                : item.teacherName}
              {item.room ? ` · Room ${item.room}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <dl className="mdv-dialog-stats">
          <div>
            <dt>Enrolled</dt>
            <dd>{item.enrolled}</dd>
          </div>
          <div>
            <dt>Present</dt>
            <dd>{item.present}</dd>
          </div>
          <div>
            <dt>Late</dt>
            <dd>{item.late}</dd>
          </div>
          <div>
            <dt>Leave</dt>
            <dd>{item.leave}</dd>
          </div>
          <div>
            <dt>Absent</dt>
            <dd>{item.absent}</dd>
          </div>
        </dl>

        <div className="mdv-dialog-body">
          <h3>Absent on record</h3>
          {item.absentees.length > 0 ? (
            <ul>
              {item.absentees.map((name, index) => (
                <li key={`${name}-${index}`}>
                  {name}
                  <span>Unexcused</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mdv-empty">Nobody was marked absent.</p>
          )}
          {hidden > 0 && (
            <p className="mdv-more">and {hidden} more not listed here.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const AUTH_KEY = "mdview_auth";
const AUTH_TOKEN = "admin123";
const CYCLE_MS = 15_000;
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
  const [selectedClass, setSelectedClass] = useState<ClassAttendanceItem | null>(
    null
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* Clock — ticks every second, but only re-renders when the minute changes,
     because the wallboard shows hours and minutes and a per-second render of
     a whole table for a digit nobody reads is waste. */
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow((previous) => {
        const next = new Date();
        return next.getMinutes() === previous.getMinutes() ? previous : next;
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
        // The last good reading stays on the wall; a blank screen tells the
        // chairman nothing, an old number with a note tells them to look.
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

  /* Poll. A hidden tab (or a TV whose browser has been backgrounded) does not
     need to hit the database. */
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

  /* Keyboard: 1 and 2 for the views, R to refresh, F for fullscreen. The
     wallboard is often driven from a keyboard tucked under the screen. */
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
  /* Sign in                                                             */
  /* ------------------------------------------------------------------ */

  if (!isAuthenticated) {
    return (
      <div className="mdv-login">
        <div className="mdv-login-inner">
          <div className="mdv-mark">
            <img src="/global-kids-logo.svg" alt="" />
          </div>

          <h1>Chairman's wallboard</h1>
          <p className="mdv-lede">
            Global Kids School · attendance and fees
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
              {loginLoading ? "Checking…" : "Open the wallboard"}
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
  /* Board                                                               */
  /* ------------------------------------------------------------------ */

  return (
    <div className="mdv">
      <header className="mdv-bar">
        <div className="mdv-id">
          <span className="mdv-wordmark">Global Kids School</span>
          <span className="mdv-context">
            {data
              ? `${data.totalClassrooms} classrooms · ${count(data.totalStudents)} students`
              : "Loading the school's numbers"}
          </span>
        </div>

        <div className="mdv-mode">
          <div className="mdv-switch" role="group" aria-label="Choose a view">
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
              Fees
            </button>
          </div>

          <button
            type="button"
            className="mdv-auto"
            aria-pressed={auto}
            onClick={() => setAuto((current) => !current)}
            title={
              auto
                ? "Switch between the two views every 15 seconds"
                : "The wallboard is staying on this view"
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
              aria-label="Refresh now"
              title="Refresh now"
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Leave fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Leave fullscreen" : "Enter fullscreen"}
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
            <span>Showing the reading from {clockTime(lastUpdated)}.</span>
          )}
        </div>
      )}

      {!data ? (
        <div className="mdv-standby">
          {loading ? (
            <>
              <div className="mdv-standby-line">
                <i />
              </div>
              <p>Loading</p>
            </>
          ) : (
            <>
              <p>{error ?? "No data available"}</p>
              <button
                type="button"
                className="mdv-submit mdv-retry"
                onClick={() => void fetchData(true)}
              >
                Try again
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

      <footer className="mdv-foot">
        <span>Academic year {data?.academicYear ?? "—"}</span>
        <span>
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}`
            : "Waiting for the first reading"}
        </span>
      </footer>

      {selectedClass && (
        <RosterDialog
          item={selectedClass}
          onClose={() => setSelectedClass(null)}
        />
      )}
    </div>
  );
}

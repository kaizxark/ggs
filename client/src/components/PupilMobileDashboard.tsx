import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  Home,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Settings2,
  UserRound,
  Wallet,
} from "lucide-react";

import { useAnnouncements } from "../lib/school-data";
import { FeePaymentDialog } from "./FeePaymentDialog";
import { MobileTabBar } from "./MobileTabBar";
import { usePupilProfile, type Profile } from "./PupilOverview";

type MobileTab = "home" | "academics" | "fees" | "profile";

const PUPIL_TABS = [
  { id: "home", label: "Home", icon: Home },
  { id: "academics", label: "Academics", icon: BookOpen },
  { id: "fees", label: "Fees", icon: Wallet },
  { id: "profile", label: "Profile", icon: UserRound },
];
type ScheduleView = "day" | "week";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatShortDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatMoney(value?: number | null): string {
  const amount = Number(value ?? 0);
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function initialsOf(name?: string | null): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function todayName(): string {
  return new Date().toLocaleDateString("en-GB", { weekday: "long" });
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayNumber(value?: string | null): number {
  const date = new Date(value ?? "");
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function percentageOf(paper: { percentage?: number | null; marks?: number; max_marks?: number }): number | null {
  if (typeof paper.percentage === "number") return paper.percentage;
  const max = Number(paper.max_marks ?? 0);
  if (max <= 0) return null;
  return Math.round((Number(paper.marks ?? 0) / max) * 1000) / 10;
}

function statusTone(status?: string | null): string {
  const value = String(status ?? "").toLowerCase();
  if (["present", "paid", "approved", "returned", "verified", "active", "completed"].includes(value)) return "good";
  if (["absent", "overdue", "rejected", "critical", "failed"].includes(value)) return "bad";
  if (["late", "pending", "half_day", "due", "part_paid", "minor", "issued"].includes(value)) return "warn";
  return "neutral";
}

type TimetableSlot = {
  period: string;
  time: string;
  subject: string;
  teacher: string | null;
  room: string | null;
};

/**
 * The week's periods, keyed by weekday.
 *
 * Empty, because the school has no timetable to publish yet — there is no
 * table of periods behind it. The day and week views read from here, so they
 * come alive the moment periods are stored; until then the pupil is told the
 * timetable is not up rather than shown a schedule with invented times,
 * teachers and rooms. A child acting on a made-up lesson is worse off than one
 * told to check back.
 */
const TIMETABLE: Record<string, TimetableSlot[]> = {};

/**
 * The pupil's dashboard on a phone.
 *
 * Four tabs, each holding one of the four things a pupil actually opens the
 * portal for: what is happening today, their schoolwork, what the family owes,
 * and their own record. The greeting screen is a snapshot — every card on it
 * links to the tab that holds the full list, so nothing has to be squashed
 * into a phone-width summary to be reachable.
 *
 * This replaces the sidebar only on a narrow screen. On a desktop the pupil
 * still gets the same rail everybody else does; a bottom bar under a full-
 * width layout would be a second navigation competing with the first.
 */
export function PupilMobileDashboard({
  onOpenSettings,
  onSignOut,
}: {
  onOpenSettings: () => void;
  onSignOut: () => void;
}) {
  const { profile, loading, error, reload } = usePupilProfile();

  if (loading) return <MobileLoading />;
  if (!profile?.student) return <MobileError message={error} onSignOut={onSignOut} />;

  return (
    <PupilMobileView
      profile={profile}
      onOpenSettings={onOpenSettings}
      onSignOut={onSignOut}
      onReload={reload}
    />
  );
}

function PupilMobileView({
  profile,
  onOpenSettings,
  onSignOut,
  onReload,
}: {
  profile: Profile;
  onOpenSettings: () => void;
  onSignOut: () => void;
  onReload: () => void;
}) {
  const [tab, setTab] = useState<MobileTab>("home");
  const [payOpen, setPayOpen] = useState(false);
  const [academicsFocus, setAcademicsFocus] = useState<string | null>(null);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("day");
  const [selectedDay, setSelectedDay] = useState(() => {
    const name = todayName();
    return WEEKDAYS.includes(name) ? name : "Monday";
  });
  const [resultExamId, setResultExamId] = useState<string>("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const pupil = profile.student;
  const className = profile.class;
  const firstName = String(pupil.first_name ?? "").trim();
  const fullName = String(pupil.name ?? "").trim() || `${pupil.first_name ?? ""} ${pupil.last_name ?? ""}`.trim() || "Pupil";
  const grade = className?.grade ? String(className.grade) : "";
  const classLine = grade ? `Grade ${grade}${className?.section ? ` · Section ${className.section}` : ""}` : "Class details pending";
  const attendance = profile.attendance?.summary;
  const attendancePct = typeof attendance?.percentage === "number" ? Math.round(attendance.percentage) : null;
  const subjects = profile.academics?.subjects ?? [];
  const results = profile.academics?.results ?? [];
  const exams = profile.exams ?? [];
  const guardians = profile.guardians ?? [];
  const primaryGuardian = guardians.find((guardian) => guardian.is_primary) ?? guardians[0] ?? null;
  const emergencyGuardian = guardians.find((guardian) => guardian.is_emergency_contact) ?? primaryGuardian;
  const fees = profile.fees;
  const feeSummary = fees?.summary;
  const installments = fees?.installments ?? [];
  const invoices = fees?.invoices ?? [];
  const payments = invoices.flatMap((invoice) =>
    (invoice.payments ?? []).map((payment) => ({ ...payment, invoice_no: invoice.invoice_no })),
  );
  const nextInstallment = (fees?.upcoming ?? [])
    .slice()
    .sort((a, b) => dayNumber(a.due_on) - dayNumber(b.due_on))[0] ?? null;
  const payableInvoice = invoices.find((invoice) => {
    const total = Number(invoice.total ?? 0);
    const paid = Number(invoice.paid_amount ?? 0);
    return invoice.status !== "paid" && invoice.status !== "void" && total - paid > 0;
  }) ?? null;
  const leaves = profile.attendance?.leaves ?? [];
  const now = Date.now();
  const upcomingExams = exams
    .filter((exam) => exam.starts_on && new Date(exam.starts_on).getTime() >= new Date(todayKey()).getTime())
    .sort((a, b) => dayNumber(a.starts_on) - dayNumber(b.starts_on));
  const publishedResults = results
    .filter((exam) => exam.published === true)
    .sort((a, b) => dayNumber(b.starts_on) - dayNumber(a.starts_on));
  const selectedResult = publishedResults.find((exam) => exam.examination_id === resultExamId) ?? publishedResults[0] ?? null;
  const attendanceDays = profile.attendance?.days ?? [];
  const attendanceByDate = new Map(
    attendanceDays.filter((day) => day.date).map((day) => [String(day.date).slice(0, 10), day]),
  );
  const timetable = TIMETABLE;
  const hasTimetable = Object.keys(timetable).length > 0;
  const activeDay = WEEKDAYS.includes(todayName()) ? todayName() : "Monday";
  const todayTimetable = timetable[activeDay] ?? [];
  const { rows: announcements } = useAnnouncements();
  const visibleAnnouncements = announcements
    .filter((announcement) => {
      const audience = String(announcement.audience ?? "").toLowerCase();
      return announcement.status === "Published" && (audience.includes("all") || audience.includes("student"));
    })
    .slice(0, 4);

  useEffect(() => {
    if (tab !== "academics" || !academicsFocus) return;
    const id = `pupil-${academicsFocus}`;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [tab, academicsFocus]);

  useEffect(() => {
    if (!resultExamId && publishedResults[0]?.examination_id) {
      setResultExamId(String(publishedResults[0].examination_id));
    }
  }, [publishedResults, resultExamId]);

  const go = (next: MobileTab, focus?: string) => {
    setTab(next);
    setAcademicsFocus(focus ?? null);
    // The tab body is its own scroll container, so the window is not the thing
    // that moves when a tab changes.
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const monthLabel = `${MONTHS[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()}`;
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const calendarCells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) return null;
    const date = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { day, date, record: attendanceByDate.get(date) ?? null };
  });

  return (
    <div className="pupil-mobile">
      <div className="pupil-m-scroll" ref={scrollRef}>
      {tab === "home" && (
        <div className="pupil-m-page">
          <section className="pupil-m-hero">
            <div className="pupil-m-photo">
              {pupil.photo_url ? <img src={pupil.photo_url} alt={fullName} /> : <span>{initialsOf(fullName)}</span>}
            </div>
            <div className="pupil-m-hero-copy">
              <p className="pupil-m-eyebrow">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
              <h1>Hello, {firstName || fullName}.</h1>
              <p>{classLine}</p>
              <div className="pupil-m-chips">
                {pupil.usn && <span>USN {pupil.usn}</span>}
                {className?.roll_no != null && <span>Roll {className.roll_no}</span>}
                {pupil.status && <span className={statusTone(pupil.status)}>{pupil.status}</span>}
              </div>
            </div>
          </section>

          <section className="pupil-m-quick" aria-label="Quick actions">
            <button onClick={() => go("academics", "timetable")}>
              <CalendarDays size={18} />
              <span>Timetable</span>
            </button>
            <button onClick={() => go("academics", "attendance")}>
              <ClipboardCheck size={18} />
              <span>Attendance</span>
            </button>
            <button onClick={() => go("academics", "results")}>
              <GraduationCap size={18} />
              <span>Results</span>
            </button>
          </section>

          <MobileCard
            title="Today’s timetable"
            eyebrow={todayName() === "Sunday" ? "Next school day" : "Today"}
            action="View full timetable"
            onAction={() => go("academics", "timetable")}
          >
            {todayTimetable.length ? (
              <div className="pupil-m-timeline">
                {todayTimetable.slice(0, 4).map((slot) => (
                  <div className="pupil-m-timeline-row" key={slot.period}>
                    <span className="pupil-m-time">{slot.time.split(" – ")[0]}</span>
                    <span className="pupil-m-line" />
                    <div>
                      <strong>{slot.subject}</strong>
                      <span>{[slot.teacher, slot.room ? `Room ${slot.room}` : null].filter(Boolean).join(" · ") || slot.period}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <MobileEmpty
                icon={CalendarDays}
                title="No classes today"
                detail="Your timetable has not been published yet. It will appear here when the school adds it."
              />
            )}
          </MobileCard>

          <section className="pupil-m-card pupil-m-attendance">
            <div className="pupil-m-card-head">
              <div>
                <p className="pupil-m-eyebrow">Your register</p>
                <h2>Attendance</h2>
              </div>
              <button className="pupil-m-link" onClick={() => go("academics", "attendance")}>Open <ChevronRight size={14} /></button>
            </div>
            <div className="pupil-m-attendance-body">
              <strong>{attendancePct !== null ? `${attendancePct}%` : "—"}</strong>
              <div className="pupil-m-progress"><span style={{ width: `${Math.max(0, Math.min(100, attendancePct ?? 0))}%` }} /></div>
            </div>
            <div className="pupil-m-mini-stats">
              <span><i className="good" /> {attendance?.present ?? 0} present</span>
              <span><i className="warn" /> {attendance?.late ?? 0} late</span>
              <span><i className="bad" /> {attendance?.absent ?? 0} absent</span>
            </div>
          </section>

          <MobileCard
            title="Upcoming exams"
            eyebrow={upcomingExams.length ? `${upcomingExams.length} scheduled` : "No exams scheduled"}
            action="Exam timetable"
            onAction={() => go("academics", "exams")}
          >
            {upcomingExams.length ? (
              <div className="pupil-m-list">
                {upcomingExams.slice(0, 3).map((exam) => (
                  <div className="pupil-m-row" key={exam.id}>
                    <span className="pupil-m-row-icon violet"><GraduationCap size={15} /></span>
                    <div>
                      <strong>{exam.name ?? "Examination"}</strong>
                      <span>{formatDate(exam.starts_on)}{exam.ends_on && exam.ends_on !== exam.starts_on ? ` – ${formatDate(exam.ends_on)}` : ""}</span>
                    </div>
                    <span className={`pupil-m-pill ${exam.published ? "good" : "neutral"}`}>{exam.published ? "Published" : "Scheduled"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <MobileEmpty icon={GraduationCap} title="No upcoming exams" detail="The next exam window will appear here." />
            )}
          </MobileCard>

          <MobileCard
            title="Announcements"
            eyebrow="Latest from school"
            action="Academics"
            onAction={() => go("academics")}
          >
            {visibleAnnouncements.length ? (
              <div className="pupil-m-list">
                {visibleAnnouncements.slice(0, 3).map((announcement) => (
                  <div className="pupil-m-row" key={announcement.id}>
                    <span className="pupil-m-row-icon teal"><BookOpen size={15} /></span>
                    <div>
                      <strong>{announcement.title}</strong>
                      <span>{announcement.date}{announcement.audience ? ` · ${announcement.audience}` : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <MobileEmpty icon={BookOpen} title="No announcements yet" detail="School updates will appear here." />
            )}
          </MobileCard>

          <MobileCard
            title="Upcoming events"
            eyebrow="School calendar"
            action="Academics"
            onAction={() => go("academics", "exams")}
          >
            {upcomingExams.length ? (
              <div className="pupil-m-list">
                {upcomingExams.slice(0, 3).map((exam) => (
                  <div className="pupil-m-row" key={`event-${exam.id}`}>
                    <span className="pupil-m-row-icon amber"><CalendarDays size={15} /></span>
                    <div>
                      <strong>{exam.name ?? "School event"}</strong>
                      <span>{formatDate(exam.starts_on)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <MobileEmpty icon={CalendarDays} title="No upcoming events" detail="Events and exam windows will appear here." />
            )}
          </MobileCard>
        </div>
      )}

      {tab === "academics" && (
        <div className="pupil-m-page">
          <MobilePageHead title="Academics" subtitle="Learn, schedule and assess in one place." />

          <MobileGroup label="Learn">
            <section className="pupil-m-card" id="pupil-subjects">
              <div className="pupil-m-card-head">
                <div><p className="pupil-m-eyebrow">Learn</p><h2>Subjects and teachers</h2></div>
                <span className="pupil-m-count">{subjects.length}</span>
              </div>
              {subjects.length ? (
                <div className="pupil-m-list">
                  {subjects.map((subject) => (
                    <div className="pupil-m-row" key={subject.id}>
                      <span className="pupil-m-row-icon teal"><BookOpen size={15} /></span>
                      <div>
                        <strong>{subject.subject ?? "Subject"}</strong>
                        <span>{[subject.code, subject.teacher].filter(Boolean).join(" · ") || "Teacher not assigned"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <MobileEmpty icon={BookOpen} title="No subjects yet" detail="Your class subjects will appear here." />
              )}
            </section>

            <section className="pupil-m-card" id="pupil-materials">
              <div className="pupil-m-card-head">
                <div><p className="pupil-m-eyebrow">Learn</p><h2>Study materials</h2></div>
              </div>
              <MobileEmpty icon={BookOpen} title="No materials shared yet" detail="Notes, worksheets and resources from your teachers will appear here." />
            </section>
          </MobileGroup>

          <MobileGroup label="Schedule">
            <section className="pupil-m-card" id="pupil-timetable">
              <div className="pupil-m-card-head">
                <div><p className="pupil-m-eyebrow">Schedule</p><h2>Timetable</h2></div>
                {hasTimetable && (
                  <div className="pupil-m-toggle">
                    <button className={scheduleView === "day" ? "active" : ""} onClick={() => setScheduleView("day")}>Day</button>
                    <button className={scheduleView === "week" ? "active" : ""} onClick={() => setScheduleView("week")}>Week</button>
                  </div>
                )}
              </div>
              {!hasTimetable ? (
                <MobileEmpty
                  icon={CalendarDays}
                  title="Timetable not published"
                  detail="The school has not published this class's timetable yet. It will appear here, day by day, once it is."
                />
              ) : scheduleView === "day" ? (
                <>
                  <div className="pupil-m-days">
                    {WEEKDAYS.map((day) => (
                      <button key={day} className={selectedDay === day ? "active" : ""} onClick={() => setSelectedDay(day)}>
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                  <div className="pupil-m-list">
                    {(timetable[selectedDay] ?? []).map((slot) => (
                      <div className="pupil-m-row" key={slot.period}>
                        <span className="pupil-m-time">{slot.time.split(" – ")[0]}</span>
                        <div>
                          <strong>{slot.subject}</strong>
                          <span>{[slot.teacher, slot.room ? `Room ${slot.room}` : null].filter(Boolean).join(" · ") || slot.period}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="pupil-m-week">
                  {WEEKDAYS.map((day) => (
                    <div className="pupil-m-week-day" key={day}>
                      <strong>{day}</strong>
                      {(timetable[day] ?? []).slice(0, 6).map((slot) => (
                        <span key={slot.period}>{slot.time.split(" – ")[0]} · {slot.subject}</span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="pupil-m-card" id="pupil-attendance">
              <div className="pupil-m-card-head">
                <div><p className="pupil-m-eyebrow">Schedule</p><h2>Attendance</h2></div>
                <span className="pupil-m-count">{attendancePct !== null ? `${attendancePct}%` : "—"}</span>
              </div>
              <div className="pupil-m-calendar-head">
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
                <strong>{monthLabel}</strong>
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
              </div>
              <div className="pupil-m-calendar">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span className="pupil-m-calendar-label" key={`${day}-${index}`}>{day}</span>)}
                {calendarCells.map((cell, index) =>
                  cell ? (
                    <span
                      key={cell.date}
                      className={`pupil-m-calendar-day ${cell.record ? statusTone(cell.record.status) : ""}`}
                      title={cell.record ? `${cell.date} · ${cell.record.status}` : cell.date}
                    >
                      {cell.day}
                    </span>
                  ) : (
                    <span key={`empty-${index}`} />
                  ),
                )}
              </div>
              <div className="pupil-m-legend">
                <span><i className="good" /> Present</span>
                <span><i className="warn" /> Late / leave</span>
                <span><i className="bad" /> Absent</span>
              </div>
              <div className="pupil-m-subhead">Attendance history</div>
              {attendanceDays.length ? (
                <div className="pupil-m-list">
                  {attendanceDays
                    .filter((day) => day.status && day.status !== "present")
                    .slice(0, 8)
                    .map((day) => (
                      <div className="pupil-m-row" key={String(day.date)}>
                        <span className={`pupil-m-row-icon ${statusTone(day.status)}`}><ClipboardCheck size={15} /></span>
                        <div>
                          <strong>{formatDate(day.date)}</strong>
                          <span>{day.notes || String(day.status ?? "").replace(/_/g, " ")}</span>
                        </div>
                        <span className={`pupil-m-pill ${statusTone(day.status)}`}>{String(day.status ?? "—").replace(/_/g, " ")}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <MobileEmpty icon={ClipboardCheck} title="No register yet" detail="Attendance will appear once your teacher marks it." />
              )}
            </section>
          </MobileGroup>

          <MobileGroup label="Assess">
            <section className="pupil-m-card" id="pupil-exams">
              <div className="pupil-m-card-head">
                <div><p className="pupil-m-eyebrow">Assess</p><h2>Exams</h2></div>
                <span className="pupil-m-count">{upcomingExams.length}</span>
              </div>
              {exams.length ? (
                <div className="pupil-m-list">
                  {exams.map((exam) => (
                    <div className="pupil-m-row" key={exam.id}>
                      <span className="pupil-m-row-icon violet"><GraduationCap size={15} /></span>
                      <div>
                        <strong>{exam.name ?? "Examination"}</strong>
                        <span>{formatDate(exam.starts_on)}{exam.ends_on && exam.ends_on !== exam.starts_on ? ` – ${formatDate(exam.ends_on)}` : ""}</span>
                      </div>
                      <span className={`pupil-m-pill ${exam.published ? "good" : "neutral"}`}>{exam.published ? "Published" : "Scheduled"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <MobileEmpty icon={GraduationCap} title="No exams scheduled" detail="Exam windows will appear here." />
              )}
              <div className="pupil-m-note">
                <strong>Exam instructions</strong>
                <span>Carry your hall ticket, reach the venue 15 minutes early, and keep only permitted stationery on the desk.</span>
              </div>
            </section>

            <section className="pupil-m-card" id="pupil-results">
              <div className="pupil-m-card-head">
                <div><p className="pupil-m-eyebrow">Assess</p><h2>Results and report cards</h2></div>
              </div>
              {publishedResults.length ? (
                <>
                  <label className="pupil-m-select">
                    <span>Term</span>
                    <select value={selectedResult?.examination_id ?? ""} onChange={(event) => setResultExamId(event.target.value)}>
                      {publishedResults.map((exam) => (
                        <option key={exam.examination_id} value={exam.examination_id}>{exam.name ?? "Examination"}</option>
                      ))}
                    </select>
                  </label>
                  {selectedResult && (
                    <div className="pupil-m-result-summary">
                      <div>
                        <strong>{selectedResult.percentage != null ? `${Math.round(selectedResult.percentage)}%` : "—"}</strong>
                        <span>{selectedResult.name ?? "Result"}</span>
                      </div>
                      <span>{selectedResult.papers?.length ?? 0} subjects</span>
                    </div>
                  )}
                  <div className="pupil-m-list">
                    {(selectedResult?.papers ?? []).map((paper, index) => {
                      const pct = percentageOf(paper);
                      return (
                        <div className="pupil-m-result-row" key={`${paper.subject ?? "paper"}-${index}`}>
                          <div><strong>{paper.subject ?? "Subject"}</strong><span>{paper.marks ?? 0} / {paper.max_marks ?? 0}{paper.grade ? ` · ${paper.grade}` : ""}</span></div>
                          <div className="pupil-m-progress"><span style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }} /></div>
                          <span className="pupil-m-pill neutral">{pct != null ? `${Math.round(pct)}%` : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pupil-m-subhead">Progress trend</div>
                  <div className="pupil-m-trend">
                    {publishedResults.slice().reverse().map((exam) => {
                      const pct = typeof exam.percentage === "number" ? Math.max(4, Math.min(100, exam.percentage)) : 4;
                      return (
                        <div className="pupil-m-trend-col" key={exam.examination_id}>
                          <span>{exam.percentage != null ? `${Math.round(exam.percentage)}%` : "—"}</span>
                          <div><i style={{ height: `${pct}%` }} /></div>
                          <small>{String(exam.name ?? "").split(" ")[0]}</small>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <MobileEmpty icon={GraduationCap} title="No results published" detail="Your report card will appear after results are published." />
              )}
            </section>
          </MobileGroup>
        </div>
      )}

      {tab === "fees" && (
        <div className="pupil-m-page">
          <MobilePageHead title="Fees" subtitle="Your fee position, payments and receipts." />

          <section className="pupil-m-fee-grid">
            <div className="pupil-m-fee-card"><span>Total fees</span><strong>{formatMoney(feeSummary?.billed)}</strong></div>
            <div className="pupil-m-fee-card good"><span>Paid</span><strong>{formatMoney(feeSummary?.paid)}</strong></div>
            <div className="pupil-m-fee-card bad"><span>Outstanding</span><strong>{formatMoney(feeSummary?.outstanding)}</strong></div>
            <div className="pupil-m-fee-card"><span>Next due</span><strong>{nextInstallment?.due_on ? formatShortDate(nextInstallment.due_on) : "—"}</strong><small>{nextInstallment ? formatMoney(nextInstallment.amount) : "No upcoming instalment"}</small></div>
          </section>

          <section className="pupil-m-card">
            <div className="pupil-m-card-head">
              <div><p className="pupil-m-eyebrow">Pay</p><h2>Pay now</h2></div>
              <CreditCard size={18} />
            </div>
            {payableInvoice ? (
              <>
                <div className="pupil-m-note">
                  <strong>Pay {formatMoney(Number(payableInvoice.total ?? 0) - Number(payableInvoice.paid_amount ?? 0))} online</strong>
                  <span>Use any UPI app. The receipt is posted automatically once the payment is verified.</span>
                </div>
                <button className="pupil-m-primary" onClick={() => setPayOpen(true)}>Pay now</button>
              </>
            ) : (
              <div className="pupil-m-note">
                <strong>No payment due</strong>
                <span>Your invoices are settled. Receipts are in the history below.</span>
              </div>
            )}
          </section>

          <section className="pupil-m-card">
            <div className="pupil-m-card-head">
              <div><p className="pupil-m-eyebrow">History</p><h2>Payments and receipts</h2></div>
              <ReceiptText size={18} />
            </div>
            {payments.length ? (
              <div className="pupil-m-list">
                {payments.map((payment) => (
                  <div className="pupil-m-row" key={payment.id}>
                    <span className="pupil-m-row-icon good"><Check size={15} /></span>
                    <div>
                      <strong>{formatMoney(payment.amount)}</strong>
                      <span>{payment.receipt_no ?? "Receipt"} · {formatDate(payment.paid_at)} · {payment.method ?? "Payment"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <MobileEmpty icon={ReceiptText} title="No payments recorded" detail="Receipts will appear here after a payment is posted." />
            )}
          </section>

          <section className="pupil-m-card">
            <div className="pupil-m-card-head">
              <div><p className="pupil-m-eyebrow">Plan</p><h2>Installment schedule</h2></div>
              <Wallet size={18} />
            </div>
            {installments.length ? (
              <div className="pupil-m-list">
                {installments.map((installment) => (
                  <div className="pupil-m-row" key={installment.id}>
                    <span className={`pupil-m-row-icon ${statusTone(installment.status)}`}><Wallet size={15} /></span>
                    <div>
                      <strong>{installment.label ?? "Installment"} · {formatMoney(installment.amount)}</strong>
                      <span>Due {formatShortDate(installment.due_on)}{installment.paid_on ? ` · Paid ${formatShortDate(installment.paid_on)}` : ""}</span>
                    </div>
                    <span className={`pupil-m-pill ${statusTone(installment.status)}`}>{String(installment.status ?? "—").replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <MobileEmpty icon={Wallet} title="No installments" detail="Your fee schedule will appear here." />
            )}
          </section>

          <section className="pupil-m-card">
            <div className="pupil-m-card-head">
              <div><p className="pupil-m-eyebrow">Breakdown</p><h2>Fee structure</h2></div>
              <FileText size={18} />
            </div>
            {fees?.accounts?.length ? (
              <div className="pupil-m-list">
                {fees.accounts.map((account) => (
                  <div className="pupil-m-row" key={account.id}>
                    <span className="pupil-m-row-icon teal"><FileText size={15} /></span>
                    <div>
                      <strong>{formatMoney(account.total_fee)}</strong>
                      <span>
                        Paid {formatMoney(account.paid_amount)}
                        {account.scholarship ? ` · Scholarship ${formatMoney(account.scholarship)}` : ""}
                        {account.concession ? ` · Concession ${formatMoney(account.concession)}` : ""}
                      </span>
                      {account.discount_reason && <span>{account.discount_reason}</span>}
                    </div>
                    <span className={`pupil-m-pill ${statusTone(account.status)}`}>{String(account.status ?? "—")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <MobileEmpty icon={FileText} title="No fee structure" detail="Your fee breakdown will appear here." />
            )}
          </section>

          <section className="pupil-m-card">
            <div className="pupil-m-card-head">
              <div><p className="pupil-m-eyebrow">Support</p><h2>Refund status</h2></div>
            </div>
            <MobileEmpty icon={Wallet} title="No refunds on record" detail="Refund requests and their status will appear here if the school supports them." />
          </section>

          <FeePaymentDialog
            open={payOpen && Boolean(payableInvoice)}
            invoiceId={payableInvoice?.id ?? null}
            invoiceNo={payableInvoice?.invoice_no ?? ""}
            outstanding={Number(payableInvoice?.total ?? 0) - Number(payableInvoice?.paid_amount ?? 0)}
            onOpenChange={setPayOpen}
            onPaid={onReload}
          />
        </div>
      )}

      {tab === "profile" && (
        <div className="pupil-m-page">
          <MobilePageHead title="Profile" subtitle="Your details, family, documents and settings." />

          <section className="pupil-m-profile-head">
            <div className="pupil-m-photo">
              {pupil.photo_url ? <img src={pupil.photo_url} alt={fullName} /> : <span>{initialsOf(fullName)}</span>}
            </div>
            <div>
              <h1>{fullName}</h1>
              <p>{classLine}</p>
              <span>{pupil.usn ? `USN ${pupil.usn}` : "USN not assigned"}</span>
            </div>
          </section>

          <MobileCard title="Personal and student details" eyebrow="Your record">
            <div className="pupil-m-detail-grid">
              <MobileDetail label="Full name" value={fullName} />
              <MobileDetail label="USN" value={pupil.usn} />
              <MobileDetail label="Date of birth" value={formatDate(pupil.date_of_birth)} />
              <MobileDetail label="Age" value={pupil.age != null ? `${pupil.age} years` : null} />
              <MobileDetail label="Gender" value={pupil.gender} />
              <MobileDetail label="Blood group" value={pupil.blood_group} />
              <MobileDetail label="Nationality" value={pupil.nationality} />
              <MobileDetail label="Mother tongue" value={pupil.mother_tongue} />
              <MobileDetail label="Religion" value={pupil.religion} />
              <MobileDetail label="Email" value={pupil.email} />
              <MobileDetail label="Phone" value={pupil.phone} />
              <MobileDetail label="Status" value={pupil.status} />
            </div>
            {pupil.address && (
              <div className="pupil-m-address">
                <MapPin size={15} />
                <span>
                  {[pupil.address.line1, pupil.address.line2, pupil.address.city, pupil.address.state, pupil.address.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
          </MobileCard>

          <MobileCard title="Parent and guardian contacts" eyebrow="Family">
            {guardians.length ? (
              <div className="pupil-m-list">
                {guardians.map((guardian) => (
                  <div className="pupil-m-row" key={guardian.link_id ?? guardian.guardian_id}>
                    <span className="pupil-m-row-icon violet"><UserRound size={15} /></span>
                    <div>
                      <strong>{guardian.full_name ?? "Guardian"}</strong>
                      <span>{[guardian.relationship, guardian.phone, guardian.email].filter(Boolean).join(" · ")}</span>
                      <span>{guardian.is_primary ? "Primary guardian" : ""}{guardian.is_emergency_contact ? `${guardian.is_primary ? " · " : ""}Emergency contact` : ""}</span>
                    </div>
                    <div className="pupil-m-contact-actions">
                      {guardian.phone && <a href={`tel:${guardian.phone}`} aria-label={`Call ${guardian.full_name ?? "guardian"}`}><Phone size={14} /></a>}
                      {guardian.email && <a href={`mailto:${guardian.email}`} aria-label={`Email ${guardian.full_name ?? "guardian"}`}><Mail size={14} /></a>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <MobileEmpty icon={UserRound} title="No guardians recorded" detail="Ask the school office to add a family contact." />
            )}
          </MobileCard>

          <MobileCard title="Documents and certificates" eyebrow="Paperwork">
            {profile.documents?.length ? (
              <div className="pupil-m-list">
                {profile.documents.map((document) => (
                  <div className="pupil-m-row" key={document.id ?? document.file_name}>
                    <span className="pupil-m-row-icon teal"><FileText size={15} /></span>
                    <div>
                      <strong>{document.title || document.file_name || document.category || "Document"}</strong>
                      <span>{[document.category, document.issued_on ? `Issued ${formatShortDate(document.issued_on)}` : null].filter(Boolean).join(" · ")}</span>
                    </div>
                    <span className={`pupil-m-pill ${statusTone(document.verification_status)}`}>{String(document.verification_status ?? "On file").replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <MobileEmpty icon={FileText} title="No documents on file" detail="Certificates and records will appear here." />
            )}
          </MobileCard>

          <MobileCard title="My requests" eyebrow="Leave applications">
            {leaves.length ? (
              <div className="pupil-m-list">
                {leaves.map((leave) => (
                  <div className="pupil-m-row" key={leave.id}>
                    <span className={`pupil-m-row-icon ${statusTone(leave.status)}`}><CalendarDays size={15} /></span>
                    <div>
                      <strong>{String(leave.leave_type ?? "Leave").replace(/_/g, " ")} · {formatShortDate(leave.from_on)} – {formatShortDate(leave.to_on)}</strong>
                      <span>{leave.reason || `${leave.days ?? 1} day(s)`}</span>
                    </div>
                    <span className={`pupil-m-pill ${statusTone(leave.status)}`}>{String(leave.status ?? "pending")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <MobileEmpty icon={CalendarDays} title="No leave requests" detail="Your leave applications and their status will appear here." />
            )}
          </MobileCard>

          <section className="pupil-m-card">
            <div className="pupil-m-card-head">
              <div><p className="pupil-m-eyebrow">Account</p><h2>Settings</h2></div>
              <Settings2 size={18} />
            </div>
            <button className="pupil-m-menu-row" onClick={onOpenSettings}>
              <Settings2 size={16} />
              <span>Account settings</span>
              <ChevronRight size={15} />
            </button>
            <button className="pupil-m-menu-row danger" onClick={onSignOut}>
              <LogOut size={16} />
              <span>Log out</span>
              <ChevronRight size={15} />
            </button>
          </section>

        </div>
      )}

      </div>

      <MobileTabBar
        items={PUPIL_TABS}
        active={tab}
        onSelect={(id) => go(id as MobileTab)}
        ariaLabel="Student sections"
      />
    </div>
  );
}

function MobilePageHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="pupil-m-page-head">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

function MobileGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="pupil-m-group">
      <p className="pupil-m-group-label">{label}</p>
      {children}
    </section>
  );
}

function MobileCard({
  title,
  eyebrow,
  action,
  onAction,
  children,
}: {
  title: string;
  eyebrow: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="pupil-m-card">
      <div className="pupil-m-card-head">
        <div>
          <p className="pupil-m-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {action && onAction && (
          <button className="pupil-m-link" onClick={onAction}>
            {action} <ChevronRight size={14} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function MobileEmpty({
  icon: Icon,
  title,
  detail,
}: {
  icon: React.ElementType;
  title: string;
  detail: string;
}) {
  return (
    <div className="pupil-m-empty">
      <span><Icon size={18} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function MobileDetail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="pupil-m-detail">
      <span>{label}</span>
      <strong>{value != null && String(value).trim() !== "" ? String(value) : "Not recorded"}</strong>
    </div>
  );
}

/**
 * The record is one request, so the whole screen waits for it together.
 *
 * A skeleton rather than a spinner: the page that arrives is a stack of cards,
 * and placeholder cards keep the phone from jumping when it does.
 */
function MobileLoading() {
  return (
    <div className="pupil-mobile">
      <div className="pupil-m-scroll">
        <div className="pupil-m-page pupil-m-loading" aria-busy="true" aria-label="Loading your dashboard">
          <div className="pupil-m-hero">
            <span className="pupil-m-sk pupil-m-sk-photo" />
            <div className="pupil-m-hero-copy">
              <span className="pupil-m-sk" style={{ width: 120, height: 10 }} />
              <span className="pupil-m-sk" style={{ width: 210, height: 24, marginTop: 12 }} />
              <span className="pupil-m-sk" style={{ width: 150, height: 12, marginTop: 10 }} />
            </div>
          </div>
          <div className="pupil-m-quick">
            {Array.from({ length: 4 }, (_, index) => (
              <span className="pupil-m-sk" key={index} style={{ height: 62, borderRadius: 12 }} />
            ))}
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <div className="pupil-m-card" key={index}>
              <span className="pupil-m-sk" style={{ width: 110, height: 10 }} />
              <span className="pupil-m-sk" style={{ width: 170, height: 18, marginTop: 10 }} />
              <span className="pupil-m-sk" style={{ height: 54, marginTop: 16 }} />
            </div>
          ))}
        </div>
      </div>
      <MobileTabBar
        items={PUPIL_TABS}
        active="home"
        onSelect={() => {}}
        ariaLabel="Student sections"
      />
    </div>
  );
}

/**
 * A failed load, said plainly.
 *
 * `error` is already written for a reader — "your account is not linked to a
 * pupil record yet" tells a child to ask the office, where "502" would leave
 * them tapping reload.
 */
function MobileError({ message, onSignOut }: { message: string; onSignOut: () => void }) {
  return (
    <div className="pupil-mobile">
      <div className="pupil-m-scroll">
        <div className="pupil-m-page">
          <div className="pupil-m-empty pupil-m-error">
            <span><AlertCircle size={20} /></span>
            <strong>{message || "Your record could not be loaded."}</strong>
            <p>Ask at the school office if this keeps happening.</p>
            <button className="pupil-m-primary" onClick={() => window.location.reload()}>
              Try again
            </button>
            <button className="pupil-m-menu-row" onClick={onSignOut}>
              <LogOut size={16} />
              <span>Log out</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

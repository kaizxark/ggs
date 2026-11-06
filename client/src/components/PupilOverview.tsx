import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  IndianRupee,
  Mail,
  Phone,
  UserRound,
  Wallet,
} from "lucide-react";
import { supabase, readPortalAccount } from "../lib/supabase";
import { Breadcrumb } from "./Breadcrumb";
import {
  SkeletonPanel,
  SkeletonText,
} from "./ErpSkeleton";
import { useDataRevision } from "../lib/live-data";
import { getPupilFeeSummary } from "../lib/fee-store";

type TrendPoint = {
  month: string;
  percentage: number;
  sessions: number;
};

type AttendanceSummary = {
  percentage?: number | null;
  marked_sessions?: number;
  present?: number;
  absent?: number;
  late?: number;
  half_day?: number;
  leave?: number;
};

type Absence = {
  date?: string | null;
  status?: string | null;
  notes?: string | null;
};

type AttendanceDay = {
  date?: string | null;
  status?: string | null;
  notes?: string | null;
};

type LeaveApplication = {
  id?: string;
  leave_type?: string | null;
  from_on?: string | null;
  to_on?: string | null;
  days?: number | string | null;
  reason?: string | null;
  status?: string | null;
  decided_at?: string | null;
  decision_note?: string | null;
};

type Paper = {
  subject?: string | null;
  marks?: number;
  max_marks?: number;
  percentage?: number | null;
  grade?: string | null;
};

type ExamResult = {
  examination_id?: string;
  name?: string | null;
  published?: boolean;
  starts_on?: string | null;
  total_marks?: number;
  max_marks?: number;
  percentage?: number | null;
  papers?: Paper[];
};

type Subject = {
  id: string;
  subject?: string | null;
  code?: string | null;
  teacher?: string | null;
};

type Activity = {
  id: string;
  name?: string | null;
  category?: string | null;
  role?: string | null;
  award?: string | null;
  achievement?: string | null;
  started_on?: string | null;
};

type Guardian = {
  link_id?: string;
  guardian_id?: string;
  full_name?: string | null;
  relationship?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  email?: string | null;
  is_primary?: boolean;
  is_emergency_contact?: boolean;
};

/**
 * The pupil's own record, as `/api/student-profile` returns it.
 *
 * Shared with the phone layout (`PupilMobileDashboard`) so both screens read
 * one shape: the desktop page and the phone must never disagree about what the
 * school holds for a child, and two hand-kept copies of this type would drift
 * the first time a field was added.
 */
export interface Profile {
  student: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    date_of_birth?: string | null;
    age?: number | null;
    gender?: string | null;
    blood_group?: string | null;
    nationality?: string | null;
    mother_tongue?: string | null;
    religion?: string | null;
    /** The school's own pupil number. */
    usn?: string | null;
    photo_url?: string | null;
    status?: string | null;
    joined_on?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      district?: string | null;
      state?: string | null;
      pincode?: string | null;
      country?: string | null;
    } | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
  };
  class?: {
    academic_year?: { id?: string; name?: string | null } | null;
    grade?: string | null;
    section?: string | null;
    room?: string | null;
    roll_no?: string | number | null;
    enrolled_on?: string | null;
    enrolment_status?: string | null;
    class_teacher?: { id?: string; name?: string | null } | null;
  };
  sections?: string[];
  attendance?: {
    summary?: AttendanceSummary;
    trend?: TrendPoint[];
    days?: AttendanceDay[];
    absences?: Absence[];
    leaves?: LeaveApplication[];
  };
  academics?: {
    results?: ExamResult[];
    subject_performance?: Array<{
      subject: string;
      papers: number;
      average: number | null;
    }>;
    subjects?: Subject[];
  };
  activities?: Activity[];
  guardians?: Guardian[];
  exams?: ExamCalendar[];
  fees?: FeeSummary;
  documents?: StudentDocument[];
  health?: HealthSummary;
  library?: LibrarySummary;
  account?: {
    has_account?: boolean;
    login_identifier?: string | null;
    email?: string | null;
    status?: string | null;
  };
}

type ExamCalendar = {
  id: string;
  name?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  published?: boolean;
};

type FeeSummary = {
  summary?: {
    billed?: number;
    paid?: number;
    outstanding?: number;
    overdue_count?: number;
    overdue_amount?: number;
  };
  accounts?: Array<{
    id?: string;
    academic_year_id?: string | null;
    total_fee?: number;
    scholarship?: number;
    concession?: number;
    discount_reason?: string | null;
    paid_amount?: number;
    status?: string | null;
  }>;
  installments?: Array<{
    id?: string;
    label?: string | null;
    amount?: number;
    paid_amount?: number;
    due_on?: string | null;
    paid_on?: string | null;
    status?: string | null;
  }>;
  upcoming?: Array<{
    id?: string;
    label?: string | null;
    amount?: number;
    paid_amount?: number;
    due_on?: string | null;
    status?: string | null;
  }>;
  invoices?: Array<{
    id?: string;
    invoice_no?: string | null;
    due_on?: string | null;
    total?: number;
    paid_amount?: number;
    status?: string | null;
    items?: Array<{ description?: string | null; amount?: number }>;
    payments?: Array<{
      id?: string;
      receipt_no?: string | null;
      amount?: number;
      method?: string | null;
      paid_at?: string | null;
      reference?: string | null;
    }>;
  }>;
};

type StudentDocument = {
  id?: string;
  category?: string | null;
  title?: string | null;
  file_name?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
  issued_on?: string | null;
  uploaded_on?: string | null;
  verification_status?: string | null;
  verified_on?: string | null;
  rejection_reason?: string | null;
  remarks?: string | null;
  expires_on?: string | null;
  version?: number | null;
};

type HealthSummary = {
  record?: {
    blood_group?: string | null;
    height_cm?: number | null;
    weight_kg?: number | null;
    allergies?: string | null;
    medical_conditions?: string | null;
    medications?: string | null;
    emergency_instructions?: string | null;
    accessibility_needs?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
    regular_doctor_name?: string | null;
    regular_doctor_phone?: string | null;
    checked_at?: string | null;
  } | null;
  incidents?: Array<{
    id?: string;
    incident_date?: string | null;
    summary?: string | null;
    action_taken?: string | null;
    severity?: string | null;
    notified_guardian?: boolean;
  }>;
};

type LibrarySummary = {
  loans?: Array<{
    id?: string;
    book_title?: string | null;
    book_isbn?: string | null;
    issued_on?: string | null;
    due_on?: string | null;
    returned_on?: string | null;
    fine_amount?: number | null;
    status?: string | null;
  }>;
  current_count?: number;
  overdue_count?: number;
  total_fines?: number;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function monthLabel(value: string): string {
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return MONTHS[date.getMonth()] ?? value;
}

function initialsOf(name?: string | null): string {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function percentageOf(paper: Paper): number | null {
  if (typeof paper.percentage === "number") return paper.percentage;
  const max = Number(paper.max_marks ?? 0);
  if (max <= 0) return null;
  return Math.round((Number(paper.marks ?? 0) / max) * 1000) / 10;
}

function publishedExams(profile: Profile | null): ExamResult[] {
  return (profile?.academics?.results ?? [])
    .filter(
      exam =>
        exam.published === true &&
        Array.isArray(exam.papers) &&
        exam.papers.length > 0
    )
    .sort((a, b) =>
      String(b.starts_on ?? "").localeCompare(String(a.starts_on ?? ""))
    );
}

function subjectAverages(exams: ExamResult[]) {
  const totals = new Map<
    string,
    { got: number; max: number; papers: number }
  >();
  for (const exam of exams) {
    for (const paper of exam.papers ?? []) {
      const subject = String(paper.subject ?? "").trim();
      const max = Number(paper.max_marks ?? 0);
      if (!subject || max <= 0) continue;
      const entry = totals.get(subject) ?? { got: 0, max: 0, papers: 0 };
      entry.got += Number(paper.marks ?? 0);
      entry.max += max;
      entry.papers += 1;
      totals.set(subject, entry);
    }
  }
  return Array.from(totals.entries())
    .map(([subject, value]) => ({
      subject,
      papers: value.papers,
      average:
        value.max > 0
          ? Math.round((value.got / value.max) * 1000) / 10
          : null,
    }))
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
}

/**
 * Load the signed-in pupil's own record.
 *
 * Pulled out of the page so the phone layout can show exactly the same data
 * without a second, separately-maintained copy of this request.
 */
export function usePupilProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const dataRevision = useDataRevision();
  const hasLoadedProfileRef = useRef(false);

  useEffect(() => {
    let live = true;
    if (!hasLoadedProfileRef.current) {
      setLoading(true);
    }
    setError("");
    (async () => {
      const account = await readPortalAccount();
      if (!live) return;
      const targetId = account?.recordId;
      if (!targetId) {
        setError("No pupil account linked to this session.");
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setError("Session expired. Please sign in again.");
          setLoading(false);
          return;
        }
        const res = await fetch(
          `/api/student-profile?studentId=${encodeURIComponent(targetId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          setError(errBody?.error || "Your pupil record could not be loaded.");
          return;
        }
        const json = (await res.json()) as Profile;
        if (!json?.student) {
          setError("Pupil record not found.");
          return;
        }
        // Always attach live fee summary to ensure real-time reflection of fee payments
        json.fees = getPupilFeeSummary(json.student.id || json.student.name);
        setProfile(json);
        hasLoadedProfileRef.current = true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Could not connect to the school network.";
        setError(message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [reloadKey, dataRevision]);

  return { profile, loading, error, reload: () => setReloadKey((n) => n + 1) };
}

export default function PupilOverview({ onBack }: { onBack: () => void }) {
  const { profile, loading, error } = usePupilProfile();

  const pupil = profile?.student;
  const firstName = String(pupil?.first_name ?? "").trim();
  const lastName = String(pupil?.last_name ?? "").trim();
  const fullName =
    String(pupil?.name ?? "").trim() ||
    `${firstName} ${lastName}`.trim() ||
    "Pupil";
  const className = profile?.class;
  const teacherName = className?.class_teacher?.name ?? null;
  const academicYear = className?.academic_year?.name ?? null;
  const attendance = profile?.attendance?.summary;
  const attendancePct =
    typeof attendance?.percentage === "number"
      ? Math.round(attendance.percentage)
      : null;
  const markedSessions = Number(attendance?.marked_sessions ?? 0);
  const trend = (profile?.attendance?.trend ?? []).slice(-6);
  const exams = useMemo(() => publishedExams(profile), [profile]);
  const latestExam = exams[0] ?? null;
  const subjects = useMemo(() => subjectAverages(exams), [exams]);
  const subjectAverage =
    subjects.length > 0
      ? Math.round(
          subjects.reduce((sum, subject) => sum + (subject.average ?? 0), 0) /
            subjects.length
        )
      : null;
  const academicPct =
    typeof latestExam?.percentage === "number"
      ? Math.round(latestExam.percentage)
      : subjectAverage;

  const guardians = profile?.guardians ?? [];
  const primaryGuardian =
    guardians.find(guardian => guardian.is_primary) ?? guardians[0] ?? null;
  const emergencyGuardian =
    guardians.find(guardian => guardian.is_emergency_contact) ??
    primaryGuardian;
  const loginId = profile?.account?.login_identifier ?? null;
  const classLine = className?.grade
    ? `Grade ${className.grade}${className.section ? ` · Section ${className.section}` : ""}`
    : "Class details will appear once you are enrolled.";
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const allPayments = useMemo(() => {
    const list: Array<{ id: string; receipt_no?: string | null; amount?: number; method?: string | null; paid_at?: string | null; reference?: string | null }> = [];
    (profile?.fees?.invoices ?? []).forEach((inv) => {
      (inv.payments ?? []).forEach((p, idx) => {
        list.push({ ...p, id: String(p.id ?? `${inv.id}-${idx}`) });
      });
    });
    return list;
  }, [profile?.fees]);

  if (loading) {
    return (
      <div className="page-stack pupil-dashboard">
        <section className="pupil-hero">
          <div className="pupil-hero-copy">
            <SkeletonText width={118} />
            <SkeletonText width={280} height={30} style={{ marginTop: 14 }} />
            <SkeletonText width={220} style={{ marginTop: 12 }} />
          </div>
          <div className="pupil-hero-side">
            <SkeletonText width={100} />
            <SkeletonText width={170} style={{ marginTop: 12 }} />
          </div>
        </section>
        <div className="pupil-metrics">
          {Array.from({ length: 2 }, (_, index) => (
            <div className="panel pupil-metric" key={index}>
              <SkeletonText width="42%" />
              <SkeletonText
                width="58%"
                height={25}
                style={{ marginTop: 13 }}
              />
              <SkeletonText width="70%" style={{ marginTop: 11 }} />
            </div>
          ))}
        </div>
        <div className="pupil-grid">
          <SkeletonPanel bodyHeight={220} />
          <SkeletonPanel bodyHeight={220} />
        </div>
        <div className="pupil-grid even">
          <SkeletonPanel bodyHeight={180} />
          <SkeletonPanel bodyHeight={180} />
        </div>
      </div>
    );
  }

  if (error || !pupil) {
    return (
      <div className="page-stack pupil-dashboard">
        <div className="page-intro">
          <div>
            <Breadcrumb
              parent="Global Kids School"
              current="My school"
              onParentClick={onBack}
            />
            <h1 className="page-title">My school</h1>
          </div>
        </div>
        <section className="panel">
          <div className="flex items-start gap-3 px-6 py-8 text-sm text-[var(--danger)]">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">
                {error || "Your record could not be loaded."}
              </p>
              <p className="mt-1 text-[var(--text-muted)]">
                Ask at the school office if this keeps happening.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack pupil-dashboard">
      <section className="pupil-hero">
        <div className="pupil-hero-copy">
          <Breadcrumb
            parent="Global Kids School"
            current="My school"
            onParentClick={onBack}
          />
          <p className="eyebrow">
            {todayLabel}
            {academicYear ? ` · ${academicYear}` : ""}
          </p>
          <h1 className="page-title">
            {firstName ? `Hello, ${firstName}.` : `Hello, ${fullName}.`}
          </h1>
          <p className="page-subtitle">{classLine}</p>
          <div className="pupil-chips">
            {loginId && (
              <span className="pupil-chip">
                <FileText size={13} />
                USN {loginId}
              </span>
            )}
            {className?.roll_no != null && (
              <span className="pupil-chip">
                <UserRound size={13} />
                Roll {className.roll_no}
              </span>
            )}
            {pupil.status && (
              <span
                className={`pupil-chip ${
                  String(pupil.status).toLowerCase() === "active"
                    ? "is-active"
                    : ""
                }`}
              >
                {pupil.status}
              </span>
            )}
          </div>
        </div>
        <aside className="pupil-hero-side">
          <p className="pupil-side-label">Class teacher</p>
          <div className="pupil-teacher">
            <span className="pupil-teacher-avatar">
              {initialsOf(teacherName)}
            </span>
            <div>
              <strong>{teacherName ?? "Not assigned"}</strong>
              <span>
                {className?.room ? `Room ${className.room}` : "Room not set"}
              </span>
            </div>
          </div>
          <div className="pupil-side-divider" />
          <p className="pupil-side-label">Academic year</p>
          <strong className="pupil-side-value">
            {academicYear ?? "Not set"}
          </strong>
        </aside>
      </section>

      <div className="pupil-metrics">
        <PupilMetric
          icon={ClipboardCheck}
          label="Attendance"
          value={attendancePct !== null ? `${attendancePct}%` : "No data"}
          note={
            markedSessions > 0
              ? `${markedSessions} sessions marked`
              : "Register not started"
          }
          tone="teal"
        />
        <PupilMetric
          icon={GraduationCap}
          label="Academic average"
          value={academicPct !== null ? `${academicPct}%` : "No data"}
          note={latestExam?.name ?? "No published results"}
          tone="violet"
        />
        <PupilMetric
          icon={IndianRupee}
          label="Fees & Tuition"
          value={
            (profile?.fees?.summary?.outstanding ?? 0) === 0
              ? "Paid in Full"
              : `₹${(profile?.fees?.summary?.outstanding ?? 0).toLocaleString("en-IN")}`
          }
          note={
            (profile?.fees?.summary?.outstanding ?? 0) === 0
              ? "All installments settled · AY 2026–27"
              : `₹${(profile?.fees?.summary?.paid ?? 0).toLocaleString("en-IN")} paid of ₹${(profile?.fees?.summary?.billed ?? 0).toLocaleString("en-IN")}`
          }
          tone={(profile?.fees?.summary?.outstanding ?? 0) === 0 ? "teal" : "amber"}
        />
      </div>

      <div className="pupil-grid">
        <section className="panel pupil-chart-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Your register</p>
              <h2 className="panel-title">Attendance trend</h2>
            </div>
            <span className="count-badge">
              {trend.length > 0 ? `Last ${trend.length} months` : "No data"}
            </span>
          </div>
          {trend.length > 0 ? (
            <div className="pupil-chart">
              {trend.map(point => {
                const value = Math.max(
                  4,
                  Math.min(100, Number(point.percentage) || 0)
                );
                return (
                  <div className="pupil-chart-col" key={point.month}>
                    <span className="pupil-chart-value">
                      {Math.round(point.percentage)}%
                    </span>
                    <div
                      className="pupil-chart-track"
                      title={`${monthLabel(point.month)} · ${point.percentage}% across ${point.sessions} sessions`}
                    >
                      <span
                        className="pupil-chart-fill"
                        style={{ height: `${value}%` }}
                      />
                    </div>
                    <span className="pupil-chart-label">
                      {monthLabel(point.month)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyPanel
              icon={ClipboardCheck}
              title="No register entries yet"
              detail="Your attendance will appear here once your teacher marks the register."
            />
          )}
          <div className="pupil-chart-foot">
            <span>
              <i className="legend-dot bg-[var(--success)]" />
              {attendance?.present ?? 0} present
            </span>
            <span>
              <i className="legend-dot bg-[var(--warning)]" />
              {attendance?.late ?? 0} late
            </span>
            <span>
              <i className="legend-dot bg-[var(--danger)]" />
              {attendance?.absent ?? 0} absent
            </span>
            <span>
              <i className="legend-dot bg-[var(--info)]" />
              {attendance?.leave ?? 0} leave
            </span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">What’s next</p>
              <h2 className="panel-title">Next up</h2>
            </div>
            <CalendarDays size={18} className="text-[var(--text-muted)]" />
          </div>
          <div className="pupil-next-body">
            {latestExam ? (
              <div className="pupil-next-card">
                <span className="pupil-next-icon violet">
                  <GraduationCap size={17} />
                </span>
                <div>
                  <p>Latest result</p>
                  <strong>{latestExam.name ?? "Published exam"}</strong>
                  <span>
                    {formatDate(latestExam.starts_on) ?? "Published"} ·{" "}
                    {latestExam.percentage != null
                      ? `${Math.round(latestExam.percentage)}%`
                      : "Marks released"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="pupil-next-card is-empty">
                <span className="pupil-next-icon violet">
                  <GraduationCap size={17} />
                </span>
                <div>
                  <p>Latest result</p>
                  <strong>No results published</strong>
                  <span>Your marks will appear when a teacher publishes them.</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="pupil-grid even">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Published marks</p>
              <h2 className="panel-title">
                {latestExam?.name ?? "Latest results"}
              </h2>
            </div>
            {latestExam?.percentage != null && (
              <span className="pupil-score">
                {Math.round(latestExam.percentage)}%
              </span>
            )}
          </div>
          {latestExam?.papers?.length ? (
            <div className="pupil-result-list">
              {latestExam.papers.map((paper, index) => {
                const pct = percentageOf(paper);
                return (
                  <div
                    className="pupil-result-row"
                    key={`${paper.subject ?? "paper"}-${index}`}
                  >
                    <div className="pupil-result-head">
                      <span>{paper.subject ?? "Subject"}</span>
                      <span>
                        {paper.marks ?? 0} / {paper.max_marks ?? 0}
                        {paper.grade ? <em>{paper.grade}</em> : null}
                      </span>
                    </div>
                    <div className="pupil-result-bar">
                      <span
                        style={{
                          width: `${Math.max(3, Math.min(100, pct ?? 0))}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyPanel
              icon={BookOpen}
              title="No marks published yet"
              detail="Your subject marks will appear here after each exam is published."
            />
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Across published papers</p>
              <h2 className="panel-title">Subject performance</h2>
            </div>
            <span className="count-badge">
              {subjects.length > 0 ? `${subjects.length} subjects` : "No data"}
            </span>
          </div>
          {subjects.length > 0 ? (
            <div className="pupil-result-list">
              {subjects.slice(0, 6).map(subject => (
                <div className="pupil-result-row" key={subject.subject}>
                  <div className="pupil-result-head">
                    <span>{subject.subject}</span>
                    <span>
                      {subject.average != null
                        ? `${Math.round(subject.average)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="pupil-result-bar">
                    <span
                      style={{
                        width: `${Math.max(
                          3,
                          Math.min(100, subject.average ?? 0)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel
              icon={GraduationCap}
              title="No subject averages yet"
              detail="Once published results are available, your subject averages will be compared here."
            />
          )}
        </section>
      </div>

      {/* Tuition & Fee Standing Section */}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Accounts & Billing</p>
            <h2 className="panel-title">Tuition & fee standing</h2>
          </div>
          <span
            className={`status-pill ${
              (profile?.fees?.summary?.outstanding ?? 0) === 0 ? "success" : "warning"
            }`}
          >
            {(profile?.fees?.summary?.outstanding ?? 0) === 0
              ? "All Dues Cleared"
              : `₹${(profile?.fees?.summary?.outstanding ?? 0).toLocaleString("en-IN")} Pending`}
          </span>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "12px 16px",
              }}
            >
              <span className="text-xs text-[var(--text-muted)] block mb-1">Total Assessed Fee</span>
              <strong className="text-lg text-[var(--text-primary)]">
                ₹{(profile?.fees?.summary?.billed ?? 0).toLocaleString("en-IN")}
              </strong>
            </div>
            <div
              style={{
                background: "rgba(16, 185, 129, 0.06)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                borderRadius: "10px",
                padding: "12px 16px",
              }}
            >
              <span className="text-xs text-emerald-400 block mb-1">Total Paid Amount</span>
              <strong className="text-lg text-emerald-400">
                ₹{(profile?.fees?.summary?.paid ?? 0).toLocaleString("en-IN")}
              </strong>
            </div>
            <div
              style={{
                background:
                  (profile?.fees?.summary?.outstanding ?? 0) === 0
                    ? "rgba(16, 185, 129, 0.06)"
                    : "rgba(245, 158, 11, 0.06)",
                border:
                  (profile?.fees?.summary?.outstanding ?? 0) === 0
                    ? "1px solid rgba(16, 185, 129, 0.2)"
                    : "1px solid rgba(245, 158, 11, 0.2)",
                borderRadius: "10px",
                padding: "12px 16px",
              }}
            >
              <span
                className={`text-xs block mb-1 ${
                  (profile?.fees?.summary?.outstanding ?? 0) === 0
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                Remaining Balance Due
              </span>
              <strong
                className={`text-lg ${
                  (profile?.fees?.summary?.outstanding ?? 0) === 0
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                ₹{(profile?.fees?.summary?.outstanding ?? 0).toLocaleString("en-IN")}
              </strong>
            </div>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Payment Receipts & Verified History
          </h3>
          {allPayments.length > 0 ? (
            <div className="table-scroll" style={{ borderRadius: "8px", border: "1px solid var(--border)" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Receipt No</th>
                    <th>Payment Date</th>
                    <th>Method</th>
                    <th>Amount Paid</th>
                    <th>Reference / UTR</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs text-[var(--brand)] font-semibold">
                        {p.receipt_no || "Receipt"}
                      </td>
                      <td className="muted-cell">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td className="font-medium text-[var(--text-primary)]">
                        {p.method || "Verified Payment"}
                      </td>
                      <td className="text-emerald-400 font-semibold">
                        ₹{(p.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="font-mono text-xs text-[var(--text-muted)]">
                        {p.reference || "—"}
                      </td>
                      <td>
                        <span className="status-pill success text-[11px]">
                          <Check size={11} className="mr-1" />
                          Verified
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">
              No payments logged yet. Verified receipts will be posted here immediately upon collection.
            </p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Your record</p>
            <h2 className="panel-title">At a glance</h2>
          </div>
          <GraduationCap size={18} className="text-[var(--text-muted)]" />
        </div>
        <div className="pupil-detail-grid">
          <Detail label="USN" value={loginId} />
          <Detail label="Class" value={classLine} />
          <Detail label="Roll number" value={className?.roll_no} />
          <Detail label="Academic year" value={academicYear} />
          <Detail label="Class teacher" value={teacherName} />
          <Detail
            label="Date of birth"
            value={formatDate(pupil.date_of_birth)}
          />
          <Detail
            label="Primary guardian"
            value={primaryGuardian?.full_name}
          />
          <Detail
            label="Guardian phone"
            value={
              primaryGuardian?.phone ??
              emergencyGuardian?.phone ??
              pupil.emergency_contact_phone
            }
            icon={Phone}
          />
          <Detail
            label="Guardian email"
            value={primaryGuardian?.email}
            icon={Mail}
          />
          <Detail
            label="Emergency contact"
            value={
              pupil.emergency_contact_name ??
              emergencyGuardian?.full_name
            }
          />
          <Detail
            label="Emergency phone"
            value={
              pupil.emergency_contact_phone ??
              emergencyGuardian?.alternate_phone ??
              emergencyGuardian?.phone
            }
            icon={Phone}
          />
        </div>
      </section>
    </div>
  );
}

function PupilMetric({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  note: string;
  tone: "teal" | "violet" | "amber" | "blue";
}) {
  return (
    <div className="panel pupil-metric">
      <div className="pupil-metric-top">
        <span className="pupil-metric-label">{label}</span>
        <span className={`pupil-metric-icon ${tone}`}>
          <Icon size={15} strokeWidth={1.9} />
        </span>
      </div>
      <p className="pupil-metric-value">{value}</p>
      <p className="pupil-metric-note">{note}</p>
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  detail,
}: {
  icon: React.ElementType;
  title: string;
  detail: string;
}) {
  return (
    <div className="pupil-empty">
      <span className="pupil-empty-icon">
        <Icon size={20} />
      </span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function Detail({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | number | null;
  icon?: React.ElementType;
}) {
  return (
    <div className="pupil-detail">
      <span>{label}</span>
      <strong>
        {Icon ? <Icon size={13} /> : null}
        {value != null && String(value).trim() !== ""
          ? String(value)
          : "Not recorded"}
      </strong>
    </div>
  );
}

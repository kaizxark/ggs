import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Award,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { supabase, readPortalAccount } from "../lib/supabase";
import { Breadcrumb } from "./Breadcrumb";
import {
  SkeletonPanel,
  SkeletonText,
} from "./ErpSkeleton";

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

type Assignment = {
  id: string;
  title?: string | null;
  subject?: string | null;
  due_at?: string | null;
  created_at?: string | null;
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
    assignments?: Assignment[];
    subjects?: Subject[];
  };
  activities?: Activity[];
  guardians?: Guardian[];
  exams?: ExamCalendar[];
  fees?: FeeSummary;
  documents?: StudentDocument[];
  health?: HealthSummary;
  transport?: TransportSummary;
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

type TransportSummary = {
  enrolled?: boolean;
  allocations?: Array<{
    id?: string;
    active?: boolean;
    route_code?: string | null;
    route_name?: string | null;
    vehicle_no?: string | null;
    driver_name?: string | null;
    driver_phone?: string | null;
    stop_name?: string | null;
    pickup_time?: string | null;
    drop_time?: string | null;
    fare_amount?: number | null;
    is_authorized_pickup?: boolean;
    ended_on?: string | null;
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

  useEffect(() => {
    let live = true;
    (async () => {
      const account = await readPortalAccount();
      if (!live) return;
      if (!account?.recordId) {
        setError("Your account is not linked to a pupil record yet.");
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setError("Your session has expired. Sign in again to continue.");
          return;
        }
        const res = await fetch(
          `/api/student-profile?studentId=${encodeURIComponent(account.recordId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) {
          const json = (await res.json()) as { message?: string };
          setError(json.message ?? "Your record could not be loaded.");
          return;
        }
        const json = (await res.json()) as Profile;
        if (!json?.student) {
          setError("Your record could not be loaded.");
          return;
        }
        setProfile(json);
      } catch {
        setError("Cannot reach the server. Check your connection.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return { profile, loading, error };
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

  const assignments = profile?.academics?.assignments ?? [];
  const now = Date.now();
  const upcomingAssignments = assignments
    .filter(
      assignment =>
        assignment.due_at &&
        new Date(assignment.due_at).getTime() >= now
    )
    .sort(
      (a, b) =>
        new Date(a.due_at ?? "").getTime() -
        new Date(b.due_at ?? "").getTime()
    );
  const overdueAssignments = assignments.filter(
    assignment =>
      assignment.due_at && new Date(assignment.due_at).getTime() < now
  );
  const nextAssignment = upcomingAssignments[0] ?? null;
  const activities = profile?.activities ?? [];
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
          {Array.from({ length: 4 }, (_, index) => (
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
          icon={FileText}
          label={
            overdueAssignments.length > 0
              ? "Assignments overdue"
              : "Assignments due"
          }
          value={String(
            overdueAssignments.length > 0
              ? overdueAssignments.length
              : upcomingAssignments.length
          )}
          note={
            overdueAssignments.length > 0
              ? "Past the due date"
              : nextAssignment?.due_at
                ? `Next due ${formatDate(nextAssignment.due_at) ?? "soon"}`
                : "Nothing due next"
          }
          tone="amber"
        />
        <PupilMetric
          icon={Award}
          label="Activities"
          value={String(activities.length)}
          note={
            activities.some(activity => activity.award || activity.achievement)
              ? "Includes achievements"
              : "Clubs and participation"
          }
          tone="blue"
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
            {nextAssignment ? (
              <div className="pupil-next-card">
                <span className="pupil-next-icon amber">
                  <FileText size={17} />
                </span>
                <div>
                  <p>Next assignment</p>
                  <strong>{nextAssignment.title ?? "Assignment"}</strong>
                  <span>
                    {nextAssignment.subject ?? "Class work"} · Due{" "}
                    {formatDate(nextAssignment.due_at) ?? "soon"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="pupil-next-card is-empty">
                <span className="pupil-next-icon teal">
                  <FileText size={17} />
                </span>
                <div>
                  <p>Next assignment</p>
                  <strong>Nothing due</strong>
                  <span>New work will appear here when it is set.</span>
                </div>
              </div>
            )}
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
            {overdueAssignments.length > 0 && (
              <div className="pupil-alert">
                <AlertCircle size={16} />
                <span>
                  {overdueAssignments.length} assignment
                  {overdueAssignments.length === 1 ? "" : "s"} past the due date
                </span>
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

      <div className="pupil-grid even">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Class work</p>
              <h2 className="panel-title">Assignments</h2>
            </div>
            <span className="count-badge">
              {upcomingAssignments.length} upcoming
            </span>
          </div>
          {assignments.length > 0 ? (
            <div className="pupil-list">
              {assignments.slice(0, 6).map(assignment => {
                const due = assignment.due_at
                  ? new Date(assignment.due_at).getTime()
                  : null;
                const late = due !== null && due < now;
                return (
                  <div className="pupil-list-row" key={assignment.id}>
                    <span
                      className={`pupil-list-icon ${late ? "danger" : "teal"}`}
                    >
                      <FileText size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong>{assignment.title ?? "Assignment"}</strong>
                      <span>
                        {assignment.subject ?? "Class work"} ·{" "}
                        {assignment.due_at
                          ? `Due ${formatDate(assignment.due_at) ?? "soon"}`
                          : "No due date"}
                      </span>
                    </div>
                    <span
                      className={`status-pill ${late ? "warning" : "success"}`}
                    >
                      {late ? "Overdue" : "Open"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyPanel
              icon={FileText}
              title="No assignments set"
              detail="Homework and class work for your class will appear here."
            />
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Beyond the classroom</p>
              <h2 className="panel-title">Activities</h2>
            </div>
            <span className="count-badge">
              {activities.length > 0 ? `${activities.length} records` : "No data"}
            </span>
          </div>
          {activities.length > 0 ? (
            <div className="pupil-list">
              {activities.slice(0, 5).map(activity => (
                <div className="pupil-list-row" key={activity.id}>
                  <span className="pupil-list-icon violet">
                    <Award size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong>{activity.name ?? "Activity"}</strong>
                    <span>
                      {[activity.category, activity.role, activity.award]
                        .filter(Boolean)
                        .join(" · ") || "Participation recorded"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel
              icon={Award}
              title="No activities recorded"
              detail="Clubs, sports and achievements will appear here when they are added."
            />
          )}
        </section>
      </div>

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

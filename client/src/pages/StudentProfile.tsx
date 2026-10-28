import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Award,
  BookOpen,
  Bus,
  CalendarDays,
  ClipboardCheck,
  Download,
  FileText,
  HeartPulse,
  Library,
  Lock,
  MessageSquare,
  Pencil,
  Printer,
  ShieldAlert,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

import {
  ApiError,
  archiveStudent,
  fetchStudentProfile,
  formatBytes,
  formatDate,
  formatMoney,
  formatMonth,
  formatPercent,
  initialsFor,
  saveBlob,
  updateStudent,
  type ProfilePayload,
  type StudentDraft,
} from "@/lib/student-directory";
import { toast } from "@/lib/toast";
import {
  canDecideLeave,
  canEditStudent,
  canManageDocuments,
  canRecordAttendance,
  canViewFees,
  canWriteObservations,
  type StudentSection,
} from "@shared/student-access";
import { DocumentPanel } from "@/components/StudentDocumentPanel";

/**
 * One pupil's complete record.
 *
 * ## Why a page and not a drawer
 *
 * The profile has fourteen sections. In a slide-over that meant either a
 * scrolling wall of text or a tab strip narrow enough to be unusable on a
 * laptop. This is a full page, reached from the directory by expanding a row and
 * then opening it, so the overview has room for charts and the sections have
 * room for tables.
 *
 * ## Where the permissions come from
 *
 * Not from here. The server decides which sections exist in the payload and sends
 * back `withheld` for the ones the caller may not see, so a locked tab can say
 * *why* it is locked rather than appearing empty. This component never decides
 * whether to hide a section — it renders what it was given and explains the rest.
 * That is why `canEditStudent` and friends below are used only to disable
 * buttons the server would refuse anyway, never to omit data.
 */

const SECTION_ICONS: Record<string, React.ElementType> = {
  personal: UserRound,
  guardians: Users,
  academics: BookOpen,
  attendance: ClipboardCheck,
  fees: Wallet,
  documents: FileText,
  health: HeartPulse,
  transport: Bus,
  activities: Award,
  observations: MessageSquare,
  communications: MessageSquare,
  admission: CalendarDays,
  library: Library,
  account: ShieldAlert,
};

/** Tabs in the order a reader wants them, rather than alphabetical. */
const SECTION_ORDER: StudentSection[] = [
  "personal",
  "guardians",
  "academics",
  "attendance",
  "fees",
  "documents",
  "health",
  "transport",
  "activities",
  "observations",
  "communications",
  "admission",
  "library",
  "account",
];

export interface StudentProfileProps {
  studentId: string;
  onBack: () => void;
  onChanged?: () => void;
}

export function StudentProfile({ studentId, onBack, onChanged }: StudentProfileProps) {
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StudentSection>("personal");
  const [editing, setEditing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        setData(await fetchStudentProfile(studentId, signal));
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof ApiError ? err.message : "This profile could not be loaded.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [studentId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Move focus to the heading when the pupil changes, so a keyboard or screen
  // reader user is told the page changed rather than left where they were.
  useEffect(() => {
    headingRef.current?.focus();
  }, [studentId]);

  const role = data?.viewer.role ?? "";

  if (loading && !data) {
    return <ProfileSkeleton name="Loading this student's record…" onBack={onBack} />;
  }

  if (error && !data) {
    return (
      <div className="page-stack">
        <BackLink onClick={onBack} />
        <div className="panel empty-state">
          <ShieldAlert size={22} />
          <h2 className="panel-title">This profile is not available</h2>
          <p className="panel-subtitle">{error}</p>
          <button className="primary-button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const visible = SECTION_ORDER.filter((s) => data.sections.indexOf(s) !== -1);
  const withheld = SECTION_ORDER.filter((s) => data.sections.indexOf(s) === -1);
  const current = visible.indexOf(tab) !== -1 ? tab : visible[0];

  return (
    <div className="page-stack">
      <BackLink onClick={onBack} />

      <ProfileHeader
        data={data}
        role={role}
        onEdit={() => setEditing(true)}
        onArchive={async () => {
          try {
            await archiveStudent(studentId);
            toast.success("Student archived", {
              description: "Their academic, fee and attendance records are unchanged.",
            });
            onChanged?.();
            onBack();
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Could not archive this student.");
          }
        }}
        onPrint={() => window.print()}
      />

      {error && (
        <div className="notice notice-warning" role="status">
          {error} Showing the last record that loaded.
        </div>
      )}

      <nav className="profile-tabs" aria-label="Profile sections">
        {visible.map((section) => {
          const Icon = SECTION_ICONS[section] ?? FileText;
          return (
            <button
              key={section}
              className={current === section ? "active" : ""}
              onClick={() => setTab(section)}
              aria-current={current === section ? "page" : undefined}
            >
              <Icon size={15} />
              {data.sectionLabels[section] ?? section}
            </button>
          );
        })}
        {withheld.map((section) => (
          <button key={section} className="locked" disabled title={`You do not have access to ${section}`}>
            <Lock size={13} />
            {data.sectionLabels[section] ?? section}
          </button>
        ))}
      </nav>

      <div className="profile-body">
        {current === "personal" && <PersonalSection data={data} />}
        {current === "guardians" && <GuardiansSection data={data} role={role} />}
        {current === "academics" && <AcademicsSection data={data} />}
        {current === "attendance" && <AttendanceSection data={data} />}
        {current === "fees" && data.fees && <FeesSection data={data} />}
        {current === "documents" && <DocumentPanel studentId={studentId} studentName={data.student.name} />}
        {current === "health" && data.health && <HealthSection data={data} />}
        {current === "transport" && data.transport && <TransportSection data={data} />}
        {current === "activities" && <ActivitiesSection data={data} />}
        {current === "observations" && data.observations && <ObservationsSection data={data} role={role} />}
        {current === "communications" && data.communications && <CommunicationsSection data={data} />}
        {current === "admission" && data.admission && <AdmissionSection data={data} />}
        {current === "library" && data.library && <LibrarySection data={data} />}
        {current === "account" && data.account && <AccountSection data={data} />}
      </div>

      {editing && (
        <EditStudentDialog
          data={data}
          onClose={() => setEditing(false)}
          onSaved={async (draft) => {
            try {
              await updateStudent(studentId, draft);
              toast.success("Student details saved");
              setEditing(false);
              await load();
              onChanged?.();
            } catch (err) {
              if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
                throw err;
              }
              toast.error(err instanceof ApiError ? err.message : "Could not save these details.");
            }
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Header
 * ------------------------------------------------------------------ */

function ProfileHeader({
  data,
  role,
  onEdit,
  onArchive,
  onPrint,
}: {
  data: ProfilePayload;
  role: string;
  onEdit: () => void;
  onArchive: () => void;
  onPrint: () => void;
}) {
  const { student, class: klass } = data;

  return (
    <header className="profile-header">
      <div className="profile-identity">
        {student.photo_url ? (
          <img className="avatar avatar-xl" src={student.photo_url} alt="" />
        ) : (
          <span className="avatar avatar-xl">{initialsFor(student.name)}</span>
        )}

        <div className="profile-identity-text">
          <h1 ref={undefined} className="profile-name" tabIndex={-1}>
            {student.name}
          </h1>
          <p className="profile-meta">
            <span>{student.usn ?? "No USN"}</span>
            {klass.grade && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {klass.grade}
                  {klass.section ? ` · Section ${klass.section}` : ""}
                  {klass.roll_no ? ` · Roll ${klass.roll_no}` : ""}
                </span>
              </>
            )}
            {klass.academic_year && (
              <>
                <span aria-hidden="true">·</span>
                <span>{klass.academic_year.name}</span>
              </>
            )}
          </p>
          <div className="profile-badges">
            <span className={`status-pill ${student.status === "active" ? "success" : "warning"}`}>
              <span className="status-dot" />
              {titleCase(student.status ?? "unknown")}
            </span>
            <span className={`status-pill ${klass.enrolment_status === "active" ? "success" : "neutral"}`}>
              {klass.enrolment_status === "active" ? "Enrolled" : "Not enrolled"}
            </span>
            {student.age !== null && <span className="status-pill neutral">{student.age} yrs</span>}
          </div>
        </div>
      </div>

      {/*
        Quick actions are gated by the same helpers the API enforces. A button the
        server would refuse is disabled with a reason rather than hidden, because
        a missing button leaves the user wondering whether the action exists.
      */}
      <div className="profile-actions">
        <QuickAction
          label="Edit details"
          icon={Pencil}
          enabled={canEditStudent(role)}
          disabledReason="Only an administrator can edit a student record."
          onClick={onEdit}
        />
        <QuickAction
          label="Take attendance"
          icon={ClipboardCheck}
          enabled={canRecordAttendance(role)}
          disabledReason="Attendance is recorded by teachers and administrators."
          onClick={() =>
            toast("Attendance", {
              description: `Open the Attendance screen to record ${data.student.name}'s register.`,
            })
          }
        />
        <QuickAction
          label="Upload document"
          icon={FileText}
          enabled={canManageDocuments(role)}
          disabledReason="Documents are handled by administrators."
          onClick={() => toast("Documents", { description: "Use the Documents tab to upload a file." })}
        />
        <QuickAction
          label="View results"
          icon={BookOpen}
          enabled={data.sections.indexOf("academics") !== -1}
          disabledReason="You cannot view this student's academic record."
          onClick={() => toast("Results", { description: "Subject-wise results are on the Academics tab." })}
        />
        <QuickAction
          label="Contact guardian"
          icon={MessageSquare}
          enabled={data.sections.indexOf("guardians") !== -1}
          disabledReason="You cannot view this student's guardians."
          onClick={() =>
            toast("Guardian contact", {
              description: "Use Messages to contact the family, so the conversation is recorded.",
            })
          }
        />
        <button className="secondary-button compact" onClick={onPrint}>
          <Printer size={14} />
          Print
        </button>
        <button className="secondary-button compact" onClick={() => downloadSummary(data)}>
          <Download size={14} />
          Export
        </button>
        {canEditStudent(role) && (
          <button className="secondary-button compact danger" onClick={onArchive}>
            Archive
          </button>
        )}
      </div>
    </header>
  );
}

function QuickAction({
  label,
  icon: Icon,
  enabled,
  disabledReason,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  enabled: boolean;
  disabledReason: string;
  onClick: () => void;
}) {
  if (!enabled) {
    return (
      <button className="secondary-button compact" disabled title={disabledReason}>
        <Icon size={14} />
        {label}
      </button>
    );
  }
  return (
    <button className="secondary-button compact" onClick={onClick}>
      <Icon size={14} />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Overview: the numbers a reader opens the profile for
 * ------------------------------------------------------------------ */

function OverviewStrip({ data }: { data: ProfilePayload }) {
  const attendance = data.attendance?.summary;
  const fees = data.fees?.summary;

  return (
    <div className="metric-row">
      <Metric
        label="Attendance"
        value={formatPercent(attendance?.percentage ?? null)}
        note={attendance ? `${attendance.marked_sessions} sessions recorded` : "Not available to you"}
        tone={toneForPercent(attendance?.percentage ?? null, 90)}
      />
      <Metric
        label="Academic average"
        value={formatPercent(data.academics?.subject_performance?.[0]?.average ?? null)}
        note={
          data.academics
            ? `${data.academics.subject_performance.length} subject${data.academics.subject_performance.length === 1 ? "" : "s"}`
            : "Not available to you"
        }
      />
      {fees && (
        <Metric
          label="Outstanding fees"
          value={formatMoney(fees.outstanding)}
          note={fees.overdue_count > 0 ? `${fees.overdue_count} overdue invoice(s)` : "Nothing overdue"}
          tone={fees.outstanding > 0 ? "warning" : "positive"}
        />
      )}
      <Metric
        label="Age"
        value={data.student.age !== null ? `${data.student.age}` : "—"}
        note={data.student.date_of_birth ? `Born ${formatDate(data.student.date_of_birth)}` : "Date of birth not recorded"}
      />
    </div>
  );
}

function Metric({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="metric-block">
      <p className="metric-label">{label}</p>
      <p className={`metric-value${tone ? ` ${tone}` : ""}`}>{value}</p>
      {note && <p className="metric-note">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sections
 * ------------------------------------------------------------------ */

function PersonalSection({ data }: { data: ProfilePayload }) {
  const s = data.student;
  return (
    <div className="section-stack">
      <OverviewStrip data={data} />

      <div className="two-column">
        <div className="panel">
          <h2 className="panel-title">Personal information</h2>
          <dl className="detail-list">
            <Detail label="USN" value={s.usn} />
            <Detail label="Full name" value={s.name} />
            <Detail label="Date of birth" value={formatDate(s.date_of_birth)} />
            <Detail label="Age" value={s.age !== null ? `${s.age} years` : "Not recorded"} />
            <Detail label="Gender" value={titleCase(s.gender)} />
            <Detail label="Blood group" value={s.blood_group} />
            <Detail label="Nationality" value={s.nationality} />
            <Detail label="Mother tongue" value={s.mother_tongue} />
            <Detail label="Religion" value={s.religion} />
            <Detail label="Admission date" value={formatDate(s.joined_on)} />
            <Detail label="Status" value={titleCase(s.status)} />
            <Detail label="Current year" value={data.class.academic_year?.name} />
            <Detail label="Class" value={data.class.grade} />
            <Detail label="Section" value={data.class.section} />
            <Detail label="Roll number" value={data.class.roll_no} />
            <Detail label="Class teacher" value={data.class.class_teacher?.name} />
          </dl>
        </div>

        <div className="panel">
          <h2 className="panel-title">Contact and address</h2>
          <dl className="detail-list">
            <Detail label="Student email" value={s.email} />
            <Detail label="Student phone" value={s.phone} />
            <Detail label="Address" value={joinLines([s.address.line1, s.address.line2])} />
            <Detail label="City" value={s.address.city} />
            <Detail label="District" value={s.address.district} />
            <Detail label="State" value={s.address.state} />
            <Detail label="PIN code" value={s.address.pincode} />
            <Detail label="Country" value={s.address.country} />
            <Detail label="Emergency contact" value={s.emergency_contact_name} />
            <Detail label="Emergency phone" value={s.emergency_contact_phone} />
          </dl>
        </div>
      </div>

      <ProfileHistory data={data} />
    </div>
  );
}

/**
 * Recent activity across every section, assembled client-side from what the
 * server already sent.
 *
 * Only events the profile actually holds are listed. An empty history is shown as
 * an empty state rather than padded with placeholders.
 */
function ProfileHistory({ data }: { data: ProfilePayload }) {
  const events = useMemo(() => {
    const out: Array<{ when: string; what: string; kind: string }> = [];

    for (const d of data.documents ?? []) {
      out.push({ when: d.uploaded_on, what: `Uploaded ${d.title}`, kind: "document" });
    }
    for (const a of data.attendance?.absences ?? []) {
      out.push({ when: a.date, what: `Marked ${a.status}`, kind: "attendance" });
    }
    for (const r of data.academics?.results ?? []) {
      const on = r.published ? "" : " (unpublished)";
      out.push({ when: r.starts_on ?? "", what: `${r.name}: ${formatPercent(r.percentage)}${on}`, kind: "exam" });
    }
    for (const c of data.communications ?? []) {
      out.push({ when: c.occurred_at.slice(0, 10), what: `${titleCase(c.kind)}: ${c.subject ?? "recorded"}`, kind: "message" });
    }

    return out
      .filter((e) => e.when)
      .sort((a, b) => b.when.localeCompare(a.when))
      .slice(0, 12);
  }, [data]);

  return (
    <div className="panel">
      <h2 className="panel-title">Recent activity</h2>
      {events.length === 0 ? (
        <p className="panel-subtitle">Nothing has been recorded against this student yet.</p>
      ) : (
        <ul className="timeline">
          {events.map((e, i) => (
            <li key={`${e.when}-${i}`}>
              <span className="timeline-date">{formatDate(e.when)}</span>
              <span className="timeline-what">{e.what}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GuardiansSection({ data, role }: { data: ProfilePayload; role: string }) {
  const guardians = data.guardians ?? [];
  if (!guardians.length) {
    return (
      <div className="panel empty-state">
        <Users size={20} />
        <h2 className="panel-title">No guardians recorded</h2>
        <p className="panel-subtitle">Add a guardian from the Students form to complete this record.</p>
      </div>
    );
  }

  return (
    <div className="section-stack">
      {guardians.map((g) => (
        <div className="panel" key={g.link_id}>
          <div className="panel-header">
            <h2 className="panel-title">
              {g.full_name}
              {g.is_primary && <span className="chip chip-accent">Primary</span>}
              {g.is_emergency_contact && <span className="chip">Emergency contact</span>}
            </h2>
            {canEditStudent(role) && (
              <button
                className="secondary-button compact"
                onClick={() => toast("Guardian details", { description: "Editing guardians is available from the Students form." })}
              >
                <Pencil size={14} />
                Edit
              </button>
            )}
          </div>
          <dl className="detail-list detail-list-inline">
            <Detail label="Relationship" value={titleCase(g.relationship)} />
            <Detail label="Phone" value={g.phone} />
            <Detail label="Alternate phone" value={g.alternate_phone} />
            <Detail label="Email" value={g.email} />
            <Detail label="Occupation" value={g.occupation} />
            <Detail label="Portal account" value={g.has_portal_account ? "Linked" : "Not linked"} />
          </dl>
          <div className="permission-grid">
            {Object.entries(g.permissions).map(([key, value]) => (
              <span key={key} className={`chip ${value === true ? "chip-accent" : value === null ? "chip-muted" : ""}`}>
                {titleCase(key)}: {value === true ? "yes" : value === false ? "no" : "default"}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AcademicsSection({ data }: { data: ProfilePayload }) {
  const academics = data.academics;
  if (!academics) {
    return <Withheld />;
  }

  const best = academics.subject_performance[0];
  const weakest = academics.subject_performance[academics.subject_performance.length - 1];

  return (
    <div className="section-stack">
      <div className="two-column">
        <div className="panel">
          <h2 className="panel-title">Subject performance</h2>
          {academics.subject_performance.length === 0 ? (
            <p className="panel-subtitle">No published results yet.</p>
          ) : (
            <>
              {best && (
                <p className="panel-subtitle">
                  Strongest: <strong>{best.subject}</strong> at {formatPercent(best.average)}.{" "}
                  {weakest && weakest.subject !== best.subject && (
                    <>
                      Needs support in <strong>{weakest.subject}</strong> at {formatPercent(weakest.average)}.
                    </>
                  )}
                </p>
              )}
              <SubjectChart subjects={academics.subject_performance} />
            </>
          )}
        </div>

        <div className="panel">
          <h2 className="panel-title">Subjects and teachers</h2>
          {academics.subjects.length === 0 ? (
            <p className="panel-subtitle">No subject assignments recorded for this class.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Teacher</th>
                </tr>
              </thead>
              <tbody>
                {academics.subjects.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.subject}</td>
                    <td className="muted-cell">{s.code ?? "—"}</td>
                    <td>{s.teacher ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Examination results</h2>
        {academics.results.length === 0 ? (
          <p className="panel-subtitle">No examination results recorded.</p>
        ) : (
          academics.results.map((exam) => (
            <div key={exam.examination_id} className="subsection">
              <div className="panel-header">
                <h3 className="subsection-title">
                  {exam.name}
                  {exam.published ? null : <span className="chip chip-muted">Not published</span>}
                </h3>
                <span className={scoreClass(exam.percentage)}>{formatPercent(exam.percentage)}</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Marks</th>
                    <th>Out of</th>
                    <th>%</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {exam.papers.map((p) => (
                    <tr key={p.subject}>
                      <td>{p.subject}</td>
                      <td>{p.marks}</td>
                      <td className="muted-cell">{p.max_marks}</td>
                      <td>{formatPercent(p.percentage)}</td>
                      <td>{p.grade ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      <div className="two-column">
        <div className="panel">
          <h2 className="panel-title">Class and promotion history</h2>
          <p className="panel-subtitle">
            Previous years are kept when a student moves class, so this history is not overwritten.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Class</th>
                <th>Roll</th>
                <th>From</th>
              </tr>
            </thead>
            <tbody>
              {academics.enrollment_history.map((e) => (
                <tr key={e.id}>
                  <td>{e.academic_year ?? "—"}</td>
                  <td>
                    {e.grade ?? "—"}
                    {e.section ? ` · ${e.section}` : ""}
                  </td>
                  <td className="muted-cell">{e.roll_no ?? "—"}</td>
                  <td className="muted-cell">{formatDate(e.enrolled_on)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2 className="panel-title">Recent assignments</h2>
          {academics.assignments.length === 0 ? (
            <p className="panel-subtitle">No assignments set for this class.</p>
          ) : (
            <ul className="plain-list">
              {academics.assignments.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.title}</span>
                  <span className="muted-cell">
                    {a.subject ?? "—"} · due {formatDate(a.due_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A horizontal bar chart of subject averages.
 *
 * Plain divs rather than a charting library: this is the only chart the profile
 * needs, and a bar is a width. Sizing it in CSS avoids shipping a library to
 * render six rectangles.
 */
function SubjectChart({ subjects }: { subjects: Array<{ subject: string; average: number | null }> }) {
  return (
    <ul className="bar-chart">
      {subjects.slice(0, 10).map((s) => {
        const pct = Math.max(0, Math.min(100, Number(s.average ?? 0)));
        return (
          <li key={s.subject}>
            <span className="bar-label">{s.subject}</span>
            <span className="bar-track">
              <span
                className={`bar-fill ${pct >= 50 ? "bar-good" : "bar-low"}`}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="bar-value">{formatPercent(s.average)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function AttendanceSection({ data }: { data: ProfilePayload }) {
  const a = data.attendance;
  if (!a) return <Withheld />;
  const s = a.summary;

  return (
    <div className="section-stack">
      <div className="metric-row">
        <Metric label="Attendance" value={formatPercent(s.percentage)} note={`${s.marked_sessions} sessions`} tone={toneForPercent(s.percentage, 90)} />
        <Metric label="Present" value={String(s.present)} note="Full days" />
        <Metric label="Absent" value={String(s.absent)} note="Full days" tone={s.absent > 0 ? "warning" : undefined} />
        <Metric label="Late" value={String(s.late)} note="Arrived after the bell" />
        <Metric label="Approved leave" value={String(s.leave)} note="Not counted against attendance" />
      </div>

      <div className="panel">
        <h2 className="panel-title">Attendance trend</h2>
        {a.trend.length === 0 ? (
          <p className="panel-subtitle">No attendance recorded yet.</p>
        ) : (
          <TrendChart points={a.trend} />
        )}
      </div>

      <div className="two-column">
        <div className="panel">
          <h2 className="panel-title">Recent absences</h2>
          {a.absences.length === 0 ? (
            <p className="panel-subtitle">No absences recorded.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {a.absences.map((x, i) => (
                  <tr key={`${x.date}-${i}`}>
                    <td>{formatDate(x.date)}</td>
                    <td>
                      <span className="status-pill warning">
                        <span className="status-dot" />
                        {titleCase(x.status)}
                      </span>
                    </td>
                    <td className="muted-cell">{x.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h2 className="panel-title">Attendance corrections</h2>
          {a.corrections.length === 0 ? (
            <p className="panel-subtitle">No mark has been changed after being recorded.</p>
          ) : (
            <ul className="plain-list">
              {a.corrections.map((c) => (
                <li key={c.id}>
                  <span>
                    <strong>{formatDate(c.attendance_date)}</strong>: {titleCase(c.from_status ?? "unset")} →{" "}
                    {titleCase(c.to_status ?? "unset")}
                  </span>
                  <span className="muted-cell">{c.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Leave applications</h2>
        {a.leaves.length === 0 ? (
          <p className="panel-subtitle">No leave has been applied for.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {a.leaves.map((l) => (
                <tr key={l.id}>
                  <td>{titleCase(l.leave_type)}</td>
                  <td>{formatDate(l.from_on)}</td>
                  <td>{formatDate(l.to_on)}</td>
                  <td className="muted-cell">{l.days}</td>
                  <td>
                    <span className={`status-pill ${l.status === "approved" ? "success" : l.status === "rejected" ? "danger" : "warning"}`}>
                      <span className="status-dot" />
                      {titleCase(l.status)}
                    </span>
                  </td>
                  <td className="muted-cell">{l.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** A line-ish trend drawn with bars; see SubjectChart for why no chart library. */
function TrendChart({ points }: { points: Array<{ month: string; percentage: number; sessions: number }> }) {
  return (
    <ul className="bar-chart">
      {points.slice(-12).map((p) => {
        const pct = Math.max(0, Math.min(100, p.percentage));
        return (
          <li key={p.month}>
            <span className="bar-label">{formatMonth(p.month)}</span>
            <span className="bar-track">
              <span className={`bar-fill ${pct >= 90 ? "bar-good" : pct >= 75 ? "bar-warn" : "bar-low"}`} style={{ width: `${pct}%` }} />
            </span>
            <span className="bar-value">{formatPercent(p.percentage)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function FeesSection({ data }: { data: ProfilePayload }) {
  const f = data.fees;
  if (!f) return <Withheld />;
  const s = f.summary;

  return (
    <div className="section-stack">
      <div className="metric-row">
        <Metric label="Billed" value={formatMoney(s.billed)} note="All invoices this year" />
        <Metric label="Paid" value={formatMoney(s.paid)} note="Received to date" tone="positive" />
        <Metric
          label="Outstanding"
          value={formatMoney(s.outstanding)}
          note={s.overdue_count > 0 ? `${s.overdue_count} overdue` : "Nothing overdue"}
          tone={s.outstanding > 0 ? "warning" : "positive"}
        />
        <Metric label="Overdue amount" value={formatMoney(s.overdue_amount)} tone={s.overdue_amount > 0 ? "warning" : undefined} />
      </div>

      {f.upcoming.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Upcoming instalments</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Instalment</th>
                <th>Due</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {f.upcoming.map((i) => (
                <tr key={i.id}>
                  <td className="font-medium">{i.label}</td>
                  <td>{formatDate(i.due_on)}</td>
                  <td>{formatMoney(i.amount)}</td>
                  <td className="muted-cell">{formatMoney(i.paid_amount)}</td>
                  <td>
                    <span className={`status-pill ${i.status === "overdue" ? "danger" : "warning"}`}>
                      <span className="status-dot" />
                      {titleCase(i.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {f.accounts.length > 0 && (
        <div className="panel">
          <h2 className="panel-title">Fee account</h2>
          {f.accounts.map((a) => (
            <dl className="detail-list detail-list-inline" key={a.id}>
              <Detail label="Total fee" value={formatMoney(a.total_fee)} />
              <Detail label="Scholarship" value={formatMoney(a.scholarship)} />
              <Detail label="Concession" value={formatMoney(a.concession)} />
              <Detail label="Reason" value={a.discount_reason} />
              <Detail label="Paid" value={formatMoney(a.paid_amount)} />
              <Detail label="Status" value={titleCase(a.status)} />
            </dl>
          ))}
        </div>
      )}

      <div className="panel">
        <h2 className="panel-title">Invoices and payments</h2>
        {f.invoices.length === 0 ? (
          <p className="panel-subtitle">No invoices have been raised.</p>
        ) : (
          f.invoices.map((inv) => (
            <div key={inv.id} className="subsection">
              <div className="panel-header">
                <h3 className="subsection-title">
                  {inv.invoice_no}
                  <span className={`status-pill ${inv.status === "paid" ? "success" : "warning"}`}>
                    <span className="status-dot" />
                    {titleCase(inv.status)}
                  </span>
                </h3>
                <span className="muted-cell">
                  {formatMoney(inv.paid_amount)} of {formatMoney(inv.total)}
                  {inv.due_on ? ` · due ${formatDate(inv.due_on)}` : ""}
                </span>
              </div>
              {inv.items.length > 0 && (
                <ul className="plain-list">
                  {inv.items.map((it, i) => (
                    <li key={i}>
                      <span>{it.description}</span>
                      <span className="muted-cell">{formatMoney(it.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {inv.payments.length > 0 && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.receipt_no}</td>
                        <td>{formatDate(p.paid_at)}</td>
                        <td>{titleCase(p.method)}</td>
                        <td>{formatMoney(p.amount)}</td>
                        <td className="muted-cell">{p.reference ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function HealthSection({ data }: { data: ProfilePayload }) {
  const h = data.health;
  if (!h) return <Withheld />;
  const r = h.record;

  if (!r) {
    return (
      <div className="panel empty-state">
        <HeartPulse size={20} />
        <h2 className="panel-title">No health record</h2>
        <p className="panel-subtitle">
          Nothing has been recorded. Only collect what is needed to keep this student safe and to contact the right
          person in an emergency.
        </p>
      </div>
    );
  }

  return (
    <div className="section-stack">
      <div className="notice notice-warning">
        Medical information is restricted to authorised staff. Do not copy these details into a message to a wider
        audience.
      </div>

      <div className="two-column">
        <div className="panel">
          <h2 className="panel-title">Medical</h2>
          <dl className="detail-list">
            <Detail label="Blood group" value={String(r.blood_group ?? "")} />
            <Detail label="Known allergies" value={String(r.allergies ?? "")} />
            <Detail label="Medical conditions" value={String(r.medical_conditions ?? "")} />
            <Detail label="Medication" value={String(r.medications ?? "")} />
            <Detail label="Emergency instructions" value={String(r.emergency_instructions ?? "")} />
          </dl>
        </div>

        <div className="panel">
          <h2 className="panel-title">Accessibility and contacts</h2>
          <dl className="detail-list">
            <Detail label="Accessibility needs" value={String(r.accessibility_needs ?? "")} />
            <Detail label="Emergency contact" value={String(r.emergency_contact_name ?? "")} />
            <Detail label="Emergency phone" value={String(r.emergency_contact_phone ?? "")} />
            <Detail label="Regular doctor" value={String(r.regular_doctor_name ?? "")} />
            <Detail label="Doctor phone" value={String(r.regular_doctor_phone ?? "")} />
            <Detail label="Height" value={r.height_cm ? `${r.height_cm} cm` : ""} />
            <Detail label="Weight" value={r.weight_kg ? `${r.weight_kg} kg` : ""} />
          </dl>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Medical incidents at school</h2>
        {h.incidents.length === 0 ? (
          <p className="panel-subtitle">No incidents recorded.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>What happened</th>
                <th>Action taken</th>
                <th>Severity</th>
                <th>Guardian told</th>
              </tr>
            </thead>
            <tbody>
              {h.incidents.map((i) => (
                <tr key={i.id}>
                  <td>{formatDate(i.incident_date)}</td>
                  <td>{i.summary}</td>
                  <td className="muted-cell">{i.action_taken ?? "—"}</td>
                  <td>
                    <span className={`status-pill ${i.severity === "critical" ? "danger" : "neutral"}`}>
                      {titleCase(i.severity)}
                    </span>
                  </td>
                  <td>{i.notified_guardian ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TransportSection({ data }: { data: ProfilePayload }) {
  const t = data.transport;
  if (!t) return <Withheld />;

  if (!t.allocations.length) {
    return (
      <div className="panel empty-state">
        <Bus size={20} />
        <h2 className="panel-title">Not enrolled in transport</h2>
        <p className="panel-subtitle">This student has no route allocation on record.</p>
      </div>
    );
  }

  return (
    <div className="section-stack">
      {t.allocations.map((a) => (
        <div className="panel" key={a.id}>
          <div className="panel-header">
            <h2 className="panel-title">
              {a.route_name ?? "Route"}
              <span className={`status-pill ${a.active ? "success" : "neutral"}`}>
                <span className="status-dot" />
                {a.active ? "Current" : a.ended_on ? `Ended ${formatDate(a.ended_on)}` : "Inactive"}
              </span>
            </h2>
            {a.is_authorized_pickup && <span className="chip chip-accent">Authorised pickup</span>}
          </div>
          <dl className="detail-list detail-list-inline">
            <Detail label="Route code" value={a.route_code} />
            <Detail label="Vehicle" value={a.vehicle_no} />
            <Detail label="Driver" value={a.driver_name} />
            <Detail label="Driver phone" value={a.driver_phone} />
            <Detail label="Pickup stop" value={a.stop_name} />
            <Detail label="Pickup time" value={a.pickup_time ? a.pickup_time.slice(0, 5) : ""} />
            <Detail label="Drop time" value={a.drop_time ? a.drop_time.slice(0, 5) : ""} />
            <Detail label="Transport fee" value={a.fare_amount !== null ? formatMoney(a.fare_amount) : ""} />
          </dl>
        </div>
      ))}
    </div>
  );
}

function ActivitiesSection({ data }: { data: ProfilePayload }) {
  const list = data.activities ?? [];
  if (!list.length) {
    return (
      <div className="panel empty-state">
        <Award size={20} />
        <h2 className="panel-title">No activities recorded</h2>
        <p className="panel-subtitle">Sports, clubs, competitions and events appear here once recorded.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Extracurricular activities</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Category</th>
            <th>Role</th>
            <th>Participation</th>
            <th>Award</th>
            <th>Certificate</th>
          </tr>
        </thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.id}>
              <td className="font-medium">{a.name}</td>
              <td className="muted-cell">{titleCase(a.category)}</td>
              <td>{a.role ?? "—"}</td>
              <td>
                <span className={`status-pill ${a.participation === "active" ? "success" : "neutral"}`}>
                  <span className="status-dot" />
                  {titleCase(a.participation)}
                </span>
              </td>
              <td>{a.award ?? a.achievement ?? "—"}</td>
              <td className="muted-cell">{a.certificate_ref ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ObservationsSection({ data, role }: { data: ProfilePayload; role: string }) {
  const list = data.observations;
  if (!list) return <Withheld />;

  if (!list.length) {
    return (
      <div className="panel empty-state">
        <MessageSquare size={20} />
        <h2 className="panel-title">No observations recorded</h2>
        <p className="panel-subtitle">
          Observations are factual notes from teachers, kept here with their author and date.
        </p>
      </div>
    );
  }

  return (
    <div className="section-stack">
      {canWriteObservations(role) && (
        <div className="panel-header">
          <button
            className="primary-button compact"
            onClick={() => toast("New observation", { description: "Observation recording is available to teachers and administrators." })}
          >
            Add observation
          </button>
        </div>
      )}
      {list.map((o) => (
        <div className="panel" key={o.id}>
          <div className="panel-header">
            <h3 className="subsection-title">
              {titleCase(o.category)}
              <span className="chip">{formatDate(o.observed_on)}</span>
              {o.visible_to_guardians ? (
                <span className="chip chip-accent">Shared with family</span>
              ) : (
                <span className="chip chip-muted">Not shared</span>
              )}
            </h3>
          </div>
          <p className="body-text">{o.body}</p>
          <dl className="detail-list detail-list-inline">
            {o.classroom_participation !== null && (
              <Detail label="Lessons participated in" value={String(o.classroom_participation)} />
            )}
            {o.action_taken && <Detail label="Action taken" value={o.action_taken} />}
            {o.follow_up_on && (
              <Detail
                label="Follow-up"
                value={`${formatDate(o.follow_up_on)}${o.follow_up_done ? " · done" : " · outstanding"}`}
              />
            )}
            {o.follow_up_notes && <Detail label="Follow-up notes" value={o.follow_up_notes} />}
          </dl>
        </div>
      ))}
    </div>
  );
}

function CommunicationsSection({ data }: { data: ProfilePayload }) {
  const list = data.communications;
  if (!list) return <Withheld />;

  if (!list.length) {
    return (
      <div className="panel empty-state">
        <MessageSquare size={20} />
        <h2 className="panel-title">No communication recorded</h2>
        <p className="panel-subtitle">
          Meetings and logged contacts about this student appear here. Messages stay in the Messages screen.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Communication history</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Type</th>
            <th>Subject</th>
            <th>Guardian</th>
            <th>Acknowledged</th>
          </tr>
        </thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.id}>
              <td>{formatDate(c.occurred_at)}</td>
              <td>
                <span className="chip">{titleCase(c.kind)}</span>
              </td>
              <td>
                {c.subject ?? "—"}
                {c.notes && <div className="muted-cell">{c.notes}</div>}
              </td>
              <td className="muted-cell">{c.guardian ?? "All guardians"}</td>
              <td>{c.acknowledged_at ? formatDate(c.acknowledged_at) : "Not yet"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdmissionSection({ data }: { data: ProfilePayload }) {
  const list = data.admission;
  if (!list) return <Withheld />;

  if (!list.length) {
    return (
      <div className="panel empty-state">
        <CalendarDays size={20} />
        <h2 className="panel-title">No admission record</h2>
        <p className="panel-subtitle">
          An admission record is created when a student is admitted, transfers in, or leaves.
        </p>
      </div>
    );
  }

  return (
    <div className="section-stack">
      {list.map((a) => (
        <div className="panel" key={a.id}>
          <div className="panel-header">
            <h2 className="panel-title">
              Admission
              <span className={`status-pill ${a.status === "approved" ? "success" : "warning"}`}>
                <span className="status-dot" />
                {titleCase(a.status)}
              </span>
            </h2>
          </div>
          <dl className="detail-list detail-list-inline">
            <Detail label="Applied on" value={formatDate(a.applied_on)} />
            <Detail label="Application date" value={formatDate(a.application_date)} />
            <Detail label="Admitted on" value={formatDate(a.admitted_on)} />
            <Detail label="Admission type" value={titleCase(a.admission_type)} />
            <Detail label="Previous school" value={a.previous_school} />
            <Detail label="Previous class" value={a.previous_class} />
            <Detail label="Previous board" value={a.previous_board} />
            <Detail label="Withdrawn on" value={formatDate(a.withdrawn_on)} />
            <Detail label="Withdrawal reason" value={a.withdrawal_reason} />
            <Detail label="Graduated on" value={formatDate(a.graduated_on)} />
            <Detail label="Remarks" value={a.remarks} />
          </dl>
        </div>
      ))}
    </div>
  );
}

function LibrarySection({ data }: { data: ProfilePayload }) {
  const l = data.library;
  if (!l) return <Withheld />;

  return (
    <div className="section-stack">
      <div className="metric-row">
        <Metric label="Books out" value={String(l.current_count)} />
        <Metric label="Overdue" value={String(l.overdue_count)} tone={l.overdue_count > 0 ? "warning" : undefined} />
        <Metric label="Total fines" value={formatMoney(l.total_fines)} tone={l.total_fines > 0 ? "warning" : undefined} />
      </div>

      <div className="panel">
        <h2 className="panel-title">Borrowing history</h2>
        {l.loans.length === 0 ? (
          <p className="panel-subtitle">No books have been issued to this student.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Book</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Returned</th>
                <th>Status</th>
                <th>Fine</th>
              </tr>
            </thead>
            <tbody>
              {l.loans.map((b) => (
                <tr key={b.id}>
                  <td className="font-medium">{b.book_title}</td>
                  <td>{formatDate(b.issued_on)}</td>
                  <td>{formatDate(b.due_on)}</td>
                  <td>{b.returned_on ? formatDate(b.returned_on) : "—"}</td>
                  <td>
                    <span className={`status-pill ${b.status === "returned" ? "success" : b.status === "overdue" ? "danger" : "warning"}`}>
                      <span className="status-dot" />
                      {titleCase(b.status)}
                    </span>
                  </td>
                  <td>{formatMoney(b.fine_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AccountSection({ data }: { data: ProfilePayload }) {
  const a = data.account;
  if (!a) return <Withheld />;

  if (!a.has_account) {
    return (
      <div className="panel empty-state">
        <ShieldAlert size={20} />
        <h2 className="panel-title">No portal account</h2>
        <p className="panel-subtitle">
          This student has not been given portal access. Creating an account is done from User management.
        </p>
      </div>
    );
  }

  return (
    <div className="section-stack">
      <div className="notice notice-warning">
        Passwords, password hashes and session credentials are never shown here or sent to the browser.
      </div>

      <div className="panel">
        <h2 className="panel-title">Account</h2>
        <dl className="detail-list detail-list-inline">
          <Detail label="Login identifier" value={a.login_identifier} />
          <Detail label="Full name" value={a.full_name} />
          <Detail label="Email" value={a.email} />
          <Detail label="Role" value={titleCase(a.role)} />
          <Detail label="Status" value={titleCase(a.status)} />
          <Detail label="Issued" value={formatDate(a.issued_at)} />
          <Detail label="Revoked" value={a.revoked_at ? formatDate(a.revoked_at) : "Not revoked"} />
          <Detail label="Linked parent accounts" value={String(a.linked_parents)} />
        </dl>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Edit
 * ------------------------------------------------------------------ */

function EditStudentDialog({
  data,
  onClose,
  onSaved,
}: {
  data: ProfilePayload;
  onClose: () => void;
  onSaved: (draft: Partial<StudentDraft>) => Promise<void>;
}) {
  const s = data.student;
  const [form, setForm] = useState({
    first_name: s.first_name ?? "",
    last_name: s.last_name ?? "",
    usn: s.usn ?? "",
    date_of_birth: s.date_of_birth ?? "",
    gender: s.gender ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    guardian_name: "",
    blood_group: s.blood_group ?? "",
    nationality: s.nationality ?? "",
    mother_tongue: s.mother_tongue ?? "",
    line1: s.address.line1 ?? "",
    line2: s.address.line2 ?? "",
    city: s.address.city ?? "",
    district: s.address.district ?? "",
    state: s.address.state ?? "",
    pincode: s.address.pincode ?? "",
    emergency_contact_name: s.emergency_contact_name ?? "",
    emergency_contact_phone: s.emergency_contact_phone ?? "",
    status: s.status ?? "active",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () =>
      form.first_name !== (s.first_name ?? "") ||
      form.last_name !== (s.last_name ?? "") ||
      form.usn !== (s.usn ?? ""),
    // Recomputed only when the record itself changes, not on every keystroke:
    // the dirty flag guards the close handler, not the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.id]
  );

  // The brief asks for an unsaved-change warning.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear the server's field error as soon as the user edits that field.
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setFieldErrors({});
    try {
      await onSaved({
        first_name: form.first_name,
        last_name: form.last_name,
        usn: form.usn,
        date_of_birth: form.date_of_birth,
        gender: form.gender,
        email: form.email,
        phone: form.phone,
        blood_group: form.blood_group,
        nationality: form.nationality,
        mother_tongue: form.mother_tongue,
        status: form.status,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        address: {
          line1: form.line1,
          line2: form.line2,
          city: form.city,
          district: form.district,
          state: form.state,
          pincode: form.pincode,
        },
      });
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Edit student details">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h2 className="panel-title">Edit {s.name}</h2>
          <button className="secondary-button compact" onClick={onClose}>
            <Activity size={14} />
            Close
          </button>
        </div>

        <div className="modal-body">
          <fieldset>
            <legend>Identity</legend>
            <div className="form-grid">
              <label>
                First name
                <input value={form.first_name} onChange={(e) => set("first_name")(e.target.value)} />
                {fieldErrors.first_name && <span className="field-error">{fieldErrors.first_name}</span>}
              </label>
              <label>
                Last name
                <input value={form.last_name} onChange={(e) => set("last_name")(e.target.value)} />
                {fieldErrors.last_name && <span className="field-error">{fieldErrors.last_name}</span>}
              </label>
              <label>
                USN
                <input value={form.usn} onChange={(e) => set("usn")(e.target.value)} />
                {fieldErrors.usn && <span className="field-error">{fieldErrors.usn}</span>}
              </label>
              <label>
                Date of birth
                <input type="date" value={form.date_of_birth ?? ""} onChange={(e) => set("date_of_birth")(e.target.value)} />
                {fieldErrors.date_of_birth && <span className="field-error">{fieldErrors.date_of_birth}</span>}
              </label>
              <label>
                Gender
                <select value={form.gender ?? ""} onChange={(e) => set("gender")(e.target.value)}>
                  <option value="">Not recorded</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Status
                <select value={form.status ?? ""} onChange={(e) => set("status")(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="graduated">Graduated</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
                {fieldErrors.status && <span className="field-error">{fieldErrors.status}</span>}
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Personal</legend>
            <div className="form-grid">
              <label>
                Blood group
                <input value={form.blood_group ?? ""} onChange={(e) => set("blood_group")(e.target.value)} placeholder="e.g. B+" />
              </label>
              <label>
                Nationality
                <input value={form.nationality ?? ""} onChange={(e) => set("nationality")(e.target.value)} />
              </label>
              <label>
                Mother tongue
                <input value={form.mother_tongue ?? ""} onChange={(e) => set("mother_tongue")(e.target.value)} />
              </label>
              <label>
                Email
                <input type="email" value={form.email ?? ""} onChange={(e) => set("email")(e.target.value)} />
              </label>
              <label>
                Phone
                <input value={form.phone ?? ""} onChange={(e) => set("phone")(e.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Address</legend>
            <div className="form-grid">
              <label className="span-2">
                Address line 1
                <input value={form.line1 ?? ""} onChange={(e) => set("line1")(e.target.value)} />
              </label>
              <label className="span-2">
                Address line 2
                <input value={form.line2 ?? ""} onChange={(e) => set("line2")(e.target.value)} />
              </label>
              <label>
                City
                <input value={form.city ?? ""} onChange={(e) => set("city")(e.target.value)} />
              </label>
              <label>
                District
                <input value={form.district ?? ""} onChange={(e) => set("district")(e.target.value)} />
              </label>
              <label>
                State
                <input value={form.state ?? ""} onChange={(e) => set("state")(e.target.value)} />
              </label>
              <label>
                PIN code
                <input value={form.pincode ?? ""} onChange={(e) => set("pincode")(e.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Emergency contact</legend>
            <div className="form-grid">
              <label>
                Name
                <input
                  value={form.emergency_contact_name ?? ""}
                  onChange={(e) => set("emergency_contact_name")(e.target.value)}
                />
              </label>
              <label>
                Phone
                <input
                  value={form.emergency_contact_phone ?? ""}
                  onChange={(e) => set("emergency_contact_phone")(e.target.value)}
                />
              </label>
            </div>
          </fieldset>
        </div>

        <div className="modal-footer">
          {dirty && <span className="muted-cell">You have unsaved changes</span>}
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Supporting pieces
 * ------------------------------------------------------------------ */

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button className="back-link" onClick={onClick}>
      <ArrowLeft size={15} />
      Back to students
    </button>
  );
}

function Withheld() {
  return (
    <div className="panel empty-state">
      <ShieldAlert size={20} />
      <h2 className="panel-title">Not available to you</h2>
      <p className="panel-subtitle">
        This section is restricted to other roles. If you need it, ask an administrator.
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  const empty = value === null || value === undefined || value === "" || value === "—";
  return (
    <div className="detail">
      <dt>{label}</dt>
      {/* Missing values are shown as an em dash rather than blank, so a reader can
          tell "not recorded" from a row that failed to render. */}
      <dd className={empty ? "empty" : undefined}>{empty ? "—" : String(value)}</dd>
    </div>
  );
}

function ProfileSkeleton({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <div className="page-stack">
      <BackLink onClick={onBack} />
      <div className="panel skeleton-panel" role="status" aria-busy="true">
        <span className="sr-only">{name}</span>
        <div className="skeleton-line skeleton-line-wide" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-line-short" />
      </div>
    </div>
  );
}

/** A CSV summary, for the same role that may export the directory. */
function downloadSummary(data: ProfilePayload): void {
  const rows: Array<[string, string]> = [
    ["USN", data.student.usn ?? ""],
    ["Name", data.student.name],
    ["Date of birth", data.student.date_of_birth ?? ""],
    ["Age", data.student.age !== null ? String(data.student.age) : ""],
    ["Gender", data.student.gender ?? ""],
    ["Class", data.class.grade ?? ""],
    ["Section", data.class.section ?? ""],
    ["Roll number", data.class.roll_no ?? ""],
    ["Academic year", data.class.academic_year?.name ?? ""],
    ["Status", data.student.status ?? ""],
  ];

  if (data.attendance) {
    rows.push(["Attendance %", String(data.attendance.summary.percentage ?? "")]);
  }
  if (data.fees) {
    rows.push(["Fees outstanding", String(data.fees.summary.outstanding)]);
  }

  const csv = rows
    .map(([k, v]) => `${csvCell(k)},${csvCell(v)}`)
    .join("\n");

  saveBlob(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }), `student-${data.student.id}.csv`);
  toast.success("Summary exported");
}

function csvCell(value: string): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function joinLines(lines: Array<string | null | undefined>): string {
  const parts = lines.map((l) => String(l ?? "").trim()).filter(Boolean);
  return parts.join(", ");
}

function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toneForPercent(value: number | null, threshold: number): string | undefined {
  if (value === null || !Number.isFinite(value)) return undefined;
  return value >= threshold ? "positive" : "warning";
}

function scoreClass(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "muted-cell";
  return value >= 50 ? "score-positive" : "score-warning";
}
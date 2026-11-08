import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Download,
  FileText,
  Lock,
  Pencil,
  Printer,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useDataRevision } from "@/lib/live-data";
import { useRealtimeInvalidation } from "@/lib/use-realtime";
import { usePageScrollLock } from "@/components/SmoothScroll";
import {
  ApiError,
  archiveStudent,
  deleteStudent,
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
  canManageFees,
  canRecordAttendance,
  canViewFees,
  type StudentSection,
} from "@shared/student-access";
import { DocumentPanel } from "@/components/StudentDocumentPanel";
import { FeePaymentDialog } from "@/components/FeePaymentDialog";
import { ProfilePhotoPicker } from "@/components/ProfilePhotoPicker";
import { RecordUpiPaymentDialog } from "@/components/RecordUpiPaymentDialog";

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
  admission: CalendarDays,
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
  "admission",
  "account",
];

/** One line of context under each section heading. */
const SECTION_BLURBS: Record<StudentSection, string> = {
  personal: "Identity, contact details and the recent record trail.",
  guardians: "Family contacts and who can see this record.",
  academics: "Subjects, examination results and progression.",
  attendance: "Session totals, trends, absences and leave.",
  fees: "Invoices, instalments and payments.",
  documents: "Files held for this student and their verification.",
  admission: "Application, admission and withdrawal history.",
  account: "Sign-in access and linked guardian accounts.",
};

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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dataRevision = useDataRevision();
  // `/api/student-profile` composes the record from these tables; any of them
  // changing elsewhere (fees posted, a mark entered) must refresh this page.
  const realtimeRevision = useRealtimeInvalidation([
    "students",
    "enrollments",
    "classrooms",
    "attendance",
    "exam_results",
    "examinations",
    "invoices",
    "payments",
    "student_guardians",
    "guardians",
    "profiles",
    "staff",
    "subjects",
  ]);
  const hasLoadedRef = useRef(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      setError(null);
      try {
        setData(await fetchStudentProfile(studentId, signal));
        hasLoadedRef.current = true;
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof ApiError ? err.message : "This profile could not be loaded.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [studentId, dataRevision, realtimeRevision],
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

  // Switching sections should start at the top of the new section even when the
  // reader clicked from halfway down the previous one. The page scrolls inside
  // `.main-area`, not the window.
  useEffect(() => {
    document.querySelector<HTMLElement>(".main-area")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  const role = data?.viewer.role ?? "";

  if (loading && !data) {
    return <ProfileSkeleton name="Loading this student's record…" onBack={onBack} />;
  }

  if (error && !data) {
    return (
      <div className="page-stack student-profile-page">
        <ProfileCrumbs name="Student record" onBack={onBack} />
        <div className="panel empty-state profile-empty">
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
  const currentLabel = data.sectionLabels[current] ?? current;

  return (
    <div className="page-stack student-profile-page">
      <ProfileCrumbs name={data.student.name} onBack={onBack} />

      {error && (
        <div className="notice notice-warning" role="status">
          {error} Showing the last record that loaded.
        </div>
      )}

      <div className="student-profile-shell">
        <ProfileRail
          data={data}
          role={role}
          active={current}
          visible={visible}
          withheld={withheld}
          headingRef={headingRef}
          onSelect={setTab}
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
          onDelete={() => setConfirmingDelete(true)}
        />

        <section className="student-profile-main" aria-label={`${data.student.name} record`}>
          <header className="profile-section-heading">
            <div>
              <h2>{currentLabel}</h2>
              <p>{SECTION_BLURBS[current]}</p>
            </div>
          </header>

          <div className="profile-body">
            {current === "personal" && <PersonalSection data={data} />}
            {current === "guardians" && <GuardiansSection data={data} role={role} />}
            {current === "academics" && <AcademicsSection data={data} />}
            {current === "attendance" && <AttendanceSection data={data} />}
            {current === "fees" && data.fees && <FeesSection data={data} onRefresh={load} />}
            {current === "documents" && <DocumentPanel studentId={studentId} studentName={data.student.name} />}
            {current === "admission" && data.admission && <AdmissionSection data={data} />}
            {current === "account" && data.account && <AccountSection data={data} />}
          </div>
        </section>
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

      {confirmingDelete && (
        <ConfirmDeleteDialog
          title={`Delete ${data.student.name}?`}
          description="This permanently removes the pupil, their enrolment, attendance, marks, invoices, documents and portal account. It cannot be undone. Archive instead if they have simply left the school."
          busy={deleting}
          onClose={() => setConfirmingDelete(false)}
          onConfirm={async () => {
            setDeleting(true);
            try {
              await deleteStudent(studentId);
              toast.success("Student deleted", {
                description: "The record and its linked account were removed permanently.",
              });
              onChanged?.();
              onBack();
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : "Could not delete this student.");
            } finally {
              setDeleting(false);
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

function ProfileCrumbs({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <nav className="profile-crumbs" aria-label="Breadcrumb">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to students
      </button>
      <span className="profile-crumb-sep" aria-hidden="true">
        /
      </span>
      <span className="profile-crumb-current" aria-current="page">
        {name}
      </span>
    </nav>
  );
}

function ProfileRail({
  data,
  role,
  active,
  visible,
  withheld,
  headingRef,
  onSelect,
  onEdit,
  onArchive,
  onPrint,
  onDelete,
}: {
  data: ProfilePayload;
  role: string;
  active: StudentSection;
  visible: StudentSection[];
  withheld: StudentSection[];
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onSelect: (section: StudentSection) => void;
  onEdit: () => void;
  onArchive: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) {
  const { student, class: klass } = data;
  const attendance = data.attendance?.summary;
  const fees = data.fees?.summary;
  const average = averageOfSubjects(data.academics?.subject_performance ?? []);
  const mayEdit = canEditStudent(role);

  return (
    <aside className="profile-rail" aria-label={`${student.name} summary`}>
      <div className="profile-rail-identity">
        <div className="profile-rail-avatar">
          {student.photo_url ? (
            <img className="avatar avatar-xl" src={student.photo_url} alt="" />
          ) : (
            <span className="avatar avatar-xl">{initialsFor(student.name)}</span>
          )}
          <span
            className={`profile-presence ${student.status === "active" ? "is-active" : "is-inactive"}`}
            title={titleCase(student.status ?? "unknown")}
          />
        </div>

        <h1 ref={headingRef} className="profile-name" tabIndex={-1}>
          {student.name}
        </h1>
        <p className="profile-usn">{student.usn ?? "No USN"}</p>

        <p className="profile-class">
          {klass.grade ?? "Unassigned"}
          {klass.section ? ` · Section ${klass.section}` : ""}
          {klass.roll_no ? ` · Roll ${klass.roll_no}` : ""}
        </p>
        {klass.academic_year && <p className="profile-year">{klass.academic_year.name}</p>}

        <div className="profile-badges">
          <span className={`status-pill ${student.status === "active" ? "success" : "warning"}`}>
            <span className="status-dot" />
            {titleCase(student.status ?? "unknown")}
          </span>
          <span className={`status-pill ${klass.enrolment_status === "active" ? "success" : "neutral"}`}>
            {klass.enrolment_status === "active" ? "Enrolled" : "Not enrolled"}
          </span>
        </div>
      </div>

      <dl className="profile-rail-stats">
        <div>
          <dt>Attendance</dt>
          <dd className={toneForPercent(attendance?.percentage ?? null, 90)}>
            {formatPercent(attendance?.percentage ?? null)}
          </dd>
          <small>{attendance ? `${attendance.marked_sessions} sessions` : "Not available"}</small>
        </div>
        <div>
          <dt>Average</dt>
          <dd>{formatPercent(average)}</dd>
          <small>
            {data.academics
              ? `${data.academics.subject_performance.length} subjects`
              : "Not available"}
          </small>
        </div>
        {fees && (
          <div>
            <dt>Outstanding</dt>
            <dd className={fees.outstanding > 0 ? "warning" : "positive"}>{formatMoney(fees.outstanding)}</dd>
            <small>{fees.overdue_count > 0 ? `${fees.overdue_count} overdue` : "Nothing overdue"}</small>
          </div>
        )}
        <div>
          <dt>Age</dt>
          <dd>{student.age !== null ? `${student.age}` : "—"}</dd>
          <small>{student.date_of_birth ? `Born ${formatDate(student.date_of_birth)}` : "Not recorded"}</small>
        </div>
      </dl>

      <div className="profile-rail-actions">
        <button className="primary-button" onClick={onEdit} disabled={!mayEdit} title={mayEdit ? undefined : "Only an administrator can edit a student record."}>
          <Pencil size={14} />
          Edit details
        </button>
        <div className="profile-rail-utility">
          <button className="secondary-button compact" onClick={onPrint}>
            <Printer size={14} />
            Print
          </button>
          <button className="secondary-button compact" onClick={() => downloadSummary(data)}>
            <Download size={14} />
            Export
          </button>
          {mayEdit && (
            <button className="secondary-button compact danger" onClick={onArchive}>
              <Archive size={14} />
              Archive
            </button>
          )}
          {role === "super_admin" && (
            <button className="secondary-button compact danger" onClick={onDelete}>
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>
      </div>

      <nav className="profile-section-nav" aria-label="Profile sections">
        {[...visible, ...withheld].map((section) => {
          const Icon = SECTION_ICONS[section] ?? FileText;
          const locked = withheld.indexOf(section) !== -1;
          return (
            <button
              key={section}
              className={`${active === section ? "active" : ""}${locked ? " locked" : ""}`.trim()}
              onClick={() => onSelect(section)}
              disabled={locked}
              aria-current={active === section ? "page" : undefined}
              title={locked ? `You do not have access to ${data.sectionLabels[section] ?? section}` : undefined}
            >
              <Icon size={15} />
              <span>{data.sectionLabels[section] ?? section}</span>
              {locked && <Lock size={12} className="profile-nav-lock" />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/** Mean of the subject averages the server published for this student. */
function averageOfSubjects(subjects: Array<{ average: number | null }>): number | null {
  const marks = subjects
    .map((subject) => subject.average)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (!marks.length) return null;
  return marks.reduce((total, mark) => total + mark, 0) / marks.length;
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
  // City and district are often the same; keep the address from repeating it.
  const locality = [s.address.city, s.address.district].filter(Boolean);
  if (locality.length > 1 && locality[0] === locality[1]) locality.pop();
  const address = [
    [s.address.line1, s.address.line2].filter(Boolean).join(", "),
    locality.join(", "),
    [s.address.state, s.address.pincode].filter(Boolean).join(" "),
    s.address.country,
  ].filter(Boolean);

  return (
    <div className="section-stack">
      <div className="profile-overview-grid">
        <div className="panel profile-panel">
          <div className="profile-panel-head">
            <h2 className="panel-title">Personal details</h2>
            <p>Core record held by the school.</p>
          </div>

          <div className="profile-fact-group">
            <h3>Identity</h3>
            <dl className="fact-grid">
              <Fact label="USN" value={s.usn} mono />
              <Fact label="Full name" value={s.name} />
              <Fact label="Date of birth" value={formatDate(s.date_of_birth)} />
              <Fact label="Age" value={s.age !== null ? `${s.age} years` : null} />
              <Fact label="Gender" value={titleCase(s.gender)} />
              <Fact label="Blood group" value={s.blood_group} />
              <Fact label="Nationality" value={s.nationality} />
              <Fact label="Mother tongue" value={s.mother_tongue} />
              <Fact label="Religion" value={s.religion} />
            </dl>
          </div>

          <div className="profile-fact-group">
            <h3>School</h3>
            <dl className="fact-grid">
              <Fact label="Admission date" value={formatDate(s.joined_on)} />
              <Fact label="Status" value={titleCase(s.status)} />
              <Fact label="Academic year" value={data.class.academic_year?.name} />
              <Fact label="Class" value={data.class.grade} />
              <Fact label="Section" value={data.class.section} />
              <Fact label="Roll number" value={data.class.roll_no} />
              <Fact label="Class teacher" value={data.class.class_teacher?.name} />
              <Fact label="Room" value={data.class.room} />
            </dl>
          </div>
        </div>

        <div className="profile-side-stack">
          <div className="panel profile-panel">
            <div className="profile-panel-head">
              <h2 className="panel-title">Contact</h2>
              <p>How the school reaches the student.</p>
            </div>

            <dl className="profile-contact-list">
              <div>
                <dt>Email</dt>
                <dd>{s.email || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{s.phone || "Not recorded"}</dd>
              </div>
            </dl>

            <div className="profile-address">
              <h3>Address</h3>
              {address.length ? (
                <address>
                  {address.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </address>
              ) : (
                <p className="profile-muted">Not recorded</p>
              )}
            </div>
          </div>

          <div className="panel profile-panel profile-emergency">
            <div className="profile-panel-head">
              <h2 className="panel-title">Emergency contact</h2>
              <p>Used when a guardian must be reached urgently.</p>
            </div>
            <div className="profile-emergency-card">
              <span className="profile-emergency-icon">
                <UserRound size={17} />
              </span>
              <div>
                <strong>{s.emergency_contact_name || "Not recorded"}</strong>
                <span>{s.emergency_contact_phone || "No phone number"}</span>
              </div>
            </div>
          </div>
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

    return out
      .filter((e) => e.when)
      .sort((a, b) => b.when.localeCompare(a.when))
      .slice(0, 12);
  }, [data]);

  return (
    <div className="panel profile-history-panel">
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

function FeesSection({ data, onRefresh }: { data: ProfilePayload; onRefresh: () => void | Promise<void> }) {
  const f = data.fees;
  const [payInvoice, setPayInvoice] = useState<{ id: string; invoiceNo: string; outstanding: number } | null>(null);
  const [recordInvoice, setRecordInvoice] = useState<{ id: string; invoiceNo: string; outstanding: number } | null>(null);
  const mayRecord = canManageFees(data.viewer.role);
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
                {inv.status !== "paid" && inv.total - inv.paid_amount > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      className="secondary-button compact"
                      onClick={() =>
                        setPayInvoice({
                          id: inv.id,
                          invoiceNo: inv.invoice_no,
                          outstanding: inv.total - inv.paid_amount,
                        })
                      }
                    >
                      Pay {formatMoney(inv.total - inv.paid_amount)}
                    </button>
                    {mayRecord && (
                      <button
                        className="secondary-button compact"
                        onClick={() =>
                          setRecordInvoice({
                            id: inv.id,
                            invoiceNo: inv.invoice_no,
                            outstanding: inv.total - inv.paid_amount,
                          })
                        }
                      >
                        Record UPI
                      </button>
                    )}
                  </div>
                )}
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

      <FeePaymentDialog
        open={Boolean(payInvoice)}
        invoiceId={payInvoice?.id ?? null}
        invoiceNo={payInvoice?.invoiceNo ?? ""}
        outstanding={payInvoice?.outstanding ?? 0}
        onOpenChange={(open) => {
          if (!open) setPayInvoice(null);
        }}
        onPaid={async () => {
          await onRefresh();
        }}
      />

      <RecordUpiPaymentDialog
        open={Boolean(recordInvoice)}
        invoiceId={recordInvoice?.id ?? null}
        invoiceNo={recordInvoice?.invoiceNo ?? ""}
        outstanding={recordInvoice?.outstanding ?? 0}
        onOpenChange={(open) => {
          if (!open) setRecordInvoice(null);
        }}
        onRecorded={async () => {
          await onRefresh();
        }}
      />
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
          {/* The USN is the sign-in username for pupils. Showing both as separate
              fields implied two identifiers where the school only has one. */}
          <Detail label="USN" value={data.student.usn ?? a.login_identifier} />
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
  usePageScrollLock();
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
    photo_url: s.photo_url ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () =>
      form.first_name !== (s.first_name ?? "") ||
      form.last_name !== (s.last_name ?? "") ||
      form.usn !== (s.usn ?? "") ||
      form.photo_url !== (s.photo_url ?? ""),
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
        ...(form.photo_url !== (s.photo_url ?? "")
          ? { photo_url: form.photo_url }
          : {}),
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
            <X size={14} />
            Close
          </button>
        </div>

        <div className="modal-body">
          <ProfilePhotoPicker
            name={[form.first_name, form.last_name].filter(Boolean).join(" ") || s.name}
            photoUrl={form.photo_url || null}
            folder={`student-avatars/${s.id}`}
            onChange={(url) => set("photo_url")(url ?? "")}
          />

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

function Fact({
  label,
  value,
  mono = false,
  wide = false,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  wide?: boolean;
}) {
  const empty = value === null || value === undefined || value === "" || value === "—";
  return (
    <div className={`fact${wide ? " fact-wide" : ""}`}>
      <dt>{label}</dt>
      <dd className={`${empty ? "empty" : ""}${mono ? " mono" : ""}`.trim() || undefined}>
        {empty ? "Not recorded" : String(value)}
      </dd>
    </div>
  );
}

function ProfileSkeleton({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <div className="page-stack student-profile-page">
      <ProfileCrumbs name="Student record" onBack={onBack} />
      <div className="student-profile-shell">
        <aside className="profile-rail profile-rail-skeleton" aria-hidden="true">
          <div className="skeleton-avatar" />
          <div className="skeleton-line skeleton-line-wide" />
          <div className="skeleton-line skeleton-line-short" />
          <div className="skeleton-line" />
        </aside>
        <div className="panel skeleton-panel" role="status" aria-busy="true">
          <span className="sr-only">{name}</span>
          <div className="skeleton-line skeleton-line-wide" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line-short" />
        </div>
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
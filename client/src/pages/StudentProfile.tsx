import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  GraduationCap,
  Layers,
  Lock,
  Pencil,
  Printer,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
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
    "student_documents",
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

export interface GradeTier {
  grade: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  badgeClass: string;
}

export function getGradeTier(percentage: number | null): GradeTier {
  if (percentage === null || !Number.isFinite(percentage)) {
    return {
      grade: "—",
      label: "Awaiting Assessment",
      color: "var(--text-muted)",
      bg: "var(--bg-raised)",
      border: "var(--border-subtle)",
      badgeClass: "neutral",
    };
  }
  if (percentage >= 90) {
    return {
      grade: "A1",
      label: "High Distinction",
      color: "#10b981",
      bg: "rgba(16, 185, 129, 0.12)",
      border: "rgba(16, 185, 129, 0.28)",
      badgeClass: "success",
    };
  }
  if (percentage >= 80) {
    return {
      grade: "A2",
      label: "Distinction",
      color: "#0ea5e9",
      bg: "rgba(14, 165, 233, 0.12)",
      border: "rgba(14, 165, 233, 0.28)",
      badgeClass: "brand",
    };
  }
  if (percentage >= 70) {
    return {
      grade: "B1",
      label: "First Class",
      color: "#6366f1",
      bg: "rgba(99, 102, 241, 0.12)",
      border: "rgba(99, 102, 241, 0.28)",
      badgeClass: "brand",
    };
  }
  if (percentage >= 60) {
    return {
      grade: "B2",
      label: "First Class",
      color: "#8b5cf6",
      bg: "rgba(139, 92, 246, 0.12)",
      border: "rgba(139, 92, 246, 0.28)",
      badgeClass: "neutral",
    };
  }
  if (percentage >= 50) {
    return {
      grade: "C1",
      label: "Second Class",
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.12)",
      border: "rgba(245, 158, 11, 0.28)",
      badgeClass: "warning",
    };
  }
  if (percentage >= 40) {
    return {
      grade: "C2",
      label: "Passing Grade",
      color: "#ea580c",
      bg: "rgba(234, 88, 12, 0.12)",
      border: "rgba(234, 88, 12, 0.28)",
      badgeClass: "warning",
    };
  }
  return {
    grade: "D/E",
    label: "Remedial Focus Required",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.12)",
    border: "rgba(239, 68, 68, 0.28)",
    badgeClass: "danger",
  };
}

export function getPaperStatus(percentage: number | null) {
  if (percentage === null || !Number.isFinite(percentage)) {
    return { text: "Pending", tone: "neutral" };
  }
  if (percentage >= 85) {
    return { text: "Distinction", tone: "success" };
  }
  if (percentage >= 40) {
    return { text: "Passed", tone: "neutral" };
  }
  return { text: "Needs Retest", tone: "danger" };
}

function AcademicsSection({ data }: { data: ProfilePayload }) {
  const academics = data.academics;
  if (!academics) {
    return <Withheld />;
  }

  const [selectedExamId, setSelectedExamId] = useState<string | "all">("all");
  const [subjectSort, setSubjectSort] = useState<"average_desc" | "name_asc">("average_desc");

  // Published examination records
  const publishedExams = useMemo(() => {
    return (academics.results ?? []).filter((r) => r.published);
  }, [academics.results]);

  // Overall cumulative academic average
  const overallAverage = useMemo(() => {
    const fromSubjects = averageOfSubjects(academics.subject_performance ?? []);
    if (fromSubjects !== null) return fromSubjects;

    const validExamPcts = publishedExams
      .map((e) => e.percentage)
      .filter((p): p is number => p !== null && Number.isFinite(p));
    if (validExamPcts.length > 0) {
      return validExamPcts.reduce((sum, p) => sum + p, 0) / validExamPcts.length;
    }

    return null;
  }, [academics.subject_performance, publishedExams]);

  // Latest published exam & trend delta vs previous exam
  const latestExam = publishedExams[publishedExams.length - 1] ?? publishedExams[0] ?? null;
  const previousExam = publishedExams.length >= 2 ? publishedExams[publishedExams.length - 2] : null;
  const examDelta =
    latestExam?.percentage != null && previousExam?.percentage != null
      ? Math.round((latestExam.percentage - previousExam.percentage) * 10) / 10
      : null;

  // Sorted subject performance
  const sortedSubjects = useMemo(() => {
    const list = [...(academics.subject_performance ?? [])];
    if (subjectSort === "average_desc") {
      return list.sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
    }
    return list.sort((a, b) => a.subject.localeCompare(b.subject));
  }, [academics.subject_performance, subjectSort]);

  // Best & weakest subjects (with valid scores)
  const scoredSubjects = sortedSubjects.filter((s) => s.average !== null && Number.isFinite(s.average));
  const best = scoredSubjects[0] ?? null;
  const weakest = scoredSubjects.length > 1 ? scoredSubjects[scoredSubjects.length - 1] : null;

  // Passing vs needing support count
  const passingSubjectsCount = scoredSubjects.filter((s) => (s.average ?? 0) >= 40).length;
  const needsSupportCount = scoredSubjects.filter((s) => (s.average ?? 0) < 50).length;

  // Overall grade tier
  const overallTier = getGradeTier(overallAverage);

  // Filtered exams list
  const filteredExams = useMemo(() => {
    if (selectedExamId === "all") return academics.results ?? [];
    return (academics.results ?? []).filter((e) => e.examination_id === selectedExamId);
  }, [academics.results, selectedExamId]);

  return (
    <div className="section-stack">
      {/* 1. Academic KPI Metrics Row */}
      <div className="metric-row">
        <Metric
          label="Cumulative Average"
          value={overallAverage !== null ? formatPercent(overallAverage) : "No data"}
          note={overallAverage !== null ? `Grade ${overallTier.grade} · ${overallTier.label.split(" · ")[0]}` : "Awaiting evaluations"}
          tone={overallAverage !== null && overallAverage >= 75 ? "good" : overallAverage !== null && overallAverage >= 50 ? "neutral" : overallAverage !== null ? "warning" : undefined}
        />
        <Metric
          label="Latest Examination"
          value={latestExam && latestExam.percentage !== null ? formatPercent(latestExam.percentage) : "Pending"}
          note={
            latestExam
              ? `${latestExam.name}${examDelta !== null ? ` (${examDelta >= 0 ? `+${examDelta}%` : `${examDelta}%`} vs prev)` : ""}`
              : "Results in review"
          }
          tone={latestExam && (latestExam.percentage ?? 0) >= 75 ? "good" : undefined}
        />
        <Metric
          label="Strongest Subject"
          value={best ? best.subject : "—"}
          note={best && best.average !== null ? `${formatPercent(best.average)} historical average` : "No scored subjects"}
          tone="good"
        />
        <Metric
          label="Curriculum Standing"
          value={`${academics.subjects.length} Subjects`}
          note={
            scoredSubjects.length > 0
              ? `${passingSubjectsCount}/${scoredSubjects.length} passing (≥40%)`
              : "Registered curriculum"
          }
          tone={needsSupportCount > 0 ? "warning" : "good"}
        />
      </div>

      {/* 2. Key Academic Insights Callout Banner */}
      {(best || needsSupportCount > 0) && (
        <div
          className="panel"
          style={{
            padding: "16px 20px",
            background: "var(--bg-raised)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "14px",
          }}
        >
          {best && best.average !== null && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "var(--success)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Award size={18} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Key Strength: {best.subject}
                  </span>
                  <span className="status-pill success" style={{ fontSize: "10.5px", padding: "1px 6px" }}>
                    {formatPercent(best.average)}
                  </span>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "3px 0 0" }}>
                  Demonstrates strong conceptual grasp and consistent marks across {best.papers} examination paper{best.papers === 1 ? "" : "s"}.
                </p>
              </div>
            </div>
          )}

          {weakest && weakest.subject !== best?.subject && (weakest.average ?? 0) < 65 && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "var(--warning)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Target size={18} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Growth Focus: {weakest.subject}
                  </span>
                  <span className="status-pill warning" style={{ fontSize: "10.5px", padding: "1px 6px" }}>
                    {formatPercent(weakest.average)}
                  </span>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "3px 0 0" }}>
                  Targeted review and teacher guidance recommended before upcoming term assessments.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Two-Column: Subject Mastery Breakdown & Curriculum Allocation */}
      <div className="two-column">
        {/* Left: Subject Mastery Breakdown */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Subject Mastery & Benchmarks</h2>
              <p className="panel-subtitle">
                Longitudinal averages across all scored examination papers.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                className={`secondary-button compact ${subjectSort === "average_desc" ? "active" : ""}`}
                style={{ fontSize: "11px", padding: "3px 8px" }}
                onClick={() => setSubjectSort("average_desc")}
                title="Sort by highest score"
              >
                Highest
              </button>
              <button
                type="button"
                className={`secondary-button compact ${subjectSort === "name_asc" ? "active" : ""}`}
                style={{ fontSize: "11px", padding: "3px 8px" }}
                onClick={() => setSubjectSort("name_asc")}
                title="Sort alphabetically"
              >
                A–Z
              </button>
            </div>
          </div>

          {sortedSubjects.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={24} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
              <p className="panel-subtitle">No published examination results yet for this student.</p>
            </div>
          ) : (
            <div style={{ padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {sortedSubjects.map((s) => {
                const pct = Math.max(0, Math.min(100, Number(s.average ?? 0)));
                const tier = getGradeTier(s.average);
                const teacherMatch = academics.subjects.find(
                  (sub) => sub.subject.toLowerCase() === s.subject.toLowerCase()
                );

                return (
                  <div key={s.subject} style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {s.subject}
                        </span>
                        {teacherMatch?.code && (
                          <span
                            style={{
                              fontSize: "11px",
                              fontFamily: "monospace",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              background: "var(--bg-raised)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {teacherMatch.code}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          className={`status-pill ${tier.badgeClass}`}
                          style={{ fontSize: "11px", padding: "1px 7px", fontWeight: 700 }}
                        >
                          {tier.grade}
                        </span>
                        <span style={{ fontSize: "13.5px", fontWeight: 700, color: tier.color, minWidth: "48px", textAlign: "right" }}>
                          {formatPercent(s.average)}
                        </span>
                      </div>
                    </div>

                    <div
                      className="progress-bar"
                      style={{
                        height: "7px",
                        borderRadius: "999px",
                        background: "var(--bg-raised)",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${pct}%`,
                          background: tier.color,
                          borderRadius: "999px",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11.5px", color: "var(--text-muted)" }}>
                      <span>{teacherMatch?.teacher ? `Faculty: ${teacherMatch.teacher}` : `${s.papers} paper(s) assessed`}</span>
                      <span>{tier.label.split(" · ")[0]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Enrolled Curriculum & Faculty Allocation */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Curriculum & Faculty Allocation</h2>
              <p className="panel-subtitle">
                Registered courses and subject teachers for Grade {data.class.grade ?? "—"} {data.class.section ? `· Sec ${data.class.section}` : ""}.
              </p>
            </div>
            <span className="count-badge">
              {academics.subjects.length} Courses
            </span>
          </div>

          {academics.subjects.length === 0 ? (
            <div className="empty-state">
              <GraduationCap size={24} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
              <p className="panel-subtitle">No subject assignments recorded for this class.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Code</th>
                    <th>Assigned Faculty</th>
                    <th style={{ textAlign: "right" }}>Standing</th>
                  </tr>
                </thead>
                <tbody>
                  {academics.subjects.map((s) => {
                    const perf = academics.subject_performance.find(
                      (p) => p.subject.toLowerCase() === s.subject.toLowerCase()
                    );
                    const tier = getGradeTier(perf?.average ?? null);

                    return (
                      <tr key={s.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "7px",
                                background: "var(--bg-raised)",
                                color: "var(--brand)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {s.subject.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="font-medium text-[var(--text-primary)]">
                              {s.subject}
                            </span>
                          </div>
                        </td>
                        <td className="muted-cell" style={{ fontFamily: "monospace", fontSize: "11.5px" }}>
                          {s.code ?? "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span className="avatar" style={{ width: "22px", height: "22px", fontSize: "10px" }}>
                              {initialsFor(s.teacher ?? "Teacher")}
                            </span>
                            <span style={{ fontSize: "12.5px" }}>
                              {s.teacher ?? "Unassigned"}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {perf?.average !== null && perf?.average !== undefined ? (
                            <span className={`status-pill ${tier.badgeClass}`} style={{ fontSize: "11px", padding: "2px 7px" }}>
                              {tier.grade} ({formatPercent(perf.average)})
                            </span>
                          ) : (
                            <span className="muted-cell" style={{ fontSize: "11.5px" }}>Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 4. Full Examination Results Hub */}
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 className="panel-title">Examination Results & Performance Ledgers</h2>
            <p className="panel-subtitle">
              Term-wise scorecards, marks obtained, percentage, and letter grades.
            </p>
          </div>

          {academics.results.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`secondary-button compact ${selectedExamId === "all" ? "active" : ""}`}
                style={{ fontSize: "12px" }}
                onClick={() => setSelectedExamId("all")}
              >
                All Terms ({academics.results.length})
              </button>
              {academics.results.map((e) => (
                <button
                  key={e.examination_id}
                  type="button"
                  className={`secondary-button compact ${selectedExamId === e.examination_id ? "active" : ""}`}
                  style={{ fontSize: "12px" }}
                  onClick={() => setSelectedExamId(e.examination_id)}
                >
                  {e.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {academics.results.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 20px" }}>
            <GraduationCap size={32} style={{ color: "var(--text-muted)", margin: "0 auto 10px" }} />
            <p className="panel-title" style={{ fontSize: "15px", margin: 0 }}>No Examination Results Recorded</p>
            <p className="panel-subtitle" style={{ maxWidth: "440px", margin: "6px auto 0" }}>
              Examination results and term report cards will appear here once examination evaluations are completed and published.
            </p>
          </div>
        ) : (
          <div style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: "24px" }}>
            {filteredExams.map((exam) => {
              const tier = getGradeTier(exam.percentage);
              const hasPapers = (exam.papers ?? []).length > 0;
              const passingPapers = (exam.papers ?? []).filter((p) => (p.percentage ?? 0) >= 40).length;

              return (
                <div
                  key={exam.examination_id}
                  style={{
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    overflow: "hidden",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* Exam Header */}
                  <div
                    style={{
                      padding: "16px 20px",
                      background: "var(--bg-raised)",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                          {exam.name}
                        </h3>
                        {exam.published ? (
                          <span className="status-pill success" style={{ fontSize: "11px", padding: "2px 7px" }}>
                            <CheckCircle2 size={11} /> Published
                          </span>
                        ) : (
                          <span className="status-pill warning" style={{ fontSize: "11px", padding: "2px 7px" }}>
                            <AlertCircle size={11} /> Marks in Review
                          </span>
                        )}
                        {exam.starts_on && (
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            · {formatDate(exam.starts_on)}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0" }}>
                        {hasPapers
                          ? `${exam.papers.length} Papers evaluated · ${passingPapers} Passed`
                          : "No evaluated papers in this term"}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "6px", justifyContent: "flex-end" }}>
                          <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Aggregate:</span>
                          <strong style={{ fontSize: "15px", color: "var(--text-primary)" }}>
                            {exam.total_marks} / {exam.max_marks}
                          </strong>
                        </div>
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                          Status: {tier.label.split(" · ")[0]}
                        </span>
                      </div>

                      <div
                        style={{
                          padding: "8px 14px",
                          borderRadius: "10px",
                          background: tier.bg,
                          border: `1px solid ${tier.border}`,
                          textAlign: "center",
                        }}
                      >
                        <span style={{ fontSize: "18px", fontWeight: 800, color: tier.color, display: "block", lineHeight: 1.1 }}>
                          {formatPercent(exam.percentage)}
                        </span>
                        <span style={{ fontSize: "10.5px", fontWeight: 700, color: tier.color, textTransform: "uppercase" }}>
                          Grade {tier.grade}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Papers Data Table */}
                  <div className="table-scroll">
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: "40px" }}>#</th>
                          <th>Subject Paper</th>
                          <th style={{ width: "120px" }}>Marks Obtained</th>
                          <th style={{ width: "100px" }}>Max Marks</th>
                          <th style={{ minWidth: "160px" }}>Score Gauge</th>
                          <th style={{ width: "80px", textAlign: "right" }}>%</th>
                          <th style={{ width: "90px", textAlign: "center" }}>Grade</th>
                          <th style={{ width: "120px", textAlign: "right" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!hasPapers ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: "center", padding: "24px" }}>
                              <span className="muted-cell">No subject paper marks recorded for this examination.</span>
                            </td>
                          </tr>
                        ) : (
                          exam.papers.map((p, idx) => {
                            const pct = p.percentage ?? (p.max_marks > 0 ? Math.round((p.marks / p.max_marks) * 1000) / 10 : 0);
                            const paperTier = getGradeTier(pct);
                            const paperStatus = getPaperStatus(pct);

                            return (
                              <tr key={`${p.subject}-${idx}`}>
                                <td className="muted-cell" style={{ fontSize: "12px" }}>
                                  {idx + 1}
                                </td>
                                <td>
                                  <span className="font-medium text-[var(--text-primary)]">
                                    {p.subject}
                                  </span>
                                </td>
                                <td>
                                  <strong style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>
                                    {p.marks}
                                  </strong>
                                </td>
                                <td className="muted-cell">
                                  {p.max_marks}
                                </td>
                                <td>
                                  <div className="progress-bar" style={{ height: "6px", borderRadius: "999px", background: "var(--bg-raised)" }}>
                                    <span
                                      style={{
                                        display: "block",
                                        height: "100%",
                                        width: `${Math.max(0, Math.min(100, pct))}%`,
                                        background: paperTier.color,
                                        borderRadius: "999px",
                                      }}
                                    />
                                  </div>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <span style={{ fontWeight: 600, color: paperTier.color }}>
                                    {formatPercent(pct)}
                                  </span>
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  <span
                                    className={`status-pill ${paperTier.badgeClass}`}
                                    style={{ fontSize: "11px", padding: "1px 7px", fontWeight: 700 }}
                                  >
                                    {p.grade ?? paperTier.grade}
                                  </span>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <span
                                    className={`status-pill ${paperStatus.tone}`}
                                    style={{ fontSize: "10.5px", padding: "1px 7px" }}
                                  >
                                    {paperStatus.text}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Two-Column: Academic Progression History & Grading Scale Reference */}
      <div className="two-column">
        {/* Left: Class Progression & Enrollment History */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Class & Promotion History</h2>
              <p className="panel-subtitle">
                Longitudinal record across academic years.
              </p>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Academic Year</th>
                  <th>Class & Section</th>
                  <th>Roll No</th>
                  <th>Enrolled On</th>
                  <th style={{ textAlign: "right" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(academics.enrollment_history ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "24px" }}>
                      <span className="muted-cell">No prior enrollment history on file.</span>
                    </td>
                  </tr>
                ) : (
                  academics.enrollment_history.map((e) => (
                    <tr key={e.id}>
                      <td className="font-medium text-[var(--text-primary)]">
                        {e.academic_year ?? "Current Year"}
                      </td>
                      <td>
                        Grade {e.grade ?? "—"}{e.section ? ` · Sec ${e.section}` : ""}
                      </td>
                      <td className="muted-cell" style={{ fontFamily: "monospace" }}>
                        {e.roll_no ? `#${e.roll_no}` : "—"}
                      </td>
                      <td className="muted-cell">
                        {formatDate(e.enrolled_on)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          className={`status-pill ${e.active ? "success" : "neutral"}`}
                          style={{ fontSize: "11px", padding: "2px 7px" }}
                        >
                          {e.active ? "Current" : "Completed"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Institutional Grading Scale Reference */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Grading Scale & Assessment Standards</h2>
              <p className="panel-subtitle">
                Institutional benchmark criteria and grade descriptors.
              </p>
            </div>
          </div>

          <div style={{ padding: "12px 20px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { grade: "A1", range: "90% – 100%", title: "High Distinction", note: "Outstanding mastery & conceptual depth", tone: "success" },
              { grade: "A2", range: "80% – 89%", title: "Distinction", note: "Excellent academic execution", tone: "brand" },
              { grade: "B1", range: "70% – 79%", title: "First Class", note: "Very good understanding across subjects", tone: "brand" },
              { grade: "B2", range: "60% – 69%", title: "First Class", note: "Above average academic competence", tone: "neutral" },
              { grade: "C1 / C2", range: "40% – 59%", title: "Passing Grade", note: "Meets standard graduation requirements", tone: "warning" },
              { grade: "D / E", range: "Below 40%", title: "Needs Support", note: "Remedial tutorials & reassessment scheduled", tone: "danger" },
            ].map((tier) => (
              <div
                key={tier.grade}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  borderRadius: "8px",
                  background: "var(--bg-raised)",
                  fontSize: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className={`status-pill ${tier.tone}`} style={{ fontSize: "11px", fontWeight: 700, padding: "1px 6px", minWidth: "32px", textAlign: "center" }}>
                    {tier.grade}
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{tier.title}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>({tier.note})</span>
                </div>
                <span style={{ fontFamily: "monospace", fontSize: "11.5px", color: "var(--text-secondary)", fontWeight: 600 }}>
                  {tier.range}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
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
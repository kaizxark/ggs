import { useState, useMemo, useEffect } from "react";
import {
  BookOpen,
  Users,
  ClipboardList,
  BarChart3,
  CalendarDays,
  Plus,
  Trash2,
  Search,
  X,
  Clock,
  GraduationCap,
} from "lucide-react";

import { Breadcrumb } from "./Breadcrumb";
import { TimetableView } from "./TimetableView";
import { MetricBlock } from "./MetricBlock";
import { SegmentedControl } from "./SegmentedControl";
import { FormSelect } from "./FormSelect";
import { toast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";
import { notifyDataChanged } from "@/lib/live-data";
import {
  useCurrentUser,
  useSubjectsView,
  useTeachingAllocationsView,
  useAssignmentsView,
  useGradeOutcomesView,
  useStaffView,
  useClassroomsView,
  type ClassroomRow,
} from "@/lib/erp-views";
import { isSuperAdminId } from "@shared/super-admin";

export interface AcademicsViewProps {
  onBack: () => void;
}

type AcademicsTab = "curriculum" | "allocation" | "homework" | "performance" | "timetable";

/**
 * The organisation the signed-in staff member belongs to. Academic tables have
 * no column default, so inserts carry it explicitly — same approach as the
 * attendance writes in `lib/attendance.ts`.
 */
function useOrganisationId(): string | null {
  const [orgId, setOrgId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (!userId) return;
      void supabase
        .from("profiles")
        .select("organisation_id")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (!cancelled) {
            setOrgId(profile?.organisation_id ? String(profile.organisation_id) : null);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return orgId;
}

function duePill(dueAt: string | null): { label: string; cls: string } | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return null;
  const now = Date.now();
  const day = 86_400_000;
  const diff = due - now;
  if (diff < -day * 1.5) return { label: "Past due", cls: "status-pill danger" };
  if (diff < 0) return { label: "Due today", cls: "status-pill warning" };
  if (diff < day * 3) return { label: "Due soon", cls: "status-pill brand" };
  return { label: "Upcoming", cls: "status-pill neutral" };
}

function formatDue(dueAt: string | null): string {
  if (!dueAt) return "No due date";
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return (
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    ", " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

/** Shared modal shell — scrim, blur dialog, header with close. */
function ModalShell({
  title,
  eyebrow,
  onClose,
  ariaLabel,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        style={{
          width: "min(520px, 94vw)",
          maxHeight: "min(720px, 92vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg-panel)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-dialog)",
        }}
      >
        <div className="modal-header">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand)]">
              {eyebrow}
            </span>
            <h2 className="panel-title" style={{ margin: "2px 0 0", fontSize: 18 }}>
              {title}
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* =========================================================================
   TAB 1 — CURRICULUM: the subject catalog
   ========================================================================= */

function CurriculumTab({
  subjects,
  isManager,
  onAdd,
  onDelete,
}: {
  subjects: ReturnType<typeof useSubjectsView>["rows"];
  isManager: boolean;
  onAdd: () => void;
  onDelete: (subject: { id: string | number; name: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const norm = query.trim().toLowerCase();
    if (!norm) return subjects;
    return subjects.filter((s) =>
      `${s.name} ${s.code ?? ""} ${s.teacher ?? ""}`.toLowerCase().includes(norm),
    );
  }, [subjects, query]);

  return (
    <section className="panel table-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Subject catalog</h2>
          <p className="panel-subtitle">
            What the school teaches — pulled straight from the subject catalog. Average score is
            real, from recorded exam marks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="search"
              placeholder="Search subjects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-input)] py-2 text-[13px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--brand)]"
              style={{ width: 200, paddingLeft: 26, paddingRight: 10 }}
            />
          </div>
          {isManager && (
            <button
              type="button"
              className="secondary-button"
              onClick={onAdd}
              style={{ whiteSpace: "nowrap" }}
            >
              <Plus size={14} />
              <span>Add subject</span>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: "44px 22px" }}>
          <BookOpen size={24} />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {subjects.length === 0
              ? "The subject catalog is empty"
              : "No subjects match your search"}
          </p>
          <p className="mt-1 max-w-md text-center text-xs text-[var(--text-muted)]">
            {subjects.length === 0
              ? isManager
                ? "Build the curriculum by adding the subjects your school teaches."
                : "Subjects will appear here once the office builds the curriculum."
              : "Try a different name, code or teacher."}
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 780 }}>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Teachers</th>
                <th>Classes</th>
                <th>Average score</th>
                <th>Basis</th>
                <th>Status</th>
                {isManager && <th className="text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-[var(--text-primary)]">
                    {s.name}
                    {s.code && (
                      <span className="grade-chip" style={{ marginLeft: 8 }}>
                        {s.code}
                      </span>
                    )}
                  </td>
                  <td>{s.teacher ?? <span className="muted-cell">Unassigned</span>}</td>
                  <td>
                    {s.classList.length > 0 ? (
                      <span className="grade-chip">{s.classList.join(", ")}</span>
                    ) : (
                      <span className="muted-cell">—</span>
                    )}
                  </td>
                  <td>
                    {s.results > 0 ? (
                      <strong>{s.progress}%</strong>
                    ) : (
                      <span className="muted-cell">No marks yet</span>
                    )}
                  </td>
                  <td className="muted-cell">
                    {s.results > 0 ? `${s.results} result${s.results === 1 ? "" : "s"}` : "—"}
                  </td>
                  <td>
                    <span
                      className={
                        s.active ? "status-pill success" : "status-pill neutral"
                      }
                    >
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {isManager && (
                    <td className="text-right">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove ${s.name}`}
                        onClick={() => onDelete(s)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AddSubjectModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (values: { name: string; code: string; description: string }) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const ok = await onSubmit({ name, code, description });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <ModalShell
      title="Add Subject to Catalog"
      eyebrow="Curriculum"
      onClose={onClose}
      ariaLabel="Add subject"
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          <div className="form-grid">
            <label style={{ gridColumn: "span 2" }}>
              Subject name *
              <input
                type="text"
                placeholder="e.g. Mathematics"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </label>
            <label>
              Code
              <input
                type="text"
                placeholder="e.g. MAT"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <label style={{ gridColumn: "span 2" }}>
              Description
              <input
                type="text"
                placeholder="Optional — what this subject covers"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Subjects start active. Classes and teachers are assigned next, in the Faculty allocation
            tab.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Adding…" : "Add subject"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* =========================================================================
   TAB 2 — FACULTY ALLOCATION: who teaches what, where
   ========================================================================= */

function AllocationTab({
  subjects,
  staffList,
  classrooms,
  allocations,
  isManager,
  onAssign,
  onUnassign,
}: {
  subjects: ReturnType<typeof useSubjectsView>["rows"];
  staffList: ReturnType<typeof useStaffView>["rows"];
  classrooms: ClassroomRow[];
  allocations: ReturnType<typeof useTeachingAllocationsView>["rows"];
  isManager: boolean;
  onAssign: () => void;
  onUnassign: (allocation: { id: string; subjectName: string; classroomLabel: string }) => void;
}) {
  const filtered = useMemo(
    () =>
      [...allocations].sort(
        (a, b) =>
          a.subjectName.localeCompare(b.subjectName) ||
          a.classroomLabel.localeCompare(b.classroomLabel),
      ),
    [allocations],
  );

  return (
    <section className="panel table-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Teaching allocations</h2>
          <p className="panel-subtitle">
            Every row is a teacher assigned to a subject in one class — saved once and visible to
            staff, timetables and parents immediately.
          </p>
        </div>
        {isManager && (
          <button
            type="button"
            className="secondary-button"
            onClick={onAssign}
            disabled={subjects.length === 0 || classrooms.length === 0}
            style={{ whiteSpace: "nowrap" }}
          >
            <Plus size={14} />
            <span>Assign teacher</span>
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: "44px 22px" }}>
          <Users size={24} />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            No teaching allocations yet
          </p>
          <p className="mt-1 max-w-md text-center text-xs text-[var(--text-muted)]">
            {isManager
              ? subjects.length === 0
                ? "Add subjects to the catalog first — the assignments below then connect teachers and classes."
                : "Connect a teacher to a subject and class so timetables and homework know who to ask."
              : "Allocations will appear here once the office assigns teachers."}
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 680 }}>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Teacher</th>
                <th>Class</th>
                <th>Role</th>
                {isManager && <th className="text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium text-[var(--text-primary)]">{a.subjectName}</td>
                  <td>
                    {a.staffName ?? (
                      <span className="muted-cell">
                        {a.staffId ? "Removed staff account" : "Unassigned"}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="grade-chip">{a.classroomLabel}</span>
                  </td>
                  <td>
                    <span className={a.isPrimary ? "status-pill brand" : "status-pill neutral"}>
                      {a.isPrimary ? "Primary" : "Support"}
                    </span>
                  </td>
                  {isManager && (
                    <td className="text-right">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Unassign ${a.subjectName} from ${a.classroomLabel}`}
                        onClick={() => onUnassign(a)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AssignTeacherModal({
  subjects,
  staffList,
  classrooms,
  allocations,
  onClose,
  onSubmit,
}: {
  subjects: ReturnType<typeof useSubjectsView>["rows"];
  staffList: ReturnType<typeof useStaffView>["rows"];
  classrooms: ClassroomRow[];
  allocations: ReturnType<typeof useTeachingAllocationsView>["rows"];
  onClose: () => void;
  onSubmit: (values: {
    subjectId: string;
    staffId: string;
    classroomId: string;
    isPrimary: boolean;
  }) => Promise<boolean>;
}) {
  const [subjectId, setSubjectId] = useState(subjects.length > 0 ? String(subjects[0].id) : "");
  const [staffId, setStaffId] = useState(staffList.length > 0 ? String(staffList[0].id) : "");
  const [classroomId, setClassroomId] = useState(classrooms[0]?.id ?? "");
  const [isPrimary, setIsPrimary] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const ok = await onSubmit({ subjectId, staffId, classroomId, isPrimary });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <ModalShell
      title="Assign Teacher to Subject"
      eyebrow="Faculty allocation"
      onClose={onClose}
      ariaLabel="Assign teacher"
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          <div className="form-grid">
            <label>
              Subject *
              <FormSelect
                ariaLabel="Subject"
                value={subjectId}
                onChange={setSubjectId}
                options={subjects.map((s) => ({ value: String(s.id), label: s.name }))}
              />
            </label>
            <label>
              Teacher *
              <FormSelect
                ariaLabel="Teacher"
                value={staffId}
                onChange={setStaffId}
                options={staffList.map((s) => ({
                  value: String(s.id),
                  label: `${s.name}${s.role ? ` · ${s.role}` : ""}`,
                }))}
              />
            </label>
            <label>
              Class *
              <FormSelect
                ariaLabel="Class"
                value={classroomId}
                onChange={setClassroomId}
                options={classrooms.map((c) => ({
                  value: c.id,
                  label: c.room ? `${c.label} (${c.room})` : c.label,
                }))}
              />
            </label>
            <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
              />
              Primary teacher for this subject in this class
            </label>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            One teacher per subject and class; assign the same teacher to several subjects freely.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Assigning…" : "Create allocation"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* =========================================================================
   TAB 3 — HOMEWORK
   ========================================================================= */

function HomeworkTab({
  assignments,
  classrooms,
  isEmployee,
  onPost,
  onDelete,
}: {
  assignments: ReturnType<typeof useAssignmentsView>["rows"];
  classrooms: ClassroomRow[];
  isEmployee: boolean;
  onPost: () => void;
  onDelete: (item: { id: string; title: string }) => void;
}) {
  const roomLabel = useMemo(() => {
    const m = new Map(classrooms.map((c) => [c.id, c.label]));
    return (id: string | null) => (id ? m.get(id) ?? "Unknown class" : "—");
  }, [classrooms]);

  const [classFilter, setClassFilter] = useState("all");

  const usedRoomIds = useMemo(
    () => Array.from(new Set(assignments.map((a) => a.classroomId).filter(Boolean) as string[])),
    [assignments],
  );

  const filtered = useMemo(() => {
    return classrooms.some((c) => c.id === classFilter)
      ? assignments.filter((a) => a.classroomId === classFilter)
      : assignments;
  }, [assignments, classFilter]);

  return (
    <section className="space-y-4">
      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Homework board</h2>
            <p className="panel-subtitle">
              Live homework for the whole school. Teachers post here; it reaches pupils and
              parents the moment it is saved.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FormSelect
              ariaLabel="Filter by class"
              value={classFilter}
              onChange={setClassFilter}
              options={[
                { value: "all", label: "All classes" },
                ...usedRoomIds.map((id) => ({
                  value: id,
                  label: roomLabel(id),
                })),
              ]}
              disabled={usedRoomIds.length === 0}
            />
            {isEmployee && (
              <button
                type="button"
                className="secondary-button"
                onClick={onPost}
                style={{ whiteSpace: "nowrap" }}
              >
                <Plus size={14} />
                <span>Post homework</span>
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: "44px 22px" }}>
            <ClipboardList size={24} />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {assignments.length === 0
                ? "No homework has been posted yet"
                : "No homework for this class yet"}
            </p>
            <p className="mt-1 max-w-md text-center text-xs text-[var(--text-muted)]">
              {isEmployee
                ? "Post the first assignment for your pupils — it appears in their portal immediately."
                : "Assignments appear here once teachers post them."}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 780 }}>
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Due</th>
                  <th>Status</th>
                  {isEmployee && <th className="text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const pill = duePill(a.dueAt);
                  return (
                    <tr key={a.id}>
                      <td className="font-medium text-[var(--text-primary)]">
                        {a.title}
                        {a.instructions && (
                          <div
                            className="muted-cell"
                            style={{
                              maxWidth: 420,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 12,
                            }}
                          >
                            {a.instructions}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="grade-chip">{a.subject}</span>
                      </td>
                      <td>{roomLabel(a.classroomId)}</td>
                      <td className="flex items-center gap-2">
                        <Clock size={12} style={{ flexShrink: 0, opacity: 0.5 }} />
                        {formatDue(a.dueAt)}
                      </td>
                      <td>
                        {pill ? (
                          <span className={pill.cls}>{pill.label}</span>
                        ) : (
                          <span className="muted-cell">—</span>
                        )}
                      </td>
                      {isEmployee && (
                        <td className="text-right">
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Delete ${a.title}`}
                            onClick={() => onDelete(a)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

function PostHomeworkModal({
  classrooms,
  onClose,
  onSubmit,
}: {
  classrooms: ClassroomRow[];
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    subject: string;
    classroomId: string;
    dueAt: string;
    instructions: string;
  }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [classroomId, setClassroomId] = useState(classrooms[0]?.id ?? "");
  const [dueAt, setDueAt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const ok = await onSubmit({ title, subject, classroomId, dueAt, instructions });
    setSaving(false);
  };

  return (
    <ModalShell
      title="Post Homework"
      eyebrow="Homework"
      onClose={onClose}
      ariaLabel="Post homework"
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          <div className="form-grid">
            <label style={{ gridColumn: "span 2" }}>
              Title *
              <input
                type="text"
                placeholder="e.g. Exercise 4.1 — Real Numbers"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
              />
            </label>
            <label>
              Subject *
              <input
                type="text"
                placeholder="e.g. Mathematics"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </label>
            <label>
              Class *
              <FormSelect
                ariaLabel="Class"
                value={classroomId}
                onChange={setClassroomId}
                options={classrooms.map((c) => ({
                  value: c.id,
                  label: c.room ? `${c.label} (${c.room})` : c.label,
                }))}
                placeholder="Choose a class…"
              />
            </label>
            <label>
              Due *
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                required
              />
            </label>
            <label style={{ gridColumn: "span 2" }}>
              Instructions
              <textarea
                rows={3}
                placeholder="What pupils should do and how to submit"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Posting…" : "Post homework"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* =========================================================================
   TAB 4 — PERFORMANCE
   ========================================================================= */

function PerformanceTab({
  subjects,
  gradeOutcomes,
}: {
  subjects: ReturnType<typeof useSubjectsView>["rows"];
  gradeOutcomes: ReturnType<typeof useGradeOutcomesView>["rows"];
}) {
  const scored = useMemo(
    () =>
      subjects
        .filter((s) => s.results > 0)
        .sort((a, b) => b.progress - a.progress),
    [subjects],
  );
  const overall = useMemo(() => {
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((sum, s) => sum + s.progress, 0) / scored.length);
  }, [scored]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section className="panel" style={{ padding: "18px 20px" }}>
        <div className="panel-header" style={{ marginBottom: 10 }}>
          <div>
            <h2 className="panel-title">Subject mastery</h2>
            <p className="panel-subtitle">
              Average share of marks earned by pupils in recorded exams.
            </p>
          </div>
        </div>
        {scored.length === 0 ? (
          <div className="empty-state" style={{ padding: "34px 18px" }}>
            <BarChart3 size={22} />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              No exam marks recorded against the catalog yet
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Averages appear as soon as graded results name these subjects.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {scored.map((s) => (
              <div key={s.id}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[var(--text-primary)]">{s.name}</span>
                  <span className="muted-cell">
                    {s.progress}% · {s.results} result{s.results === 1 ? "" : "s"}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: "var(--bg-raised)",
                    marginTop: 5,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, s.progress))}%`,
                      borderRadius: 999,
                      background:
                        s.progress >= 75
                          ? "var(--success)"
                          : s.progress >= 50
                            ? "var(--brand)"
                            : "var(--warning)",
                      transition: "width .4s var(--ease-out)",
                    }}
                  />
                </div>
              </div>
            ))}
            {overall !== null && (
              <p className="muted-cell" style={{ fontSize: 12 }}>
                Catalog-wide average: {overall}%
              </p>
            )}
          </div>
        )}
      </section>

      <section className="panel" style={{ padding: "18px 20px" }}>
        <div className="panel-header" style={{ marginBottom: 10 }}>
          <div>
            <h2 className="panel-title">Class outcomes</h2>
            <p className="panel-subtitle">
              Performance and attendance per grade, from real exam results and registers.
            </p>
          </div>
        </div>
        {gradeOutcomes.length === 0 ? (
          <div className="empty-state" style={{ padding: "34px 18px" }}>
            <GraduationCap size={22} />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              No class-level outcomes yet
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              These build up from published exam results and attendance once pupils are graded.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Average</th>
                  <th>Attendance</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {gradeOutcomes.map((g) => (
                  <tr key={g.id}>
                    <td className="font-medium text-[var(--text-primary)]">{g.grade}</td>
                    <td>
                      <strong>{g.average}%</strong>
                    </td>
                    <td>{g.attendance}%</td>
                    <td>
                      <span
                        className={
                          g.change.startsWith("+")
                            ? "status-pill success"
                            : g.change.startsWith("-")
                              ? "status-pill danger"
                              : "status-pill neutral"
                        }
                      >
                        {g.change}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* =========================================================================
   MAIN
   ========================================================================= */

export function AcademicsView({ onBack }: AcademicsViewProps) {
  const currentUser = useCurrentUser();
  const isSuper = currentUser ? isSuperAdminId(currentUser.id) : false;
  const isManager =
    isSuper ||
    currentUser?.role === "admin" ||
    currentUser?.role === "super_admin" ||
    currentUser?.role === "principal";
  // `is_school_employee()` in RLS: managers plus staff roles — homework is
  // posted and removed by any school employee.
  const isEmployee =
    isManager ||
    currentUser?.role === "staff" ||
    currentUser?.role === "teacher" ||
    currentUser?.role === "faculty" ||
    currentUser?.role === "accountant";
  const orgId = useOrganisationId();

  const { rows: subjects } = useSubjectsView();
  const { rows: allocations } = useTeachingAllocationsView();
  const { rows: assignments } = useAssignmentsView();
  const { rows: gradeOutcomes } = useGradeOutcomesView();
  const { rows: staffList } = useStaffView();
  const { rows: classrooms } = useClassroomsView();

  const [activeTab, setActiveTab] = useState<AcademicsTab>("curriculum");
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [postHomeworkOpen, setPostHomeworkOpen] = useState(false);

  const activeSubjects = subjects.filter((s) => s.active);
  const assignedTeacherCount = new Set(
    allocations.map((a) => a.staffId).filter(Boolean) as string[],
  ).size;
  const upcomingCount = assignments.filter(
    (a) => a.dueAt && new Date(a.dueAt).getTime() >= Date.now(),
  ).length;
  const scoredSubjects = subjects.filter((s) => s.results > 0);
  const catalogAverage =
    scoredSubjects.length > 0
      ? Math.round(
          scoredSubjects.reduce((sum, s) => sum + s.progress, 0) / scoredSubjects.length,
        )
      : null;

  /* ------------------------- mutations ------------------------- */

  const addSubject = async (values: { name: string; code: string; description: string }) => {
    if (!orgId) {
      toast.error("Cannot add subject", {
        description: "Your account is not linked to a school organisation.",
      });
      return false;
    }
    const { error } = await supabase.from("subjects").insert({
      name: values.name.trim(),
      code: values.code.trim() || null,
      description: values.description.trim() || null,
      active: true,
      organisation_id: orgId,
    });
    if (error) {
      toast.error("Could not add subject", { description: error.message });
      return false;
    }
    notifyDataChanged();
    toast.success(`“${values.name.trim()}” added to the catalog`);
    return true;
  };

  const deleteSubject = async (subject: { id: string | number; name: string }) => {
    if (!isManager) return;
    if (
      !confirm(
        `Remove “${subject.name}” from the catalog? Teaching allocations for it are removed too.`,
      )
    ) {
      return;
    }
    await supabase.from("subject_teachers").delete().eq("subject_id", subject.id);
    const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
    if (error) {
      toast.error("Could not remove subject", { description: error.message });
      return;
    }
    notifyDataChanged();
    toast.success(`“${subject.name}” removed from the catalog`);
  };

  const createAllocation = async (values: {
    subjectId: string;
    staffId: string;
    classroomId: string;
    isPrimary: boolean;
  }) => {
    if (!orgId) {
      toast.error("Cannot create allocation", {
        description: "Your account is not linked to a school organisation.",
      });
      return false;
    }
    const duplicate = allocations.find(
      (a) =>
        a.subjectId === values.subjectId &&
        a.classroomId === values.classroomId &&
        a.staffId === values.staffId,
    );
    if (duplicate) {
      toast.error("Already assigned", {
        description: `${duplicate.staffName ?? "That teacher"} already teaches ${duplicate.subjectName} in ${duplicate.classroomLabel}.`,
      });
      return false;
    }
    const { error } = await supabase.from("subject_teachers").insert({
      subject_id: values.subjectId,
      staff_id: values.staffId,
      classroom_id: values.classroomId,
      is_primary: values.isPrimary,
      organisation_id: orgId,
    });
    if (error) {
      toast.error("Could not create allocation", { description: error.message });
      return false;
    }
    const subName = subjects.find((s) => s.id === values.subjectId)?.name ?? "Subject";
    notifyDataChanged();
    toast.success(`${subName} allocation saved`);
    return true;
  };

  const removeAllocation = async (a: {
    id: string;
    subjectName: string;
    classroomLabel: string;
  }) => {
    if (!isManager) return;
    if (!confirm(`Unassign ${a.subjectName} from ${a.classroomLabel}?`)) return;
    const { error } = await supabase.from("subject_teachers").delete().eq("id", a.id);
    if (error) {
      toast.error("Could not remove allocation", { description: error.message });
      return;
    }
    notifyDataChanged();
    toast.success(`${a.subjectName} unassigned from ${a.classroomLabel}`);
  };

  const createAssignment = async (values: {
    title: string;
    subject: string;
    classroomId: string;
    dueAt: string;
    instructions: string;
  }) => {
    if (!orgId) {
      toast.error("Cannot post homework", {
        description: "Your account is not linked to a school organisation.",
      });
      return false;
    }
    const dueDate = new Date(values.dueAt);
    if (Number.isNaN(dueDate.getTime())) {
      toast.error("Invalid due date");
      return false;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const { error } = await supabase.from("assignments").insert({
      title: values.title.trim(),
      subject: values.subject.trim(),
      classroom_id: values.classroomId,
      instructions: values.instructions.trim() || null,
      due_at: dueDate.toISOString(),
      created_by: sessionData.session?.user?.id ?? null,
      organisation_id: orgId,
    });
    if (error) {
      toast.error("Could not post homework", { description: error.message });
      return false;
    }
    notifyDataChanged();
    toast.success(`Homework “${values.title.trim()}” posted`, {
      description: `Due ${values.dueAt} · ${classrooms.find((c) => c.id === values.classroomId)?.label ?? ""}`,
    });
    return true;
  };

  const deleteAssignment = async (item: { id: string; title: string }) => {
    if (!isEmployee) return;
    if (!confirm(`Delete homework “${item.title}”? This cannot be undone.`)) return;
    const { error } = await supabase.from("assignments").delete().eq("id", item.id);
    if (error) {
      toast.error("Could not delete homework", { description: error.message });
      return;
    }
    notifyDataChanged();
    toast.success(`Homework “${item.title}” deleted`);
  };

  /* ------------------------- render ------------------------- */

  const headlineAction =
    activeTab === "curriculum" && isManager ? (
      <button type="button" className="primary-button" onClick={() => setAddSubjectOpen(true)}>
        <Plus size={15} />
        <span>Add Subject</span>
      </button>
    ) : activeTab === "allocation" && isManager ? (
      <button
        type="button"
        className="primary-button"
        onClick={() => setAssignOpen(true)}
        disabled={subjects.length === 0 || classrooms.length === 0}
      >
        <Plus size={15} />
        <span>Assign Teacher</span>
      </button>
    ) : activeTab === "homework" && isEmployee ? (
      <button
        type="button"
        className="primary-button"
        onClick={() => setPostHomeworkOpen(true)}
        disabled={classrooms.length === 0}
      >
        <Plus size={15} />
        <span>Post Homework</span>
      </button>
    ) : null;

  return (
    <div className="space-y-6">
      <Breadcrumb
        parent="Global Kids School"
        current="Academics"
        onParentClick={onBack}
      />

      <div className="page-intro">
        <div>
          <p className="eyebrow">Curriculum · Faculty · Homework · Performance</p>
          <h1 className="page-title">Academics</h1>
        </div>
        <div className="flex items-center gap-3">{headlineAction}</div>
      </div>

      <div className="metric-grid">
        <MetricBlock
          label="Subjects offered"
          value={String(activeSubjects.length)}
          comparison={
            subjects.length === 0
              ? "Catalog is empty — add subjects to begin"
              : `${subjects.length - activeSubjects.length} inactive`
          }
          positive={subjects.length > 0}
          icon={BookOpen}
        />
        <MetricBlock
          label="Teaching allocations"
          value={String(allocations.length)}
          comparison={
            allocations.length === 0
              ? "No teacher assigned to any class yet"
              : `${assignedTeacherCount} teacher${assignedTeacherCount === 1 ? "" : "s"} across ${
                  allocations.length
                } assignment${allocations.length === 1 ? "" : "s"}`
          }
          positive={allocations.length > 0}
          icon={Users}
        />
        <MetricBlock
          label="Upcoming homework"
          value={String(upcomingCount)}
          comparison={
            assignments.length === 0
              ? "No assignments posted yet"
              : `${assignments.length} posted · ${upcomingCount} still open`
          }
          positive={assignments.length > 0}
          icon={ClipboardList}
        />
        <MetricBlock
          label="Class average"
          value={catalogAverage !== null ? `${catalogAverage}%` : "Awaiting marks"}
          comparison={
            catalogAverage !== null
              ? `Across ${scoredSubjects.length} graded subject${scoredSubjects.length === 1 ? "" : "s"}`
              : "Appears once exams are graded"
          }
          positive={catalogAverage !== null && catalogAverage >= 60}
          icon={BarChart3}
        />
      </div>

      <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3 overflow-x-auto no-scrollbar">
        <SegmentedControl
          ariaLabel="Academics section navigation"
          layoutId="academicsMainTabs"
          value={activeTab}
          onChange={(val) => setActiveTab(val as AcademicsTab)}
          indicatorVariant="brand"
          options={[
            { value: "curriculum", label: "Curriculum", icon: <BookOpen size={14} /> },
            { value: "allocation", label: "Faculty allocation", icon: <Users size={14} /> },
            { value: "homework", label: "Homework", icon: <ClipboardList size={14} /> },
            { value: "performance", label: "Performance", icon: <BarChart3 size={14} /> },
            { value: "timetable", label: "Timetable", icon: <CalendarDays size={14} /> },
          ]}
        />
      </div>

      {activeTab === "curriculum" && (
        <CurriculumTab
          subjects={subjects}
          isManager={isManager}
          onAdd={() => setAddSubjectOpen(true)}
          onDelete={deleteSubject}
        />
      )}

      {activeTab === "allocation" && (
        <AllocationTab
          subjects={subjects}
          staffList={staffList}
          classrooms={classrooms}
          allocations={allocations}
          isManager={isManager}
          onAssign={() => setAssignOpen(true)}
          onUnassign={removeAllocation}
        />
      )}

      {activeTab === "homework" && (
        <HomeworkTab
          assignments={assignments}
          classrooms={classrooms}
          isEmployee={isEmployee}
          onPost={() => setPostHomeworkOpen(true)}
          onDelete={deleteAssignment}
        />
      )}

      {activeTab === "performance" && (
        <PerformanceTab subjects={subjects} gradeOutcomes={gradeOutcomes} />
      )}

      {activeTab === "timetable" && <TimetableView />}

      {addSubjectOpen && (
        <AddSubjectModal
          onClose={() => setAddSubjectOpen(false)}
          onSubmit={addSubject}
        />
      )}

      {assignOpen && (
        <AssignTeacherModal
          subjects={subjects}
          staffList={staffList}
          classrooms={classrooms}
          allocations={allocations}
          onClose={() => setAssignOpen(false)}
          onSubmit={createAllocation}
        />
      )}

      {postHomeworkOpen && (
        <PostHomeworkModal
          classrooms={classrooms}
          onClose={() => setPostHomeworkOpen(false)}
          onSubmit={createAssignment}
        />
      )}
    </div>
  );
}


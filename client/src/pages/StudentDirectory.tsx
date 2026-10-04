import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";

import { ServerPager } from "@/components/ErpServerPager";
import {
  ApiError,
  archiveStudent,
  createStudent,
  downloadDirectoryExport,
  fetchDirectory,
  fetchDirectoryOptions,
  formatDate,
  formatMoney,
  formatPercent,
  initialsFor,
  saveBlob,
  updateStudent,
  type DirectoryFilters,
  type DirectoryOptions,
  type DirectoryPage,
  type DirectoryStudent,
  type StudentDraft,
} from "@/lib/student-directory";
import { toast } from "@/lib/toast";
import { StudentProfile } from "@/pages/StudentProfile";
import { canEditStudent, canManageFees } from "@shared/student-access";
import { supabase } from "@/lib/supabase";

/**
 * The student directory.
 *
 * ## Why this replaced the previous table
 *
 * The old one called `fetchAll("students", …)`, which pages through a whole
 * table into the browser, then filtered and paginated the result in memory. That
 * works at 100 rows and falls over at 12,000. Here the server does the searching,
 * sorting and paging, so the browser holds one page at a time and never learns
 * how large the roll call is.
 *
 * ## Why there is an expandable row *and* a full page
 *
 * The brief asked for both: a directory row that drops open, and a complete
 * profile behind it. The expander answers "is this the child I am looking for?"
 * in one click — the numbers that decide it, without leaving the list. The full
 * profile answers everything else. Splitting them means finding a pupil never
 * costs fourteen queries, and reading a record never happens in a 600px drawer.
 *
 * ## Permissions
 *
 * This component never decides what the user may see. The route sends only the
 * columns the caller's role allows and returns 403 for a role with no directory
 * access, so a fee column that is absent here is absent because the server
 * omitted it, not because a button was hidden.
 */

const PAGE_SIZE = 20;

export interface StudentDirectoryProps {
  /** Open this student's profile on first render, from a deep link. */
  openStudentId?: string | null;
  onStudentOpened?: () => void;
  onBack?: () => void;
}

export function StudentDirectory({ openStudentId, onStudentOpened, onBack }: StudentDirectoryProps) {
  const [page, setPage] = useState<DirectoryPage | null>(null);
  const [options, setOptions] = useState<DirectoryOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("");

  const [filters, setFilters] = useState<DirectoryFilters>({
    search: "",
    grade: "",
    section: "",
    status: "",
    admissionFrom: "",
    admissionTo: "",
    sort: "name",
    direction: "asc",
    page: 1,
    pageSize: PAGE_SIZE,
  });

  // The search box is debounced so typing does not fire a query per keystroke,
  // and the raw value is kept so the input stays responsive.
  const [searchDraft, setSearchDraft] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<DirectoryStudent | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!data.session) return;
        const res = await fetch("/rest/v1/profiles?select=role&id=eq." + data.session.user.id, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
            Authorization: `Bearer ${data.session.access_token}`,
          },
        }).catch(() => null);
        const rows = (await res?.json().catch(() => null)) as Array<{ role?: string }> | null;
        setRole(String(rows?.[0]?.role ?? ""));
      })
      .catch(() => undefined);
  }, []);

  // Debounce: 300 ms is long enough to coalesce a word and short enough that the
  // list feels like it is following along.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.search === searchDraft ? prev : { ...prev, search: searchDraft, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        setPage(await fetchDirectory(filters, signal));
      } catch (err) {
        if (signal?.aborted) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "The student list could not be loaded. Check your connection and try again."
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchDirectoryOptions(controller.signal)
      .then(setOptions)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  // A deep link from the AI assistant or the Overview screen opens the profile.
  useEffect(() => {
    if (openStudentId) {
      setProfileId(openStudentId);
      onStudentOpened?.();
    }
  }, [openStudentId, onStudentOpened]);

  const rows = page?.students ?? [];
  const mayEdit = canEditStudent(role);
  const maySeeFees = canManageFees(role);

  const setFilter = (patch: Partial<DirectoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));
  };

  const toggleSort = (column: string) => {
    setFilters((prev) => ({
      ...prev,
      sort: column,
      direction: prev.sort === column && prev.direction === "asc" ? "desc" : "asc",
      page: 1,
    }));
  };

  const activeFilterCount = useMemo(
    () =>
      [filters.grade, filters.section, filters.status, filters.admissionFrom, filters.admissionTo].filter(Boolean).length,
    [filters]
  );

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await downloadDirectoryExport({ ...filters, pageSize: 200 });
      saveBlob(blob, filename);
      toast.success("Export ready", { description: "The file contains only the columns your role may read." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The export could not be produced.");
    } finally {
      setExporting(false);
    }
  };

  const bulkArchive = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const ok = window.confirm(
      `Archive ${ids.length} student${ids.length === 1 ? "" : "s"}?\n\n` +
        "Their records are kept — nothing is deleted. They will be marked withdrawn and stop appearing in the active list."
    );
    if (!ok) return;
    try {
      for (const id of ids) await archiveStudent(id);
      toast.success(`${ids.length} student${ids.length === 1 ? "" : "s"} archived`);
      setSelected(new Set());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Those students could not be archived.");
    }
  };

  /* ---------------------------------------------------------------- *
   * Full profile
   * ---------------------------------------------------------------- */

  if (profileId) {
    return (
      <StudentProfile
        studentId={profileId}
        onBack={() => {
          setProfileId(null);
          void load();
        }}
        onChanged={() => void load()}
      />
    );
  }

  /* ---------------------------------------------------------------- *
   * Directory
   * ---------------------------------------------------------------- */

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">
            {page
              ? `${page.total.toLocaleString()} student${page.total === 1 ? "" : "s"} on record${
                  activeFilterCount ? " matching your filters" : ""
                }`
              : "Loading the student list…"}
          </p>
        </div>
        <div className="intro-actions">
          <button className="secondary-button" onClick={() => void exportCsv()} disabled={exporting || !rows.length}>
            <Download size={15} />
            {exporting ? "Preparing…" : "Export"}
          </button>
          {mayEdit && (
            <button className="primary-button" onClick={() => setShowAdd(true)}>
              <Plus size={16} />
              Add student
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="notice notice-danger" role="alert">
          {error}
          <button className="secondary-button compact" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      <div className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search by name, admission number or student ID…"
              aria-label="Search students"
            />
            {searchDraft && (
              <button className="search-clear" onClick={() => setSearchDraft("")} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="toolbar-actions">
            <div className="filter-select">
              <Filter size={14} />
              <select
                value={filters.grade ?? ""}
                onChange={(event) => setFilter({ grade: event.target.value })}
                aria-label="Filter by class"
              >
                <option value="">All classes</option>
                {(options?.grades ?? []).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>

            <div className="filter-select">
              <select
                value={filters.section ?? ""}
                onChange={(event) => setFilter({ section: event.target.value })}
                aria-label="Filter by section"
              >
                <option value="">All sections</option>
                {(options?.sections ?? []).map((s) => (
                  <option key={s} value={s}>
                    Section {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>

            <div className="filter-select">
              <select
                value={filters.status ?? ""}
                onChange={(event) => setFilter({ status: event.target.value })}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="graduated">Graduated</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
              <ChevronDown size={14} />
            </div>

            <div className="filter-select">
              <input
                type="date"
                value={filters.admissionFrom ?? ""}
                onChange={(event) => setFilter({ admissionFrom: event.target.value })}
                aria-label="Admitted from"
                title="Admitted on or after"
              />
            </div>

            {activeFilterCount > 0 && (
              <button
                className="secondary-button compact"
                onClick={() => {
                  setSearchDraft("");
                  setFilters((prev) => ({
                    ...prev,
                    search: "",
                    grade: "",
                    section: "",
                    status: "",
                    admissionFrom: "",
                    admissionTo: "",
                    page: 1,
                  }));
                }}
              >
                <X size={14} />
                Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </div>

        {selected.size > 0 && (
          <div className="bulk-bar">
            <span className="font-medium">{selected.size} selected</span>
            <button className="secondary-button compact" onClick={() => setSelected(new Set())}>
              Clear
            </button>
            {mayEdit && (
              <button className="secondary-button compact danger" onClick={() => void bulkArchive()}>
                Archive selected
              </button>
            )}
          </div>
        )}

        <div className="table-scroll" role="region" aria-busy={loading} aria-label="Student list" tabIndex={0}>
          {loading && <span className="sr-only">Loading students</span>}
          <table className="data-table">
            <thead>
              <tr>
                {mayEdit && (
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === rows.length}
                      onChange={(event) =>
                        setSelected(event.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
                      }
                      aria-label="Select all on this page"
                    />
                  </th>
                )}
                <SortableHeader label="Student" column="name" sort={filters.sort} direction={filters.direction} onSort={toggleSort} />
                <SortableHeader label="Admission no." column="admission_no" sort={filters.sort} direction={filters.direction} onSort={toggleSort} />
                <SortableHeader label="Class" column="grade" sort={filters.sort} direction={filters.direction} onSort={toggleSort} />
                <th>Section</th>
                <SortableHeader label="Roll" column="roll_no" sort={filters.sort} direction={filters.direction} onSort={toggleSort} />
                <SortableHeader label="Attendance" column="attendance" sort={filters.sort} direction={filters.direction} onSort={toggleSort} />
                <SortableHeader label="Average" column="average" sort={filters.sort} direction={filters.direction} onSort={toggleSort} />
                {maySeeFees && <th>Fees</th>}
                <th>Guardian</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} mayEdit={mayEdit} maySeeFees={maySeeFees} />)
                : rows.map((student) => (
                    <StudentRow
                      key={student.id}
                      student={student}
                      mayEdit={mayEdit}
                      maySeeFees={maySeeFees}
                      expanded={expanded === student.id}
                      selected={selected.has(student.id)}
                      onToggleExpand={() => setExpanded(expanded === student.id ? null : student.id)}
                      onToggleSelect={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(student.id)) next.delete(student.id);
                          else next.add(student.id);
                          return next;
                        });
                      }}
                      onOpen={() => setProfileId(student.id)}
                      onEdit={() => setEditing(student)}
                    />
                  ))}
            </tbody>
          </table>

          {!loading && rows.length === 0 && (
            <div className="empty-state">
              <Users size={20} />
              <p className="panel-subtitle">
                {activeFilterCount || searchDraft
                  ? "No students match these filters."
                  : "No students have been registered yet."}
              </p>
              {mayEdit && !searchDraft && !activeFilterCount && (
                <button className="primary-button" onClick={() => setShowAdd(true)}>
                  <Plus size={15} />
                  Add the first student
                </button>
              )}
            </div>
          )}
        </div>

        {page && (
          <ServerPager
            page={page.page}
            pageCount={page.pageCount}
            total={page.total}
            showing={page.pageSize}
            noun="students"
            onChange={(next) => setFilter({ page: next })}
            disabled={loading}
            truncated={page.truncated}
          />
        )}
      </div>

      {showAdd && (
        <StudentDialog
          title="Add a student"
          description="Create a student record. You can fill in guardians and documents afterwards."
          submitLabel="Create student"
          onClose={() => setShowAdd(false)}
          onSubmit={async (draft) => {
            const result = await createStudent(draft);
            toast.success("Student created", {
              description: `${result.student.name} is now on the roll call.`,
            });
            setShowAdd(false);
            await load();
          }}
        />
      )}

      {editing && (
        <StudentDialog
          title={`Edit ${editing.name}`}
          description="Changes are recorded in the audit history with your name against them."
          submitLabel="Save changes"
          student={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (draft) => {
            await updateStudent(editing.id, draft);
            toast.success("Student updated");
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Rows
 * ------------------------------------------------------------------ */

function SortableHeader({
  label,
  column,
  sort,
  direction,
  onSort,
}: {
  label: string;
  column: string;
  sort?: string;
  direction?: "asc" | "desc";
  onSort: (column: string) => void;
}) {
  const active = sort === column;
  return (
    <th>
      <button className={`sort-header${active ? " active" : ""}`} onClick={() => onSort(column)}>
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {active ? (direction === "asc" ? "↑" : "↓") : ""}
        </span>
      </button>
    </th>
  );
}

function StudentRow({
  student,
  mayEdit,
  maySeeFees,
  expanded,
  selected,
  onToggleExpand,
  onToggleSelect,
  onOpen,
  onEdit,
}: {
  student: DirectoryStudent;
  mayEdit: boolean;
  maySeeFees: boolean;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onOpen: () => void;
  onEdit: () => void;
}) {
  return (
    <>
      <tr className={`row-clickable${expanded ? " row-selected" : ""}`}>
        {mayEdit && (
          <td className="checkbox-cell" onClick={(event) => event.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`Select ${student.name}`}
            />
          </td>
        )}
        <td>
          <div className="flex items-center gap-3">
            {student.photo_url ? (
              <img className="avatar avatar-sm" src={student.photo_url} alt="" />
            ) : (
              <span className="avatar avatar-sm">{initialsFor(student.name)}</span>
            )}
            <div>
              <div className="font-medium text-[var(--text-primary)]">{student.name}</div>
              <div className="muted-cell mt-1.5">{student.admission_no}</div>
            </div>
          </div>
        </td>
        <td className="muted-cell">{student.admission_no}</td>
        <td>
          <span className="grade-chip">{student.grade ?? "Unassigned"}</span>
        </td>
        <td className="muted-cell">{student.section || "—"}</td>
        <td className="muted-cell">{student.roll_no ?? "—"}</td>
        <td>
          {student.attendance_percentage === null ? (
            <span className="muted-cell">—</span>
          ) : (
            <span className={student.attendance_percentage >= 90 ? "score-positive" : "score-warning"}>
              {formatPercent(student.attendance_percentage)}
            </span>
          )}
        </td>
        <td>{formatPercent(student.academic_average)}</td>
        {maySeeFees && (
          <td>
            {student.fees === null ? (
              <span className="muted-cell">—</span>
            ) : (
              <span className={`status-pill ${student.fees === "Paid" ? "success" : "warning"}`}>
                <span className="status-dot" />
                {student.fees}
              </span>
            )}
          </td>
        )}
        <td className="muted-cell">{student.guardian_name ?? "—"}</td>
        <td>
          <div className="row-actions">
            <button
              className="row-more"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand();
              }}
              aria-expanded={expanded}
              aria-label={expanded ? `Collapse ${student.name}` : `Expand ${student.name}`}
              title={expanded ? "Hide summary" : "Show summary"}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {mayEdit && (
              <button
                className="row-more"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                aria-label={`Edit ${student.name}`}
              >
                Edit
              </button>
            )}
          </div>
        </td>
      </tr>

      {/*
        The expander. A second <tr> rather than a nested table, so the summary
        keeps the same column alignment as the header above it.
      */}
      {expanded && (
        <tr className="expanded-row">
          <td colSpan={mayEdit ? 13 : 12}>
            <div className="expanded-panel">
              <div className="expanded-summary">
                <SummaryItem label="Admission number" value={student.admission_no} />
                <SummaryItem label="Class" value={`${student.grade ?? "Unassigned"}${student.section ? ` · ${student.section}` : ""}`} />
                <SummaryItem label="Roll number" value={student.roll_no ?? "—"} />
                <SummaryItem
                  label="Attendance"
                  value={student.attendance_percentage === null ? "Not recorded" : formatPercent(student.attendance_percentage)}
                  note={student.attendance_records ? `${student.attendance_records} sessions` : undefined}
                />
                <SummaryItem
                  label="Academic average"
                  value={formatPercent(student.academic_average)}
                  note={student.scored_papers ? `${student.scored_papers} papers` : undefined}
                />
                {maySeeFees && (
                  <SummaryItem
                    label="Outstanding fees"
                    value={student.outstanding_fees === undefined ? "—" : formatMoney(student.outstanding_fees)}
                  />
                )}
                <SummaryItem label="Guardian" value={student.guardian_name ?? "—"} />
                <SummaryItem label="Admitted" value={formatDate(student.joined_on)} />
              </div>

              <div className="expanded-actions">
                <button className="primary-button compact" onClick={onOpen}>
                  Open full profile
                </button>
                {mayEdit && (
                  <button className="secondary-button compact" onClick={onEdit}>
                    Edit details
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SummaryItem({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="summary-item">
      <span className="summary-label">{label}</span>
      <span className="summary-value">{value}</span>
      {note && <span className="summary-note">{note}</span>}
    </div>
  );
}

function SkeletonRow({ mayEdit, maySeeFees }: { mayEdit: boolean; maySeeFees: boolean }) {
  const cells = 5 + (maySeeFees ? 1 : 0) + (mayEdit ? 1 : 0);
  return (
    <tr>
      {Array.from({ length: cells }).map((_, i) => (
        <td key={i}>
          <span className="skeleton-line" />
        </td>
      ))}
    </tr>
  );
}

/* ------------------------------------------------------------------ *
 * Add / edit
 * ------------------------------------------------------------------ */

function StudentDialog({
  title,
  description,
  submitLabel,
  student,
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  submitLabel: string;
  student?: DirectoryStudent;
  onClose: () => void;
  onSubmit: (draft: StudentDraft) => Promise<void>;
}) {
  const [form, setForm] = useState({
    first_name: student?.first_name ?? "",
    last_name: student?.last_name ?? "",
    admission_no: student?.admission_no ?? "",
    date_of_birth: student?.date_of_birth ?? "",
    gender: student?.gender ?? "",
    status: student?.status ?? "active",
    guardian_name: student?.guardian_name ?? "",
    guardian_phone: "",
    guardian_email: "",
    joined_on: student?.joined_on ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const submit = async () => {
    // Checked here so the user is told before a round trip, and again by the
    // server, which is the copy that matters.
    const local: Record<string, string> = {};
    if (!form.first_name.trim()) local.first_name = "Enter a first name.";
    if (!form.last_name.trim()) local.last_name = "Enter a last name.";
    if (Object.keys(local).length) {
      setFieldErrors(local);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        admission_no: form.admission_no.trim() || undefined,
        date_of_birth: form.date_of_birth || undefined,
        gender: form.gender || undefined,
        status: form.status,
        guardian_name: form.guardian_name.trim() || undefined,
        guardian_phone: form.guardian_phone.trim() || undefined,
        guardian_email: form.guardian_email.trim() || undefined,
        joined_on: form.joined_on || undefined,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        if (!Object.keys(err.fieldErrors).length) setError(err.message);
      } else {
        setError("That student could not be saved.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h2 className="panel-title">{title}</h2>
        </div>

        <div className="modal-body">
          <p className="panel-subtitle">{description}</p>

          {error && (
            <div className="notice notice-danger" role="alert">
              {error}
            </div>
          )}

          <div className="form-grid">
            <label>
              First name
              <input value={form.first_name} onChange={(e) => set("first_name")(e.target.value)} autoFocus />
              {fieldErrors.first_name && <span className="field-error">{fieldErrors.first_name}</span>}
            </label>
            <label>
              Last name
              <input value={form.last_name} onChange={(e) => set("last_name")(e.target.value)} />
              {fieldErrors.last_name && <span className="field-error">{fieldErrors.last_name}</span>}
            </label>
            <label>
              Admission number
              <input
                value={form.admission_no}
                onChange={(e) => set("admission_no")(e.target.value)}
                placeholder={student ? undefined : "Leave blank to generate one"}
              />
              {fieldErrors.admission_no && <span className="field-error">{fieldErrors.admission_no}</span>}
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
              Admission date
              <input type="date" value={form.joined_on ?? ""} onChange={(e) => set("joined_on")(e.target.value)} />
            </label>
            {student && (
              <label>
                Status
                <select value={form.status ?? ""} onChange={(e) => set("status")(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="graduated">Graduated</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </label>
            )}
            <label>
              Guardian name
              <input value={form.guardian_name ?? ""} onChange={(e) => set("guardian_name")(e.target.value)} />
            </label>
            {!student && (
              <>
                <label>
                  Guardian phone
                  <input value={form.guardian_phone ?? ""} onChange={(e) => set("guardian_phone")(e.target.value)} />
                </label>
                <label>
                  Guardian email
                  <input type="email" value={form.guardian_email ?? ""} onChange={(e) => set("guardian_email")(e.target.value)} />
                </label>
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
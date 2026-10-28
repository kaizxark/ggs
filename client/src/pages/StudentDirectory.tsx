import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  ExternalLink,
  Filter,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  Loader2,
  Users,
  X,
} from "lucide-react";

import { DrawerBackdrop } from "@/components/DrawerBackdrop";
import { ProfilePhotoPicker } from "@/components/ProfilePhotoPicker";
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
  fetchStudentProfile,
  formatPercent,
  initialsFor,
  saveBlob,
  updateStudent,
  type DirectoryFilters,
  type DirectoryOptions,
  type DirectoryPage,
  type DirectoryStudent,
  type ProfilePayload,
  type StudentDraft,
} from "@/lib/student-directory";
import { toast } from "@/lib/toast";
import { StudentProfile } from "@/pages/StudentProfile";
import { canEditStudent, canManageFees, ALL_STUDENT_SECTIONS, type StudentSection } from "@shared/student-access";
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
  className?: string;
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
  /*
   * The drawer, not an expanding table row.
   *
 * A pupil's record is thirteen sections of attendance, marks, fees, health,
 * guardians and documents. Laid out across a table it either
   * squashed every field into one row or pushed the rest of the roll call down
   * the page. The staff directory already solved the same problem with a panel
   * off the right edge, so the roll call now opens the same way — and a pupil's
   * record, being much larger than a staff one, gets a wider panel and the
   * ability to widen it further.
   *
   * The record is fetched once, when the drawer opens, rather than per row: the
   * directory's own note is right that a full record does not belong in a table
   * row, and fetching one for every visible pupil would be a hundred requests
   * for data nobody looked at.
   */
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerWide, setDrawerWide] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<DirectoryStudent | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Debounce: 300 ms is long enough to coalesce a word and short enough that the
  // list feels like it is following along.
  useEffect(() => {
    setMounted(true);
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

  /*
   * The row the drawer is showing. Resolved from the current page rather than
   * held separately, so a search or a page change while the panel is open can
   * never leave it pointing at a row that is no longer on screen.
   */
  const drawer = useMemo(
    () => rows.find((row) => row.id === drawerId) ?? null,
    [rows, drawerId],
  );
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

      <div className={`panel table-panel${mounted ? "" : " hidden"}`}>
        <div className="table-toolbar">
          <div className="search-field">
            {loading ? (
              <Loader2 size={16} className="animate-spin text-[var(--brand)]" />
            ) : (
              <Search size={16} />
            )}
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search by name, USN or student ID…"
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
                <SortableHeader label="USN" column="usn" sort={filters.sort} direction={filters.direction} onSort={toggleSort} />
                <SortableHeader label="Class" column="grade" sort={filters.sort} direction={filters.direction} onSort={toggleSort} />
                <th>Section</th>
                <SortableHeader label="Roll" column="roll_no" sort={filters.sort} direction={filters.direction} onSort={toggleSort} />
                <SortableHeader label="Attendance" column="attendance" sort={filters.sort} direction={filters.direction} onSort={toggleSort} />
                <SortableHeader label="Average" column="average" sort={filters.sort} direction={filters.direction} onSort={toggleSort} />
                {maySeeFees && <th>Fees</th>}
                <th>Guardian</th>
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
                      open={drawerId === student.id}
                      selected={selected.has(student.id)}
                      onOpenDrawer={() => setDrawerId(student.id)}
                      onToggleSelect={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(student.id)) next.delete(student.id);
                          else next.add(student.id);
                          return next;
                        });
                      }}
                      onOpenProfile={() => setProfileId(student.id)}
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

      {drawer && (
        <StudentDrawer
          student={drawer}
          mayEdit={mayEdit}
          maySeeFees={maySeeFees}
          wide={drawerWide}
          onToggleWide={() => setDrawerWide((value) => !value)}
          onClose={() => setDrawerId(null)}
          onOpenProfile={() => setProfileId(drawer.id)}
          onEdit={() => {
            setDrawerId(null);
            setEditing(drawer);
          }}
        />
      )}

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
  open,
  selected,
  onOpenDrawer,
  onToggleSelect,
  onOpenProfile,
  onEdit,
}: {
  student: DirectoryStudent;
  mayEdit: boolean;
  maySeeFees: boolean;
  open: boolean;
  selected: boolean;
  onOpenDrawer: () => void;
  onToggleSelect: () => void;
  onOpenProfile: () => void;
  onEdit: () => void;
}) {
  return (
    <tr
      className={`row-clickable${open ? " row-selected" : ""}`}
      onClick={onOpenDrawer}
      aria-expanded={open}
    >
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
          </div>
        </div>
      </td>
      <td className="muted-cell">{student.usn || "—"}</td>
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
    </tr>
  );
}

/* ------------------------------------------------------------------ *
 * Pupil drawer
 *
 * The staff directory opens a panel off the right edge; this is the same
 * gesture for a pupil. The difference is size. A staff record is a name, a
 * department and a leave balance. A pupil record is fourteen sections, so the
 * panel starts wider than the staff one and carries a control that takes it
 * wider still — at full width the sections stop being a single scrolled column
 * and can sit two abreast, which is the difference between reading a record
 * and scrolling through one.
 *
 * Sections are not filtered here. The server decides what comes back and names
 * what it withheld, so a section this role may not see appears disabled and
 * says why, rather than quietly rendering as empty.
 * ------------------------------------------------------------------ */

const DRAWER_TABS: Record<StudentSection, string> = {
  personal: "Personal",
  guardians: "Guardians",
  academics: "Academics",
  attendance: "Attendance",
  fees: "Fees",
  documents: "Documents",
  health: "Health",
  activities: "Activities",
  observations: "Observations",
  communications: "Messages",
  admission: "Admission",
  library: "Library",
  account: "Account",
};

function StudentDrawer({
  student,
  mayEdit,
  maySeeFees,
  wide,
  onToggleWide,
  onClose,
  onOpenProfile,
  onEdit,
}: {
  student: DirectoryStudent;
  mayEdit: boolean;
  maySeeFees: boolean;
  wide: boolean;
  onToggleWide: () => void;
  onClose: () => void;
  onOpenProfile: () => void;
  onEdit: () => void;
}) {
  const [detail, setDetail] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<StudentSection>("personal");

  /*
   * One record per open drawer, fetched when the drawer opens rather than for
   * every row on the page. The directory deliberately avoids per-row profile
   * reads; the difference here is that a read is justified only by someone
   * actually opening a pupil, which is at most one at a time.
   */
  useEffect(() => {
    let live = true;
    setLoading(true);
    setFailed(false);
    setDetail(null);
    setTab("personal");
    fetchStudentProfile(student.id)
      .then((data) => {
        if (live) setDetail(data);
      })
      .catch(() => {
        if (live) setFailed(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [student.id]);

  /*
   * Escape, the scroll lock and the blur behind the panel all live in
   * `DrawerBackdrop`. They were hand-rolled here first and the lock silently
   * did nothing: this app scrolls `.main-area`, not the window, so hiding the
   * body's overflow left the roll call free to slide behind the panel.
   */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const allowed = detail ? new Set(detail.sections) : new Set<string>();
  const visibleTabs = ALL_STUDENT_SECTIONS.filter((key) => !detail || allowed.has(key));

  return (
    <>
      <DrawerBackdrop onClose={() => closeRef.current()} />
      <aside className={`profile-drawer pupil-drawer${wide ? " expanded" : ""}`} aria-label={`${student.name} record`}>
      <div className="drawer-header">
        <div className="min-w-0">
          <p className="eyebrow">Pupil record</p>
          <h3 className="truncate">{student.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="drawer-expand"
            onClick={onToggleWide}
            aria-pressed={wide}
            aria-label={wide ? "Narrow the panel" : "Widen the panel"}
            title={wide ? "Narrow the panel" : "Widen the panel to show more"}
          >
            {wide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button className="drawer-expand" onClick={onClose} aria-label="Close pupil record" title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="drawer-avatar">
        {student.photo_url ? (
          <img className="avatar avatar-lg" src={student.photo_url} alt="" />
        ) : (
          <span className="avatar avatar-lg">{initialsFor(student.name)}</span>
        )}
        <div className="min-w-0">
          <p className="font-medium text-[var(--text-secondary)]">
            {student.grade ?? "Unassigned"}
            {student.section ? ` \u00b7 Section ${student.section}` : ""}
          </p>
          <p className="text-[12.5px] text-[var(--text-muted)] truncate">
            {student.usn}
            {student.roll_no ? ` \u00b7 Roll ${student.roll_no}` : ""}
          </p>
        </div>
      </div>

      <div className="drawer-stats">
        <div>
          <span>Attendance</span>
          <strong>{student.attendance_percentage === null ? "\u2014" : formatPercent(student.attendance_percentage)}</strong>
        </div>
        <div>
          <span>Average</span>
          <strong>{formatPercent(student.academic_average)}</strong>
        </div>
        <div>
          <span>Admitted</span>
          <strong className="text-[var(--brand)]">{formatDate(student.joined_on)}</strong>
        </div>
      </div>

      {maySeeFees && student.outstanding_fees !== undefined && (
        <div className="drawer-stats">
          <div>
            <span>Outstanding</span>
            <strong>{formatMoney(student.outstanding_fees)}</strong>
          </div>
          <div>
            <span>Guardian</span>
            <strong className="text-[var(--text-primary)]">{student.guardian_name ?? "\u2014"}</strong>
          </div>
        </div>
      )}

      <div className="drawer-tabs scroll-x">
        {visibleTabs.map((key) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            {DRAWER_TABS[key]}
          </button>
        ))}
      </div>

      <div className="pupil-drawer-body">
        {loading && (
          <div className="drawer-section">
            <div className="skeleton-line" style={{ width: "70%" }} />
            <div className="skeleton-line" style={{ width: "90%" }} />
            <div className="skeleton-line" style={{ width: "60%" }} />
          </div>
        )}

        {!loading && failed && (
          <div className="empty-state">
            <p className="panel-title">Record unavailable</p>
            <p className="panel-subtitle">
              The full record could not be loaded. The summary above is from the roll call and is still accurate.
            </p>
            <button className="secondary-button compact" onClick={onOpenProfile}>
              Open full profile page
            </button>
          </div>
        )}

        {!loading && !failed && detail && (
          <DrawerSection tab={tab} detail={detail} student={student} />
        )}
      </div>

      <div className="drawer-footer">
        {mayEdit && (
          <button className="secondary-button compact" onClick={onEdit}>
            Edit details
          </button>
        )}
        <button className="primary-button compact" onClick={onOpenProfile}>
          Open full profile
          <ExternalLink size={14} />
        </button>
      </div>
      </aside>
    </>
  );
}

/*
 * The section bodies. Wide mode shows them two abreast because the point of
 * widening is to stop a fourteen-section record being one long scroll.
 */
function DrawerSection({
  tab,
  detail,
  student,
}: {
  tab: StudentSection;
  detail: ProfilePayload;
  student: DirectoryStudent;
}) {
  const s = detail.student;
  const rows: Array<[string, string]> = [];
  const push = (label: string, value: string | number | null | undefined) => {
    const text =
      value === null || value === undefined || value === "" ? "\u2014" : String(value);
    rows.push([label, text]);
  };

  /* Headline numbers get an accent label in the drawer so they read as a
     summary rather than a continuation of the tab list above. */

  if (tab === "personal") {
    push("USN", s.usn);
    push("Date of birth", formatDate(s.date_of_birth));
    push("Age", s.age === null ? null : `${s.age} years`);
    push("Gender", s.gender);
    push("Blood group", s.blood_group);
    push("Nationality", s.nationality);
    push("Mother tongue", s.mother_tongue);
    push("Religion", s.religion);
    push("Email", s.email);
    push("Phone", s.phone);
    push(
      "Address",
      [s.address?.line1, s.address?.line2, s.address?.city, s.address?.state, s.address?.pincode]
        .filter(Boolean)
        .join(", "),
    );
    push(
      "Emergency contact",
      [s.emergency_contact_name, s.emergency_contact_phone].filter(Boolean).join(" \u00b7 "),
    );
    push("Status", s.status);
  } else if (tab === "guardians") {
    if (!detail.guardians.length) rows.push(["Guardians", "None recorded"]);
    detail.guardians.forEach((g) => {
      push(`${g.full_name}${g.is_primary ? " (primary)" : ""}`, g.relationship);
      push("  Contact", [g.phone, g.alternate_phone].filter(Boolean).join(" / ") || null);
      push("  Email", g.email);
      push("  Occupation", g.occupation);
      push("  Emergency contact", g.is_emergency_contact ? "Yes" : "No");
      push("  Portal access", g.has_portal_account ? "Enabled" : "Not enabled");
    });
  } else if (tab === "academics") {
    const results = detail.academics.results;
    if (!results.length) rows.push(["Examinations", "No results published"]);
    results.forEach((r) => {
      push(r.name, r.published ? (r.percentage === null ? "Not graded" : formatPercent(r.percentage)) : "Unpublished");
      r.papers.forEach((paper) => {
        push(`  ${paper.subject}`, paper.percentage === null ? "No marks" : formatPercent(paper.percentage));
      });
    });
    detail.academics.subject_performance.forEach((p) => {
      push(
        `${p.subject} average`,
        p.average === null ? "No average" : `${formatPercent(p.average)} over ${p.papers} papers`,
      );
    });
    detail.academics.enrollment_history.forEach((h) => {
      push(
        `${h.academic_year ?? "Year not recorded"} \u00b7 ${h.grade ?? "?"}${h.section ? ` ${h.section}` : ""}`,
        h.active ? `Current \u00b7 enrolled ${formatDate(h.enrolled_on)}` : "Previous",
      );
    });
  } else if (tab === "attendance") {
    const a = detail.attendance.summary;
    push("Overall", a.percentage === null ? "Not recorded" : formatPercent(a.percentage));
    push("Sessions marked", a.marked_sessions);
    push("Present", a.present);
    push("Absent", a.absent);
    push("Late", a.late);
    push("Half day", a.half_day);
    push("Leave", a.leave);
    detail.attendance.trend.forEach((t) => push(`${t.month}`, `${formatPercent(t.percentage)} over ${t.sessions} sessions`));
    detail.attendance.absences.slice(0, 12).forEach((x) => push(formatDate(x.date), x.notes ?? x.status));
    detail.attendance.leaves.forEach((l) => {
      push(`${l.leave_type} \u00b7 ${formatDate(l.from_on)}`, `${l.days} day(s) \u00b7 ${l.status}`);
    });
  } else if (tab === "fees") {
    const f = detail.fees.summary;
    push("Billed", formatMoney(f.billed));
    push("Paid", formatMoney(f.paid));
    push("Outstanding", formatMoney(f.outstanding));
    push("Overdue invoices", `${f.overdue_count} \u00b7 ${formatMoney(f.overdue_amount)}`);
    detail.fees.accounts.forEach((a) => {
      push(
        `Fee account \u00b7 ${a.status}`,
        `Total ${formatMoney(a.total_fee)}, paid ${formatMoney(a.paid_amount)}`,
      );
      if (a.scholarship) push("  Scholarship", formatMoney(a.scholarship));
      if (a.concession) push("  Concession", formatMoney(a.concession));
    });
    detail.fees.installments.forEach((i) => {
      push(
        `${i.label} \u00b7 due ${formatDate(i.due_on)}`,
        `${formatMoney(i.amount)} \u00b7 ${i.status}`,
      );
    });
    detail.fees.invoices.forEach((i) => {
      push(
        `${i.invoice_no}${i.due_on ? ` \u00b7 due ${formatDate(i.due_on)}` : ""}`,
        `${formatMoney(i.total)}, paid ${formatMoney(i.paid_amount)} \u00b7 ${i.status}`,
      );
    });
  } else if (tab === "documents") {
    if (!detail.documents.length) rows.push(["Documents", "None uploaded"]);
    detail.documents.forEach((d) => {
      push(d.title || d.file_name, d.category);
      push("  Status", `${d.verification_status}${d.expires_on ? ` \u00b7 expires ${formatDate(d.expires_on)}` : ""}`);
      push("  Uploaded", formatDate(d.uploaded_on));
    });
  } else if (tab === "health") {
    const record = detail.health.record;
    if (!record) rows.push(["Health record", "Not recorded"]);
    else Object.entries(record).forEach(([key, value]) => push(key.replace(/_/g, " "), value));
    detail.health.incidents.forEach((i) => {
      push(
        `${formatDate(i.incident_date)} \u00b7 ${i.severity}`,
        [i.summary, i.action_taken, i.notified_guardian ? "Guardian notified" : null].filter(Boolean).join(" \u00b7 "),
      );
    });
  } else if (tab === "activities") {
    if (!detail.activities.length) rows.push(["Activities", "None recorded"]);
    detail.activities.forEach((a) => {
      push(a.name, [a.category, a.role, a.participation].filter(Boolean).join(" \u00b7 "));
      push("  Achievement", a.achievement ?? a.award);
      push("  Dates", [formatDate(a.started_on), formatDate(a.ended_on)].filter((x) => x !== "\u2014").join(" \u2192 "));
    });
  } else if (tab === "observations") {
    if (!detail.observations.length) rows.push(["Observations", "None recorded"]);
    detail.observations.forEach((o) => {
      push(`${formatDate(o.observed_on)} \u00b7 ${o.category}`, o.body);
      if (o.classroom_participation !== null) push("  Participation", formatPercent(o.classroom_participation));
      push("  Action taken", o.action_taken);
      push("  Support needed", o.support_needed ? "Yes" : "No");
      push("  Shared with guardian", o.visible_to_guardians ? "Yes" : "No");
    });
  } else if (tab === "communications") {
    if (!detail.communications.length) rows.push(["Messages", "No correspondence"]);
    detail.communications.forEach((c) => {
      push(c.subject ?? c.kind, `${c.guardian ?? "School"} \u00b7 ${formatDate(c.occurred_at)}`);
      push("  Outcome", c.outcome ?? c.notes);
    });
  } else if (tab === "admission") {
    if (!detail.admission.length) rows.push(["Admission", "No application history"]);
    detail.admission.forEach((a) => {
      push(`Application \u00b7 ${a.status}`, a.applied_on ? `Applied ${formatDate(a.applied_on)}` : null);
      push("  Admitted", a.admitted_on ? formatDate(a.admitted_on) : null);
      push("  Previous school", a.previous_school);
      push("  Previous class", a.previous_class);
      push("  Previous board", a.previous_board);
      push("  Type", a.admission_type);
      push("  Remarks", a.remarks);
      if (a.withdrawn_on) push("Withdrawn", `${formatDate(a.withdrawn_on)} \u00b7 ${a.withdrawal_reason ?? ""}`);
      if (a.graduated_on) push("Graduated", formatDate(a.graduated_on));
    });
  } else if (tab === "library") {
    const l = detail.library;
    push("Books currently issued", l.current_count);
    push("Overdue", l.overdue_count);
    push("Outstanding fines", formatMoney(l.total_fines));
    l.loans.forEach((loan) => {
      push(
        loan.book_title,
        `${formatDate(loan.issued_on)} \u00b7 ${loan.status}${loan.due_on ? ` \u00b7 due ${formatDate(loan.due_on)}` : ""}`,
      );
    });
  } else if (tab === "account") {
    const a = detail.account;
    push("Portal access", a.has_account ? "Enabled" : "Not enabled");
    /* The USN is the pupil's username. Listing it as "Username" here created a
       second identity next to the USN in the drawer for the same value. */
    push("USN", s.usn ?? a.login_identifier);
    push("Full name", a.full_name);
    push("Role", a.role);
    push("Status", a.status);
    push("Issued", a.issued_at ? formatDate(a.issued_at) : null);
    push("Linked guardians", a.linked_parents);
  }

  if (!rows.length) {
    return (
      <div className="empty-state">
        <p className="panel-subtitle">Nothing recorded in this section yet.</p>
      </div>
    );
  }

  return (
    <div className="drawer-facts">
      {rows.map(([label, value], index) => (
        <div className="drawer-fact" key={`${label}-${index}`}>
          <span className="summary-label">{label}</span>
          <span className="summary-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

function SkeletonRow({ mayEdit, maySeeFees }: { mayEdit: boolean; maySeeFees: boolean }) {
  // Must match the header: Student, USN, Class, Section, Roll, Attendance,
  // Average, Guardian — plus Fees and the checkbox when the role may see them.
  const cells = 8 + (maySeeFees ? 1 : 0) + (mayEdit ? 1 : 0);
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
    usn: student?.usn ?? "",
    date_of_birth: student?.date_of_birth ?? "",
    gender: student?.gender ?? "",
    status: student?.status ?? "active",
    guardian_name: student?.guardian_name ?? "",
    guardian_phone: "",
    guardian_email: "",
    joined_on: student?.joined_on ?? "",
    photo_url: student?.photo_url ?? "",
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
        usn: form.usn.trim() || undefined,
        date_of_birth: form.date_of_birth || undefined,
        gender: form.gender || undefined,
        status: form.status,
        guardian_name: form.guardian_name.trim() || undefined,
        guardian_phone: form.guardian_phone.trim() || undefined,
        guardian_email: form.guardian_email.trim() || undefined,
        joined_on: form.joined_on || undefined,
        ...(form.photo_url !== (student?.photo_url ?? "")
          ? { photo_url: form.photo_url }
          : {}),
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

          <ProfilePhotoPicker
            name={[form.first_name, form.last_name].filter(Boolean).join(" ") || "Student"}
            photoUrl={form.photo_url || null}
            folder={`student-avatars/${student?.id ?? "new"}`}
            onChange={(url) => set("photo_url")(url ?? "")}
          />

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
              USN
              <input
                value={form.usn}
                onChange={(e) => set("usn")(e.target.value)}
                placeholder={student ? undefined : "Leave blank to generate one"}
              />
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
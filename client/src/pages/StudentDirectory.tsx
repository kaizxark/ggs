import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  CalendarDays,
  Check,
  ChevronDown,
  CreditCard,
  Download,
  ExternalLink,
  Filter,
  GraduationCap,
  Layers,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
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
import { StudentDocumentsPanel } from "@/components/StudentDocuments";
import { canEditStudent, canManageFees, ALL_STUDENT_SECTIONS, type StudentSection } from "@shared/student-access";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/erp-views";
import { SmoothFilterDropdown } from "@/components/SmoothFilterDropdown";
import { FormSelect } from "@/components/FormSelect";

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

function studentFromProfile(data: ProfilePayload): DirectoryStudent {
  const s = data.student;
  return {
    id: s.id,
    usn: s.usn ?? "",
    first_name: s.first_name ?? "",
    last_name: s.last_name ?? "",
    name: s.name || `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Pupil",
    date_of_birth: s.date_of_birth ?? null,
    gender: s.gender ?? null,
    status: s.status ?? "active",
    photo_url: s.photo_url ?? null,
    joined_on: s.joined_on ?? null,
    grade: data.class?.grade ?? null,
    section: data.class?.section ?? null,
    roll_no: data.class?.roll_no ?? null,
    enrolment_status: data.class?.enrolment_status ?? "active",
    attendance_percentage: data.attendance?.summary?.percentage ?? null,
    attendance_records: data.attendance?.summary?.marked_sessions ?? 0,
    academic_average: null,
    scored_papers: data.academics?.results?.length ?? 0,
    fees: null,
    outstanding_fees: data.fees?.summary?.outstanding,
    total_fees: data.fees?.summary?.billed,
    guardian_name: data.guardians?.[0]?.full_name ?? null,
  };
}

export interface StudentDirectoryProps {
  /** Open this student's slide drawer or profile on first render, from a deep link. */
  openStudentId?: string | null;
  openMode?: "drawer" | "profile";
  onStudentOpened?: () => void;
  onBack?: () => void;
  className?: string;
}

export function formatGradeLabel(g?: string | null): string {
  if (!g) return "";
  const trimmed = String(g).trim();
  if (/^(unassigned|all)/i.test(trimmed)) return trimmed;
  if (/^(lkg|ukg|nursery|pre-kg|kg)/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^\d+$/.test(trimmed)) return `Class ${trimmed}`;
  if (!/^(class|grade)\b/i.test(trimmed)) return `Class ${trimmed}`;
  return trimmed;
}

export function StudentDirectory({ openStudentId, openMode = "drawer", onStudentOpened, onBack }: StudentDirectoryProps) {
  const currentUser = useCurrentUser();
  const [page, setPage] = useState<DirectoryPage | null>(null);
  const [options, setOptions] = useState<DirectoryOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const role = page?.role || currentUser?.role || "administrator";

  const [filters, setFilters] = useState<DirectoryFilters>({
    search: "",
    grade: "",
    section: "",
    status: "",
    year: "",
    attendance: "",
    fees: "",
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
  const [fallbackDrawerStudent, setFallbackDrawerStudent] = useState<DirectoryStudent | null>(null);
  const [drawerWide, setDrawerWide] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<DirectoryStudent | null>(null);
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

  const rows = page?.students ?? [];

  // A deep link from the AI assistant or the Overview/Command palette opens the slide drawer or profile.
  useEffect(() => {
    if (openStudentId) {
      if (openMode === "profile") {
        setProfileId(openStudentId);
      } else {
        setDrawerId(openStudentId);
        setProfileId(null);
        const matchingRow = rows.find((r) => r.id === openStudentId);
        if (matchingRow) {
          setFallbackDrawerStudent(matchingRow);
        } else {
          setFallbackDrawerStudent((prev) =>
            prev?.id === openStudentId
              ? prev
              : {
                  id: openStudentId,
                  usn: "",
                  first_name: "",
                  last_name: "",
                  name: "Pupil record",
                  date_of_birth: null,
                  gender: null,
                  status: "active",
                  photo_url: null,
                  joined_on: null,
                  grade: null,
                  section: null,
                  roll_no: null,
                  enrolment_status: "active",
                  attendance_percentage: null,
                  attendance_records: 0,
                  academic_average: null,
                  scored_papers: 0,
                  fees: null,
                  guardian_name: null,
                }
          );
          fetchStudentProfile(openStudentId)
            .then((data) => {
              setFallbackDrawerStudent(studentFromProfile(data));
            })
            .catch(() => {});
        }
      }
      onStudentOpened?.();
    }
  }, [openStudentId, openMode, rows, onStudentOpened]);

  /*
   * The row the drawer is showing. Resolved from the current page, or fallback
   * from the deep link profile when opening a pupil not on the first page.
   */
  const drawer = useMemo(
    () =>
      rows.find((row) => row.id === drawerId) ??
      (fallbackDrawerStudent?.id === drawerId ? fallbackDrawerStudent : null),
    [rows, drawerId, fallbackDrawerStudent]
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

  const activeFilters = useMemo(() => {
    const list: Array<{ id: string; label: string; onRemove: () => void }> = [];
    if (filters.search) {
      list.push({
        id: "search",
        label: `"${filters.search}"`,
        onRemove: () => {
          setSearchDraft("");
          setFilter({ search: "" });
        },
      });
    }
    if (filters.grade) {
      list.push({
        id: "grade",
        label: formatGradeLabel(filters.grade),
        onRemove: () => setFilter({ grade: "" }),
      });
    }
    if (filters.section) {
      list.push({
        id: "section",
        label: `Section ${filters.section}`,
        onRemove: () => setFilter({ section: "" }),
      });
    }
    if (filters.status && filters.status !== "all") {
      list.push({
        id: "status",
        label: `Status: ${filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}`,
        onRemove: () => setFilter({ status: "" }),
      });
    }
    return list;
  }, [filters]);

  const activeFilterCount = activeFilters.length;

  const clearAllFilters = () => {
    setSearchDraft("");
    setFilters((prev) => ({
      ...prev,
      search: "",
      grade: "",
      section: "",
      status: "",
      year: "",
      attendance: "",
      fees: "",
      admissionFrom: "",
      admissionTo: "",
      page: 1,
    }));
  };

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
            {/* Quick Status Segmented Pills */}
            <div className="segmented-control" role="group" aria-label="Filter by enrollment status">
              <button
                type="button"
                className={!filters.status || filters.status === "all" ? "active" : ""}
                onClick={() => setFilter({ status: "" })}
              >
                All
              </button>
              <button
                type="button"
                className={filters.status === "active" ? "active" : ""}
                onClick={() => setFilter({ status: "active" })}
              >
                Active
              </button>
              <button
                type="button"
                className={filters.status === "withdrawn" ? "active" : ""}
                onClick={() => setFilter({ status: "withdrawn" })}
              >
                Withdrawn
              </button>
            </div>

            {/* Smart Class Filter */}
            <SmoothFilterDropdown
              label="All classes"
              icon={<GraduationCap size={14} />}
              value={filters.grade ?? ""}
              onChange={(val) => setFilter({ grade: val })}
              ariaLabel="Filter by class"
              options={[
                { value: "", label: "All classes" },
                ...(options?.grades ?? []).map((g) => ({
                  value: g,
                  label: formatGradeLabel(g),
                })),
              ]}
            />

            {/* Section Filter */}
            <SmoothFilterDropdown
              label="All sections"
              icon={<Layers size={14} />}
              value={filters.section ?? ""}
              onChange={(val) => setFilter({ section: val })}
              ariaLabel="Filter by section"
              options={[
                { value: "", label: "All sections" },
                ...(options?.sections ?? []).map((s) => ({
                  value: s,
                  label: `Section ${s}`,
                })),
              ]}
            />
          </div>
        </div>

        {/* Active Filter Badges Bar */}
        {activeFilterCount > 0 && (
          <div className="active-filters-bar">
            <span className="active-filters-label">Active filters:</span>
            {activeFilters.map((f) => (
              <span key={f.id} className="active-filter-chip">
                <span>{f.label}</span>
                <button
                  type="button"
                  onClick={f.onRemove}
                  aria-label={`Remove filter ${f.label}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              className="clear-all-filters-btn"
              onClick={clearAllFilters}
            >
              Reset all ({activeFilterCount})
            </button>
          </div>
        )}

        <div className="table-scroll" role="region" aria-busy={loading} aria-label="Student list" tabIndex={0}>
          {loading && <span className="sr-only">Loading students</span>}
          <table className="data-table">
            <thead>
              <tr>
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
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} maySeeFees={maySeeFees} />)
                : rows.map((student) => (
                    <StudentRow
                      key={student.id}
                      student={student}
                      mayEdit={mayEdit}
                      maySeeFees={maySeeFees}
                      open={drawerId === student.id}
                      onOpenDrawer={() => setDrawerId(student.id)}
                      onOpenProfile={() => setProfileId(student.id)}
                      onEdit={() => setEditing(student)}
                    />
                  ))}
            </tbody>
          </table>

          {!loading && rows.length === 0 && (
            <div className="empty-state">
              <Users size={22} className="text-[var(--text-muted)]" />
              <p className="panel-title" style={{ fontSize: 15, marginTop: 6 }}>
                {activeFilterCount || searchDraft
                  ? "No students match these filters"
                  : "No students have been registered yet"}
              </p>
              <p className="panel-subtitle">
                {activeFilterCount || searchDraft
                  ? "Try adjusting your class, section, attendance, or status filters."
                  : "Get started by registering the first pupil to the roll call."}
              </p>
              {Boolean(activeFilterCount || searchDraft) && (
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={clearAllFilters}
                  style={{ marginTop: 10 }}
                >
                  <RotateCcw size={13} />
                  Reset all filters
                </button>
              )}
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
          onClose={() => {
            setDrawerId(null);
            setFallbackDrawerStudent(null);
          }}
          onOpenProfile={() => {
            setProfileId(drawer.id);
            setDrawerId(null);
            setFallbackDrawerStudent(null);
          }}
          onEdit={() => {
            setDrawerId(null);
            setFallbackDrawerStudent(null);
            setEditing(drawer);
          }}
        />
      )}

      {showAdd && (
        <StudentDialog
          title="Add a student"
          description="Create a comprehensive student record with academic placement, personal, guardian, and emergency details."
          submitLabel="Create student"
          options={options}
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
          options={options}
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
  onOpenDrawer,
  onOpenProfile,
  onEdit,
}: {
  student: DirectoryStudent;
  mayEdit: boolean;
  maySeeFees: boolean;
  open: boolean;
  onOpenDrawer: () => void;
  onOpenProfile: () => void;
  onEdit: () => void;
}) {
  return (
    <tr
      className={`row-clickable${open ? " row-selected" : ""}`}
      onClick={onOpenDrawer}
      aria-expanded={open}
    >
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
        <span className="grade-chip">{formatGradeLabel(student.grade) || "Unassigned"}</span>
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
  admission: "Admission",
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
        {tab === "documents" ? (
          <div className="drawer-section">
            <StudentDocumentsPanel studentId={student.id} studentName={student.name} />
          </div>
        ) : (
          <>
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
          </>
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
  if (tab === "documents") {
    return (
      <div className="drawer-section">
        <StudentDocumentsPanel studentId={student.id} studentName={student.name} />
      </div>
    );
  }

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

function SkeletonRow({ maySeeFees }: { maySeeFees: boolean }) {
  // Must match the header: Student, USN, Class, Section, Roll, Attendance,
  // Average, Guardian — plus Fees when the role may see them.
  const cells = 8 + (maySeeFees ? 1 : 0);
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
  options,
  student,
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  submitLabel: string;
  options?: DirectoryOptions | null;
  student?: DirectoryStudent;
  onClose: () => void;
  onSubmit: (draft: StudentDraft) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<"academic" | "personal" | "guardian" | "address">("academic");
  const [form, setForm] = useState({
    full_name: student?.name || [student?.first_name, student?.last_name].filter(Boolean).join(" ") || "",
    usn: student?.usn ?? "",
    grade: student?.grade ?? "",
    section: student?.section ?? "",
    roll_no: student?.roll_no ? String(student.roll_no) : "",
    status: student?.status ?? "active",
    joined_on: student?.joined_on ?? new Date().toISOString().slice(0, 10),
    photo_url: student?.photo_url ?? "",
    date_of_birth: student?.date_of_birth ?? "",
    gender: student?.gender ?? "",
    blood_group: "",
    nationality: "Indian",
    mother_tongue: "",
    religion: "",
    email: student?.email ?? "",
    phone: student?.phone ?? "",
    guardian_name: student?.guardian_name ?? "",
    guardian_relation: "Father",
    guardian_phone: student?.guardian_phone ?? "",
    guardian_email: student?.guardian_email ?? "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    address_line1: "",
    address_line2: "",
    city: "Bengaluru",
    district: "Bengaluru Urban",
    state: "Karnataka",
    pincode: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const availableGrades = useMemo(() => {
    if (options?.grades && options.grades.length > 0) return options.grades;
    return ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
  }, [options]);

  const availableSections = useMemo(() => {
    if (options?.sections && options.sections.length > 0) return options.sections;
    return ["A", "B", "C", "D"];
  }, [options]);

  const validateTab = (tab: "academic" | "personal" | "guardian" | "address"): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (tab === "academic") {
      if (!form.full_name.trim()) errs.full_name = "Enter student's full name.";
      if (!form.grade) errs.grade = "Select student's class.";
      if (!form.section) errs.section = "Select student's section.";
      if (!form.roll_no.trim()) errs.roll_no = "Enter roll number.";
      if (!form.joined_on) errs.joined_on = "Select admission date.";
    } else if (tab === "personal") {
      if (!form.date_of_birth) errs.date_of_birth = "Enter date of birth.";
      if (!form.gender) errs.gender = "Select student's gender.";
      if (!form.blood_group) errs.blood_group = "Select blood group.";
    } else if (tab === "guardian") {
      if (!form.guardian_name.trim()) errs.guardian_name = "Enter primary guardian's full name.";
      if (!form.guardian_relation) errs.guardian_relation = "Select relationship.";
      const gPhone = form.guardian_phone.trim().replace(/\D/g, "");
      if (!gPhone || gPhone.length < 10) errs.guardian_phone = "Enter a valid 10-digit mobile number.";
    } else if (tab === "address") {
      if (!form.address_line1.trim()) errs.address_line1 = "Enter street / flat / house address.";
      if (!form.city.trim()) errs.city = "Enter city.";
      const pin = form.pincode.trim().replace(/\D/g, "");
      if (!pin || pin.length < 6) errs.pincode = "Enter a valid 6-digit postal PIN code.";
      if (!form.emergency_contact_name.trim()) errs.emergency_contact_name = "Enter emergency contact name.";
      const ePhone = form.emergency_contact_phone.trim().replace(/\D/g, "");
      if (!ePhone || ePhone.length < 10) errs.emergency_contact_phone = "Enter a valid 10-digit contact number.";
    }
    return errs;
  };

  const validateAll = (): Record<string, string> => {
    return {
      ...validateTab("academic"),
      ...validateTab("personal"),
      ...validateTab("guardian"),
      ...validateTab("address"),
    };
  };

  const handleNext = () => {
    const tabErrs = validateTab(activeTab);
    if (Object.keys(tabErrs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...tabErrs }));
      setError("Please fill out the required fields in this section.");
      return;
    }
    setError(null);
    if (activeTab === "academic") setActiveTab("personal");
    else if (activeTab === "personal") setActiveTab("guardian");
    else if (activeTab === "guardian") setActiveTab("address");
  };

  const handleBack = () => {
    setError(null);
    if (activeTab === "personal") setActiveTab("academic");
    else if (activeTab === "guardian") setActiveTab("personal");
    else if (activeTab === "address") setActiveTab("guardian");
  };

  const submit = async () => {
    const allErrs = validateAll();
    if (Object.keys(allErrs).length > 0) {
      setFieldErrors(allErrs);
      if (allErrs.full_name || allErrs.grade || allErrs.section || allErrs.roll_no || allErrs.joined_on) {
        setActiveTab("academic");
      } else if (allErrs.date_of_birth || allErrs.gender || allErrs.blood_group) {
        setActiveTab("personal");
      } else if (allErrs.guardian_name || allErrs.guardian_relation || allErrs.guardian_phone) {
        setActiveTab("guardian");
      } else {
        setActiveTab("address");
      }
      setError("Please complete all required fields marked with * to proceed.");
      return;
    }

    const trimmedFullName = form.full_name.trim();
    const parts = trimmedFullName.split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || firstName;

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: trimmedFullName,
        first_name: firstName,
        last_name: lastName,
        usn: form.usn.trim() || undefined,
        grade: form.grade || undefined,
        section: form.section || undefined,
        roll_no: form.roll_no.trim() || undefined,
        date_of_birth: form.date_of_birth || undefined,
        gender: form.gender || undefined,
        status: form.status,
        joined_on: form.joined_on || undefined,
        blood_group: form.blood_group || undefined,
        nationality: form.nationality.trim() || undefined,
        mother_tongue: form.mother_tongue.trim() || undefined,
        religion: form.religion.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        guardian_name: form.guardian_name.trim() || undefined,
        guardian_relation: form.guardian_relation.trim() || undefined,
        guardian_phone: form.guardian_phone.trim() || undefined,
        guardian_email: form.guardian_email.trim() || undefined,
        emergency_contact_name: form.emergency_contact_name.trim() || undefined,
        emergency_contact_phone: form.emergency_contact_phone.trim() || undefined,
        ...(form.photo_url !== (student?.photo_url ?? "") ? { photo_url: form.photo_url } : {}),
        address: form.address_line1.trim()
          ? {
              line1: form.address_line1.trim(),
              line2: form.address_line2.trim() || undefined,
              city: form.city.trim() || undefined,
              district: form.district.trim() || undefined,
              state: form.state.trim() || undefined,
              pincode: form.pincode.trim() || undefined,
              country: "India",
            }
          : undefined,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        if (!Object.keys(err.fieldErrors).length) setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "That student could not be saved.");
      }
    } finally {
      setSaving(false);
    }
  };

  const hasAcademicError = Boolean(fieldErrors.full_name || fieldErrors.grade || fieldErrors.section || fieldErrors.roll_no || fieldErrors.joined_on);
  const hasPersonalError = Boolean(fieldErrors.date_of_birth || fieldErrors.gender || fieldErrors.blood_group);
  const hasGuardianError = Boolean(fieldErrors.guardian_name || fieldErrors.guardian_relation || fieldErrors.guardian_phone);
  const hasAddressError = Boolean(fieldErrors.address_line1 || fieldErrors.city || fieldErrors.pincode || fieldErrors.emergency_contact_name || fieldErrors.emergency_contact_phone);

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        style={{
          width: "min(720px, 94vw)",
          height: "min(680px, 90vh)",
          minHeight: "min(680px, 90vh)",
          maxHeight: "min(680px, 90vh)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 18,
          overflow: "hidden",
          background: "rgba(20, 21, 26, 0.94)",
          backdropFilter: "blur(36px) saturate(190%)",
          WebkitBackdropFilter: "blur(36px) saturate(190%)",
          border: "1px solid var(--border-strong)",
          boxShadow: "0 28px 72px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        }}
      >
        <div
          className="modal-header"
          style={{
            padding: "16px 22px 12px",
            flexShrink: 0,
            background: "rgba(24, 25, 32, 0.88)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <h2 className="panel-title">{title}</h2>
            <p className="panel-subtitle" style={{ margin: "2px 0 0" }}>{description}</p>
          </div>
          <button
            type="button"
            className="search-clear"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Apple Segmented Section Tabs */}
        <div style={{ padding: "0 22px 14px", background: "rgba(24, 25, 32, 0.88)", flexShrink: 0 }}>
          <div className="segmented-control" style={{ width: "100%", height: 34 }}>
            <button
              type="button"
              className={activeTab === "academic" ? "active" : ""}
              onClick={() => setActiveTab("academic")}
              style={{ flex: 1, position: "relative" }}
            >
              Academic
              {hasAcademicError && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--danger, #ff453a)", marginLeft: 6, display: "inline-block" }} />
              )}
            </button>
            <button
              type="button"
              className={activeTab === "personal" ? "active" : ""}
              onClick={() => setActiveTab("personal")}
              style={{ flex: 1, position: "relative" }}
            >
              Personal & Bio
              {hasPersonalError && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--danger, #ff453a)", marginLeft: 6, display: "inline-block" }} />
              )}
            </button>
            <button
              type="button"
              className={activeTab === "guardian" ? "active" : ""}
              onClick={() => setActiveTab("guardian")}
              style={{ flex: 1, position: "relative" }}
            >
              Guardian
              {hasGuardianError && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--danger, #ff453a)", marginLeft: 6, display: "inline-block" }} />
              )}
            </button>
            <button
              type="button"
              className={activeTab === "address" ? "active" : ""}
              onClick={() => setActiveTab("address")}
              style={{ flex: 1, position: "relative" }}
            >
              Address & Emergency
              {hasAddressError && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--danger, #ff453a)", marginLeft: 6, display: "inline-block" }} />
              )}
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 22px" }}>
          {error && (
            <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          {activeTab === "academic" && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <ProfilePhotoPicker
                  name={form.full_name || "Student"}
                  photoUrl={form.photo_url || null}
                  folder={`student-avatars/${student?.id ?? "new"}`}
                  onChange={(url) => set("photo_url")(url ?? "")}
                />
              </div>

              <div className="form-grid">
                <label style={{ gridColumn: "span 2" }}>
                  Full name *
                  <input
                    value={form.full_name}
                    onChange={(e) => set("full_name")(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    autoFocus
                  />
                  {fieldErrors.full_name && <span className="field-error">{fieldErrors.full_name}</span>}
                </label>

                <label>
                  Enrolled Class / Grade *
                  <FormSelect
                    value={form.grade}
                    onChange={set("grade")}
                    options={availableGrades.map((g) => ({
                      value: g,
                      label: formatGradeLabel(g),
                    }))}
                    placeholder="Select class…"
                    error={fieldErrors.grade}
                  />
                  {fieldErrors.grade && <span className="field-error">{fieldErrors.grade}</span>}
                </label>

                <label>
                  Section *
                  <FormSelect
                    value={form.section}
                    onChange={set("section")}
                    options={availableSections.map((s) => ({
                      value: s,
                      label: `Section ${s}`,
                    }))}
                    placeholder="Select section…"
                    error={fieldErrors.section}
                  />
                  {fieldErrors.section && <span className="field-error">{fieldErrors.section}</span>}
                </label>

                <label>
                  Roll Number *
                  <input
                    value={form.roll_no}
                    onChange={(e) => set("roll_no")(e.target.value)}
                    placeholder="e.g. 14"
                  />
                  {fieldErrors.roll_no && <span className="field-error">{fieldErrors.roll_no}</span>}
                </label>

                <label>
                  Admission date *
                  <input
                    type="date"
                    value={form.joined_on ?? ""}
                    onChange={(e) => set("joined_on")(e.target.value)}
                  />
                  {fieldErrors.joined_on && <span className="field-error">{fieldErrors.joined_on}</span>}
                </label>

                <label>
                  USN / Admission Number
                  <input
                    value={form.usn}
                    onChange={(e) => set("usn")(e.target.value)}
                    placeholder={student ? undefined : "Auto-generated (e.g. GGS1001) if blank"}
                  />
                  {fieldErrors.usn && <span className="field-error">{fieldErrors.usn}</span>}
                </label>

                <label>
                  Enrollment status
                  <FormSelect
                    value={form.status ?? "active"}
                    onChange={set("status")}
                    options={[
                      { value: "active", label: "Active (Enrolled)" },
                      { value: "inactive", label: "Inactive" },
                      { value: "graduated", label: "Graduated" },
                      { value: "withdrawn", label: "Withdrawn" },
                    ]}
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === "personal" && (
            <div className="form-grid">
              <label>
                Date of birth *
                <input
                  type="date"
                  value={form.date_of_birth ?? ""}
                  onChange={(e) => set("date_of_birth")(e.target.value)}
                />
                {fieldErrors.date_of_birth && <span className="field-error">{fieldErrors.date_of_birth}</span>}
              </label>

              <label>
                Gender *
                <FormSelect
                  value={form.gender ?? ""}
                  onChange={set("gender")}
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                  ]}
                  placeholder="Select gender…"
                  error={fieldErrors.gender}
                />
                {fieldErrors.gender && <span className="field-error">{fieldErrors.gender}</span>}
              </label>

              <label>
                Blood group *
                <FormSelect
                  value={form.blood_group}
                  onChange={set("blood_group")}
                  options={["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => ({
                    value: bg,
                    label: bg,
                  }))}
                  placeholder="Select blood group…"
                  error={fieldErrors.blood_group}
                />
                {fieldErrors.blood_group && <span className="field-error">{fieldErrors.blood_group}</span>}
              </label>

              <label>
                Nationality
                <input
                  value={form.nationality}
                  onChange={(e) => set("nationality")(e.target.value)}
                  placeholder="e.g. Indian"
                />
              </label>

              <label>
                Mother tongue
                <input
                  value={form.mother_tongue}
                  onChange={(e) => set("mother_tongue")(e.target.value)}
                  placeholder="e.g. English, Kannada, Hindi"
                />
              </label>

              <label>
                Religion / Category
                <input
                  value={form.religion}
                  onChange={(e) => set("religion")(e.target.value)}
                  placeholder="e.g. General / Not specified"
                />
              </label>

              <label>
                Student personal email (Optional)
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email")(e.target.value)}
                  placeholder="student@example.com"
                />
              </label>

              <label>
                Student phone number (Optional)
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone")(e.target.value)}
                  placeholder="+91 Mobile number"
                />
              </label>
            </div>
          )}

          {activeTab === "guardian" && (
            <div className="form-grid">
              <label style={{ gridColumn: "span 2" }}>
                Primary guardian full name *
                <input
                  value={form.guardian_name}
                  onChange={(e) => set("guardian_name")(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  autoFocus
                />
                {fieldErrors.guardian_name && <span className="field-error">{fieldErrors.guardian_name}</span>}
              </label>

              <label>
                Relationship to student *
                <FormSelect
                  value={form.guardian_relation}
                  onChange={set("guardian_relation")}
                  options={[
                    { value: "Father", label: "Father" },
                    { value: "Mother", label: "Mother" },
                    { value: "Legal Guardian", label: "Legal Guardian" },
                    { value: "Parent", label: "Parent" },
                    { value: "Other", label: "Other" },
                  ]}
                  placeholder="Select relationship…"
                  error={fieldErrors.guardian_relation}
                />
                {fieldErrors.guardian_relation && <span className="field-error">{fieldErrors.guardian_relation}</span>}
              </label>

              <label>
                Guardian mobile phone *
                <input
                  type="tel"
                  value={form.guardian_phone}
                  onChange={(e) => set("guardian_phone")(e.target.value)}
                  placeholder="e.g. 9876543210"
                />
                {fieldErrors.guardian_phone && <span className="field-error">{fieldErrors.guardian_phone}</span>}
              </label>

              <label style={{ gridColumn: "span 2" }}>
                Guardian email address (Optional)
                <input
                  type="email"
                  value={form.guardian_email}
                  onChange={(e) => set("guardian_email")(e.target.value)}
                  placeholder="e.g. guardian@example.com"
                />
              </label>
            </div>
          )}

          {activeTab === "address" && (
            <div className="form-grid">
              <label style={{ gridColumn: "span 2" }}>
                Residential address (House/Flat No, Building, Street) *
                <input
                  value={form.address_line1}
                  onChange={(e) => set("address_line1")(e.target.value)}
                  placeholder="e.g. Flat 402, Palm Meadows"
                />
                {fieldErrors.address_line1 && <span className="field-error">{fieldErrors.address_line1}</span>}
              </label>

              <label style={{ gridColumn: "span 2" }}>
                Address Line 2 (Locality, Area, Landmark)
                <input
                  value={form.address_line2}
                  onChange={(e) => set("address_line2")(e.target.value)}
                  placeholder="e.g. Whitefield Main Road"
                />
              </label>

              <label>
                City *
                <input
                  value={form.city}
                  onChange={(e) => set("city")(e.target.value)}
                  placeholder="e.g. Bengaluru"
                />
                {fieldErrors.city && <span className="field-error">{fieldErrors.city}</span>}
              </label>

              <label>
                District
                <input
                  value={form.district}
                  onChange={(e) => set("district")(e.target.value)}
                  placeholder="e.g. Bengaluru Urban"
                />
              </label>

              <label>
                State
                <input
                  value={form.state}
                  onChange={(e) => set("state")(e.target.value)}
                  placeholder="e.g. Karnataka"
                />
              </label>

              <label>
                Postal PIN code *
                <input
                  value={form.pincode}
                  onChange={(e) => set("pincode")(e.target.value)}
                  placeholder="e.g. 560066"
                />
                {fieldErrors.pincode && <span className="field-error">{fieldErrors.pincode}</span>}
              </label>

              <label>
                Emergency contact person *
                <input
                  value={form.emergency_contact_name}
                  onChange={(e) => set("emergency_contact_name")(e.target.value)}
                  placeholder="Name of emergency contact"
                />
                {fieldErrors.emergency_contact_name && <span className="field-error">{fieldErrors.emergency_contact_name}</span>}
              </label>

              <label>
                Emergency phone number *
                <input
                  type="tel"
                  value={form.emergency_contact_phone}
                  onChange={(e) => set("emergency_contact_phone")(e.target.value)}
                  placeholder="10-digit mobile number"
                />
                {fieldErrors.emergency_contact_phone && <span className="field-error">{fieldErrors.emergency_contact_phone}</span>}
              </label>
            </div>
          )}
        </div>

        <div
          className="modal-footer"
          style={{
            borderTop: "1px solid var(--border)",
            padding: "14px 22px",
            flexShrink: 0,
            background: "rgba(24, 25, 32, 0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            {activeTab !== "academic" ? (
              <button
                type="button"
                className="secondary-button"
                onClick={handleBack}
              >
                ← Back
              </button>
            ) : (
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {activeTab !== "academic" && (
              <button type="button" className="text-button" onClick={onClose} style={{ padding: "0 8px" }}>
                Cancel
              </button>
            )}
            {activeTab !== "address" ? (
              <button
                type="button"
                className="primary-button"
                onClick={handleNext}
              >
                Next section →
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={() => void submit()}
                disabled={saving}
              >
                {saving ? "Saving…" : submitLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
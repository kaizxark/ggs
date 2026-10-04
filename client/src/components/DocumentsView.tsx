import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, FileCheck2, FileWarning, Loader2, Search, X } from "lucide-react";
import { Pager, usePagination } from "./ErpPagination";
import {
  DocIcon,
  DocumentChips,
  StudentDocumentsPanel,
} from "./StudentDocuments";
import { Breadcrumb } from "./Breadcrumb";
import { SkeletonTableRows } from "./ErpSkeleton";
import { avatarTones, useStudents, type RowId } from "../lib/school-data";
import { effectiveRole, isSuperAdminId } from "@shared/super-admin";
import {
  DOC_TYPES,
  REQUIRED_DOC_TYPES,
  docTypeById,
} from "../lib/student-documents";
import { supabase } from "../lib/supabase";

/** Per-student paperwork summary; counts only, never a filename. */
interface Coverage {
  have: number;
  required: number;
  missing: string[];
}

type CoverageMap = Record<string, Coverage>;

/**
 * Documents index.
 *
 * Answers the question an administrator actually has: whose paperwork is
 * incomplete? Coverage is fetched for one page of students at a time — asking
 * storage about all ninety at once would be ninety round trips, and the pager
 * means only twenty are ever on screen.
 */
export function DocumentsView({
  onBack,
  openStudentId,
  onStudentOpened,
}: {
  onBack: () => void;
  openStudentId?: RowId | null;
  onStudentOpened?: () => void;
}) {
  const { rows: students, loading } = useStudents();
  const [query, setQuery] = useState("");
  const [coverage, setCoverage] = useState<CoverageMap>({});
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [canView, setCanView] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      `${student.name} ${student.grade} ${student.section} ${student.admission_no ?? ""}`
        .toLowerCase()
        .includes(needle)
    );
  }, [students, query]);

  const pager = usePagination(filtered);
  const pageStudents = pager.pageRows;

  // Gating is enforced by the API; this only avoids showing a screen that will
  // only ever return 403.
  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setCanView(false);
        return;
      }
      // Id-based, so a renamed super admin is still recognised.
      if (isSuperAdminId(session.user.id)) {
        setCanView(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      const role = effectiveRole(session.user.id, data?.role);
      setCanView(role === "admin" || role === "super_admin");
    })();
  }, []);

  const pageKey = pageStudents.map((student) => student.id).join(",");

  const loadCoverage = useCallback(async () => {
    if (pageKey === "" || !canView) return;
    setCoverageLoading(true);
    setCoverageError(null);
    try {
      const ids = pageKey.split(",");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/documents?coverage=1&ids=${encodeURIComponent(ids.join(","))}`,
        {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        }
      );
      const payload = (await res.json().catch(() => null)) as
        | { coverage?: CoverageMap; message?: string }
        | null;
      if (!res.ok) {
        throw new Error(payload?.message ?? "Could not read coverage.");
      }
      setCoverage(payload?.coverage ?? {});
    } catch (err) {
      setCoverageError(
        err instanceof Error ? err.message : "Could not read coverage."
      );
    } finally {
      setCoverageLoading(false);
    }
  }, [pageKey, canView]);

  useEffect(() => {
    void loadCoverage();
  }, [loadCoverage]);

  // Arriving from search with a student id opens that profile directly.
  useEffect(() => {
    if (openStudentId == null) return;
    setSelected(String(openStudentId));
    onStudentOpened?.();
  }, [openStudentId, onStudentOpened]);

  const pageRows = pageStudents.map((student) => ({
    student,
    coverage: coverage[student.id] ?? null,
  }));

  const complete = pageRows.filter(
    (row) => row.coverage && row.coverage.missing.length === 0
  ).length;
  const documentsOnFile = pageRows.reduce(
    (sum, row) => sum + (row.coverage?.have ?? 0),
    0
  );
  const missingCount = pageRows.reduce(
    (sum, row) => sum + (row.coverage?.missing.length ?? 0),
    0
  );
  const selectedStudent = students.find(
    (student) => String(student.id) === selected
  );

  if (canView === false) {
    return (
      <div className="page-stack">
        <div className="page-intro">
          <div>
            <Breadcrumb
              parent="Global Kids School"
              current="Documents"
              onParentClick={onBack}
            />
            <h1 className="page-title">Documents</h1>
            <p className="page-subtitle">
              Not available for your role.
            </p>
          </div>
        </div>
        <section className="panel">
          <div className="doc-empty">
            <AlertCircle size={18} className="text-[#f0866f]" />
            <strong>Only an administrator can open student documents</strong>
            <span>
              Identity documents such as Aadhaar are restricted to admin and
              super-admin accounts.
            </span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="Documents"
            onParentClick={onBack}
          />
          <h1 className="page-title">Documents</h1>
          <p className="page-subtitle">
            {REQUIRED_DOC_TYPES.length} required per student ·{" "}
            {DOC_TYPES.length} types in total
          </p>
        </div>
      </div>

      <div className="metric-grid three">
        <div className="metric-block">
          <div className="metric-label">Complete on this page</div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="metric-value">{complete}</div>
            <span className="metric-change text-[#3fb8a2]">
              of {pageRows.length}
            </span>
          </div>
        </div>
        <div className="metric-block">
          <div className="metric-label">Gaps to close</div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="metric-value">{missingCount}</div>
            <span className="metric-change text-[#f0866f]">missing documents</span>
          </div>
        </div>
        <div className="metric-block">
          <div className="metric-label">Required on file</div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="metric-value">{documentsOnFile}</div>
            <span className="metric-change text-[#9aa6af]">this page</span>
          </div>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, admission ID or grade..."
            />
          </div>
          <div className="toolbar-actions">
            <span className="mini-label">
              {coverageLoading
                ? "Checking paperwork…"
                : `Required: ${REQUIRED_DOC_TYPES.map((type) => type.short).join(", ")}`}
            </span>
          </div>
        </div>

        {coverageError && (
          <div className="doc-notice">
            <AlertCircle size={15} className="text-[#f0866f]" />
            {coverageError}
          </div>
        )}

        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 780 }}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Grade</th>
                <th>Admission ID</th>
                <th>Required on file</th>
                <th>Missing</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading || coverageLoading ? (
                <SkeletonTableRows rows={8} columns={6} />
              ) : (
                pageRows.map(({ student, coverage: row }) => {
                  const done = row ? row.have : 0;
                  const total = row ? row.required : REQUIRED_DOC_TYPES.length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <tr
                      key={student.id}
                      className={`row-clickable ${
                        selected === String(student.id) ? "row-selected" : ""
                      }`}
                      onClick={() => setSelected(String(student.id))}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <span
                            className={`avatar avatar-sm ${
                              avatarTones[student.tone] ?? "teal"
                            }`}
                          >
                            {student.initials}
                          </span>
                          <span className="font-medium text-[#e7ebef]">
                            {student.name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="grade-chip">{student.grade}</span>
                      </td>
                      <td className="muted-cell">
                        {student.admission_no ?? student.id}
                      </td>
                      <td>
                        <div className="flex min-w-[132px] items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#232c33]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background:
                                  pct === 100 ? "var(--brand)" : "var(--warning)",
                              }}
                            />
                          </div>
                          <span
                            className={`font-medium ${
                              pct === 100
                                ? "text-[var(--brand)]"
                                : "text-[var(--text-hover)]"
                            }`}
                          >
                            {done}/{total}
                          </span>
                        </div>
                      </td>
                      <td>
                        {row ? (
                          <DocumentChips missing={row.missing} />
                        ) : (
                          <span className="muted-cell">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="tiny-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(String(student.id));
                          }}
                        >
                          <FileCheck2 size={13} />
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && !coverageLoading && (
          <Pager pagination={pager} noun="students" />
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">What counts as required</p>
            <h2 className="panel-title">Document types</h2>
          </div>
        </div>
        <div className="doc-type-grid">
          {DOC_TYPES.map((type) => (
            <div className="doc-type-card" key={type.id}>
              <span className={`doc-icon ${type.required ? "held" : ""}`}>
                <DocIcon type={type} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="doc-name">
                  {type.label}
                  {type.required ? (
                    <span className="status-pill success">Required</span>
                  ) : (
                    <span className="status-pill neutral">Optional</span>
                  )}
                </div>
                <div className="doc-meta">{type.hint}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="doc-note px-5 pb-5">
          {docTypeById("aadhaar")?.hint} Only admins and super-admins can open
          any of these files, and every download link expires after five minutes.
        </p>
      </section>

      {selected &&
        selectedStudent &&
        createPortal(
          <>
            <div className="drawer-scrim" onClick={() => setSelected(null)} />
            <div className="profile-drawer">
              <div className="drawer-header">
                <div>
                  <p className="eyebrow">Documents</p>
                  <h3>{selectedStudent.name}</h3>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setSelected(null)}
                  aria-label="Close documents"
                >
                  <X size={17} />
                </button>
              </div>
              <div className="drawer-stats">
                <div>
                  <span>Grade</span>
                  <strong>{selectedStudent.grade}</strong>
                </div>
                <div>
                  <span>Section</span>
                  <strong>{selectedStudent.section}</strong>
                </div>
                <div>
                  <span>Admission</span>
                  <strong className="text-[13px]">
                    {selectedStudent.admission_no ?? selectedStudent.id}
                  </strong>
                </div>
              </div>
              <div className="drawer-scroll">
                <StudentDocumentsPanel
                  studentId={String(selectedStudent.id)}
                  studentName={selectedStudent.name}
                />
              </div>
            </div>
          </>,
          document.body
        )}

      {coverageLoading && pageStudents.length === 0 && (
        <p className="mini-label flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading documents…
        </p>
      )}
      {missingCount > 0 && !coverageLoading && (
        <p className="mini-label flex items-center gap-2">
          <FileWarning size={14} /> {missingCount} required document
          {missingCount === 1 ? "" : "s"} missing across this page.
        </p>
      )}
    </div>
  );
}
/* ------------------------------------------------------------------ *
 * ERP view layer
 *
 * The dashboard UI reads flat, denormalised rows (a student's `name`,
 * `grade`, `attendance`, `fees`, ...). The database stores normalised
 * tables (students, enrollments, classrooms, attendance, exam_results,
 * invoices, ...). Querying one table and handing the rows straight to a
 * component therefore renders undefined for every derived field.
 *
 * This module fetches the real tables and composes them into the shapes
 * the UI expects. If Supabase is unreachable it falls back to the mock
 * rows, so the dashboard still renders offline.
 * ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  registerDataInvalidator,
  useDataRevision,
} from "./live-data";
import { useRealtimeInvalidation } from "./use-realtime";
import {
  ROLE_LABELS,
  effectiveRole,
  isSuperAdminId,
} from "@shared/super-admin";
import {
  type ActivityCategory,
  type ActivityItem,
  type Announcement,
  type AttendanceDaily,
  type ClassAttendanceRow,
  type Exam,
  type ExamResult,
  type FeeCategory,
  type FinanceMonth,
  type HealthMetric,
  type Invoice,
  type LibraryBook,
  type NotificationItem,
  type ParentMessage,
  type Payment,
  type PerformanceTrend,
  type ReportExport,
  type ScheduleItem,
  type StaffMember,
  type Student,
  type SubjectAverage,
  type SubjectRow,
  type TimetableEntry,
  getAnnualFeeForGrade,
  mockAttendanceData,
  mockClassAttendance,
  mockFeeCategories,
} from "./school-data";
import {
  getStoredInvoices,
  getStoredPayments,
  getStudentFeeOverrides,
} from "./fee-store";

// The report screens import these shapes from the view layer rather than
// reaching past it into `school-data`, so the view module is the one public
// surface for a row type.
export type { Invoice, StaffMember, Student };

/* ------------------------------------------------------------------ */
/* Low-level fetching                                                  */
/* ------------------------------------------------------------------ */

/** PostgREST caps a response at 1000 rows; page through the rest. */
const PAGE = 1000;

/**
 * Row-level cache.
 *
 * Several views need the same table (attendance is read by five of them), and
 * each read was paging through the whole table independently. That turned the
 * first paint into dozens of duplicate round trips. Caching on table+columns
 * collapses those into one request per distinct projection, and the in-flight
 * promise is shared so concurrent callers await the same fetch.
 */
const rowCache = new Map<string, Promise<Record<string, unknown>[]>>();

function fetchAll(
  table: string,
  columns: string,
  orderBy?: string,
  limit?: number
): Promise<Record<string, unknown>[]> {
  const key = `${table}|${columns}|${orderBy ?? ""}|${limit ?? ""}`;
  const hit = rowCache.get(key);
  if (hit) return hit;

  const promise = (async () => {
    const applyOrder = <T extends { order: (c: string, o: { ascending: boolean }) => T }>(
      q: T,
    ): T => (orderBy ? q.order(orderBy, { ascending: true }) : q);

    const firstLimit = limit ? Math.min(limit, PAGE) : PAGE;
    const { data: firstPage, error: firstError, count } = await applyOrder(
      supabase.from(table).select(columns, { count: "exact" }).range(0, firstLimit - 1),
    );
    if (firstError) throw new Error(`${table}: ${firstError.message}`);

    const effectiveTotal = limit ? Math.min(limit, count ?? 0) : (count ?? 0);
    if (effectiveTotal <= firstLimit || (firstPage?.length ?? 0) >= effectiveTotal) {
      return (firstPage ?? []) as unknown as Record<string, unknown>[];
    }

    const pageCount = Math.ceil(effectiveTotal / PAGE);
    const remainingPages = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, i) => {
        const pageIdx = i + 1;
        const pageStart = pageIdx * PAGE;
        const pageEnd = Math.min(pageStart + PAGE - 1, effectiveTotal - 1);
        return applyOrder(
          supabase.from(table).select(columns).range(pageStart, pageEnd),
        ).then(({ data, error }) => {
          if (error) throw new Error(`${table}: ${error.message}`);
          return (data ?? []) as unknown as Record<string, unknown>[];
        });
      })
    );
    const out = [...((firstPage ?? []) as unknown as Record<string, unknown>[])];
    for (const page of remainingPages) out.push(...page);
    return out;
  })().catch((e) => {
    rowCache.delete(key); // never cache a failure
    throw e;
  });

  rowCache.set(key, promise);
  return promise;
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

const TONES = ["teal", "violet", "amber", "rose", "blue", "orange", "indigo", "pink"] as const;

/** Stable pseudo-random tone from a string, so a student keeps their colour. */
function toneFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

const initialsOf = (first: string, last: string) =>
  `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const fmtDay = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
};

/** "2 days ago" / "3 hrs ago" / "Yesterday" */
function relative(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((now - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return fmtDay(iso);
}

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const titleCase = (s: string) =>
  s.replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

/* ------------------------------------------------------------------ */
/* Cache: one fetch per dataset per session, shared across views       */
/* ------------------------------------------------------------------ */

type CacheEntry = { at: number; promise: Promise<unknown> };
const cache = new Map<string, CacheEntry>();
const TTL = 30_000;

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise as Promise<T>;
  const promise = load().catch((e) => {
    cache.delete(key); // never cache a failure
    throw e;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise as Promise<T>;
}

/** Called on sign-out / refresh so a new login never shows stale data. */
export function clearErpCache() {
  cache.clear();
  rowCache.clear();
}

registerDataInvalidator(clearErpCache);

/**
 * Which database tables each view reads.
 *
 * Realtime is subscribed per view rather than globally so a change to, say,
 * `announcements` does not reload the fee ledger. The list mirrors the
 * `fetchAll` calls in the loader directly below it; aggregate views that use
 * an RPC list the tables that RPC reads.
 */
const VIEW_TABLES: Record<string, string[]> = {
  students: ["students", "enrollments", "classrooms", "attendance", "exam_results", "invoices"],
  staff: ["staff", "profiles"],
  attendance_daily: ["attendance", "classrooms", "students"],
  class_attendance: ["attendance", "classrooms", "students"],
  dashboard_attendance: ["attendance", "classrooms", "students", "enrollments"],
  student_counts: ["students"],
  invoices: ["invoices", "students", "classrooms", "enrollments", "payments"],
  payments: ["payments", "invoices", "students"],
  finance_monthly: ["payments", "invoices"],
  fee_categories: ["invoices"],
  exams: ["examinations", "classrooms"],
  exam_results: ["exam_results", "examinations", "students", "classrooms", "enrollments"],
  subjects: ["exam_results", "staff", "classrooms"],
  subject_averages: ["exam_results", "staff", "classrooms"],
  grade_outcomes: ["exam_results", "classrooms", "enrollments", "attendance"],
  performance_trend: ["examinations", "exam_results"],
  health_metrics: ["attendance", "exam_results", "invoices", "payments"],
  announcements: ["announcements"],
  messages: ["messages", "profiles"],
  notifications: ["notifications"],
  people: ["staff", "profiles"],
  library_books: ["library_books", "library_loans"],
  schedule: ["schedule"],
  report_exports: ["report_exports"],
  timetable: ["settings", "timetable"],
  activity_log: ["activity_log", "activities", "activity_participations"],
};

/**
 * Drop the raw-table cache for the tables a realtime event touched.
 *
 * `fetchAll` has no TTL: it is cleared by `notifyDataChanged` after a local
 * write. A remote write has to clear it the same way, otherwise the view
 * re-runs its loader and receives the cached pre-change rows.
 */
function invalidateRows(tables: readonly string[]) {
  if (!tables.length) return;
  for (const key of rowCache.keys()) {
    if (tables.some((table) => key.startsWith(`${table}|`))) {
      rowCache.delete(key);
    }
  }
}

/* ------------------------------------------------------------------ */
/* View loader                                                         */
/* ------------------------------------------------------------------ */

export interface ErpView<T> {
  rows: T[];
  loading: boolean;
  error: string | null;
  source: "mock" | "db";
  reload: () => void;
  /** Optimistic local patch for view-only flags (published, graded, unread). */
  update: (id: string | number, patch: Partial<T>) => Promise<boolean>;
}

function useErpView<T extends { id: string | number }>(
  key: string,
  load: () => Promise<T[]>,
  mockRows: T[],
  deps: unknown[] = [],
  enabled = true
): ErpView<T> {
  // Start empty rather than seeded with the mock rows. Seeding them made the
  // dashboard paint placeholder students (and their counts) for a frame before
  // the real query resolved, which read as a glitch. The mocks are now only a
  // genuine fallback for when Supabase is actually unreachable.
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"mock" | "db">("db");
  const [nonce, setNonce] = useState(0);
  const revision = useDataRevision();
  const tables = VIEW_TABLES[key] ?? [];
  const realtimeRevision = useRealtimeInvalidation(tables);
  const handledRealtime = useRef(0);
  const mockRef = useRef(mockRows);
  mockRef.current = mockRows;
  const loadRef = useRef(load);
  loadRef.current = load;
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setSource("db");
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    // A remote write must not be answered from the row cache. Local writes go
    // through `clearErpCache`; realtime invalidation has to do the same for
    // just the tables this view reads.
    if (realtimeRevision !== handledRealtime.current) {
      handledRealtime.current = realtimeRevision;
      if (realtimeRevision > 0) {
        cache.delete(`${key}:${nonce}`);
        invalidateRows(tables);
      }
    }
    // Only show loading skeleton on initial mount; keep rendered data steady during revalidations
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setError(null);
    void (async () => {
      try {
        const data = await cached(`${key}:${nonce}`, () => loadRef.current());
        if (cancelled) return;
        setRows(data);
        setSource("db");
        hasLoadedRef.current = true;
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Supabase unreachable");
        setRows(mockRef.current);
        setSource("mock");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce, enabled, revision, realtimeRevision, ...deps]);

  const reload = useCallback(() => {
    hasLoadedRef.current = false;
    cache.delete(`${key}:${nonce}`);
    setNonce((n) => n + 1);
  }, [key, nonce]);

  // These flags are presentation state, not schema columns, so they are
  // patched locally only. A reload returns them to the database truth.
  const update = useCallback(async (id: string | number, patch: Partial<T>) => {
    setRows((current) =>
      current.map((row) =>
        String(row.id) === id ? ({ ...row, ...patch } as T) : row
      )
    );
    return true;
  }, []);

  return { rows, loading, error, source, reload, update };
}

/* ------------------------------------------------------------------ */
/* Students — needs students + enrollments + classrooms + attendance    */
/*           + exam_results + invoices                                  */
/* ------------------------------------------------------------------ */

async function loadStudents(): Promise<Student[]> {
  const [students, enrollments, classrooms, attendance, results, invoices] =
    await Promise.all([
      fetchAll("students", "id,first_name,last_name,status,usn,email"),
      fetchAll("enrollments", "student_id,classroom_id,active"),
      fetchAll("classrooms", "id,grade,section,room,class_teacher_id"),
      fetchAll("attendance", "id,student_id,classroom_id,attendance_date,status", "attendance_date", 1000),
      fetchAll("exam_results", "id,student_id,examination_id,subject,marks,max_marks,grade"),
      fetchAll("invoices", "id,invoice_no,student_id,due_on,total,paid_amount,status"),
    ]);

  if (!students || students.length === 0) {
    return [];
  }

  const classroomById = new Map(classrooms.map((c) => [String(c.id), c]));

  // grade / section from the active enrollment
  const classOf = new Map<string, Record<string, unknown>>();
  for (const e of enrollments) {
    if (e.active === false) continue;
    const room = classroomById.get(String(e.classroom_id));
    if (room) classOf.set(String(e.student_id), room);
  }

  // attendance rate: strictly binary present vs absent
  const attTotal = new Map<string, { total: number; ok: number }>();
  for (const a of attendance) {
    const key = String(a.student_id);
    const cur = attTotal.get(key) ?? { total: 0, ok: 0 };
    cur.total++;
    if (a.status === "present") cur.ok++;
    attTotal.set(key, cur);
  }

  // academic average across all published papers
  const marks = new Map<string, { sum: number; n: number }>();
  for (const r of results) {
    if (r.grade === "Ab") continue; // absent — not a mark
    const max = num(r.max_marks);
    if (max <= 0) continue;
    const key = String(r.student_id);
    const cur = marks.get(key) ?? { sum: 0, n: 0 };
    cur.sum += num(r.marks) / max;
    cur.n++;
    marks.set(key, cur);
  }

  // fee standing
  const feeByStudent = new Map<string, { total: number; paid: number; status: string }>();
  for (const inv of invoices) {
    const key = String(inv.student_id);
    const cur =
      feeByStudent.get(key) ?? { total: 0, paid: 0, status: String(inv.status) };
    cur.total += num(inv.total);
    cur.paid += num(inv.paid_amount);
    // the worst status across a student's invoices is what matters
    if (cur.status !== "overdue" && inv.status === "overdue") cur.status = "overdue";
    else if (cur.status === "paid" && inv.status !== "paid") cur.status = String(inv.status);
    feeByStudent.set(key, cur);
  }

  return students.map((s) => {
    const first = String(s.first_name ?? "");
    const last = String(s.last_name ?? "");
    const id = String(s.id);
    const room = classOf.get(id);
    const att = attTotal.get(id);
    const mk = marks.get(id);
    const fee = feeByStudent.get(id);

    const attendancePct = att && att.total > 0 ? Math.round((att.ok / att.total) * 100) : 0;
    const average = mk && mk.n > 0 ? Math.round((mk.sum / mk.n) * 100) : 0;
    // The raw counts travel with the row because 0 is ambiguous on its own:
    // a pupil with no attendance rows looks identical to one who was absent
    // every single day, and the assistant would report the latter.
    const attendance_records = att?.total ?? 0;
    const scored_papers = mk?.n ?? 0;
    const outstanding = fee ? fee.total - fee.paid : 0;

    return {
      id,
      name: `${first} ${last}`.trim(),
      initials: initialsOf(first, last),
      grade: room ? `Grade ${room.grade}` : "Unassigned",
      section: room ? String(room.section) : "—",
      attendance: attendancePct,
      attendance_records,
      average,
      scored_papers,
      fees: outstanding <= 0 ? "Paid" : fee?.status === "draft" ? "Draft" : "Due",
      status: s.status === "active" ? "Active" : "Review",
      tone: toneFor(id),
      // the human-facing USN, e.g. adm26270041
      usn: String(s.usn ?? id),
      // Carried so a finance desk can prefill a receipt address it already holds.
      email: s.email ? String(s.email) : null,
    } as unknown as Student;
  });
}

export function useStudentsView(enabled = true) {
  return useErpView<Student>("students", loadStudents, [], [], enabled);
}

/* ------------------------------------------------------------------ */
/* Staff                                                               */
/* ------------------------------------------------------------------ */

async function loadStaff(): Promise<StaffMember[]> {
  const [staff, profiles] = await Promise.all([
    fetchAll("staff", "id,usn,name,designation,department,email,active,profile_id"),
    fetchAll("profiles", "id,avatar_url"),
  ]);
  const photoByProfile = new Map(
    profiles.map((profile) => [
      String(profile.id),
      String(profile.avatar_url ?? "").trim() || null,
    ])
  );
  return staff.map((s) => {
    const name = String(s.name ?? "");
    const parts = name.replace(/^(Dr|Mr|Mrs|Ms|Smt)\.?\s+/i, "").trim().split(/\s+/);
    const first = parts[0] ?? "";
    const last = parts[parts.length - 1] ?? "";
    return {
      id: String(s.id),
      usn: String(s.usn ?? "—"),
      name,
      initials: initialsOf(first, last),
      role: String(s.designation ?? "Staff"),
      department: String(s.department ?? "—"),
      email: String(s.email ?? ""),
      // staff attendance is not tracked in the schema; show them as on duty
      attendance: 100,
      status: s.active === false ? "On leave" : "On campus",
      tone: toneFor(String(s.id)),
      photo_url: photoByProfile.get(String(s.profile_id ?? "").trim()) ?? null,
    };
  });
}

export function useStaffView() {
  return useErpView<StaffMember>("staff", loadStaff, []);
}

/* ------------------------------------------------------------------ */
/* Attendance — aggregate the per-day rows into a weekly roll-up         */
/* ------------------------------------------------------------------ */

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface DashboardAttendanceData {
  daily: AttendanceDaily[];
  classes: ClassAttendanceRow[];
  belowThreshold: number;
}

type DashboardAttendanceRow = DashboardAttendanceData & { id: string };

async function loadDashboardAttendance(): Promise<DashboardAttendanceRow[]> {
  const { data, error } = await supabase.rpc("dashboard_attendance");
  if (error) throw new Error(`dashboard_attendance: ${error.message}`);

  const payload = (data ?? {}) as {
    daily?: Array<{
      date: string;
      present?: number;
      absent?: number;
      late?: number;
      leave?: number;
    }>;
    classes?: Array<{
      id: string;
      grade?: string;
      section?: string;
      teacher?: string;
      present?: number;
      total?: number;
    }>;
    belowThreshold?: number;
  };

  const daily = (payload.daily ?? []).map((row) => ({
    id: String(row.date),
    date: String(row.date),
    label: fmtDay(String(row.date)),
    day:
      DAY_LABELS[new Date(`${row.date}T00:00:00Z`).getUTCDay()] ??
      String(row.date),
    present: num(row.present),
    absent: num(row.absent) + num(row.late) + num(row.leave),
  }));

  const classes = (payload.classes ?? []).map((row) => {
    const total = num(row.total);
    const present = num(row.present);
    return {
      id: String(row.id),
      label: `Grade ${row.grade ?? "—"} — ${row.section ?? "—"}`,
      value: total > 0 ? Math.round((present / total) * 100) : 0,
      present,
      total,
      teacher: String(row.teacher ?? "Unassigned"),
    };
  });

  return [
    {
      id: "dashboard_attendance",
      daily,
      classes,
      belowThreshold: num(payload.belowThreshold),
    },
  ];
}

async function loadAttendanceDaily(): Promise<AttendanceDaily[]> {
  try {
    const rows = await loadDashboardAttendance();
    if (rows[0]?.daily && rows[0].daily.length > 0) {
      return rows[0].daily;
    }
  } catch {
    // offline or RPC unavailable fallback
  }
  return mockAttendanceData;
}

export function useAttendanceDailyView() {
  return useErpView<AttendanceDaily>("attendance_daily", loadAttendanceDaily, mockAttendanceData);
}

async function loadClassAttendance(): Promise<ClassAttendanceRow[]> {
  try {
    const rows = await loadDashboardAttendance();
    if (rows[0]?.classes && rows[0].classes.length > 0) {
      return rows[0].classes;
    }
  } catch {
    // offline or RPC unavailable fallback
  }
  return mockClassAttendance;
}

export function useClassAttendanceView() {
  return useErpView<ClassAttendanceRow>("class_attendance", loadClassAttendance, mockClassAttendance);
}

/**
 * One small RPC instead of paging every attendance row into the browser.
 * The overview needs three aggregates; computing them in Postgres keeps the
 * first paint off the 12k-row attendance table.
 */
export function useDashboardAttendance(enabled = true) {
  const view = useErpView<DashboardAttendanceRow>(
    "dashboard_attendance",
    loadDashboardAttendance,
    [],
    [],
    enabled
  );
  const row = view.rows[0];
  return {
    daily: row?.daily ?? [],
    classes: row?.classes ?? [],
    belowThreshold: row?.belowThreshold ?? 0,
    loading: view.loading,
    error: view.error,
    source: view.source,
    reload: view.reload,
  };
}

type StudentCountRow = { id: string; total: number; active: number };

async function loadStudentCounts(): Promise<StudentCountRow[]> {
  const rows = await fetchAll("students", "id,status");
  return [
    {
      id: "student_counts",
      total: rows.length,
      active: rows.filter(
        (row) => String(row.status ?? "").toLowerCase() === "active"
      ).length,
    },
  ];
}

/** The sidebar and overview need headcounts, not the full student roll-up. */
export function useStudentCountsView(enabled = true) {
  const view = useErpView<StudentCountRow>(
    "student_counts",
    loadStudentCounts,
    [{ id: "student_counts", total: 0, active: 0 }],
    [],
    enabled
  );
  const row = view.rows[0];
  return {
    total: row?.total ?? 0,
    active: row?.active ?? 0,
    loading: view.loading,
    error: view.error,
    source: view.source,
    reload: view.reload,
  };
}

/* ------------------------------------------------------------------ */
/* Finance                                                             */
/* ------------------------------------------------------------------ */

async function loadInvoices(): Promise<Invoice[]> {
  const [invoices, students, classrooms, enrollments, payments] = await Promise.all([
    fetchAll("invoices", "id,invoice_no,student_id,due_on,total,paid_amount,status").catch(() => []),
    fetchAll("students", "id,first_name,last_name,status,usn,grade,section,email").catch(() => []),
    fetchAll("classrooms", "id,grade,section").catch(() => []),
    fetchAll("enrollments", "student_id,classroom_id,active").catch(() => []),
    fetchAll("payments", "id,invoice_id,amount,paid_at,receipt_no").catch(() => []),
  ]);

  const storedInvoices = getStoredInvoices();
  const storedPayments = getStoredPayments();
  const overrides = getStudentFeeOverrides();

  const classroomById = new Map(classrooms.map((c) => [String(c.id), c]));
  const classOf = new Map<string, Record<string, unknown>>();
  for (const e of enrollments) {
    if (e.active === false) continue;
    const room = classroomById.get(String(e.classroom_id));
    if (room) classOf.set(String(e.student_id), room);
  }

  // Payments mapped by invoice id
  const paymentsByInvoice = new Map<string, number>();
  for (const p of payments) {
    if (p.invoice_id) {
      const invId = String(p.invoice_id);
      paymentsByInvoice.set(invId, (paymentsByInvoice.get(invId) ?? 0) + num(p.amount));
    }
  }
  for (const sp of storedPayments) {
    if (sp.invoice_id) {
      const invId = String(sp.invoice_id);
      paymentsByInvoice.set(invId, (paymentsByInvoice.get(invId) ?? 0) + num(sp.amount));
    }
  }

  // DB Invoices indexed by student_id
  const dbInvoicesByStudent = new Map<string, Record<string, unknown>>();
  for (const inv of invoices) {
    if (inv.student_id) {
      dbInvoicesByStudent.set(String(inv.student_id), inv);
    }
  }

  // Stored invoices indexed by studentId and student name
  const storedByStudentId = new Map<string, typeof storedInvoices[0]>();
  const storedByStudentName = new Map<string, typeof storedInvoices[0]>();
  for (const si of storedInvoices) {
    if (si.studentId) storedByStudentId.set(si.studentId.toLowerCase(), si);
    if (si.student) storedByStudentName.set(si.student.toLowerCase(), si);
  }

  const result: Invoice[] = [];
  const processedStudentIds = new Set<string>();
  const processedInvoiceIds = new Set<string>();

  // Iterate over all active/enrolled students
  if (students.length > 0) {
    for (const s of students) {
      const sId = String(s.id);
      processedStudentIds.add(sId);
      const name = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Student";
      const surname = s.last_name ? String(s.last_name) : name.split(" ").slice(-1)[0] || "Family";
      const room = classOf.get(sId);
      const gradeStr = room ? `Grade ${room.grade}` : s.grade ? (String(s.grade).startsWith("Grade") ? String(s.grade) : `Grade ${s.grade}`) : "Grade 6";
      const sectionStr = room ? String(room.section) : String(s.section || "A");
      const annualFee = getAnnualFeeForGrade(gradeStr);

      const dbInv = dbInvoicesByStudent.get(sId);
      const storedInv = storedByStudentId.get(sId.toLowerCase()) || storedByStudentName.get(name.toLowerCase());
      const override = overrides[sId] || overrides[name.toLowerCase()];

      const invId = storedInv?.id || (dbInv?.invoice_no ? String(dbInv.invoice_no) : dbInv?.id ? String(dbInv.id) : `INV-2026-${sId.slice(-4) || String(result.length + 1001)}`);
      processedInvoiceIds.add(invId);

      // Determine paid amount
      let paid = 0;
      if (override) {
        paid = override.paid_fees;
      } else if (storedInv) {
        paid = storedInv.paid;
      } else if (dbInv) {
        const invPaid = num(dbInv.paid_amount);
        const invPmt = paymentsByInvoice.get(String(dbInv.id)) || paymentsByInvoice.get(String(dbInv.invoice_no)) || 0;
        paid = Math.max(invPaid, invPmt);
      } else {
        const stuPmts = storedPayments.filter(p => p.student.toLowerCase() === name.toLowerCase());
        paid = stuPmts.reduce((sum, p) => sum + p.amount, 0);
      }

      // Check if direct payments exist in storedPayments for this invoice ID
      const directPayments = storedPayments.filter(p => p.invoice_id === invId);
      const directSum = directPayments.reduce((s, p) => s + p.amount, 0);
      if (directSum > paid) {
        paid = directSum;
      }

      paid = Math.min(annualFee, paid);
      const outstanding = Math.max(0, annualFee - paid);

      const dueDate = dbInv?.due_on ? fmtDate(String(dbInv.due_on)) : storedInv?.due_date || "15 Oct 2026";
      const isOverdue = dueDate.includes("Sep") || (dueDate < "2026-11-01" && outstanding > 0);

      let status: "Paid" | "Partial" | "Overdue" | "Due";
      if (outstanding === 0) {
        status = "Paid";
      } else if (paid > 0) {
        status = "Partial";
      } else if (isOverdue) {
        status = "Overdue";
      } else {
        status = "Due";
      }

      result.push({
        id: invId,
        student_id: sId,
        studentId: sId,
        family: `${surname} family`,
        student: name,
        grade: gradeStr,
        section: sectionStr,
        due_date: dueDate,
        total: annualFee,
        paid,
        outstanding,
        amount: outstanding > 0 ? outstanding : annualFee,
        status,
        usn: String(s.usn ?? sId),
      } as unknown as Invoice);
    }
  }

  // Include any stored invoices not yet matched
  for (const si of storedInvoices) {
    if (!processedInvoiceIds.has(si.id) && !processedStudentIds.has(si.studentId || "")) {
      const annualFee = getAnnualFeeForGrade(si.grade);
      const paid = Math.min(annualFee, si.paid || 0);
      const outstanding = Math.max(0, annualFee - paid);
      result.push({
        id: si.id,
        student_id: si.studentId,
        studentId: si.studentId,
        family: si.family || `${si.student} family`,
        student: si.student,
        grade: si.grade || "Grade 6",
        section: si.section || "A",
        due_date: si.due_date || "15 Oct 2026",
        total: annualFee,
        paid,
        outstanding,
        amount: outstanding > 0 ? outstanding : annualFee,
        status: outstanding === 0 ? "Paid" : paid > 0 ? "Partial" : si.status,
      } as unknown as Invoice);
    }
  }

  return result.sort((a, b) => b.amount - a.amount);
}

export function useInvoicesView(enabled = true) {
  return useErpView<Invoice>("invoices", loadInvoices, [], [], enabled);
}

async function loadPayments(): Promise<Payment[]> {
  const [payments, invoices, students] = await Promise.all([
    fetchAll("payments", "id,invoice_id,receipt_no,amount,method,paid_at,reference").catch(() => []),
    fetchAll("invoices", "id,invoice_no,student_id,due_on,total,paid_amount,status").catch(() => []),
    fetchAll("students", "id,first_name,last_name,status,usn,email").catch(() => []),
  ]);
  const invById = new Map(invoices.map((i) => [String(i.id), i]));
  const stuById = new Map(students.map((s) => [String(s.id), s]));
  const dbMapped: Payment[] = payments.map((p) => {
    const inv = invById.get(String(p.invoice_id));
    const s = inv ? stuById.get(String(inv.student_id)) : undefined;
    return {
      id: String(p.id),
      invoice_id: inv ? String(inv.invoice_no) : null,
      student: s ? `${s.first_name} ${s.last_name}`.trim() : "Unknown student",
      amount: num(p.amount),
      method: String(p.method ?? "Bank transfer"),
      paid_at: String(p.paid_at ?? ""),
      receipt_no: String(p.receipt_no ?? `RCP/26-27/${String(p.id).slice(-4)}`),
      reference: p.reference ? String(p.reference) : null,
      recipient_email: s?.email ? String(s.email) : null,
    };
  });

  const stored = getStoredPayments();
  const seenReceipts = new Set(dbMapped.map(p => p.receipt_no).filter(Boolean));
  const seenIds = new Set(dbMapped.map(p => p.id));

  for (const sp of stored) {
    if (!seenIds.has(sp.id) && (!sp.receipt_no || !seenReceipts.has(sp.receipt_no))) {
      dbMapped.push({
        id: sp.id,
        invoice_id: sp.invoice_id,
        student: sp.student,
        amount: sp.amount,
        method: sp.method,
        paid_at: sp.paid_at,
        receipt_no: sp.receipt_no,
        reference: sp.reference || null,
        recipient_email: sp.recipient_email || null,
      });
      if (sp.receipt_no) seenReceipts.add(sp.receipt_no);
      seenIds.add(sp.id);
    }
  }

  return dbMapped.sort((a, b) => b.paid_at.localeCompare(a.paid_at));
}

export function usePaymentsView() {
  return useErpView<Payment>("payments", loadPayments, []);
}

const ACADEMIC_YEAR_MONTHS: Array<{ id: string; month: string }> = [
  { id: "2026-04", month: "Apr" },
  { id: "2026-05", month: "May" },
  { id: "2026-06", month: "Jun" },
  { id: "2026-07", month: "Jul" },
  { id: "2026-08", month: "Aug" },
  { id: "2026-09", month: "Sep" },
  { id: "2026-10", month: "Oct" },
  { id: "2026-11", month: "Nov" },
  { id: "2026-12", month: "Dec" },
  { id: "2027-01", month: "Jan" },
  { id: "2027-02", month: "Feb" },
  { id: "2027-03", month: "Mar" },
];

async function loadFinanceMonthly(): Promise<FinanceMonth[]> {
  const [payments, invoices] = await Promise.all([
    loadPayments(),
    loadInvoices(),
  ]);

  const totalBilled = invoices.reduce((sum, inv) => sum + (inv.total ?? inv.amount ?? 50000), 0);

  // Group payments by month (YYYY-MM)
  const monthlyCollected = new Map<string, number>();
  for (const p of payments) {
    const m = (p.paid_at || "").slice(0, 7);
    if (m) {
      monthlyCollected.set(m, (monthlyCollected.get(m) ?? 0) + p.amount);
    }
  }

  let cumulativeCollected = 0;
  return ACADEMIC_YEAR_MONTHS.map((slot) => {
    const got = monthlyCollected.get(slot.id) ?? 0;
    cumulativeCollected += got;
    const remaining = Math.max(0, totalBilled - cumulativeCollected);

    return {
      id: slot.id,
      month: slot.month,
      // Both series must be cumulative to share an axis: a per-month
      // collection plotted against a cumulative outstanding balance made the
      // "pending" bars tower over "collected" even when most fees were paid.
      collected: Math.round((cumulativeCollected / 100000) * 10) / 10,
      pending: Math.round((remaining / 100000) * 10) / 10,
    };
  });
}

export function useFinanceMonthlyView() {
  return useErpView<FinanceMonth>("finance_monthly", loadFinanceMonthly, []);
}

async function loadFeeCategories(): Promise<FeeCategory[]> {
  const invoices = await loadInvoices();
  const totalBilled = invoices.reduce(
    (sum, inv) => sum + (inv.total ?? inv.amount ?? 0),
    0
  );

  const gradeTotals = new Map<string, number>();
  for (const inv of invoices) {
    const grade = String((inv as { grade?: string }).grade ?? "").trim();
    if (!grade) continue;
    gradeTotals.set(
      grade,
      (gradeTotals.get(grade) ?? 0) + (inv.total ?? inv.amount ?? 0)
    );
  }

  // No invoices means no mix to show. Inventing five equal slices made an
  // empty year look like a real fee structure.
  if (totalBilled <= 0) return [];

  const colors: Record<string, string> = {
    "Grade 6": "#2f6f68",
    "Grade 7": "#4f8f85",
    "Grade 8": "#6fb0a5",
    "Grade 9": "#1d504a",
    "Grade 10": "#0f3833",
  };

  return Array.from(gradeTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([grade, amount], idx) => {
      const pct = Math.round((amount / totalBilled) * 1000) / 10;
      const annualFee = /9|10/.test(grade) ? 60000 : 50000;
      return {
        id: `fc-${idx + 1}`,
        name: `${grade} (₹${annualFee.toLocaleString("en-IN")})`,
        value: Math.round(pct),
        color: colors[grade] ?? ["#2f6f68", "#4f8f85", "#6fb0a5", "#1d504a", "#0f3833"][idx % 5],
      };
    });
}

export function useFeeCategoriesView() {
  return useErpView<FeeCategory>("fee_categories", loadFeeCategories, mockFeeCategories);
}

/* ------------------------------------------------------------------ */
/* Academics                                                           */
/* ------------------------------------------------------------------ */

async function loadExams(): Promise<Exam[]> {
  const [exams, classrooms] = await Promise.all([
    fetchAll("examinations", "id,name,starts_on,ends_on,published"),
    fetchAll("classrooms", "id,grade,section,room,class_teacher_id"),
  ]);
  const out: Exam[] = [];
  for (const e of exams) {
    const published = e.published === true;
    for (const c of classrooms) {
      out.push({
        id: `${e.id}-${c.id}`,
        name: String(e.name),
        subject: "All subjects",
        grade: `Grade ${c.grade}`,
        date: fmtDate(String(e.starts_on)),
        time: "09:00 – 12:00",
        venue: String(c.room ?? "—"),
        status: published ? "Published" : "Scheduled",
      });
    }
  }
  return out;
}

export function useExamsView() {
  return useErpView<Exam>("exams", loadExams, []);
}

async function loadExamResults(): Promise<ExamResult[]> {
  const [results, exams, students, classrooms, enrollments] = await Promise.all([
    fetchAll("exam_results", "id,student_id,examination_id,subject,marks,max_marks,grade"),
    fetchAll("examinations", "id,name,starts_on,ends_on,published"),
    fetchAll("students", "id,first_name,last_name,status,usn"),
    fetchAll("classrooms", "id,grade,section,room,class_teacher_id"),
    fetchAll("enrollments", "student_id,classroom_id,active"),
  ]);
  const examById = new Map(exams.map((e) => [String(e.id), e]));
  const stuById = new Map(students.map((s) => [String(s.id), s]));
  const roomById = new Map(classrooms.map((c) => [String(c.id), c]));
  const classOf = new Map<string, Record<string, unknown>>();
  for (const e of enrollments) {
    if (e.active === false) continue;
    const room = roomById.get(String(e.classroom_id));
    if (room) classOf.set(String(e.student_id), room);
  }

  // aggregate per (exam, subject, grade) so the table reads as a mark sheet
  const agg = new Map<string, { sum: number; n: number; grades: string[]; published: boolean; id: string }>();
  for (const r of results) {
    const exam = examById.get(String(r.examination_id));
    const s = stuById.get(String(r.student_id));
    const room = classOf.get(String(r.student_id));
    if (!s || !room) continue;
    const gradeLetter = String(r.grade ?? "");
    const gradeLabel = gradeLetter === "Ab" ? "Absent" : gradeLetter;
    const key = `${exam?.name ?? "Exam"}|${r.subject}|${room.grade}|${gradeLabel}`;
    const cur = agg.get(key) ?? {
      sum: 0,
      n: 0,
      grades: [],
      published: exam?.published === true,
      id: String(r.id),
    };
    if (gradeLetter !== "Ab") {
      cur.sum += num(r.marks);
      cur.n++;
    }
    agg.set(key, cur);
  }

  return Array.from(agg.entries()).map(([key, v]) => {
    const [, subject, grade, gradeLetter] = key.split("|");
    return {
      id: v.id,
      subject: String(subject),
      grade: `Grade ${grade} — ${gradeLetter}`,
      graded: v.n,
      total: v.n,
      published: v.published,
    };
  });
}

export function useExamResultsView() {
  return useErpView<ExamResult>("exam_results", loadExamResults, []);
}

async function loadSubjects(): Promise<SubjectRow[]> {
  const [results, staff, classrooms] = await Promise.all([
    fetchAll("exam_results", "id,student_id,examination_id,subject,marks,max_marks,grade"),
    fetchAll("staff", "id,usn,name,designation,department,email,active"),
    fetchAll("classrooms", "id,grade,section,room,class_teacher_id"),
  ]);
  const bySubject = new Map<string, { sum: number; n: number }>();
  for (const r of results) {
    if (r.grade === "Ab") continue;
    const key = String(r.subject);
    const cur = bySubject.get(key) ?? { sum: 0, n: 0 };
    const max = num(r.max_marks);
    if (max > 0) {
      cur.sum += num(r.marks) / max;
      cur.n++;
    }
    bySubject.set(key, cur);
  }
  const teacherFor = (subject: string) => {
    const hit = staff.find((s) =>
      String(s.department ?? "").toLowerCase().includes(subject.split(" ")[0].toLowerCase())
    );
    return hit ? String(hit.name) : "Unassigned";
  };
  const grades = classrooms.length
    ? `Grades ${Math.min(...classrooms.map((c) => num(c.grade)))}–${Math.max(...classrooms.map((c) => num(c.grade)))}`
    : "—";
  return Array.from(bySubject.entries()).map(([subject, v]) => ({
    id: subject,
    name: subject,
    teacher: teacherFor(subject),
    classes: grades,
    periods: 0,
    progress: v.n > 0 ? Math.round((v.sum / v.n) * 100) : 0,
  }));
}

export function useSubjectsView() {
  return useErpView<SubjectRow>("subjects", loadSubjects, []);
}

async function loadSubjectAverages(): Promise<SubjectAverage[]> {
  const rows = await loadSubjects();
  return rows.map((r) => ({ id: r.id, subject: r.name.split(" ")[0], average: r.progress }));
}

export function useSubjectAveragesView() {
  return useErpView<SubjectAverage>("subject_averages", loadSubjectAverages, []);
}

async function loadGradeOutcomes(): Promise<{ id: string; grade: string; average: number; attendance: number; change: string }[]> {
  const [results, classrooms, enrollments, dashAttendance] = await Promise.all([
    fetchAll("exam_results", "id,student_id,examination_id,subject,marks,max_marks,grade"),
    fetchAll("classrooms", "id,grade,section,room,class_teacher_id"),
    fetchAll("enrollments", "student_id,classroom_id,active"),
    loadDashboardAttendance().catch(() => []),
  ]);
  const roomById = new Map(classrooms.map((c) => [String(c.id), c]));
  const classOf = new Map<string, string>();
  for (const e of enrollments) {
    if (e.active === false) continue;
    const room = roomById.get(String(e.classroom_id));
    if (room) classOf.set(String(e.student_id), String(room.grade));
  }
  const marks = new Map<string, { sum: number; n: number }>();
  for (const r of results) {
    if (r.grade === "Ab") continue;
    const key = classOf.get(String(r.student_id));
    if (!key) continue;
    const max = num(r.max_marks);
    if (max <= 0) continue;
    const cur = marks.get(key) ?? { sum: 0, n: 0 };
    cur.sum += num(r.marks) / max;
    cur.n++;
    marks.set(key, cur);
  }
  const att = new Map<string, { ok: number; total: number }>();
  for (const c of dashAttendance[0]?.classes ?? []) {
    const match = /Grade\s+(\d+)/i.exec(c.label);
    const key = match ? match[1] : "";
    if (!key) continue;
    const cur = att.get(key) ?? { ok: 0, total: 0 };
    cur.total += c.total;
    cur.ok += c.present;
    att.set(key, cur);
  }
  return Array.from(new Set(classOf.values()))
    .sort((a, b) => Number(a) - Number(b))
    .map((g) => {
      const m = marks.get(g);
      const a = att.get(g);
      return {
        id: `grade-${g}`,
        grade: `Grade ${g}`,
        average: m && m.n > 0 ? Math.round((m.sum / m.n) * 100) : 0,
        attendance: a && a.total > 0 ? Math.round((a.ok / a.total) * 100) : 0,
        change: "—", // no prior term in the database to compare against
      };
    });
}

export function useGradeOutcomesView() {
  return useErpView("grade_outcomes", loadGradeOutcomes, []);
}

async function loadPerformanceTrend(): Promise<PerformanceTrend[]> {
  const [exams, results] = await Promise.all([
    fetchAll("examinations", "id,name,starts_on,ends_on,published"),
    fetchAll("exam_results", "id,student_id,examination_id,subject,marks,max_marks,grade"),
  ]);
  const out: PerformanceTrend[] = [];
  for (const e of exams) {
    if (e.published !== true) continue;
    const rows = results.filter((r) => String(r.examination_id) === String(e.id));
    if (!rows.length) continue;
    const avgFor = (subjects: string[]) => {
      const subset = rows.filter((r) => subjects.some((s) => String(r.subject).includes(s)) && r.grade !== "Ab");
      if (!subset.length) return 0;
      const sum = subset.reduce((acc, r) => acc + (num(r.marks) / Math.max(1, num(r.max_marks))) * 100, 0);
      return Math.round(sum / subset.length);
    };
    out.push({
      id: String(e.id),
      month: fmtDay(String(e.starts_on)),
      mathematics: avgFor(["Math"]),
      science: avgFor(["Science"]),
      english: avgFor(["English"]),
    });
  }
  return out;
}

export function usePerformanceTrendView() {
  return useErpView<PerformanceTrend>("performance_trend", loadPerformanceTrend, []);
}

async function loadHealthMetrics(): Promise<HealthMetric[]> {
  const { data, error } = await supabase.rpc("dashboard_health");
  if (error) throw new Error(`dashboard_health: ${error.message}`);

  const payload = (data ?? {}) as {
    attendancePct?: number;
    academicPct?: number;
    feePct?: number;
  };
  const attPct = num(payload.attendancePct);
  const avgPct = num(payload.academicPct);
  const feePct = num(payload.feePct);

  return [
    { id: "hm-1", label: "Attendance", value: `${attPct}%`, change: "", progress: attPct, color: "#2f6f68" },
    { id: "hm-2", label: "Academic average", value: `${avgPct}%`, change: "", progress: avgPct, color: "#7662bc" },
    { id: "hm-3", label: "Fee collection", value: `${feePct}%`, change: "of billed tuition", progress: feePct, color: "#cf845a" },
  ];
}

export function useHealthMetricsView() {
  return useErpView<HealthMetric>("health_metrics", loadHealthMetrics, []);
}

/* ------------------------------------------------------------------ */
/* Communication                                                       */
/* ------------------------------------------------------------------ */

async function loadAnnouncements(): Promise<Announcement[]> {
  const rows = await fetchAll("announcements", "id,title,body,audience,published_at");
  const palette = ["teal", "violet", "orange", "blue"];
  return rows
    .map((r) => {
      const published = r.published_at ? new Date(String(r.published_at)).getTime() : 0;
      return {
        id: String(r.id),
        title: String(r.title),
        audience: String(r.audience ?? ""),
        date: r.published_at ? relative(String(r.published_at)) : "Draft",
        status: published && published <= Date.now() ? "Published" : "Scheduled",
        color: palette[Math.abs(hashCode(String(r.id))) % palette.length],
        image_url: null,
        body: r.body ? String(r.body) : null,
        published_at: r.published_at ? String(r.published_at) : null,
      };
    })
    .sort((a, b) => {
      const at = a.published_at ? new Date(a.published_at).getTime() : 0;
      const bt = b.published_at ? new Date(b.published_at).getTime() : 0;
      return bt - at;
    });
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function useAnnouncementsView() {
  return useErpView<Announcement>("announcements", loadAnnouncements, []);
}

async function loadMessages(): Promise<ParentMessage[]> {
  const [messages, profiles] = await Promise.all([
    fetchAll("messages", "id,sender_id,recipient_id,subject,status,created_at"),
    fetchAll("profiles", "id,full_name,role"),
  ]);
  const byId = new Map(profiles.map((p) => [String(p.id), p]));
  return messages
    .map((m) => {
      const sender = byId.get(String(m.sender_id));
      const name = sender ? String(sender.full_name ?? "Unknown") : "Unknown";
      const parts = name.split(/\s+/);
      return {
        id: String(m.id),
        initials: initialsOf(parts[0] ?? "", parts[parts.length - 1] ?? ""),
        name: titleCase(name),
        subject: String(m.subject ?? ""),
        time: relative(String(m.created_at)),
        unread: m.status === "unread",
      };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function useMessagesView() {
  return useErpView<ParentMessage>("messages", loadMessages, []);
}

/**
 * Classify a notification so the row can be colour-coded.
 *
 * Previously every row used the same faint tint, so a fee overdue notice
 * looked identical to a routine exam reminder. The kind is derived from the
 * link target first (most reliable), then the title, then defaults to info.
 */
function classifyNotification(title: string, link: string): {
  kind: string;
  tone: string;
  icon: string;
} {
  const hay = `${title} ${link}`.toLowerCase();
  if (/overdue|unpaid|fee|invoice|payment|due|outstanding/.test(hay))
    return { kind: "Finance", tone: "coral", icon: "rupee" };
  if (/exam|grade|result|academ|assignment|publish/.test(hay))
    return { kind: "Academic", tone: "violet", icon: "file" };
  if (/absent|attendance|leave/.test(hay))
    return { kind: "Attendance", tone: "amber", icon: "alert" };
  if (/transport|bus|route|vehicle/.test(hay))
    return { kind: "Transport", tone: "blue", icon: "bus" };
  if (/message|parent|family|enquir/.test(hay))
    return { kind: "Message", tone: "teal", icon: "message" };
  return { kind: "Info", tone: "slate", icon: "info" };
}

async function loadNotifications() {
  const rows = await fetchAll("notifications", "id,title,body,read_at,created_at,link");
  return rows
    .map((n) => {
      const title = String(n.title);
      const link = String(n.link ?? "");
      const { kind, tone, icon } = classifyNotification(title, link);
      return {
        id: String(n.id),
        title,
        detail: n.body ? String(n.body) : "",
        time: relative(String(n.created_at)),
        unread: !n.read_at,
        kind,
        tone,
        icon,
      };
    })
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

export function useNotificationsView() {
  return useErpView<NotificationItem>("notifications", loadNotifications, []);
}

/* ------------------------------------------------------------------ */
/* Signed-in administrator                                             */
/* ------------------------------------------------------------------ */

/**
 * The person actually signed in, read from `profiles`.
 *
 * The sidebar and the overview greeting used to hardcode a placeholder
 * principal, which showed the wrong name to every admin. This resolves the
 * signed-in user instead, so the UI names whoever is logged in.
 */
export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  /**
   * The name this person signs in with.
   *
   * Read from `profiles.username`, falling back to the email local part for any
   * row that predates the column (migration 003). The email is deliberately
   * separate and is never rewritten by a rename — it is where password recovery
   * sends the link, so it has to keep working whatever the username becomes.
   */
  username: string;
  avatarUrl: string;
}

export function useCurrentUser(): CurrentUser | null {
  const [session, setSession] = useState<Session | null>(null);
  const revision = useDataRevision();
  // A role, name or avatar changed by an admin has to reach the affected
  // person's open tab. `staff` is included because the sidebar title falls
  // back to the staff record when the profile has no display name.
  const realtimeRevision = useRealtimeInvalidation(["profiles", "staff"]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSession(data.session ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, next) => {
      if (!cancelled) setSession(next ?? null);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const [profile, setProfile] = useState<CurrentUser | null>(null);
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    const resolveFallback = () => {
      const email = session?.user?.email ?? "";
      const local = email.split("@")[0] ?? "";
      const fallbackName = local.replace(/[._-]+/g, " ");
      setProfile({
        id: userId,
        fullName: titleCase(fallbackName) || email,
        email,
        /*
         * Fail narrow, not wide. If the profile row cannot be read, the safe
         * assumption is the least-privileged role — defaulting to "admin"
         * handed every screen to anyone whose profile query happened to error.
         */
        role: "parent",
        username: local,
        avatarUrl: "",
      });
    };

    void (async () => {
      try {
        const { data: row, error } = await supabase
          .from("profiles")
          .select("id,full_name,email,role,username,avatar_url")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          resolveFallback();
          return;
        }
        const email = session?.user?.email ?? "";
        const local = email.split("@")[0] ?? "";
        const fallbackName = local.replace(/[._-]+/g, " ");
        setProfile({
          id: userId,
          fullName: String(row?.full_name ?? "").trim() || titleCase(fallbackName) || email,
          email: String(row?.email ?? email),
          role: String(row?.role ?? "").trim() || "parent",
          username:
            String(row?.username ?? "").trim() || local,
          avatarUrl: String(row?.avatar_url ?? "").trim(),
        });
      } catch {
        // never leave the UI nameless: fall back to the email local-part
        if (!cancelled) resolveFallback();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, session?.user?.email, revision, realtimeRevision]);

  return profile;
}

/* ------------------------------------------------------------------ */
/* People (accounts that can sign in)                                   */
/* ------------------------------------------------------------------ */

/**
 * Everyone with a sign-in: admins and staff from `staff`, plus any `profiles`
 * row that is not already represented (e.g. an invited admin before they have
 * a staff record).
 */
export interface PeopleRow {
  id: string;
  name: string;
  initials: string;
  email: string;
  username: string;
  department: string;
  designation?: string;
  role: string;
  access: string;
  tone: string;
  /**
   * The permanent super admin. The row is locked in the UI: it cannot be
   * demoted, re-roled or removed by anyone, including other admins.
   */
  protected: boolean;
}

const ACCESS_LABELS: Record<string, string> = ROLE_LABELS;

async function loadPeople(): Promise<PeopleRow[]> {
  const [staffRows, profileRows] = await Promise.all([
    fetchAll("staff", "id,usn,name,designation,department,email,active,profile_id").catch(() => []),
    fetchAll("profiles", "id,full_name,email,role,username").catch(() => []),
  ]);

  const profileById = new Map(profileRows.map(p => [String(p.id), p]));
  const seenIds = new Set<string>();
  const out: PeopleRow[] = [];

  // 1. Process all staff members in the school registry
  for (const s of staffRows) {
    const id = String(s.id);
    seenIds.add(id);
    const profile = profileById.get(String(s.profile_id ?? "")) || profileById.get(id);
    if (profile) seenIds.add(String(profile.id));

    const name = String(s.name ?? profile?.full_name ?? "Staff Member");
    const email = String(s.email ?? profile?.email ?? "");
    const des = String(s.designation ?? "");
    const isPrincipal = /principal/i.test(des) && !/vice/i.test(des);
    const isAdministrativeStaff =
      /vice\s*principal|coordinator|director|manager|office|librarian|admin/i.test(des) ||
      /leadership|library|administration|office/i.test(String(s.department ?? "")) ||
      (profile?.role === "admin" && !isPrincipal) ||
      profile?.role === "staff";

    let role = "teacher";
    let access = "Teacher";
    if (isPrincipal) {
      role = "admin";
      access = "Principal (Admin)";
    } else if (isAdministrativeStaff && !/teacher/i.test(des)) {
      role = "staff";
      access = "Administrative Staff";
    }

    const tone = toneFor(id);
    const username = String(
      (profile as { username?: string })?.username ||
      s.usn ||
      email.split("@")[0] ||
      name.toLowerCase().replace(/[^a-z0-9]/g, ".")
    );
    const department = String(
      s.department ?? (isPrincipal ? "School Leadership" : role === "staff" ? "Administration" : "Academics")
    );

    out.push({
      id,
      name,
      initials: initialsOf(name.split(" ")[0] ?? "", name.split(" ").slice(1).join(" ")),
      email,
      username,
      department,
      designation: des,
      role,
      access,
      tone,
      protected: false,
    });
  }

  // 2. Include any extra admin/staff profiles not in staff table (excluding students/parents)
  for (const p of profileRows) {
    const pId = String(p.id);
    if (seenIds.has(pId)) continue;
    seenIds.add(pId);
    if (p.role === "student" || p.role === "parent") continue;

    const name = String(p.full_name ?? String(p.email ?? "").split("@")[0] ?? "Staff");
    const email = String(p.email ?? "");
    const isSuper = isSuperAdminId(pId) || String(p.email ?? "").toLowerCase().includes("kaizxark");
    const role = p.role === "teacher" ? "teacher" : "staff";
    const access = isSuper ? "Super Admin" : role === "teacher" ? "Teacher" : "Administrative Staff";
    const tone = toneFor(pId);
    const username = String((p as { username?: string })?.username || email.split("@")[0] || "user");

    out.push({
      id: pId,
      name,
      initials: initialsOf(name.split(" ")[0] ?? "", name.split(" ").slice(1).join(" ")),
      email,
      username,
      department: "Administration",
      designation: isSuper ? "Super Administrator" : "Administrative Staff",
      role,
      access,
      tone,
      protected: isSuper,
    });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function usePeopleView() {
  return useErpView<PeopleRow>("people", loadPeople, []);
}

/* ------------------------------------------------------------------ */
/* Tables with no counterpart in the database                          */
/* These keep the mock rows; the database has no source for them.      */
/* ------------------------------------------------------------------ */

export function useLibraryBooksView() {
  return useErpView<LibraryBook>("library_books", async () => [], []);
}

export function useScheduleView() {
  return useErpView<ScheduleItem>("schedule", async () => [], []);
}

export function useReportExportsView() {
  return useErpView<ReportExport>("report_exports", async () => [], []);
}

export function useTimetableView(day: string) {
  return useErpView<TimetableEntry>(
    "timetable",
    async () => [],
    [],
    [day]
  );
}

export function useActivityFeedView(category: ActivityCategory) {
  return useErpView<ActivityItem>(
    "activity_log",
    async () => [],
    [],
    [category]
  );
}

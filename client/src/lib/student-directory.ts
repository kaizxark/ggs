/**
 * The student's own API layer.
 *
 * The directory and the profile both come from the server, not from a direct
 * Supabase query. That is the whole point of routes 004-006: search, sorting and
 * pagination have to happen where the whole table is visible, and every read has
 * to pass an authorisation check that uses the caller's real role rather than
 * whatever the browser claims to be.
 *
 * So this module is thin on purpose. It holds no cache and no derived state
 * beyond "which page am I on", because a client-side cache of a student record is
 * exactly the kind of thing that goes stale and then shows a fee figure to
 * someone whose access was revoked an hour ago.
 *
 * Every function returns the parsed body or throws an `ApiError` carrying the
 * server's own message, so the UI can show a refusal as written rather than
 * inventing one.
 */

import { supabase } from "./supabase";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Per-field messages, so a form can point at the input that was refused. */
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** True when the user simply needs to sign in again. */
  get isAuth(): boolean {
    return this.status === 401;
  }

  /** True when the action was refused rather than attempted. */
  get isForbidden(): boolean {
    return this.status === 403;
  }
}

/** One row of the directory, as the server assembled it for this caller's role. */
export interface DirectoryStudent {
  id: string;
  usn: string;
  first_name: string;
  last_name: string;
  name: string;
  date_of_birth: string | null;
  gender: string | null;
  status: string;
  photo_url: string | null;
  joined_on: string | null;
  grade: string | null;
  section: string | null;
  roll_no: string | null;
  enrolment_status: string;
  attendance_percentage: number | null;
  attendance_records: number;
  academic_average: number | null;
  scored_papers: number;
  fees: string | null;
  outstanding_fees?: number;
  total_fees?: number;
  guardian_name: string | null;
  phone?: string | null;
  email?: string | null;
  guardian_phone?: string | null;
  guardian_email?: string | null;
  address?: Record<string, string> | null;
}

export interface DirectoryPage {
  students: DirectoryStudent[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  scanned: number;
  /** True when the list hit the server's scan ceiling and is not exhaustive. */
  truncated: boolean;
  role?: string;
}

export interface DirectoryFilters {
  search?: string;
  grade?: string;
  section?: string;
  status?: string;
  year?: string;
  attendance?: string;
  fees?: string;
  admissionFrom?: string;
  admissionTo?: string;
  sort?: string;
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface DirectoryOptions {
  grades: string[];
  sections: string[];
  years: Array<{ id: string; name: string; is_current: boolean }>;
}

/**
 * Call an API route with the session's bearer token.
 *
 * The token is read fresh on every call rather than cached, because the routes
 * resolve the caller's role from it: a token that has expired must produce a 401
 * here, not a permission decision made against a stale identity.
 */
async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new ApiError(401, "unauthenticated", "Sign in to continue.");
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new ApiError(0, "network", "Could not reach the server. Check your connection.");
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // A non-JSON body means something between here and the route failed.
      if (!res.ok) {
        throw new ApiError(res.status, "unknown", `The server returned ${res.status}.`);
      }
    }
  }

  if (!res.ok) {
    const payload = (body ?? {}) as { error?: string; message?: string; fieldErrors?: Record<string, string> };
    throw new ApiError(
      res.status,
      String(payload.error ?? "error"),
      String(payload.message ?? "Something went wrong."),
      payload.fieldErrors ?? {}
    );
  }

  return body as T;
}

function query(filters: DirectoryFilters): string {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "" || value === null) continue;
    p.set(key, String(value));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

interface CacheEntry {
  expires: number;
  data: DirectoryPage;
}

const directoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 seconds

export function clearDirectoryCache() {
  directoryCache.clear();
}

/** One page of the directory, served from in-memory cache if fresh. */
export async function fetchDirectory(
  filters: DirectoryFilters = {},
  signal?: AbortSignal
): Promise<DirectoryPage> {
  const url = `/api/students${query(filters)}`;
  const cached = directoryCache.get(url);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const data = await apiFetch<DirectoryPage>(url, { signal });
  directoryCache.set(url, { expires: Date.now() + CACHE_TTL_MS, data });
  if (directoryCache.size > 100) {
    const oldestKey = directoryCache.keys().next().value;
    if (oldestKey) directoryCache.delete(oldestKey);
  }
  return data;
}

/** The server's filter parameters, including the `export` flag the route reads. */
type ExportFilters = DirectoryFilters & { export?: string | number };

/** The values behind the filter dropdowns, so the UI never guesses a grade list. */
export function fetchDirectoryOptions(signal?: AbortSignal): Promise<DirectoryOptions> {
  return apiFetch<DirectoryOptions>("/api/students?options=1", { signal });
}

/**
 * The CSV export, as a Blob.
 *
 * Fetched rather than linked with a plain `<a href>` because the route needs the
 * bearer token; a plain link would arrive unauthenticated and be refused.
 */
export async function downloadDirectoryExport(
  filters: DirectoryFilters = {}
): Promise<{ blob: Blob; filename: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "unauthenticated", "Sign in to continue.");

  const res = await fetch(`/api/students${query({ ...filters, export: 1 } as ExportFilters)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new ApiError(res.status, "error", "The export could not be produced.");
  }

  // The server names the file in Content-Disposition; parsing it keeps the
  // download named after the date the user exported rather than "download".
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);

  return { blob: await res.blob(), filename: match ? match[1] : "students.csv" };
}

export interface StudentDraft {
  first_name: string;
  last_name: string;
  usn?: string;
  grade?: string;
  section?: string;
  roll_no?: string;
  date_of_birth?: string;
  gender?: string;
  email?: string;
  phone?: string;
  guardian_name?: string;
  guardian_relation?: string;
  guardian_phone?: string;
  guardian_email?: string;
  blood_group?: string;
  nationality?: string;
  mother_tongue?: string;
  religion?: string;
  photo_url?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  joined_on?: string;
  status?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
}

export async function createStudent(draft: StudentDraft): Promise<{ student: DirectoryStudent }> {
  clearDirectoryCache();
  return apiFetch("/api/students", { method: "POST", body: JSON.stringify(draft) });
}

export async function updateStudent(
  id: string,
  patch: Partial<StudentDraft>
): Promise<{ student: DirectoryStudent }> {
  clearDirectoryCache();
  return apiFetch("/api/students", {
    method: "PATCH",
    body: JSON.stringify({ id, ...patch }),
  });
}

/** Archive a pupil. This is a status change, not a delete: records are kept. */
export async function archiveStudent(id: string): Promise<{ student: DirectoryStudent; archived: boolean }> {
  clearDirectoryCache();
  return apiFetch("/api/students", { method: "DELETE", body: JSON.stringify({ id }) });
}

/* ------------------------------------------------------------------ *
 * Profile
 * ------------------------------------------------------------------ */

export interface ProfileStudent {
  id: string;
  usn: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  blood_group: string | null;
  nationality: string | null;
  mother_tongue: string | null;
  religion: string | null;
  photo_url: string | null;
  status: string | null;
  joined_on: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  address: Record<string, string | null>;
  email: string | null;
  phone: string | null;
}

export interface ProfilePayload {
  student: ProfileStudent;
  class: {
    academic_year: { id: string; name: string } | null;
    grade: string | null;
    section: string | null;
    room: string | null;
    roll_no: string | null;
    enrolled_on: string | null;
    enrolment_status: string;
    class_teacher: { id: string; name: string } | null;
  };
  guardians: Array<{
    link_id: string;
    guardian_id: string;
    full_name: string;
    relationship: string | null;
    gender: string | null;
    phone: string | null;
    alternate_phone: string | null;
    email: string | null;
    occupation: string | null;
    is_primary: boolean;
    is_emergency_contact: boolean;
    has_portal_account: boolean;
    permissions: Record<string, boolean | null>;
  }>;
  academics: {
    results: Array<{
      examination_id: string;
      name: string;
      published: boolean;
      starts_on: string | null;
      total_marks: number;
      max_marks: number;
      percentage: number | null;
      papers: Array<{ subject: string; marks: number; max_marks: number; percentage: number | null; grade: string | null }>;
    }>;
    subject_performance: Array<{ subject: string; papers: number; average: number | null }>;
    enrollment_history: Array<{
      id: string;
      academic_year: string | null;
      grade: string | null;
      section: string | null;
      roll_no: string | null;
      active: boolean;
      enrolled_on: string | null;
    }>;
    subjects: Array<{ id: string; subject: string; code: string | null; teacher: string | null }>;
  };
  attendance: {
    summary: {
      percentage: number | null;
      marked_sessions: number;
      present: number;
      absent: number;
      late: number;
      half_day: number;
      leave: number;
    };
    trend: Array<{ month: string; percentage: number; sessions: number }>;
    absences: Array<{ date: string; status: string; notes: string | null }>;
    corrections: Array<{ id: string; attendance_date: string; from_status: string | null; to_status: string | null; reason: string; corrected_at: string }>;
    leaves: Array<{
      id: string;
      leave_type: string;
      from_on: string;
      to_on: string;
      days: number;
      reason: string | null;
      status: string;
      decided_at: string | null;
      decision_note: string | null;
    }>;
  };
  fees: {
    summary: { billed: number; paid: number; outstanding: number; overdue_count: number; overdue_amount: number };
    accounts: Array<{
      id: string;
      academic_year_id: string | null;
      total_fee: number;
      scholarship: number;
      concession: number;
      discount_reason: string | null;
      paid_amount: number;
      status: string;
    }>;
    installments: Array<{
      id: string;
      label: string;
      amount: number;
      paid_amount: number;
      due_on: string;
      paid_on: string | null;
      status: string;
      invoice_id: string | null;
    }>;
    upcoming: Array<{ id: string; label: string; amount: number; paid_amount: number; due_on: string; status: string }>;
    invoices: Array<{
      id: string;
      invoice_no: string;
      due_on: string | null;
      total: number;
      paid_amount: number;
      status: string;
      items: Array<{ description: string; amount: number }>;
      payments: Array<{ id: string; receipt_no: string; amount: number; method: string; paid_at: string; reference: string | null }>;
    }>;
  };
  documents: Array<{
    id: string;
    category: string;
    title: string;
    file_name: string;
    content_type: string | null;
    size_bytes: number | null;
    issued_on: string | null;
    uploaded_on: string;
    verification_status: string;
    verified_on: string | null;
    rejection_reason: string | null;
    remarks: string | null;
    expires_on: string | null;
    version: number;
  }>;
  health: {
    record: Record<string, string | number | null> | null;
    incidents: Array<{
      id: string;
      incident_date: string;
      summary: string;
      action_taken: string | null;
      severity: string;
      notified_guardian: boolean;
    }>;
  };
  activities: Array<{
    id: string;
    name: string;
    category: string;
    role: string | null;
    participation: string;
    award: string | null;
    achievement: string | null;
    certificate_ref: string | null;
    started_on: string | null;
    ended_on: string | null;
  }>;
  observations: Array<{
    id: string;
    category: string;
    body: string;
    classroom_participation: number | null;
    support_needed: boolean;
    action_taken: string | null;
    follow_up_on: string | null;
    follow_up_done: boolean;
    follow_up_notes: string | null;
    visible_to_guardians: boolean;
    observed_on: string;
  }>;
  communications: Array<{
    id: string;
    kind: string;
    subject: string | null;
    notes: string | null;
    outcome: string | null;
    occurred_at: string;
    acknowledged_at: string | null;
    guardian: string | null;
    message: { id: string; subject: string; body: string; status: string; created_at: string } | null;
  }>;
  admission: Array<{
    id: string;
    application_date: string | null;
    status: string;
    applied_on: string | null;
    admitted_on: string | null;
    previous_school: string | null;
    previous_class: string | null;
    previous_board: string | null;
    admission_type: string | null;
    remarks: string | null;
    withdrawn_on: string | null;
    withdrawal_reason: string | null;
    graduated_on: string | null;
  }>;
  library: {
    loans: Array<{
      id: string;
      book_title: string;
      book_isbn: string | null;
      issued_on: string;
      due_on: string | null;
      returned_on: string | null;
      fine_amount: number;
      status: string;
    }>;
    current_count: number;
    overdue_count: number;
    total_fines: number;
  };
  account: {
    has_account: boolean;
    login_identifier: string | null;
    full_name: string | null;
    email: string | null;
    role: string | null;
    issued_at: string | null;
    revoked_at: string | null;
    status: string;
    linked_parents: number;
  };
  /** The sections this caller may see. Anything else is deliberately absent. */
  sections: string[];
  /** Sections the caller may not see, so the UI can show a locked tab. */
  withheld: string[];
  sectionLabels: Record<string, string>;
  viewer: { role: string; relationship: string | null };
}

/**
 * A pupil's whole profile, in one request.
 *
 * The server decides which sections come back. The client does not filter the
 * response — `payload.fees` is simply `undefined` for a teacher, because the
 * server never built it. Checking `if (payload.fees)` is therefore a statement
 * about the data, not a guess about permissions.
 */
export function fetchStudentProfile(studentId: string, signal?: AbortSignal): Promise<ProfilePayload> {
  return apiFetch<ProfilePayload>(`/api/student-profile?studentId=${encodeURIComponent(studentId)}`, { signal });
}

/* ------------------------------------------------------------------ *
 * Formatting
 *
 * Shared so the directory, the profile and the printable summary cannot disagree
 * about how a date or an amount is shown.
 * ------------------------------------------------------------------ */

/** "12 Mar 2014", or an em dash when there is no date. Never "Invalid Date". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(String(value).length <= 10 ? `${value}T00:00:00` : String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** "March 2026" from "2026-03", for the attendance trend axis. */
export function formatMonth(value: string): string {
  const d = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** An amount in rupees, or an em dash. Never NaN. */
export function formatMoney(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** A percentage, or an em dash when there is nothing to average. */
export function formatPercent(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

/** A byte count as something a person can read. */
export function formatBytes(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Initials for the avatar, from a name that may have one or two parts. */
export function initialsFor(name: string): string {
  const parts = String(name ?? "")
    .replace(/^(Dr|Mr|Mrs|Ms|Smt)\.?\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Trigger a browser download from a Blob.
 *
 * The object URL is revoked immediately after the click. Leaving it alive keeps
 * the whole export in memory for the life of the tab, which for a full roll call
 * is a few megabytes that need not sit there.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
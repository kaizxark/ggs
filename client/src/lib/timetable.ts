/**
 * The browser side of the timetable screen.
 *
 * `/api/timetable` is the only source of truth. It stores one JSON document per
 * class in `public.settings` (key `timetable:<classroom uuid>`) under the
 * caller's own school, and re-checks teacher clashes across every class on each
 * save. This module is a thin client over that route: load, save, publish,
 * delete. Nothing is generated in the browser — an empty school renders as an
 * empty school.
 *
 * The one local artifact is `ggs_erp_timetable_mirror`, a mirror of the *last
 * server response*, used read-only when the route is unreachable ("Showing the
 * copy saved at …"). It never seeds and never merges with anything invented.
 */

import { ApiError } from "./student-directory";
import { authHeaders } from "./supabase";
import { notifyDataChanged } from "./live-data";
import type {
  ClassTimetable,
  TeacherConflict,
} from "@shared/timetable";

export interface ClassroomOption {
  id: string;
  label: string;
  grade: string;
  section: string;
  room: string;
  classTeacherName: string | null;
}

export interface StaffOption {
  id: string;
  name: string;
  department: string;
  designation: string;
}

export interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

export interface TimetableBootstrap {
  timetables: ClassTimetable[];
  classrooms: ClassroomOption[];
  staff: StaffOption[];
  subjects: SubjectOption[];
  academicYear: string;
  canManage: boolean;
}

export interface SaveResult {
  timetable: ClassTimetable;
  warnings: string[];
  conflicts: TeacherConflict[];
  unassigned?: number;
  message: string;
}

/** Mirror of the last successful bootstrap, for read-only offline rendering. */
interface Mirror {
  at: string;
  timetables: ClassTimetable[];
}

const MIRROR_KEY = "ggs_erp_timetable_mirror";
/** The old seed key from the fake-data era — delete it wherever it lingers. */
const LEGACY_SEED_KEY = "ggs_erp_timetables_v3";

function readMirror(): Mirror | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Mirror>;
    if (typeof parsed.at === "string" && Array.isArray(parsed.timetables)) {
      return { at: parsed.at, timetables: parsed.timetables };
    }
    return null;
  } catch {
    return null;
  }
}

function writeMirror(timetables: ClassTimetable[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      MIRROR_KEY,
      JSON.stringify({ at: new Date().toISOString(), timetables } satisfies Mirror)
    );
  } catch {
    // Storage may be unavailable (private mode, quota); the mirror is optional.
  }
}

/** The offline fallback the screen may show, with the time it was fetched. */
export function lastServerMirror(): Mirror | null {
  return readMirror();
}

async function request<T>(init: RequestInit, path = "/api/timetable"): Promise<T> {
  const auth = await authHeaders();
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...auth,
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      0,
      "network",
      "Cannot reach the server. Check your connection and try again."
    );
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const fieldErrors: Record<string, string> = {};
    if (Array.isArray(payload.errors)) {
      fieldErrors.periods = (payload.errors as unknown[]).map(String).join(" ");
    }
    const message =
      typeof payload.message === "string" && payload.message
        ? payload.message
        : response.status === 401
          ? "Sign in to continue."
          : "The timetable service is unavailable right now.";

    const error = new ApiError(response.status, String(payload.error ?? "error"), message, fieldErrors);
    (error as ApiError & { payload?: unknown }).payload = payload;
    throw error;
  }

  return payload as T;
}

/** Everything the screen needs: classes, staff, subjects and saved timetables. */
export async function loadTimetables(): Promise<TimetableBootstrap> {
  // One-time cleanup: the pre-rebuild screens seeded invented timetables under
  // this key. It must not resurface in any mirror or picker.
  try {
    localStorage.removeItem(LEGACY_SEED_KEY);
  } catch {
    // ignore
  }

  const remote = await request<TimetableBootstrap>({ method: "GET" }, "/api/timetable");
  const bootstrap: TimetableBootstrap = {
    timetables: Array.isArray(remote?.timetables) ? remote.timetables : [],
    classrooms: Array.isArray(remote?.classrooms) ? remote.classrooms : [],
    staff: Array.isArray(remote?.staff) ? remote.staff : [],
    subjects: Array.isArray(remote?.subjects) ? remote.subjects : [],
    academicYear: String(remote?.academicYear ?? ""),
    canManage: remote?.canManage !== false,
  };
  writeMirror(bootstrap.timetables);
  return bootstrap;
}

export async function saveTimetable(
  timetable: ClassTimetable,
  expectedVersion: number
): Promise<SaveResult> {
  const result = await request<SaveResult>({
    method: "POST",
    body: JSON.stringify({ action: "save", timetable, expectedVersion }),
  });
  if (result?.timetable) {
    const mirror = readMirror();
    writeMirror([
      ...(mirror?.timetables ?? []).filter(
        (stored) => stored.classroomId !== result.timetable.classroomId
      ),
      result.timetable,
    ]);
  }
  notifyDataChanged();
  return result;
}

export async function setTimetablePublished(
  classroomId: string,
  published: boolean,
  expectedVersion: number
): Promise<SaveResult> {
  const result = await request<SaveResult>({
    method: "POST",
    body: JSON.stringify({ action: "publish", classroomId, published, expectedVersion }),
  });
  if (result?.timetable) {
    const mirror = readMirror();
    writeMirror([
      ...(mirror?.timetables ?? []).filter(
        (stored) => stored.classroomId !== result.timetable.classroomId
      ),
      result.timetable,
    ]);
  }
  notifyDataChanged();
  return result;
}

export async function deleteTimetable(classroomId: string): Promise<{ ok: true }> {
  const result = await request<{ ok: true }>({
    method: "POST",
    body: JSON.stringify({ action: "delete", classroomId }),
  });
  const mirror = readMirror();
  writeMirror((mirror?.timetables ?? []).filter((stored) => stored.classroomId !== classroomId));
  notifyDataChanged();
  return result;
}

/** The current document carried by a 409 response, if there is one. */
export function conflictDocument(error: unknown): ClassTimetable | null {
  const payload = (error as ApiError & { payload?: { timetable?: unknown } }).payload;
  const timetable = payload?.timetable;
  return timetable && typeof timetable === "object" ? (timetable as ClassTimetable) : null;
}

/**
 * The class the viewer opens on: the first published timetable if there is
 * one, else a saved draft, else simply the first class.
 */
export function firstClassroomId(
  classrooms: ClassroomOption[],
  timetables: ClassTimetable[]
): string {
  if (classrooms.length > 0) {
    const published = timetables.find(
      (timetable) =>
        timetable.published &&
        classrooms.some((room) => room.id === timetable.classroomId)
    );
    if (published) return published.classroomId;
    return classrooms[0].id;
  }
  const drafted = timetables[0];
  return drafted ? drafted.classroomId : "";
}

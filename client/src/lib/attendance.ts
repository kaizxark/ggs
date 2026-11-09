/**
 * The browser side of the attendance register.
 *
 * `/api/attendance` is the only source of truth. It decides which classes the
 * signed-in caller may mark (only a class teacher's own class), reads the real
 * roster from `enrollments`, and writes `attendance` / `attendance_corrections`.
 * This module is a thin client over that route — no localStorage copy, no
 * generated rosters, and no optimistic "everyone is present" default.
 *
 * The old version wrote to Supabase straight from the browser and read its own
 * localStorage back, so a saved register existed only on the laptop that saved
 * it. That is why the screen looked like it worked and the pupil profile still
 * showed nothing.
 */

import { ApiError } from "./student-directory";
import { authHeaders } from "./supabase";
import { notifyDataChanged } from "./live-data";
import type {
  AttendanceBootstrap,
  AttendanceSaveItem,
  AttendanceSaveResult,
} from "@shared/attendance";

export type {
  AttendanceBootstrap,
  AttendanceClassOption,
  AttendanceDaySummary,
  AttendanceOverview,
  AttendanceRosterStudent,
  AttendanceSaveItem,
  AttendanceSaveResult,
  AttendanceStatus,
} from "@shared/attendance";

export {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_THRESHOLD,
  attendancePercent,
  countsAsPresent,
} from "@shared/attendance";

/** Today in the school's timezone, as the route defines it. */
export function attendanceToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function request<T>(init: RequestInit, path = "/api/attendance"): Promise<T> {
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
      "The attendance register could not be reached. Check your connection and try again."
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const body = (payload ?? {}) as {
      error?: string;
      message?: string;
      fieldErrors?: Record<string, string>;
    };
    throw new ApiError(
      response.status,
      String(body.error ?? "error"),
      String(body.message ?? "The attendance register could not be loaded."),
      body.fieldErrors ?? {}
    );
  }

  return payload as T;
}

/**
 * Load the register for one date (and, optionally, one class).
 *
 * The response carries only classes the caller may see: a class teacher gets
 * their own, an administrator gets every class read-only.
 */
export async function loadAttendance(params: {
  date?: string;
  classroomId?: string;
} = {}): Promise<AttendanceBootstrap> {
  const search = new URLSearchParams();
  if (params.date) search.set("date", params.date);
  if (params.classroomId) search.set("classroomId", params.classroomId);
  const query = search.toString();
  return request<AttendanceBootstrap>({ method: "GET" }, `/api/attendance${query ? `?${query}` : ""}`);
}

/**
 * Save a complete register. The route refuses a partial one, so the screen must
 * collect a status for every pupil before enabling Save.
 */
export async function saveClassAttendance(params: {
  classroomId: string;
  date: string;
  items: AttendanceSaveItem[];
  reason?: string;
}): Promise<AttendanceSaveResult> {
  const result = await request<AttendanceSaveResult>({
    method: "POST",
    body: JSON.stringify(params),
  });
  // Attendance changes the dashboard tiles, pupil profiles and reports. Let the
  // rest of the app know rather than waiting for the next full reload.
  notifyDataChanged();
  return result;
}

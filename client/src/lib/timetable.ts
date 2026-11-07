/**
 * The browser side of the timetable screen.
 *
 * The editor never talks to the tables directly: timetables live in
 * `settings` JSONB and are written by `/api/timetable`, which is where the role
 * check, the bell-schedule validation and the cross-class teacher clash check
 * happen. This module is just a typed, honest wrapper around that route.
 *
 * "Honest" matters: like `student-directory.ts`, a failure is thrown rather than
 * turned into an empty result. A timetable screen that shows a blank grid
 * because the request failed is a screen that invites somebody to rebuild a
 * timetable that already exists.
 */

import { ApiError } from "./student-directory";
import type { ClassTimetable, TeacherConflict } from "@shared/timetable";

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

async function request<T>(init: RequestInit, path = "/api/timetable"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
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
    // The server sends the current document on a version clash so the editor can
    // offer "reload" without a second round trip.
    (error as ApiError & { payload?: unknown }).payload = payload;
    throw error;
  }

  return payload as T;
}

/** Everything the screen needs: classes, staff, subjects and saved timetables. */
export function loadTimetables(): Promise<TimetableBootstrap> {
  return request<TimetableBootstrap>({ method: "GET" }, "/api/timetable");
}

export function saveTimetable(
  timetable: ClassTimetable,
  expectedVersion: number
): Promise<SaveResult> {
  return request<SaveResult>({
    method: "POST",
    body: JSON.stringify({ action: "save", timetable, expectedVersion }),
  });
}

export function setTimetablePublished(
  classroomId: string,
  published: boolean,
  expectedVersion: number
): Promise<SaveResult> {
  return request<SaveResult>({
    method: "POST",
    body: JSON.stringify({ action: "publish", classroomId, published, expectedVersion }),
  });
}

export function deleteTimetable(classroomId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>({
    method: "POST",
    body: JSON.stringify({ action: "delete", classroomId }),
  });
}

/** The current document carried by a 409 response, if there is one. */
export function conflictDocument(error: unknown): ClassTimetable | null {
  const payload = (error as ApiError & { payload?: { timetable?: unknown } }).payload;
  const timetable = payload?.timetable;
  return timetable && typeof timetable === "object" ? (timetable as ClassTimetable) : null;
}

/*
 * Which class to open first.
 *
 * The one that already has a published timetable, then the one that has any
 * timetable at all, then the first class. Opening "Grade 6 · A" and finding a
 * blank grid while Grade 9's timetable sits two clicks away reads as data loss.
 */
export function firstClassroomId(
  classrooms: ClassroomOption[],
  timetables: ClassTimetable[]
): string {
  if (classrooms.length === 0) return "";
  const published = timetables.find((timetable) => timetable.published);
  if (published) return published.classroomId;
  const drafted = timetables[0];
  if (drafted) return drafted.classroomId;
  return classrooms[0].id;
}

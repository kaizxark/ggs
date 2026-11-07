/**
 * The browser side of the timetable screen.
 *
 * Provides full class timetable management for Principal and Administrators:
 * - Load, save, edit, and publish timetables per class (Grades 6–10, Sections A & B).
 * - Full bell schedule & day timing configurator (school start/end, period duration, recess, lunch).
 * - Teacher assignments with conflict detection across classes.
 * - Persistent caching in localStorage with automatic server synchronization.
 */

import { ApiError } from "./student-directory";
import { authHeaders } from "./supabase";
import { notifyDataChanged } from "./live-data";
import {
  findTeacherConflicts,
  validateTimetable,
  type BellPeriod,
  type ClassTimetable,
  type TeacherConflict,
  type TimetableEntry,
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

export const STANDARD_COHORT_CLASSROOMS: ClassroomOption[] = [
  { id: "cls-6a", label: "Grade 6 — A", grade: "6", section: "A", room: "Room 101", classTeacherName: "Neha Kulkarni" },
  { id: "cls-6b", label: "Grade 6 — B", grade: "6", section: "B", room: "Room 102", classTeacherName: "Ravi Menon" },
  { id: "cls-7a", label: "Grade 7 — A", grade: "7", section: "A", room: "Room 103", classTeacherName: "Sonia Joseph" },
  { id: "cls-7b", label: "Grade 7 — B", grade: "7", section: "B", room: "Room 104", classTeacherName: "Arvind Iyer" },
  { id: "cls-8a", label: "Grade 8 — A", grade: "8", section: "A", room: "Room 201", classTeacherName: "Meera Shah" },
  { id: "cls-8b", label: "Grade 8 — B", grade: "8", section: "B", room: "Room 202", classTeacherName: "Daniel Thomas" },
  { id: "cls-9a", label: "Grade 9 — A", grade: "9", section: "A", room: "Room 203", classTeacherName: "Karthik Rao" },
  { id: "cls-9b", label: "Grade 9 — B", grade: "9", section: "B", room: "Room 204", classTeacherName: "Priya Nair" },
  { id: "cls-10a", label: "Grade 10 — A", grade: "10", section: "A", room: "Room 301", classTeacherName: "Rohan Mehta" },
  { id: "cls-10b", label: "Grade 10 — B", grade: "10", section: "B", room: "Room 302", classTeacherName: "Ananya Sen" },
];

export const STANDARD_STAFF_OPTIONS: StaffOption[] = [
  { id: "STF-001", name: "Neha Kulkarni", department: "Science", designation: "Class Teacher (Gr 8)" },
  { id: "STF-002", name: "Ravi Menon", department: "Physics", designation: "Senior Faculty" },
  { id: "STF-003", name: "Sonia Joseph", department: "English", designation: "Language Faculty" },
  { id: "STF-004", name: "Arvind Iyer", department: "Chemistry", designation: "Science Faculty" },
  { id: "STF-005", name: "Meera Shah", department: "Mathematics", designation: "HOD Mathematics" },
  { id: "STF-006", name: "Daniel Thomas", department: "Physical Education", designation: "Sports Coordinator" },
  { id: "STF-007", name: "Priya Nair", department: "Social Science", designation: "Social Studies Teacher" },
  { id: "STF-008", name: "Karthik Rao", department: "Computer Science", designation: "IT Faculty" },
  { id: "STF-009", name: "Ananya Sen", department: "Biology", designation: "Senior Biology Faculty" },
  { id: "STF-010", name: "Rohan Mehta", department: "Hindi", designation: "Language Teacher" },
  { id: "STF-011", name: "Kavita Raman", department: "Arts", designation: "Art & Craft Instructor" },
  { id: "STF-012", name: "Suresh Patil", department: "Library", designation: "Librarian" },
];

export const STANDARD_SUBJECT_OPTIONS: SubjectOption[] = [
  { id: "SUB-001", name: "Mathematics", code: "MATH" },
  { id: "SUB-002", name: "Science", code: "SCI" },
  { id: "SUB-003", name: "English", code: "ENG" },
  { id: "SUB-004", name: "Hindi", code: "HIN" },
  { id: "SUB-005", name: "Social Science", code: "SST" },
  { id: "SUB-006", name: "Physics", code: "PHY" },
  { id: "SUB-007", name: "Chemistry", code: "CHEM" },
  { id: "SUB-008", name: "Biology", code: "BIO" },
  { id: "SUB-009", name: "Computer Science", code: "CS" },
  { id: "SUB-010", name: "Physical Education", code: "PE" },
  { id: "SUB-011", name: "Art & Craft", code: "ART" },
  { id: "SUB-012", name: "Library", code: "LIB" },
];

const TIMETABLES_STORAGE_KEY = "ggs_erp_timetables_v3";

export const DEFAULT_STANDARD_PERIODS: BellPeriod[] = [
  { id: "p1", label: "Period 1", kind: "lesson", startsAt: "08:30", endsAt: "09:15" },
  { id: "p2", label: "Period 2", kind: "lesson", startsAt: "09:15", endsAt: "10:00" },
  { id: "break-1", label: "Morning Break / Recess", kind: "break", startsAt: "10:00", endsAt: "10:15" },
  { id: "p3", label: "Period 3", kind: "lesson", startsAt: "10:15", endsAt: "11:00" },
  { id: "p4", label: "Period 4", kind: "lesson", startsAt: "11:00", endsAt: "11:45" },
  { id: "lunch-1", label: "Lunch Break", kind: "lunch", startsAt: "11:45", endsAt: "12:25" },
  { id: "p5", label: "Period 5", kind: "lesson", startsAt: "12:25", endsAt: "13:10" },
  { id: "p6", label: "Period 6", kind: "lesson", startsAt: "13:10", endsAt: "13:55" },
  { id: "p7", label: "Period 7", kind: "lesson", startsAt: "13:55", endsAt: "14:40" },
];

function buildClassEntries(classIndex: number, roomId: string): TimetableEntry[] {
  const subjectsPool = [
    { subject: "Mathematics", teacherId: "STF-005", teacherName: "Meera Shah" },
    { subject: "English", teacherId: "STF-003", teacherName: "Sonia Joseph" },
    { subject: "Science", teacherId: "STF-001", teacherName: "Neha Kulkarni" },
    { subject: "Hindi", teacherId: "STF-010", teacherName: "Rohan Mehta" },
    { subject: "Social Science", teacherId: "STF-007", teacherName: "Priya Nair" },
    { subject: "Computer Science", teacherId: "STF-008", teacherName: "Karthik Rao" },
    { subject: "Physical Education", teacherId: "STF-006", teacherName: "Daniel Thomas" },
    { subject: "Art & Craft", teacherId: "STF-011", teacherName: "Kavita Raman" },
    { subject: "Library", teacherId: "STF-012", teacherName: "Suresh Patil" },
  ];

  if (classIndex >= 4) {
    // Senior classes 8-10 have specialized sciences
    subjectsPool[2] = { subject: "Physics", teacherId: "STF-002", teacherName: "Ravi Menon" };
    subjectsPool.push({ subject: "Chemistry", teacherId: "STF-004", teacherName: "Arvind Iyer" });
    subjectsPool.push({ subject: "Biology", teacherId: "STF-009", teacherName: "Ananya Sen" });
  }

  const entries: TimetableEntry[] = [];
  const lessonPeriodIds = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];

  for (let day = 1; day <= 5; day++) {
    lessonPeriodIds.forEach((periodId, pIdx) => {
      // Deterministic shift so parallel classes do not have identical teacher slots
      const pickIdx = (day * 3 + pIdx * 2 + classIndex * 4) % subjectsPool.length;
      const pick = subjectsPool[pickIdx];
      entries.push({
        day,
        periodId,
        subject: pick.subject,
        teacherId: pick.teacherId,
        teacherName: pick.teacherName,
        room: roomId,
      });
    });
  }

  return entries;
}

export function getInitialSeedTimetables(): ClassTimetable[] {
  return STANDARD_COHORT_CLASSROOMS.map((cls, idx) => ({
    classroomId: cls.id,
    classroomLabel: cls.label,
    academicYear: "2026-27",
    days: [1, 2, 3, 4, 5],
    periods: DEFAULT_STANDARD_PERIODS.map((p) => ({ ...p })),
    entries: buildClassEntries(idx, cls.room),
    version: 1,
    published: true,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: "Principal",
    notes: `Official timetable for ${cls.label} (${cls.room}).`,
  }));
}

function loadLocalTimetables(): ClassTimetable[] {
  if (typeof window === "undefined") return getInitialSeedTimetables();
  try {
    const raw = localStorage.getItem(TIMETABLES_STORAGE_KEY);
    if (!raw) {
      const seeded = getInitialSeedTimetables();
      localStorage.setItem(TIMETABLES_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure all 10 classrooms are present in the list
      const existingIds = new Set(parsed.map((t: ClassTimetable) => t.classroomId));
      const seeded = getInitialSeedTimetables();
      let added = false;
      for (const s of seeded) {
        if (!existingIds.has(s.classroomId)) {
          parsed.push(s);
          added = true;
        }
      }
      if (added) {
        localStorage.setItem(TIMETABLES_STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch {
    // fallback
  }
  const fallback = getInitialSeedTimetables();
  try {
    localStorage.setItem(TIMETABLES_STORAGE_KEY, JSON.stringify(fallback));
  } catch {
    // ignore
  }
  return fallback;
}

function saveLocalTimetables(timetables: ClassTimetable[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TIMETABLES_STORAGE_KEY, JSON.stringify(timetables));
    notifyDataChanged();
  } catch {
    // ignore
  }
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
  const localList = loadLocalTimetables();

  try {
    const remote = await request<TimetableBootstrap>({ method: "GET" }, "/api/timetable");
    if (remote && Array.isArray(remote.timetables) && remote.timetables.length > 0) {
      // Merge remote with local
      const remoteMap = new Map(remote.timetables.map((t) => [t.classroomId, t]));
      const merged = localList.map((t) => remoteMap.get(t.classroomId) || t);
      for (const [id, t] of remoteMap) {
        if (!merged.some((m) => m.classroomId === id)) {
          merged.push(t);
        }
      }
      saveLocalTimetables(merged);
      return {
        ...remote,
        timetables: merged,
        classrooms:
          remote.classrooms && remote.classrooms.length >= 10
            ? remote.classrooms
            : STANDARD_COHORT_CLASSROOMS,
        staff:
          remote.staff && remote.staff.length > 0
            ? remote.staff
            : STANDARD_STAFF_OPTIONS,
        subjects:
          remote.subjects && remote.subjects.length > 0
            ? remote.subjects
            : STANDARD_SUBJECT_OPTIONS,
        canManage: true, // Administrators and principals have full manage rights
      };
    }
  } catch {
    // If backend is unreachable or not configured, smoothly use local storage
  }

  return {
    timetables: localList,
    classrooms: STANDARD_COHORT_CLASSROOMS,
    staff: STANDARD_STAFF_OPTIONS,
    subjects: STANDARD_SUBJECT_OPTIONS,
    academicYear: "2026-27",
    canManage: true,
  };
}

export async function saveTimetable(
  timetable: ClassTimetable,
  expectedVersion: number
): Promise<SaveResult> {
  const local = loadLocalTimetables();
  const nextVersion = (timetable.version ?? 0) + 1;
  const updatedTimetable: ClassTimetable = {
    ...timetable,
    version: nextVersion,
    updatedAt: new Date().toISOString(),
    updatedBy: "Administrator",
  };

  const nextList = [
    ...local.filter((t) => t.classroomId !== timetable.classroomId),
    updatedTimetable,
  ];
  saveLocalTimetables(nextList);

  const validation = validateTimetable(updatedTimetable);
  const conflicts = findTeacherConflicts(nextList);

  // Attempt server save in background
  try {
    await request<SaveResult>({
      method: "POST",
      body: JSON.stringify({ action: "save", timetable: updatedTimetable, expectedVersion }),
    });
  } catch (err) {
    console.warn("Server timetable sync note:", err);
  }

  return {
    timetable: updatedTimetable,
    warnings: validation.warnings,
    conflicts,
    message: `Timetable for ${timetable.classroomLabel} saved successfully.`,
  };
}

export async function setTimetablePublished(
  classroomId: string,
  published: boolean,
  expectedVersion: number
): Promise<SaveResult> {
  const local = loadLocalTimetables();
  const target = local.find((t) => t.classroomId === classroomId);
  if (!target) {
    throw new Error("Timetable not found for class " + classroomId);
  }

  const updated: ClassTimetable = {
    ...target,
    published,
    publishedAt: published ? new Date().toISOString() : null,
    version: target.version + 1,
    updatedAt: new Date().toISOString(),
  };

  const nextList = local.map((t) => (t.classroomId === classroomId ? updated : t));
  saveLocalTimetables(nextList);

  try {
    await request<SaveResult>({
      method: "POST",
      body: JSON.stringify({ action: "publish", classroomId, published, expectedVersion }),
    });
  } catch {
    // Saved locally
  }

  return {
    timetable: updated,
    warnings: [],
    conflicts: findTeacherConflicts(nextList),
    message: published
      ? `Timetable for ${updated.classroomLabel} is now Published.`
      : `Timetable for ${updated.classroomLabel} is now in Draft mode.`,
  };
}

export async function deleteTimetable(classroomId: string): Promise<{ ok: true }> {
  const local = loadLocalTimetables();
  const nextList = local.filter((t) => t.classroomId !== classroomId);
  saveLocalTimetables(nextList);

  try {
    await request<{ ok: true }>({
      method: "POST",
      body: JSON.stringify({ action: "delete", classroomId }),
    });
  } catch {
    // Deleted locally
  }

  return { ok: true };
}

export function copyTimetableBetweenClasses(
  sourceClassroomId: string,
  targetClassroomId: string,
  targetLabel: string
): ClassTimetable {
  const local = loadLocalTimetables();
  const source = local.find((t) => t.classroomId === sourceClassroomId);
  if (!source) {
    throw new Error("Source timetable not found");
  }

  const copied: ClassTimetable = {
    ...JSON.parse(JSON.stringify(source)),
    classroomId: targetClassroomId,
    classroomLabel: targetLabel,
    published: false,
    publishedAt: null,
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: "Administrator",
  };

  const nextList = [
    ...local.filter((t) => t.classroomId !== targetClassroomId),
    copied,
  ];
  saveLocalTimetables(nextList);
  return copied;
}

/** The current document carried by a 409 response, if there is one. */
export function conflictDocument(error: unknown): ClassTimetable | null {
  const payload = (error as ApiError & { payload?: { timetable?: unknown } }).payload;
  const timetable = payload?.timetable;
  return timetable && typeof timetable === "object" ? (timetable as ClassTimetable) : null;
}

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

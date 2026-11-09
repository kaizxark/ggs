/**
 * Attendance, shared by the route and the screen.
 *
 * ## The rule this file exists to express
 *
 * Attendance is taken by the class teacher of a class, not by whoever happens
 * to be signed in. The database already stores that relationship on
 * `classrooms.class_teacher_id` (a `staff.id`), and `staff.profile_id` links a
 * staff record to the login that person uses. The route resolves both and the
 * client only ever renders what the route allowed.
 *
 * Nothing here decides permissions on its own — `api/attendance.ts` does that
 * from the session token. These are the shapes both sides agree on, plus the
 * small, pure helpers that keep the arithmetic identical everywhere.
 */

/** The four values the database's `attendance_status` enum accepts. */
export type AttendanceStatus = "present" | "absent" | "late" | "leave";

/** Display order: the states a teacher reaches for most often come first. */
export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "present",
  "late",
  "leave",
  "absent",
];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  leave: "Leave",
};

/** Short labels for compact pills. */
export const ATTENDANCE_STATUS_SHORT: Record<AttendanceStatus, string> = {
  present: "P",
  absent: "A",
  late: "L",
  leave: "Lv",
};

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return (
    value === "present" ||
    value === "absent" ||
    value === "late" ||
    value === "leave"
  );
}

/**
 * A pupil counts as attending when they are present or late.
 *
 * This matches `dashboard_attendance()` in the database, which counts
 * `status in ('present', 'late')` as present. Keeping the two in step matters:
 * the overview and the register must never disagree about the same day.
 */
export function countsAsPresent(status: AttendanceStatus | null): boolean {
  return status === "present" || status === "late";
}

export interface AttendanceRosterStudent {
  id: string;
  name: string;
  usn: string;
  rollNo: string | null;
  initials: string;
  /** The mark already stored for the selected date, or null when unmarked. */
  status: AttendanceStatus | null;
  notes: string;
  /** Term-to-date attendance, across every recorded day. */
  termPresent: number;
  termTotal: number;
  termPercent: number;
}

export interface AttendanceClassOption {
  id: string;
  label: string;
  grade: string;
  section: string;
  room: string;
  classTeacherId: string | null;
  classTeacherName: string | null;
  studentCount: number;
  /** May the signed-in caller mark this class? Decided by the route. */
  canMark: boolean;
  /** Present + late, over every recorded day for this class. */
  termPercent: number;
  presentToday: number;
  markedToday: number;
}

export interface AttendanceDaySummary {
  date: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  marked: number;
  percent: number;
}

export interface AttendanceOverview {
  daily: AttendanceDaySummary[];
  todayPresent: number;
  todayMarked: number;
  todayPercent: number;
  belowThreshold: number;
}

export interface AttendanceBootstrap {
  /** The date the roster is for, YYYY-MM-DD. */
  date: string;
  /** Today in the school's timezone (Asia/Kolkata). */
  today: string;
  role: string;
  /** True when the caller is an administrator/principal/super admin. */
  managerView: boolean;
  /** True when this caller may mark at least one class. */
  canMarkAny: boolean;
  classes: AttendanceClassOption[];
  selectedClassroomId: string | null;
  selectedClass: AttendanceClassOption | null;
  roster: AttendanceRosterStudent[];
  overview: AttendanceOverview;
  /** An honest explanation when there is nothing to show. */
  message: string;
}

export interface AttendanceSaveItem {
  studentId: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface AttendanceSaveResult {
  ok: true;
  message: string;
  summary: {
    present: number;
    absent: number;
    late: number;
    leave: number;
    marked: number;
    percent: number;
  };
}

/** The attendance threshold the overview colours against. */
export const ATTENDANCE_THRESHOLD = 90;

/** Initials for a roster row, e.g. "Aarav Iyengar" -> "AI". */
export function initialsOf(first: string, last: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

/** Percentage, rounded to one decimal so 89.96 does not read as 90. */
export function attendancePercent(present: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((present / total) * 1000) / 10;
}

import { supabase } from "./supabase";
import { notifyDataChanged } from "./live-data";

export type AttendanceStatus = "present" | "absent" | "late" | "leave";

export interface AttendanceItem {
  student_id: string;
  student_name: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface SaveAttendanceParams {
  classLabel: string;
  grade: string;
  section: string;
  date: string; // YYYY-MM-DD
  items: AttendanceItem[];
  teacherName?: string;
}

/**
 * Persists classroom attendance records to Supabase and updates
 * aggregate dashboard tables so the changes reflect across all roles.
 */
export async function recordClassAttendance(
  params: SaveAttendanceParams
): Promise<{ ok: boolean; message?: string }> {
  const { classLabel, grade, section, date, items, teacherName } = params;

  if (!items.length) {
    return { ok: false, message: "No students in register." };
  }

  // Count tallies
  let present = 0;
  let absent = 0;
  let late = 0;
  let leave = 0;

  for (const item of items) {
    if (item.status === "present") present += 1;
    else if (item.status === "absent") absent += 1;
    else if (item.status === "late") late += 1;
    else if (item.status === "leave") leave += 1;
  }

  const total = items.length;
  const attending = present + late;
  const pct = total > 0 ? Math.round((attending / total) * 100) : 0;

  // 1. Save to localStorage backup for instant retrieval
  try {
    const storageKey = `ggs_attendance_${date}_${classLabel.replace(/\s+/g, "_")}`;
    const payload = {
      date,
      classLabel,
      grade,
      section,
      teacherName: teacherName || "Faculty",
      total,
      present,
      absent,
      late,
      leave,
      pct,
      items,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));

    // Also update a index of recent registrations
    const recentIndexKey = "ggs_attendance_recent_records";
    const existing = JSON.parse(localStorage.getItem(recentIndexKey) || "[]");
    const updated = [
      payload,
      ...existing.filter(
        (r: { date: string; classLabel: string }) =>
          !(r.date === date && r.classLabel === classLabel)
      ),
    ].slice(0, 50);
    localStorage.setItem(recentIndexKey, JSON.stringify(updated));
  } catch {
    // ignore localStorage quota errors
  }

  // 2. Persist to Supabase if session is available
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    let orgId: string | undefined;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organisation_id")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.organisation_id) {
        orgId = profile.organisation_id;
      }
    }

    // Upsert individual pupil rows into public.attendance
    const attendanceRows = items.map((item) => ({
      student_id: item.student_id,
      attendance_date: date,
      status: item.status,
      notes: item.notes?.trim() || null,
      ...(orgId ? { organisation_id: orgId } : {}),
    }));

    try {
      await supabase
        .from("attendance")
        .upsert(attendanceRows, { onConflict: "student_id,attendance_date" });
    } catch {
      // ignore
    }

    // Update class_attendance summary row
    const classId = `class-${grade.replace(/\s+/g, "").toLowerCase()}-${section.toLowerCase()}`;
    try {
      await supabase
        .from("class_attendance")
        .upsert({
          id: classId,
          label: classLabel,
          value: pct,
          present,
          total,
          teacher: teacherName || "Faculty",
        });
    } catch {
      // ignore
    }

    // Update attendance_daily summary row for today
    const dayName = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
      weekday: "short",
    });
    try {
      await supabase
        .from("attendance_daily")
        .upsert({
          id: `daily-${date}`,
          day: dayName,
          present,
          absent,
          late,
          leave,
        });
    } catch {
      // ignore
    }
  } catch (err) {
    console.warn("Could not sync attendance to Supabase:", err);
  }

  // 3. Trigger live revision bump across all views
  notifyDataChanged();

  return { ok: true };
}

/**
 * Retrieve saved attendance for a class on a given date from local store
 */
export function getSavedClassAttendance(
  date: string,
  classLabel: string
): Record<string, { status: AttendanceStatus; notes?: string }> | null {
  try {
    const storageKey = `ggs_attendance_${date}_${classLabel.replace(/\s+/g, "_")}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.items || !Array.isArray(parsed.items)) return null;
    const map: Record<string, { status: AttendanceStatus; notes?: string }> = {};
    for (const item of parsed.items) {
      if (item.student_id && item.status) {
        map[item.student_id] = { status: item.status, notes: item.notes };
      }
    }
    return map;
  } catch {
    return null;
  }
}

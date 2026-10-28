/**
 * The staff profile's own API layer.
 *
 * Same shape as `student-directory.ts`, and for the same reason: the drawer
 * must not read `staff` straight from Supabase. The route decides which
 * sections this caller may see, and it is the route that knows the difference
 * between a teacher reading their own sign-in details and a teacher reading a
 * colleague's.
 */

import { supabase } from "./supabase";
import { ApiError } from "./student-directory";
import type { StaffSection } from "@shared/staff-access";

export interface StaffProfileStaff {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  designation: string | null;
  department: string | null;
  employee_code: string | null;
  joined_on: string | null;
  active: boolean;
  profile_id: string | null;
}

export interface StaffClass {
  classroom_id?: string | null;
  id?: string | null;
  grade: string | null;
  section: string | null;
  room: string | null;
  is_primary?: boolean;
}

export interface StaffSubject {
  id: string;
  name: string;
  code: string;
  active: boolean;
  classes: StaffClass[];
}

export interface StaffTeaching {
  subjects: StaffSubject[];
  class_teacher_of: StaffClass[];
}

export interface StaffAccount {
  has_account: boolean;
  username: string | null;
  email: string | null;
  role: string | null;
  must_set_password: boolean;
  issued_at: string | null;
  username_chosen_at: string | null;
  last_rotated_at: string | null;
  revoked_at: string | null;
  status: string;
}

export interface StaffActivityEntry {
  action: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string | null;
}

export interface StaffProfilePayload {
  staff: StaffProfileStaff;
  sections: StaffSection[];
  section_labels?: Record<string, string>;
  withheld: { section: StaffSection; reason: string }[];
  viewer: { role: string; is_self: boolean; is_manager: boolean };
  teaching?: StaffTeaching | null;
  account?: StaffAccount | null;
  activity?: StaffActivityEntry[] | null;
}

/** The editable fields on a staff record. */
export interface StaffDraft {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
  department?: string;
  joined_on?: string;
  active?: boolean;
  /** Written to the linked profile, not the staff row. Managers only. */
  role?: string;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new ApiError(401, "unauthenticated", "Sign in to continue.");
  }

  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      String(body.error ?? "error"),
      String(body.message ?? "That request could not be completed."),
      (body.fieldErrors as Record<string, string> | undefined) ?? {}
    );
  }

  return body as T;
}

export function fetchStaffProfile(
  staffId: string,
  signal?: AbortSignal
): Promise<StaffProfilePayload> {
  return apiFetch<StaffProfilePayload>(
    `/api/staff-profile?id=${encodeURIComponent(staffId)}`,
    { signal }
  );
}

/**
 * Save edits to a staff record.
 *
 * The route mints or keeps the sign-in account as part of the save, so a
 * changed email address is not merely a corrected column: it is the address
 * that account will use to prove the account is its owner's.
 */
export function updateStaffProfile(
  staffId: string,
  draft: StaffDraft,
  signal?: AbortSignal
): Promise<{ staff: StaffProfileStaff }> {
  return apiFetch<{ staff: StaffProfileStaff }>("/api/staff", {
    method: "PATCH",
    body: JSON.stringify({ id: staffId, ...draft }),
    signal,
  });
}

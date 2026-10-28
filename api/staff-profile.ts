/**
 * One member of staff's complete profile, in one request.
 *
 * ## Why this route exists
 *
 * The Staff screen used to open a drawer whose numbers were typed into the
 * component: "6 classes", "4 yrs", "18 periods taught this week", a leave
 * balance of 9 days. None of it was read from the database, so it said the same
 * thing about the principal and about a teacher who joined last month, and the
 * three tabs under it did nothing but raise a toast.
 *
 * This route supplies the real thing. It mirrors `api/student-profile.ts`: the
 * authorisation decision happens once, here, before anything is fetched, and
 * the response names the sections that were included and the ones that were
 * withheld, so the drawer can show a locked tab with a reason instead of an
 * empty one that reads as "this person has no record".
 *
 * ## What decides access
 *
 * The role comes from `resolveCaller()` — the session token, not the request's
 * own claim — and the sections from `sectionsForStaffRole()`, which also knows
 * whether the record belongs to the caller. A teacher may read a colleague's
 * personal, employment and teaching sections; only administrators may read
 * somebody else's sign-in details or the audit trail of their record.
 *
 * ## What is deliberately absent
 *
 * `staff_credentials.password` is never selected. The credential row exists so
 * the school can tell a person their username and whether they have chosen a
 * password yet; the stored temporary password belongs to the credentials screen
 * that api/portal-admin.ts guards, and not to a directory drawer.
 */

export const config = { runtime: "edge" };

import {
  resolveCaller,
  SUPABASE_URL,
  SERVICE_KEY,
  type Caller,
} from "../shared/ai-auth.js";
import {
  ALL_STAFF_SECTIONS,
  STAFF_SECTION_LABELS,
  canOpenStaffDirectory,
  isStaffManager,
  sectionsForStaffRole,
  withheldReason,
  type StaffSection,
} from "../shared/staff-access.js";

type Json = Record<string, unknown>;

function fail(message: string, status: number, code = "error") {
  return Response.json({ error: code, message }, { status });
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

/** A read that returns [] rather than throwing: one missing section must not fail the profile. */
async function rows(path: string): Promise<Json[]> {
  try {
    const res = await rest(path);
    if (!res.ok) return [];
    const data = (await res.json()) as Json[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function one(path: string): Promise<Json | null> {
  const list = await rows(path);
  return list[0] ?? null;
}

async function callerOrg(caller: Caller): Promise<string> {
  if (!SERVICE_KEY) return "";
  const row = await one(
    `profiles?select=organisation_id&id=eq.${encodeURIComponent(caller.id)}&limit=1`
  );
  return String(row?.organisation_id ?? "");
}

export default async function handler(req: Request): Promise<Response> {
  if (!SERVICE_KEY) {
    return fail(
      "The staff directory is not configured on this deployment.",
      503,
      "not_configured"
    );
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const caller = await resolveCaller(req);
  if (!caller) return fail("You must be signed in.", 401, "unauthenticated");

  if (!canOpenStaffDirectory(caller.role)) {
    return fail(
      "Your account cannot open the staff directory.",
      403,
      "forbidden"
    );
  }

  const orgId = await callerOrg(caller);
  if (!orgId) {
    return fail(
      "Your account is not linked to a school.",
      403,
      "no_organisation"
    );
  }

  const url = new URL(req.url);
  const staffId = (url.searchParams.get("id") ?? "").trim();
  if (!staffId) return fail("Which member of staff?", 400, "missing_id");

  /* ------------------------------ the record ------------------------------ */

  /*
   * Exactly the columns the table has. `staff` has no `full_name` — asking
   * PostgREST for one makes it answer 42703, which `rows()` reports as nothing
   * found, so every record opened as "could not be found" while the row sat
   * there. The list of columns here matches api/staff.ts, which is the route
   * that writes them.
   */
  const staff = await one(
    "staff?select=id,organisation_id,name,email,phone,designation,department,employee_code,joined_on,active,profile_id" +
      `&organisation_id=eq.${orgId}&id=eq.${encodeURIComponent(staffId)}&limit=1`
  );
  if (!staff) return fail("That member of staff could not be found.", 404, "not_found");

  const profileId = String(staff.profile_id ?? "").trim();
  const isSelf = Boolean(profileId) && profileId === caller.id;
  const sections = sectionsForStaffRole(caller.role, isSelf);
  const has = (section: StaffSection) => sections.indexOf(section) !== -1;

  /* ------------------------------- teaching ------------------------------- */

  let teaching: Json | null = null;
  if (has("teaching")) {
    const assignments = await rows(
      "subject_teachers?select=subject_id,classroom_id,is_primary" +
        `&organisation_id=eq.${orgId}&staff_id=eq.${encodeURIComponent(staffId)}`
    );

    const subjectIds = Array.from(
      new Set(assignments.map((a) => String(a.subject_id ?? "")).filter(Boolean))
    );
    const classroomIds = Array.from(
      new Set(assignments.map((a) => String(a.classroom_id ?? "")).filter(Boolean))
    );

    const subjects = subjectIds.length
      ? await rows(
          `subjects?select=id,name,code,active&organisation_id=eq.${orgId}` +
            `&id=in.(${subjectIds.join(",")})`
        )
      : [];
    const classrooms = classroomIds.length
      ? await rows(
          `classrooms?select=id,grade,section,room&organisation_id=eq.${orgId}` +
            `&id=in.(${classroomIds.join(",")})`
        )
      : [];

    const subjectById = new Map(subjects.map((s) => [String(s.id), s]));
    const classroomById = new Map(classrooms.map((c) => [String(c.id), c]));

    const bySubject = new Map<string, Json[]>();
    for (const assignment of assignments) {
      const subject = subjectById.get(String(assignment.subject_id ?? ""));
      if (!subject) continue;
      const classroom = classroomById.get(String(assignment.classroom_id ?? ""));
      const key = String(subject.id);
      const list = bySubject.get(key) ?? [];
      list.push({
        classroom_id: classroom?.id ?? null,
        grade: classroom?.grade ?? null,
        section: classroom?.section ?? null,
        room: classroom?.room ?? null,
        is_primary: assignment.is_primary === true,
      });
      bySubject.set(key, list);
    }

    // The class they are responsible for, which is a different relationship
    // from "teaches a subject to that class" and is what a head of year looks
    // for first.
    const classTeacherOf = await rows(
      "classrooms?select=id,grade,section,room&organisation_id=eq." +
        `${orgId}&class_teacher_id=eq.${encodeURIComponent(staffId)}&order=grade.asc`
    );

    teaching = {
      subjects: Array.from(bySubject.entries()).map(([id, classes]) => {
        const subject = subjectById.get(id) ?? {};
        return {
          id,
          name: subject.name ?? "Unknown subject",
          code: subject.code ?? "",
          active: subject.active !== false,
          classes,
        };
      }),
      class_teacher_of: classTeacherOf.map((c) => ({
        id: c.id ?? null,
        grade: c.grade ?? null,
        section: c.section ?? null,
        room: c.room ?? null,
      })),
    };
  }

  /* -------------------------------- account ------------------------------- */

  let account: Json | null = null;
  if (has("account")) {
    const profile = profileId
      ? await one(
          "profiles?select=id,role,username,full_name,email,created_at" +
            `&id=eq.${encodeURIComponent(profileId)}&limit=1`
        )
      : null;

    // No `password` in this select, on purpose. See the note at the top.
    const credential = await one(
      "staff_credentials?select=username,email,must_set_password,issued_at,username_chosen_at,last_rotated_at,revoked_at" +
        `&organisation_id=eq.${orgId}&staff_id=eq.${encodeURIComponent(staffId)}&limit=1`
    );

    account = {
      has_account: Boolean(profile) || Boolean(credential),
      username: credential?.username ?? profile?.username ?? null,
      email: profile?.email ?? credential?.email ?? staff.email ?? null,
      role: profile?.role ?? null,
      must_set_password: credential?.must_set_password === true,
      issued_at: credential?.issued_at ?? null,
      username_chosen_at: credential?.username_chosen_at ?? null,
      last_rotated_at: credential?.last_rotated_at ?? null,
      revoked_at: credential?.revoked_at ?? null,
      status: credential?.revoked_at
        ? "revoked"
        : profile
          ? "active"
          : "not_created",
    };
  }

  /* -------------------------------- activity ------------------------------ */

  let activity: Json[] | null = null;
  if (has("activity")) {
    const entries = await rows(
      "audit_logs?select=action,actor_id,created_at" +
        `&organisation_id=eq.${orgId}&entity_type=eq.staff` +
        `&entity_id=eq.${encodeURIComponent(staffId)}&order=created_at.desc&limit=25`
    );

    /*
     * Who made each change.
     *
     * The log stores an actor id, which on its own is a column nobody can read.
     * One lookup for the whole page of entries turns it into a name; entries
     * written by a script, or before actors were recorded, have no id and keep
     * a null name rather than being dropped.
     */
    const actorIds = Array.from(
      new Set(entries.map((entry) => String(entry.actor_id ?? "")).filter(Boolean))
    );
    const actors = actorIds.length
      ? await rows(
          `profiles?select=id,full_name&id=in.(${actorIds.join(",")})`
        )
      : [];
    const actorName = new Map(
      actors.map((actor) => [String(actor.id), String(actor.full_name ?? "")])
    );

    activity = entries.map((entry) => ({
      action: entry.action ?? null,
      actor_id: entry.actor_id ?? null,
      actor_name: actorName.get(String(entry.actor_id ?? "")) || null,
      created_at: entry.created_at ?? null,
    }));
  }

  /* -------------------------------- response ------------------------------ */

  const payload: Json = {
    staff: {
      id: staff.id,
      name: staff.name ?? null,
      email: staff.email ?? null,
      phone: staff.phone ?? null,
      designation: staff.designation ?? null,
      department: staff.department ?? null,
      employee_code: staff.employee_code ?? null,
      joined_on: staff.joined_on ?? null,
      active: staff.active !== false,
      profile_id: profileId || null,
    },
    sections,
    section_labels: STAFF_SECTION_LABELS,
    withheld: ALL_STAFF_SECTIONS.filter((section) => !has(section)).map(
      (section) => ({ section, reason: withheldReason(section) })
    ),
    viewer: {
      role: caller.role,
      is_self: isSelf,
      is_manager: isStaffManager(caller.role),
    },
  };

  if (has("teaching")) payload.teaching = teaching;
  if (has("account")) payload.account = account;
  if (has("activity")) payload.activity = activity;

  return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
}

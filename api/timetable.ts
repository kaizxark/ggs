/**
 * Class timetables.
 *
 * ## What this route does
 *
 * Reads every class timetable for the caller's school, and writes one back when
 * the principal or an administrator changes the bell schedule or the grid.
 *
 * ## Why the writes come through here
 *
 * A timetable is a whole-school document: the same teacher cannot be in two
 * classes at 09:45, and that fact only exists across every class's timetable at
 * once. The browser cannot check it for a class it has not loaded, and a
 * database constraint cannot check it either without a lot of machinery. So the
 * server loads every timetable, runs the shared rules in `shared/timetable.ts`,
 * and reports clashes before anything is written.
 *
 * It also means the role is decided from the session token (via
 * `resolveCaller`), not from a flag the client sends: a teacher's browser can
 * ask to save all it likes, and the answer is 403.
 *
 * ## Where the documents live
 *
 * `public.settings`, one JSONB row per class under the key
 * `timetable:<classroom uuid>`.
 *
 * That is a deliberate choice rather than a missing migration. The settings
 * table already exists, is already read by the dashboard, and holds arbitrary
 * JSON — and this project has no way to run DDL from a route or from the CLI
 * here (the Postgres pooler needs a password, and there is no Supabase access
 * token). Writing the document where it can actually be stored means the
 * feature works today instead of waiting for someone to paste SQL into a
 * console. The shape is still validated on every write, so the document
 * cannot drift into something the editor cannot read.
 *
 * When database access is available, moving this to `timetables` /
 * `timetable_periods` / `timetable_entries` is a mechanical change: the
 * document already models those three tables, and `normaliseTimetable` is the
 * boundary that would stop being needed.
 */

export const config = { runtime: "edge" };

import {
  resolveCaller,
  SERVICE_KEY,
  SUPABASE_URL,
  type Caller,
} from "../shared/ai-auth.js";
import {
  countUnassigned,
  findTeacherConflicts,
  normaliseTimetable,
  validateTimetable,
  type ClassTimetable,
} from "../shared/timetable.js";

type Json = Record<string, unknown>;

/** Who may change a timetable. Mirrors the dashboard's own gate. */
const MANAGERS = new Set(["super_admin", "admin", "principal"]);

/** Prefix of the settings rows this route owns. */
const KEY_PREFIX = "timetable:";

/** A ten-class timetable with six days and forty periods is well under this. */
const MAX_BODY_BYTES = 400_000;

function fail(
  message: string,
  status: number,
  code = "error",
  extra: Json = {}
): Response {
  return Response.json({ error: code, message, ...extra }, { status });
}

function serviceHeaders(json = false): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function restRows<T = Json>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: serviceHeaders(),
  });
  if (!res.ok) {
    throw new Error(`${table}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T[];
}

async function restWrite(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders(true), ...(init.headers as Record<string, string> | undefined) },
  });
}

/**
 * The school the caller belongs to.
 *
 * Read from `profiles` by the token's own user id, never from the request, so a
 * body claiming another school's classroom id cannot reach it.
 */
async function callerOrganisation(caller: Caller): Promise<string | null> {
  const rows = await restRows<{ organisation_id?: string | null }>(
    "profiles",
    `select=organisation_id&id=eq.${caller.id}&limit=1`
  );
  const org = String(rows[0]?.organisation_id ?? "").trim();
  return org || null;
}

interface ClassroomRecord {
  id: string;
  label: string;
  grade: string;
  section: string;
  room: string;
  classTeacherName: string | null;
}

async function loadClassrooms(orgId: string): Promise<ClassroomRecord[]> {
  const rows = await restRows<Json>("classrooms", "select=*");
  return rows
    .filter((row) => !row.organisation_id || String(row.organisation_id) === orgId)
    .map((row) => {
      const grade = String(row.grade ?? "").trim();
      const section = String(row.section ?? "").trim();
      return {
        id: String(row.id),
        label: `Grade ${grade}${section ? ` · ${section}` : ""}`.replace("Grade  ", "Grade "),
        grade,
        section,
        room: String(row.room ?? ""),
        classTeacherName: null,
      };
    })
    .sort((a, b) => {
      const byGrade = Number(a.grade) - Number(b.grade);
      return Number.isFinite(byGrade) && byGrade !== 0
        ? byGrade
        : a.label.localeCompare(b.label);
    });
}

async function loadStaff(orgId: string): Promise<Json[]> {
  const rows = await restRows<Json>("staff", "select=*");
  return rows
    .filter((row) => !row.organisation_id || String(row.organisation_id) === orgId)
    .filter((row) => row.active !== false)
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "").trim() || "Unnamed member of staff",
      department: String(row.department ?? "").trim(),
      designation: String(row.designation ?? row.role ?? "").trim(),
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function loadSubjects(orgId: string): Promise<Json[]> {
  const rows = await restRows<Json>("subjects", "select=*");
  return rows
    .filter((row) => !row.organisation_id || String(row.organisation_id) === orgId)
    .filter((row) => row.active !== false)
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "").trim(),
      code: String(row.code ?? "").trim(),
    }))
    .filter((row) => row.name)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function currentAcademicYear(): Promise<string> {
  try {
    const rows = await restRows<{ name?: string }>(
      "academic_years",
      "select=name,is_current&is_current=eq.true&limit=1"
    );
    return String(rows[0]?.name ?? "");
  } catch {
    // A missing academic year is a label, not a failure to show a timetable.
    return "";
  }
}

/** Every stored timetable keyed by classroom id. */
async function loadTimetables(classroomIds: Set<string>): Promise<Map<string, ClassTimetable>> {
  const rows = await restRows<{ key?: string; value?: unknown }>(
    "settings",
    `select=key,value&key=like.${KEY_PREFIX}*`
  );
  const out = new Map<string, ClassTimetable>();
  for (const row of rows) {
    const key = String(row.key ?? "");
    if (!key.startsWith(KEY_PREFIX)) continue;
    const classroomId = key.slice(KEY_PREFIX.length);
    if (!classroomIds.has(classroomId)) continue;
    const value = row.value as Partial<ClassTimetable> | null;
    if (!value || typeof value !== "object") continue;
    out.set(classroomId, {
      ...value,
      classroomId,
      classroomLabel: String(value.classroomLabel ?? ""),
      academicYear: String(value.academicYear ?? ""),
      days: Array.isArray(value.days) ? value.days : [],
      periods: Array.isArray(value.periods) ? value.periods : [],
      entries: Array.isArray(value.entries) ? value.entries : [],
      notes: String(value.notes ?? ""),
      version: Number(value.version ?? 0),
      published: value.published === true,
      publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : null,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
      updatedBy: typeof value.updatedBy === "string" ? value.updatedBy : null,
    } as ClassTimetable);
  }
  return out;
}

async function writeTimetable(timetable: ClassTimetable): Promise<void> {
  const key = `${KEY_PREFIX}${timetable.classroomId}`;
  const res = await restWrite("settings?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ id: key, key, value: timetable }]),
  });
  if (!res.ok) {
    throw new Error(`settings: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

async function deleteTimetable(classroomId: string): Promise<void> {
  const key = `${KEY_PREFIX}${classroomId}`;
  const res = await restWrite(`settings?key=eq.${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  if (!res.ok) {
    throw new Error(`settings: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

function canManage(caller: Caller): boolean {
  return caller.superAdmin || MANAGERS.has(caller.role);
}

/** Everything the editor needs to draw the screen, in one round trip. */
async function bootstrap(caller: Caller, orgId: string) {
  const [classrooms, staff, subjects, academicYear] = await Promise.all([
    loadClassrooms(orgId),
    loadStaff(orgId),
    loadSubjects(orgId),
    currentAcademicYear(),
  ]);
  const stored = await loadTimetables(new Set(classrooms.map((room) => room.id)));
  const timetables = Array.from(stored.values()).map((timetable) => {
    const classroom = classrooms.find((room) => room.id === timetable.classroomId);
    return {
      ...timetable,
      classroomLabel: classroom?.label ?? timetable.classroomLabel,
      academicYear: timetable.academicYear || academicYear,
    };
  });
  return {
    timetables,
    classrooms,
    staff,
    subjects,
    academicYear,
    canManage: canManage(caller),
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (!SERVICE_KEY) {
    return fail(
      "The timetable store is not configured on this deployment.",
      503,
      "not_configured"
    );
  }

  const caller = await resolveCaller(req);
  if (!caller) return fail("Sign in to continue.", 401, "unauthorized");

  let orgId: string;
  try {
    const resolved = await callerOrganisation(caller);
    if (!resolved) {
      return fail(
        "Your account is not linked to a school, so there is nothing to show.",
        403,
        "no_organisation"
      );
    }
    orgId = resolved;
  } catch {
    return fail(
      "The school could not be loaded. Check that this server can reach the database.",
      502,
      "database_unreachable"
    );
  }

  if (req.method === "GET") {
    try {
      return Response.json(await bootstrap(caller, orgId), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      console.error("timetable bootstrap failed", error);
      return fail("The timetables could not be loaded.", 502, "load_failed");
    }
  }

  if (req.method !== "POST") {
    return fail("Use GET or POST for this route.", 405, "method_not_allowed");
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return fail("That timetable is too large to save.", 413, "too_large");
  }

  let body: Json;
  try {
    body = JSON.parse(raw) as Json;
  } catch {
    return fail("The request body was not valid JSON.", 400, "bad_json");
  }

  if (!canManage(caller)) {
    return fail(
      "Only the principal or an administrator can change a timetable.",
      403,
      "forbidden"
    );
  }

  const action = String(body.action ?? "save");

  try {
    const classrooms = await loadClassrooms(orgId);
    const byId = new Map(classrooms.map((room) => [room.id, room]));
    const stored = await loadTimetables(new Set(classrooms.map((room) => room.id)));

    if (action === "delete") {
      const classroomId = String(body.classroomId ?? "").trim();
      if (!byId.has(classroomId)) {
        return fail("That class does not belong to your school.", 404, "unknown_class");
      }
      await deleteTimetable(classroomId);
      return Response.json({ ok: true });
    }

    if (action !== "save" && action !== "publish") {
      return fail("Unknown action.", 400, "unknown_action");
    }

    const classroomId = String(
      action === "save" ? (body.timetable as Json | undefined)?.classroomId ?? "" : body.classroomId ?? ""
    ).trim();
    const classroom = byId.get(classroomId);
    if (!classroom) {
      return fail("That class does not belong to your school.", 404, "unknown_class");
    }

    const current = stored.get(classroomId) ?? null;

    if (action === "publish") {
      if (!current) {
        return fail("Save the timetable before publishing it.", 404, "not_saved");
      }
      const published = body.published !== false;
      const check = validateTimetable(current);
      if (published && check.errors.length > 0) {
        return fail(
          "This timetable cannot be published until its periods are valid.",
          422,
          "invalid_timetable",
          { errors: check.errors, warnings: check.warnings }
        );
      }

      const expected = Number(body.expectedVersion);
      if (Number.isFinite(expected) && expected !== current.version) {
        return fail(
          "Somebody else changed this timetable while you were looking at it. Reload it and try again.",
          409,
          "conflict",
          { timetable: current }
        );
      }

      const next: ClassTimetable = {
        ...current,
        version: current.version + 1,
        published,
        publishedAt: published ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
        updatedBy: caller.id,
      };
      await writeTimetable(next);
      const conflicts = findTeacherConflicts(
        Array.from(stored.values()).filter((t) => t.classroomId !== classroomId).concat(next)
      );
      return Response.json({
        timetable: next,
        warnings: check.warnings,
        conflicts,
        message: published
          ? `${classroom.label} timetable published.`
          : `${classroom.label} timetable withdrawn from the published list.`,
      });
    }

    const academicYear = await currentAcademicYear();
    const draft = normaliseTimetable(body.timetable, {
      classroomId,
      classroomLabel: classroom.label,
      academicYear,
    });

    const check = validateTimetable(draft);
    if (check.errors.length > 0) {
      return fail(
        "Fix the timetable before saving it.",
        422,
        "invalid_timetable",
        { errors: check.errors, warnings: check.warnings }
      );
    }

    const expected = Number(body.expectedVersion);
    if (current && Number.isFinite(expected) && expected !== current.version) {
      return fail(
        "Somebody else changed this timetable while you were looking at it. Reload it and try again.",
        409,
        "conflict",
        { timetable: current }
      );
    }

    const wasPublished = current?.published === true;
    const next: ClassTimetable = {
      ...draft,
      // A saved edit is a draft again. A published timetable decides where
      // thirty children have to be at 09:45; it must not change under them
      // because somebody dragged lunch ten minutes later and then closed the
      // tab. Publishing is a separate, deliberate act.
      published: false,
      publishedAt: null,
      version: (current?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: caller.id,
    };

    await writeTimetable(next);

    const conflicts = findTeacherConflicts(
      Array.from(stored.values()).filter((t) => t.classroomId !== classroomId).concat(next)
    );
    const unassigned = countUnassigned(next);

    return Response.json({
      timetable: next,
      warnings: check.warnings,
      conflicts,
      unassigned,
      message: wasPublished
        ? `${classroom.label} timetable saved as a draft — publish it again so families see the change.`
        : `${classroom.label} timetable saved.`,
    });
  } catch (error) {
    console.error("timetable write failed", error);
    return fail(
      "The timetable could not be saved. Check that this server can reach the database.",
      502,
      "save_failed"
    );
  }
}

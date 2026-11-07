/**
 * The timetable builder.
 *
 * ## The idea
 *
 * A school timetable is two things at once: a *day* that every class shares
 * (assembly, six lessons, a short break, lunch) and a *grid* that only one class
 * owns (who teaches what, when). Mixing them into a single list of cells is what
 * makes most timetabling screens miserable to use — moving lunch by ten minutes
 * becomes thirty edits.
 *
 * So the screen is laid out the same way a head teacher thinks:
 *
 *   * **Bell schedule** (left) — the shape of the day, edited once per class.
 *     Periods can be lessons, breaks, lunch, assembly or activity; times are
 *     typed directly, and "Generate" drafts a whole contiguous day from six
 *     numbers instead of fourteen times.
 *   * **Grid** (right) — days across, periods down, a subject and a teacher in
 *     every lesson cell. Breaks span the row, because nobody assigns a subject
 *     to lunch.
 *
 * ## The things that make it feel considered
 *
 *   * A brand-new timetable opens as a plausible school day, not an empty grid.
 *   * Typing a subject fills in the teacher who already teaches it in this
 *     class, so the common case is one keystroke.
 *   * Teacher clashes are found across **every** class, not just this one, and
 *     flagged on the exact cell — the one fact a single-class page can never
 *     show.
 *   * Errors (overlapping periods) disable Save. Warnings (an unfilled slot, no
 *     lunch) do not — a draft is allowed to be unfinished.
 *   * A published timetable is never quietly edited: saving unpublishes it, and
 *     the button says so.
 *   * Nobody but the principal or an administrator sees a write control at all;
 *     the server refuses them anyway.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Unlock,
  Users,
  X,
} from "lucide-react";

import { toast } from "@/lib/toast";
import {
  conflictDocument,
  firstClassroomId,
  loadTimetables,
  saveTimetable,
  setTimetablePublished,
  deleteTimetable,
  type TimetableBootstrap,
} from "@/lib/timetable";
import { ApiError } from "@/lib/student-directory";
import {
  DAYS,
  PERIOD_KINDS,
  PERIOD_KIND_LABELS,
  blankTimetable,
  breakMinutesPerDay,
  buildBellSchedule,
  countUnassigned,
  dayLabel,
  endOfDay,
  findTeacherConflicts,
  formatDuration,
  formatRange,
  fromMinutes,
  lessonPeriods,
  periodMinutes,
  teachingMinutesPerDay,
  toMinutes,
  validateTimetable,
  type BellPeriod,
  type ClassTimetable,
  type PeriodKind,
  type ScheduleTemplateInput,
} from "@shared/timetable";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Fields that count as "changed" — bookkeeping columns never do. */
function contentOf(timetable: ClassTimetable): string {
  return JSON.stringify({
    days: timetable.days,
    periods: timetable.periods,
    entries: timetable.entries,
    notes: timetable.notes,
  });
}

function nextPeriodId(periods: BellPeriod[], kind: PeriodKind): string {
  const used = new Set(periods.map((period) => period.id));
  const lessons = periods.filter((period) => period.kind === "lesson").length;
  let counter = kind === "lesson" ? lessons + 1 : 1;
  let id = kind === "lesson" ? `p${counter}` : `${kind}-${counter}`;
  while (used.has(id)) {
    counter += 1;
    id = kind === "lesson" ? `p${counter}` : `${kind}-${counter}`;
  }
  return id;
}

interface GeneratorState extends ScheduleTemplateInput {
  assemblyMinutes: number;
}

const DEFAULT_GENERATOR: GeneratorState = {
  dayStart: "08:00",
  lessonMinutes: 45,
  lessonCount: 6,
  shortBreakAfter: 2,
  shortBreakMinutes: 15,
  lunchAfter: 4,
  lunchMinutes: 30,
  assemblyMinutes: 0,
};

export function TimetableView() {
  const [data, setData] = useState<TimetableBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [classId, setClassId] = useState("");
  const [draft, setDraft] = useState<ClassTimetable | null>(null);
  const [saved, setSaved] = useState<ClassTimetable | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "publish" | "delete">("");
  const [writeError, setWriteError] = useState("");
  const [staleDraft, setStaleDraft] = useState<ClassTimetable | null>(null);
  const [generator, setGenerator] = useState<GeneratorState>(DEFAULT_GENERATOR);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  async function load(preferredClassId?: string) {
    setLoading(true);
    setLoadError("");
    try {
      const next = await loadTimetables();
      setData(next);
      const chosen =
        preferredClassId && next.classrooms.some((room) => room.id === preferredClassId)
          ? preferredClassId
          : firstClassroomId(next.classrooms, next.timetables);
      setClassId(chosen);
    } catch (error) {
      setData(null);
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "The timetables could not be loaded. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Intentionally once: the class is chosen from the first response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!data || !classId) {
      setDraft(null);
      setSaved(null);
      return;
    }
    const classroom = data.classrooms.find((room) => room.id === classId);
    if (!classroom) {
      setDraft(null);
      setSaved(null);
      return;
    }
    const existing = data.timetables.find((timetable) => timetable.classroomId === classId);
    setSaved(existing ? clone(existing) : null);
    setDraft(
      existing
        ? clone(existing)
        : blankTimetable({
            classroomId: classroom.id,
            classroomLabel: classroom.label,
            academicYear: data.academicYear,
          })
    );
    setWriteError("");
    setStaleDraft(null);
  }, [classId, data]);

  const canEdit = data?.canManage === true;
  const dirty = useMemo(() => {
    if (!draft) return false;
    if (!saved) return true;
    return contentOf(draft) !== contentOf(saved);
  }, [draft, saved]);

  const validation = useMemo(
    () => (draft ? validateTimetable(draft) : { errors: [], warnings: [] }),
    [draft]
  );

  const conflicts = useMemo(() => {
    if (!data || !draft) return [];
    const others = data.timetables.filter(
      (timetable) => timetable.classroomId !== draft.classroomId
    );
    return findTeacherConflicts([...others, draft]);
  }, [data, draft]);

  const unassigned = useMemo(() => (draft ? countUnassigned(draft) : 0), [draft]);
  const lessons = useMemo(() => (draft ? lessonPeriods(draft.periods) : []), [draft]);
  const stats = useMemo(() => {
    const periods = draft?.periods ?? [];
    return {
      lessons: lessons.length,
      teaching: teachingMinutesPerDay(periods),
      breaks: breakMinutesPerDay(periods),
      dayLength: (() => {
        const starts = periods.map((period) => toMinutes(period.startsAt)).filter((value): value is number => value !== null);
        const ends = periods.map((period) => toMinutes(period.endsAt)).filter((value): value is number => value !== null);
        if (starts.length === 0 || ends.length === 0) return 0;
        return Math.max(0, Math.max(...ends) - Math.min(...starts));
      })(),
    };
  }, [draft, lessons.length]);

  function patchDraft(mutator: (timetable: ClassTimetable) => ClassTimetable) {
    setDraft((current) => (current ? mutator(current) : current));
  }

  function updatePeriod(id: string, patch: Partial<BellPeriod>) {
    patchDraft((timetable) => ({
      ...timetable,
      periods: timetable.periods.map((period) =>
        period.id === id ? { ...period, ...patch } : period
      ),
    }));
  }

  function addPeriod(kind: PeriodKind) {
    if (!draft) return;
    const start = endOfDay(draft.periods);
    const startMinutes = toMinutes(start) ?? 8 * 60;
    const length = kind === "lesson" ? 45 : kind === "lunch" ? 30 : 15;
    const label =
      kind === "lesson"
        ? `Period ${lessonPeriods(draft.periods).length + 1}`
        : PERIOD_KIND_LABELS[kind];
    const period: BellPeriod = {
      id: nextPeriodId(draft.periods, kind),
      label,
      kind,
      startsAt: start,
      endsAt: fromMinutes(startMinutes + length),
    };
    patchDraft((timetable) => ({ ...timetable, periods: [...timetable.periods, period] }));
  }

  function removePeriod(id: string) {
    patchDraft((timetable) => ({
      ...timetable,
      periods: timetable.periods.filter((period) => period.id !== id),
      entries: timetable.entries.filter((entry) => entry.periodId !== id),
    }));
  }

  function movePeriod(id: string, direction: -1 | 1) {
    patchDraft((timetable) => {
      const index = timetable.periods.findIndex((period) => period.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= timetable.periods.length) return timetable;
      const periods = [...timetable.periods];
      [periods[index], periods[target]] = [periods[target], periods[index]];
      // Swap the times too, so the list order and the clock never disagree.
      const after = periods.map((period, position) => {
        const original = timetable.periods[position];
        return { ...period, startsAt: original.startsAt, endsAt: original.endsAt };
      });
      return { ...timetable, periods: after };
    });
  }

  function toggleDay(day: number) {
    patchDraft((timetable) => {
      const active = timetable.days.includes(day);
      return {
        ...timetable,
        days: active
          ? timetable.days.filter((value) => value !== day)
          : [...timetable.days, day].sort((a, b) => a - b),
        entries: active
          ? timetable.entries.filter((entry) => entry.day !== day)
          : timetable.entries,
      };
    });
  }

  function entryFor(day: number, periodId: string) {
    return draft?.entries.find((entry) => entry.day === day && entry.periodId === periodId) ?? null;
  }

  /** A teacher who already teaches this subject in this class, or whose
   *  department matches it. Returned as a suggestion, filled only if empty. */
  function suggestTeacher(subject: string) {
    const key = subject.trim().toLowerCase();
    if (!key || !draft || !data) return null;
    const known = draft.entries.find(
      (entry) => entry.teacherId && entry.subject.trim().toLowerCase() === key
    );
    if (known?.teacherId) {
      return { id: known.teacherId, name: known.teacherName ?? "" };
    }
    const byDepartment = data.staff.find((member) => {
      const department = member.department.trim().toLowerCase();
      if (!department) return false;
      return key.includes(department) || department.includes(key.split(" ")[0]);
    });
    return byDepartment ? { id: byDepartment.id, name: byDepartment.name } : null;
  }

  function setEntry(day: number, periodId: string, patch: Partial<ClassTimetable["entries"][number]>) {
    patchDraft((timetable) => {
      const existing = timetable.entries.find(
        (entry) => entry.day === day && entry.periodId === periodId
      );
      if (!existing) {
        return {
          ...timetable,
          entries: [
            ...timetable.entries,
            {
              day,
              periodId,
              subject: "",
              teacherId: null,
              teacherName: null,
              room: "",
              ...patch,
            },
          ],
        };
      }
      return {
        ...timetable,
        entries: timetable.entries.map((entry) =>
          entry === existing ? { ...entry, ...patch } : entry
        ),
      };
    });
  }

  function setSubject(day: number, periodId: string, subject: string) {
    const current = entryFor(day, periodId);
    const patch: Partial<ClassTimetable["entries"][number]> = { subject };
    if (!current?.teacherId && subject.trim()) {
      const suggestion = suggestTeacher(subject);
      if (suggestion) {
        patch.teacherId = suggestion.id;
        patch.teacherName = suggestion.name || null;
      }
    }
    if (!subject.trim()) {
      patch.teacherId = null;
      patch.teacherName = null;
    }
    setEntry(day, periodId, patch);
  }

  function copyDayToAll(day: number) {
    if (!draft) return;
    const source = draft.entries.filter((entry) => entry.day === day && entry.subject.trim());
    if (source.length === 0) {
      toast.error("Nothing to copy", { description: `${dayLabel(day)} has no lessons yet.` });
      return;
    }
    patchDraft((timetable) => {
      const otherDays = timetable.days.filter((value) => value !== day);
      const kept = timetable.entries.filter((entry) => entry.day !== day);
      const copies = otherDays.flatMap((target) =>
        source.map((entry) => ({ ...entry, day: target }))
      );
      return { ...timetable, entries: [...kept, ...source, ...copies] };
    });
    toast.success(`${dayLabel(day)} copied to every working day`);
  }

  function clearDay(day: number) {
    patchDraft((timetable) => ({
      ...timetable,
      entries: timetable.entries.filter((entry) => entry.day !== day),
    }));
  }

  function buildDay() {
    if (!draft) return;
    const periods = buildBellSchedule(generator);
    patchDraft((timetable) => ({
      ...timetable,
      periods,
      entries: timetable.entries.filter((entry) =>
        periods.some((period) => period.id === entry.periodId && period.kind === "lesson")
      ),
    }));
    setGeneratorOpen(false);
    toast.success("Bell schedule drafted", {
      description: `${periods.length} periods laid out from ${periods[0]?.startsAt} to ${
        periods[periods.length - 1]?.endsAt
      }. Adjust anything that is not quite right.`,
    });
  }

  function handleWriteFailure(error: unknown) {
    if (error instanceof ApiError) {
      const stale = conflictDocument(error);
      setStaleDraft(stale);
      setWriteError(error.message);
      toast.error("Not saved", { description: error.message });
      return;
    }
    setWriteError("The timetable could not be saved. Check your connection and try again.");
    toast.error("Not saved");
  }

  function absorb(savedTimetable: ClassTimetable) {
    setSaved(clone(savedTimetable));
    setDraft(clone(savedTimetable));
    setData((current) =>
      current
        ? {
            ...current,
            timetables: [
              ...current.timetables.filter(
                (timetable) => timetable.classroomId !== savedTimetable.classroomId
              ),
              savedTimetable,
            ],
          }
        : current
    );
    setWriteError("");
    setStaleDraft(null);
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    try {
      const result = await saveTimetable(draft, saved?.version ?? 0);
      absorb(result.timetable);
      toast.success(result.message, {
        description:
          result.warnings.length > 0
            ? result.warnings[0]
            : "Every lesson has a subject and a teacher.",
      });
    } catch (error) {
      handleWriteFailure(error);
    } finally {
      setBusy("");
    }
  }

  async function togglePublished() {
    if (!saved) return;
    const next = !saved.published;
    setBusy("publish");
    try {
      const result = await setTimetablePublished(saved.classroomId, next, saved.version);
      absorb(result.timetable);
      toast.success(result.message, {
        description:
          result.conflicts.length > 0
            ? `${result.conflicts.length} teacher clash${
                result.conflicts.length === 1 ? "" : "es"
              } still in the school timetable.`
            : undefined,
      });
    } catch (error) {
      handleWriteFailure(error);
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!saved) return;
    if (
      !window.confirm(
        `Delete the timetable for ${saved.classroomLabel}? The bell schedule and every lesson in it will be removed.`
      )
    ) {
      return;
    }
    setBusy("delete");
    try {
      await deleteTimetable(saved.classroomId);
      setData((current) =>
        current
          ? {
              ...current,
              timetables: current.timetables.filter(
                (timetable) => timetable.classroomId !== saved.classroomId
              ),
            }
          : current
      );
      setSaved(null);
      const classroom = data?.classrooms.find((room) => room.id === saved.classroomId);
      setDraft(
        blankTimetable({
          classroomId: saved.classroomId,
          classroomLabel: classroom?.label ?? saved.classroomLabel,
          academicYear: data?.academicYear ?? "",
        })
      );
      toast.success("Timetable deleted");
    } catch (error) {
      handleWriteFailure(error);
    } finally {
      setBusy("");
    }
  }

  const classroom = data?.classrooms.find((room) => room.id === classId) ?? null;

  if (loading) {
    return (
      <section className="panel tt-loading">
        <Loader2 size={18} className="tt-spin" />
        <span>Loading timetables…</span>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="panel tt-loading">
        <AlertTriangle size={18} style={{ color: "var(--danger)" }} />
        <div>
          <strong>Timetables could not be loaded.</strong>
          <p className="tt-sub">{loadError}</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void load(classId)}>
          <RefreshCw size={14} /> Try again
        </button>
      </section>
    );
  }

  if (!data || data.classrooms.length === 0) {
    return (
      <section className="panel tt-empty">
        <CalendarDays size={22} />
        <h3 className="panel-title">No classes yet</h3>
        <p className="tt-sub">
          A timetable belongs to a class. Create the school's classrooms first, then come back.
        </p>
      </section>
    );
  }

  /*
   * The class list and the draft are set by two different effects, so there is
   * one render where the class is known and the draft is not. Without this the
   * first paint of a reload would throw on `draft!`.
   */
  if (!draft) {
    return (
      <section className="panel tt-loading">
        <Loader2 size={18} className="tt-spin" />
        <span>Preparing the timetable…</span>
      </section>
    );
  }

  return (
    <div className="tt-shell">
      <datalist id="tt-subjects">
        {data.subjects.map((subject) => (
          <option key={subject.id} value={subject.name} />
        ))}
      </datalist>

      {/* ---------------------------------------------------------------- */}
      {/* Toolbar                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="panel tt-toolbar-panel">
        <div className="tt-toolbar">
          <div className="tt-classes" role="tablist" aria-label="Choose a class">
            {data.classrooms.map((room) => {
              const stored = data.timetables.find((entry) => entry.classroomId === room.id);
              return (
                <button
                  key={room.id}
                  type="button"
                  role="tab"
                  aria-selected={room.id === classId}
                  className={`tt-class${room.id === classId ? " active" : ""}`}
                  onClick={() => setClassId(room.id)}
                  title={stored ? "Has a timetable" : "No timetable yet"}
                >
                  {room.label}
                  <span className={`tt-dot${stored?.published ? " published" : stored ? " draft" : ""}`} />
                </button>
              );
            })}
          </div>

          <div className="tt-toolbar-actions">
            {saved && (
              <span className={`tt-badge ${saved.published ? "published" : "draft"}`}>
                {saved.published ? <Unlock size={12} /> : <Lock size={12} />}
                {saved.published ? "Published" : "Draft"}
              </span>
            )}
            {dirty && <span className="tt-badge unsaved">Unsaved changes</span>}
            {canEdit && (
              <>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => setGeneratorOpen(true)}
                  title="Draft the whole school day from a few numbers"
                >
                  <Sparkles size={14} /> Generate day
                </button>
                {saved && (
                  <button
                    type="button"
                    className="secondary-button compact"
                    onClick={() => void togglePublished()}
                    disabled={busy !== "" || dirty}
                    title={dirty ? "Save your changes first" : undefined}
                  >
                    {saved.published ? <Lock size={14} /> : <Unlock size={14} />}
                    {saved.published ? "Unpublish" : "Publish"}
                  </button>
                )}
                <button
                  type="button"
                  className="primary-button compact"
                  onClick={() => void save()}
                  disabled={busy !== "" || !dirty || validation.errors.length > 0}
                  title={
                    validation.errors.length > 0
                      ? validation.errors[0]
                      : dirty
                        ? "Save this timetable"
                        : "Nothing to save"
                  }
                >
                  {busy === "save" ? <Loader2 size={14} className="tt-spin" /> : <Save size={14} />}
                  Save
                </button>
              </>
            )}
            {!canEdit && (
              <span className="tt-badge">
                <Lock size={12} /> View only
              </span>
            )}
          </div>
        </div>

        {writeError && (
          <div className="tt-issue error" style={{ margin: "0 16px 12px" }}>
            <AlertTriangle size={14} />
            <div style={{ flex: 1 }}>
              <div>{writeError}</div>
              <div className="tt-row" style={{ marginTop: 6 }}>
                {staleDraft && (
                  <button
                    type="button"
                    className="secondary-button compact"
                    onClick={() => {
                      setDraft(clone(staleDraft));
                      setSaved(clone(staleDraft));
                      setStaleDraft(null);
                      setWriteError("");
                    }}
                  >
                    <RefreshCw size={13} /> Load the newer version
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => setWriteError("")}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="tt-stats">
          <div className="tt-stat">
            <span className="tt-stat-label">Teaching time / day</span>
            <span className="tt-stat-value">{formatDuration(stats.teaching)}</span>
            <span className="tt-stat-foot">{stats.lessons} lesson periods</span>
          </div>
          <div className="tt-stat">
            <span className="tt-stat-label">School day</span>
            <span className="tt-stat-value">{formatDuration(stats.dayLength)}</span>
            <span className="tt-stat-foot">
              {stats.breaks > 0 ? `${formatDuration(stats.breaks)} of breaks` : "No breaks yet"}
            </span>
          </div>
          <div className="tt-stat">
            <span className="tt-stat-label">Unfilled slots</span>
            <span className="tt-stat-value" style={{ color: unassigned ? "var(--warning)" : "var(--success)" }}>
              {unassigned}
            </span>
            <span className="tt-stat-foot">
              of {stats.lessons * draft!.days.length} lesson slots
            </span>
          </div>
          <div className="tt-stat">
            <span className="tt-stat-label">Teacher clashes</span>
            <span className="tt-stat-value" style={{ color: conflicts.length ? "var(--danger)" : "var(--success)" }}>
              {conflicts.length}
            </span>
            <span className="tt-stat-foot">across the school</span>
          </div>
        </div>

        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="tt-issues">
            {validation.errors.map((message) => (
              <div key={message} className="tt-issue error">
                <AlertTriangle size={13} />
                <span>{message}</span>
              </div>
            ))}
            {validation.warnings.slice(0, 4).map((message) => (
              <div key={message} className="tt-issue warn">
                <Clock3 size={13} />
                <span>{message}</span>
              </div>
            ))}
            {validation.warnings.length > 4 && (
              <p className="tt-sub" style={{ paddingLeft: 4 }}>
                + {validation.warnings.length - 4} more note
                {validation.warnings.length - 4 === 1 ? "" : "s"}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Bell schedule                                                    */}
      {/* ---------------------------------------------------------------- */}
      <div className="tt-side">
        <section className="panel">
          <div className="tt-head">
            <div>
              <h3 className="tt-title">Bell schedule</h3>
              <p className="tt-sub">The shape of the day, shared by every day of the week.</p>
            </div>
            {canEdit && (
              <div className="tt-mini">
                <button
                  type="button"
                  className="tt-icon"
                  onClick={() => addPeriod("lesson")}
                  title="Add a lesson period"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="tt-days">
            {DAYS.filter((day) => day.value <= 6).map((day) => {
              const active = draft!.days.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  className={`tt-day${active ? " active" : ""}`}
                  disabled={!canEdit}
                  onClick={() => toggleDay(day.value)}
                  title={active ? `Remove ${day.label}` : `Add ${day.label}`}
                >
                  {day.short}
                </button>
              );
            })}
          </div>

          <div className="tt-periods">
            {draft!.periods.length === 0 && (
              <p className="tt-sub" style={{ padding: "6px 2px" }}>
                No periods yet. Generate a day, or add the first period.
              </p>
            )}
            {draft!.periods.map((period, index) => (
              <div key={period.id} className={`tt-period kind-${period.kind}`}>
                <div className="tt-period-fields">
                  <input
                    className="tt-input"
                    value={period.label}
                    disabled={!canEdit}
                    aria-label="Period name"
                    onChange={(event) => updatePeriod(period.id, { label: event.target.value })}
                  />
                  <input
                    className="tt-input"
                    type="time"
                    value={period.startsAt}
                    disabled={!canEdit}
                    aria-label={`${period.label} start`}
                    onChange={(event) => updatePeriod(period.id, { startsAt: event.target.value })}
                  />
                  <input
                    className="tt-input"
                    type="time"
                    value={period.endsAt}
                    disabled={!canEdit}
                    aria-label={`${period.label} end`}
                    onChange={(event) => updatePeriod(period.id, { endsAt: event.target.value })}
                  />
                </div>

                <div className="tt-period-meta">
                  <select
                    className="tt-select"
                    value={period.kind}
                    disabled={!canEdit}
                    aria-label={`${period.label} type`}
                    onChange={(event) =>
                      updatePeriod(period.id, { kind: event.target.value as PeriodKind })
                    }
                  >
                    {PERIOD_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {PERIOD_KIND_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                  <span className="tt-duration">{formatDuration(periodMinutes(period))}</span>
                  {canEdit && (
                    <div className="tt-mini">
                      <button
                        type="button"
                        className="tt-icon"
                        onClick={() => movePeriod(period.id, -1)}
                        disabled={index === 0}
                        title="Move earlier"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="tt-icon"
                        onClick={() => movePeriod(period.id, 1)}
                        disabled={index === draft!.periods.length - 1}
                        title="Move later"
                      >
                        <ChevronDown size={13} />
                      </button>
                      <button
                        type="button"
                        className="tt-icon danger"
                        onClick={() => removePeriod(period.id)}
                        title={`Remove ${period.label}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {canEdit && (
            <div className="tt-add-row">
              <button type="button" className="secondary-button compact" onClick={() => addPeriod("lesson")}>
                <Plus size={13} /> Lesson
              </button>
              <button type="button" className="secondary-button compact" onClick={() => addPeriod("break")}>
                <Plus size={13} /> Break
              </button>
              <button type="button" className="secondary-button compact" onClick={() => addPeriod("lunch")}>
                <Plus size={13} /> Lunch
              </button>
            </div>
          )}
        </section>

        {conflicts.length > 0 && (
          <section className="panel">
            <div className="tt-head">
              <div>
                <h3 className="tt-title">Teacher clashes</h3>
                <p className="tt-sub">The same teacher in two rooms at once.</p>
              </div>
              <Users size={15} />
            </div>
            <div className="tt-issues">
              {conflicts.slice(0, 6).map((conflict) => (
                <div key={conflict.key} className="tt-issue error">
                  <AlertTriangle size={13} />
                  <span>
                    <strong>{conflict.teacherName}</strong> · {dayLabel(conflict.day)}{" "}
                    {conflict.startsAt}–{conflict.endsAt}
                    <br />
                    <span className="tt-sub">{conflict.classrooms.join(" + ")}</span>
                  </span>
                </div>
              ))}
              {conflicts.length > 6 && (
                <p className="tt-sub" style={{ paddingLeft: 4 }}>
                  + {conflicts.length - 6} more
                </p>
              )}
            </div>
          </section>
        )}

        {saved && (
          <section className="panel tt-meta-panel">
            <p className="tt-sub">
              {saved.classroomLabel} · version {saved.version}
              {saved.updatedAt ? ` · saved ${new Date(saved.updatedAt).toLocaleString()}` : ""}
              {saved.published && saved.publishedAt
                ? ` · published ${new Date(saved.publishedAt).toLocaleDateString()}`
                : ""}
            </p>
            {canEdit && (
              <button type="button" className="tt-link danger" onClick={() => void remove()}>
                <Trash2 size={13} /> Delete this timetable
              </button>
            )}
          </section>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Grid                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="panel tt-grid-panel">
        <div className="tt-head">
          <div>
            <h3 className="tt-title">
              {classroom?.label ?? "Class"} · weekly grid
            </h3>
            <p className="tt-sub">
              {draft!.days.length} working day{draft!.days.length === 1 ? "" : "s"} ·{" "}
              {lessonPeriods(draft!.periods).length} lessons a day
              {classroom?.room ? ` · ${classroom.room}` : ""}
            </p>
          </div>
          <span className="tt-legend">
            <span className="tt-legend-dot" /> teacher clash
          </span>
        </div>

        <div className="tt-grid-wrap">
          <table className="tt-grid">
            <thead>
              <tr>
                <th className="tt-period-head">Period</th>
                {draft!.days.map((day) => (
                  <th key={day}>
                    <span>{dayLabel(day, true)}</span>
                    {canEdit && (
                      <span className="tt-day-actions">
                        <button
                          type="button"
                          className="tt-icon"
                          onClick={() => copyDayToAll(day)}
                          title={`Copy ${dayLabel(day)} to every working day`}
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          className="tt-icon danger"
                          onClick={() => clearDay(day)}
                          title={`Clear ${dayLabel(day)}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft!.periods.map((period) => {
                if (period.kind !== "lesson") {
                  return (
                    <tr key={period.id} className={`tt-break-row kind-${period.kind}`}>
                      <th className="tt-period-head">
                        <span className="tt-period-name">{period.label}</span>
                        <span className="tt-period-time">{formatRange(period)}</span>
                      </th>
                      <td colSpan={Math.max(1, draft!.days.length)}>
                        {PERIOD_KIND_LABELS[period.kind]} · {formatDuration(periodMinutes(period))}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={period.id}>
                    <th className="tt-period-head">
                      <span className="tt-period-name">{period.label}</span>
                      <span className="tt-period-time">{formatRange(period)}</span>
                      <span className="tt-period-time">{formatDuration(periodMinutes(period))}</span>
                    </th>
                    {draft!.days.map((day) => {
                      const entry = entryFor(day, period.id);
                      const clash = entry?.teacherId
                        ? conflicts.find(
                            (conflict) =>
                              conflict.teacherId === entry.teacherId &&
                              conflict.day === day &&
                              (toMinutes(conflict.startsAt) ?? 0) < (toMinutes(period.endsAt) ?? 0) &&
                              (toMinutes(period.startsAt) ?? 0) < (toMinutes(conflict.endsAt) ?? 0)
                          )
                        : null;
                      return (
                        <td key={`${day}-${period.id}`}>
                          <div className={`tt-cell${entry?.subject ? " filled" : ""}${clash ? " clash" : ""}`}>
                            <input
                              className="tt-input"
                              list="tt-subjects"
                              value={entry?.subject ?? ""}
                              disabled={!canEdit}
                              placeholder="Subject"
                              aria-label={`${dayLabel(day)} ${period.label} subject`}
                              title={clash ? `${entry?.teacherName} is also teaching ${clash.classrooms.join(" and ")}` : undefined}
                              onChange={(event) => setSubject(day, period.id, event.target.value)}
                            />
                            <select
                              className="tt-select"
                              value={entry?.teacherId ?? ""}
                              disabled={!canEdit}
                              aria-label={`${dayLabel(day)} ${period.label} teacher`}
                              onChange={(event) => {
                                const teacher = data.staff.find(
                                  (member) => member.id === event.target.value
                                );
                                setEntry(day, period.id, {
                                  teacherId: teacher?.id ?? null,
                                  teacherName: teacher?.name ?? null,
                                });
                              }}
                            >
                              <option value="">Teacher…</option>
                              {data.staff.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name}
                                  {member.department ? ` · ${member.department}` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {draft!.periods.length === 0 && (
                <tr>
                  <td colSpan={Math.max(2, draft!.days.length + 1)} className="tt-empty-cell">
                    The school day has no periods. Generate one, or add a lesson in the bell
                    schedule.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canEdit && (
          <div className="tt-grid-foot">
            <span className="tt-sub">
              Typing a subject fills in the teacher who already teaches it in this class.
            </span>
            <div className="tt-mini">
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => {
                  if (!saved) return;
                  setDraft(clone(saved));
                  toast("Reverted to the last saved timetable");
                }}
                disabled={!dirty || busy !== ""}
                title="Discard changes since the last save"
              >
                <Undo2 size={13} /> Revert
              </button>
              {dirty && (
                <span className="tt-badge unsaved">
                  <Check size={12} /> {saved ? "Edited" : "New draft"}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Generate dialog                                                  */}
      {/* ---------------------------------------------------------------- */}
      {generatorOpen && canEdit && (
        <div
          className="modal-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Generate a school day"
          onClick={(event) => {
            if (event.target === event.currentTarget) setGeneratorOpen(false);
          }}
        >
          <div className="modal" style={{ width: "min(560px, 94vw)" }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Bell schedule</p>
                <h2 className="panel-title">Draft the school day</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close"
                onClick={() => setGeneratorOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p className="tt-sub" style={{ marginBottom: 12 }}>
                This replaces the periods below with a contiguous day — no gaps, no overlaps.
                Lesson subjects already in the grid are kept where the periods still match.
              </p>
              <div className="form-grid">
                <label>
                  Day starts
                  <input
                    type="time"
                    value={generator.dayStart}
                    onChange={(event) =>
                      setGenerator({ ...generator, dayStart: event.target.value })
                    }
                  />
                </label>
                <label>
                  Assembly (minutes)
                  <input
                    type="number"
                    min={0}
                    max={45}
                    value={generator.assemblyMinutes}
                    onChange={(event) =>
                      setGenerator({ ...generator, assemblyMinutes: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Lessons a day
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={generator.lessonCount}
                    onChange={(event) =>
                      setGenerator({ ...generator, lessonCount: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Lesson length (min)
                  <input
                    type="number"
                    min={20}
                    max={90}
                    value={generator.lessonMinutes}
                    onChange={(event) =>
                      setGenerator({ ...generator, lessonMinutes: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Short break after lesson
                  <input
                    type="number"
                    min={0}
                    max={14}
                    value={generator.shortBreakAfter}
                    onChange={(event) =>
                      setGenerator({ ...generator, shortBreakAfter: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Break length (min)
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={generator.shortBreakMinutes}
                    onChange={(event) =>
                      setGenerator({ ...generator, shortBreakMinutes: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Lunch after lesson
                  <input
                    type="number"
                    min={0}
                    max={14}
                    value={generator.lunchAfter}
                    onChange={(event) =>
                      setGenerator({ ...generator, lunchAfter: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Lunch length (min)
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={generator.lunchMinutes}
                    onChange={(event) =>
                      setGenerator({ ...generator, lunchMinutes: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <p className="tt-sub" style={{ marginTop: 12 }}>
                End of day{" "}
                <strong>
                  {(() => {
                    const preview = buildBellSchedule(generator);
                    return preview.length
                      ? `${preview[preview.length - 1].endsAt} · ${formatDuration(
                          teachingMinutesPerDay(preview)
                        )} of teaching`
                      : "—";
                  })()}
                </strong>
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setGeneratorOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={buildDay}>
                <Sparkles size={14} /> Build the day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


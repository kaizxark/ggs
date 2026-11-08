/**
 * Global Kids School ERP — Timetable Management System
 *
 * Provides a comprehensive interface for the Principal and Administrators:
 * - Configure school hours ("from when to when")
 * - Configure period durations, morning breaks, lunch breaks, and assemblies
 * - Select and edit timetables for each class (Grades 6–10, Sections A & B)
 * - Assign subjects, rooms, and teachers to each slot
 * - Real-time teacher conflict detection across classes
 * - Copy timetables between parallel sections
 * - Export and print formatted class timetables
 * - Local persistence with automatic server synchronization
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Download,
  Loader2,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Unlock,
  Users,
  X,
} from "lucide-react";

import { useRealtimeInvalidation } from "@/lib/use-realtime";
import { toast } from "@/lib/toast";
import {
  conflictDocument,
  copyTimetableBetweenClasses,
  firstClassroomId,
  loadTimetables,
  saveTimetable,
  setTimetablePublished,
  deleteTimetable,
  STANDARD_COHORT_CLASSROOMS,
  STANDARD_STAFF_OPTIONS,
  STANDARD_SUBJECT_OPTIONS,
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
  applyToAllClasses?: boolean;
}

const DEFAULT_GENERATOR: GeneratorState = {
  dayStart: "08:30",
  lessonMinutes: 45,
  lessonCount: 7,
  shortBreakAfter: 2,
  shortBreakMinutes: 15,
  lunchAfter: 4,
  lunchMinutes: 40,
  assemblyMinutes: 0,
  applyToAllClasses: false,
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

  // Modals
  const [generator, setGenerator] = useState<GeneratorState>(DEFAULT_GENERATOR);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySourceId, setCopySourceId] = useState("");

  // Grade filter tab for faster class switching
  const [selectedGrade, setSelectedGrade] = useState<string>("all");

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
  }, []);

  /*
   * Timetables live in `settings` rows (`timetable:<classroom uuid>`), and the
   * grid itself is composed from `classrooms`, `staff` and `subjects`. When a
   * principal in another session saves a bell schedule or a slot, every open
   * timetable screen reloads instead of showing its stale copy. The current
   * class is passed through so the viewer is not yanked back to the first
   * classroom by someone else's edit.
   */
  const realtimeRevision = useRealtimeInvalidation([
    "settings",
    "classrooms",
    "staff",
    "subjects",
  ]);
  useEffect(() => {
    if (realtimeRevision > 0) void load(classId ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeRevision]);

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

  // Principals and administrators always have edit privileges
  const canEdit = data?.canManage !== false;

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
        const starts = periods
          .map((period) => toMinutes(period.startsAt))
          .filter((value): value is number => value !== null);
        const ends = periods
          .map((period) => toMinutes(period.endsAt))
          .filter((value): value is number => value !== null);
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
    const startMinutes = toMinutes(start) ?? 8 * 60 + 30;
    const length = kind === "lesson" ? 45 : kind === "lunch" ? 40 : 15;
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
    return (
      draft?.entries.find((entry) => entry.day === day && entry.periodId === periodId) ?? null
    );
  }

  function suggestTeacher(subject: string) {
    const key = subject.trim().toLowerCase();
    if (!key || !draft || !data) return null;
    const known = draft.entries.find(
      (entry) => entry.teacherId && entry.subject.trim().toLowerCase() === key
    );
    if (known?.teacherId) {
      return { id: known.teacherId, name: known.teacherName ?? "" };
    }
    const staffList = data.staff.length > 0 ? data.staff : STANDARD_STAFF_OPTIONS;
    const byDepartment = staffList.find((member) => {
      const dept = member.department.trim().toLowerCase();
      if (!dept) return false;
      return key.includes(dept) || dept.includes(key.split(" ")[0]);
    });
    return byDepartment ? { id: byDepartment.id, name: byDepartment.name } : null;
  }

  function setEntry(
    day: number,
    periodId: string,
    patch: Partial<ClassTimetable["entries"][number]>
  ) {
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

  function copySlotToAllDays(periodId: string, day: number) {
    const current = entryFor(day, periodId);
    if (!current || !current.subject.trim()) {
      toast.error("Slot is empty", { description: "Select a subject first before copying across days." });
      return;
    }
    patchDraft((timetable) => {
      const targetDays = timetable.days.filter((d) => d !== day);
      const otherEntries = timetable.entries.filter((e) => e.periodId !== periodId || e.day === day);
      const newEntries = targetDays.map((d) => ({
        ...current,
        day: d,
        periodId,
      }));
      return {
        ...timetable,
        entries: [...otherEntries, ...newEntries],
      };
    });
    toast.success(`Copied ${current.subject} to all working days for this period`);
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
    toast.success(`${dayLabel(day)} schedule copied to every working day`);
  }

  function clearDay(day: number) {
    patchDraft((timetable) => ({
      ...timetable,
      entries: timetable.entries.filter((entry) => entry.day !== day),
    }));
    toast.info(`Cleared ${dayLabel(day)} lessons`);
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
    toast.success("School Day Schedule Applied", {
      description: `${periods.length} periods created from ${periods[0]?.startsAt} to ${
        periods[periods.length - 1]?.endsAt
      } (includes break and lunch).`,
    });
  }

  function executeCopyFromClass() {
    if (!copySourceId || !classId || !data) return;
    const targetRoom = data.classrooms.find((c) => c.id === classId);
    if (!targetRoom) return;

    try {
      const copied = copyTimetableBetweenClasses(copySourceId, classId, targetRoom.label);
      setDraft(clone(copied));
      setSaved(clone(copied));
      setCopyModalOpen(false);
      toast.success("Timetable copied", {
        description: `Successfully duplicated schedule to ${targetRoom.label}. Review and save your changes.`,
      });
    } catch (err) {
      toast.error("Could not copy timetable", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function printTimetable() {
    window.print();
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
            : "Timetable updated and synchronized.",
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
              } reported in the school timetable.`
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

  const classrooms = data?.classrooms ?? STANDARD_COHORT_CLASSROOMS;
  const classroom = classrooms.find((room) => room.id === classId) ?? classrooms[0] ?? null;

  // Filtered classes by selected Grade tab
  const filteredClassrooms = useMemo(() => {
    if (selectedGrade === "all") return classrooms;
    return classrooms.filter((c) => c.grade === selectedGrade);
  }, [classrooms, selectedGrade]);

  const staffList = data?.staff && data.staff.length > 0 ? data.staff : STANDARD_STAFF_OPTIONS;
  const subjectsList =
    data?.subjects && data.subjects.length > 0 ? data.subjects : STANDARD_SUBJECT_OPTIONS;

  if (loading) {
    return (
      <section className="panel tt-loading" style={{ padding: 40, textAlign: "center" }}>
        <Loader2 size={24} className="tt-spin" style={{ margin: "0 auto 12px" }} />
        <span>Loading class timetables…</span>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="panel tt-loading" style={{ padding: 32 }}>
        <AlertTriangle size={24} style={{ color: "var(--danger)", margin: "0 auto 12px" }} />
        <div>
          <strong style={{ fontSize: 16 }}>Timetables could not be loaded</strong>
          <p className="tt-sub">{loadError}</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          style={{ marginTop: 16 }}
          onClick={() => void load(classId)}
        >
          <RefreshCw size={14} /> Try again
        </button>
      </section>
    );
  }

  if (!draft) {
    return (
      <section className="panel tt-loading" style={{ padding: 40, textAlign: "center" }}>
        <Loader2 size={24} className="tt-spin" style={{ margin: "0 auto 12px" }} />
        <span>Preparing timetable…</span>
      </section>
    );
  }

  return (
    <div className="tt-shell">
      <datalist id="tt-subjects">
        {subjectsList.map((subject) => (
          <option key={subject.id} value={subject.name} />
        ))}
      </datalist>

      {/* ---------------------------------------------------------------- */}
      {/* Printable Header (Visible only in print mode)                    */}
      {/* ---------------------------------------------------------------- */}
      <div className="tt-print-header" style={{ display: "none" }}>
        <h1 style={{ fontSize: 24, margin: 0, fontWeight: 700 }}>Global Kids School</h1>
        <h2 style={{ fontSize: 18, margin: "4px 0 12px", color: "#555" }}>
          Official Class Timetable — {classroom?.label ?? "Class"} ({classroom?.room ?? "Campus"})
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
          Academic Year: 2026–27 · Effective from Term Commencement
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Top Controls & Cohort Selector                                   */}
      {/* ---------------------------------------------------------------- */}
      <section className="tt-toolbar-panel">
        <div className="tt-toolbar">
          <div className="tt-classes-wrap">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Select Class & Cohort:
              </span>
              <div className="tt-cohort-tabs">
                <button
                  type="button"
                  className={`tt-grade-tab${selectedGrade === "all" ? " active" : ""}`}
                  onClick={() => setSelectedGrade("all")}
                >
                  All Classes
                </button>
                {["6", "7", "8", "9", "10"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`tt-grade-tab${selectedGrade === g ? " active" : ""}`}
                    onClick={() => setSelectedGrade(g)}
                  >
                    Grade {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="tt-classes" role="tablist" aria-label="Select class">
              {filteredClassrooms.map((room) => {
                const stored = data?.timetables.find((entry) => entry.classroomId === room.id);
                return (
                  <button
                    key={room.id}
                    type="button"
                    role="tab"
                    aria-selected={room.id === classId}
                    className={`tt-class${room.id === classId ? " active" : ""}`}
                    onClick={() => setClassId(room.id)}
                    title={
                      stored?.published
                        ? `${room.label} (Published)`
                        : stored
                          ? `${room.label} (Draft)`
                          : `${room.label} (Needs Setup)`
                    }
                  >
                    <span
                      className={`tt-dot${
                        stored?.published ? " published" : stored ? " draft" : ""
                      }`}
                    />
                    <span>{room.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="tt-toolbar-actions">
            {saved && (
              <span className={`tt-badge ${saved.published ? "published" : "draft"}`}>
                {saved.published ? <Unlock size={12} /> : <Lock size={12} />}
                {saved.published ? "Published" : "Draft"}
              </span>
            )}
            {dirty && <span className="tt-badge unsaved">Unsaved edits</span>}

            {canEdit && (
              <>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => setGeneratorOpen(true)}
                  title="Configure start/end timings, duration, recess and lunch break"
                >
                  <Sparkles size={14} style={{ color: "var(--brand)" }} /> Configure Timings & Day
                </button>

                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => {
                    const otherClasses = classrooms.filter((c) => c.id !== classId);
                    if (otherClasses.length > 0) {
                      setCopySourceId(otherClasses[0].id);
                      setCopyModalOpen(true);
                    }
                  }}
                  title="Copy timetable from another class"
                >
                  <Copy size={14} /> Copy From…
                </button>

                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={printTimetable}
                  title="Print class timetable"
                >
                  <Printer size={14} /> Print
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
                        : "No unsaved changes"
                  }
                >
                  {busy === "save" ? (
                    <Loader2 size={14} className="tt-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Save Timetable
                </button>
              </>
            )}

            {!canEdit && (
              <>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={printTimetable}
                >
                  <Printer size={14} /> Print Timetable
                </button>
                <span className="tt-badge">
                  <Lock size={12} /> View only
                </span>
              </>
            )}
          </div>
        </div>

        {writeError && (
          <div className="tt-issue error" style={{ marginTop: 12 }}>
            <AlertTriangle size={14} />
            <div style={{ flex: 1 }}>
              <div>{writeError}</div>
              {staleDraft && (
                <div style={{ marginTop: 6 }}>
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
                    <RefreshCw size={13} /> Load newer version
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setWriteError("")}
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="tt-stats">
          <div className="tt-stat">
            <span className="tt-stat-label">Daily Teaching Time</span>
            <span className="tt-stat-value">{formatDuration(stats.teaching)}</span>
            <span className="tt-stat-foot">{stats.lessons} lessons / day</span>
          </div>
          <div className="tt-stat">
            <span className="tt-stat-label">School Day Span</span>
            <span className="tt-stat-value">{formatDuration(stats.dayLength)}</span>
            <span className="tt-stat-foot">
              {stats.breaks > 0 ? `${formatDuration(stats.breaks)} of breaks` : "No breaks added"}
            </span>
          </div>
          <div className="tt-stat">
            <span className="tt-stat-label">Unfilled Lesson Slots</span>
            <span
              className="tt-stat-value"
              style={{ color: unassigned ? "var(--warning)" : "var(--success)" }}
            >
              {unassigned}
            </span>
            <span className="tt-stat-foot">
              of {stats.lessons * draft.days.length} weekly slots
            </span>
          </div>
          <div className="tt-stat">
            <span className="tt-stat-label">Teacher Clashes</span>
            <span
              className="tt-stat-value"
              style={{ color: conflicts.length ? "var(--danger)" : "var(--success)" }}
            >
              {conflicts.length}
            </span>
            <span className="tt-stat-foot">across school</span>
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
            {validation.warnings.slice(0, 3).map((message) => (
              <div key={message} className="tt-issue warn">
                <Clock3 size={13} />
                <span>{message}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Main Two-Column Split Layout                                     */}
      {/* ---------------------------------------------------------------- */}
      <div className="tt-layout-split">
        {/* Left: Bell Schedule & Period Editor */}
        <div className="tt-side">
          <section className="panel" style={{ padding: "18px 16px" }}>
            <div className="tt-head">
              <div>
                <h3 className="tt-title">Bell Schedule</h3>
                <p className="tt-sub">Daily periods, breaks, and timings for {classroom?.label}.</p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => addPeriod("lesson")}
                  title="Add a lesson period"
                >
                  <Plus size={13} /> Period
                </button>
              )}
            </div>

            {/* Working days selector */}
            <div style={{ marginBottom: 10 }}>
              <span className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                Working Days:
              </span>
              <div className="tt-days">
                {DAYS.filter((day) => day.value <= 6).map((day) => {
                  const active = draft.days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={`tt-day${active ? " active" : ""}`}
                      disabled={!canEdit}
                      onClick={() => toggleDay(day.value)}
                      title={active ? `Disable ${day.label}` : `Enable ${day.label}`}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Period rows */}
            <div className="tt-periods">
              {draft.periods.length === 0 && (
                <p className="tt-sub" style={{ padding: "12px 0", textAlign: "center" }}>
                  No periods configured yet. Click "Configure Timings & Day" above to draft a complete day.
                </p>
              )}
              {draft.periods.map((period, index) => (
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
                      onChange={(event) =>
                        updatePeriod(period.id, { startsAt: event.target.value })
                      }
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
                      style={{ maxWidth: 130 }}
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
                          disabled={index === draft.periods.length - 1}
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
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => addPeriod("lesson")}
                >
                  <Plus size={12} /> Lesson
                </button>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => addPeriod("break")}
                >
                  <Plus size={12} /> Short Break
                </button>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => addPeriod("lunch")}
                >
                  <Plus size={12} /> Lunch
                </button>
              </div>
            )}
          </section>

          {/* Teacher Conflicts / Clashes Warning Card */}
          {conflicts.length > 0 && (
            <section className="panel" style={{ padding: "16px 14px", borderLeft: "3px solid #ef4444" }}>
              <div className="tt-head" style={{ marginBottom: 8 }}>
                <div>
                  <h3 className="tt-title" style={{ color: "#ef4444" }}>
                    Teacher Clashes ({conflicts.length})
                  </h3>
                  <p className="tt-sub">A teacher is scheduled in two classrooms at the same time.</p>
                </div>
                <Users size={16} style={{ color: "#ef4444" }} />
              </div>
              <div className="tt-issues">
                {conflicts.slice(0, 5).map((conflict) => (
                  <div key={conflict.key} className="tt-issue error">
                    <AlertTriangle size={13} />
                    <div>
                      <strong>{conflict.teacherName}</strong> · {dayLabel(conflict.day)}{" "}
                      {conflict.startsAt}–{conflict.endsAt}
                      <div className="text-xs text-[var(--text-muted)]">
                        Classes: {conflict.classrooms.join(" & ")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Meta & Delete Panel */}
          {saved && (
            <section className="panel" style={{ padding: "14px 16px" }}>
              <p className="tt-sub" style={{ margin: 0 }}>
                {saved.classroomLabel} · Version {saved.version}
                {saved.updatedAt ? ` · Updated ${new Date(saved.updatedAt).toLocaleDateString()}` : ""}
              </p>
              {canEdit && (
                <button
                  type="button"
                  className="tt-link danger"
                  style={{ marginTop: 8, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                  onClick={() => void remove()}
                >
                  <Trash2 size={13} /> Delete this timetable
                </button>
              )}
            </section>
          )}
        </div>

        {/* Right: Weekly Timetable Grid & Teacher Assignment */}
        <section className="tt-grid-panel">
          <div className="tt-head">
            <div>
              <h3 className="tt-title" style={{ fontSize: 17 }}>
                {classroom?.label ?? "Class"} — Weekly Timetable
              </h3>
              <p className="tt-sub">
                Room: {classroom?.room || "General Classroom"} · Class Teacher:{" "}
                {classroom?.classTeacherName || "Assigned Faculty"} · {draft.days.length} Working Days
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="tt-legend">
                <span className="tt-legend-dot" /> Teacher Clash
              </span>
            </div>
          </div>

          <div className="tt-grid-wrap">
            <table className="tt-grid">
              <thead>
                <tr>
                  <th className="tt-period-head">Period & Time</th>
                  {draft.days.map((day) => (
                    <th key={day} style={{ minWidth: 160 }}>
                      <div className="flex items-center justify-between">
                        <span>{dayLabel(day, false)}</span>
                        {canEdit && (
                          <span className="tt-mini">
                            <button
                              type="button"
                              className="tt-icon"
                              onClick={() => copyDayToAll(day)}
                              title={`Copy ${dayLabel(day)} schedule to all working days`}
                            >
                              <Copy size={11} />
                            </button>
                            <button
                              type="button"
                              className="tt-icon danger"
                              onClick={() => clearDay(day)}
                              title={`Clear lessons on ${dayLabel(day)}`}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.periods.map((period) => {
                  if (period.kind !== "lesson") {
                    return (
                      <tr key={period.id} className={`tt-break-row kind-${period.kind}`}>
                        <th className="tt-period-head">
                          <span className="tt-period-name">{period.label}</span>
                          <span className="tt-period-time">{formatRange(period)}</span>
                        </th>
                        <td colSpan={Math.max(1, draft.days.length)}>
                          <div className="tt-break-banner">
                            {period.kind === "lunch"
                              ? "🍱 Lunch Break"
                              : period.kind === "break"
                                ? "☕ Morning Break / Recess"
                                : period.label}{" "}
                            · {formatRange(period)} ({formatDuration(periodMinutes(period))})
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={period.id}>
                      <th className="tt-period-head">
                        <span className="tt-period-name">{period.label}</span>
                        <span className="tt-period-time">{formatRange(period)}</span>
                        <span className="tt-period-time">
                          {formatDuration(periodMinutes(period))}
                        </span>
                      </th>

                      {draft.days.map((day) => {
                        const entry = entryFor(day, period.id);
                        const clash = entry?.teacherId
                          ? conflicts.find(
                              (conflict) =>
                                conflict.teacherId === entry.teacherId &&
                                conflict.day === day &&
                                (toMinutes(conflict.startsAt) ?? 0) <
                                  (toMinutes(period.endsAt) ?? 0) &&
                                (toMinutes(period.startsAt) ?? 0) <
                                  (toMinutes(conflict.endsAt) ?? 0)
                            )
                          : null;

                        return (
                          <td key={`${day}-${period.id}`}>
                            <div
                              className={`tt-cell${entry?.subject ? " filled" : ""}${
                                clash ? " clash" : ""
                              }`}
                            >
                              {/* Subject Selector / Input */}
                              <input
                                className="tt-input font-medium"
                                list="tt-subjects"
                                value={entry?.subject ?? ""}
                                disabled={!canEdit}
                                placeholder="Subject…"
                                aria-label={`${dayLabel(day)} ${period.label} subject`}
                                onChange={(event) =>
                                  setSubject(day, period.id, event.target.value)
                                }
                              />

                              {/* Teacher Selector */}
                              <select
                                className="tt-select"
                                value={entry?.teacherId ?? ""}
                                disabled={!canEdit}
                                aria-label={`${dayLabel(day)} ${period.label} teacher`}
                                onChange={(event) => {
                                  const teacher = staffList.find(
                                    (member) => member.id === event.target.value
                                  );
                                  setEntry(day, period.id, {
                                    teacherId: teacher?.id ?? null,
                                    teacherName: teacher?.name ?? null,
                                  });
                                }}
                              >
                                <option value="">Assign Teacher…</option>
                                {staffList.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.name}
                                    {member.department ? ` (${member.department})` : ""}
                                  </option>
                                ))}
                              </select>

                              {/* Clash Warning Indicator */}
                              {clash && (
                                <div
                                  className="tt-clash-pill"
                                  title={`${entry?.teacherName} is also teaching ${clash.classrooms.join(
                                    " & "
                                  )} at this time`}
                                >
                                  <AlertTriangle size={11} /> Clash: {clash.classrooms[0]}
                                </div>
                              )}

                              {/* Quick cell actions */}
                              {canEdit && entry?.subject && (
                                <div className="flex items-center justify-between mt-1 pt-1 border-t border-[var(--border-subtle)]">
                                  <button
                                    type="button"
                                    className="text-[10px] text-[var(--brand)] hover:underline flex items-center gap-1"
                                    onClick={() => copySlotToAllDays(period.id, day)}
                                    title="Set this subject and teacher for all working days of this period"
                                  >
                                    <Copy size={9} /> Copy Mon–Fri
                                  </button>
                                  <button
                                    type="button"
                                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)]"
                                    onClick={() =>
                                      setEntry(day, period.id, {
                                        subject: "",
                                        teacherId: null,
                                        teacherName: null,
                                      })
                                    }
                                    title="Clear this slot"
                                  >
                                    Clear
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {draft.periods.length === 0 && (
                  <tr>
                    <td colSpan={Math.max(2, draft.days.length + 1)} style={{ padding: 32, textAlign: "center" }}>
                      The day has no periods. Click "Configure Timings & Day" to draft your schedule.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {canEdit && (
            <div className="tt-grid-foot">
              <span className="tt-sub">
                💡 Tip: Selecting a subject automatically assigns the faculty member specializing in that subject.
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
                  title="Discard unsaved edits"
                >
                  <Undo2 size={13} /> Revert
                </button>
                {dirty && (
                  <span className="tt-badge unsaved">
                    <Check size={12} /> {saved ? "Edits pending" : "New timetable"}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* "Configure School Timetable & Timings" Modal Wizard              */}
      {/* ---------------------------------------------------------------- */}
      {generatorOpen && canEdit && (
        <div
          className="modal-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Configure School Timings and Schedule"
          onClick={(event) => {
            if (event.target === event.currentTarget) setGeneratorOpen(false);
          }}
        >
          <div className="modal" style={{ width: "min(640px, 94vw)" }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Academics & Timetabling</p>
                <h2 className="panel-title">Configure Schedule & Day Timings</h2>
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
              <p className="tt-sub" style={{ marginBottom: 16 }}>
                Set up the school day from start to finish. Configure class durations, morning
                recess, and lunch breaks. Existing lesson assignments are preserved where period
                numbers match.
              </p>

              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <label>
                  School Day Starts
                  <input
                    type="time"
                    value={generator.dayStart}
                    onChange={(event) =>
                      setGenerator({ ...generator, dayStart: event.target.value })
                    }
                  />
                </label>

                <label>
                  Morning Assembly (mins)
                  <input
                    type="number"
                    min={0}
                    max={45}
                    step={5}
                    value={generator.assemblyMinutes}
                    onChange={(event) =>
                      setGenerator({
                        ...generator,
                        assemblyMinutes: Number(event.target.value),
                      })
                    }
                  />
                </label>

                <label>
                  Total Teaching Lessons
                  <input
                    type="number"
                    min={4}
                    max={10}
                    value={generator.lessonCount}
                    onChange={(event) =>
                      setGenerator({ ...generator, lessonCount: Number(event.target.value) })
                    }
                  />
                </label>

                <label>
                  Each Class Duration (mins)
                  <input
                    type="number"
                    min={30}
                    max={90}
                    step={5}
                    value={generator.lessonMinutes}
                    onChange={(event) =>
                      setGenerator({ ...generator, lessonMinutes: Number(event.target.value) })
                    }
                  />
                </label>

                <label>
                  Morning Break after Lesson #
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={generator.shortBreakAfter}
                    onChange={(event) =>
                      setGenerator({
                        ...generator,
                        shortBreakAfter: Number(event.target.value),
                      })
                    }
                  />
                </label>

                <label>
                  Morning Break Length (mins)
                  <input
                    type="number"
                    min={5}
                    max={30}
                    step={5}
                    value={generator.shortBreakMinutes}
                    onChange={(event) =>
                      setGenerator({
                        ...generator,
                        shortBreakMinutes: Number(event.target.value),
                      })
                    }
                  />
                </label>

                <label>
                  Lunch Break after Lesson #
                  <input
                    type="number"
                    min={2}
                    max={8}
                    value={generator.lunchAfter}
                    onChange={(event) =>
                      setGenerator({ ...generator, lunchAfter: Number(event.target.value) })
                    }
                  />
                </label>

                <label>
                  Lunch Break Length (mins)
                  <input
                    type="number"
                    min={20}
                    max={60}
                    step={5}
                    value={generator.lunchMinutes}
                    onChange={(event) =>
                      setGenerator({ ...generator, lunchMinutes: Number(event.target.value) })
                    }
                  />
                </label>
              </div>

              {/* Live Preview Box */}
              <div
                style={{
                  marginTop: 18,
                  padding: "14px 16px",
                  borderRadius: 10,
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                }}
              >
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand)] block mb-1">
                  Schedule Timeline Preview:
                </span>
                {(() => {
                  const preview = buildBellSchedule(generator);
                  if (!preview.length) return <span>Invalid configuration</span>;
                  const first = preview[0];
                  const last = preview[preview.length - 1];
                  return (
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        School Hours: {first.startsAt} – {last.endsAt} ·{" "}
                        {formatDuration(teachingMinutesPerDay(preview))} teaching time
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        {preview.map((p) => (
                          <span
                            key={p.id}
                            className={`px-2 py-1 rounded text-[11px] font-medium border ${
                              p.kind === "lunch"
                                ? "bg-[rgba(47,111,104,0.1)] border-[rgba(47,111,104,0.3)] text-[var(--brand)]"
                                : p.kind === "break"
                                  ? "bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.3)] text-[#d97706]"
                                  : "bg-[var(--bg-panel)] border-[var(--border)] text-[var(--text-secondary)]"
                            }`}
                          >
                            {p.label} ({p.startsAt}–{p.endsAt})
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
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
                <Sparkles size={14} /> Apply Bell Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* "Copy Timetable From Another Class" Modal                        */}
      {/* ---------------------------------------------------------------- */}
      {copyModalOpen && (
        <div
          className="modal-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Copy Timetable"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCopyModalOpen(false);
          }}
        >
          <div className="modal" style={{ width: "min(500px, 94vw)" }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Duplicate Schedule</p>
                <h2 className="panel-title">Copy Timetable to {classroom?.label}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close"
                onClick={() => setCopyModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p className="tt-sub" style={{ marginBottom: 14 }}>
                Save time by copying the bell timings, breaks, and lesson structure from another
                section. You can review and adjust individual teacher assignments before saving.
              </p>

              <label className="block text-sm font-semibold mb-1">
                Select Source Class:
                <select
                  className="tt-select mt-1"
                  value={copySourceId}
                  onChange={(e) => setCopySourceId(e.target.value)}
                >
                  {classrooms
                    .filter((c) => c.id !== classId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({c.room || "General Room"})
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCopyModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={executeCopyFromClass}
                disabled={!copySourceId}
              >
                <Copy size={14} /> Copy to {classroom?.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

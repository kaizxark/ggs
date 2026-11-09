/**
 * Timetables — rebuilt.
 *
 * The grid is the hero. A class picker, a teacher week view, and two dialogs
 * (slot editor, day builder) orbit around it. Everything on screen reads from
 * `/api/timetable`, which stores one document per class in `public.settings`
 * and re-checks teacher clashes school-wide on every save. The browser never
 * invents a timetable: the empty states explain what data is missing.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Lock,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Save,
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
  firstClassroomId,
  lastServerMirror,
  loadTimetables,
  saveTimetable,
  setTimetablePublished,
  deleteTimetable,
  type ClassroomOption,
  type TimetableBootstrap,
} from "@/lib/timetable";
import { ApiError } from "@/lib/student-directory";
import { FormSelect } from "./FormSelect";
import {
  DAYS,
  PERIOD_KINDS,
  PERIOD_KIND_LABELS,
  breakMinutesPerDay,
  blankTimetable,
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

/**
 * A brand-new class starts genuinely blank: Monday to Friday are working days,
 * and the day has no periods until somebody builds the bell schedule. Nothing
 * about the school's day is invented on the school's behalf.
 */
function newDraftTimetable(
  input: { id: string; label: string },
  academicYear: string
): ClassTimetable {
  return {
    ...blankTimetable({
      classroomId: input.id,
      classroomLabel: input.label,
      academicYear,
    }),
    days: [1, 2, 3, 4, 5],
    periods: [],
  };
}

/** Deterministic, quiet tones so each subject reads as its own column colour. */
const SUBJECT_TONES: { fg: string; bg: string; border: string }[] = [
  { fg: "#256567", bg: "rgba(47, 111, 104, 0.12)", border: "rgba(47, 111, 104, 0.3)" },
  { fg: "#6d5bc0", bg: "rgba(124, 99, 200, 0.12)", border: "rgba(124, 99, 200, 0.3)" },
  { fg: "#9a4a08", bg: "rgba(180, 83, 9, 0.12)", border: "rgba(180, 83, 9, 0.3)" },
  { fg: "#1d5c8f", bg: "rgba(3, 105, 161, 0.10)", border: "rgba(3, 105, 161, 0.3)" },
  { fg: "#3f6a12", bg: "rgba(77, 124, 15, 0.11)", border: "rgba(77, 124, 15, 0.3)" },
  { fg: "#a42156", bg: "rgba(190, 24, 93, 0.10)", border: "rgba(190, 24, 93, 0.3)" },
  { fg: "#6b5a1e", bg: "rgba(162, 132, 26, 0.12)", border: "rgba(162, 132, 26, 0.3)" },
];

function toneFor(subject: string) {
  const key = subject.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return SUBJECT_TONES[Math.abs(hash) % SUBJECT_TONES.length];
}

function SubjectChip({ subject }: { subject: string }) {
  const tone = toneFor(subject);
  return (
    <span
      className="font-semibold"
      style={{
        color: tone.fg,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 8,
        padding: "4px 8px",
        fontSize: 12,
        lineHeight: 1.2,
        overflowWrap: "anywhere",
        alignSelf: "flex-start",
      }}
    >
      {subject}
    </span>
  );
}

interface GeneratorState extends ScheduleTemplateInput {
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
  applyToAllClasses: false,
};

/** A small modal shell consistent with the app's dialog language. */
function Frame({
  title,
  eyebrow,
  onClose,
  children,
  width,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        style={{
          width: `min(${width ?? 560}px, 94vw)`,
          maxHeight: "min(760px, 92vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg-panel)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-dialog)",
        }}
      >
        <div className="modal-header">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand)]">
              {eyebrow}
            </span>
            <h2 className="panel-title" style={{ margin: "2px 0 0", fontSize: 17 }}>
              {title}
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TimetableView() {
  const [data, setData] = useState<TimetableBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  /** When set, the screen is showing the read-only mirror of the last server copy. */
  const [offlineAt, setOfflineAt] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [draft, setDraft] = useState<ClassTimetable | null>(null);
  const [saved, setSaved] = useState<ClassTimetable | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "publish" | "delete">("");
  const [writeError, setWriteError] = useState("");
  const [staleDraft, setStaleDraft] = useState<ClassTimetable | null>(null);

  // Views & modals
  const [view, setView] = useState<"classes" | "teachers">("classes");
  const [teacherId, setTeacherId] = useState("");
  const [slotModal, setSlotModal] = useState<{ day: number; periodId: string } | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySourceId, setCopySourceId] = useState("");
  const [generator, setGenerator] = useState<GeneratorState>(DEFAULT_GENERATOR);

  function load(preferredClassId?: string) {
    setLoading(true);
    setLoadError("");
    return loadTimetables()
      .then((next) => {
        setOfflineAt(null);
        setData(next);
        setClassId(
          preferredClassId && next.classrooms.some((room) => room.id === preferredClassId)
            ? preferredClassId
            : firstClassroomId(next.classrooms, next.timetables)
        );
      })
      .catch((error: unknown) => {
        // The route is unreachable. Show the last honest copy read-only, never
        // a generated one.
        const mirror = lastServerMirror();
        if (mirror && mirror.timetables.length > 0) {
          setData({
            timetables: mirror.timetables,
            classrooms: mirror.timetables.map((timetable) => ({
              id: timetable.classroomId,
              label: timetable.classroomLabel || timetable.classroomId,
              grade: "",
              section: "",
              room: "",
              classTeacherName: null,
            })),
            staff: [],
            subjects: [],
            academicYear: "",
            canManage: false,
          });
          setOfflineAt(mirror.at);
          setLoadError("");
        } else {
          setData(null);
          setLoadError(
            error instanceof ApiError
              ? error.message
              : "The timetables could not be loaded. Check your connection and try again."
          );
        }
      })
      .finally(() => setLoading(false));
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
    const room = data.classrooms.find((candidate) => candidate.id === classId);
    if (!room) {
      setDraft(null);
      setSaved(null);
      return;
    }
    const existing = data.timetables.find((timetable) => timetable.classroomId === classId);
    setSaved(existing ? clone(existing) : null);
    setDraft(
      existing
        ? clone(existing)
        : newDraftTimetable({ id: room.id, label: room.label }, data.academicYear)
    );
    setWriteError("");
    setStaleDraft(null);
  }, [classId, data]);

  const canEdit = data?.canManage === true && !offlineAt;
  const classroom = data?.classrooms.find((room) => room.id === classId) ?? null;
  const staffList = data?.staff ?? [];
  const subjectsList = data?.subjects ?? [];

  const dirty = useMemo(() => {
    if (!draft) return false;
    if (saved) return contentOf(draft) !== contentOf(saved);
    // A brand-new timetable only counts as edited once it has a bell schedule
    // or a lesson; opening an empty class must not shout "unsaved edits".
    return draft.periods.length > 0 || draft.entries.some((entry) => entry.subject.trim());
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

  /** Cells of the current class involved in a school-wide clash. */
  const clashCells = useMemo(() => {
    if (!draft) return new Set<string>();
    const set = new Set<string>();
    const periods = new Map(draft.periods.map((period) => [period.id, period]));
    for (const conflict of conflicts) {
      for (const entry of draft.entries) {
        if (entry.teacherId !== conflict.teacherId || entry.day !== conflict.day) continue;
        const period = periods.get(entry.periodId);
        if (!period) continue;
        const start = toMinutes(period.startsAt) ?? 0;
        const end = toMinutes(period.endsAt) ?? 0;
        const conflictStart = toMinutes(conflict.startsAt) ?? 0;
        const conflictEnd = toMinutes(conflict.endsAt) ?? 0;
        if (start < conflictEnd && conflictStart < end) set.add(`${entry.day}|${entry.periodId}`);
      }
    }
    return set;
  }, [draft, conflicts]);

  const unassigned = useMemo(() => (draft ? countUnassigned(draft) : 0), [draft]);

  const stats = useMemo(() => {
    const periods = draft?.periods ?? [];
    const starts = periods
      .map((period) => toMinutes(period.startsAt))
      .filter((value): value is number => value !== null);
    const ends = periods
      .map((period) => toMinutes(period.endsAt))
      .filter((value): value is number => value !== null);
    return {
      lessons: lessonPeriods(periods).length,
      teaching: teachingMinutesPerDay(periods),
      breaks: breakMinutesPerDay(periods),
      dayLength:
        starts.length === 0 || ends.length === 0
          ? 0
          : Math.max(0, Math.max(...ends) - Math.min(...starts)),
    };
  }, [draft]);

  /** A teacher's week drawn across every saved class document. */
  const teacherWeek = useMemo(() => {
    if (!data) return null;
    const teacher = staffList.find((member) => member.id === teacherId) ?? null;
    const slots: {
      day: number;
      start: number;
      end: number;
      classLabel: string;
      subject: string;
      room: string;
      published: boolean;
      classroomId: string;
      periodId: string;
    }[] = [];
    if (teacher) {
      for (const timetable of data.timetables) {
        const periods = new Map(timetable.periods.map((period) => [period.id, period]));
        for (const entry of timetable.entries) {
          if (entry.teacherId !== teacher.id || !entry.subject.trim()) continue;
          const period = periods.get(entry.periodId);
          if (!period || period.kind !== "lesson") continue;
          const start = toMinutes(period.startsAt);
          const end = toMinutes(period.endsAt);
          if (start === null || end === null) continue;
          slots.push({
            day: entry.day,
            start,
            end,
            classLabel: timetable.classroomLabel,
            subject: entry.subject.trim(),
            room: entry.room ?? "",
            published: timetable.published,
            classroomId: timetable.classroomId,
            periodId: entry.periodId,
          });
        }
      }
    }
    slots.sort((a, b) => a.day - b.day || a.start - b.start);
    const days = DAYS.map((day) => day.value).filter((day) => slots.some((slot) => slot.day === day));
    // One row per time slot on the week's axis, so the same lesson time lines
    // up across days instead of each day owning its own rows.
    const rows = new Map<string, typeof slots>();
    for (const slot of slots) {
      const rid = `${slot.start}|${slot.end}`;
      rows.set(rid, [...(rows.get(rid) ?? []), slot]);
    }
    const classes = new Set(slots.map((slot) => slot.classLabel));
    return {
      teacher,
      slots,
      days,
      rows: Array.from(rows.entries()).sort(
        (a, b) => Number(a[0].split("|")[0]) - Number(b[0].split("|")[0])
      ),
      minutes: slots.reduce((sum, slot) => sum + (slot.end - slot.start), 0),
      classes,
    };
  }, [data, staffList, teacherId]);

  /* ------------------------------ edit ops ------------------------------ */

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
      // Times ride with the row positions, not the rows, so swapping rows
      // keeps the bell clock continuous.
      const after = periods.map((period, position) => ({
        ...period,
        startsAt: timetable.periods[position].startsAt,
        endsAt: timetable.periods[position].endsAt,
      }));
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
        entries: active ? timetable.entries.filter((entry) => entry.day !== day) : timetable.entries,
      };
    });
  }

  function entryFor(day: number, periodId: string) {
    return draft?.entries.find((entry) => entry.day === day && entry.periodId === periodId) ?? null;
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
            { day, periodId, subject: "", teacherId: null, teacherName: null, room: "", ...patch },
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

  function clearSlot(day: number, periodId: string) {
    setEntry(day, periodId, { subject: "", teacherId: null, teacherName: null, room: "" });
  }

  function copySlotToAllDays(periodId: string, day: number) {
    const current = entryFor(day, periodId);
    if (!current || !current.subject.trim()) {
      toast.error("Slot is empty", {
        description: "Set a subject first, then copy it across the week.",
      });
      return;
    }
    patchDraft((timetable) => {
      const others = timetable.days.filter((value) => value !== day);
      const kept = timetable.entries.filter(
        (entry) => entry.periodId !== periodId || !others.includes(entry.day)
      );
      const copies = others.map((value) => ({ ...current, day: value, periodId }));
      return { ...timetable, entries: [...kept, ...copies] };
    });
    toast.success(`Copied ${current.subject} to every working day for this period`);
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
      const kept = timetable.entries.filter((entry) => !otherDays.includes(entry.day));
      const copies = otherDays.flatMap((target) =>
        source.map((entry) => ({ ...entry, day: target }))
      );
      return { ...timetable, entries: [...kept, ...copies] };
    });
    toast.success(`${dayLabel(day)} schedule copied to the whole week`);
  }

  function clearDay(day: number) {
    patchDraft((timetable) => ({
      ...timetable,
      entries: timetable.entries.filter((entry) => entry.day !== day),
    }));
    toast.info(`Cleared ${dayLabel(day)} lessons`);
  }

  function applyDayTemplate() {
    if (!draft) return;
    const periods = buildBellSchedule(generator);
    patchDraft((timetable) => ({
      ...timetable,
      periods,
      entries: timetable.entries.filter(
        (entry) =>
          periods.some((period) => period.id === entry.periodId && period.kind === "lesson")
      ),
    }));
    toast.success("Day built", {
      description: `${periods.length} periods from ${periods[0]?.startsAt ?? "?"} to ${
        periods[periods.length - 1]?.endsAt ?? "?"
      }, including breaks.`,
    });
  }

  function copyFromSource() {
    if (!copySourceId || !classroom || !draft) return;
    const source = data?.timetables.find((timetable) => timetable.classroomId === copySourceId);
    if (!source) {
      toast.error("Nothing to copy", { description: "That class has no saved timetable." });
      return;
    }
    // A copy starts as an unpublished draft of THIS class; the save applies
    // the school-wide clash check before anything is written.
    const copied: ClassTimetable = {
      ...clone(source),
      classroomId: draft.classroomId,
      classroomLabel: draft.classroomLabel,
      published: false,
      publishedAt: null,
      notes: draft.notes,
    };
    setDraft(copied);
    setCopyOpen(false);
    toast.info("Copied into this class as a draft", {
      description: "Review the grid, then Save to apply the clash check.",
    });
  }

  /* ------------------------------ server ops ------------------------------ */

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
      toast.success(result.message || "Timetable saved");
    } catch (error) {
      handleWriteFailure(error);
    } finally {
      setBusy("");
    }
  }

  async function togglePublished() {
    if (!saved || !draft) return;
    setBusy("publish");
    try {
      const result = await setTimetablePublished(
        saved.classroomId,
        !saved.published,
        saved.version
      );
      absorb(result.timetable);
      toast.success(result.message);
    } catch (error) {
      handleWriteFailure(error);
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!saved || !classroom) return;
    if (!confirm(`Delete the saved timetable for ${classroom.label}? This cannot be undone.`)) {
      return;
    }
    setBusy("delete");
    try {
      await deleteTimetable(saved.classroomId);
      setSaved(null);
      const room = classroom;
      if (data) {
        setData({
          ...data,
          timetables: data.timetables.filter((timetable) => timetable.classroomId !== room.id),
        });
      }
      if (draft) {
        setDraft(
          newDraftTimetable(
            { id: draft.classroomId, label: draft.classroomLabel },
            draft.academicYear
          )
        );
      }
      toast.success(`Timetable for ${classroom.label} deleted`);
    } catch (error) {
      handleWriteFailure(error);
    } finally {
      setBusy("");
    }
  }

  /* ------------------------------ derived render data ------------------------------ */

  const grades = useMemo(() => {
    const values = Array.from(
      new Set((data?.classrooms ?? []).map((room) => room.grade).filter(Boolean))
    );
    return values.sort((a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b)));
  }, [data]);

  const visibleClassrooms = useMemo(() => {
    const rooms = data?.classrooms ?? [];
    return gradeFilter === "all"
      ? rooms
      : rooms.filter((room) => room.grade === gradeFilter);
  }, [data, gradeFilter]);

  // Keep the selection inside the visible cohort; nobody enjoys a blank grid.
  useEffect(() => {
    if (visibleClassrooms.length === 0) return;
    if (!visibleClassrooms.some((room) => room.id === classId)) {
      setClassId(visibleClassrooms[0].id);
    }
  }, [visibleClassrooms, classId]);

  const activeDays = draft?.days ?? [];
  const modals = (
    <>
      {slotModal && draft && (
        <SlotEditorModal
          key={`${slotModal.day}-${slotModal.periodId}`}
          day={slotModal.day}
          periodId={slotModal.periodId}
          entry={draft.entries.find(
            (entry) => entry.day === slotModal.day && entry.periodId === slotModal.periodId
          )}
          period={draft.periods.find((period) => period.id === slotModal.periodId) ?? null}
          staffList={staffList}
          subjectsList={subjectsList}
          clash={clashCells.has(`${slotModal.day}|${slotModal.periodId}`)}
          onChange={(patch) => setEntry(slotModal.day, slotModal.periodId, patch)}
          onClear={() => {
            clearSlot(slotModal.day, slotModal.periodId);
            setSlotModal(null);
          }}
          onCopyToAll={() => {
            copySlotToAllDays(slotModal.periodId, slotModal.day);
            setSlotModal(null);
          }}
          onClose={() => setSlotModal(null)}
        />
      )}

      {bellOpen && draft && (
        <Frame
          title={`Day & Bell Schedule — ${classroom?.label ?? ""}`}
          eyebrow="Timetable"
          width={760}
          onClose={() => setBellOpen(false)}
        >
          <BellScheduleEditor
            draft={draft}
            generator={generator}
            onGenerator={setGenerator}
            onToggleDay={toggleDay}
            onUpdatePeriod={updatePeriod}
            onAddPeriod={addPeriod}
            onRemovePeriod={removePeriod}
            onMovePeriod={movePeriod}
            onApplyTemplate={applyDayTemplate}
            onClose={() => setBellOpen(false)}
            onDiscard={() => {
              if (saved) {
                setDraft(clone(saved));
                toast.info("Draft changes discarded");
              }
              setBellOpen(false);
            }}
            canEdit={canEdit}
          />
        </Frame>
      )}

      {copyOpen && data && (
        <Frame
          title="Copy from Another Class"
          eyebrow="Timetable"
          width={460}
          onClose={() => setCopyOpen(false)}
        >
          <div className="modal-body" style={{ padding: "18px 22px" }}>
            <label>
              Source class
              <FormSelect
                ariaLabel="Source class"
                value={copySourceId}
                onChange={setCopySourceId}
                options={data.classrooms
                  .filter((room) => room.id !== classId)
                  .map((room) => ({
                    value: room.id,
                    label: `${room.label}${
                      data.timetables.some(
                        (timetable) => timetable.classroomId === room.id
                      )
                        ? data.timetables.find((timetable) => timetable.classroomId === room.id)
                            ?.published
                          ? " — published"
                          : " — draft"
                        : " — no timetable yet"
                    }`,
                  }))}
              />
            </label>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              The whole week is copied into this class as a draft. Saving runs the school-wide
              teacher clash check, so shared teachers surface immediately.
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={() => setCopyOpen(false)}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={copyFromSource}>
              <Copy size={14} />
              <span>Copy</span>
            </button>
          </div>
        </Frame>
      )}
    </>
  );

  /* ------------------------------ early states ------------------------------ */

  if (loading) {
    return (
      <section className="panel tt-loading" style={{ padding: 40, textAlign: "center" }}>
        <Loader2 size={24} className="tt-spin" style={{ margin: "0 auto 12px" }} />
        <span>Loading timetables…</span>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="panel tt-loading" style={{ padding: 32 }}>
        <AlertTriangle size={24} style={{ color: "var(--danger)", margin: "0 auto 12px" }} />
        <strong style={{ fontSize: 16 }}>Timetables could not be loaded</strong>
        <p className="tt-sub">{loadError}</p>
        <button
          type="button"
          className="secondary-button"
          style={{ marginTop: 16 }}
          onClick={() => void load(classId || undefined)}
        >
          <RefreshCw size={14} /> Try again
        </button>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="panel tt-loading" style={{ padding: 40, textAlign: "center" }}>
        <Loader2 size={24} className="tt-spin" style={{ margin: "0 auto 12px" }} />
        <span>Preparing…</span>
      </section>
    );
  }

  const teachersWithSlots = new Set<string>();
  for (const timetable of data.timetables) {
    for (const entry of timetable.entries) {
      if (entry.teacherId && entry.subject.trim()) teachersWithSlots.add(entry.teacherId);
    }
  }

  /* ------------------------------ render ------------------------------ */

  return (
    <div className="tt-shell">
      {offlineAt && (
        <div className="tt-issue warn" style={{ padding: "10px 14px" }}>
          <AlertTriangle size={14} />
          <span>
            Showing the copy saved at{" "}
            {new Date(offlineAt).toLocaleString(undefined, {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
            . Connect to the server to edit.
          </span>
        </div>
      )}

      <div className="tt-print-header" style={{ display: "none" }}>
        <h1 style={{ fontSize: 24, margin: 0, fontWeight: 700 }}>Global Kids School</h1>
        <h2 style={{ fontSize: 18, margin: "4px 0 12px", color: "#555" }}>
          Official Class Timetable — {classroom?.label ?? ""} {classroom?.room ? `(${classroom.room})` : ""}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
          {data.academicYear ? `Academic year ${data.academicYear}` : "Weekly class timetable"}
        </p>
      </div>

      {/* ------------------------------ toolbar ------------------------------ */}
      <section className="tt-toolbar-panel">
        <div className="tt-toolbar">
          <div className="tt-view-tabs" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              aria-selected={view === "classes"}
              className={`tt-grade-tab${view === "classes" ? " active" : ""}`}
              onClick={() => setView("classes")}
            >
              <CalendarDays size={12} style={{ verticalAlign: -1.5, marginRight: 5 }} />
              Class view
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "teachers"}
              className={`tt-grade-tab${view === "teachers" ? " active" : ""}`}
              onClick={() => setView("teachers")}
            >
              <Users size={12} style={{ verticalAlign: -1.5, marginRight: 5 }} />
              Teacher week
            </button>
          </div>

          <div className="tt-toolbar-actions">
            {view === "classes" && (
              <>
                <span
                  className={`tt-badge ${saved?.published ? "published" : saved ? "draft" : "draft"}`}
                >
                  {saved ? (saved.published ? <Unlock size={12} /> : <Lock size={12} />) : <Lock size={12} />}
                  {saved?.published ? "Published" : saved ? "Draft" : "Not saved yet"}
                </span>
                {dirty && canEdit && <span className="tt-badge unsaved">Unsaved edits</span>}
              </>
            )}

            {canEdit && view === "classes" && (
              <>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => setBellOpen(true)}
                >
                  <Clock3 size={14} />
                  <span>Day & periods</span>
                </button>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => {
                    setCopySourceId(data.classrooms.find((room) => room.id !== classId)?.id ?? "");
                    setCopyOpen(true);
                  }}
                  disabled={data.classrooms.filter((room) => room.id !== classId).length === 0}
                >
                  <Copy size={14} />
                  <span>Copy from…</span>
                </button>
              </>
            )}
            <button
              type="button"
              className="secondary-button compact"
              onClick={() => window.print()}
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
            {canEdit && view === "classes" && (
              <>
                {saved && (
                  <button
                    type="button"
                    className="secondary-button compact"
                    onClick={() => void togglePublished()}
                    disabled={busy !== "" || dirty}
                    title={dirty ? "Save your changes first" : undefined}
                  >
                    {saved.published ? <Lock size={14} /> : <Unlock size={14} />}
                    <span>{saved.published ? "Unpublish" : "Publish"}</span>
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
                  {busy === "save" ? <Loader2 size={14} className="tt-spin" /> : <Save size={14} />}
                  <span>Save</span>
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

        {view === "classes" &&
          (data.classrooms.length === 0 ? (
            <p className="tt-sub" style={{ marginTop: 12 }}>
              No classes exist for your school yet — timetables attach to real classes once they
              are created.
            </p>
          ) : (
            <div className="tt-classes-wrap">
              {grades.length > 1 && (
                <div className="tt-cohort-tabs" aria-label="Grade filter">
                  {["all", ...grades].map((grade) => {
                    const count =
                      grade === "all"
                        ? data.classrooms.length
                        : data.classrooms.filter((room) => room.grade === grade).length;
                    return (
                      <button
                        key={grade}
                        type="button"
                        className={`tt-grade-tab${gradeFilter === grade ? " active" : ""}`}
                        onClick={() => setGradeFilter(grade)}
                      >
                        {grade === "all" ? "All classes" : `Grade ${grade}`} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="tt-classes" role="tablist" aria-label="Select class">
                {visibleClassrooms.map((room) => {
                  const stored = data.timetables.find(
                    (timetable) => timetable.classroomId === room.id
                  );
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
                          ? `${room.label} (published)`
                          : stored
                            ? `${room.label} (draft)`
                            : `${room.label} (empty)`
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
          ))}

        {view === "teachers" && (
          <div className="tt-classes-wrap" style={{ maxWidth: 360 }}>
            <FormSelect
              ariaLabel="Choose a teacher"
              value={teacherId}
              onChange={setTeacherId}
              placeholder="Choose a teacher…"
              options={staffList.map((member) => ({
                value: member.id,
                label:
                  member.department
                    ? `${member.name} · ${member.department}`
                    : member.name,
              }))}
            />
          </div>
        )}

        {writeError && canEdit && (
          <div className="tt-issue error" style={{ marginTop: 12 }}>
            <AlertTriangle size={14} />
            <div style={{ flex: 1 }}>
              <div>{writeError}</div>
              {staleDraft && (
                <button
                  type="button"
                  className="secondary-button compact"
                  style={{ marginTop: 6 }}
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
      </section>

      {/* ------------------------------ class view ------------------------------ */}
      {view === "classes" && (
        <>
          {!draft ? (
            <section className="panel tt-loading" style={{ padding: 40, textAlign: "center" }}>
              <span>Pick a class to begin.</span>
            </section>
          ) : data.classrooms.length === 0 ? null : (
            <section className="panel tt-grid-panel" style={{ padding: "16px 18px" }}>
              <div className="tt-grid-head" style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <h3 className="tt-title" style={{ fontSize: 16 }}>
                  {classroom?.label ?? "Class"}
                </h3>
                {classroom?.room && <span className="tt-sub">Room {classroom.room}</span>}
                <span className="tt-sub">
                  {draft.periods.length === 0
                    ? "No periods yet — open “Day & periods” to build the school day."
                    : `${stats.lessons} lessons/day · ${formatDuration(stats.teaching)} teaching · ${formatDuration(stats.breaks)} breaks`}
                </span>
                {canEdit && (
                  <span style={{ flex: 1 }} />
                )}
              </div>

              <div className="tt-grid-wrap">
                <table className="tt-grid">
                  <thead>
                    <tr>
                      <th className="tt-period-head">
                        <span className="tt-period-name">Period</span>
                      </th>
                      {activeDays.map((day) => (
                        <th key={day}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {dayLabel(day, true)}
                            {canEdit && (
                              <span style={{ display: "inline-flex", gap: 3 }}>
                                <button
                                  type="button"
                                  className="tt-icon"
                                  title={`Copy ${dayLabel(day)} to all working days`}
                                  onClick={() => copyDayToAll(day)}
                                >
                                  <Copy size={11} />
                                </button>
                                <button
                                  type="button"
                                  className="tt-icon danger"
                                  title={`Clear ${dayLabel(day)} lessons`}
                                  onClick={() => clearDay(day)}
                                >
                                  <X size={11} />
                                </button>
                              </span>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {draft.periods.length === 0 ? (
                      <tr>
                        <td colSpan={Math.max(1, activeDays.length + 1)} style={{ padding: 0 }}>
                          <div className="empty-state" style={{ padding: "36px 18px" }}>
                            <CalendarDays size={22} />
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                              The day has no periods yet
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {canEdit
                                ? "Open “Day & periods” to build the bell schedule, then fill the grid."
                                : "The weekly schedule has not been set for this class yet."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      draft.periods.map((period) => {
                        if (period.kind !== "lesson") {
                          return (
                            <tr key={period.id} className={`tt-break-row kind-${period.kind}`}>
                              <th className="tt-period-head">
                                <span className="tt-period-name">{period.label}</span>
                                <span className="tt-period-time">{formatRange(period)}</span>
                              </th>
                              <td colSpan={Math.max(1, activeDays.length)}>
                                <div className="tt-break-banner">
                                  {period.label} · {formatRange(period)} (
                                  {formatDuration(periodMinutes(period))})
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
                            </th>
                            {activeDays.map((day) => {
                              const entry = entryFor(day, period.id);
                              const clash = clashCells.has(`${day}|${period.id}`);
                              return (
                                <td key={`${day}-${period.id}`}>
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      className={`tt-cell tt-cell-click${entry?.subject ? " filled" : ""}${
                                        clash ? " clash" : ""
                                      }`}
                                      title="Edit this slot"
                                      onClick={() => setSlotModal({ day, periodId: period.id })}
                                      style={{ width: "100%", textAlign: "left", display: "flex" }}
                                    >
                                      {entry?.subject ? (
                                        <>
                                          <SubjectChip subject={entry.subject} />
                                          <span
                                            className="muted-cell"
                                            style={{ fontSize: 11.5, marginTop: 2 }}
                                          >
                                            {entry.teacherName ?? <em>Teacher unset</em>}
                                            {entry.room ? ` · ${entry.room}` : ""}
                                          </span>
                                          {clash && (
                                            <span className="tt-clash-pill">
                                              <AlertTriangle size={11} /> Clash
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <span className="tt-empty-slot">
                                          <Plus size={12} /> Add lesson
                                        </span>
                                      )}
                                    </button>
                                  ) : entry?.subject ? (
                                    <div className={`tt-cell filled${clash ? " clash" : ""}`}>
                                      <SubjectChip subject={entry.subject} />
                                      <span className="muted-cell" style={{ fontSize: 11.5 }}>
                                        {entry.teacherName ?? "Teacher unset"}
                                        {entry.room ? ` · ${entry.room}` : ""}
                                      </span>
                                      {clash && (
                                        <span className="tt-clash-pill">
                                          <AlertTriangle size={11} /> Clash
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="tt-cell">
                                      <span className="muted-cell" style={{ fontSize: 11 }}>
                                        —
                                      </span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="tt-grid-foot">
                <span className="tt-legend">
                  <span className="tt-legend-dot" /> Teacher clash
                </span>
                <span className="tt-sub">
                  {activeDays.length} day{activeDays.length === 1 ? "" : "s"} ·{" "}
                  {stats.lessons * activeDays.length} lesson slots ·{" "}
                  {unassigned} without a teacher
                </span>
              </div>

              {draft.periods.length > 0 &&
                (conflicts.length > 0 || validation.errors.length > 0) && (
                <div className="tt-issues" style={{ marginTop: 8 }}>
                  {validation.errors.map((message) => (
                    <div key={message} className="tt-issue error">
                      <AlertTriangle size={13} />
                      <span>{message}</span>
                    </div>
                  ))}
                  {conflicts.map((conflict) => (
                    <div key={conflict.key} className="tt-issue error">
                      <AlertTriangle size={13} />
                      <span>
                        {conflict.teacherName} — {dayLabel(conflict.day)}{" "}
                        {conflict.startsAt}–{conflict.endsAt} wanted by{" "}
                        {conflict.classrooms.join(" & ")}
                      </span>
                    </div>
                  ))}
                  {validation.warnings.slice(0, 2).map((message) => (
                    <div key={message} className="tt-issue warn">
                      <Clock3 size={13} />
                      <span>{message}</span>
                    </div>
                  ))}
                </div>
              )}

              {canEdit && (
                <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                  <button
                    type="button"
                    className="secondary-button compact"
                    onClick={() => void remove()}
                    disabled={busy !== "" || !saved}
                  >
                    <Trash2 size={13} />
                    <span>Delete timetable</span>
                  </button>
                  <span className="tt-sub">
                    {dirty
                      ? "Changes are in this browser until you Save."
                      : saved?.published
                        ? "Published — visible to pupils and parents."
                        : "Saved as a draft."}
                  </span>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* ------------------------------ teacher view ------------------------------ */}
      {view === "teachers" && (
        <section className="panel tt-grid-panel" style={{ padding: "16px 18px" }}>
          {!teacherWeek?.teacher ? (
            <div className="empty-state" style={{ padding: "40px 20px" }}>
              <Users size={22} />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {staffList.length === 0
                  ? "No staff records yet"
                  : "Pick a teacher to see their week"}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {staffList.length === 0
                  ? "Staff records appear here once they exist for your school."
                  : "Their lessons across every class appear in one grid — the fastest way to read a workload."}
              </p>
            </div>
          ) : teacherWeek.slots.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 20px" }}>
              <CalendarDays size={22} />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {teacherWeek.teacher.name} has no lessons on any class timetable yet
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Assign{teacherWeek.teacher.name} to slots in the class view; the week fills in
                here automatically.
              </p>
            </div>
          ) : (
            <>
              <div className="tt-grid-head" style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <h3 className="tt-title" style={{ fontSize: 16 }}>
                  {teacherWeek.teacher.name}'s week
                </h3>
                <span className="tt-sub">
                  {teacherWeek.slots.length} lessons · {formatDuration(teacherWeek.minutes)} /
                  week · {teacherWeek.classes.size} classes
                </span>
              </div>
              {teacherId && staffList.some((member) => member.id === teacherId) === false && (
                <span className="tt-sub">Teacher record not found.</span>
              )}
              <div className="tt-grid-wrap">
                <table className="tt-grid">
                  <thead>
                    <tr>
                      <th className="tt-period-head">
                        <span className="tt-period-name">Time</span>
                      </th>
                      {teacherWeek.days.map((day) => (
                        <th key={day}>{dayLabel(day, true)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teacherWeek.rows.map(([rowId, rowSlots]) => {
                      const [startRaw, endRaw] = rowId.split("|").map(Number);
                      return (
                        <tr key={rowId}>
                          <th className="tt-period-head">
                            <span className="tt-period-name">
                              {fromMinutes(startRaw)}–{fromMinutes(endRaw)}
                            </span>
                          </th>
                          {teacherWeek.days.map((day) => {
                            const cellSlots = rowSlots.filter((slot) => slot.day === day);
                            if (cellSlots.length === 0) {
                              return <td key={`${rowId}-${day}`} />;
                            }
                            return (
                              <td key={`${rowId}-${day}`}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {cellSlots.length > 1 && (
                                    <span className="tt-clash-pill">
                                      <AlertTriangle size={11} /> Double-booked
                                    </span>
                                  )}
                                  {cellSlots.map((slot) => (
                                    <div
                                      key={`${slot.classroomId}-${slot.periodId}`}
                                      className="tt-cell filled"
                                      style={{ minHeight: 0, padding: "7px 9px" }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 6,
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        <span
                                          className="grade-chip"
                                          style={{ fontSize: 11 }}
                                        >
                                          {slot.classLabel}
                                        </span>
                                        {!slot.published && (
                                          <span className="status-pill neutral" style={{ fontSize: 10, padding: "2px 8px" }}>
                                            draft
                                          </span>
                                        )}
                                      </div>
                                      <SubjectChip subject={slot.subject} />
                                      {slot.room && (
                                        <span className="muted-cell" style={{ fontSize: 11 }}>
                                          {slot.room}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="tt-grid-foot">
                <span className="tt-sub">
                  Draft timetables are marked; published ones are live for pupils and parents.
                </span>
              </div>
            </>
          )}
        </section>
      )}

      {modals}
    </div>
  );
}

/* =========================================================================
   SLOT EDITOR — one modal per grid cell
   ========================================================================= */

function SlotEditorModal({
  day,
  periodId,
  period,
  entry,
  staffList,
  subjectsList,
  clash,
  onChange,
  onClear,
  onCopyToAll,
  onClose,
}: {
  day: number;
  periodId: string;
  period: BellPeriod | null;
  entry: ClassTimetable["entries"][number] | undefined;
  staffList: { id: string; name: string; department: string }[];
  subjectsList: { id: string; name: string }[];
  clash: boolean;
  onChange: (patch: Partial<ClassTimetable["entries"][number]>) => void;
  onClear: () => void;
  onCopyToAll: () => void;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(entry?.subject ?? "");
  const [teacherId, setTeacherId] = useState(entry?.teacherId ?? "");
  const [room, setRoom] = useState(entry?.room ?? "");

  const subjectKnown = (key: string) =>
    subjectsList.some((candidate) => candidate.name.toLowerCase() === key.trim().toLowerCase());

  const commit = (next: {
    subject?: string;
    teacherId?: string;
    room?: string;
  }) => {
    const patch: Partial<ClassTimetable["entries"][number]> = {};
    if (next.subject !== undefined) patch.subject = next.subject;
    if (next.room !== undefined) patch.room = next.room;
    if (next.teacherId !== undefined) {
      const teacher = staffList.find((member) => member.id === next.teacherId);
      patch.teacherId = teacher?.id ?? null;
      patch.teacherName = teacher?.name ?? null;
    }
    onChange(patch);
  };

  return (
    <Frame
      title={`${dayLabel(day)} · ${period?.label ?? "Period"}${period ? ` (${formatRange(period)})` : ""}`}
      eyebrow="Lesson slot"
      width={480}
      onClose={onClose}
    >
      <datalist id="tt-subject-options">
        {subjectsList.map((subjectOption) => (
          <option key={subjectOption.id} value={subjectOption.name} />
        ))}
      </datalist>

      <div className="modal-body" style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        <label className="tt-field">
          Subject
          <input
            className="tt-input"
            type="text"
            list="tt-subject-options"
            placeholder={
              subjectsList.length > 0 ? "e.g. Mathematics" : "e.g. Mathematics — add subjects in Academics to get suggestions"
            }
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              commit({ subject: event.target.value });
            }}
            autoFocus
          />
        </label>
        {subjectsList.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]" style={{ marginTop: -8 }}>
            The subject catalog is empty, so type the subject here. Names that exist in the catalog
            stay consistent across classes.
          </p>
        )}
        {subject.trim() && !subjectKnown(subject) && (
          <p className="text-xs text-[var(--warning)]" style={{ marginTop: -8 }}>
            Not a catalog subject — it is saved exactly as typed.
          </p>
        )}

        <label className="tt-field">
          Teacher
          <select
            className="tt-select"
            value={teacherId}
            onChange={(event) => {
              setTeacherId(event.target.value);
              commit({ teacherId: event.target.value });
            }}
          >
            <option value="">Not assigned</option>
            {staffList.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.department ? ` · ${member.department}` : ""}
              </option>
            ))}
          </select>
        </label>
        {staffList.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]" style={{ marginTop: -8 }}>
            No staff records available, so the teacher is left unset — the slot counts as unfilled
            until staff exist.
          </p>
        )}

        <label className="tt-field">
          Room
          <input
            className="tt-input"
            type="text"
            placeholder="e.g. Room 204"
            value={room}
            onChange={(event) => {
              setRoom(event.target.value);
              commit({ room: event.target.value });
            }}
          />
        </label>

        {clash && (
          <div className="tt-issue error" style={{ fontSize: 12 }}>
            <AlertTriangle size={13} />
            <span>
              The assigned teacher is booked in another class at this time. Saving is allowed —
              the clash is listed so it can be fixed deliberately.
            </span>
          </div>
        )}
      </div>

      <div className="modal-footer" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="secondary-button compact" onClick={onCopyToAll}>
            <Copy size={13} />
            <span>To all days</span>
          </button>
          <button type="button" className="secondary-button compact" onClick={onClear}>
            <Undo2 size={13} />
            <span>Clear</span>
          </button>
        </div>
        <button type="button" className="primary-button compact" onClick={onClose}>
          <Check size={14} />
          <span>Done</span>
        </button>
      </div>
    </Frame>
  );
}

/* =========================================================================
   DAY & BELL SCHEDULE
   ========================================================================= */

function BellScheduleEditor({
  draft,
  generator,
  onGenerator,
  onToggleDay,
  onUpdatePeriod,
  onAddPeriod,
  onRemovePeriod,
  onMovePeriod,
  onApplyTemplate,
  onClose,
  onDiscard,
  canEdit,
}: {
  draft: ClassTimetable;
  generator: GeneratorState;
  onGenerator: (next: GeneratorState) => void;
  onToggleDay: (day: number) => void;
  onUpdatePeriod: (id: string, patch: Partial<BellPeriod>) => void;
  onAddPeriod: (kind: PeriodKind) => void;
  onRemovePeriod: (id: string) => void;
  onMovePeriod: (id: string, direction: -1 | 1) => void;
  onApplyTemplate: () => void;
  onClose: () => void;
  onDiscard: () => void;
  canEdit: boolean;
}) {
  return (
    <>
      <div className="modal-body" style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]" style={{ marginBottom: 8 }}>
            Working days
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {DAYS.map((day) => {
              const value = Number(day.value ?? day);
              const label = String(day.label ?? day);
              const active = draft.days.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={!canEdit}
                  className={`tt-grade-tab${active ? " active" : ""}`}
                  onClick={() => onToggleDay(value)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Periods of the day
            </p>
            {canEdit && (
              <div className="flex items-center gap-2">
                {PERIOD_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="secondary-button compact"
                    onClick={() => onAddPeriod(kind)}
                  >
                    <Plus size={12} />
                    <span>{PERIOD_KIND_LABELS[kind]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="tt-periods" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {draft.periods.map((period, index) => (
              <div
                key={period.id}
                className="tt-period"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 0.9fr 0.9fr auto",
                  gap: 8,
                  alignItems: "center",
                  padding: "7px 9px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background:
                    period.kind === "lesson"
                      ? "var(--bg-panel)"
                      : period.kind === "lunch"
                        ? "rgba(47, 111, 104, 0.06)"
                        : "rgba(245, 158, 11, 0.06)",
                }}
              >
                <input
                  className="tt-input"
                  value={period.label}
                  disabled={!canEdit}
                  aria-label="Period label"
                  onChange={(event) => onUpdatePeriod(period.id, { label: event.target.value })}
                />
                <input
                  type="time"
                  className="tt-input"
                  value={period.startsAt}
                  disabled={!canEdit}
                  aria-label="Starts at"
                  onChange={(event) => onUpdatePeriod(period.id, { startsAt: event.target.value })}
                />
                <input
                  type="time"
                  className="tt-input"
                  value={period.endsAt}
                  disabled={!canEdit}
                  aria-label="Ends at"
                  onChange={(event) => onUpdatePeriod(period.id, { endsAt: event.target.value })}
                />
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    className="tt-icon"
                    disabled={!canEdit || index === 0}
                    onClick={() => onMovePeriod(period.id, -1)}
                    aria-label="Move earlier"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="tt-icon"
                    disabled={!canEdit || index === draft.periods.length - 1}
                    onClick={() => onMovePeriod(period.id, 1)}
                    aria-label="Move later"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="tt-icon danger"
                    disabled={!canEdit}
                    onClick={() => onRemovePeriod(period.id)}
                    aria-label={`Remove ${period.label}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
            ))}
            {draft.periods.length === 0 && (
              <p className="tt-sub" style={{ padding: "8px 2px" }}>
                No periods yet — add lessons and breaks manually, or build a whole day with the
                template below.
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "12px 14px",
              background: "var(--bg-subtle)",
            }}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]" style={{ marginBottom: 8 }}>
              Build a whole day from numbers
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(90px, 1fr))", gap: 10 }}>
              <label>
                Day starts
                <input
                  type="time"
                  className="tt-input"
                  value={generator.dayStart}
                  onChange={(event) => onGenerator({ ...generator, dayStart: event.target.value })}
                />
              </label>
              <label>
                Lesson minutes
                <input
                  type="number"
                  min={20}
                  max={120}
                  className="tt-input"
                  value={generator.lessonMinutes}
                  onChange={(event) =>
                    onGenerator({ ...generator, lessonMinutes: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Lessons
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="tt-input"
                  value={generator.lessonCount}
                  onChange={(event) =>
                    onGenerator({ ...generator, lessonCount: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Break after lesson #
                <input
                  type="number"
                  min={0}
                  max={12}
                  className="tt-input"
                  value={generator.shortBreakAfter}
                  onChange={(event) =>
                    onGenerator({ ...generator, shortBreakAfter: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Break minutes
                <input
                  type="number"
                  min={5}
                  max={60}
                  className="tt-input"
                  value={generator.shortBreakMinutes}
                  onChange={(event) =>
                    onGenerator({ ...generator, shortBreakMinutes: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Lunch after lesson #
                <input
                  type="number"
                  min={0}
                  max={12}
                  className="tt-input"
                  value={generator.lunchAfter}
                  onChange={(event) =>
                    onGenerator({ ...generator, lunchAfter: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <div className="flex items-center justify-between mt-3" style={{ gap: 8 }}>
              <p className="tt-sub" style={{ margin: 0 }}>
                Replacing the period list also removes entries of deleted periods.
              </p>
              <button type="button" className="primary-button compact" onClick={onApplyTemplate}>
                <Clock3 size={14} />
                <span>Build the day</span>
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="secondary-button" onClick={onDiscard}>
          <Undo2 size={14} />
          <span>Discard changes</span>
        </button>
        <button type="button" className="primary-button" onClick={onClose}>
          <Check size={14} />
          <span>Done</span>
        </button>
      </div>
    </>
  );
}

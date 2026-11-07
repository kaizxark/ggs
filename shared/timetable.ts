/**
 * The rules of a class timetable.
 *
 * ## Why this file is shared
 *
 * A timetable is a small, extremely constrained document: periods that must not
 * overlap, a lunch that must exist, lessons that need a teacher who is not
 * already standing in another classroom at that minute. The API route and the
 * editor both need those rules, and having two copies of them is how a form ends
 * up cheerfully saving something the server then rejects — or, worse, accepting
 * something neither of them checked.
 *
 * So the rules live here once, in plain TypeScript with no database or React
 * dependency, and both sides import them. That also makes them testable without
 * a server, a session or a network.
 *
 * ## The shape
 *
 * A timetable is a *bell schedule* (the day's periods, in order, including
 * breaks and lunch) plus a grid of entries (day × lesson period → subject and
 * teacher). Keeping the two apart is what makes the editor sane: moving lunch
 * five minutes later moves it for every day at once, instead of editing thirty
 * separate cells and hoping they still line up.
 */

/** Working days, numbered the ISO way: Monday is 1, Sunday is 7. */
export const DAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
] as const;

export function dayLabel(day: number, short = false): string {
  const hit = DAYS.find((d) => d.value === day);
  if (!hit) return `Day ${day}`;
  return short ? hit.short : hit.label;
}

/**
 * What a slot in the day is for.
 *
 * Only `lesson` may hold a subject. Everything else is a fixed part of the day
 * that appears on every class's timetable identically.
 */
export const PERIOD_KINDS = [
  "lesson",
  "break",
  "lunch",
  "assembly",
  "activity",
] as const;

export type PeriodKind = (typeof PERIOD_KINDS)[number];

export const PERIOD_KIND_LABELS: Record<PeriodKind, string> = {
  lesson: "Lesson",
  break: "Short break",
  lunch: "Lunch break",
  assembly: "Assembly",
  activity: "Activity / games",
};

export interface BellPeriod {
  /** Stable within one timetable; entries point at it. */
  id: string;
  label: string;
  kind: PeriodKind;
  /** `HH:MM`, 24-hour. */
  startsAt: string;
  /** `HH:MM`, 24-hour. Always after `startsAt` on a valid timetable. */
  endsAt: string;
}

export interface TimetableEntry {
  /** ISO day number, 1 = Monday. */
  day: number;
  /** The `BellPeriod.id` this lesson sits in. */
  periodId: string;
  /** Free text, but normally one of the school's subjects. */
  subject: string;
  teacherId: string | null;
  /** Kept alongside the id so an old timetable still reads correctly after a
   *  member of staff leaves and their row is removed. */
  teacherName: string | null;
  room: string;
}

export interface ClassTimetable {
  classroomId: string;
  /** Denormalised for display and for the stored document to be self-describing. */
  classroomLabel: string;
  academicYear: string;
  days: number[];
  periods: BellPeriod[];
  entries: TimetableEntry[];
  /** Bumped on every write; the editor sends the one it started from. */
  version: number;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  notes: string;
}

/* ------------------------------------------------------------------ */
/* Time                                                                */
/* ------------------------------------------------------------------ */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes since midnight, or null when the value is not a `HH:MM` time. */
export function toMinutes(value: unknown): number | null {
  const match = TIME_PATTERN.exec(String(value ?? "").trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** `HH:MM`, wrapped into a single day. */
export function fromMinutes(total: number): string {
  const wrapped = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(
    wrapped % 60
  ).padStart(2, "0")}`;
}

/** Length of a period, or 0 when its times are not valid yet. */
export function periodMinutes(period: Pick<BellPeriod, "startsAt" | "endsAt">): number {
  const start = toMinutes(period.startsAt);
  const end = toMinutes(period.endsAt);
  if (start === null || end === null) return 0;
  return Math.max(0, end - start);
}

export function formatDuration(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (!hours) return `${rest} min`;
  if (!rest) return `${hours} hr`;
  return `${hours} hr ${rest} min`;
}

export function formatRange(period: Pick<BellPeriod, "startsAt" | "endsAt">): string {
  return `${period.startsAt} – ${period.endsAt}`;
}

/** Periods in the order they happen. Ties keep their existing order. */
export function sortPeriods(periods: BellPeriod[]): BellPeriod[] {
  return periods
    .map((period, index) => ({ period, index }))
    .sort((a, b) => {
      const left = toMinutes(a.period.startsAt) ?? Number.MAX_SAFE_INTEGER;
      const right = toMinutes(b.period.startsAt) ?? Number.MAX_SAFE_INTEGER;
      return left === right ? a.index - b.index : left - right;
    })
    .map((entry) => entry.period);
}

/** When the next period should begin if one is appended. */
export function endOfDay(periods: BellPeriod[]): string {
  const last = periods.reduce<number>((latest, period) => {
    const end = toMinutes(period.endsAt);
    return end !== null && end > latest ? end : latest;
  }, 0);
  return fromMinutes(last || 8 * 60);
}

/* ------------------------------------------------------------------ */
/* Derived figures                                                     */
/* ------------------------------------------------------------------ */

export function lessonPeriods(periods: BellPeriod[]): BellPeriod[] {
  return periods.filter((period) => period.kind === "lesson");
}

/** Teaching minutes in one day, breaks excluded. */
export function teachingMinutesPerDay(periods: BellPeriod[]): number {
  return lessonPeriods(periods).reduce((sum, period) => sum + periodMinutes(period), 0);
}

export function breakMinutesPerDay(periods: BellPeriod[]): number {
  return periods
    .filter((period) => period.kind !== "lesson")
    .reduce((sum, period) => sum + periodMinutes(period), 0);
}

/** Lesson slots that have no subject yet, across every working day. */
export function countUnassigned(
  timetable: Pick<ClassTimetable, "periods" | "entries" | "days">
): number {
  const filled = new Set(
    timetable.entries
      .filter((entry) => entry.subject.trim() !== "")
      .map((entry) => `${entry.day}|${entry.periodId}`)
  );
  let missing = 0;
  for (const period of lessonPeriods(timetable.periods)) {
    for (const day of timetable.days) {
      if (!filled.has(`${day}|${period.id}`)) missing += 1;
    }
  }
  return missing;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface ValidationResult {
  /** Must be empty before anything is saved. */
  errors: string[];
  /** Worth showing, but a timetable can be saved with these. */
  warnings: string[];
}

/**
 * Check a timetable from the point of view of the person who will teach it.
 *
 * Errors are things that cannot be true (two periods in the same minute, a
 * subject on a break). Warnings are things that are true but suspicious — a
 * nine-hour day, a lesson with no teacher, a timetable with no lunch — and a
 * head teacher needs to be told about them without being stopped.
 */
export function validateTimetable(
  timetable: Pick<ClassTimetable, "periods" | "entries" | "days">
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (timetable.days.length === 0) {
    errors.push("Choose at least one working day.");
  }

  const periods = timetable.periods;
  if (periods.length === 0) {
    errors.push("Add at least one period to the school day.");
    return { errors, warnings };
  }

  if (lessonPeriods(periods).length === 0) {
    errors.push("A timetable needs at least one lesson period.");
  }

  const seenIds = new Set<string>();
  for (const period of periods) {
    const label = period.label.trim() || "Untitled period";
    if (!period.label.trim()) errors.push("Every period needs a name.");
    if (seenIds.has(period.id)) {
      errors.push(`Two periods share the reference “${period.id}”.`);
    }
    seenIds.add(period.id);

    const start = toMinutes(period.startsAt);
    const end = toMinutes(period.endsAt);
    if (start === null || end === null) {
      errors.push(`${label}: enter a valid start and end time (HH:MM).`);
    } else if (end <= start) {
      errors.push(`${label}: the end time must be after the start time.`);
    } else if (period.kind === "lesson") {
      const length = end - start;
      if (length < 20) warnings.push(`${label} is only ${length} minutes long.`);
      if (length > 90) {
        warnings.push(`${label} runs for ${formatDuration(length)} — a long stretch for one subject.`);
      }
    }
  }

  const ordered = sortPeriods(periods);
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const previousEnd = toMinutes(previous.endsAt);
    const currentStart = toMinutes(current.startsAt);
    if (previousEnd === null || currentStart === null) continue;

    if (currentStart < previousEnd) {
      errors.push(
        `${current.label} starts at ${current.startsAt}, before ${previous.label} ends at ${previous.endsAt} — the two overlap.`
      );
    } else if (currentStart > previousEnd) {
      warnings.push(
        `${formatDuration(currentStart - previousEnd)} is unassigned between ${previous.label} and ${current.label}.`
      );
    }
  }

  const lunches = ordered.filter((period) => period.kind === "lunch");
  if (lunches.length === 0) warnings.push("No lunch break is scheduled.");
  if (lunches.length > 1) warnings.push("More than one lunch break is scheduled.");
  for (const lunch of lunches) {
    const length = periodMinutes(lunch);
    if (length > 0 && length < 20) {
      warnings.push(`${lunch.label} is only ${length} minutes long.`);
    }
  }

  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const dayStart = toMinutes(first.startsAt);
  const dayEnd = toMinutes(last.endsAt);
  if (dayStart !== null && dayEnd !== null && dayEnd - dayStart > 540) {
    warnings.push(
      `The school day runs ${formatDuration(dayEnd - dayStart)}, which is longer than nine hours.`
    );
  }

  const byId = new Map(periods.map((period) => [period.id, period]));
  const seenSlots = new Set<string>();
  const days = new Set(timetable.days);

  for (const entry of timetable.entries) {
    const period = byId.get(entry.periodId);
    if (!period) {
      errors.push("A lesson is attached to a period that no longer exists.");
      continue;
    }
    if (period.kind !== "lesson") {
      errors.push(`${period.label} is not a lesson period, so it cannot hold a subject.`);
    }
    if (!days.has(entry.day)) {
      errors.push(`${period.label} has a lesson on a day this timetable does not run.`);
    }
    const slot = `${entry.day}|${entry.periodId}`;
    if (seenSlots.has(slot)) {
      errors.push(`${period.label} is assigned twice on the same day.`);
    }
    seenSlots.add(slot);
  }

  const unassigned = countUnassigned(timetable);
  if (unassigned > 0) {
    warnings.push(
      `${unassigned} lesson slot${unassigned === 1 ? " has" : "s have"} no subject yet.`
    );
  }

  return { errors, warnings };
}

/* ------------------------------------------------------------------ */
/* Teacher clashes                                                     */
/* ------------------------------------------------------------------ */

export interface TeacherConflict {
  key: string;
  teacherId: string;
  teacherName: string;
  day: number;
  startsAt: string;
  endsAt: string;
  /** The classes that want the same teacher at the same time. */
  classrooms: string[];
}

/**
 * Find the same teacher booked into two classes at once.
 *
 * This is the single most useful thing a timetable screen can tell a head
 * teacher, and it is invisible in any one class's page — which is exactly why
 * it is computed across every timetable the school has, not just the draft on
 * screen.
 */
export function findTeacherConflicts(timetables: ClassTimetable[]): TeacherConflict[] {
  interface Slot {
    teacherId: string;
    teacherName: string;
    day: number;
    start: number;
    end: number;
    classroom: string;
    classroomLabel: string;
  }

  const slots: Slot[] = [];
  for (const timetable of timetables) {
    const periods = new Map(timetable.periods.map((period) => [period.id, period]));
    for (const entry of timetable.entries) {
      if (!entry.teacherId || !entry.subject.trim()) continue;
      const period = periods.get(entry.periodId);
      if (!period) continue;
      const start = toMinutes(period.startsAt);
      const end = toMinutes(period.endsAt);
      if (start === null || end === null || end <= start) continue;
      slots.push({
        teacherId: entry.teacherId,
        teacherName: entry.teacherName?.trim() || entry.subject,
        day: entry.day,
        start,
        end,
        classroom: timetable.classroomId,
        classroomLabel: timetable.classroomLabel,
      });
    }
  }

  const conflicts = new Map<string, TeacherConflict & { labels: string[] }>();
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i];
      const b = slots[j];
      if (a.teacherId !== b.teacherId) continue;
      if (a.day !== b.day) continue;
      if (a.classroom === b.classroom) continue;
      if (a.start >= b.end || b.start >= a.end) continue;

      const start = Math.min(a.start, b.start);
      const end = Math.max(a.end, b.end);
      const key = `${a.teacherId}|${a.day}|${start}|${end}`;
      const existing = conflicts.get(key);
      if (existing) {
        for (const label of [a.classroomLabel, b.classroomLabel]) {
          if (!existing.labels.includes(label)) existing.labels.push(label);
        }
        existing.classrooms = existing.labels;
        continue;
      }
      const labels: string[] = [];
      for (const label of [a.classroomLabel, b.classroomLabel]) {
        if (!labels.includes(label)) labels.push(label);
      }
      conflicts.set(key, {
        key,
        teacherId: a.teacherId,
        teacherName: a.teacherName,
        day: a.day,
        startsAt: fromMinutes(start),
        endsAt: fromMinutes(end),
        classrooms: labels,
        labels,
      });
    }
  }

  return Array.from(conflicts.values()).map(({ labels, ...conflict }) => {
    void labels;
    return conflict;
  });
}

/* ------------------------------------------------------------------ */
/* Building a day                                                      */
/* ------------------------------------------------------------------ */

export interface ScheduleTemplateInput {
  dayStart: string;
  lessonMinutes: number;
  lessonCount: number;
  /** Insert the short break after this lesson; 0 for none. */
  shortBreakAfter: number;
  shortBreakMinutes: number;
  /** Insert lunch after this lesson; 0 for none. */
  lunchAfter: number;
  lunchMinutes: number;
  /** Optional assembly at the very start of the day. */
  assemblyMinutes?: number;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Draft a contiguous day from a handful of numbers.
 *
 * Nobody wants to type fourteen start and end times to get a standard school
 * day; they want to say "six 45-minute lessons, a 15-minute break after the
 * second, lunch after the fourth" and then correct the result. This produces
 * exactly that, with no gaps and no overlaps by construction.
 */
export function buildBellSchedule(input: ScheduleTemplateInput): BellPeriod[] {
  const start = toMinutes(input.dayStart) ?? 8 * 60;
  const lessonMinutes = clampInt(input.lessonMinutes, 20, 90, 45);
  const lessonCount = clampInt(input.lessonCount, 1, 14, 6);
  const shortBreakAfter = clampInt(input.shortBreakAfter, 0, lessonCount, 0);
  const shortBreakMinutes = clampInt(input.shortBreakMinutes, 0, 60, 15);
  const lunchAfter = clampInt(input.lunchAfter, 0, lessonCount, 0);
  const lunchMinutes = clampInt(input.lunchMinutes, 0, 90, 30);
  const assemblyMinutes = clampInt(input.assemblyMinutes ?? 0, 0, 45, 0);

  const periods: BellPeriod[] = [];
  let cursor = start;

  if (assemblyMinutes > 0) {
    periods.push({
      id: "assembly",
      label: "Assembly",
      kind: "assembly",
      startsAt: fromMinutes(cursor),
      endsAt: fromMinutes(cursor + assemblyMinutes),
    });
    cursor += assemblyMinutes;
  }

  for (let index = 1; index <= lessonCount; index += 1) {
    periods.push({
      id: `p${index}`,
      label: `Period ${index}`,
      kind: "lesson",
      startsAt: fromMinutes(cursor),
      endsAt: fromMinutes(cursor + lessonMinutes),
    });
    cursor += lessonMinutes;

    if (index === shortBreakAfter && shortBreakMinutes > 0) {
      periods.push({
        id: "break-1",
        label: "Short break",
        kind: "break",
        startsAt: fromMinutes(cursor),
        endsAt: fromMinutes(cursor + shortBreakMinutes),
      });
      cursor += shortBreakMinutes;
    }

    if (index === lunchAfter && lunchMinutes > 0) {
      periods.push({
        id: "lunch",
        label: "Lunch break",
        kind: "lunch",
        startsAt: fromMinutes(cursor),
        endsAt: fromMinutes(cursor + lunchMinutes),
      });
      cursor += lunchMinutes;
    }
  }

  return periods;
}

/**
 * The day a brand-new timetable starts from.
 *
 * Deliberately a real, plausible Indian school day — assembly, six lessons, a
 * short break and lunch — rather than an empty list. Opening a blank grid and
 * being asked for fourteen times is where most timetabling tools lose people.
 */
export function blankTimetable(input: {
  classroomId: string;
  classroomLabel: string;
  academicYear?: string;
}): ClassTimetable {
  return {
    classroomId: input.classroomId,
    classroomLabel: input.classroomLabel,
    academicYear: input.academicYear ?? "",
    days: [1, 2, 3, 4, 5, 6],
    periods: buildBellSchedule({
      dayStart: "08:00",
      lessonMinutes: 45,
      lessonCount: 6,
      shortBreakAfter: 2,
      shortBreakMinutes: 15,
      lunchAfter: 4,
      lunchMinutes: 30,
      assemblyMinutes: 0,
    }),
    entries: [],
    version: 0,
    published: false,
    publishedAt: null,
    updatedAt: null,
    updatedBy: null,
    notes: "",
  };
}

/* ------------------------------------------------------------------ */
/* Input normalisation                                                 */
/* ------------------------------------------------------------------ */

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function cleanText(value: unknown, max: number): string {
  // Control characters are stripped because these strings are written into a
  // JSON document and read back into inputs; a stray newline is never intended.
  // eslint-disable-next-line no-control-regex
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
}

function safeId(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return SAFE_ID.test(text) ? text : fallback;
}

/**
 * Turn whatever arrived over the wire into a timetable that can be stored.
 *
 * Lengths are clamped and unknown kinds are discarded rather than trusted, so a
 * malformed request cannot write a document the editor then chokes on. This is
 * deliberately forgiving about *shape*; whether the result makes sense is
 * `validateTimetable`'s job, and its errors are what the caller is told about.
 */
export function normaliseTimetable(
  input: unknown,
  context: { classroomId: string; classroomLabel: string; academicYear?: string }
): ClassTimetable {
  const raw = (input ?? {}) as Record<string, unknown>;

  const days = Array.isArray(raw.days)
    ? Array.from(new Set(raw.days.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)))
    : [];
  days.sort((a, b) => a - b);

  const periods: BellPeriod[] = [];
  if (Array.isArray(raw.periods)) {
    raw.periods.slice(0, 40).forEach((item, index) => {
      const period = (item ?? {}) as Record<string, unknown>;
      const kind = PERIOD_KINDS.includes(period.kind as PeriodKind)
        ? (period.kind as PeriodKind)
        : "lesson";
      periods.push({
        id: safeId(period.id, `p${index + 1}`),
        label: cleanText(period.label, 40) || `Period ${index + 1}`,
        kind,
        startsAt: cleanText(period.startsAt, 5),
        endsAt: cleanText(period.endsAt, 5),
      });
    });
  }

  const seen = new Set<string>();
  const entries: TimetableEntry[] = [];
  if (Array.isArray(raw.entries)) {
    for (const item of raw.entries.slice(0, 500)) {
      const entry = (item ?? {}) as Record<string, unknown>;
      const day = Number(entry.day);
      const periodId = safeId(entry.periodId, "");
      const subject = cleanText(entry.subject, 60);
      if (!Number.isInteger(day) || day < 1 || day > 7) continue;
      if (!periodId) continue;
      if (!subject && !cleanText(entry.teacherId, 64)) continue;
      const slot = `${day}|${periodId}`;
      if (seen.has(slot)) continue;
      seen.add(slot);
      entries.push({
        day,
        periodId,
        subject,
        teacherId: cleanText(entry.teacherId, 64) || null,
        teacherName: cleanText(entry.teacherName, 80) || null,
        room: cleanText(entry.room, 24),
      });
    }
  }

  return {
    classroomId: context.classroomId,
    classroomLabel: context.classroomLabel,
    academicYear: cleanText(context.academicYear, 40),
    days,
    periods: sortPeriods(periods),
    entries,
    version: clampInt(raw.version, 0, Number.MAX_SAFE_INTEGER, 0),
    published: raw.published === true,
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
    notes: cleanText(raw.notes, 400),
  };
}

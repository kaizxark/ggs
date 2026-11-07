import { describe, expect, it } from "vitest";

import {
  blankTimetable,
  buildBellSchedule,
  countUnassigned,
  findTeacherConflicts,
  formatDuration,
  fromMinutes,
  normaliseTimetable,
  periodMinutes,
  sortPeriods,
  toMinutes,
  validateTimetable,
  type BellPeriod,
  type ClassTimetable,
} from "./timetable";

function timetableFrom(
  id: string,
  periods: BellPeriod[],
  entries: ClassTimetable["entries"],
  days = [1, 2]
): ClassTimetable {
  return {
    classroomId: id,
    classroomLabel: `Grade ${id}`,
    academicYear: "2026-27",
    days,
    periods,
    entries,
    version: 0,
    published: false,
    publishedAt: null,
    updatedAt: null,
    updatedBy: null,
    notes: "",
  };
}

const MORNING: BellPeriod[] = [
  { id: "p1", label: "Period 1", kind: "lesson", startsAt: "08:00", endsAt: "08:45" },
  { id: "p2", label: "Period 2", kind: "lesson", startsAt: "08:45", endsAt: "09:30" },
  { id: "lunch", label: "Lunch break", kind: "lunch", startsAt: "09:30", endsAt: "10:00" },
  { id: "p3", label: "Period 3", kind: "lesson", startsAt: "10:00", endsAt: "10:45" },
];

describe("time helpers", () => {
  it("parses and formats 24-hour times", () => {
    expect(toMinutes("08:45")).toBe(525);
    expect(toMinutes("8:45")).toBeNull();
    expect(toMinutes("24:00")).toBeNull();
    expect(fromMinutes(525)).toBe("08:45");
    expect(periodMinutes({ startsAt: "08:00", endsAt: "09:30" })).toBe(90);
    expect(formatDuration(90)).toBe("1 hr 30 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 hr");
  });
});

describe("buildBellSchedule", () => {
  it("lays out a contiguous day with the break and lunch in the right places", () => {
    const periods = buildBellSchedule({
      dayStart: "08:00",
      lessonMinutes: 45,
      lessonCount: 6,
      shortBreakAfter: 2,
      shortBreakMinutes: 15,
      lunchAfter: 4,
      lunchMinutes: 30,
    });

    expect(periods.map((period) => [period.label, period.startsAt, period.endsAt])).toEqual([
      ["Period 1", "08:00", "08:45"],
      ["Period 2", "08:45", "09:30"],
      ["Short break", "09:30", "09:45"],
      ["Period 3", "09:45", "10:30"],
      ["Period 4", "10:30", "11:15"],
      ["Lunch break", "11:15", "11:45"],
      ["Period 5", "11:45", "12:30"],
      ["Period 6", "12:30", "13:15"],
    ]);

    const result = validateTimetable({ periods, entries: [], days: [1, 2, 3, 4, 5] });
    expect(result.errors).toEqual([]);
    // Empty slots are a warning, not an error: a draft is allowed to be unfinished.
    expect(result.warnings.join(" ")).toContain("no subject yet");
  });

  it("puts an optional assembly first", () => {
    const periods = buildBellSchedule({
      dayStart: "07:45",
      lessonMinutes: 40,
      lessonCount: 2,
      shortBreakAfter: 0,
      shortBreakMinutes: 0,
      lunchAfter: 2,
      lunchMinutes: 30,
      assemblyMinutes: 15,
    });
    expect(periods[0]).toMatchObject({ kind: "assembly", startsAt: "07:45", endsAt: "08:00" });
    expect(periods[1]).toMatchObject({ kind: "lesson", startsAt: "08:00" });
    expect(periods[periods.length - 1]).toMatchObject({ kind: "lunch", startsAt: "09:20" });
  });
});

describe("validateTimetable", () => {
  it("refuses overlapping periods and explains which two", () => {
    const periods: BellPeriod[] = [
      { id: "p1", label: "Period 1", kind: "lesson", startsAt: "08:00", endsAt: "09:00" },
      { id: "p2", label: "Period 2", kind: "lesson", startsAt: "08:50", endsAt: "09:40" },
    ];
    const result = validateTimetable({ periods, entries: [], days: [1] });
    expect(result.errors.join(" ")).toMatch(/Period 2 starts at 08:50.*overlap/);
  });

  it("warns about a gap instead of blocking it", () => {
    const periods: BellPeriod[] = [
      { id: "p1", label: "Period 1", kind: "lesson", startsAt: "08:00", endsAt: "08:45" },
      { id: "p2", label: "Period 2", kind: "lesson", startsAt: "09:00", endsAt: "09:45" },
    ];
    const result = validateTimetable({ periods, entries: [], days: [1] });
    expect(result.errors).toEqual([]);
    expect(result.warnings.join(" ")).toContain("15 min is unassigned");
    expect(result.warnings.join(" ")).toContain("No lunch break");
  });

  it("refuses a subject placed on a break", () => {
    const result = validateTimetable({
      periods: MORNING,
      entries: [{ day: 1, periodId: "lunch", subject: "Mathematics", teacherId: null, teacherName: null, room: "" }],
      days: [1, 2],
    });
    expect(result.errors.join(" ")).toContain("not a lesson period");
  });

  it("refuses a backward period and a nameless one", () => {
    const periods: BellPeriod[] = [
      { id: "p1", label: " ", kind: "lesson", startsAt: "09:00", endsAt: "08:30" },
    ];
    const result = validateTimetable({ periods, entries: [], days: [1] });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Every period needs a name.",
        "Untitled period: the end time must be after the start time.",
      ])
    );
  });

  it("needs at least one working day and one lesson", () => {
    expect(validateTimetable({ periods: MORNING, entries: [], days: [] }).errors).toContain(
      "Choose at least one working day."
    );
    expect(
      validateTimetable({
        periods: [{ id: "b1", label: "Break", kind: "break", startsAt: "08:00", endsAt: "08:15" }],
        entries: [],
        days: [1],
      }).errors
    ).toContain("A timetable needs at least one lesson period.");
  });
});

describe("countUnassigned", () => {
  it("counts lesson slots without a subject", () => {
    const periods = MORNING.filter((period) => period.kind === "lesson");
    expect(countUnassigned({ periods, entries: [], days: [1, 2] })).toBe(6);
    expect(
      countUnassigned({
        periods,
        days: [1, 2],
        entries: [
          { day: 1, periodId: "p1", subject: "Mathematics", teacherId: null, teacherName: null, room: "" },
        ],
      })
    ).toBe(5);
  });
});

describe("findTeacherConflicts", () => {
  const entry = (periodId: string, day = 1) => ({
    day,
    periodId,
    subject: "Mathematics",
    teacherId: "staff-1",
    teacherName: "Arvind Iyer",
    room: "",
  });

  it("finds one teacher booked in two classes at the same time", () => {
    const a = timetableFrom("6", MORNING, [entry("p1")]);
    const b = timetableFrom("7", MORNING, [entry("p1")]);
    const conflicts = findTeacherConflicts([a, b]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      teacherId: "staff-1",
      day: 1,
      startsAt: "08:00",
      endsAt: "08:45",
    });
    expect(conflicts[0].classrooms.sort()).toEqual(["Grade 6", "Grade 7"]);
  });

  it("ignores the same class and the same teacher at different times", () => {
    const a = timetableFrom("6", MORNING, [entry("p1"), entry("p2")]);
    expect(findTeacherConflicts([a])).toEqual([]);

    const c = timetableFrom("8", MORNING, [entry("p3")]);
    expect(findTeacherConflicts([a, c])).toEqual([]);
  });

  it("ignores empty slots and teachers who are not assigned", () => {
    const a = timetableFrom("6", MORNING, [
      { day: 1, periodId: "p1", subject: "", teacherId: "staff-1", teacherName: "A", room: "" },
      { day: 1, periodId: "p2", subject: "Science", teacherId: null, teacherName: null, room: "" },
    ]);
    const b = timetableFrom("7", MORNING, [entry("p1")]);
    expect(findTeacherConflicts([a, b])).toEqual([]);
  });
});

describe("normaliseTimetable", () => {
  it("sorts periods, drops nonsense and keeps one entry per slot", () => {
    const result = normaliseTimetable(
      {
        days: [3, 1, 3, 9],
        periods: [
          { id: "p2", label: "Period 2", kind: "lesson", startsAt: "09:00", endsAt: "09:45" },
          { id: "p1", label: "Period 1", kind: "lesson", startsAt: "08:00", endsAt: "08:45" },
          { id: "../evil", label: "Break", kind: "nap", startsAt: "10:00", endsAt: "10:15" },
        ],
        entries: [
          { day: 1, periodId: "p1", subject: "Mathematics", teacherId: "staff-1", teacherName: "A" },
          { day: 1, periodId: "p1", subject: "Science", teacherId: "staff-2", teacherName: "B" },
          { day: 1, periodId: "", subject: "English" },
          { day: 12, periodId: "p1", subject: "History" },
        ],
      },
      { classroomId: "room-1", classroomLabel: "Grade 6", academicYear: "2026-27" }
    );

    expect(result.days).toEqual([1, 3]);
    expect(result.periods.map((period) => period.id)).toEqual(["p1", "p2", "p3"]);
    expect(result.periods[2].kind).toBe("lesson");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ day: 1, periodId: "p1", subject: "Mathematics" });
    expect(result.classroomLabel).toBe("Grade 6");
  });

  it("gives a new timetable a plausible day rather than an empty one", () => {
    const blank = blankTimetable({ classroomId: "room-1", classroomLabel: "Grade 6" });
    expect(blank.periods.length).toBeGreaterThan(4);
    expect(blank.days).toEqual([1, 2, 3, 4, 5, 6]);
    expect(blank.entries).toEqual([]);
    expect(sortPeriods(blank.periods)[0].startsAt).toBe("08:00");
  });
});

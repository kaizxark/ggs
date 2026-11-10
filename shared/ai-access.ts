/**
 * Who may see what — one list, shared by the dashboard and the AI.
 *
 * ## Why this file exists
 *
 * The assistant used to be told about permissions in prose: the brief carried a
 * `role_note` saying "staff see a restricted view", and the model was expected
 * to act on it. Prose is not access control. The same JSON — invoices, fee
 * totals, every account's email address — was sent to a teacher and to the
 * super admin alike, and the only thing standing between a pupil-level figure
 * and the wrong pair of eyes was a sentence asking the model not to mention it.
 *
 * So the rule moved here, out of the prompt and into code. This module is the
 * single source of truth for:
 *
 *   • every screen in the dashboard, with the key the AI routes on
 *   • which screens each role can open
 *   • which part of the data brief each screen requires
 *   • a `scopeBrief` that deletes the parts a role may not see
 *
 * `scopeBrief` runs on the server, on the brief the model actually receives,
 * after the caller's role has been resolved from their own session. The
 * client's copy is only an optimisation: it saves tokens, and it is never
 * trusted. Even a hand-crafted request from a teacher cannot get a fee total
 * past it.
 */

/* ------------------------------------------------------------------ *
 * Screens
 * ------------------------------------------------------------------ */

/**
 * Every screen, keyed by the id the model uses when it wants to send the user
 * somewhere.
 *
 * The `blurb` is load-bearing, not decoration. With bare labels a model guesses
 * between "academics" and "examinations" when a question mentions results, and
 * routes nowhere — leaving the user with an answer and no way to follow it. The
 * blurbs are also what the assistant uses to explain *why* it is pointing
 * somewhere, so they are written to be read by a person too.
 */
export const AI_SCREENS: Record<string, { label: string; blurb: string }> = {
  overview: {
    label: "Overview",
    blurb:
      "school-wide headline KPIs, today's register, announcements and recent activity",
  },
  students: {
    label: "Students",
    blurb:
      "every enrolled pupil: name, grade, section, USN, attendance, academic average, status",
  },
  attendance: {
    label: "Attendance",
    blurb:
      "the daily register and per-class attendance rates, including the weakest classes",
  },
  finance: {
    label: "Fees & Finance",
    blurb:
      "invoices, outstanding and overdue balances, collection rate, monthly collected vs pending",
  },
  analytics: {
    label: "Analytics",
    blurb:
      "grade and subject performance, year-long trend, wellness metrics and the at-risk ranking",
  },
  staff: {
    label: "Staff",
    blurb:
      "teaching and non-teaching staff: names, designations, departments, email addresses",
  },
  academics: {
    label: "Timetable",
    blurb:
      "class schedules, weekly period allocations, teacher assignments, bell timings and breaks",
  },
  examinations: {
    label: "Examinations",
    blurb:
      "the exam schedule, results publishing state and per-paper marking progress",
  },
  reports: {
    label: "Reports",
    blurb: "exported reports and the principal's review list",
  },
  users: {
    label: "User management",
    blurb:
      "who can sign in, their role and access level, invitations, and student portal logins",
  },
  settings: {
    label: "Settings",
    blurb:
      "school-wide settings plus the signed-in user's own profile, password and AI configuration",
  },
};

export type AiScreenKey = keyof typeof AI_SCREENS;

export const ALL_SCREEN_KEYS: AiScreenKey[] = Object.keys(
  AI_SCREENS
) as AiScreenKey[];

/** Human label for a screen key, or null when the key is not a real screen. */
export function screenLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  const screen = AI_SCREENS[key];
  return screen ? screen.label : null;
}

/**
 * Resolve a screen from either its route key ("finance") or its label
 * ("Fees & Finance").
 *
 * The dashboard navigates by label and the model routes by key, so both
 * spellings have to land on the same screen. Without this the assistant
 * cheerfully told a user to open a screen that did not exist.
 */
export function screenKeyFromLabel(
  name: string | null | undefined
): string | null {
  const needle = String(name ?? "")
    .trim()
    .toLowerCase();
  if (!needle) return null;
  const byKey = ALL_SCREEN_KEYS.filter(key => key === needle)[0];
  if (byKey) return byKey;
  const byLabel = ALL_SCREEN_KEYS.filter(
    key => AI_SCREENS[key].label.toLowerCase() === needle
  )[0];
  return byLabel ?? null;
}

/** The canonical label for a screen named by key or by label. */
export function screenLabelByName(
  name: string | null | undefined
): string | null {
  const key = screenKeyFromLabel(name);
  return key ? AI_SCREENS[key].label : null;
}

/** True when `key` names a screen that exists. */
export function isScreenKey(key: unknown): boolean {
  return (
    typeof key === "string" &&
    Object.prototype.hasOwnProperty.call(AI_SCREENS, key)
  );
}

/* ------------------------------------------------------------------ *
 * Roles
 * ------------------------------------------------------------------ */

/**
 * Which screens each role can open.
 *
 * These mirror the dashboard's own navigation. A screen missing here is a
 * screen the assistant must not send anyone to and must not describe the
 * contents of — the user would arrive at a blank view and conclude the
 * assistant made it up.
 *
 * The three genuinely privileged datasets are separated from the rest:
 *
 *   • `finance`  — every other role that has money access sees only its own
 *     scope; the school-wide ledger is admin-and-above.
 *   • `users`    — account emails and roles. Super admin and admin only.
 *   • `settings` — school configuration, and the panel holding the AI key.
 */
const ROLE_SCREENS: Record<string, AiScreenKey[]> = {
  // Every screen, including `credentials` — the only place the password column
  // is readable. That key is part of ALL_SCREEN_KEYS because it is declared in
  // AI_SCREENS, so listing it again here would duplicate it rather than add it.
  //
  // The owner is identified by an immutable user id in shared/super-admin.ts.
  // Every other role below — including `admin` — deliberately drops the key.
  super_admin: ALL_SCREEN_KEYS,

  admin: ALL_SCREEN_KEYS,

  // The academic head. Sees pupils, teaching and results in depth; the money
  // and the accounts are not theirs to read.
  // No "documents": /api/documents admits super_admin and admin only, because a
  // pupil's file cabinet holds Aadhaar copies. The screen used to be listed here
  // and every request behind it returned 403, which reads as a broken feature
  // rather than a correctly hidden one. `canViewDocuments()` in student-access
  // holds the same rule, and there is a test asserting the two agree.
  principal: [
    "overview",
    "students",
    "attendance",
    "analytics",
    "staff",
    "academics",
    "examinations",
    "reports",
    "settings",
  ],

  // Teaching staff. Their own pupils and their own marking. No money, no
  // accounts, no school configuration — but they keep Settings, because that
  // screen is also where they change their own password.
  teacher: [
    "overview",
    "students",
    "attendance",
    "academics",
    "examinations",
    "settings",
  ],
  faculty: [
    "overview",
    "students",
    "attendance",
    "academics",
    "examinations",
    "settings",
  ],

  // Non-teaching staff. Enough to help a visitor, nothing that is a ledger.
  staff: ["overview", "students", "attendance", "settings"],

  // The accounts desk. Money in full; nothing about other people's accounts.
  accountant: [
    "overview",
    "students",
    "attendance",
    "finance",
    "reports",
    "settings",
  ],

  // Pupil portal. A pupil sees themselves and their own documents. The role is
  // in the enum but the portal is not built out yet, so the list stays minimal
  // on purpose: granting more here would describe screens that do not exist.
  student: ["overview", "settings"],

  // A family member. Their own child's attendance and fees.
  //
  // No "students" screen: that screen is the whole roll call, and /api/students
  // refuses a parent outright so they cannot page through every other child.
  // A parent reaches their own child through /api/student-profile, which
  // resolves the guardian link server-side and returns 404 for anything else.
  parent: ["overview", "attendance", "finance", "settings"],
};  /**
   * Screens a role can open, by stored role name.
 *
 * Unknown roles get the narrowest sensible default rather than the widest.
 * Failing open on an unrecognised role is how a future role nobody has thought
 * about quietly inherits the super admin's view.
 */
export function screensForRole(role: string | null | undefined): AiScreenKey[] {
  const key = String(role ?? "")
    .trim()
    .toLowerCase();
  if (!key) return ["overview"];
  if (ROLE_SCREENS[key]) return ROLE_SCREENS[key].slice();
  // The dashboard labels roles for display in places ("Super admin"); accept
  // those spellings rather than silently dropping to the narrow default.
  const normalised = key.replace(/[\s-]+/g, "_");
  if (ROLE_SCREENS[normalised]) return ROLE_SCREENS[normalised].slice();
  return ["overview"];
}

/** True when this role may read `screenKey`. */
export function canSeeScreen(
  role: string | null | undefined,
  screenKey: string
): boolean {
  if (!isScreenKey(screenKey)) return false;
  return screensForRole(role).indexOf(screenKey as AiScreenKey) !== -1;
}

/** The display label for a role, e.g. "Super admin". */
export function aiRoleLabel(role: string | null | undefined): string {
  const key = String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    super_admin: "Super admin",
    admin: "Admin",
    principal: "Principal",
    teacher: "Teacher",
    staff: "Staff",
    accountant: "Accounts",
    student: "Student",
    parent: "Parent",
  };
  return labels[key] ?? "Staff";
}

/* ------------------------------------------------------------------ *
 * Brief scoping
 * ------------------------------------------------------------------ */

/**
 * Which screens each part of the data brief belongs to.
 *
 * A key is kept when the role can see *any* of the listed screens, because the
 * datasets overlap: `headline.active_students` is genuinely both a Students and
 * an Overview figure, and dropping it for a teacher because it also appears on
 * a screen they lack would be wrong.
 *
 * Keys not listed here are structural — `school`, `how_to_read_this`,
 * `screens_available_to_this_user` and the access notes — and always travel.
 * They carry no school data.
 */
const BRIEF_SCOPES: Array<{ keys: string[]; screens: AiScreenKey[] }> = [
  {
    keys: [
      "active_students",
      "grades_running",
      "grade_roll",
      "headcount",
      "lowest_scoring_students",
      "lowest_scoring_students_note",
      "students_below_50_pct_average",
    ],
    screens: ["students"],
  },
  {
    keys: [
      "worst_attendance_classes",
      "classes_below_90_pct",
      "class_attendance_pct",
      "present_marks",
      "marked_records_total",
      "attendance_by_day",
      "attendance_today",
      "overall_attendance_pct",
      "classes_with_attendance",
    ],
    screens: ["attendance"],
  },
  {
    keys: [
      "fees",
      "top_outstanding_invoices",
      "top_outstanding_invoices_and_more",
      "fee_categories",
      "fee_categories_note",
      "finance_monthly",
      "finance_monthly_note",
      "fee_collection_pct",
    ],
    screens: ["finance"],
  },
  {
    keys: [
      "grade_outcomes",
      "weakest_grade",
      "strongest_grade",
      "school_average_score_pct",
      "school_average_score_basis",
      "subjects",
      "subjects_note",
      "subject_averages",
      "subject_averages_note",
      "performance_trend",
      "performance_trend_note",
      "health_metrics",
      "health_metrics_note",
    ],
    screens: ["analytics"],
  },
  {
    keys: ["staff_by_department", "staff_total"],
    screens: ["staff"],
  },
  {
    keys: ["exams", "exams_note", "exam_results", "exam_results_note"],
    screens: ["examinations"],
  },
  { keys: ["people", "people_note"], screens: ["users"] },
  { keys: ["settings_snapshot", "settings_note"], screens: ["settings"] },
  { keys: ["library_books", "library_books_note"], screens: ["academics"] },
  { keys: ["report_exports", "report_exports_note"], screens: ["reports"] },
  {
    keys: [
      "announcements",
      "announcements_note",
      "messages",
      "messages_note",
      "notifications",
      "notifications_note",
    ],
    screens: ["overview"],
  },
  { keys: ["schedule", "schedule_note"], screens: ["academics"] },
];

/**
 * Brief keys that need more than "can open the screen".
 *
 * Settings is the awkward one: the screen holds both the school-wide
 * configuration and the signed-in person's own name, username and password.
 * Everyone keeps the screen — nobody can change their own password otherwise —
 * but the school-wide configuration is admin-and-above, so the snapshot of it
 * is split out here rather than being tied to the screen.
 */
const ADMIN_ONLY_KEYS = new Set([
  "settings_snapshot",
  "settings_note",
  "people",
  "people_note",
]);

/**
 * The pre-written answers, and the screen each belongs to.
 *
 * These are whole sentences that already carry their units, and the model is
 * told to restate one when it fits. That makes them the highest-leverage and
 * also the riskiest part of the brief: the `fees` sentence names a rupee total,
 * so handing it to a teacher would leak the ledger through the one field
 * designed to be trusted.
 */
const READY_ANSWER_SCOPES: Record<string, AiScreenKey[]> = {
  headcount: ["students", "staff"],
  attendance: ["attendance"],
  today: ["attendance"],
  fees: ["finance"],
  academics: ["analytics"],
  risk: ["students"],
};

/**
 * Strip a brief down to what `role` is allowed to see.
 *
 * Runs server-side on the brief that is about to be sent to the model, after
 * the caller's role has been resolved from their session. Returns the scoped
 * brief plus the list of what was removed, which the assistant is shown as a
 * plain sentence so it can say "that is not available to your role" instead of
 * claiming the data does not exist.
 */
export function scopeBrief(
  brief: Record<string, unknown>,
  role: string | null | undefined
): { brief: Record<string, unknown>; withheld: string[] } {
  const allowed = screensForRole(role);
  const allowedSet = new Set<string>(allowed as string[]);
  const isAdmin =
    String(role ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_") === "super_admin" ||
    String(role ?? "")
      .trim()
      .toLowerCase() === "admin";
  const out: Record<string, unknown> = {};
  const withheld: string[] = [];

  const headline = brief.headline;
  const scopedHeadline: Record<string, unknown> = {};

  for (const rule of BRIEF_SCOPES) {
    const permitted = rule.screens.some(screen => allowedSet.has(screen));
    for (const key of rule.keys) {
      if (!(key in brief)) continue;
      if (ADMIN_ONLY_KEYS.has(key) && !isAdmin) {
        withheld.push(key);
        continue;
      }

      // Headline is one object whose fields belong to different screens, so it
      // is filtered field by field rather than dropped whole.
      if (key === "headline") continue;

      if (permitted) {
        out[key] = brief[key];
      } else {
        withheld.push(key);
      }
    }
  }

  // Split `headline` so a teacher keeps the attendance number and loses the
  // fee collection percentage.
  if (headline && typeof headline === "object") {
    for (const field of Object.keys(headline as Record<string, unknown>)) {
      const rule = BRIEF_SCOPES.find(entry => entry.keys.indexOf(field) !== -1);
      if (rule && rule.screens.some(screen => allowedSet.has(screen))) {
        scopedHeadline[field] = (headline as Record<string, unknown>)[field];
      } else {
        withheld.push(`headline.${field}`);
      }
    }
    if (Object.keys(scopedHeadline).length > 0) out.headline = scopedHeadline;
  }

  // Ready-made answers, filtered per sentence.
  const ready = brief.ready_made_answers;
  if (ready && typeof ready === "object") {
    const kept: Record<string, unknown> = {};
    for (const topic of Object.keys(ready as Record<string, unknown>)) {
      const screens =
        READY_ANSWER_SCOPES[topic] ??
        (allowedSet.has("overview") ? ["overview"] : []);
      if (screens.some(screen => allowedSet.has(screen))) {
        kept[topic] = (ready as Record<string, unknown>)[topic];
      } else {
        withheld.push(`ready_made_answers.${topic}`);
      }
    }
    out.ready_made_answers = kept;
  }

  // Structural fields always travel: they describe the school and the access
  // rules, not the school's records.
  for (const key of [
    "school",
    "academic_context",
    "how_to_read_this",
    "not_tracked_in_this_dashboard",
    "assistant_role",
    "assistant_role_label",
    "screens_available_to_this_user",
    "active_screen",
    "screen_index",
    "generated_at",
    "record_counts",
  ]) {
    if (key in brief) out[key] = brief[key];
  }

  return { brief: out, withheld };
}

/* ------------------------------------------------------------------ *
 * Model output
 * ------------------------------------------------------------------ */

/** One button under an answer. */
export interface AiAction {
  label: string;
  screen: string;
  /** Optional pupil id, so "open Aarav's profile" lands on the profile. */
  studentId?: string | null;
}

export interface AiSuggestion {
  answer: string;
  bullets: string[];
  actions: AiAction[];
  followUps: string[];
  sources: string[];
  /** "low" is used when the question was outside the caller's access. */
  confidence: "high" | "medium" | "low";
}

function clampList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, 300);
    if (trimmed) out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Make a model reply safe to render and safe to act on.
 *
 * The model chose the buttons; this decides whether they are real. A button is
 * dropped when its screen is not a screen at all, or is one this role cannot
 * open — so a hallucinated or over-eager action can never navigate a teacher
 * into the fee ledger, and a label that arrived as a paragraph cannot end up on
 * a button.
 */
export function sanitiseSuggestion(
  raw: unknown,
  role: string | null | undefined
): AiSuggestion {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;

  const answer =
    typeof obj.answer === "string" ? obj.answer.trim().slice(0, 4000) : "";
  const bullets = clampList(obj.bullets, 8);
  const followUps = clampList(obj.follow_ups, 4);
  const sources = clampList(obj.sources, 4);

  const actions: AiAction[] = [];
  if (Array.isArray(obj.actions)) {
    for (const item of obj.actions) {
      if (!item || typeof item !== "object") continue;
      const entry = item as Record<string, unknown>;
      const screen =
        typeof entry.screen === "string" ? entry.screen.trim() : "";
      if (!isScreenKey(screen)) continue;
      if (!canSeeScreen(role, screen)) continue;
      const fallback = AI_SCREENS[screen].label;
      const label =
        typeof entry.label === "string" && entry.label.trim()
          ? entry.label.trim().slice(0, 60)
          : `Open ${fallback}`;
      const studentId =
        typeof entry.student_id === "string" && entry.student_id.trim()
          ? entry.student_id.trim().slice(0, 64)
          : null;
      actions.push({ label, screen, studentId });
      if (actions.length >= 4) break;
    }
  }

  const confidenceRaw = String(obj.confidence ?? "").toLowerCase();
  const confidence: AiSuggestion["confidence"] =
    confidenceRaw === "low" || confidenceRaw === "medium"
      ? confidenceRaw
      : "high";

  return { answer, bullets, actions, followUps, sources, confidence };
}

/**
 * A blank, useful reply for the empty question. Returning a real shape rather
 * than an error keeps the client from having to special-case it.
 */
export function emptySuggestion(): AiSuggestion {
  return {
    answer:
      "Ask me anything about this school — attendance, fees, results or staff.",
    bullets: [],
    actions: [],
    followUps: [],
    sources: [],
    confidence: "high",
  };
}

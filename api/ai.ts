/**
 * The AI assistant endpoint.
 *
 * Available to every signed-in member of staff, which is the point: the
 * provider and key are configured once by the super admin and held server-side
 * (`shared/ai-config.ts`), so nobody has to paste a key to ask a question.
 *
 * Three properties this route is responsible for, in order of importance:
 *
 *   1. **Authentication.** Every request is resolved to a real Supabase session
 *      before anything else happens. The previous version had no auth at all —
 *      anyone who could reach the URL could spend the school's Gemini quota.
 *
 *   2. **Access control, server-side.** The caller's role comes from their
 *      session, never from the request body, and the brief and datasets are
 *      stripped to that role by `scopeBrief` / `scopeDatasets` before anything
 *      is sent to the provider. The client's own `role` and `visibleScreens`
 *      fields are hints for the UI; believing them would mean a teacher could
 *      read the fee ledger by editing a request.
 *
 *   3. **Grounding.** The model gets the school's real figures, not its priors,
 *      and it can pull individual records on demand through `search_records`.
 *      That second part is what makes "find Aarav Sharma's invoice" answerable
 *      without pasting every student and every invoice into every prompt.
 *
 * Gemini is called natively (structured output + function calling). Any
 * OpenAI-shaped provider still works through `/chat/completions`, because
 * people configure those too — but Gemini is the one this app is built around.
 */

export const config = { runtime: "edge" };

import {
  AI_SCREENS,
  ALL_SCREEN_KEYS,
  aiRoleLabel,
  emptySuggestion,
  scopeBrief,
  sanitiseSuggestion,
  screensForRole,
  type AiSuggestion,
} from "../shared/ai-access";
import { resolveCaller } from "../shared/ai-auth";
import {
  loadSharedAiConfig,
  normaliseBaseUrl,
} from "../shared/ai-config";

/** Re-exported so existing callers and tests keep one definition. */
export { normaliseBaseUrl };

/** @deprecated kept for the OpenAI-shaped path and its tests. */
export const SCREENS = AI_SCREENS;

/* ------------------------------------------------------------------ *
 * Datasets the assistant can search
 * ------------------------------------------------------------------ */

/**
 * Which screen each dataset belongs to.
 *
 * This is the table `scopeDatasets` enforces. A dataset nobody can reach is not
 * merely unused — it is data that would otherwise sit in server memory for a
 * request that has no business touching it.
 */
const DATASET_SCREENS: Record<string, string> = {
  students: "students",
  invoices: "finance",
  payments: "finance",
  staff: "staff",
  class_attendance: "attendance",
  daily_attendance: "attendance",
  grade_outcomes: "analytics",
  subject_averages: "analytics",
  performance_trend: "analytics",
  health_metrics: "analytics",
  exams: "examinations",
  exam_results: "examinations",
  assignments: "assignments",
  subjects: "academics",
  library_books: "academics",
  schedule: "academics",
  timetable: "academics",
  announcements: "overview",
  messages: "overview",
  notifications: "overview",
  transport_routes: "transport",
  vehicles: "transport",
  activity_feed: "transport",
  report_exports: "reports",
  people: "users",
};

const DATASET_KEYS = Object.keys(DATASET_SCREENS);

/** Drop every dataset whose screen this role cannot open. */
export function scopeDatasets(
  datasets: Record<string, unknown>,
  role: string
): Record<string, unknown[]> {
  const allowed = screensForRole(role);
  const out: Record<string, unknown[]> = {};
  for (const key of DATASET_KEYS) {
    if (allowed.indexOf(DATASET_SCREENS[key] as never) === -1) continue;
    const rows = datasets?.[key];
    if (Array.isArray(rows) && rows.length > 0) out[key] = rows;
  }
  return out;
}

/**
 * Find rows in one dataset that mention `query`.
 *
 * Runs here rather than in the database because the dashboard has already
 * loaded these rows for the screens the user is looking at, so a follow-up
 * question costs no extra network round trip and sees exactly the data the
 * user is looking at.
 *
 * The match is deliberately dumb and total: every field of the row is searched
 * as text. A name, a USN, a grade, a due date, a driver's phone
 * number — all of them find the row, which is what someone typing "Bhat" or
 * "Grade 5" or "overdue" into a follow-up expects to happen.
 */
export function searchDataset(
  rows: unknown[],
  query: string,
  limit: number
): unknown[] {
  const needle = String(query ?? "").trim().toLowerCase();
  const capped = Math.max(1, Math.min(limit || 8, 20));
  if (!Array.isArray(rows)) return [];
  if (!needle) return rows.slice(0, capped);
  const matched = rows.filter((row) => {
    if (row === null || row === undefined) return false;
    try {
      return JSON.stringify(row).toLowerCase().indexOf(needle) !== -1;
    } catch {
      return false;
    }
  });
  return matched.slice(0, capped);
}

/* ------------------------------------------------------------------ *
 * Prompting
 * ------------------------------------------------------------------ */

/** Screens this role may be sent to, formatted for the prompt. */
function screenListFor(role: string): string {
  return screensForRole(role)
    .map((key) => `- ${key} — ${AI_SCREENS[key].label}: ${AI_SCREENS[key].blurb}`)
    .join("\n");
}

function datasetListFor(datasets: Record<string, unknown[]>): string {
  return Object.keys(datasets)
    .map((key) => {
      const rows = datasets[key];
      return `- ${key} (${Array.isArray(rows) ? rows.length : 0} rows)`;
    })
    .join("\n");
}

export function buildSystemPrompt(
  role: string,
  activeScreen: string | null,
  datasets: Record<string, unknown[]>,
  withheld: string[]
): string {
  const screens = screenListFor(role);
  const available = datasetListFor(datasets);
  const withheldNote = withheld.length
    ? `\nData that exists in this ERP but that ${aiRoleLabel(role)} cannot open, and which has been removed from this brief: ${withheld
        .slice(0, 12)
        .join(", ")}. If the question needs it, say plainly that it is not available to their role and name who can see it. Do not guess at the value, and do not describe what it would contain.`
    : "";

  return `You are the assistant inside the Global Kids School ERP, answering one member of the school's staff.

# Who you are talking to
Their role is **${aiRoleLabel(role)}**.${activeScreen ? ` They are looking at the **${activeScreen}** screen right now.` : ""}
${withheldNote}

# The screens they can open
${screens}

Anything outside that list does not exist as far as they are concerned. Do not offer to take them there.

# The data
Every request carries a DATA BRIEF in JSON: the school's real, current figures, with units, populations and time windows spelled out. Read its "how_to_read_this" before using a number.

These rules are what make the answer trustworthy:
- Use only figures and names from the brief or from a search_records result. Never estimate, extrapolate, round differently, or recall what schools "usually" look like.
- Copy amounts verbatim, including "₹" and lakh/crore wording.
- If a list is truncated (it says "*_and_more"), say how many it shows out of the true total.
- A pupil's attendance is null when their register was never filled. Never report that as 0% — it means "not recorded", and telling a teacher a child has 0% attendance is both wrong and damaging.
- If the brief genuinely does not contain the answer, say so in one line and name the screen where it would live. Never fill a gap with a plausible number.

# Looking up individual records
The brief carries aggregates and the top few rows. When a question is about a *specific* record — a named pupil, one invoice, a driver, an exam paper — call \`search_records\` to fetch it instead of guessing or answering from the aggregate. Call it as many times as the question needs.

Datasets you can search:
${available || "- (none in scope for this role)"}

# How to answer
- Lead with the number. "Attendance is 92.4%" beats "attendance is generally good".
- Name real entities. For "who" questions, list the actual names from the data — never a bare count when you have names.
- Prefer restating a sentence from "ready_made_answers" when it fits, then add only what was asked. Those are already verified against this brief.
- Length: 1–3 sentences, or up to 6 bullets. No preamble, no "Certainly!", no restating the question, no closing offer of help.
- Plain text. No markdown tables, no headings, no bold.
- "bullets" is for genuine lists only. Leave it empty for a short answer.
- "actions" are the buttons under your answer. Offer 1–3, and only screens this role can open. Label them with what the user gets — "Open Aarav's profile", "See the fee ledger" — not "Click here". Set student_id when a specific pupil is the subject.
- "follow_ups" are 2–3 things this person would plausibly ask next, given what you just told them. They become one-click chips, so make each a complete question.
- "sources" names the screens the figures came from, e.g. ["Attendance", "Analytics"].
- "confidence" is "low" when you had to decline for access reasons or the data was not there. It is the honesty signal, not a hedge.

# Output
Reply with a single JSON object and nothing else — no prose, no fences:
{"answer":"<plain text>","bullets":["..."],"actions":[{"label":"...","screen":"<screen key>","student_id":"<id or omit>"}],"follow_ups":["..."],"sources":["..."],"confidence":"high|medium|low"}

Valid "screen" values: ${ALL_SCREEN_KEYS.join(", ")}.`;
}

/** Gemini's structured-output schema. Deliberately flat and shallow. */
export const SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    answer: {
      type: "string",
      description: "The reply as plain text, 1-3 sentences unless bullets carry the detail.",
    },
    bullets: {
      type: "array",
      items: { type: "string" },
      description: "Up to 6 short bullets. Empty when the answer is a single statement.",
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Button text, e.g. 'Open Aarav's profile'." },
          screen: { type: "string", enum: ALL_SCREEN_KEYS },
          student_id: { type: "string", description: "Pupil id, when the button opens a specific profile." },
        },
        required: ["label", "screen"],
      },
      description: "1-3 buttons guiding the user onwards. Only screens this role can open.",
    },
    follow_ups: {
      type: "array",
      items: { type: "string" },
      description: "2-3 complete questions the user would plausibly ask next.",
    },
    sources: {
      type: "array",
      items: { type: "string" },
      description: "Screen names the figures came from.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "'low' when access was declined or the data was absent.",
    },
  },
  required: ["answer", "bullets", "actions", "follow_ups", "sources", "confidence"],
};

/**
 * The one tool: pull specific rows out of the datasets already loaded.
 *
 * Built per request rather than declared once, because the enum is the access
 * control: a dataset the caller cannot open is not merely refused when searched,
 * it is never offered in the first place. A model cannot pick a name that is
 * not in the list, so there is nothing to tempt it with.
 */
function buildSearchTool(datasetKeys: string[]) {
  return {
    name: "search_records",
    description:
      "Search one of the school's datasets for specific records. Use this whenever the question is about a named person, a single invoice, one exam, one driver, or any other individual row — the brief only carries aggregates and the top few rows.",
    parameters: {
      type: "object",
      properties: {
        dataset: { type: "string", enum: datasetKeys },
        query: {
          type: "string",
          description:
            "Text to match against any field: a name, a USN, a grade, a date, a status. Leave empty to list the first rows.",
        },
        limit: { type: "integer", description: "How many rows to return. Default 8, maximum 20." },
      },
      required: ["dataset"],
    },
  };
}

/* ------------------------------------------------------------------ *
 * Reply parsing
 * ------------------------------------------------------------------ */

/**
 * Pull the first balanced JSON object out of a model reply.
 *
 * Strict schema mode is not available on every provider — Groq, most local
 * runtimes and several gateways reject it — so the prompt asks for plain JSON
 * and the reply is parsed defensively: code fences and leading prose are
 * skipped, then braces are walked with string awareness so a value containing
 * a brace cannot truncate the object.
 */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const text = String(raw ?? "").trim();
  const candidates: string[] = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  candidates.push(text);

  for (const candidate of candidates) {
    const start = candidate.indexOf("{");
    if (start === -1) continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(candidate.slice(start, i + 1));
            if (parsed && typeof parsed === "object") {
              return parsed as Record<string, unknown>;
            }
          } catch {
            /* try the next candidate */
          }
          break;
        }
      }
    }
  }
  return null;
}

/**
 * Legacy shape used by the OpenAI-compatible path.
 *
 * Kept because it is what those providers are prompted to produce, and because
 * it degrades gracefully: a reply with no JSON at all becomes the answer text,
 * which still beats showing the user nothing.
 */
export function parseReply(raw: string): {
  answer: string;
  route: string | null;
  source: string | null;
} {
  const text = String(raw ?? "").trim();
  const parsed = extractJsonObject(text);
  if (parsed && typeof parsed.answer === "string" && parsed.answer.trim()) {
    const route =
      parsed.route && Object.prototype.hasOwnProperty.call(SCREENS, String(parsed.route))
        ? String(parsed.route)
        : null;
    const source =
      typeof parsed.source === "string" && parsed.source.trim()
        ? parsed.source.trim().slice(0, 120)
        : null;
    return { answer: parsed.answer.trim(), route, source };
  }
  return { answer: text, route: null, source: null };
}

/* ------------------------------------------------------------------ *
 * Brief budget
 * ------------------------------------------------------------------ */

/** Roughly 12k tokens of JSON, which every current model takes comfortably. */
const BRIEF_BUDGET = 48_000;

/**
 * Shrink a brief until it fits, dropping whole keys rather than slicing the
 * text.
 *
 * The previous version truncated the middle of the serialised JSON, which
 * produced a document that was not valid JSON at both ends — the model then
 * read a wall of punctuation as data. Dropping the largest optional keys keeps
 * everything that remains parseable, and the aggregates a question most often
 * needs are small enough to survive.
 */
export function fitBrief(
  brief: Record<string, unknown>,
  budget: number = BRIEF_BUDGET
): Record<string, unknown> {
  const size = (value: Record<string, unknown>) => JSON.stringify(value).length;
  if (size(brief) <= budget) return brief;

  const keep = new Set([
    "school",
    "how_to_read_this",
    "assistant_role",
    "assistant_role_label",
    "screens_available_to_this_user",
    "active_screen",
    "not_tracked_in_this_dashboard",
    "ready_made_answers",
    "headline",
    "generated_at",
  ]);

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(brief)) {
    if (keep.has(key)) out[key] = brief[key];
  }

  const rest = Object.keys(brief).filter((key) => !keep.has(key));
  rest.sort((a, b) => size({ v: brief[b] }) - size({ v: brief[a] }));
  for (const key of rest) {
    if (size(out) + size({ v: brief[key] }) > budget) continue;
    out[key] = brief[key];
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Provider calls
 * ------------------------------------------------------------------ */

type Turn = { role: "user" | "model"; text: string };

function geminiUrl(base: string, model: string, key: string): string {
  const root = base.replace(/\/+$/, "");
  return `${root}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
}

function isGemini(providerId: string, base: string): boolean {
  return (
    providerId.startsWith("gemini") ||
    base.indexOf("generativelanguage.googleapis.com") !== -1
  );
}

interface GeminiRound {
  text: string;
  calls: Array<{ name?: string; args?: Record<string, unknown> }>;
}

/** One `generateContent` round-trip. */
async function callGemini(
  url: string,
  system: string,
  history: Turn[],
  question: string,
  datasetKeys: string[]
): Promise<GeminiRound> {
  const contents = [
    ...history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: question }] },
  ];

  /*
   * `tools` is omitted entirely when there are no dataset keys.
   *
   * Sending `tools: [{ functionDeclarations: [] }]` looked like it withheld the
   * tool but did not: the array was still present, so the model could still
   * answer with a function call — and a round containing only a function call
   * has no text in it, which is how an empty reply reached the browser. Leaving
   * the key out is what actually removes the tool.
   */
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      ...(datasetKeys.length > 0
        ? { tools: [{ functionDeclarations: [buildSearchTool(datasetKeys)] }] }
        : {}),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SUGGESTION_SCHEMA,
        // Google's own guidance is to leave temperature alone on the 3.x
        // models, and 1.0 is the default there, so it is only pinned on the
        // older 2.x ids where a lower value measurably reduces hedging.
        ...(/-2\.\d/.test(url) ? { temperature: 0.2 } : {}),
      },
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    candidates?: {
      content?: { parts?: Array<{ text?: string; functionCall?: { name?: string; args?: Record<string, unknown> } }> };
    }[];
    error?: unknown;
  };

  if (!res.ok) {
    throw new Error(describeProviderError(res.status, body));
  }

  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const calls = parts
    .filter((part) => part.functionCall)
    .map((part) => part.functionCall as { name?: string; args?: Record<string, unknown> });
  const text = parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  return { text, calls };
}

/** Run `search_records` against the already-loaded, already-scoped datasets. */
function runSearch(
  call: { name?: string; args?: Record<string, unknown> },
  datasets: Record<string, unknown[]>
): string {
  const args = call.args ?? {};
  const dataset = String(args.dataset ?? "");
  const rows = datasets[dataset];
  if (!Array.isArray(rows)) {
    return JSON.stringify({
      error: "unknown_dataset",
      dataset,
      available: Object.keys(datasets),
    });
  }
  const matches = searchDataset(
    rows,
    String(args.query ?? ""),
    Number(args.limit ?? 8)
  );
  return JSON.stringify({
    dataset,
    query: String(args.query ?? ""),
    matched: matches.length,
    total_in_dataset: rows.length,
    rows: matches,
  });
}

function describeProviderError(status: number, body: unknown): string {
  const envelope = (body ?? {}) as { error?: { message?: string } };
  const detail =
    envelope.error && typeof envelope.error.message === "string"
      ? envelope.error.message
      : "";
  const suffix = detail ? ` ${detail.slice(0, 240)}` : "";
  if (status === 400) {
    return `The provider rejected the request. Check the model name and the API key.${suffix}`;
  }
  if (status === 401 || status === 403) {
    return `The provider refused the API key.${suffix}`;
  }
  if (status === 429) {
    return "The provider is rate-limiting this key. Wait a moment and try again.";
  }
  return `The provider returned status ${status}.${suffix}`;
}

/* ------------------------------------------------------------------ *
 * Handler
 * ------------------------------------------------------------------ */

type Req = {
  question?: string;
  context?: Record<string, unknown>;
  datasets?: Record<string, unknown>;
  history?: Array<{ role?: string; text?: string }>;
  activeScreen?: string | null;
  /** "ping" runs a one-word provider check instead of answering anything. */
  action?: string;
  model?: string;
};

function normaliseHistory(raw: Req["history"]): Turn[] {
  if (!Array.isArray(raw)) return [];
  const turns: Turn[] = [];
  for (const item of raw.slice(-6)) {
    const text = String(item?.text ?? "").trim().slice(0, 2000);
    if (!text) continue;
    turns.push({ role: item?.role === "model" ? "model" : "user", text });
  }
  return turns;
}

/** Turn an OpenAI-shaped reply into the suggestion shape. */
function fromOpenAiReply(raw: string, role: string): AiSuggestion {
  const object = extractJsonObject(raw);
  if (!object) {
    const text = String(raw ?? "").trim();
    return sanitiseSuggestion(
      { answer: text, confidence: text ? "medium" : "low" },
      role
    );
  }
  // A provider may answer in the older {answer, route, source} shape.
  if (Array.isArray(object.actions) === false && object.route) {
    const label = object.route ? AI_SCREENS[String(object.route)]?.label : null;
    return sanitiseSuggestion(
      {
        answer: object.answer,
        bullets: object.bullets,
        actions: label ? [{ label: `Open ${label}`, screen: object.route }] : [],
        follow_ups: object.follow_ups,
        sources: object.source ? [object.source] : undefined,
        confidence: object.confidence,
      },
      role
    );
  }
  return sanitiseSuggestion(object, role);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  /*
   * Authenticate first, before the body is even parsed. The assistant is
   * open to the whole school, which means the endpoint is open to anyone who
   * can reach the URL — the previous version had no check at all and would
   * happily proxy a question for a stranger.
   */
  const caller = await resolveCaller(req);
  if (!caller) {
    return Response.json(
      { error: "unauthenticated", message: "Sign in to use the assistant." },
      { status: 401 }
    );
  }

  let payload: Req;
  try {
    payload = (await req.json()) as Req;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const question = String(payload.question ?? "").trim().slice(0, 1000);

  /* ---- configuration ---- */
  const stored = await loadSharedAiConfig();

  /*
   * Which configuration to use, in order:
   *
   *   1. a header override from the super admin — the "test this provider"
   *      button in Settings, and a per-browser override while trying one out
   *   2. the school's shared configuration, saved once by the super admin
   *   3. the caller's own `x-ai-key`, if they brought one
   *
   * The key is accepted from *anyone*, deliberately. It is their own
   * credential, sent voluntarily from their own browser, so honouring it grants
   * no privilege — it just means a person who pasted a Gemini key can ask a
   * question without the super admin having to configure anything first.
   *
   * The base URL is not. That value is used to build an outbound request from
   * the server, so letting an arbitrary caller point it somewhere turns this
   * route into a request proxy for anything the server can reach but the
   * browser cannot — including services inside the school's own network. Base
   * and model therefore stay super-admin-only.
   */
  const headerBase = caller.superAdmin ? req.headers.get("x-ai-base") : null;
  const headerModel = caller.superAdmin ? req.headers.get("x-ai-model") : null;
  const headerKey = req.headers.get("x-ai-key");

  const providerId = headerBase ? "custom" : stored?.providerId || "gemini";
  const base =
    normaliseBaseUrl(headerBase ?? stored?.base ?? "") ||
    "https://generativelanguage.googleapis.com/v1beta";
  const model = (
    headerModel ||
    stored?.model ||
    String(payload.model ?? "") ||
    "gemini-3.8-flash"
  ).trim();
  const apiKey = (headerKey || stored?.apiKey || "").trim();

  if (!apiKey) {
    return Response.json(
      {
        error: "not_configured",
        message:
          "The assistant has no API key yet. A super admin can set one up under Settings → AI assistant, and it will then work for everyone.",
      },
      { status: 503 }
    );
  }

  /*
   * Connection test. Runs on the server deliberately: the credential being
   * tested is the stored one, so the check answers the question the super
   * admin actually has — "will this work for everyone?" — rather than one only
   * about their own browser. The prompt is a single word and asks for nothing,
   * so a failure cannot become a probe for whether data exists.
   */
  if (payload.action === "ping") {
    try {
      if (isGemini(providerId, base)) {
        const res = await fetch(geminiUrl(base, model, apiKey), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Reply with one word: ready" }] }],
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return Response.json(
            { ok: false, message: describeProviderError(res.status, body) },
            { status: 502 }
          );
        }
        return Response.json({ ok: true, model });
      }
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 5,
          messages: [{ role: "user", content: "Reply with one word: ready" }],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return Response.json(
          {
            ok: false,
            message: describeProviderError(
              res.status,
              detail ? { error: { message: detail } } : {}
            ),
          },
          { status: 502 }
        );
      }
      return Response.json({ ok: true, model });
    } catch (err) {
      return Response.json(
        {
          ok: false,
          message: err instanceof Error ? err.message : "Could not reach the provider.",
        },
        { status: 502 }
      );
    }
  }

  if (!question) {
    return Response.json(emptySuggestion());
  }

  /* ---- role scoping ---- */
  const role = caller.role;
  const activeScreen =
    typeof payload.activeScreen === "string" ? payload.activeScreen.slice(0, 60) : null;

  const scoped = scopeBrief(payload.context ?? {}, role);
  const brief = fitBrief(scoped.brief);
  const datasets = scopeDatasets(payload.datasets ?? {}, role);

  const system = buildSystemPrompt(role, activeScreen, datasets, scoped.withheld);
  const briefJson = JSON.stringify(brief, null, 2);
  const history = normaliseHistory(payload.history);

  try {
    if (isGemini(providerId, base)) {
      const url = geminiUrl(base, model, apiKey);
      /*
       * The tool loop. Each round the model may ask for specific records; the
       * answers go back as a function response and it gets another turn. Three
       * rounds is enough for "how many invoices are overdue, and list the
       * biggest three" and stops a model that has started looping.
       */
      const transcript: Turn[] = history;
      const datasetKeys = Object.keys(datasets);
      let questionForRound = `${briefJson}\n\n---\n\n${question}`;

      for (let round = 0; round < 3; round++) {
        const result = await callGemini(
          url,
          system,
          transcript,
          questionForRound,
          datasetKeys
        );

        if (result.calls.length === 0) {
          const parsed = extractJsonObject(result.text);
          if (!parsed) {
            throw new Error(
              "The model answered, but not in a form we could read. Try rephrasing the question."
            );
          }
          /*
           * A reply can parse and still be blank — `{"answer": ""}` is valid
           * JSON against the schema. Returning it as-is produced a card with a
           * heading and no text, which reads as a bug rather than as an answer,
           * so an empty answer is caught here and re-asked once without tools.
           */
          const text = String((parsed as { answer?: unknown }).answer ?? "").trim();
          if (text) return Response.json(sanitiseSuggestion(parsed, role));

          const retry = await callGemini(
            url,
            system,
            transcript,
            `${questionForRound}\n\nYour last reply was empty. Answer the question in one or two plain sentences.`,
            []
          );
          const retried = extractJsonObject(retry.text);
          const retryText = String(
            (retried as { answer?: unknown } | null)?.answer ?? retry.text ?? ""
          ).trim();
          if (!retryText) {
            return Response.json(
              sanitiseSuggestion(
                {
                  answer:
                    "I could not put together an answer from the data I have. Try asking about one thing at a time — a single student, invoice or class.",
                  confidence: "low",
                },
                role
              )
            );
          }
          return Response.json(
            sanitiseSuggestion(retried ?? { answer: retryText }, role)
          );
        }

        for (const call of result.calls) {
          const output = call.name === "search_records"
            ? runSearch(call, datasets)
            : JSON.stringify({ error: "unknown_tool", tool: call.name });
          // A function response is a user-role turn in Gemini's shape.
          transcript.push({
            role: "user",
            text: JSON.stringify({
              function_response: { name: call.name ?? "unknown", response: output },
            }),
          });
        }
        questionForRound = "Continue using those results to answer the question.";
      }

      /*
       * Out of rounds: ask once more and take whatever answer comes back.
       *
       * The tool is withheld here on purpose. Passing `datasetKeys` again let
       * the model spend this turn on another `search_records` call, and a
       * round that only contains a function call carries no text at all — so
       * `finalRound.text` was empty, `extractJsonObject("")` found nothing, and
       * the reply that reached the browser had an empty `answer`. That is the
       * blank card: the request took the full three rounds plus this one, then
       * rendered nothing. With no tool offered the model can only answer.
       */
      const finalRound = await callGemini(
        url,
        system,
        transcript,
        `${questionForRound}\n\nAnswer now from the information above. Do not ask for more records — reply with your best answer.`,
        []
      );
      const parsedFinal = extractJsonObject(finalRound.text);
      const answer = String(
        (parsedFinal as { answer?: unknown } | null)?.answer ??
          finalRound.text ??
          ""
      ).trim();

      if (!answer) {
        return Response.json(
          sanitiseSuggestion(
            {
              answer:
                "I could not put together an answer from the data I have. Try asking about one thing at a time — a single student, invoice or class.",
              confidence: "low",
            },
            role
          )
        );
      }

      return Response.json(
        sanitiseSuggestion(parsedFinal ?? { answer, confidence: "medium" }, role)
      );
    }

    /* ---- OpenAI-compatible providers ---- */
    const upstream = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 900,
        messages: [
          { role: "system", content: system },
          { role: "system", content: `DATA BRIEF — ${briefJson}` },
          ...history.map((turn) => ({
            role: turn.role === "model" ? "assistant" : "user",
            content: turn.text,
          })),
          { role: "user", content: question },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return Response.json(
        {
          error: "upstream_error",
          message: describeProviderError(
            upstream.status,
            detail ? { error: { message: detail } } : {}
          ),
        },
        { status: 502 }
      );
    }

    const json = (await upstream.json()) as {
      choices?: { message?: { content?: string }; text?: string }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? json.choices?.[0]?.text ?? "";
    return Response.json(fromOpenAiReply(raw, role));
  } catch (err) {
    return Response.json(
      {
        error: "provider_error",
        message:
          err instanceof Error
            ? err.message
            : "Could not reach the AI provider.",
      },
      { status: 502 }
    );
  }
}
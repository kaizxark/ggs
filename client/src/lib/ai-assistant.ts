import { supabase } from "./supabase";
import { isSuperAdminId } from "@shared/super-admin";
import type { AiSuggestion } from "@shared/ai-access";

/**
 * Provider-agnostic AI configuration.
 *
 * Anything that speaks the OpenAI `/chat/completions` shape works, so this is a
 * base URL plus a model name plus a key — not an OpenAI key specifically. The
 * presets below only pre-fill those two fields; "Custom" accepts anything.
 *
 * ## Where this is stored, and why it moved
 *
 * These values used to live in this browser's `localStorage`, which meant the
 * assistant only worked for whoever happened to paste a key — in practice the
 * super admin, and nobody else. They are now held on the server
 * (`/api/ai-settings`) and configured once by the super admin in the same
 * Settings panel as before.
 *
 * `localStorage` is still read, for one reason: a super admin can override the
 * school's configuration for a single request while testing a new provider,
 * and a self-hosted endpoint such as Ollama genuinely only exists on one
 * machine. It is a per-user override, never the school's default, and it is
 * only ever honoured for a super admin.
 */
export const CONFIG_STORAGE = "gk-ai-config";

export interface AiProvider {
  id: string;
  label: string;
  /** Base URL for the provider's endpoint. */
  base: string;
  /** Default model; the user can pick another from the same provider. */
  model: string;
  /** Models available from this provider, shown in the Settings model picker. */
  models?: readonly string[];
  /** Shown under the key field as a hint about the expected key format. */
  keyHint: string;
  /** Human note, e.g. where to get a key or that it runs locally. */
  note: string;
}

import { GEMINI_MODELS } from "./gemini";

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    base: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-3.8-flash",
    models: GEMINI_MODELS,
    keyHint: "AIza…",
    note: "Google AI Studio keys. The server holds this key, so the assistant works for everyone without them configuring anything.",
  },
  {
    id: "openai",
    label: "OpenAI",
    base: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4o-2024-11-20", "gpt-4-turbo", "gpt-4-turbo-2024-04-09", "gpt-4.1-mini", "gpt-4.1-nano"],
    keyHint: "sk-…",
    note: "Platform API keys, from platform.openai.com.",
  },
  {
    id: "groq",
    label: "Groq",
    base: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "llama-guard-4-0.1"],
    keyHint: "gsk_…",
    note: "Very fast, has a free tier.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
    models: ["openai/gpt-4o-mini", "openai/gpt-4o", "meta-llama/llama-3.1-70b-instruct", "google/gemini-2.0-flash-exp", "mistralai/mistral-small-3.1-24b-instruct"],
    keyHint: "sk-or-v1-…",
    note: "One key, many models from many vendors.",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    base: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyHint: "sk-…",
    note: "Cheap, works well for this kind of grounded Q&A.",
  },
  {
    id: "mistral",
    label: "Mistral",
    base: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
    models: [
      "mistral-small-latest",
      "mistral-medium-latest",
      "mistral-large-latest",
      "open-mixtral-8x22b",
      "open-mixtral-8x7b",
    ],
    keyHint: "…",
    note: "European provider, OpenAI-compatible API.",
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    base: "https://router.huggingface.co/v1",
    model: "openai/gpt-oss-120b:cheapest",
    keyHint: "hf_…",
    note: "One HF token reaches thousands of open-weight models. Model names look like meta-llama/Llama-3.1-8B-Instruct.",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    base: "http://localhost:11434/v1",
    model: "llama3.1",
    keyHint: "any value",
    note: "Runs on your own machine. The key is not checked by Ollama — leave any placeholder.",
  },
  {
    id: "custom",
    label: "Custom endpoint",
    base: "",
    model: "",
    keyHint: "…",
    note: "Anything OpenAI-compatible — a self-hosted vLLM or LM Studio server, or a gateway.",
  },
];

export const DEFAULT_AI_CONFIG: AiConfig = {
  providerId: "gemini",
  base: AI_PROVIDERS[0].base,
  model: AI_PROVIDERS[0].model,
  key: "",
};

export interface AiConfig {
  providerId: string;
  /** Base URL, e.g. https://api.groq.com/openai/v1 */
  base: string;
  /** Model name as the provider expects it, e.g. llama-3.3-70b-versatile */
  model: string;
  /** API key. Empty for local runtimes that do not check one. */
  key: string;
}

export function getProvider(providerId: string): AiProvider {
  return (
    AI_PROVIDERS.find((provider) => provider.id === providerId) ??
    AI_PROVIDERS[AI_PROVIDERS.length - 1]
  );
}

/**
 * Read this browser's override of the shared configuration.
 *
 * Almost always empty — the school's configuration lives on the server. Kept
 * because a super admin testing a provider needs to try one without changing
 * what everyone else is using.
 */
export function getAiConfig(): AiConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE);
    if (!raw) return { ...DEFAULT_AI_CONFIG };
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    return {
      providerId: parsed.providerId ?? DEFAULT_AI_CONFIG.providerId,
      base: parsed.base ?? DEFAULT_AI_CONFIG.base,
      model: parsed.model ?? DEFAULT_AI_CONFIG.model,
      key: parsed.key ?? "",
    };
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

export function setAiConfig(config: AiConfig): void {
  try {
    const cleaned: AiConfig = {
      providerId: config.providerId,
      base: config.base.trim().replace(/\/+$/, ""),
      model: config.model.trim(),
      key: config.key.trim(),
    };
    if (!cleaned.model) cleaned.model = getProvider(cleaned.providerId).model;
    if (!cleaned.base) cleaned.base = getProvider(cleaned.providerId).base;
    window.localStorage.setItem(CONFIG_STORAGE, JSON.stringify(cleaned));
  } catch {
    /* private browsing — the shared server configuration is unaffected */
  }
}

/** True when there is enough to make a call. */
export function isAiConfigured(config: AiConfig = getAiConfig()): boolean {
  return Boolean(config.base && config.model);
}

/**
 * True when the signed-in user is allowed to configure the assistant.
 *
 * Keyed on the user's id, never on their email. The previous version compared
 * against an email address, which meant renaming the account silently revoked
 * the ability to configure the assistant at all.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return false;
  if (isSuperAdminId(session.user.id)) return true;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();
  return String(data?.role ?? "") === "super_admin";
}

/* ------------------------------------------------------------------ *
 * Shared server configuration
 * ------------------------------------------------------------------ */

/** The shared configuration with the key removed. */
export interface SharedAiSettings {
  providerId: string;
  base: string;
  model: string;
  hasKey: boolean;
  updatedAt: string | null;
}

/** The signed-in user's access token, for our own API routes. */
async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function loadSharedAiSettings(): Promise<SharedAiSettings> {
  try {
    const res = await fetch("/api/ai-settings", { headers: await authHeaders() });
    if (!res.ok) throw new Error("unavailable");
    return (await res.json()) as SharedAiSettings;
  } catch {
    return { providerId: "", base: "", model: "", hasKey: false, updatedAt: null };
  }
}

/** Save the configuration for every signed-in user. Super admin only. */
export async function saveSharedAiSettings(config: AiConfig): Promise<
  { ok: true } | { ok: false; message: string }
> {
  try {
    const res = await fetch("/api/ai-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      // The route reads `apiKey`; our own shape calls the same value `key`
      // (it is what goes into localStorage and the x-ai-key header). Sending
      // the config as-is meant the server never saw the typed key and replied
      // "Enter an API key, or keep the one already saved." however much was
      // pasted into the form — and with nothing stored yet, both were empty.
      body: JSON.stringify({
        providerId: config.providerId,
        base: config.base,
        model: config.model,
        apiKey: config.key,
      }),
    });
    const json = (await res.json()) as { message?: string };
    if (!res.ok) {
      return { ok: false, message: json.message ?? "Could not save the configuration." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

export async function clearSharedAiSettings(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  try {
    const res = await fetch("/api/ai-settings", {
      method: "DELETE",
      headers: await authHeaders(),
    });
    const json = (await res.json()) as { message?: string };
    if (!res.ok) {
      return { ok: false, message: json.message ?? "Could not clear the configuration." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

/* ------------------------------------------------------------------ *
 * Asking
 * ------------------------------------------------------------------ */

/** One turn of the conversation. */
export interface AiTurn {
  role: "user" | "model";
  text: string;
}

export interface AskOptions {
  /** Prior turns, oldest first, so follow-ups have context. */
  history?: AiTurn[];
  /** The full, unscoped datasets, for the server to search on demand. */
  datasets?: Record<string, unknown[]>;
  /** The screen the user is looking at, so the answer can be contextual. */
  activeScreen?: string | null;
}

/** The reply, plus whether the server is reachable at all. */
export interface AiAnswer extends AiSuggestion {
  error?: string;
}

/**
 * How many rows of any one dataset travel with a question.
 *
 * Every dataset was previously sent whole, on every question. In the live
 * database that is 12,234 attendance rows and 931 exam results, so each keystroke
 * of "ask" uploaded megabytes of JSON to be re-serialised by the server and
 * searched — which is most of why the assistant took so long to reply.
 *
 * The cap is deliberately generous. The brief already carries the aggregates
 * ("attendance is 92.4%"), and `search_records` runs server-side against these
 * rows to find a *named* record, so a name only has to appear somewhere in the
 * first few hundred rows of its own table to still be findable. Tables small
 * enough to fit are sent whole and are unaffected.
 */
const MAX_ROWS_PER_DATASET = 400;

/**
 * Trim the datasets to something a request can carry.
 *
 * Whole datasets were the single biggest cost in the request, and the rows past
 * the cap are the least likely to be the one being asked about. Trimming happens
 * here rather than on the server so the bytes are never uploaded at all.
 */
export function trimDatasets(
  datasets: Record<string, unknown[]>,
  limit: number = MAX_ROWS_PER_DATASET
): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const key of Object.keys(datasets)) {
    const rows = datasets[key];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    out[key] = rows.length > limit ? rows.slice(0, limit) : rows;
  }
  return out;
}

/**
 * Ask the assistant.
 *
 * The request goes to our own `/api/ai` with the caller's session token, and
 * the school data travels with it. The server re-derives the caller's role from
 * that token and strips the brief to what they may see before anything reaches
 * the provider — the client is not a trust boundary, and this call site is not
 * where access is decided.
 */
export async function askAssistant(
  question: string,
  brief: Record<string, unknown>,
  options: AskOptions = {}
): Promise<AiAnswer> {
  const config = getAiConfig();
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
        // A super admin's local override rides along; the server ignores these
        // headers for anyone else.
        ...(config.key ? { "x-ai-key": config.key } : {}),
        ...(config.base ? { "x-ai-base": config.base } : {}),
        ...(config.model ? { "x-ai-model": config.model } : {}),
      },
      body: JSON.stringify({
        question,
        context: brief,
        datasets: trimDatasets(options.datasets ?? {}),
        history: options.history ?? [],
        activeScreen: options.activeScreen ?? null,
      }),
    });

    const json = (await res.json()) as Partial<AiAnswer> & { message?: string };
    if (!res.ok) {
      return {
        answer: json.message ?? "The assistant is unavailable right now.",
        bullets: [],
        actions: [],
        followUps: [],
        sources: [],
        confidence: "low",
        error: json.error ?? "request_failed",
      };
    }
    return {
      answer: json.answer ?? "",
      bullets: json.bullets ?? [],
      actions: json.actions ?? [],
      followUps: json.followUps ?? [],
      sources: json.sources ?? [],
      confidence: json.confidence ?? "high",
    };
  } catch {
    return {
      answer:
        "Could not reach the assistant. Check your connection and try again.",
      bullets: [],
      actions: [],
      followUps: [],
      sources: [],
      confidence: "low",
      error: "network",
    };
  }
}

/**
 * Verify the saved settings by asking the provider a trivial question.
 *
 * Distinct from `askAssistant` because the answer is discarded — this is about
 * finding out whether the key, URL and model name are all correct, which is the
 * question the super admin actually has while setting this up. The ping runs
 * on the server so it exercises the stored credential rather than one that only
 * exists in this browser.
 */
export async function testAiConnection(
  config: AiConfig
): Promise<{ ok: true; model?: string } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
        ...(config.key ? { "x-ai-key": config.key } : {}),
        ...(config.base ? { "x-ai-base": config.base } : {}),
        ...(config.model ? { "x-ai-model": config.model } : {}),
      },
      body: JSON.stringify({ action: "ping", model: config.model }),
    });
    const json = (await res.json()) as { ok?: boolean; model?: string; message?: string };
    if (!res.ok || json.ok === false) {
      return { ok: false, message: json.message ?? "The provider rejected the request." };
    }
    return { ok: true, model: json.model };
  } catch {
    return { ok: false, message: "Could not reach our /api/ai route." };
  }
}
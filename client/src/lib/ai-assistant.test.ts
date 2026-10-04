import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_PROVIDERS,
  DEFAULT_AI_CONFIG,
  getProvider,
  isAiConfigured,
  saveSharedAiSettings,
  trimDatasets,
} from "./ai-assistant";

/**
 * These presets drive a text box in Settings, so a typo here is only discovered
 * by a super admin mid-setup. Asserting the shape up front keeps the obvious
 * mistakes — a base URL that is not a URL, a model that forgot its `/v1` — out
 * of the shipped bundle.
 */
describe("AI provider presets", () => {
  it("gives every preset a parseable http(s) base URL", () => {
    for (const provider of AI_PROVIDERS) {
      if (provider.id === "custom") {
        // Custom intentionally starts empty so a self-hosted URL is typed in.
        expect(provider.base).toBe("");
        continue;
      }
      const url = new URL(provider.base);
      expect(["http:", "https:"]).toContain(url.protocol);
      expect(url.hostname).toBeTruthy();
    }
  });

  it("gives every non-custom preset a model name", () => {
    for (const provider of AI_PROVIDERS) {
      if (provider.id === "custom") continue;
      expect(provider.model.trim().length).toBeGreaterThan(0);
    }
  });

  it("has unique ids, because the id is what gets stored", () => {
    const ids = AI_PROVIDERS.map((provider) => provider.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes a Hugging Face preset pointing at the Inference Providers router", () => {
    const hf = getProvider("huggingface");
    expect(hf.base).toBe("https://router.huggingface.co/v1");
    expect(hf.keyHint).toContain("hf_");
  });

  it("leaves a custom base URL and model for the user to fill in", () => {
    const custom = getProvider("custom");
    expect(custom.base).toBe("");
    expect(custom.model).toBe("");
  });

  it("falls back to the custom option for an unknown provider id", () => {
    // A stored config from a removed provider must not break the panel.
    expect(getProvider("some-retired-provider").id).toBe("custom");
  });

  it("treats a config with a base and model as configured, key or no key", () => {
    // Local runtimes such as Ollama ignore Authorization entirely.
    expect(
      isAiConfigured({
        providerId: "ollama",
        base: "http://localhost:11434/v1",
        model: "llama3.1",
        key: "",
      })
    ).toBe(true);
    expect(
      isAiConfigured({ providerId: "openai", base: "", model: "gpt-4o-mini", key: "sk-x" })
    ).toBe(false);
  });

  it("defaults to Gemini with a real base and model", () => {
    // The default is the provider this dashboard is actually built around: the
    // super admin opens Settings, and the first thing in the list should be the
    // one the assistant is written for.
    expect(DEFAULT_AI_CONFIG.providerId).toBe("gemini");
    expect(DEFAULT_AI_CONFIG.base).toContain("generativelanguage.googleapis.com");
    expect(isAiConfigured({ ...DEFAULT_AI_CONFIG, key: "AIza-x" })).toBe(true);
  });

  it("offers Gemini first and only offers models that exist", () => {
    expect(AI_PROVIDERS[0].id).toBe("gemini");
    const gemini = getProvider("gemini");
    expect(gemini.models?.length ?? 0).toBeGreaterThan(0);
    // A retired preview id in this list is a model the settings screen offers
    // and the API then rejects.
    expect(gemini.models ?? []).not.toContain("gemini-2.0-flash");
    for (const model of gemini.models ?? []) {
      expect(model).toMatch(/^gemini-[0-9]/);
    }
  });
});

/**
 * The wire format between the Settings form and /api/ai-settings.
 *
 * These two sides disagree about the name of one field: our config shape calls
 * it `key`, the route reads `apiKey`. The route's own tests post `apiKey`
 * directly, so nothing covered the join — the mismatch shipped, and the
 * symptom was a super admin pasting a perfectly good key into Settings and
 * being told "Enter an API key, or keep the one already saved." These assert
 * the body we actually put on the wire.
 */
describe("saving the shared AI configuration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Run one save and return the parsed request body. */
  async function captureBody(config: Parameters<typeof saveSharedAiSettings>[0]) {
    let body: Record<string, unknown> = {};
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return { ok: true, json: async () => ({ ok: true }) };
    });
    // No Supabase session in this environment, so the auth header is simply
    // absent — the body is what is under test.
    const result = await saveSharedAiSettings(config);
    expect(result.ok).toBe(true);
    return body;
  }

  it("sends the typed key under the name the route reads", async () => {
    const body = await captureBody({
      providerId: "gemini",
      base: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-3.8-flash",
      key: "AIzaTypedByTheAdmin",
    });
    expect(body.apiKey).toBe("AIzaTypedByTheAdmin");
  });

  it("does not leak the key under our own field name as well", async () => {
    // Belt and braces: if both were sent the route would work, but the payload
    // would carry a second copy of a secret under a name nothing reads.
    const body = await captureBody({
      providerId: "gemini",
      base: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-3.8-flash",
      key: "AIzaTypedByTheAdmin",
    });
    expect(body.key).toBeUndefined();
  });

  it("sends an empty apiKey when the field is left blank, to keep the saved one", async () => {
    // Blank means "keep what is stored" rather than "no key" — the route tells
    // those two apart only by the key being absent-or-empty, so it must be
    // present in the body even when empty.
    const body = await captureBody({
      providerId: "gemini",
      base: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-3.8-flash",
      key: "",
    });
    expect(body.apiKey).toBe("");
    expect(body.providerId).toBe("gemini");
    expect(body.model).toBe("gemini-3.8-flash");
  });
});

/**
 * The assistant was slow because every dataset was uploaded whole on every
 * question — 12,234 attendance rows and 931 exam results in the live database.
 * `search_records` only ever returns a handful of rows, so the tail was being
 * paid for in upload time and then discarded.
 */
describe("trimming the datasets sent with a question", () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: String(i), name: `Row ${i}` }));

  it("caps a dataset that is far larger than the limit", () => {
    const out = trimDatasets({ attendance: rows(12_234) });
    expect(out.attendance).toHaveLength(400);
  });

  it("leaves a dataset that already fits untouched", () => {
    const small = rows(10);
    const out = trimDatasets({ staff: small });
    // Identity, not just length: the same array should come back.
    expect(out.staff).toBe(small);
  });

  it("keeps the rows a name search would actually match", () => {
    // The point of the cap is upload size, not recall loss: a table small enough
    // to be searched must still arrive whole.
    const out = trimDatasets({ students: rows(100) });
    expect(out.students.some((r) => (r as { name: string }).name === "Row 42")).toBe(true);
  });

  it("drops empty datasets rather than sending empty arrays", () => {
    const out = trimDatasets({ students: [], invoices: rows(3) });
    expect(out).not.toHaveProperty("students");
    expect(out.invoices).toHaveLength(3);
  });

  it("honours a caller-supplied limit", () => {
    expect(trimDatasets({ attendance: rows(1000) }, 25).attendance).toHaveLength(25);
  });

  it("does not mutate the caller's arrays", () => {
    const original = rows(500);
    trimDatasets({ attendance: original });
    expect(original).toHaveLength(500);
  });
});

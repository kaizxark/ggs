/**
 * Where the AI provider configuration lives.
 *
 * ## The problem this fixes
 *
 * The provider and API key were kept in each browser's `localStorage`, so the
 * assistant only worked for the one person who had pasted a key. Every other
 * signed-in user — every teacher, every accounts clerk — opened the palette and
 * got "No API key configured". Making the assistant available to the whole
 * school therefore cannot be a client-side change: the credential has to move
 * to the server, where one configuration serves everyone.
 *
 * The super admin still configures it in exactly the same place as before.
 * Nothing about that flow changes; only where the value is persisted.
 *
 * ## Why the key is encrypted before it is stored
 *
 * `public.settings` is readable by every signed-in user — that is what makes
 * the school name and campus load on the Overview screen. So a plaintext key in
 * that table would be readable by any teacher who opened the network tab, which
 * is not a secret in any meaningful sense.
 *
 * The key is therefore sealed with AES-GCM under a key derived from the
 * server-only `SUPABASE_SECRET_KEY`, and only the ciphertext is written. The
 * plaintext exists only in the super admin's request and in server memory. Even
 * a super admin cannot read the stored key back — the Settings screen shows
 * that one is saved and lets them replace it, but never returns it, so the
 * credential cannot leak through a screenshot of the settings page or a support
 * request that asks someone to paste their config.
 *
 * ## Why a settings row and not a new table
 *
 * `public.settings` is a key/value table with a `jsonb` value and an upsert
 * helper already used by the school settings screen. Adding a table means a
 * migration someone has to run by hand before the feature works at all. One
 * more row is invisible and ships with the next deploy.
 */

const SETTINGS_KEY = "ai_assistant";
const SETTINGS_ROW_ID = "set-ai";

export interface SharedAiConfig {
  providerId: string;
  base: string;
  model: string;
  apiKey: string;
  updatedAt?: string;
  updatedBy?: string;
}

type Json = Record<string, unknown>;

function supabaseUrl(): string {
  return (
    process.env.VITE_SUPABASE_URL || "https://fmlwzxmjrecbtvgraqqm.supabase.co"
  );
}

function serviceKey(): string {
  return process.env.SUPABASE_SECRET_KEY || "";
}

/* ------------------------------------------------------------------ *
 * Sealed values
 * ------------------------------------------------------------------ */

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/*
 * WebCrypto's `BufferSource` is stricter about ArrayBuffer backing than a
 * plain Uint8Array satisfies under this tsconfig, so the byte views are handed
 * over as buffers explicitly rather than cast.
 */
function asBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

/**
 * The sealing key, derived from the service-role secret.
 *
 * Derived rather than used directly so the key material is domain-separated
 * from the Supabase secret itself, and so a caller cannot pass the service key
 * straight into AES. SHA-256 is sufficient here: the input is a high-entropy
 * secret, not a password, so there is nothing to brute-force.
 */
async function sealingKey(): Promise<CryptoKey> {
  const secret = serviceKey();
  if (!secret) {
    throw new Error("SUPABASE_SECRET_KEY is not configured on this server.");
  }
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`gk-ai-config:${secret}`));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Seal a credential for storage.
 *
 * The random 12-byte IV is stored alongside the ciphertext, which is safe: a
 * reused IV under the same key is what breaks GCM, and this never reuses one.
 */
export async function sealSecret(plaintext: string): Promise<string> {
  const key = await sealingKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBuffer(iv) },
    key,
    enc.encode(plaintext)
  );
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(sealed))}`;
}

/** Open a stored credential. Returns null for anything unreadable rather than
 * throwing, so a rotated secret degrades to "not configured" instead of a
 * 500 on the assistant. */
export async function openSecret(sealed: string): Promise<string | null> {
  const parts = String(sealed ?? "").split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  try {
    const key = await sealingKey();
    const opened = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asBuffer(fromBase64(parts[1])) },
      key,
      asBuffer(fromBase64(parts[2]))
    );
    return dec.decode(opened);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * The stored row
 * ------------------------------------------------------------------ */

function rowHeaders(): Record<string, string> {
  const key = serviceKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  };
}

function asConfig(value: unknown): SharedAiConfig | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Json;
  const sealed = typeof row.api_key_sealed === "string" ? row.api_key_sealed : "";
  if (!sealed) return null;
  return {
    providerId: String(row.provider_id ?? ""),
    base: String(row.base ?? ""),
    model: String(row.model ?? ""),
    apiKey: sealed, // still sealed here; callers use `loadSharedAiConfig`
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
    updatedBy: typeof row.updated_by === "string" ? row.updated_by : undefined,
  };
}

/**
 * Read the shared configuration, with the credential already opened.
 *
 * Returns null when nothing has been saved yet or when the stored value can no
 * longer be decrypted — for example after the service key was rotated. Callers
 * treat both as "not configured", which is the honest reading.
 */
export async function loadSharedAiConfig(): Promise<SharedAiConfig | null> {
  const key = serviceKey();
  if (!key) return null;
  try {
    const res = await fetch(
      `${supabaseUrl()}/rest/v1/settings?select=value&id=eq.${SETTINGS_ROW_ID}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Json[];
    const config = asConfig(rows?.[0]?.value);
    if (!config) return null;
    const apiKey = await openSecret(config.apiKey);
    if (!apiKey) return null;
    return { ...config, apiKey };
  } catch {
    return null;
  }
}

/**
 * Why a write failed, in terms the caller can act on.
 *
 * A bare `false` sent a super admin to "check that this server can reach the
 * database" when the real problem was that the table had never been created —
 * the server was talking to the database perfectly well. PostgREST names the
 * condition in its error body, so it is worth surfacing rather than collapsing
 * every failure into one sentence.
 */
export interface WriteFailure {
  /** PostgREST error code, e.g. PGRST205 for a missing table. */
  code?: string;
  /** PostgREST's own message, kept verbatim. */
  detail?: string;
  status?: number;
  reason: "no_service_key" | "table_missing" | "rejected" | "network";
}

async function describeWriteFailure(res: Response): Promise<WriteFailure> {
  let code = "";
  let detail = "";
  try {
    const body = (await res.json()) as { code?: string; message?: string };
    code = String(body?.code ?? "");
    detail = String(body?.message ?? "");
  } catch {
    /* a non-JSON error body is still a failure; fall through to the status */
  }
  if (code === "PGRST205" || /could not find the table/i.test(detail)) {
    return { code, detail, status: res.status, reason: "table_missing" };
  }
  return { code, detail, status: res.status, reason: "rejected" };
}

/** Persist the configuration for every signed-in user to use. */
export async function saveSharedAiConfig(
  config: SharedAiConfig,
  updatedBy: string
): Promise<{ ok: true } | { ok: false; failure: WriteFailure }> {
  const key = serviceKey();
  if (!key) return { ok: false, failure: { reason: "no_service_key" } };
  const sealed = await sealSecret(config.apiKey);
  const body = JSON.stringify({
    id: SETTINGS_ROW_ID,
    key: SETTINGS_KEY,
    value: {
      provider_id: config.providerId,
      base: config.base,
      model: config.model,
      api_key_sealed: sealed,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
  });
  try {
    const res = await fetch(`${supabaseUrl()}/rest/v1/settings?on_conflict=id`, {
      method: "POST",
      headers: rowHeaders(),
      body,
    });
    if (!res.ok) return { ok: false, failure: await describeWriteFailure(res) };
    return { ok: true };
  } catch {
    return { ok: false, failure: { reason: "network" } };
  }
}

/** Remove the shared configuration, switching the assistant off school-wide. */
export async function clearSharedAiConfig(): Promise<boolean> {
  const key = serviceKey();
  if (!key) return false;
  try {
    const res = await fetch(
      `${supabaseUrl()}/rest/v1/settings?id=eq.${SETTINGS_ROW_ID}`,
      { method: "DELETE", headers: rowHeaders() }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Guard a base URL before anything is fetched from it.
 *
 * The value is used to build an outbound request, so a super admin could
 * otherwise point the server at any host — including something inside the
 * school's own network, reachable from the server but not from the browser that
 * asked. Only http(s) URLs with a host are accepted, and any credentials
 * embedded in the URL are stripped.
 */
export function normaliseBaseUrl(raw: string): string | null {
  // People paste the full endpoint from a provider's docs as often as the bare
  // base, so a trailing /chat/completions is dropped here.
  const value = raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/+$/, "");
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  url.username = "";
  url.password = "";
  return url.toString().replace(/\/+$/, "");
}

/**
 * What the Settings screen is allowed to see.
 *
 * `hasKey` replaces the key itself. A settings page that can display a
 * credential is a settings page that eventually puts one in a screenshot.
 */
export function publicView(
  config: SharedAiConfig | null
): {
  providerId: string;
  base: string;
  model: string;
  hasKey: boolean;
  updatedAt: string | null;
} {
  if (!config) {
    return { providerId: "", base: "", model: "", hasKey: false, updatedAt: null };
  }
  return {
    providerId: config.providerId,
    base: config.base,
    model: config.model,
    hasKey: Boolean(config.apiKey),
    updatedAt: config.updatedAt ?? null,
  };
}
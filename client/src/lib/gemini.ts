/**
 * Gemini model ids.
 *
 * This used to hold a browser-side adapter that called the Gemini endpoint
 * directly with the API key. That is gone: the key now lives on the server and
 * Gemini is called from `/api/ai`, using its native structured-output and
 * function-calling features rather than being shaped into the OpenAI request
 * the rest of the AI layer speaks.
 *
 * What is left is the one thing both the Settings screen and the server need
 * to agree on: which models are valid.
 */

/**
 * Current Gemini models, cheapest and most capable first.
 *
 * Ordered by what this assistant actually needs. It is a grounded question
 * answerer over a JSON brief, not a reasoning-heavy agent: the work is
 * retrieval and careful citation, which Flash does at a fraction of Pro's cost
 * and latency. Pro is kept for the questions that genuinely need it — "why did
 * collection drop this term" — and for anyone who would rather spend more than
 * think faster.
 *
 * The 2.x ids are retained because Google's 2.5 access is restricted to
 * accounts that used them before the cutoff, so an older key may still need
 * them.
 */
export const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number];
/**
 * Shared AI configuration.
 *
 * The super admin picks a provider and enters a key in Settings; this route
 * stores that choice on the server so every signed-in member of staff gets the
 * assistant, instead of only the one browser that happened to save it.
 *
 * Three things are deliberate here:
 *
 *   • Only the super admin may read or write it. Any admin-level account can
 *     get this far, and it is refused — the credential that unlocks the
 *     assistant for the whole school is not something a second admin should be
 *     able to read or replace.
 *
 *   • The response never contains the key. It reports `hasKey` so the screen
 *     can say "configured" and offer to replace it. A settings page that can
 *     display a credential is a settings page that eventually puts one in a
 *     screenshot.
 *
 *   • The key is sealed before it is stored — see `shared/ai-config.ts` for why
 *     that matters given `public.settings` is readable by every signed-in user.
 */

export const config = { runtime: "edge" };

import { resolveCaller } from "../shared/ai-auth";
import {
  clearSharedAiConfig,
  loadSharedAiConfig,
  normaliseBaseUrl,
  publicView,
  saveSharedAiConfig,
} from "../shared/ai-config";

function fail(message: string, status: number, code = "error") {
  return Response.json({ error: code, message }, { status });
}

export default async function handler(req: Request): Promise<Response> {
  const caller = await resolveCaller(req);
  if (!caller) {
    return fail("Sign in to manage the AI assistant.", 401, "unauthenticated");
  }
  if (!caller.superAdmin) {
    return fail(
      "Only the super admin can change the AI assistant configuration.",
      403,
      "forbidden"
    );
  }

  if (req.method === "GET") {
    const config = await loadSharedAiConfig();
    return Response.json(publicView(config));
  }

  if (req.method === "DELETE") {
    const cleared = await clearSharedAiConfig();
    if (!cleared) {
      return fail("Could not clear the configuration.", 500, "write_failed");
    }
    return Response.json({ ok: true, cleared: true });
  }

  if (req.method !== "POST" && req.method !== "PUT") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: {
    providerId?: string;
    base?: string;
    model?: string;
    apiKey?: string;
    clear?: boolean;
  };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Explicitly switching the assistant off for the whole school.
  if (payload.clear) {
    const cleared = await clearSharedAiConfig();
    return cleared
      ? Response.json({ ok: true, cleared: true })
      : fail("Could not clear the configuration.", 500, "write_failed");
  }

  const providerId = String(payload.providerId ?? "").trim();
  const model = String(payload.model ?? "").trim();
  if (!providerId) {
    return fail("Choose a provider first.", 400, "invalid_provider");
  }
  if (!model) {
    return fail("Choose a model first.", 400, "invalid_model");
  }

  const base = normaliseBaseUrl(String(payload.base ?? ""));
  if (!base) {
    return fail(
      "That base URL is not usable. It must be an http(s) address.",
      400,
      "invalid_base"
    );
  }

  const existing = await loadSharedAiConfig();
  const submitted = String(payload.apiKey ?? "").trim();
  const apiKey = submitted || existing?.apiKey || "";
  if (!apiKey) {
    return fail("Enter an API key, or keep the one already saved.", 400, "no_key");
  }

  const saved = await saveSharedAiConfig(
    { providerId, base, model, apiKey },
    caller.id
  );
  if (!saved.ok) {
    // Say which failure it was. "Check that this server can reach the database"
    // is actively misleading when the database is reachable and the table is
    // simply absent — which is exactly the state this shipped in.
    if (saved.failure.reason === "table_missing") {
      console.error("[ai-settings] public.settings is missing:", saved.failure.detail);
      return fail(
        "The database is missing its `settings` table, so there is nowhere to store the key. Run supabase/migrations/002_settings_table.sql in the Supabase SQL editor.",
        500,
        "table_missing"
      );
    }
    if (saved.failure.reason === "no_service_key") {
      console.error("[ai-settings] SUPABASE_SECRET_KEY is not set on this server");
      return fail(
        "This server has no SUPABASE_SECRET_KEY, so it cannot store the key.",
        500,
        "no_service_key"
      );
    }
    console.error("[ai-settings] write failed:", saved.failure);
    return fail(
      "The configuration could not be saved. Check that this server can reach the database.",
      500,
      "write_failed"
    );
  }

  return Response.json({
    ok: true,
    config: publicView({
      providerId,
      base,
      model,
      apiKey,
      updatedAt: new Date().toISOString(),
      updatedBy: caller.id,
    }),
  });
}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./ai-settings";
import { publicView } from "../shared/ai-config";
import { SUPER_ADMIN_ID } from "../shared/super-admin";

/**
 * The one thing this route must never get wrong.
 *
 * The assistant is configured once by the super admin and used by everyone, so
 * the credential now sits in `public.settings` — a table every signed-in user
 * can read. These tests are the reason it is safe to put it there: the key is
 * sealed before it is written, and it is never sent back out.
 */

const REAL_FETCH = globalThis.fetch;

const SUPABASE_HOST = "fmlwzxmjrecbtvgraqqm.supabase.co";

describe("POST/GET /api/ai-settings", () => {
  let callerId = SUPER_ADMIN_ID;
  let storedRows: Array<{ id: string; key: string; value: unknown }> = [];
  let written: Array<Record<string, unknown>> = [];
  let deleted = 0;

  beforeEach(() => {
    callerId = SUPER_ADMIN_ID;
    storedRows = [];
    written = [];
    deleted = 0;

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      const method = String(init?.method ?? "GET").toUpperCase();

      if (href.includes("/auth/v1/user")) {
        return Response.json({ id: callerId, email: "owner@gks.edu" });
      }
      if (href.includes("/rest/v1/profiles")) {
        // The super admin's stored role is "admin"; only the id grants the role,
        // which is exactly what makes an id-anchored privilege necessary.
        return Response.json([{ id: callerId, role: "admin" }]);
      }
      if (href.includes("/rest/v1/settings")) {
        if (method === "POST") {
          written.push(JSON.parse(String(init?.body ?? "{}")));
          return Response.json(written[written.length - 1]);
        }
        if (method === "DELETE") {
          deleted++;
          return Response.json({});
        }
        return Response.json(storedRows);
      }
      return Response.json({});
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  const post = (headers: Record<string, string>, body?: Record<string, unknown>) =>
    handler(
      new Request(`https://${SUPABASE_HOST}/api/ai-settings`, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          ...(headers.auth === undefined ? { Authorization: "Bearer session" } : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    ).then(async (res) => ({ res, json: await res.json() }));

  it("refuses a request with no session", async () => {
    const { res, json } = await post({ auth: "none" });
    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthenticated");
  });

  it("refuses an ordinary admin, even one whose stored role says admin", async () => {
    // The super admin's own row also reads "admin". If this check went by the
    // stored role, every admin in the school could read and replace the key.
    callerId = "22222222-2222-2222-2222-222222222222";
    const { res, json } = await post({}, { providerId: "gemini" });
    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
  });

  it("stores the key sealed, never in plaintext", async () => {
    const { res } = await post(
      {},
      {
        providerId: "gemini",
        base: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-3.8-flash",
        apiKey: "AIzaSuperSecretValue",
      }
    );
    expect(res.status).toBe(200);
    expect(written).toHaveLength(1);

    const row = written[0];
    const stored = String(JSON.stringify(row));
    expect(stored).not.toContain("AIzaSuperSecretValue");
    expect((row.value as { api_key_sealed: string }).api_key_sealed).toMatch(/^v1\./);
  });

  it("never returns the key, only whether one is saved", async () => {
    const { res, json } = await post(
      {},
      {
        providerId: "gemini",
        base: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-3.8-flash",
        apiKey: "AIzaSuperSecretValue",
      }
    );
    expect(res.status).toBe(200);
    // The response must be safe to put on a settings page someone might
    // screenshot.
    expect(JSON.stringify(json)).not.toContain("AIzaSuperSecretValue");
    expect(json.config.hasKey).toBe(true);
    expect(json.config.providerId).toBe("gemini");
  });

  it("keeps the saved key when the field is left blank", async () => {
    // A settings form that starts with an empty password box must not wipe the
    // stored credential every time the super admin changes the model.
    const { sealSecret } = await import("../shared/ai-config");
    storedRows = [
      {
        id: "set-ai",
        key: "ai_assistant",
        value: {
          provider_id: "gemini",
          base: "https://generativelanguage.googleapis.com/v1beta",
          model: "gemini-3.5-flash",
          api_key_sealed: await sealSecret("AIzaTheOriginalOne"),
        },
      },
    ];

    const { res, json } = await post(
      {},
      {
        providerId: "gemini",
        base: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-3.8-flash",
        apiKey: "",
      }
    );
    expect(res.status).toBe(200);
    expect(json.config.hasKey).toBe(true);

    const { openSecret } = await import("../shared/ai-config");
    const opened = await openSecret(
      (written[0].value as { api_key_sealed: string }).api_key_sealed
    );
    expect(opened).toBe("AIzaTheOriginalOne");
  });

  it("refuses a base URL that is not http(s)", async () => {
    // This value is used to build an outbound request from the server, so a
    // file:// or an internal host must never be accepted here.
    const { res, json } = await post(
      {},
      { providerId: "custom", base: "file:///etc/passwd", model: "m", apiKey: "k" }
    );
    expect(res.status).toBe(400);
    expect(json.error).toBe("invalid_base");
  });

  it("requires a key when nothing has been saved yet", async () => {
    const { res, json } = await post(
      {},
      {
        providerId: "gemini",
        base: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-3.8-flash",
        apiKey: "",
      }
    );
    expect(res.status).toBe(400);
    expect(json.error).toBe("no_key");
  });

  it("names a missing settings table instead of blaming the connection", async () => {
    // This is the exact failure that shipped: public.settings was declared in
    // schema.sql but never created in the live project. The server reached the
    // database fine and got a 404 back. Reporting that as "check that this
    // server can reach the database" sent the reader after the wrong system.
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      const method = String(init?.method ?? "GET").toUpperCase();
      if (href.includes("/auth/v1/user")) {
        return Response.json({ id: callerId, email: "owner@gks.edu" });
      }
      if (href.includes("/rest/v1/profiles")) {
        return Response.json([{ id: callerId, role: "admin" }]);
      }
      if (href.includes("/rest/v1/settings") && method === "POST") {
        return Response.json(
          {
            code: "PGRST205",
            details: null,
            hint: null,
            message: "Could not find the table 'public.settings' in the schema cache",
          },
          { status: 404 }
        );
      }
      if (href.includes("/rest/v1/settings")) return Response.json([]);
      return Response.json({});
    }) as unknown as typeof fetch;

    const { res, json } = await post(
      {},
      {
        providerId: "gemini",
        base: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-3.8-flash",
        apiKey: "AIzaSuperSecretValue",
      }
    );
    expect(res.status).toBe(500);
    expect(json.error).toBe("table_missing");
    // The message has to point at the thing that is actually missing.
    expect(json.message).toContain("002_settings_table.sql");
    expect(json.message).not.toMatch(/reach the database/i);
  });

  it("switches the assistant off school-wide", async () => {
    const { res, json } = await post({}, { clear: true });
    expect(res.status).toBe(200);
    expect(json.cleared).toBe(true);
    expect(deleted).toBe(1);
  });

  it("reports an unconfigured school without erroring", async () => {
    const res = await handler(
      new Request(`https://${SUPABASE_HOST}/api/ai-settings`, {
        method: "GET",
        headers: { Authorization: "Bearer session" },
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      providerId: "",
      base: "",
      model: "",
      hasKey: false,
      updatedAt: null,
    });
  });
});

describe("publicView", () => {
  it("replaces the key with a boolean, whatever it was given", () => {
    expect(
      publicView({
        providerId: "gemini",
        base: "https://x",
        model: "m",
        apiKey: "AIzaSecret",
      })
    ).toEqual({
      providerId: "gemini",
      base: "https://x",
      model: "m",
      hasKey: true,
      updatedAt: null,
    });
  });
});
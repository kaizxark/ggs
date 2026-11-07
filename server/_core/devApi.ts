import type { Express, Request as ExpressRequest } from "express";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Local API bridge.
 *
 * The deployed app uses Vercel functions in `api/`, each exporting a
 * Web-standard `(request: Request) => Response`. The development server is
 * Express, and it previously mounted only tRPC — so `/api/login` fell through
 * to the Vite SPA handler, the client received HTML where it expected JSON,
 * and every call surfaced as "Cannot reach the server."
 *
 * This module adapts Express requests to those handlers so local development
 * exercises the same code as production. It is imported only when
 * NODE_ENV=development and never runs in a deployed build.
 */

type WebHandler = (request: Request) => Promise<Response> | Response;

const API_DIR = path.resolve(import.meta.dirname, "../../api");

interface ApiRoute {
  route: string;
  file: string;
}

/** Every non-test module under api/, mapped the way Vercel maps file paths. */
async function discover(dir: string, prefix = ""): Promise<ApiRoute[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const routes: ApiRoute[] = [];

  for (const entry of entries) {
    const name = entry.name;
    if (name.startsWith("_") || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;

    if (entry.isDirectory()) {
      routes.push(...(await discover(full, relative)));
      continue;
    }
    if (!name.endsWith(".ts") || name.includes(".test.") || name.endsWith(".d.ts")) {
      continue;
    }

    let routePath = relative.replace(/\.ts$/, "").replace(/\/index$/, "");
    // Vercel's [id] segments become Express parameters.
    routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");
    routes.push({ route: `/api/${routePath}`, file: full });
  }

  return routes;
}

/** Rebuild a request body from what express.json()/express.urlencoded() parsed. */
function requestBody(req: ExpressRequest): BodyInit | undefined {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const body: unknown = req.body;
  if (body === undefined || body === null) return undefined;
  if (Buffer.isBuffer(body)) return new Uint8Array(body);
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

function copyRequestHeaders(req: ExpressRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else headers.set(key, value);
  }
  return headers;
}

export async function mountDevApi(app: Express): Promise<void> {
  let routes: ApiRoute[] = [];
  try {
    routes = await discover(API_DIR);
  } catch (error) {
    console.warn("[dev-api] could not read api/: ", error);
    return;
  }

  const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
  let mounted = 0;
  for (const { route, file } of routes) {
    let module: Record<string, unknown>;
    try {
      module = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    } catch (error) {
      console.warn(
        `[dev-api] skipped ${route}:`,
        error instanceof Error ? error.message : error
      );
      continue;
    }

    // Vercel routes use either a default handler or named method exports.
    const exported = METHODS.filter((method) => typeof module[method] === "function");
    if (typeof module.default !== "function" && exported.length === 0) continue;

    app.all(route, async (req, res) => {
      const handler =
        (module[req.method] as WebHandler | undefined) ??
        (module.default as WebHandler | undefined);
      if (!handler) {
        res.status(405).json({ error: "method_not_allowed" });
        return;
      }
      try {
        const origin = `${req.protocol}://${req.get("host") ?? "localhost:3000"}`;
        const init: RequestInit = {
          method: req.method,
          headers: copyRequestHeaders(req),
        };
        const body = requestBody(req);
        if (body !== undefined) init.body = body;

        const response = await handler(
          new Request(`${origin}${req.originalUrl}`, init)
        );

        res.status(response.status);
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === "set-cookie") return;
          res.setHeader(key, value);
        });
        const cookies = (
          response.headers as Headers & { getSetCookie?: () => string[] }
        ).getSetCookie?.();
        if (cookies?.length) res.setHeader("set-cookie", cookies);

        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        console.error(`[dev-api] ${route} failed`, error);
        res.status(500).json({
          error: "dev_api_error",
          message: "The local API bridge failed. Check the dev server log.",
        });
      }
    });
    mounted += 1;
  }

  console.log(`[dev-api] mounted ${mounted} local API route(s)`);
}

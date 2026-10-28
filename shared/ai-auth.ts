/**
 * Who is calling the AI routes, and what may they see?
 *
 * The assistant is available to every signed-in member of staff, which means
 * every request arrives from a browser with a bearer token that has to be
 * resolved before anything is answered. The role is then derived from the
 * caller's immutable user id — never from the role the request claims for
 * itself.
 *
 * That last part is the whole point. The client sends `role` and a list of
 * visible screens in every request, and a client is not a trust boundary: a
 * teacher could set both to `super_admin` in the console and would get the
 * school ledger if the server believed them. So the request's own claim is read
 * only as a hint for the UI, and the authoritative role is the one resolved
 * here from the session token.
 *
 * `effectiveRole` is used rather than the stored column so the super admin is
 * recognised by his id however the database spells the role today.
 */

import { effectiveRole, isSuperAdminId } from "./super-admin.js";

type Json = Record<string, unknown>;

export const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://fmlwzxmjrecbtvgraqqm.supabase.co";

export const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || "";

export const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_Y1oStHbYHErfX2FD6xyKeg_PXuUcQ1w";

export interface Caller {
  id: string;
  email: string;
  role: string;
  superAdmin: boolean;
}

/**
 * Pull the bearer token off a request, or null when there isn't one.
 *
 * `headers` arrives as a `Headers` object when the route is bundled for the
 * Web-style runtime and as a plain object when Node's own request object is
 * handed through. Calling `.get()` on the latter throws, and it took the portal
 * account API down in production while it worked everywhere else. Both shapes
 * are read here so a route behaves the same whichever way it is invoked.
 */
export function bearerToken(req: Request | { headers?: unknown }): string | null {
  const raw = (req as { headers?: unknown })?.headers;
  const header =
    typeof (raw as Headers)?.get === "function"
      ? String((raw as Headers).get("authorization") ?? "")
      : String(
          (raw as Record<string, unknown> | undefined)?.["authorization"] ??
            (raw as Record<string, unknown> | undefined)?.["Authorization"] ??
            "",
        );
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : "";
  return token || null;
}

/**
 * Resolve the caller and their real role, or null if the token is missing,
 * expired or unknown.
 *
 * The token is checked against Supabase's own auth endpoint rather than
 * decoded locally: verifying the signature is the provider's job, and a
 * hand-rolled JWT parse would be the classic place for an auth bypass to hide.
 */
export async function resolveCaller(req: Request | { headers?: unknown }): Promise<Caller | null> {
  const token = bearerToken(req);
  if (!token) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string; email?: string };
    if (!user?.id) return null;

    let storedRole = "";
    const key = SERVICE_KEY || token;
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,role&id=eq.${user.id}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (profileRes.ok) {
      const rows = (await profileRes.json()) as Json[];
      storedRole = String(rows?.[0]?.role ?? "");
    }

    return {
      id: user.id,
      email: String(user.email ?? ""),
      role: effectiveRole(user.id, storedRole),
      superAdmin: isSuperAdminId(user.id),
    };
  } catch {
    return null;
  }
}
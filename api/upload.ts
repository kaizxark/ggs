export const config = { runtime: "edge" };

import { resolveCaller } from "../shared/ai-auth.js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://fmlwzxmjrecbtvgraqqm.supabase.co";

/*
 * The storage key is read from the environment only.
 *
 * This file used to carry a live `sb_secret_…` fallback, which meant the
 * service-role credential — the one that bypasses every row-level security
 * policy — was published in the repository and its history. A secret in source
 * is not a fallback, it is a leak; a missing key must fail loudly instead.
 */
const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || "";

export const BUCKET = "school-assets";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * The only file types a profile photo may be.
 *
 * The route writes to a public bucket, so the content type is an allow-list
 * rather than whatever the uploader claims. SVG is deliberately absent: it can
 * carry script and the bucket serves it inline.
 */
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function fail(message: string, status = 400, code = "error") {
  return Response.json({ error: code, message }, { status });
}

function decodeBase64(value: string): ArrayBuffer | null {
  try {
    const clean = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
    if (!/^[A-Za-z0-9+/=\s]+$/.test(clean)) return null;
    const bin = atob(clean.replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer as ArrayBuffer;
  } catch {
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    // Same-origin only: no Access-Control-Allow-Origin is sent, so a foreign
    // page cannot use a signed-in visitor's browser as an upload proxy.
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return fail("Method not allowed", 405, "method_not_allowed");
  }

  if (!SERVICE_KEY) {
    return fail(
      "Uploads are not configured on this deployment.",
      503,
      "not_configured"
    );
  }

  // A session is required. The route writes to a public bucket with the
  // service key, so an anonymous caller must never reach the storage call.
  const caller = await resolveCaller(req);
  if (!caller) {
    return fail("Sign in to upload a photo.", 401, "unauthenticated");
  }

  let bytes: ArrayBuffer | null = null;
  let folder = "avatars";
  let contentType = "image/jpeg";
  let fileName = "avatar.jpg";

  const reqType = req.headers.get("content-type") || "";

  if (reqType.includes("multipart/form-data")) {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return fail("No file provided", 400, "bad_request");
      bytes = await file.arrayBuffer();
      folder = (formData.get("folder") as string) || folder;
      contentType = file.type || contentType;
      fileName = file.name || fileName;
    } catch {
      return fail("Failed to parse form data", 400, "bad_request");
    }
  } else {
    try {
      const body = (await req.json()) as {
        data?: string;
        folder?: string;
        contentType?: string;
        fileName?: string;
      };
      if (!body.data) return fail("Missing file data", 400, "bad_request");
      bytes = decodeBase64(body.data);
      if (body.folder) folder = body.folder;
      if (body.contentType) contentType = body.contentType;
      if (body.fileName) fileName = body.fileName;
    } catch {
      return fail("Invalid JSON payload", 400, "bad_request");
    }
  }

  if (!bytes || bytes.byteLength === 0) {
    return fail("File is empty or corrupted", 400, "invalid_file");
  }

  if (bytes.byteLength > MAX_BYTES) {
    return fail("File exceeds 5 MB limit", 400, "file_too_large");
  }

  if (!ALLOWED_TYPES.has(contentType.toLowerCase())) {
    return fail("Only PNG, JPEG and WebP images are accepted", 400, "invalid_type");
  }

  const ext =
    contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : ".jpg";
  // Folder segments are limited to safe characters; `student-avatars/<id>` is
  // two segments and anything deeper or stranger collapses to `avatars`.
  const segments = String(folder ?? "")
    .split("/")
    .map(segment => segment.replace(/[^a-zA-Z0-9_-]/g, ""))
    .filter(Boolean)
    .slice(0, 2);
  const safeFolder =
    segments.length && /^(avatars|staff-avatars|student-avatars|photos)$/.test(segments[0])
      ? segments.join("/")
      : "avatars";
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${safeFolder}/${stamp}${ext}`;

  const serviceHeaders = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };

  let res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      ...serviceHeaders,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });

  if (res.status === 404) {
    // Attempt bucket creation if not present
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...serviceHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });

    res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        ...serviceHeaders,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return fail(`Storage error (${res.status}): ${detail.slice(0, 160)}`, 502, "storage_error");
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  return Response.json({
    ok: true,
    url: publicUrl,
    path,
  });
}

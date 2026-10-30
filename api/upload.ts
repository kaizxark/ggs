export const config = { runtime: "edge" };

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "REDACTED-SUPABASE-SECRET-KEY";
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_Y1oStHbYHErfX2FD6xyKeg_PXuVcQ1w";

export const BUCKET = "school-assets";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

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
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return fail("Method not allowed", 405, "method_not_allowed");
  }

  // Authentication check - optional bearer validation
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token) {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!authRes.ok) {
      return fail("Session expired. Please sign in again.", 401, "unauthenticated");
    }
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

  const ext = fileName.includes(".") ? `.${fileName.split(".").pop()}` : ".jpg";
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "") || "avatars";
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

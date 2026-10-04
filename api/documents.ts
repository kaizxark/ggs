/**
 * Student documents.
 *
 * Each student's file cabinet lives in a private Supabase Storage bucket rather
 * than in a table. There is no `student_documents` table in this project and no
 * migration can be run from here, so the metadata is encoded into the object
 * path instead:
 *
 *     <studentId>/<docType>__<issuedAt>__<safeFileName>
 *
 *     4f2c…-…/aadhaar__20261002T221145Z__aadhaar-priya.pdf
 *
 * The split marker is a double underscore, which the sanitiser below forbids in
 * a filename, so the three parts can always be recovered unambiguously.
 *
 * Everything about an Aadhaar card is sensitive, so this route is restricted to
 * admins. Downloads are never served from a public URL — the bucket is private
 * and the browser is handed a short-lived signed link instead.
 */

export const config = { runtime: "edge" };

import { effectiveRole, isSuperAdminId } from "../shared/super-admin";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_Y1oStHbYHErfX2FD6xyKeg_PXuVcQ1w";

export const BUCKET = "student-documents";

/** Roles allowed to read or write a child's identity documents. */
const ALLOWED_ROLES = new Set(["super_admin", "admin"]);

/**
 * Map this route's document types onto the category vocabulary stored in
 * `public.student_documents`.
 *
 * The two lists are deliberately different. The slugs below are what the
 * existing UI and the object-path convention use, and they predate the table;
 * the categories are the constrained vocabulary the database accepts. An
 * explicit map between them is better than making either side match the other:
 * renaming a slug would orphan every file already in the bucket, and widening
 * the CHECK constraint to whatever slug arrives would make "how many birth
 * certificates are missing?" unanswerable.
 *
 * Anything unrecognised is filed as `other`, which keeps the file visible in the
 * cabinet rather than dropping it.
 */
export const DOC_CATEGORY: Record<string, string> = {
  "birth-certificate": "birth_certificate",
  "transfer-certificate": "transfer_certificate",
  "previous-school": "previous_school_record",
  "admission-form": "admission_form",
  aadhaar: "identity_document",
  "parent-consent": "parent_consent",
  immunisation: "medical_certificate",
  medical: "medical_certificate",
  photo: "photograph",
  "address-proof": "address_proof",
  passport: "other",
  "caste-income": "other",
  "marks-card": "other",
  "hall-ticket": "other",
};

export function categoryFor(docType: string): string {
  return DOC_CATEGORY[docType] ?? "other";
}

const MARKER = "__";

/** Uploader-controlled, so it is restricted to characters storage accepts. */
export const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const DOC_TYPE_PATTERN = /^[a-z][a-z0-9_-]{1,39}$/;

/** PDFs and the three image formats a phone camera actually produces. */
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/** Matches the bucket's own 10 MB limit, so the browser can fail fast too. */
export const MAX_BYTES = 10 * 1024 * 1024;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** PostgREST call on the service key. Returns [] rather than throwing on failure. */
async function restJson<T = Json[]>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) return [] as unknown as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : []) as T;
  } catch {
    return [] as unknown as T;
  }
}

/**
 * The pupil's organisation, read from the pupil's own row.
 *
 * Every metadata write is scoped by it. Without this a document row could be
 * attached to the wrong school, because the service key bypasses RLS and nothing
 * else in this route is organisation-scoped.
 */
async function organisationOf(studentId: string): Promise<string | null> {
  if (!STUDENT_ID_PATTERN.test(studentId)) return null;
  const rows = await restJson<Json[]>(
    `students?select=organisation_id&id=eq.${studentId}&limit=1`
  );
  const org = rows[0]?.organisation_id;
  return org ? String(org) : null;
}

export type Json = Record<string, unknown>;

function fail(message: string, status: number, code = "error") {
  return Response.json({ error: code, message }, { status });
}

/** Resolve the caller and confirm they are allowed to touch documents. */
async function authorize(req: Request): Promise<
  | { ok: true; id: string; isSuperAdmin: boolean }
  | { ok: false; response: Response }
> {
  const token = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    ""
  );
  if (!token) {
    return {
      ok: false,
      response: fail("Sign in to manage student documents.", 401, "unauthenticated"),
    };
  }

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!authRes.ok) {
    return {
      ok: false,
      response: fail("Your session has expired. Sign in again.", 401, "unauthenticated"),
    };
  }
  const user = (await authRes.json()) as { id?: string };
  if (!user?.id) {
    return {
      ok: false,
      response: fail("Your session has expired. Sign in again.", 401, "unauthenticated"),
    };
  }

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,role&id=eq.${user.id}&limit=1`,
    {
      headers: {
        apikey: SERVICE_KEY || ANON_KEY,
        Authorization: `Bearer ${SERVICE_KEY || token}`,
      },
    }
  );
  const rows = (await profileRes.json()) as { role?: string }[];

  /*
   * Derived from the caller's id rather than read from the row, so the super
   * admin is admitted on the strength of who he is and not on whatever the
   * `app_role` column currently says. That column cannot even hold
   * "super_admin" yet, and reading it raw would have locked him out of his own
   * pupils' Aadhaar copies.
   */
  const role = effectiveRole(user.id, rows?.[0]?.role);

  if (!ALLOWED_ROLES.has(role)) {
    // Deliberately not "forbidden" wording about which roles exist.
    return {
      ok: false,
      response: fail(
        "Only an administrator can open student documents.",
        403,
        "forbidden"
      ),
    };
  }
  return { ok: true, id: user.id, isSuperAdmin: isSuperAdminId(user.id) };
}

/**
 * Make an arbitrary upload safe to put in a path segment.
 *
 * Strips directory separators so a filename cannot climb out of the student's
 * prefix, drops the characters that would collide with our own path grammar,
 * and falls back to "document" when nothing usable survives.
 */
export function safeFileName(name: string): string {
  const base = String(name ?? "")
    .split(/[\\/]/)
    .pop()!
    .normalize("NFKD")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\w.\- ]+/g, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.\-]+/, "")
    .trim();
  const cleaned = base.slice(0, 80);
  return cleaned || "document";
}

/** Compact, sortable timestamp: 20261002T221145Z. */
export function stamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

/** Reverse of the path convention, tolerant of a malformed object. */
export function parseKey(name: string): {
  docType: string;
  issuedAt: string | null;
  fileName: string;
} {
  const [docType, issuedAt, ...rest] = name.split(MARKER);
  return {
    docType: docType ?? "other",
    issuedAt: issuedAt ?? null,
    fileName: rest.join(MARKER) || name,
  };
}

/**
 * Decode an upload into an ArrayBuffer.
 *
 * An ArrayBuffer rather than a Uint8Array because that is what fetch accepts as
 * a body under the lib set the functions build uses; a Uint8Array does not
 * satisfy BodyInit there.
 */
function decodeBase64(value: string): ArrayBuffer | null {
  try {
    // Accept both a bare payload and a data: URL, which is what FileReader gives.
    const base64 = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
    if (!/^[A-Za-z0-9+/=\s]+$/.test(base64)) return null;
    const binary = atob(base64.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer as ArrayBuffer;
  } catch {
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (!SERVICE_KEY) {
    return fail(
      "Document storage is not configured on this deployment (SUPABASE_SECRET_KEY is missing).",
      503,
      "not_configured"
    );
  }

  const auth = await authorize(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const serviceHeaders = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };

  /* ---------------------------------------------------------------- *
   * Download — hand back a short-lived signed link
   * ---------------------------------------------------------------- */
  if (req.method === "GET" && url.searchParams.get("download")) {
    const studentId = url.searchParams.get("studentId") ?? "";
    const file = url.searchParams.get("file") ?? "";
    if (!STUDENT_ID_PATTERN.test(studentId) || !file || file.includes("/")) {
      return fail("That document could not be found.", 404, "not_found");
    }
    const key = `${BUCKET}/${studentId}/${file}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${key}`, {
      method: "POST",
      headers: { ...serviceHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 300 }),
    });
    if (!res.ok) return fail("That document could not be found.", 404, "not_found");
    const { signedURL } = (await res.json()) as { signedURL?: string };
    if (!signedURL) return fail("That document could not be found.", 404, "not_found");
    // Five minutes is long enough to open a PDF and far too short to share.
    return Response.json({ url: `${SUPABASE_URL}/storage/v1${signedURL}` });
  }

  /* ---------------------------------------------------------------- *
   * Coverage for several students at once
   *
   * The Documents view needs this for a whole page of students. Asking storage
   * once per student from the browser would be twenty round trips per page; one
   * request here keeps it to one. Only the counts and the gaps come back, never
   * a filename, so the summary carries no document contents with it.
   * ---------------------------------------------------------------- */
  if (req.method === "GET" && url.searchParams.get("coverage")) {
    const ids = String(url.searchParams.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => STUDENT_ID_PATTERN.test(id))
      .slice(0, 60);

    const REQUIRED = ["marks-card", "hall-ticket", "birth-certificate"];

    const entries = await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(
          `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
          {
            method: "POST",
            headers: { ...serviceHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ prefix: `${id}/`, limit: 200 }),
          }
        );
        if (!res.ok) return [id, { have: 0, required: REQUIRED.length, missing: REQUIRED }] as const;
        const objects = (await res.json()) as { name?: string }[];
        const held = new Set(
          (Array.isArray(objects) ? objects : [])
            .map((object) => parseKey(String(object.name ?? "")).docType)
        );
        return [
          id,
          {
            have: REQUIRED.length - REQUIRED.filter((type) => !held.has(type)).length,
            required: REQUIRED.length,
            missing: REQUIRED.filter((type) => !held.has(type)),
          },
        ] as const;
      })
    );

    return Response.json({ coverage: Object.fromEntries(entries) });
  }

  /* ---------------------------------------------------------------- *
   * List
   * ---------------------------------------------------------------- */
  if (req.method === "GET") {
    const studentId = url.searchParams.get("studentId") ?? "";
    if (!STUDENT_ID_PATTERN.test(studentId)) {
      return fail("That student could not be found.", 400, "bad_student");
    }
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
      {
        method: "POST",
        headers: { ...serviceHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: `${studentId}/`, limit: 200 }),
      }
    );
    if (res.status === 404) return Response.json({ documents: [] });
    if (!res.ok) return fail("Could not read this student's documents.", 502, "storage_error");

    const objects = (await res.json()) as {
      name?: string;
      updated_at?: string;
      created_at?: string;
      metadata?: { size?: number; mimetype?: string; contentLength?: number };
    }[];

    const documents = (Array.isArray(objects) ? objects : [])
      .map((object) => {
        const parsed = parseKey(String(object.name ?? ""));
        return {
          docType: parsed.docType,
          fileName: parsed.fileName,
          // The path timestamp is the issue date; storage's own is only a
          // fallback for objects uploaded before this convention existed.
          issuedAt: parsed.issuedAt,
          updatedAt: object.updated_at ?? null,
          sizeBytes: Number(
            object.metadata?.size ?? object.metadata?.contentLength ?? 0
          ),
          contentType: String(object.metadata?.mimetype ?? ""),
          key: `${studentId}/${object.name}`,
        };
      })
      .sort((a, b) => String(b.issuedAt ?? "").localeCompare(String(a.issuedAt ?? "")));

    return Response.json({ documents });
  }

  /* ---------------------------------------------------------------- *
   * Upload
   * ---------------------------------------------------------------- */
  if (req.method === "POST") {
    let body: Json;
    try {
      body = (await req.json()) as Json;
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const studentId = String(body.studentId ?? "");
    const docType = String(body.docType ?? "");
    const fileName = String(body.fileName ?? "");
    const contentType = String(body.contentType ?? "");

    if (!STUDENT_ID_PATTERN.test(studentId)) {
      return fail("That student could not be found.", 400, "bad_student");
    }
    if (!DOC_TYPE_PATTERN.test(docType)) {
      return fail("Unknown document type.", 400, "bad_type");
    }
    if (!ALLOWED_TYPES.has(contentType)) {
      return fail(
        "Upload a PDF, PNG, JPEG or WebP file.",
        400,
        "bad_type"
      );
    }

    const bytes = decodeBase64(String(body.data ?? ""));
    if (!bytes || bytes.byteLength === 0) {
      return fail("That file could not be read.", 400, "bad_file");
    }
    if (bytes.byteLength > MAX_BYTES) {
      return fail("That file is larger than 10 MB.", 400, "too_large");
    }

    // One file per type per student: an older card is replaced, not stacked.
    // The listing is cheap and this keeps the drawer readable.
    const existing = await fetch(
      `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
      {
        method: "POST",
        headers: { ...serviceHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: `${studentId}/${docType}${MARKER}`, limit: 50 }),
      }
    )
      .then((r) => (r.ok ? (r.json() as Promise<{ name?: string }[]>) : []))
      .catch(() => [] as { name?: string }[]);

    const path = `${studentId}/${docType}${MARKER}${stamp()}${MARKER}${safeFileName(fileName)}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        ...serviceHeaders,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return fail(
        `The file could not be stored (${res.status}). ${detail.slice(0, 160)}`,
        502,
        "storage_error"
      );
    }

    // Best effort: superseded versions are removed only after the new file is
    // safely in place, so a failed upload never leaves the record empty.
    await Promise.all(
      (Array.isArray(existing) ? existing : [])
        .filter((object) => object?.name && `${object.name}` !== path.slice(studentId.length + 1))
        .map((object) =>
          fetch(
            `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${studentId}/${object.name}`,
            { method: "DELETE", headers: serviceHeaders }
          ).catch(() => null)
        )
    );

    /*
     * Record the metadata alongside the bytes.
     *
     * The object is already safely in storage by this point, so this write is
     * additive: if it fails the file is still downloadable through the storage
     * listing and nothing the user did is lost. The previous version of this
     * row is kept with `is_current = false` rather than deleted, which is what
     * makes version history answerable — “which document replaced this, and
     * when” — without keeping every superseded file.
     */
    const objectPath = `${studentId}/${path.slice(studentId.length + 1)}`;
    const category = categoryFor(docType);
    const orgId = await organisationOf(studentId);
    let metadataId: string | null = null;

    if (orgId) {
      const current = await restJson<Json[]>(
        `student_documents?select=id,version&organisation_id=eq.${orgId}` +
          `&student_id=eq.${studentId}&category=eq.${category}&is_current=eq.true&limit=1`
      ).catch(() => [] as Json[]);

      const nextVersion = current.length ? Number(current[0].version ?? 1) + 1 : 1;
      const previousId = current.length ? String(current[0].id) : null;

      // Retire the old row first so the partial unique index on
      // (student_id, category) where is_current cannot be violated by the
      // insert that follows.
      if (previousId) {
        await restJson(`student_documents?id=eq.${previousId}`, {
          method: "PATCH",
          body: JSON.stringify({ is_current: false }),
        }).catch(() => null);
      }

      const inserted = await restJson<Json[]>("student_documents", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          organisation_id: orgId,
          student_id: studentId,
          category,
          title: `${docType.replace(/-/g, " ")} — ${safeFileName(fileName)}`,
          file_path: objectPath,
          file_name: safeFileName(fileName),
          content_type: contentType,
          size_bytes: bytes.byteLength,
          issued_on: isoToday(),
          uploaded_by: auth.id,
          verification_status: "pending",
          version: nextVersion,
          supersedes_id: previousId,
          is_current: true,
        }),
      }).catch(() => [] as Json[]);

      metadataId = inserted.length ? String(inserted[0].id) : null;
    }

    return Response.json({
      ok: true,
      document: {
        id: metadataId,
        docType,
        category,
        fileName: safeFileName(fileName),
        issuedAt: stamp(),
        sizeBytes: bytes.byteLength,
        contentType,
        key: objectPath,
      },
    });
  }

  /* ---------------------------------------------------------------- *
   * Verification — mark a document checked, or rejected with a reason
   * ---------------------------------------------------------------- */
  if (req.method === "PATCH") {
    let body: Json;
    try {
      body = (await req.json()) as Json;
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    const documentId = String(body.documentId ?? "");
    const status = String(body.verification_status ?? "");
    const orgId = await organisationOf(String(body.studentId ?? ""));

    if (!documentId || !UUID.test(documentId) || !orgId) {
      return fail("That document could not be found.", 404, "not_found");
    }

    if (["verified", "rejected"].indexOf(status) === -1) {
      return fail("That verification status is not recognised.", 400, "bad_status");
    }

    // A rejection with no reason is not actionable for the family, so the
    // database's own CHECK constraint is mirrored here to give a clear message.
    const reason = String(body.rejection_reason ?? "").trim().slice(0, 300);
    if (status === "rejected" && !reason) {
      return fail("Give a reason so the family knows what to fix.", 400, "reason_required");
    }

    const updated = await restJson<Json[]>(
      `student_documents?id=eq.${documentId}&organisation_id=eq.${orgId}&is_current=eq.true`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          verification_status: status,
          verified_by: auth.id,
          verified_on: isoToday(),
          rejection_reason: status === "rejected" ? reason : null,
          remarks: String(body.remarks ?? "").trim().slice(0, 500) || null,
        }),
      }
    ).catch(() => [] as Json[]);

    if (!updated.length) {
      return fail("That document could not be found.", 404, "not_found");
    }

    return Response.json({ ok: true, document: updated[0] });
  }

  /* ---------------------------------------------------------------- *
   * Delete
   * ---------------------------------------------------------------- */
  if (req.method === "DELETE") {
    let body: Json;
    try {
      body = (await req.json()) as Json;
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const studentId = String(body.studentId ?? "");
    const file = String(body.file ?? "");
    if (!STUDENT_ID_PATTERN.test(studentId) || !file || file.includes("/")) {
      return fail("That document could not be found.", 404, "not_found");
    }
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${studentId}/${file}`,
      { method: "DELETE", headers: serviceHeaders }
    );
    if (!res.ok) return fail("That document could not be found.", 404, "not_found");
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
}
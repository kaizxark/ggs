import { supabase } from "./supabase";

/**
 * Supabase Storage helper for the public `school-assets` bucket.
 *
 * Bucket layout (flat, unique names recommended):
 *   school-assets/
 *     announcements/<uuid>-<filename>
 *     student-documents/<uuid>-<filename>
 *     ...
 *
 * The bucket is created (public) by supabase/schema.sql. RLS on
 * `storage.objects` is left at Supabase defaults: only authenticated
 * users may upload, and public read is handled by the bucket policy.
 */
export const ASSETS_BUCKET = "school-assets";

function uniquePath(folder: string, file: File): string {
  const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${folder}/${stamp}${ext}`;
}

export interface UploadResult {
  path: string | null;
  url: string | null;
  error: string | null;
}

/** Upload a file to the bucket under `folder/`. Returns the stored path + public URL. */
export async function uploadAsset(
  folder: string,
  file: File,
  options?: { contentType?: string; upsert?: boolean }
): Promise<UploadResult> {
  const path = uniquePath(folder, file);
  const { error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(path, file, {
      contentType: options?.contentType ?? file.type,
      upsert: options?.upsert ?? false,
      cacheControl: "3600",
    });
  if (error) return { path: null, url: null, error: error.message };
  return { path, url: publicUrl(path), error: null };
}

/** Public (cdn) URL for a stored path. */
export function publicUrl(path: string): string {
  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Download a stored file as a blob. */
export async function downloadAsset(path: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(ASSETS_BUCKET).download(path);
  if (error) return null;
  return data;
}

/** Delete a stored file. */
export async function deleteAsset(path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(ASSETS_BUCKET).remove([path]);
  return !error;
}

/** List files under a prefix (max 100). */
export async function listAssets(prefix: string): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .list(prefix, { limit: 100 });
  if (error) return [];
  return (data ?? []).map((f) => f.name).filter((name) => !name.endsWith("/"));
}

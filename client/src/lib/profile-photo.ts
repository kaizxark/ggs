import { supabase } from "./supabase";
import { uploadAsset } from "./storage";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 512;

export function validateProfilePhoto(file: File): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return "Choose a PNG, JPEG or WebP image.";
  }
  if (file.size > MAX_BYTES) {
    return "That image is larger than 5 MB.";
  }
  return null;
}

async function squareJpeg(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const edge = Math.min(bitmap.width, bitmap.height, MAX_EDGE);
    const sourceX = Math.max(0, (bitmap.width - edge) / 2);
    const sourceY = Math.max(0, (bitmap.height - edge) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = edge;
    canvas.height = edge;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, edge, edge);
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      Math.min(bitmap.width, bitmap.height),
      Math.min(bitmap.width, bitmap.height),
      0,
      0,
      edge,
      edge
    );
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.86);
    });
    if (!blob) return file;
    return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadProfilePhoto(
  file: File,
  folder: string
): Promise<string> {
  const invalid = validateProfilePhoto(file);
  if (invalid) throw new Error(invalid);

  const prepared = await squareJpeg(file);
  const base64 = await fileToBase64(prepared);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        data: base64,
        folder,
        fileName: prepared.name,
        contentType: prepared.type,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.url) return json.url;
    }
  } catch (err) {
    console.warn("Upload through API failed, attempting storage fallback", err);
  }

  // Fallback to direct client storage helper if API call is unavailable
  const result = await uploadAsset(folder, prepared, {
    contentType: prepared.type,
  });
  if (result.url) return result.url;

  // Last-resort fallback: return data URL so the user's selected photo is never discarded
  if (base64) return base64;

  throw new Error("The photo could not be uploaded. Please try again.");
}

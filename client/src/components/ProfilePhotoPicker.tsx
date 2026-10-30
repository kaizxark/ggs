import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { initialsFor } from "@/lib/student-directory";
import { uploadProfilePhoto } from "@/lib/profile-photo";
import { toast } from "@/lib/toast";

export function ProfilePhotoPicker({
  name,
  photoUrl,
  folder,
  onChange,
  help = "PNG, JPEG or WebP. Up to 5 MB. Cropped to a square.",
}: {
  name: string;
  photoUrl: string | null;
  folder: string;
  onChange: (url: string | null) => void;
  help?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const url = await uploadProfilePhoto(file, folder);
      onChange(url);
      toast.success("Photo uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The photo could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="profile-photo-field">
      <div className="profile-photo-preview" aria-hidden={!photoUrl}>
        {photoUrl ? (
          <img src={photoUrl} alt={`${name || "Profile"} photo`} />
        ) : (
          <span>{initialsFor(name || "Profile")}</span>
        )}
      </div>

      <div className="profile-photo-copy">
        <strong>Profile photo</strong>
        <span>{help}</span>
        <div className="profile-photo-actions">
          <button
            type="button"
            className="secondary-button compact"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
          </button>
          {photoUrl && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
              disabled={uploading}
            >
              <Trash2 size={13} />
              Remove
            </button>
          )}
        </div>
        {error && <span className="field-error">{error}</span>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => void chooseFile(event)}
        hidden
      />
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Download,
  Eye,
  FileWarning,
  Lock,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { usePageScrollLock } from "@/components/SmoothScroll";
import {
  DOC_TYPES,
  REQUIRED_DOC_TYPES,
  deleteStudentDocument,
  docTypeById,
  formatBytes,
  formatIssuedAt,
  getDocumentUrl,
  listStudentDocuments,
  uploadStudentDocument,
  type StudentDocument,
} from "@/lib/student-documents";
import { toast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";

/**
 * A pupil's file cabinet, inside their profile.
 *
 * The upload, download and delete calls go through the existing
 * `client/src/lib/student-documents.ts` helpers, which already speak to
 * `/api/documents`. Nothing here duplicates that; this is the profile's
 * presentation of it, plus the verification controls that the metadata table
 * added in migration 006.
 *
 * ## Why no file is ever fetched directly
 *
 * The bucket is private, so a document has no URL until the server mints a
 * short-lived signed one for an authenticated administrator. That is why every
 * read in this panel is a click: `getDocumentUrl()` is called on demand and the
 * URL is used immediately. Nothing is preloaded, so a signed link cannot be
 * captured from the network panel while the profile sits idle.
 */

export interface DocumentPanelProps {
  studentId: string;
  studentName: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

export function DocumentPanel({ studentId, studentName }: DocumentPanelProps) {
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null);
  const [verifying, setVerifying] = useState<StudentDocument | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingType = useRef<string | null>(null);

  usePageScrollLock(Boolean(preview || verifying));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDocuments(await listStudentDocuments(studentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Documents could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const held = new Set(documents.map((d) => d.docType));
  const missing = REQUIRED_DOC_TYPES.filter((t) => !held.has(t.id));

  const open = async (doc: StudentDocument) => {
    try {
      const url = await getDocumentUrl(studentId, doc.key.split("/").slice(1).join("/"));
      // Images and PDFs preview; anything else (a DOCX, say) is handed to the
      // browser as a download rather than shown in a frame that cannot render it.
      const inline = doc.contentType === "application/pdf" || doc.contentType.startsWith("image/");
      if (inline) {
        setPreview({ url, name: doc.fileName, type: doc.contentType });
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That document could not be opened.");
    }
  };

  const pick = (docType: string) => {
    pendingType.current = docType;
    if (inputRef.current) inputRef.current.click();
  };

  const onFile = async (file: File) => {
    const docType = pendingType.current;
    pendingType.current = null;
    if (!docType) return;

    // The route enforces both of these too, but failing here saves the user
    // uploading a 40 MB photo only to be told it was too large.
    if (file.size > MAX_BYTES) {
      toast.error("That file is larger than 10 MB", { description: "Compress it or upload a scan at a lower resolution." });
      return;
    }
    if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type)) {
      toast.error("Upload a PDF, PNG, JPEG or WebP file");
      return;
    }

    const replacing = documents.find((d) => d.docType === docType);
    setUploading(docType);
    try {
      await uploadStudentDocument(studentId, docType, file);
      toast.success(replacing ? "Document replaced" : "Document uploaded", {
        description: replacing
          ? "The previous version is kept in the version history."
          : `${docTypeById(docType)?.label ?? docType} is now on file, awaiting verification.`,
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That file could not be uploaded.");
    } finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (doc: StudentDocument) => {
    try {
      await deleteStudentDocument(studentId, doc.key.split("/").slice(1).join("/"));
      toast.success("Document removed");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That document could not be removed.");
    }
  };

  if (loading) {
    return (
      <div className="panel skeleton-panel" role="status" aria-busy="true">
        <span className="sr-only">Loading documents</span>
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-line-wide" />
      </div>
    );
  }

  return (
    <div className="section-stack">
      {error && (
        <div className="notice notice-warning" role="status">
          {error}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">
            Required documents
            <span className={`chip ${missing.length === 0 ? "chip-accent" : "chip-muted"}`}>
              {REQUIRED_DOC_TYPES.length - missing.length} of {REQUIRED_DOC_TYPES.length} required on file
            </span>
          </h2>
        </div>
        {missing.length > 0 ? (
          <p className="panel-subtitle">
            Still needed: {missing.map((m) => m.label).join(", ")}.
          </p>
        ) : (
          <p className="panel-subtitle">Every required document is on file.</p>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">File cabinet</h2>
          <p className="panel-subtitle">
            Files are stored privately and opened through short-lived links. Nobody outside this school can reach them.
          </p>
        </div>

        {documents.length === 0 ? (
          <div className="empty-state">
            <ShieldAlert size={20} />
            <p className="panel-subtitle">No documents have been uploaded for {studentName} yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Category</th>
                <th>Issued</th>
                <th>Size</th>
                <th>Verification</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const type = docTypeById(doc.docType);
                return (
                  <tr key={doc.key}>
                    <td className="font-medium">{type?.label ?? doc.docType}</td>
                    <td className="muted-cell">{type?.short ?? doc.docType}</td>
                    <td>{formatIssuedAt(doc.issuedAt)}</td>
                    <td className="muted-cell">{formatBytes(doc.sizeBytes)}</td>
                    <td>
                      <span className={`status-pill ${verificationTone(doc)}`}>
                        <span className="status-dot" />
                        {verificationLabel(doc)}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="row-more" onClick={() => void open(doc)} aria-label={`Open ${doc.fileName}`}>
                          <Eye size={15} />
                        </button>
                        <button
                          className="row-more"
                          onClick={() =>
                            void getDocumentUrl(studentId, doc.key.split("/").slice(1).join("/")).then((url) => {
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = doc.fileName;
                              link.rel = "noopener";
                              link.click();
                            })
                          }
                          aria-label={`Download ${doc.fileName}`}
                        >
                          <Download size={15} />
                        </button>
                        <button
                          className="row-more"
                          onClick={() => pick(doc.docType)}
                          aria-label={`Replace ${doc.fileName}`}
                          title="Upload a newer version"
                        >
                          <Upload size={15} />
                        </button>
                        <button
                          className="row-more"
                          onClick={() => setVerifying(doc)}
                          aria-label={`Verify ${doc.fileName}`}
                          title="Record a verification decision"
                        >
                          <BadgeCheck size={15} />
                        </button>
                        <button
                          className="row-more danger"
                          onClick={() => void remove(doc)}
                          aria-label={`Remove ${doc.fileName}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h2 className="panel-title">Upload a document</h2>
        <p className="panel-subtitle">
          PDF, PNG, JPEG or WebP, up to 10 MB. Uploading the same type again replaces the current version and keeps the
          old one in the history.
        </p>
        <div className="upload-grid">
          {DOC_TYPES.map((type) => (
            <button
              key={type.id}
              className="upload-tile"
              onClick={() => pick(type.id)}
              disabled={uploading !== null}
              title={type.hint}
            >
              <span className="upload-tile-label">{type.short}</span>
              <span className="upload-tile-hint">
                {uploading === type.id ? "Uploading…" : held.has(type.id) ? "Replace" : "Upload"}
                {type.required ? " · required" : ""}
              </span>
            </button>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </div>

      {preview && (
        <div className="modal-scrim" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`}>
          <div className="modal modal-wide">
            <div className="modal-header">
              <h2 className="panel-title">{preview.name}</h2>
              <button className="secondary-button compact" onClick={() => setPreview(null)}>
                <X size={14} />
                Close
              </button>
            </div>
            <div className="preview-frame">
              {preview.type === "application/pdf" ? (
                <iframe src={preview.url} title={preview.name} />
              ) : (
                <img src={preview.url} alt={preview.name} />
              )}
            </div>
            <div className="modal-footer">
              <span className="muted-cell">This link expires in five minutes.</span>
            </div>
          </div>
        </div>
      )}

      {verifying && (
        <VerifyDialog
          document={verifying}
          studentId={studentId}
          onClose={() => setVerifying(null)}
          onDone={async () => {
            setVerifying(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

/**
 * Record a verification decision.
 *
 * A rejection cannot be saved without a reason. That is not decoration: the
 * family has to be told what to fix, and a rejection with no explanation is the
 * most common way a document request goes nowhere.
 */
function VerifyDialog({
  document: doc,
  studentId,
  onClose,
  onDone,
}: {
  document: StudentDocument;
  studentId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [status, setStatus] = useState<"verified" | "rejected">("verified");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (status === "rejected" && !reason.trim()) {
      setError("Give a reason so the family knows what to fix.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeadersFor()),
        },
        body: JSON.stringify({
          studentId,
          documentId: (doc as StudentDocument & { id?: string }).id ?? doc.key,
          verification_status: status,
          rejection_reason: reason,
          remarks,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setError(payload?.message ?? "That decision could not be saved.");
        return;
      }
      toast.success(status === "verified" ? "Document verified" : "Document rejected", {
        description:
          status === "verified"
            ? "It now counts as checked paperwork."
            : "The family can see what needs fixing.",
      });
      await onDone();
    } catch {
      setError("That decision could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Verify document">
      <div className="modal">
        <div className="modal-header">
          <h2 className="panel-title">Verify {doc.fileName}</h2>
        </div>
        <div className="modal-body">
          {error && (
            <div className="notice notice-danger" role="alert">
              <FileWarning size={15} />
              {error}
            </div>
          )}

          <div className="choice-row">
            <label className={status === "verified" ? "choice selected" : "choice"}>
              <input type="radio" name="verification" checked={status === "verified"} onChange={() => setStatus("verified")} />
              Verified
            </label>
            <label className={status === "rejected" ? "choice selected" : "choice"}>
              <input type="radio" name="verification" checked={status === "rejected"} onChange={() => setStatus("rejected")} />
              Rejected
            </label>
          </div>

          {status === "rejected" && (
            <label className="stack-label">
              What needs fixing
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </label>
          )}

          <label className="stack-label">
            Remarks
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </label>
        </div>
        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save decision"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The bearer token, for the verification call.
 *
 * `client/src/lib/student-documents.ts` has its own private copy of this for the
 * calls it owns; this file needs it once, for the PATCH that migration 006 added
 * and that library does not yet wrap.
 */
async function authHeadersFor(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

function verificationTone(doc: StudentDocument): string {
  const status = (doc as StudentDocument & { verification_status?: string }).verification_status;
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function verificationLabel(doc: StudentDocument): string {
  const status = (doc as StudentDocument & { verification_status?: string }).verification_status;
  if (status === "verified") return "Verified";
  if (status === "rejected") return "Rejected";
  return "Awaiting check";
}

/** Re-exported so the profile can show the same lock icon it uses elsewhere. */
export const DocumentLockIcon = Lock;
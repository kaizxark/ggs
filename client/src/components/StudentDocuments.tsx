import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Baby,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileSignature,
  FileText,
  FileWarning,
  Globe,
  GraduationCap,
  Loader2,
  LogOut,
  Plus,
  ShieldAlert,
  Syringe,
  Ticket,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { useRealtimeInvalidation } from "../lib/use-realtime";
import {
  DOC_TYPES,
  deleteStudentDocument,
  docTypeById,
  documentDisplayTitle,
  formatBytes,
  formatIssuedAt,
  getDocumentUrl,
  listStudentDocuments,
  uploadStudentDocument,
  type DocType,
  type StudentDocument,
} from "../lib/student-documents";

const ICONS: Record<DocType["icon"], React.ElementType> = {
  "id-card": CreditCard,
  award: GraduationCap,
  ticket: Ticket,
  baby: Baby,
  "file-text": FileText,
  "log-out": LogOut,
  syringe: Syringe,
  globe: Globe,
};

const QUICK_TITLE_SUGGESTIONS = [
  "Medical Fitness Certificate",
  "Passport / Visa",
  "Conduct Certificate",
  "Sports Merit Award",
  "Migration Certificate",
  "Affidavit / Undertaking",
];

export function DocIcon({ type, size = 16 }: { type: DocType; size?: number }) {
  const Icon = ICONS[type.icon] ?? FileText;
  return <Icon size={size} />;
}

export interface StudentDocumentsPanelProps {
  studentId: string;
  studentName: string;
  confirmDelete?: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024;

export function StudentDocumentsPanel({
  studentId,
  studentName,
  confirmDelete = true,
}: StudentDocumentsPanelProps) {
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; title: string; type: string } | null>(null);

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setDocuments(await listStudentDocuments(studentId));
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Could not load documents."
      );
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const realtimeRevision = useRealtimeInvalidation(["student_documents"]);
  useEffect(() => {
    if (realtimeRevision > 0) void load();
  }, [realtimeRevision, load]);

  const byType = useMemo(() => new Map(documents.map((doc) => [doc.docType, doc])), [documents]);
  const coreHeldCount = DOC_TYPES.filter((t) => byType.has(t.id)).length;
  const otherDocs = useMemo(() => documents.filter((doc) => !DOC_TYPES.some((t) => t.id === doc.docType)), [documents]);

  const pick = (docType: string) => {
    inputs.current[docType]?.click();
  };

  const onCoreFile = async (docType: string, file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("File is larger than 10 MB", { description: "Please upload a smaller scan." });
      return;
    }
    if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type)) {
      toast.error("Please upload a PDF, PNG, JPEG or WebP file.");
      return;
    }

    setBusyType(docType);
    try {
      const saved = await uploadStudentDocument(studentId, docType, file);
      setDocuments((current) => [
        saved,
        ...current.filter((doc) => doc.key !== saved.key && doc.docType !== docType),
      ]);
      toast.success(`${docTypeById(docType)?.short ?? "Document"} saved`, {
        description: `${file.name} · ${formatBytes(saved.sizeBytes)}`,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "That file could not be uploaded."
      );
    } finally {
      setBusyType(null);
      const input = inputs.current[docType];
      if (input) input.value = "";
    }
  };

  const view = async (doc: StudentDocument) => {
    const file = doc.key.split("/").slice(1).join("/");
    try {
      const url = await getDocumentUrl(studentId, file);
      const isInline = doc.contentType === "application/pdf" || doc.contentType.startsWith("image/");
      if (isInline) {
        setPreview({
          url,
          name: doc.fileName,
          title: documentDisplayTitle(doc),
          type: doc.contentType,
        });
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "That document could not be opened."
      );
    }
  };

  const download = async (doc: StudentDocument) => {
    const file = doc.key.split("/").slice(1).join("/");
    try {
      const url = await getDocumentUrl(studentId, file);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download request failed.");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "That document could not be downloaded."
      );
    }
  };

  const remove = async (doc: StudentDocument) => {
    const title = documentDisplayTitle(doc);
    if (confirmDelete) {
      const ok = window.confirm(
        `Remove ${title} (${doc.fileName}) for ${studentName}?`
      );
      if (!ok) return;
    }
    setBusyType(doc.docType);
    try {
      const file = doc.key.split("/").slice(1).join("/");
      await deleteStudentDocument(studentId, file);
      setDocuments((current) => current.filter((item) => item.key !== doc.key));
      toast.success(`${title} removed`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "That document could not be removed."
      );
    } finally {
      setBusyType(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header status bar with segmented compliance progress */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "12px 14px",
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 650, color: "var(--text-primary)", fontSize: "13px" }}>
            Core Documents Compliance
          </span>
          <span className={`status-pill ${coreHeldCount === DOC_TYPES.length ? "success" : "brand"}`} style={{ fontSize: "11px" }}>
            {coreHeldCount} of {DOC_TYPES.length} on file
          </span>
        </div>

        {/* 4-segment mini progress bar */}
        <div style={{ display: "flex", gap: "4px", height: "4px", width: "100%" }}>
          {DOC_TYPES.map((t) => {
            const isHeld = byType.has(t.id);
            return (
              <div
                key={t.id}
                style={{
                  flex: 1,
                  height: "100%",
                  borderRadius: "2px",
                  background: isHeld ? "var(--success)" : "var(--border-strong)",
                  transition: "background 0.2s ease",
                }}
              />
            );
          })}
        </div>
      </div>

      {loadError && (
        <div className="doc-notice">
          <AlertCircle size={15} />
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="doc-empty">
          <Loader2 size={18} className="animate-spin" />
          <span>Loading documents for {studentName}…</span>
        </div>
      ) : (
        <>
          {/* Section 1: Default 4 Core Documents */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
              Core Documents
            </span>

            <div className="doc-list">
              {DOC_TYPES.map((type) => {
                const held = byType.get(type.id);
                const busy = busyType === type.id;
                const isHeld = Boolean(held);
                const isVerified = held?.verification_status === "verified";

                return (
                  <div
                    className={`doc-row ${isHeld ? "held" : ""}`}
                    key={type.id}
                    style={{
                      borderStyle: isHeld ? "solid" : "dashed",
                      background: isHeld ? "var(--bg-panel)" : "var(--bg-input)",
                    }}
                  >
                    <span className={`doc-icon ${isHeld ? "held" : ""}`}>
                      <DocIcon type={type} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="doc-name">
                        <span>{type.label}</span>
                        {isHeld && (
                          <CheckCircle2
                            size={13}
                            className="doc-onfile"
                            style={{ color: isVerified ? "var(--success)" : "var(--brand)" }}
                          />
                        )}
                      </div>
                      <div className="doc-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {isHeld ? (
                          <>
                            <span>{held!.fileName}</span>
                            <span style={{ color: "var(--text-muted)" }}> · {formatBytes(held!.sizeBytes)}</span>
                          </>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Not on file · Required</span>
                        )}
                      </div>
                    </div>

                    <div className="doc-actions">
                      {isHeld ? (
                        <>
                          <button
                            type="button"
                            className="doc-icon-button"
                            onClick={() => void view(held!)}
                            aria-label={`Preview ${type.short}`}
                            title="Preview"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            className="doc-icon-button"
                            onClick={() => void download(held!)}
                            aria-label={`Download ${held!.fileName}`}
                            title="Download"
                          >
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            className="doc-icon-button"
                            onClick={() => pick(type.id)}
                            disabled={busy}
                            aria-label={`Replace ${type.short}`}
                            title="Replace document"
                          >
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={13} />}
                          </button>
                          <button
                            type="button"
                            className="doc-icon-button danger"
                            onClick={() => void remove(held!)}
                            disabled={busy}
                            aria-label={`Remove ${type.short}`}
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="tiny-action"
                          onClick={() => pick(type.id)}
                          disabled={busy}
                          style={{ padding: "4px 8px", fontSize: "11.5px" }}
                        >
                          {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                          Upload
                        </button>
                      )}
                    </div>

                    <input
                      ref={(node) => {
                        inputs.current[type.id] = node;
                      }}
                      type="file"
                      className="hidden"
                      accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
                      onChange={(event) =>
                        void onCoreFile(type.id, event.target.files?.[0])
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Additional Documents */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                Additional Documents ({otherDocs.length})
              </span>
              <button
                type="button"
                className="tiny-action"
                onClick={() => setShowOtherModal(true)}
                style={{ fontSize: "11.5px" }}
              >
                <Plus size={12} /> Upload other file
              </button>
            </div>

            {otherDocs.length === 0 ? (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px dashed var(--border)",
                  textAlign: "center",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  background: "var(--bg-subtle)",
                }}
              >
                No additional certificates uploaded. Click "+ Upload other file" to add custom files.
              </div>
            ) : (
              <div className="doc-list">
                {otherDocs.map((doc) => {
                  const busy = busyType === doc.docType;
                  const displayTitle = documentDisplayTitle(doc);

                  return (
                    <div className="doc-row held" key={doc.key}>
                      <span className="doc-icon held">
                        <FileText size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="doc-name">
                          <span>{displayTitle}</span>
                          <CheckCircle2 size={13} className="doc-onfile" />
                        </div>
                        <div className="doc-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span>{doc.fileName}</span>
                          <span style={{ color: "var(--text-muted)" }}> · {formatBytes(doc.sizeBytes)}</span>
                        </div>
                      </div>
                      <div className="doc-actions">
                        <button
                          type="button"
                          className="doc-icon-button"
                          onClick={() => void view(doc)}
                          aria-label={`Preview ${displayTitle}`}
                          title="Preview"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          className="doc-icon-button"
                          onClick={() => void download(doc)}
                          aria-label={`Download ${doc.fileName}`}
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                        <button
                          type="button"
                          className="doc-icon-button danger"
                          onClick={() => void remove(doc)}
                          disabled={busy}
                          aria-label={`Remove ${displayTitle}`}
                          title="Remove"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Upload Other File Dialog with quick suggestions */}
      {showOtherModal && (
        <DrawerUploadOtherModal
          studentId={studentId}
          studentName={studentName}
          onClose={() => setShowOtherModal(false)}
          onUploaded={async () => {
            setShowOtherModal(false);
            await load();
          }}
        />
      )}

      {/* Preview Dialog */}
      {preview && (
        <div className="modal-scrim" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`}>
          <div className="modal modal-wide">
            <div className="modal-header">
              <div>
                <h2 className="panel-title" style={{ fontSize: "14.5px" }}>{preview.title}</h2>
                <p className="panel-subtitle" style={{ fontSize: "12px", marginTop: "2px" }}>{preview.name}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="secondary-button compact"
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
                  title="Open in new window"
                >
                  <ExternalLink size={12} />
                  New Tab
                </a>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => setPreview(null)}
                >
                  <X size={14} /> Close
                </button>
              </div>
            </div>
            <div className="preview-frame">
              {preview.type === "application/pdf" ? (
                <iframe src={preview.url} title={preview.name} />
              ) : (
                <img src={preview.url} alt={preview.name} />
              )}
            </div>
            <div className="modal-footer">
              <span className="muted-cell" style={{ fontSize: "12px" }}>
                Protected link expires in five minutes.
              </span>
              <a
                href={preview.url}
                download={preview.name}
                className="primary-button compact"
                style={{ display: "inline-flex", alignItems: "center", gap: "5px", textDecoration: "none" }}
              >
                <Download size={13} /> Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Modal dialog in drawer to upload additional file with title */
function DrawerUploadOtherModal({
  studentId,
  studentName,
  onClose,
  onUploaded,
}: {
  studentId: string;
  studentName: string;
  onClose: () => void;
  onUploaded: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (picked: File) => {
    if (picked.size > MAX_BYTES) {
      setError("File is larger than 10 MB. Please compress it first.");
      return;
    }
    if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(picked.type)) {
      setError("Please select a PDF, PNG, JPEG or WebP file.");
      return;
    }
    setError(null);
    setFile(picked);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) validateAndSetFile(picked);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Please enter a title for this document.");
      return;
    }
    if (!file) {
      setError("Please pick a file to upload.");
      return;
    }

    setSaving(true);
    setError(null);

    const slug = cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const docType = `other-${(slug || "doc").slice(0, 20)}-${Date.now().toString(36)}`;

    try {
      await uploadStudentDocument(studentId, docType, file, cleanTitle);
      toast.success("Document uploaded", {
        description: `${cleanTitle} (${file.name}) added to ${studentName}'s records.`,
      });
      await onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file could not be uploaded.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Upload other file">
      <div className="modal">
        <form onSubmit={submit}>
          <div className="modal-header">
            <div>
              <h2 className="panel-title" style={{ fontSize: "14.5px" }}>Upload Additional Document</h2>
              <p className="panel-subtitle" style={{ fontSize: "11.5px" }}>For {studentName}</p>
            </div>
            <button type="button" className="secondary-button compact" onClick={onClose} disabled={saving}>
              <X size={14} />
            </button>
          </div>

          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {error && (
              <div className="notice notice-danger" role="alert">
                <FileWarning size={14} />
                {error}
              </div>
            )}

            <div>
              <label className="stack-label" style={{ margin: 0 }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "12.5px" }}>
                  Document Title <span style={{ color: "var(--brand)" }}>*</span>
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Medical Certificate, Passport, Affidavit"
                  autoFocus
                  disabled={saving}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </label>

              {/* Quick suggestions */}
              <div style={{ marginTop: "6px" }}>
                <div className="doc-suggestion-chips">
                  {QUICK_TITLE_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      className="doc-chip-btn"
                      onClick={() => setTitle(sug)}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "12.5px" }}>
                Select File <span style={{ color: "var(--brand)" }}>*</span>
              </span>

              {file ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    border: "1px solid var(--brand-border)",
                    borderRadius: "8px",
                    background: "var(--brand-soft)",
                    gap: "8px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {file.name}
                    </p>
                    <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button compact"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    disabled={saving}
                    style={{ fontSize: "11px" }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) validateAndSetFile(dropped);
                  }}
                  style={{
                    border: isDragging ? "2px dashed var(--brand)" : "1.5px dashed var(--border-strong)",
                    borderRadius: "8px",
                    padding: "18px 14px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: isDragging ? "var(--brand-soft)" : "var(--bg-subtle)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Upload size={18} style={{ margin: "0 auto 6px", color: isDragging ? "var(--brand)" : "var(--text-muted)" }} />
                  <p style={{ margin: "0 0 2px", fontSize: "12.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {isDragging ? "Drop file here" : "Select PDF, PNG, or JPEG"}
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
                    Up to 10 MB
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving || !title.trim() || !file}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {saving ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Read-only summary for the Documents index. */
export function DocumentChips({
  missing,
}: {
  missing: string[];
}) {
  if (missing.length === 0) {
    return (
      <span className="status-pill success">
        <CheckCircle2 size={12} />
        Complete
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {missing.map((id) => {
        const type = docTypeById(id);
        if (!type) return null;
        return (
          <span className="status-pill warning" key={id} title={type.hint}>
            {type.short}
          </span>
        );
      })}
    </span>
  );
}

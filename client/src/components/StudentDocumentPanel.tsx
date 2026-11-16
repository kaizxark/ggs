import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  FileWarning,
  Loader2,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { usePageScrollLock } from "@/components/SmoothScroll";
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
} from "@/lib/student-documents";
import { toast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";

export interface DocumentPanelProps {
  studentId: string;
  studentName: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function DocumentPanel({ studentId, studentName }: DocumentPanelProps) {
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; title: string; type: string } | null>(null);
  const [verifying, setVerifying] = useState<StudentDocument | null>(null);
  const [showOtherModal, setShowOtherModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingType = useRef<string | null>(null);

  usePageScrollLock(Boolean(preview || verifying || showOtherModal));

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

  const heldMap = new Map(documents.map((d) => [d.docType, d]));
  const missingCore = DOC_TYPES.filter((t) => !heldMap.has(t.id));
  const heldCoreCount = DOC_TYPES.length - missingCore.length;

  const open = async (doc: StudentDocument) => {
    try {
      const url = await getDocumentUrl(studentId, doc.key.split("/").slice(1).join("/"));
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
      toast.error(err instanceof Error ? err.message : "That document could not be opened.");
    }
  };

  const download = async (doc: StudentDocument) => {
    try {
      const url = await getDocumentUrl(studentId, doc.key.split("/").slice(1).join("/"));
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed.");
    }
  };

  const pick = (docType: string) => {
    pendingType.current = docType;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const onCoreFileSelected = async (file: File) => {
    const docType = pendingType.current;
    pendingType.current = null;
    if (!docType) return;

    if (file.size > MAX_BYTES) {
      toast.error("That file is larger than 10 MB", {
        description: "Compress it or upload a scan at a lower resolution.",
      });
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
          ? "The previous version was replaced with the latest copy."
          : `${docTypeById(docType)?.label ?? docType} is now on file.`,
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That file could not be uploaded.");
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const remove = async (doc: StudentDocument) => {
    const title = documentDisplayTitle(doc);
    if (!window.confirm(`Are you sure you want to remove ${title} (${doc.fileName})?`)) {
      return;
    }
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
      <div className="section-stack">
        <div className="panel skeleton-panel" role="status" aria-busy="true">
          <span className="sr-only">Loading documents</span>
          <div className="skeleton-line" style={{ width: "35%" }} />
          <div className="skeleton-line skeleton-line-wide" />
          <div className="skeleton-line skeleton-line-short" />
        </div>
      </div>
    );
  }

  return (
    <div className="section-stack">
      {error && (
        <div className="notice notice-warning" role="status">
          <FileWarning size={15} />
          {error}
        </div>
      )}

      {/* Panel 1: Core Documents Overview */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              Core Student Documents
              <span className={`chip ${missingCore.length === 0 ? "chip-accent" : "chip-muted"}`}>
                {heldCoreCount} of {DOC_TYPES.length} on file
              </span>
            </h2>
            <p className="panel-subtitle" style={{ marginTop: "4px" }}>
              {missingCore.length === 0 ? (
                <span style={{ color: "var(--success)", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <CheckCircle2 size={14} /> All default required paperwork (Aadhaar, Birth Certificate, Caste/Income, Transfer Certificate) is on file.
                </span>
              ) : (
                <span>
                  Mandatory school records. Still missing: <strong>{missingCore.map((m) => m.label).join(", ")}</strong>.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Core Document Action Tiles */}
        <div className="upload-grid" style={{ marginTop: "16px" }}>
          {DOC_TYPES.map((type) => {
            const held = heldMap.get(type.id);
            const isHeld = Boolean(held);
            const isBusy = uploading === type.id;
            const isVerified = held?.verification_status === "verified";
            const isRejected = held?.verification_status === "rejected";

            return (
              <div
                key={type.id}
                className="upload-tile"
                style={{
                  borderStyle: isHeld ? "solid" : "dashed",
                  borderColor: isHeld ? "var(--border-strong)" : "var(--border)",
                  background: isHeld ? "var(--bg-panel)" : "var(--bg-input)",
                  position: "relative",
                  padding: "13px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "6px" }}>
                  <span className="upload-tile-label" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    {type.short}
                    {isHeld && <CheckCircle2 size={13} style={{ color: isVerified ? "var(--success)" : "var(--brand)" }} />}
                  </span>
                  {isHeld ? (
                    <span
                      className={`status-pill ${isVerified ? "success" : isRejected ? "danger" : "brand"}`}
                      style={{ fontSize: "10.5px", padding: "1px 6px" }}
                    >
                      {isVerified ? "Verified" : isRejected ? "Rejected" : "On File"}
                    </span>
                  ) : (
                    <span className="status-pill warning" style={{ fontSize: "10.5px", padding: "1px 6px" }}>
                      Missing
                    </span>
                  )}
                </div>

                <div className="upload-tile-hint" style={{ marginTop: "4px", minHeight: "30px", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isBusy ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--brand)" }}>
                      <Loader2 size={12} className="animate-spin" /> Uploading…
                    </span>
                  ) : isHeld ? (
                    <span title={held!.fileName}>
                      {held!.fileName} · {formatBytes(held!.sizeBytes)}
                    </span>
                  ) : (
                    <span>{type.hint}</span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid var(--border-subtle)" }}>
                  {isHeld ? (
                    <>
                      <button
                        type="button"
                        className="secondary-button compact"
                        style={{ flex: 1, padding: "3px 7px", fontSize: "11.5px" }}
                        onClick={() => void open(held!)}
                        title="View document"
                      >
                        <Eye size={12} /> View
                      </button>
                      <button
                        type="button"
                        className="secondary-button compact"
                        style={{ flex: 1, padding: "3px 7px", fontSize: "11.5px" }}
                        onClick={() => pick(type.id)}
                        disabled={isBusy}
                        title="Upload new copy"
                      >
                        <Upload size={12} /> Replace
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="primary-button compact"
                      style={{ width: "100%", padding: "4px 8px", fontSize: "12px", justifyContent: "center" }}
                      onClick={() => pick(type.id)}
                      disabled={isBusy}
                    >
                      {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      Upload Document
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hidden file input for core document pickers */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onCoreFileSelected(file);
        }}
      />

      {/* Panel 2: Complete File Cabinet Table */}
      <div className="panel">
        <div
          className="panel-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h2 className="panel-title">File Cabinet</h2>
            <p className="panel-subtitle">
              All documents held for {studentName}. Files are encrypted and accessed through time-limited secure links.
            </p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowOtherModal(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={14} />
            Upload Additional Document
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="empty-state">
            <ShieldAlert size={22} />
            <p className="panel-title" style={{ marginTop: "6px" }}>No documents uploaded yet</p>
            <p className="panel-subtitle">
              Upload the core documents above or add additional certificates for this student.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document Title</th>
                  <th>Category</th>
                  <th>Issued / Uploaded</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th aria-label="Actions" style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const core = docTypeById(doc.docType);
                  const displayTitle = documentDisplayTitle(doc);
                  const tone = verificationTone(doc);
                  const vLabel = verificationLabel(doc);

                  return (
                    <tr key={doc.key}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <span
                            className="doc-icon held"
                            style={{ width: "30px", height: "30px", borderRadius: "6px", flexShrink: 0 }}
                          >
                            <FileText size={15} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "13px" }}>
                              {displayTitle}
                            </div>
                            <div className="muted-cell" style={{ fontSize: "11.5px", marginTop: "1px" }}>
                              {doc.fileName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${core ? "brand" : "neutral"}`} style={{ fontSize: "11px" }}>
                          {core ? core.short : "Additional"}
                        </span>
                      </td>
                      <td className="muted-cell" style={{ fontSize: "12px" }}>
                        {formatIssuedAt(doc.issuedAt)}
                      </td>
                      <td className="muted-cell" style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}>
                        {formatBytes(doc.sizeBytes)}
                      </td>
                      <td>
                        <span className={`status-pill ${tone}`} style={{ fontSize: "11px" }}>
                          <span className="status-dot" />
                          {vLabel}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="row-more"
                            onClick={() => void open(doc)}
                            aria-label={`Preview ${displayTitle}`}
                            title="Preview document"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="row-more"
                            onClick={() => void download(doc)}
                            aria-label={`Download ${doc.fileName}`}
                            title="Download file"
                          >
                            <Download size={14} />
                          </button>
                          {core && (
                            <button
                              type="button"
                              className="row-more"
                              onClick={() => pick(doc.docType)}
                              aria-label={`Replace ${displayTitle}`}
                              title="Upload newer version"
                            >
                              <Upload size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="row-more"
                            onClick={() => setVerifying(doc)}
                            aria-label={`Verify ${displayTitle}`}
                            title="Record verification decision"
                          >
                            <BadgeCheck size={14} />
                          </button>
                          <button
                            type="button"
                            className="row-more danger"
                            onClick={() => void remove(doc)}
                            aria-label={`Remove ${displayTitle}`}
                            title="Delete document"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Additional Document Modal */}
      {showOtherModal && (
        <UploadOtherDialog
          studentId={studentId}
          studentName={studentName}
          onClose={() => setShowOtherModal(false)}
          onUploaded={async () => {
            setShowOtherModal(false);
            await load();
          }}
        />
      )}

      {/* In-App Document Preview Modal */}
      {preview && (
        <div className="modal-scrim" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`}>
          <div className="modal modal-wide">
            <div className="modal-header">
              <div>
                <h2 className="panel-title" style={{ fontSize: "15px" }}>{preview.title}</h2>
                <p className="panel-subtitle" style={{ fontSize: "12px", marginTop: "2px" }}>{preview.name}</p>
              </div>
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => setPreview(null)}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
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
              <span className="muted-cell" style={{ fontSize: "12px" }}>
                This secure temporary link expires in five minutes.
              </span>
              <a
                href={preview.url}
                download={preview.name}
                className="secondary-button compact"
                style={{ display: "inline-flex", alignItems: "center", gap: "5px", textDecoration: "none" }}
              >
                <Download size={13} />
                Download
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Document Verification Decision Modal */}
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
 * Upload Other / Additional Document Dialog.
 * Prompts for a clear Document Title (e.g. "Passport", "Medical Certificate")
 * and the corresponding file, ensuring proper nomenclature and organization.
 */
function UploadOtherDialog({
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      setError("File is larger than 10 MB. Please compress before uploading.");
      return;
    }
    if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(picked.type)) {
      setError("Please select a PDF, PNG, JPEG or WebP file.");
      return;
    }
    setError(null);
    setFile(picked);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Please enter a title for this document (e.g. Medical Certificate, Passport).");
      return;
    }
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setSaving(true);
    setError(null);

    // Build a unique, slugified docType identifier
    const slug = cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const docType = `other-${(slug || "file").slice(0, 20)}-${Date.now().toString(36)}`;

    try {
      await uploadStudentDocument(studentId, docType, file, cleanTitle);
      toast.success("Additional document uploaded", {
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
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Upload Additional Document">
      <div className="modal">
        <form onSubmit={submit}>
          <div className="modal-header">
            <div>
              <h2 className="panel-title" style={{ fontSize: "15px" }}>Upload Additional Document</h2>
              <p className="panel-subtitle" style={{ fontSize: "12px", marginTop: "2px" }}>
                Add a supplementary certificate or document for {studentName}.
              </p>
            </div>
            <button
              type="button"
              className="secondary-button compact"
              onClick={onClose}
              disabled={saving}
            >
              <X size={14} />
            </button>
          </div>

          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {error && (
              <div className="notice notice-danger" role="alert">
                <FileWarning size={14} />
                {error}
              </div>
            )}

            <label className="stack-label" style={{ margin: 0 }}>
              <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "13px" }}>
                Document Title <span style={{ color: "var(--brand)" }}>*</span>
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Medical Fitness Certificate, Passport, Affidavit"
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
              <span className="field-hint">A clear name that describes what this document contains.</span>
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "13px" }}>
                Select File <span style={{ color: "var(--brand)" }}>*</span>
              </span>

              {file ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    border: "1px solid var(--brand-border)",
                    borderRadius: "8px",
                    background: "var(--brand-soft)",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <FileText size={16} style={{ color: "var(--brand)", flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "12.5px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.name}
                      </p>
                      <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-muted)" }}>
                        {formatBytes(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="secondary-button compact"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    disabled={saving}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "1.5px dashed var(--border-strong)",
                    borderRadius: "8px",
                    padding: "24px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: "var(--bg-subtle)",
                    transition: "border-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                >
                  <Upload size={22} style={{ margin: "0 auto 8px", color: "var(--text-muted)" }} />
                  <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                    Click to select file
                  </p>
                  <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-muted)" }}>
                    PDF, PNG, JPEG or WebP up to 10 MB
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
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving || !title.trim() || !file}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {saving ? "Uploading…" : "Upload Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Verification decision dialog for administrators. */
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
      setError("Please provide a reason so the student and family know what to rectify.");
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
          documentId: doc.id ?? doc.key,
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
            ? "Marked as official verified paperwork."
            : "Rejection note recorded for follow-up.",
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
          <h2 className="panel-title" style={{ fontSize: "15px" }}>
            Verify {documentDisplayTitle(doc)}
          </h2>
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

          <div className="choice-row">
            <label className={status === "verified" ? "choice selected" : "choice"}>
              <input
                type="radio"
                name="verification"
                checked={status === "verified"}
                onChange={() => setStatus("verified")}
              />
              Verified
            </label>
            <label className={status === "rejected" ? "choice selected" : "choice"}>
              <input
                type="radio"
                name="verification"
                checked={status === "rejected"}
                onChange={() => setStatus("rejected")}
              />
              Rejected
            </label>
          </div>

          {status === "rejected" && (
            <label className="stack-label" style={{ margin: 0 }}>
              <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "12.5px" }}>
                Reason for Rejection <span style={{ color: "var(--brand)" }}>*</span>
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Scan is illegible, Aadhaar number does not match pupil records."
                rows={3}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                }}
              />
            </label>
          )}

          <label className="stack-label" style={{ margin: 0 }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "12.5px" }}>
              Internal Remarks (Optional)
            </span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Original physical copy verified in office by admin."
              rows={2}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontSize: "13px",
              }}
            />
          </label>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void save()}
            disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <BadgeCheck size={13} />}
            {saving ? "Saving…" : "Save Decision"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function authHeadersFor(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

function verificationTone(doc: StudentDocument): string {
  const status = doc.verification_status;
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function verificationLabel(doc: StudentDocument): string {
  const status = doc.verification_status;
  if (status === "verified") return "Verified";
  if (status === "rejected") return "Rejected";
  return "Awaiting check";
}

export const DocumentLockIcon = Lock;

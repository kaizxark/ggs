import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Baby,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  File,
  FileCheck,
  FileSignature,
  FileText,
  FileWarning,
  Globe,
  GraduationCap,
  Loader2,
  Lock,
  LogOut,
  Paperclip,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
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
import { usePageScrollLock } from "@/components/SmoothScroll";
import { supabase } from "@/lib/supabase";

/** Lucide icon per document type, kept out of the data module so it has no JSX. */
const ICONS: Record<string, React.ElementType> = {
  "id-card": CreditCard,
  baby: Baby,
  "file-text": FileText,
  "log-out": LogOut,
  award: GraduationCap,
  ticket: Ticket,
  syringe: Syringe,
  globe: Globe,
};

export function DocIcon({ type, size = 18 }: { type: DocType; size?: number }) {
  const Icon = ICONS[type.icon] ?? FileText;
  return <Icon size={size} />;
}

export interface StudentDocumentsPanelProps {
  studentId: string;
  /** Shown in header and confirmations, e.g. "Kabir Menon". */
  studentName: string;
  /** Ask before removing a file. Defaults to true. */
  confirmDelete?: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Modern student document cabinet.
 *
 * Core default documents:
 *  1. Aadhaar Card
 *  2. Birth Certificate
 *  3. Caste / Income Certificate
 *  4. Transfer Certificate (TC)
 *
 * Plus custom additional documents with user-specified titles.
 */
export function StudentDocumentsPanel({
  studentId,
  studentName,
  confirmDelete = true,
}: StudentDocumentsPanelProps) {
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [uploadOtherOpen, setUploadOtherOpen] = useState(false);
  const [preview, setPreview] = useState<{
    url: string;
    name: string;
    title: string;
    type: string;
  } | null>(null);
  const [verifying, setVerifying] = useState<StudentDocument | null>(null);

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  usePageScrollLock(Boolean(preview || verifying || uploadOtherOpen));

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

  const byType = new Map(documents.map((doc) => [doc.docType, doc]));
  const otherDocs = documents.filter(
    (doc) => !DOC_TYPES.some((t) => t.id === doc.docType)
  );

  const coreHeldCount = DOC_TYPES.filter((t) => byType.has(t.id)).length;

  const pick = (docType: string) => {
    inputs.current[docType]?.click();
  };

  const onFile = async (docType: string, file: File | undefined) => {
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error("That file is larger than 10 MB", {
        description: "Compress it or choose a smaller PDF or image scan.",
      });
      return;
    }
    if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type)) {
      toast.error("Upload a PDF, PNG, JPEG or WebP file");
      return;
    }

    setBusyType(docType);
    try {
      const typeLabel = docTypeById(docType)?.short ?? docType;
      const saved = await uploadStudentDocument(studentId, docType, file, typeLabel);
      setDocuments((current) => [
        saved,
        ...current.filter(
          (doc) => doc.key !== saved.key && doc.docType !== docType
        ),
      ]);
      toast.success(`${typeLabel} uploaded successfully`, {
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
      const isInline =
        doc.contentType === "application/pdf" ||
        doc.contentType.startsWith("image/");
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
      a.download = doc.fileName || `${doc.docType}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success(`Downloaded ${doc.fileName}`);
    } catch {
      try {
        const url = await getDocumentUrl(studentId, file);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.fileName || `${doc.docType}.pdf`;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not download document."
        );
      }
    }
  };

  const remove = async (doc: StudentDocument) => {
    const title = documentDisplayTitle(doc);
    if (
      confirmDelete &&
      !window.confirm(
        `Remove "${title}" for ${studentName}? The file will be permanently deleted from secure storage.`
      )
    ) {
      return;
    }
    setBusyType(doc.docType);
    try {
      const file = doc.key.split("/").slice(1).join("/");
      await deleteStudentDocument(studentId, file);
      setDocuments((current) => current.filter((item) => item.key !== doc.key));
      toast.success(`"${title}" removed`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "That document could not be removed."
      );
    } finally {
      setBusyType(null);
    }
  };

  if (loading) {
    return (
      <div className="doc-shell" aria-busy="true">
        <div className="doc-header-card">
          <div className="doc-header-info">
            <div className="erp-skeleton" style={{ width: 160, height: 18, borderRadius: 4 }} />
            <div className="erp-skeleton" style={{ width: 240, height: 12, borderRadius: 3, marginTop: 4 }} />
          </div>
          <div className="erp-skeleton" style={{ width: 130, height: 26, borderRadius: 16 }} />
        </div>
        <div className="doc-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="doc-card" style={{ minHeight: 96 }}>
              <div className="erp-skeleton" style={{ width: 40, height: 40, borderRadius: 10 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="erp-skeleton" style={{ width: 140, height: 16, borderRadius: 4 }} />
                <div className="erp-skeleton" style={{ width: "80%", height: 12, borderRadius: 3 }} />
                <div className="erp-skeleton" style={{ width: 90, height: 24, borderRadius: 6, marginTop: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="doc-empty panel">
        <AlertCircle size={22} className="text-[var(--danger)]" />
        <strong>Documents unavailable</strong>
        <span>{loadError}</span>
        <button
          type="button"
          className="secondary-button compact"
          style={{ marginTop: 12 }}
          onClick={() => void load()}
        >
          <RefreshCw size={13} /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="doc-shell">
      {/* Header Overview Card */}
      <div className="doc-header-card">
        <div className="doc-header-info">
          <h3 className="doc-header-title">
            <ShieldCheck size={18} className="text-[var(--brand)]" />
            Student Documentation
          </h3>
          <p className="doc-header-sub">
            Verified records and official certificates on file for{" "}
            <strong>{studentName}</strong>.
          </p>
        </div>
        <div className="doc-header-meta">
          <span
            className={`status-pill ${
              coreHeldCount === DOC_TYPES.length ? "success" : "warning"
            }`}
          >
            <CheckCircle2 size={12} />
            {coreHeldCount} of {DOC_TYPES.length} Core Documents
          </span>
          <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
            <Lock size={12} />
            Encrypted storage
          </span>
        </div>
      </div>

      {/* 1. Core Default Documents Section */}
      <div className="doc-section">
        <div className="doc-section-head">
          <div>
            <h4 className="doc-section-title">
              Core Student Documents
              <span className="chip chip-muted" style={{ fontSize: 11 }}>
                4 Mandatory Records
              </span>
            </h4>
            <p className="doc-section-sub">
              Standard identity and institution certificates for every enrolled pupil.
            </p>
          </div>
        </div>

        <div className="doc-grid">
          {DOC_TYPES.map((type) => {
            const held = byType.get(type.id);
            const busy = busyType === type.id;

            return (
              <div
                key={type.id}
                className={`doc-card ${held ? "held" : ""}`}
              >
                <div className={`doc-card-icon ${type.id}`}>
                  <DocIcon type={type} size={20} />
                </div>

                <div className="doc-card-body">
                  <div className="doc-card-title-row">
                    <span className="doc-card-title">{type.label}</span>
                    {held ? (
                      <span className="status-pill success" style={{ fontSize: 11 }}>
                        <CheckCircle2 size={11} /> On file
                      </span>
                    ) : (
                      <span className="status-pill neutral" style={{ fontSize: 11 }}>
                        Not uploaded
                      </span>
                    )}
                  </div>

                  {held ? (
                    <>
                      <div className="doc-card-file">
                        <FileText size={12} className="text-[var(--text-muted)]" />
                        <span className="doc-card-file-name" title={held.fileName}>
                          {held.fileName}
                        </span>
                        <span className="text-[var(--text-muted)]">·</span>
                        <span>{formatBytes(held.sizeBytes)}</span>
                      </div>
                      <div className="doc-card-meta">
                        Uploaded on {formatIssuedAt(held.issuedAt)}
                        {held.verification_status && (
                          <span
                            className={`ml-2 font-medium ${
                              held.verification_status === "verified"
                                ? "text-[var(--success)]"
                                : held.verification_status === "rejected"
                                  ? "text-[var(--danger)]"
                                  : "text-[var(--amber)]"
                            }`}
                          >
                            · {held.verification_status.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="doc-card-meta">{type.hint}</p>
                  )}

                  <div className="doc-card-actions">
                    {held ? (
                      <>
                        <button
                          type="button"
                          className="doc-btn"
                          onClick={() => void view(held)}
                          title="Preview document"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          className="doc-btn"
                          onClick={() => void download(held)}
                          title="Download file"
                        >
                          <Download size={13} />
                          <span>Download</span>
                        </button>
                        <button
                          type="button"
                          className="doc-btn"
                          onClick={() => pick(type.id)}
                          disabled={busy}
                          title="Upload a new copy"
                        >
                          {busy ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Upload size={13} />
                          )}
                          <span>Replace</span>
                        </button>
                        <button
                          type="button"
                          className="doc-btn"
                          onClick={() => setVerifying(held)}
                          title="Verification status"
                        >
                          <BadgeCheck size={13} />
                          <span>Verify</span>
                        </button>
                        <button
                          type="button"
                          className="doc-btn danger"
                          onClick={() => void remove(held)}
                          disabled={busy}
                          title="Remove document"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="doc-btn primary"
                        onClick={() => pick(type.id)}
                        disabled={busy}
                      >
                        {busy ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Upload size={13} />
                        )}
                        <span>Upload {type.short}</span>
                      </button>
                    )}
                  </div>
                </div>

                <input
                  ref={(node) => {
                    inputs.current[type.id] = node;
                  }}
                  type="file"
                  className="hidden"
                  accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(event) =>
                    void onFile(type.id, event.target.files?.[0])
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Additional / Other Documents Section */}
      <div className="doc-section" style={{ marginTop: 8 }}>
        <div className="doc-section-head">
          <div>
            <h4 className="doc-section-title">
              Additional Documents
              {otherDocs.length > 0 && (
                <span className="chip chip-muted" style={{ fontSize: 11 }}>
                  {otherDocs.length} {otherDocs.length === 1 ? "Record" : "Records"}
                </span>
              )}
            </h4>
            <p className="doc-section-sub">
              Previous marksheets, migration certificates, affidavits, and custom files.
            </p>
          </div>

          <button
            type="button"
            className="doc-btn primary"
            onClick={() => setUploadOtherOpen(true)}
          >
            <Plus size={14} />
            <span>Upload Other File</span>
          </button>
        </div>

        {otherDocs.length === 0 ? (
          <div className="doc-empty-box">
            <FileText size={24} className="text-[var(--text-muted)]" />
            <p>
              No additional documents uploaded yet. Click <strong>Upload Other File</strong> above to attach a marksheet, medical fitness note, or any extra record.
            </p>
          </div>
        ) : (
          <div className="doc-grid">
            {otherDocs.map((doc) => {
              const busy = busyType === doc.docType;
              const title = documentDisplayTitle(doc);

              return (
                <div key={doc.key} className="doc-card held">
                  <div className="doc-card-icon custom">
                    <FileText size={20} />
                  </div>

                  <div className="doc-card-body">
                    <div className="doc-card-title-row">
                      <span className="doc-card-title" title={title}>
                        {title}
                      </span>
                      <span className="status-pill success" style={{ fontSize: 11 }}>
                        <CheckCircle2 size={11} /> Attached
                      </span>
                    </div>

                    <div className="doc-card-file">
                      <Paperclip size={12} className="text-[var(--text-muted)]" />
                      <span className="doc-card-file-name" title={doc.fileName}>
                        {doc.fileName}
                      </span>
                      <span className="text-[var(--text-muted)]">·</span>
                      <span>{formatBytes(doc.sizeBytes)}</span>
                    </div>

                    <div className="doc-card-meta">
                      Uploaded on {formatIssuedAt(doc.issuedAt)}
                      {doc.verification_status && (
                        <span
                          className={`ml-2 font-medium ${
                            doc.verification_status === "verified"
                              ? "text-[var(--success)]"
                              : doc.verification_status === "rejected"
                                ? "text-[var(--danger)]"
                                : "text-[var(--amber)]"
                          }`}
                        >
                          · {doc.verification_status.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="doc-card-actions">
                      <button
                        type="button"
                        className="doc-btn"
                        onClick={() => void view(doc)}
                        title="Preview document"
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        className="doc-btn"
                        onClick={() => void download(doc)}
                        title="Download file"
                      >
                        <Download size={13} />
                        <span>Download</span>
                      </button>
                      <button
                        type="button"
                        className="doc-btn"
                        onClick={() => setVerifying(doc)}
                        title="Verification status"
                      >
                        <BadgeCheck size={13} />
                        <span>Verify</span>
                      </button>
                      <button
                        type="button"
                        className="doc-btn danger"
                        onClick={() => void remove(doc)}
                        disabled={busy}
                        title="Remove document"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Other Document Dialog */}
      {uploadOtherOpen && (
        <UploadOtherDialog
          studentId={studentId}
          studentName={studentName}
          onClose={() => setUploadOtherOpen(false)}
          onSuccess={(saved) => {
            setDocuments((current) => [saved, ...current]);
            setUploadOtherOpen(false);
          }}
        />
      )}

      {/* In-App Preview Modal */}
      {preview && (
        <div
          className="modal-scrim"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${preview.title}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreview(null);
          }}
        >
          <div className="modal modal-wide" style={{ maxWidth: 860 }}>
            <div className="modal-header">
              <div>
                <h2 className="panel-title" style={{ fontSize: 16 }}>
                  {preview.title}
                </h2>
                <p className="panel-subtitle" style={{ margin: "2px 0 0" }}>
                  {preview.name}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <a
                  href={preview.url}
                  download={preview.name}
                  className="secondary-button compact"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download size={14} /> Download
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
            <div className="preview-frame" style={{ minHeight: 460 }}>
              {preview.type === "application/pdf" ? (
                <iframe
                  src={preview.url}
                  title={preview.title}
                  style={{ width: "100%", height: "min(68vh, 620px)", border: 0 }}
                />
              ) : (
                <img
                  src={preview.url}
                  alt={preview.title}
                  style={{
                    display: "block",
                    maxHeight: "min(68vh, 620px)",
                    margin: "0 auto",
                    objectFit: "contain",
                  }}
                />
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <span className="muted-cell text-xs">
                Private school file · Temporary link expires in 5 minutes
              </span>
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => setPreview(null)}
              >
                Close preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Decision Dialog */}
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
 * Dialog to upload an extra document with a descriptive Title and file.
 */
function UploadOtherDialog({
  studentId,
  studentName,
  onClose,
  onSuccess,
}: {
  studentId: string;
  studentName: string;
  onClose: () => void;
  onSuccess: (saved: StudentDocument) => void;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Please enter a title for this document.");
      return;
    }
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    if (file.size > MAX_BYTES) {
      setError("File exceeds maximum allowed size (10 MB).");
      return;
    }
    if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type)) {
      setError("Please choose a PDF, PNG, JPEG or WebP file.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Create a clean safe slug for the document type
      const slug = cleanTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24);
      const uniqueSuffix = Date.now().toString(36).slice(-4);
      const docType = `other-${slug || "doc"}-${uniqueSuffix}`;

      const saved = await uploadStudentDocument(
        studentId,
        docType,
        file,
        cleanTitle
      );
      toast.success("Document uploaded successfully", {
        description: `"${cleanTitle}" (${file.name}) added to ${studentName}'s records.`,
      });
      onSuccess(saved);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The document could not be uploaded."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError(null);
      if (!title) {
        // Auto-suggest title based on filename
        const suggested = droppedFile.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]+/g, " ")
          .trim();
        if (suggested) {
          setTitle(suggested.charAt(0).toUpperCase() + suggested.slice(1));
        }
      }
    }
  };

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Upload other document"
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose();
      }}
    >
      <div className="modal" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <div>
              <h2 className="panel-title" style={{ fontSize: 16 }}>
                Upload Other Document
              </h2>
              <p className="panel-subtitle" style={{ margin: "2px 0 0" }}>
                Add an extra certificate, marksheet, or record for {studentName}
              </p>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              disabled={uploading}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {error && (
              <div className="notice notice-danger" role="alert">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* Document Title Input */}
            <label className="stack-label">
              <span>
                Document Title <strong className="text-[var(--danger)]">*</strong>
              </span>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Previous School Marksheet, Migration Certificate, Medical Fitness..."
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError(null);
                }}
                disabled={uploading}
                autoFocus
              />
              <span className="text-xs text-[var(--text-muted)] mt-1">
                This title will be displayed as the document's name in the student cabinet.
              </span>
            </label>

            {/* File Dropzone or Selected File */}
            <div className="stack-label">
              <span>
                File Attachment <strong className="text-[var(--danger)]">*</strong>
              </span>

              {file ? (
                <div className="doc-selected-file">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <FileText size={22} className="text-[var(--brand)] flex-shrink-0" />
                    <div style={{ minWidth: 0 }}>
                      <p
                        className="font-medium text-sm text-[var(--text-primary)] truncate"
                        title={file.name}
                        style={{ margin: 0 }}
                      >
                        {file.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]" style={{ margin: 0 }}>
                        {formatBytes(file.size)} · {file.type || "Document"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="doc-btn"
                    onClick={() => setFile(null)}
                    disabled={uploading}
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <div
                  className={`doc-dropzone ${isDragging ? "doc-dropzone-drag" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload size={24} className="text-[var(--brand)]" />
                  <div>
                    <strong className="text-sm text-[var(--text-primary)] block">
                      Click to choose a file or drag & drop here
                    </strong>
                    <span className="text-xs text-[var(--text-muted)] block mt-1">
                      PDF, PNG, JPEG or WebP (max 10 MB)
                    </span>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) {
                    setFile(selected);
                    setError(null);
                    if (!title) {
                      const suggested = selected.name
                        .replace(/\.[^/.]+$/, "")
                        .replace(/[-_]+/g, " ")
                        .trim();
                      if (suggested) {
                        setTitle(
                          suggested.charAt(0).toUpperCase() + suggested.slice(1)
                        );
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={!title.trim() || !file || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Uploading…</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>Upload Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Record a verification decision (Verified or Rejected with reason).
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

  const title = documentDisplayTitle(doc);

  const save = async () => {
    if (status === "rejected" && !reason.trim()) {
      setError("Please provide a reason so the family knows what needs fixing.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/documents", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          studentId,
          documentId: doc.id || doc.key,
          verification_status: status,
          rejection_reason: reason,
          remarks,
        }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!res.ok) {
        setError(payload?.message ?? "That decision could not be saved.");
        return;
      }
      toast.success(
        status === "verified" ? "Document verified" : "Document rejected",
        {
          description:
            status === "verified"
              ? `"${title}" has been verified.`
              : "Marked as rejected with the stated reason.",
        }
      );
      await onDone();
    } catch {
      setError("That decision could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Verify document"
    >
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h2 className="panel-title" style={{ fontSize: 16 }}>
              Verify {title}
            </h2>
            <p className="panel-subtitle" style={{ margin: "2px 0 0" }}>
              {doc.fileName} · Record verification status
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={saving}
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div className="notice notice-danger" role="alert">
              <FileWarning size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="choice-row">
            <label
              className={status === "verified" ? "choice selected" : "choice"}
              style={{ flex: 1, textAlign: "center" }}
            >
              <input
                type="radio"
                name="verification"
                checked={status === "verified"}
                onChange={() => setStatus("verified")}
              />
              <span className="font-semibold text-sm">Verified</span>
            </label>
            <label
              className={status === "rejected" ? "choice selected" : "choice"}
              style={{ flex: 1, textAlign: "center" }}
            >
              <input
                type="radio"
                name="verification"
                checked={status === "rejected"}
                onChange={() => setStatus("rejected")}
              />
              <span className="font-semibold text-sm">Rejected</span>
            </label>
          </div>

          {status === "rejected" && (
            <label className="stack-label">
              <span>
                Reason for Rejection <strong className="text-[var(--danger)]">*</strong>
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="input-field"
                placeholder="e.g. Document image is blurred or expired..."
              />
            </label>
          )}

          <label className="stack-label">
            <span>Internal Remarks (Optional)</span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="input-field"
              placeholder="Notes for school staff..."
            />
          </label>
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
            type="button"
            className="primary-button"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <span>Save Decision</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Read-only summary badge for the Documents index in tables. */
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Baby,
  BadgeCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileSignature,
  FileText,
  FileWarning,
  GraduationCap,
  Loader2,
  Lock,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
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
import { useDataRevision } from "@/lib/live-data";
import { useRealtimeInvalidation } from "@/lib/use-realtime";

export interface DocumentPanelProps {
  studentId: string;
  studentName: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const QUICK_TITLE_SUGGESTIONS = [
  "Medical Fitness Certificate",
  "Passport / Visa",
  "Conduct Certificate",
  "Sports Merit Award",
  "Migration Certificate",
  "Affidavit / Undertaking",
];

const CORE_ICONS: Record<string, React.ElementType> = {
  aadhaar: CreditCard,
  "birth-certificate": Baby,
  "caste-income": FileText,
  "transfer-certificate": GraduationCap,
};

export function DocumentPanel({ studentId, studentName }: DocumentPanelProps) {
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; title: string; type: string } | null>(null);
  const [verifying, setVerifying] = useState<StudentDocument | null>(null);
  const [showOtherModal, setShowOtherModal] = useState(false);

  // Table filtering and search
  const [tableFilter, setTableFilter] = useState<"all" | "core" | "additional" | "verified">("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const dataRevision = useDataRevision();
  const realtimeRevision = useRealtimeInvalidation(["student_documents"]);

  useEffect(() => {
    void load();
  }, [load, dataRevision, realtimeRevision]);

  const heldMap = useMemo(() => new Map(documents.map((d) => [d.docType, d])), [documents]);
  const missingCore = useMemo(() => DOC_TYPES.filter((t) => !heldMap.has(t.id)), [heldMap]);
  const heldCoreCount = DOC_TYPES.length - missingCore.length;
  const verifiedCount = useMemo(() => documents.filter((d) => d.verification_status === "verified").length, [documents]);
  const otherDocs = useMemo(() => documents.filter((d) => !DOC_TYPES.some((t) => t.id === d.docType)), [documents]);

  // Filtered documents for the file cabinet table
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const isCore = DOC_TYPES.some((t) => t.id === doc.docType);
      if (tableFilter === "core" && !isCore) return false;
      if (tableFilter === "additional" && isCore) return false;
      if (tableFilter === "verified" && doc.verification_status !== "verified") return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const title = documentDisplayTitle(doc).toLowerCase();
        const fileName = doc.fileName.toLowerCase();
        return title.includes(query) || fileName.includes(query);
      }
      return true;
    });
  }, [documents, tableFilter, searchQuery]);

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
      toast.error("Please upload a PDF, PNG, JPEG or WebP file.");
      return;
    }

    const replacing = documents.find((d) => d.docType === docType);
    setUploading(docType);
    try {
      await uploadStudentDocument(studentId, docType, file);
      toast.success(replacing ? "Document replaced" : "Document uploaded", {
        description: replacing
          ? "The previous copy has been superseded by the new scan."
          : `${docTypeById(docType)?.label ?? docType} is now safely on file.`,
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

      {/* Panel 1: Core Documents Checklist */}
      <div className="panel">
        <div className="panel-header">
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <h2 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                Core Documents Checklist
                <span className={`chip ${missingCore.length === 0 ? "chip-accent" : "chip-muted"}`}>
                  {heldCoreCount} of {DOC_TYPES.length} on file
                </span>
              </h2>

              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {verifiedCount} verified by administration
              </span>
            </div>

            {/* Segmented visual progress track */}
            <div className="doc-progress-track">
              {DOC_TYPES.map((t) => {
                const isHeld = heldMap.has(t.id);
                const isVer = heldMap.get(t.id)?.verification_status === "verified";
                return (
                  <div
                    key={t.id}
                    className={`doc-progress-segment ${isHeld ? (isVer ? "done" : "pending") : ""}`}
                    title={`${t.label}: ${isHeld ? (isVer ? "Verified" : "Uploaded (Pending Check)") : "Missing"}`}
                  />
                );
              })}
            </div>

            <p className="panel-subtitle" style={{ marginTop: "8px" }}>
              {missingCore.length === 0 ? (
                <span style={{ color: "var(--success)", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <CheckCircle2 size={14} /> All 4 core documents (Aadhaar, Birth Certificate, Caste/Income, Transfer Certificate) are on file.
                </span>
              ) : (
                <span>
                  Official student documents. Still missing:{" "}
                  <strong style={{ color: "var(--brand)" }}>
                    {missingCore.map((m) => m.label).join(", ")}
                  </strong>
                  .
                </span>
              )}
            </p>
          </div>
        </div>

        {/* 4 Core Document Cards in 4-column / 2x2 responsive grid */}
        <div className="doc-core-grid">
          {DOC_TYPES.map((type) => {
            const held = heldMap.get(type.id);
            const isHeld = Boolean(held);
            const isBusy = uploading === type.id;
            const isVerified = held?.verification_status === "verified";
            const isRejected = held?.verification_status === "rejected";
            const Icon = CORE_ICONS[type.id] ?? FileText;

            return (
              <div
                key={type.id}
                className={`doc-core-card ${isHeld ? "held" : "missing"}`}
              >
                <div>
                  {/* Top row: Icon badge + Status pill */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <div className={`doc-badge-icon ${type.id}`}>
                      <Icon size={18} />
                    </div>

                    {isHeld ? (
                      <span
                        className={`status-pill ${isVerified ? "success" : isRejected ? "danger" : "brand"}`}
                        style={{ fontSize: "11px", padding: "2px 8px" }}
                      >
                        <span className="status-dot" />
                        {isVerified ? "Verified" : isRejected ? "Rejected" : "On File"}
                      </span>
                    ) : (
                      <span className="status-pill warning" style={{ fontSize: "11px", padding: "2px 8px" }}>
                        <span className="status-dot" />
                        Missing
                      </span>
                    )}
                  </div>

                  {/* Document Title & info */}
                  <div style={{ marginTop: "12px" }}>
                    <h3 style={{ margin: 0, fontSize: "13.5px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {type.label}
                    </h3>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: "11.5px",
                        color: isHeld ? "var(--text-secondary)" : "var(--text-muted)",
                        lineHeight: 1.45,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: isHeld ? "nowrap" : "normal",
                      }}
                      title={isHeld ? held!.fileName : type.hint}
                    >
                      {isHeld ? (
                        <>
                          <span style={{ fontWeight: 500 }}>{held!.fileName}</span>
                          <span style={{ color: "var(--text-muted)" }}> · {formatBytes(held!.sizeBytes)}</span>
                        </>
                      ) : (
                        type.hint
                      )}
                    </p>

                    {isHeld && held!.issuedAt && (
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        Uploaded {formatIssuedAt(held!.issuedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom action row */}
                <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px solid var(--border-subtle)" }}>
                  {isHeld ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        className="secondary-button compact"
                        style={{ flex: 1, padding: "5px 8px", fontSize: "12px", justifyContent: "center" }}
                        onClick={() => void open(held!)}
                        title="View / Preview"
                      >
                        <Eye size={13} />
                        View
                      </button>
                      <button
                        type="button"
                        className="secondary-button compact"
                        style={{ flex: 1, padding: "5px 8px", fontSize: "12px", justifyContent: "center" }}
                        onClick={() => pick(type.id)}
                        disabled={isBusy}
                        title="Replace with new copy"
                      >
                        {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        Replace
                      </button>
                      <button
                        type="button"
                        className="secondary-button compact"
                        style={{ padding: "5px 8px", fontSize: "12px" }}
                        onClick={() => void download(held!)}
                        title="Download file"
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="primary-button compact"
                      style={{ width: "100%", padding: "6px 12px", fontSize: "12.5px", justifyContent: "center" }}
                      onClick={() => pick(type.id)}
                      disabled={isBusy}
                    >
                      {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
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

      {/* Panel 2: Complete File Cabinet */}
      <div className="panel">
        <div
          className="panel-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div>
            <h2 className="panel-title">File Cabinet</h2>
            <p className="panel-subtitle">
              All stored records for {studentName}. Documents are encrypted and protected by time-limited access tokens.
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

        {/* Filter pills and search bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            padding: "12px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            {[
              { id: "all", label: `All (${documents.length})` },
              { id: "core", label: `Core Records (${heldCoreCount})` },
              { id: "additional", label: `Additional (${otherDocs.length})` },
              { id: "verified", label: `Verified (${verifiedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTableFilter(tab.id as typeof tableFilter)}
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: tableFilter === tab.id ? 700 : 500,
                  borderRadius: "6px",
                  border: tableFilter === tab.id ? "1px solid var(--brand-border)" : "1px solid var(--border)",
                  background: tableFilter === tab.id ? "var(--brand-soft)" : "var(--bg-input)",
                  color: tableFilter === tab.id ? "var(--brand)" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.14s ease",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ position: "relative", minWidth: "200px" }}>
            <Search
              size={13}
              style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title or file name…"
              style={{
                width: "100%",
                padding: "5px 10px 5px 28px",
                fontSize: "12px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="empty-state">
            <ShieldAlert size={24} />
            <p className="panel-title" style={{ marginTop: "8px" }}>No documents uploaded yet</p>
            <p className="panel-subtitle">
              Upload the core documents above or click "+ Upload Additional Document" to add custom files.
            </p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="empty-state">
            <Search size={22} />
            <p className="panel-title" style={{ marginTop: "6px" }}>No documents match this filter</p>
            <p className="panel-subtitle">Try selecting a different filter tab or clearing your search term.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Issued / Uploaded</th>
                  <th>Size</th>
                  <th>Verification</th>
                  <th aria-label="Actions" style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => {
                  const core = docTypeById(doc.docType);
                  const displayTitle = documentDisplayTitle(doc);
                  const isVerified = doc.verification_status === "verified";
                  const isRejected = doc.verification_status === "rejected";
                  const tone = isVerified ? "success" : isRejected ? "danger" : "brand";
                  const vLabel = isVerified ? "Verified" : isRejected ? "Rejected" : "Pending Check";

                  // Extract file extension for badge
                  const ext = (doc.fileName.split(".").pop() || "FILE").toUpperCase().slice(0, 4);

                  return (
                    <tr key={doc.key}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span
                            className={`doc-badge-icon ${core ? core.id : "other"}`}
                            style={{ width: "32px", height: "32px", borderRadius: "6px" }}
                          >
                            <FileText size={16} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                              {displayTitle}
                              {isVerified && (
                                <span title="Verified by Administration" style={{ display: "inline-flex", alignItems: "center" }}>
                                  <ShieldCheck size={14} style={{ color: "var(--success)" }} />
                                </span>
                              )}
                            </div>
                            <div className="muted-cell" style={{ fontSize: "11.5px", marginTop: "1px", display: "flex", alignItems: "center", gap: "5px" }}>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", padding: "1px 4px", borderRadius: "3px", background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)" }}>
                                {ext}
                              </span>
                              <span>{doc.fileName}</span>
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
                        <span className={`status-pill ${tone}`} style={{ fontSize: "11px" }} title={isRejected && doc.rejection_reason ? `Reason: ${doc.rejection_reason}` : undefined}>
                          <span className="status-dot" />
                          {vLabel}
                        </span>
                        {isRejected && doc.rejection_reason && (
                          <div style={{ fontSize: "10.5px", color: "var(--danger)", marginTop: "2px", maxWidth: "200px" }}>
                            {doc.rejection_reason}
                          </div>
                        )}
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="secondary-button compact"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", textDecoration: "none" }}
                  title="Open in new window"
                >
                  <ExternalLink size={13} />
                  New Tab
                </a>
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
                <Download size={13} />
                Download Document
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
 * Prompts for a clear Document Title (with quick suggestions) and file picker.
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
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (picked: File) => {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) validateAndSetFile(picked);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) validateAndSetFile(dropped);
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

            {/* Document Title with quick suggestions */}
            <div>
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
              </label>

              {/* Quick suggestion chips */}
              <div style={{ marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Quick suggestions:
                </span>
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

            {/* File selection dropzone */}
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
                    padding: "12px 14px",
                    border: "1px solid var(--brand-border)",
                    borderRadius: "8px",
                    background: "var(--brand-soft)",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <div className="doc-badge-icon other" style={{ width: "32px", height: "32px" }}>
                      <FileText size={16} />
                    </div>
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
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  style={{
                    border: isDragging ? "2px dashed var(--brand)" : "1.5px dashed var(--border-strong)",
                    borderRadius: "8px",
                    padding: "26px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: isDragging ? "var(--brand-soft)" : "var(--bg-subtle)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Upload size={24} style={{ margin: "0 auto 8px", color: isDragging ? "var(--brand)" : "var(--text-muted)" }} />
                  <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {isDragging ? "Drop your file here" : "Click to select or drag & drop file"}
                  </p>
                  <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-muted)" }}>
                    Supports PDF, PNG, JPEG or WebP (max 10 MB)
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
              <CheckCircle2 size={15} style={{ color: "var(--success)" }} />
              Verified
            </label>
            <label className={status === "rejected" ? "choice selected" : "choice"}>
              <input
                type="radio"
                name="verification"
                checked={status === "rejected"}
                onChange={() => setStatus("rejected")}
              />
              <AlertCircle size={15} style={{ color: "var(--danger)" }} />
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
                placeholder="e.g. Scan is blurry/illegible, wrong document uploaded, or name does not match school records."
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
              placeholder="e.g. Physical original verified by principal on 15 Nov."
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

export const DocumentLockIcon = Lock;

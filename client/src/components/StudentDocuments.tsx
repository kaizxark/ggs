import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Baby,
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Globe,
  GraduationCap,
  Loader2,
  LogOut,
  Paperclip,
  Syringe,
  Ticket,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  DOC_TYPES,
  deleteStudentDocument,
  docTypeById,
  formatBytes,
  formatIssuedAt,
  getDocumentUrl,
  listStudentDocuments,
  uploadStudentDocument,
  type DocType,
  type StudentDocument,
} from "../lib/student-documents";

/** Lucide icon per document type, kept out of the data module so it has no JSX. */
const ICONS: Record<DocType["icon"], React.ElementType> = {
  "id-card": FileSignature,
  award: GraduationCap,
  ticket: Ticket,
  baby: Baby,
  "file-text": FileText,
  "log-out": LogOut,
  syringe: Syringe,
  globe: Globe,
};

export function DocIcon({ type, size = 16 }: { type: DocType; size?: number }) {
  const Icon = ICONS[type.icon] ?? FileText;
  return <Icon size={size} />;
}

export interface StudentDocumentsPanelProps {
  studentId: string;
  /** Shown in the empty state, e.g. "Kabir Menon". */
  studentName: string;
  /** Ask before removing a file. These are records, not scratch files. */
  confirmDelete?: boolean;
}

/**
 * One student's document cabinet.
 *
 * Shared by the profile drawer and the Documents view so both behave identically
 * — the same upload, open and remove rules in two places would drift.
 *
 * Only one file per type is kept: re-uploading a marks card replaces the
 * previous one, because a drawer holding five report cards from five years is
 * harder to act on than one current card.
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

  const byType = new Map(documents.map((doc) => [doc.docType, doc]));

  const pick = (docType: string) => {
    inputs.current[docType]?.click();
  };

  const onFile = async (docType: string, file: File | undefined) => {
    if (!file) return;
    setBusyType(docType);
    try {
      const saved = await uploadStudentDocument(studentId, docType, file);
      setDocuments((current) => [
        saved,
        ...current.filter((doc) => doc.docType !== docType),
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
      // Allow re-picking the same file after a failure.
      const input = inputs.current[docType];
      if (input) input.value = "";
    }
  };

  const open = async (doc: StudentDocument) => {
    // key is "<studentId>/<file>"; the route wants just the file part.
    const file = doc.key.split("/").slice(1).join("/");
    try {
      const url = await getDocumentUrl(studentId, file);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "That document could not be opened."
      );
    }
  };

  const remove = async (doc: StudentDocument) => {
    const label = docTypeById(doc.docType)?.short ?? "Document";
    if (
      confirmDelete &&
      !window.confirm(
        `Remove the ${label.toLowerCase()} for ${studentName}? The file is deleted from storage and cannot be recovered here.`
      )
    ) {
      return;
    }
    setBusyType(doc.docType);
    try {
      const file = doc.key.split("/").slice(1).join("/");
      await deleteStudentDocument(studentId, file);
      setDocuments((current) =>
        current.filter((item) => item.key !== doc.key)
      );
      toast.success(`${label} removed`);
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
      <div className="doc-list" aria-busy="true">
        {DOC_TYPES.map((type) => (
          <div className="doc-row" key={type.id}>
            <span className="doc-icon">
              <Loader2 size={16} className="animate-spin" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="doc-name">{type.short}</div>
              <div className="doc-meta">Loading…</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="doc-empty">
        <AlertCircle size={18} className="text-[#f0866f]" />
        <strong>Documents unavailable</strong>
        <span>{loadError}</span>
      </div>
    );
  }

  return (
    <div>
      <p className="doc-note">
        Files are private to this school. Opening one creates a link that expires
        in five minutes.
      </p>
      <div className="doc-list">
        {DOC_TYPES.map((type) => {
          const held = byType.get(type.id);
          const busy = busyType === type.id;
          return (
            <div className={`doc-row ${held ? "held" : ""}`} key={type.id}>
              <span className={`doc-icon ${held ? "held" : ""}`}>
                <DocIcon type={type} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="doc-name">
                  {type.short}
                  {held && (
                    <CheckCircle2 size={13} className="doc-onfile" />
                  )}
                </div>
                {held ? (
                  <div className="doc-meta">
                    {held.fileName} · {formatBytes(held.sizeBytes)} ·{" "}
                    {formatIssuedAt(held.issuedAt)}
                  </div>
                ) : (
                  <div className="doc-meta">{type.hint}</div>
                )}
              </div>
              <div className="doc-actions">
                <button
                  className="tiny-action"
                  onClick={() => pick(type.id)}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : held ? (
                    <Upload size={13} />
                  ) : (
                    <Paperclip size={13} />
                  )}
                  {held ? "Replace" : "Upload"}
                </button>
                {held && (
                  <>
                    <button
                      className="doc-icon-button"
                      onClick={() => void open(held)}
                      aria-label={`Open ${type.short} for ${studentName}`}
                      title="Open"
                    >
                      <Download size={15} />
                    </button>
                    <button
                      className="doc-icon-button danger"
                      onClick={() => void remove(held)}
                      disabled={busy}
                      aria-label={`Remove ${type.short} for ${studentName}`}
                      title="Remove"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
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
                  void onFile(type.id, event.target.files?.[0])
                }
              />
            </div>
          );
        })}
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
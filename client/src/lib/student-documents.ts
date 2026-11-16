import { supabase } from "./supabase";
import { notifyDataChanged } from "./live-data";

/**
 * Student document types.
 *
 * The order here is the order they appear in the drawer and the Documents view,
 * so it runs from the document every student needs to the ones only some have.
 *
 * `required` drives the gap count in the Documents view. Only the two that a
 * school genuinely cannot run without are marked so — marking Aadhaar required
 * would put most of the school permanently in arrears for a card many families
 * have not applied for yet.
 */
export interface DocType {
  id: string;
  label: string;
  short: string;
  required: boolean;
  hint: string;
  /** Lucide icon name, resolved in the view. */
  icon: "id-card" | "award" | "ticket" | "baby" | "file-text" | "log-out" | "syringe" | "globe";
}

export const DOC_TYPES: DocType[] = [
  {
    id: "aadhaar",
    label: "Aadhaar Card",
    short: "Aadhaar",
    required: true,
    hint: "Government-issued 12-digit Aadhaar identity card for the student.",
    icon: "id-card",
  },
  {
    id: "birth-certificate",
    label: "Birth Certificate",
    short: "Birth Cert.",
    required: true,
    hint: "Official birth certificate verifying date of birth and parentage.",
    icon: "baby",
  },
  {
    id: "caste-income",
    label: "Caste / Income Certificate",
    short: "Caste / Income",
    required: false,
    hint: "Caste, income, or domicile certificate for category, quota & fee concessions.",
    icon: "file-text",
  },
  {
    id: "transfer-certificate",
    label: "Transfer Certificate",
    short: "Transfer Cert.",
    required: false,
    hint: "Transfer Certificate (TC) from previous school or issued on school leaving.",
    icon: "log-out",
  },
];

export const REQUIRED_DOC_TYPES = DOC_TYPES.filter((type) => type.required);

export function docTypeById(id: string): DocType | undefined {
  return DOC_TYPES.find((type) => type.id === id);
}

export function documentDisplayTitle(doc: StudentDocument): string {
  if (doc.title && doc.title.trim()) {
    const t = doc.title.trim();
    if (!t.toLowerCase().startsWith("other — ") && !t.toLowerCase().startsWith("other - ")) {
      return t;
    }
  }
  const defaultType = docTypeById(doc.docType);
  if (defaultType) return defaultType.label;
  if (doc.docType.startsWith("other-") || doc.docType.startsWith("other_")) {
    const raw = doc.docType.replace(/^other[-_]/, "");
    return raw
      .split(/[-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  if (doc.docType === "marks-card") return "Marks Card";
  if (doc.docType === "hall-ticket") return "Hall Ticket";
  if (doc.docType === "immunisation") return "Immunisation / Medical";
  if (doc.docType === "passport") return "Passport / Visa";
  if (doc.docType === "other") {
    const clean = doc.fileName.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "Other Document";
  }
  return doc.docType
    .split(/[-_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface StudentDocument {
  id?: string;
  docType: string;
  title?: string;
  fileName: string;
  issuedAt: string | null;
  updatedAt: string | null;
  sizeBytes: number;
  contentType: string;
  /** Storage key relative to the bucket, e.g. "<studentId>/aadhaar__…__a.pdf". */
  key: string;
  verification_status?: string;
  rejection_reason?: string;
  remarks?: string;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 20261002T221145Z -> 2 Oct 2026 */
export function formatIssuedAt(stamp: string | null): string {
  if (!stamp) return "—";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  // 1. Compact timestamp format: 20261002T221145Z
  const compact = /^(\d{4})(\d{2})(\d{2})T/.exec(stamp);
  if (compact) {
    const [, year, month, day] = compact;
    const label = months[Number(month) - 1] ?? month;
    return `${Number(day)} ${label} ${year}`;
  }
  // 2. Standard ISO date format: 2026-10-02...
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(stamp);
  if (iso) {
    const [, year, month, day] = iso;
    const label = months[Number(month) - 1] ?? month;
    return `${Number(day)} ${label} ${year}`;
  }
  // 3. General Date parser
  const parsed = new Date(stamp);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getDate()} ${months[parsed.getMonth()]} ${parsed.getFullYear()}`;
  }
  return stamp;
}

/** How much of a student's required paperwork is on file. */
export function documentCoverage(
  documents: StudentDocument[]
): { have: number; total: number; missing: DocType[] } {
  const held = new Set(documents.map((doc) => doc.docType));
  const missing = REQUIRED_DOC_TYPES.filter((type) => !held.has(type.id));
  return {
    have: REQUIRED_DOC_TYPES.length - missing.length,
    total: REQUIRED_DOC_TYPES.length,
    missing,
  };
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

function messageOf(payload: unknown, fallback: string): string {
  const body = payload as { message?: string } | null;
  return body?.message ?? fallback;
}

/** Every document held for one student. */
export async function listStudentDocuments(
  studentId: string
): Promise<StudentDocument[]> {
  const res = await fetch(
    `/api/documents?studentId=${encodeURIComponent(studentId)}`,
    { headers: await authHeaders() }
  );
  const payload = (await res.json().catch(() => null)) as
    | { documents?: StudentDocument[]; message?: string }
    | null;
  if (!res.ok) {
    throw new Error(messageOf(payload, "Could not load documents."));
  }
  return payload?.documents ?? [];
}

/**
 * A short-lived signed link.
 *
 * The bucket is private, so this is the only way a file is ever read — which is
 * what keeps an Aadhaar copy from sitting behind a guessable URL.
 */
export async function getDocumentUrl(
  studentId: string,
  file: string
): Promise<string> {
  const res = await fetch(
    `/api/documents?studentId=${encodeURIComponent(
      studentId
    )}&download=1&file=${encodeURIComponent(file)}`,
    { headers: await authHeaders() }
  );
  const payload = (await res.json().catch(() => null)) as
    | { url?: string; message?: string }
    | null;
  if (!res.ok || !payload?.url) {
    throw new Error(messageOf(payload, "Could not open that document."));
  }
  return payload.url;
}

/** Read a picked file into the base64 payload the route expects. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

export async function uploadStudentDocument(
  studentId: string,
  docType: string,
  file: File,
  title?: string
): Promise<StudentDocument> {
  const data = await fileToBase64(file);
  const res = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({
      studentId,
      docType,
      fileName: file.name,
      title: title?.trim() || undefined,
      contentType: file.type,
      data,
    }),
  });
  const payload = (await res.json().catch(() => null)) as
    | { document?: StudentDocument; message?: string }
    | null;
  if (!res.ok || !payload?.document) {
    throw new Error(messageOf(payload, "That file could not be uploaded."));
  }
  notifyDataChanged();
  return payload.document;
}

export async function deleteStudentDocument(
  studentId: string,
  file: string
): Promise<void> {
  const res = await fetch("/api/documents", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ studentId, file }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(messageOf(payload, "That document could not be removed."));
  }
  notifyDataChanged();
}
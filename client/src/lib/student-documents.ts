import { supabase } from "./supabase";

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
    label: "Aadhaar card",
    short: "Aadhaar",
    required: false,
    hint: "Identity document for the pupil. Store the masked copy where possible.",
    icon: "id-card",
  },
  {
    id: "marks-card",
    label: "Marks card",
    short: "Marks card",
    required: true,
    hint: "Termly or annual report card, as issued to the family.",
    icon: "award",
  },
  {
    id: "hall-ticket",
    label: "Hall ticket",
    short: "Hall ticket",
    required: true,
    hint: "Exam hall ticket for the sitting concerned.",
    icon: "ticket",
  },
  {
    id: "birth-certificate",
    label: "Birth certificate",
    short: "Birth cert.",
    required: true,
    hint: "Also the source of the date of birth used for portal passwords.",
    icon: "baby",
  },
  {
    id: "caste-income",
    label: "Caste / income / domicile",
    short: "Caste / income",
    required: false,
    hint: "Needed for admissions, scholarships and fee concessions.",
    icon: "file-text",
  },
  {
    id: "transfer-certificate",
    label: "Transfer certificate",
    short: "Transfer cert.",
    required: false,
    hint: "Issued when a pupil leaves. Usually the last document added.",
    icon: "log-out",
  },
  {
    id: "immunisation",
    label: "Immunisation / medical",
    short: "Immunisation",
    required: false,
    hint: "Vaccination record, plus any medical notes the school holds.",
    icon: "syringe",
  },
  {
    id: "passport",
    label: "Passport / visa",
    short: "Passport",
    required: false,
    hint: "For pupils who travel or hold foreign citizenship.",
    icon: "globe",
  },
];

export const REQUIRED_DOC_TYPES = DOC_TYPES.filter((type) => type.required);

export function docTypeById(id: string): DocType | undefined {
  return DOC_TYPES.find((type) => type.id === id);
}

export interface StudentDocument {
  docType: string;
  fileName: string;
  issuedAt: string | null;
  updatedAt: string | null;
  sizeBytes: number;
  contentType: string;
  /** Storage key relative to the bucket, e.g. "<studentId>/aadhaar__…__a.pdf". */
  key: string;
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
  const match = /^(\d{4})(\d{2})(\d{2})T/.exec(stamp);
  if (!match) return stamp;
  const [, year, month, day] = match;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const label = months[Number(month) - 1] ?? month;
  return `${Number(day)} ${label} ${year}`;
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
  file: File
): Promise<StudentDocument> {
  const data = await fileToBase64(file);
  const res = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({
      studentId,
      docType,
      fileName: file.name,
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
}
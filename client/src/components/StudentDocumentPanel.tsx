/**
 * Student Document Panel for Student Profile.
 *
 * Uses the unified, modern StudentDocumentsPanel component for full feature parity
 * (4 core default documents, custom title upload for other files, in-app preview, and verification).
 */

import { Lock } from "lucide-react";
import {
  StudentDocumentsPanel,
  type StudentDocumentsPanelProps,
} from "./StudentDocuments";

export interface DocumentPanelProps {
  studentId: string;
  studentName: string;
}

export function DocumentPanel({ studentId, studentName }: DocumentPanelProps) {
  return (
    <div className="section-stack">
      <StudentDocumentsPanel studentId={studentId} studentName={studentName} />
    </div>
  );
}

/** Re-exported so the profile can show the same lock icon it uses elsewhere. */
export const DocumentLockIcon = Lock;

import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

import { usePageScrollLock } from "@/components/SmoothScroll";

/**
 * A typed confirmation for a permanent delete.
 *
 * Deletes here are not the reversible kind: a pupil's marks, invoices and
 * attendance go with the row, and a staff member's sign-in account goes too.
 * Requiring the word DELETE makes that difference felt rather than read, and
 * it stops a stray Enter on the drawer's last button from destroying a record.
 */
export function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel = "Delete permanently",
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  usePageScrollLock();
  const [typed, setTyped] = useState("");
  const canConfirm = typed.trim().toUpperCase() === "DELETE" && !busy;

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal" style={{ width: "min(470px, 94vw)" }}>
        <div className="modal-header">
          <h2
            className="panel-title"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <AlertTriangle size={17} className="text-[var(--danger)]" />
            {title}
          </h2>
          <button
            type="button"
            className="secondary-button compact"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="modal-body">
          <p className="panel-subtitle">{description}</p>
          <label className="stack-label" style={{ marginTop: 16 }}>
            Type <strong>DELETE</strong> to confirm
            <input
              autoFocus
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              aria-label="Type DELETE to confirm"
              placeholder="DELETE"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button danger"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            <Trash2 size={14} />
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

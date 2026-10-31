import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { usePageScrollLock } from "@/components/SmoothScroll";
import { ApiError } from "@/lib/student-directory";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { notifyDataChanged } from "@/lib/live-data";
import { FormSelect } from "./FormSelect";

/**
 * Add a member of staff.
 *
 * Designed with Apple HIG fixed geometry and frosted FormSelect dropdowns.
 * Saving mints the sign-in account as part of the write and returns credentials.
 */

const DEPARTMENTS = [
  "Grade 5",
  "Middle School",
  "Senior School",
  "Activities",
  "Front Office",
  "Technology",
];

const TITLES = [
  "Class Teacher",
  "Subject Teacher",
  "Coordinator",
  "Administrator",
  "Support staff",
];

/** The access level each job title grants, matching the staff edit dialog. */
const ACCESS_BY_TITLE: Record<string, string> = {
  "Class Teacher": "teacher",
  "Subject Teacher": "teacher",
  Coordinator: "staff",
  Administrator: "admin",
  "Support staff": "staff",
};

const ACCESS_LABELS: Record<string, string> = {
  admin: "Administrator",
  staff: "Staff",
  teacher: "Teacher",
  accountant: "Accountant",
};

export interface StaffCreateDialogProps {
  onClose: () => void;
  /** Called after a successful save so the directory can reload its rows. */
  onCreated: () => void;
}

export function StaffCreateDialog({ onClose, onCreated }: StaffCreateDialogProps) {
  usePageScrollLock();
  const [form, setForm] = useState({
    name: "",
    usn: "",
    email: "",
    phone: "",
    title: "Class Teacher",
    department: "Middle School",
    joined_on: new Date().toISOString().slice(0, 10),
    active: true,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const field = key === "title" ? "role" : key;
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const submit = async () => {
    const local: Record<string, string> = {};
    if (!form.name.trim()) local.name = "Enter a full name.";
    if (!form.email.trim()) local.email = "Enter the address that receives their sign-in code.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      local.email = "Enter a valid email address.";
    if (Object.keys(local).length) {
      setFieldErrors(local);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          usn: form.usn.trim() || undefined,
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          designation: form.title,
          role: ACCESS_BY_TITLE[form.title] ?? "staff",
          department: form.department,
          joined_on: form.joined_on || undefined,
          active: form.active,
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const fields = json.fieldErrors as Record<string, string> | undefined;
        if (fields && Object.keys(fields).length) {
          setFieldErrors(fields);
        } else {
          setError(String(json.message ?? "That member of staff could not be saved."));
        }
        return;
      }
      const createdUsn = (json.staff as { usn?: string } | undefined)?.usn;
      toast.success("Staff profile created", {
        description:
          json.account === "created"
            ? `${form.name.trim()} can now sign in with ${
                createdUsn ? `USN ${createdUsn}` : "their staff USN"
              }. The code is emailed to ${form.email.trim()}.`
            : `${form.name.trim()} is now in the staff directory.`,
      });
      onCreated();
      notifyDataChanged();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        if (!Object.keys(err.fieldErrors).length) setError(err.message);
      } else {
        setError("That member of staff could not be saved.");
      }
    } finally {
      setSaving(false);
    }
  };

  const access = ACCESS_LABELS[ACCESS_BY_TITLE[form.title] ?? "staff"] ?? "Staff";

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Add staff member"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        style={{
          width: "min(640px, 94vw)",
          height: "min(620px, 90vh)",
          minHeight: "min(620px, 90vh)",
          maxHeight: "min(620px, 90vh)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 18,
          overflow: "hidden",
          background: "rgba(20, 21, 26, 0.94)",
          backdropFilter: "blur(36px) saturate(190%)",
          WebkitBackdropFilter: "blur(36px) saturate(190%)",
          border: "1px solid var(--border-strong)",
          boxShadow: "0 28px 72px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        }}
      >
        <div
          className="modal-header"
          style={{
            padding: "16px 22px 14px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(24, 25, 32, 0.88)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <h2 className="panel-title">Add staff member</h2>
            <p className="panel-subtitle" style={{ margin: "2px 0 0" }}>
              Create a profile for an educator or officer with automated login credentials.
            </p>
          </div>
          <button
            type="button"
            className="search-clear"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 22px" }}>
          {error && (
            <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div className="form-grid">
            <label style={{ gridColumn: "span 2" }}>
              Full name *
              <input
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="e.g. Ananya Iyer"
                autoFocus
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </label>
            <label>
              Staff USN
              <input
                value={form.usn}
                onChange={(event) => set("usn", event.target.value)}
                placeholder="Generated if left blank"
              />
              <span className="field-hint">e.g. STF1001</span>
              {fieldErrors.usn && <span className="field-error">{fieldErrors.usn}</span>}
            </label>
            <label>
              Email address *
              <input
                type="email"
                value={form.email}
                onChange={(event) => set("email", event.target.value)}
                placeholder="name@globalkids.edu"
              />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </label>
            <label>
              Phone number
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => set("phone", event.target.value)}
                placeholder="+91 Mobile number"
              />
              {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
            </label>
            <label>
              Role / Designation *
              <FormSelect
                value={form.title}
                onChange={(val) => set("title", val)}
                options={TITLES.map((title) => ({ value: title, label: title }))}
                placeholder="Select role…"
                error={fieldErrors.role}
              />
              <span className="field-hint" style={{ marginTop: 4 }}>Grants {access.toLowerCase()} access.</span>
              {fieldErrors.role && <span className="field-error">{fieldErrors.role}</span>}
            </label>
            <label>
              Department *
              <FormSelect
                value={form.department}
                onChange={(val) => set("department", val)}
                options={DEPARTMENTS.map((department) => ({
                  value: department,
                  label: department,
                }))}
                placeholder="Select department…"
                error={fieldErrors.department}
              />
              {fieldErrors.department && (
                <span className="field-error">{fieldErrors.department}</span>
              )}
            </label>
            <label>
              Joining date *
              <input
                type="date"
                value={form.joined_on}
                onChange={(event) => set("joined_on", event.target.value)}
              />
              {fieldErrors.joined_on && <span className="field-error">{fieldErrors.joined_on}</span>}
            </label>
            <label className="checkbox-field" style={{ gridColumn: "span 2", marginTop: 4 }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => set("active", event.target.checked)}
              />
              Active — keeps their sign-in active and shows them in the directory
            </label>
          </div>
        </div>

        <div
          className="modal-footer"
          style={{
            borderTop: "1px solid var(--border)",
            padding: "14px 22px",
            flexShrink: 0,
            background: "rgba(24, 25, 32, 0.88)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={() => void submit()} disabled={saving}>
            <Plus size={15} />
            {saving ? "Creating…" : "Create profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Plus, Shield, Sparkles, UserCheck, X } from "lucide-react";

import { usePageScrollLock } from "@/components/SmoothScroll";
import { ApiError } from "@/lib/student-directory";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { notifyDataChanged } from "@/lib/live-data";
import { FormSelect } from "./FormSelect";
import { DateDropdowns } from "./DateDropdowns";

/**
 * Three distinct roles permitted by school policy:
 * 1. Faculty (Teacher)
 * 2. Administrator (Administrative Staff)
 * 3. Principal (Super Admin / School Authority)
 */
export type StaffRole = "Faculty" | "Administrator" | "Principal";

const ROLE_OPTIONS = [
  { value: "Faculty", label: "Faculty (Teacher)" },
  { value: "Administrator", label: "Administrator (Staff)" },
  { value: "Principal", label: "Principal (School Authority)" },
];

const FACULTY_CLASSES = [
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
];

const ADMIN_DEPARTMENTS = [
  "School Leadership",
  "Administration & Operations",
  "Examination & Records",
  "Technology & IT",
];

const SUBJECTS = [
  "Mathematics",
  "Science & Physics",
  "English Literature",
  "Social Studies",
  "Hindi",
  "Computer Science & AI",
  "Physical Education",
  "Arts & Performing",
];

const ADMIN_MODULES = [
  { id: "students", label: "Student Directory & Admissions" },
  { id: "attendance", label: "Daily Attendance & Registers" },
  { id: "examinations", label: "Examination Schedules & Marks" },
  { id: "finance", label: "Fees, Payments & Ledger" },
  { id: "analytics", label: "School Performance Analytics" },
  { id: "reports", label: "Official Reports & Transcripts" },
];

export interface StaffCreateDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export function StaffCreateDialog({ onClose, onCreated }: StaffCreateDialogProps) {
  usePageScrollLock();

  const [role, setRole] = useState<StaffRole>("Faculty");
  const [form, setForm] = useState({
    name: "",
    usn: "",
    email: "",
    phone: "",
    department: "Grade 6",
    subject: "Mathematics",
    joined_on: new Date().toISOString().slice(0, 10),
    active: true,
  });

  // Scope permissions
  const [assignedGrades, setAssignedGrades] = useState<string[]>(["Grade 6", "Grade 7"]);
  const [selectedModules, setSelectedModules] = useState<string[]>([
    "students",
    "attendance",
    "examinations",
  ]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Issued credentials slip shown after creation
  const [issuedSlip, setIssuedSlip] = useState<{
    name: string;
    usn: string;
    email: string;
    role: string;
    department: string;
    password: string;
  } | null>(null);

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
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleRoleChange = (newRole: string) => {
    const r = newRole as StaffRole;
    setRole(r);
    if (r === "Faculty") {
      setForm((prev) => ({ ...prev, department: "Grade 6" }));
    } else {
      setForm((prev) => ({ ...prev, department: "Administration & Operations" }));
    }
  };

  const toggleGrade = (g: string) => {
    setAssignedGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const toggleModule = (modId: string) => {
    setSelectedModules((prev) =>
      prev.includes(modId) ? prev.filter((x) => x !== modId) : [...prev, modId]
    );
  };

  const submit = async () => {
    const local: Record<string, string> = {};
    if (!form.name.trim()) local.name = "Enter a full name.";
    if (!form.email.trim()) local.email = "Enter email address for official communication.";
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

      // Determine internal API role
      const apiRole = role === "Principal" ? "admin" : role === "Administrator" ? "staff" : "teacher";
      const designationTitle =
        role === "Faculty"
          ? `${form.subject} Faculty (${form.department})`
          : role === "Principal"
          ? "School Principal & Head of Institution"
          : `Administrator · ${form.department}`;

      // Generate a memorable initial password based on joining date or random pin
      const joiningClean = form.joined_on.replace(/-/g, "");
      const generatedPassword = `GGS@${joiningClean.slice(4)}${joiningClean.slice(0, 4)}`;

      // Write staff record to /api/staff
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
          designation: designationTitle,
          role: apiRole,
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

      const createdStaff = json.staff as { usn?: string; id?: string } | undefined;
      const createdUsn = createdStaff?.usn || form.usn.trim() || "STF-AUTO";

      // Show issued credentials slip
      setIssuedSlip({
        name: form.name.trim(),
        usn: createdUsn,
        email: form.email.trim(),
        role: role,
        department: form.department,
        password: generatedPassword,
      });

      toast.success("Staff profile & credentials created", {
        description: `${form.name.trim()} is now active in the staff registry with role ${role}.`,
      });

      onCreated();
      notifyDataChanged();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        if (!Object.keys(err.fieldErrors).length) setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "That member of staff could not be saved.");
      }
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = () => {
    if (!issuedSlip) return;
    const text = `Global Kids School Staff Credentials\nName: ${issuedSlip.name}\nRole: ${issuedSlip.role}\nDepartment: ${issuedSlip.department}\nUSN / Sign-in: ${issuedSlip.usn}\nEmail: ${issuedSlip.email}\nInitial Password: ${issuedSlip.password}\nPortal: https://ggs-erp.vercel.app`;
    navigator.clipboard.writeText(text);
    toast.success("Credentials copied to clipboard");
  };

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Add staff member"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="modal"
        style={{
          width: "min(680px, 94vw)",
          height: "min(720px, 92vh)",
          minHeight: "min(720px, 92vh)",
          maxHeight: "min(720px, 92vh)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 18,
          overflow: "hidden",
          background: "rgba(20, 21, 26, 0.95)",
          backdropFilter: "blur(36px) saturate(190%)",
          WebkitBackdropFilter: "blur(36px) saturate(190%)",
          border: "1px solid var(--border-strong)",
          boxShadow: "0 28px 72px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        }}
      >
        {/* Header */}
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
            <h2 className="panel-title">Add Staff Member</h2>
            <p className="panel-subtitle" style={{ margin: "2px 0 0" }}>
              Appoint faculty, administrators, or principals with automated login credentials.
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

        {/* Content Body */}
        <div className="modal-body" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 22px" }}>
          {issuedSlip ? (
            /* Credentials Confirmation Slip */
            <div className="space-y-5 animate-in fade-in duration-200" style={{ padding: "10px 4px" }}>
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  borderRadius: 14,
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "rgba(16, 185, 129, 0.2)",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <UserCheck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                    Profile Created & Password Generated
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "3px 0 0" }}>
                    The staff account is now provisioned. Share these credentials with {issuedSlip.name}.
                  </p>
                </div>
              </div>

              {/* Credential Slip Card */}
              <div
                style={{
                  borderRadius: 14,
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--border)",
                  padding: "20px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px 20px",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block" }}>
                    Staff Member
                  </span>
                  <strong style={{ fontSize: "14px", color: "#fff", display: "block", marginTop: 2 }}>
                    {issuedSlip.name}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block" }}>
                    Appointed Role
                  </span>
                  <span className="status-pill brand" style={{ marginTop: 2, display: "inline-block" }}>
                    {issuedSlip.role}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block" }}>
                    Sign-in Handle (USN)
                  </span>
                  <code style={{ fontSize: "13px", color: "var(--brand)", fontWeight: 700, display: "block", marginTop: 2 }}>
                    {issuedSlip.usn}
                  </code>
                </div>

                <div>
                  <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block" }}>
                    Official Email
                  </span>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)", display: "block", marginTop: 2 }}>
                    {issuedSlip.email}
                  </span>
                </div>

                <div style={{ gridColumn: "span 2", paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block" }}>
                    Temporary Portal Password
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 4,
                      background: "rgba(0,0,0,0.3)",
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <code style={{ fontSize: "14px", fontWeight: 700, color: "#10b981", letterSpacing: "0.06em" }}>
                      {issuedSlip.password}
                    </code>
                    <button
                      type="button"
                      className="secondary-button compact"
                      onClick={copyCredentials}
                      style={{ fontSize: "11px" }}
                    >
                      <Copy size={13} />
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <div className="space-y-5">
              {error && (
                <div className="notice notice-danger" role="alert" style={{ marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <div className="form-grid">
                {/* Full Name */}
                <label style={{ gridColumn: "span 2" }}>
                  Full name *
                  <input
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="e.g. Dr. Kavita Nair"
                    autoFocus
                  />
                  {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
                </label>

                {/* Staff USN */}
                <label>
                  Staff USN (Auto-generated if blank)
                  <input
                    value={form.usn}
                    onChange={(e) => set("usn", e.target.value)}
                    placeholder="e.g. STF1012"
                  />
                  {fieldErrors.usn && <span className="field-error">{fieldErrors.usn}</span>}
                </label>

                {/* Email Address */}
                <label>
                  Official email address *
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="name@globalkids.edu"
                  />
                  {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
                </label>

                {/* Phone Number */}
                <label>
                  Mobile phone number
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+91 Mobile number"
                  />
                </label>

                {/* Role / Designation: ONLY 3 Options */}
                <label>
                  Role / Designation *
                  <FormSelect
                    value={role}
                    onChange={handleRoleChange}
                    options={ROLE_OPTIONS}
                    placeholder="Select role…"
                  />
                </label>

                {/* Department / Class Selection */}
                <label>
                  {role === "Faculty" ? "Assigned Class / Grade *" : "Department *"}
                  <FormSelect
                    value={form.department}
                    onChange={(val) => set("department", val)}
                    options={
                      role === "Faculty"
                        ? FACULTY_CLASSES.map((c) => ({ value: c, label: c }))
                        : ADMIN_DEPARTMENTS.map((d) => ({ value: d, label: d }))
                    }
                    placeholder={role === "Faculty" ? "Select class…" : "Select department…"}
                  />
                </label>

                {/* Subject if Faculty */}
                {role === "Faculty" && (
                  <label>
                    Teaching Subject *
                    <FormSelect
                      value={form.subject}
                      onChange={(val) => set("subject", val)}
                      options={SUBJECTS.map((s) => ({ value: s, label: s }))}
                      placeholder="Select subject…"
                    />
                  </label>
                )}

                {/* Joining Date: 3 Dropdowns */}
                <label style={{ gridColumn: role === "Faculty" ? "span 1" : "span 2" }}>
                  Joining date *
                  <DateDropdowns
                    value={form.joined_on}
                    onChange={(val) => set("joined_on", val)}
                    defaultToToday
                    minYear={2015}
                    maxYear={2030}
                    error={fieldErrors.joined_on}
                  />
                </label>
              </div>

              {/* Integrated Access Scope Section */}
              <div
                style={{
                  marginTop: 18,
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Shield size={16} className="text-[var(--brand)]" />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>
                    Access Scope & Role Permissions
                  </span>
                </div>

                {role === "Faculty" ? (
                  <div>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: 10 }}>
                      Select all classes and student cohorts this faculty member can grade and review:
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {FACULTY_CLASSES.map((g) => {
                        const isSelected = assignedGrades.includes(g);
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => toggleGrade(g)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                              border: isSelected ? "1px solid var(--brand)" : "1px solid var(--border)",
                              background: isSelected ? "var(--brand-soft)" : "rgba(255,255,255,0.03)",
                              color: isSelected ? "var(--brand-strong)" : "var(--text-secondary)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              transition: "all 0.15s ease",
                            }}
                          >
                            {isSelected && <Check size={13} />}
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : role === "Administrator" ? (
                  <div>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: 10 }}>
                      Select the administrative dashboard modules this staff member can access:
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {ADMIN_MODULES.map((mod) => {
                        const isChecked = selectedModules.includes(mod.id);
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => toggleModule(mod.id)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: 500,
                              cursor: "pointer",
                              border: isChecked ? "1px solid var(--brand)" : "1px solid var(--border)",
                              background: isChecked ? "var(--brand-soft)" : "rgba(255,255,255,0.02)",
                              color: isChecked ? "var(--brand-strong)" : "var(--text-secondary)",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              textAlign: "left",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <span
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 4,
                                border: isChecked ? "1px solid var(--brand)" : "1px solid var(--border)",
                                background: isChecked ? "var(--brand)" : "transparent",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                flexShrink: 0,
                              }}
                            >
                              {isChecked && <Check size={10} />}
                            </span>
                            {mod.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                    <Sparkles size={16} className="text-amber-400" />
                    <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                      Full Institutional Authority: Principal has full access across all modules, academic cohorts, and school finance.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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
          {issuedSlip ? (
            <>
              <button type="button" className="secondary-button" onClick={copyCredentials}>
                <Copy size={14} />
                Copy Slip
              </button>
              <button type="button" className="primary-button" onClick={onClose}>
                Done
              </button>
            </>
          ) : (
            <>
              <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={() => void submit()} disabled={saving}>
                <Plus size={15} />
                {saving ? "Creating Profile…" : "Create Staff Profile"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

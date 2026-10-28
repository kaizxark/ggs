import { useEffect, useMemo, useRef, useState } from "react";
import { avatarTones } from "@/lib/school-data";
import {
  Check,
  Copy,
  ExternalLink,
  Maximize2,
  Minimize2,
  UserRound,
  X,
} from "lucide-react";

import { DrawerBackdrop } from "@/components/DrawerBackdrop";
import { toast } from "@/lib/toast";
import { ApiError, formatDate, initialsFor } from "@/lib/student-directory";
import {
  fetchStaffProfile,
  updateStaffProfile,
  type StaffDraft,
  type StaffProfilePayload,
} from "@/lib/staff-profile";
import {
  ALL_STAFF_SECTIONS,
  STAFF_SECTION_LABELS,
  type StaffSection,
} from "@shared/staff-access";

/**
 * One member of staff, in the same drawer as a pupil.
 *
 * ## Why this replaced the old panel
 *
 * The panel it replaced was decorative. It showed "Classes 6", "Tenure 4 yrs"
 * and "18 periods taught" for everybody in the school — numbers that were typed
 * into the component rather than read from the database — and its three tabs
 * raised a toast instead of opening anything.
 *
 * This is the pupil drawer's gesture applied to a colleague: a panel off the
 * right edge, wider than the staff directory's old one, with a control that
 * widens it further, a real tab strip fed by `api/staff-profile`, a skeleton
 * while the record arrives, a stated reason when the record could not be read,
 * and an edit dialog that writes through `PATCH /api/staff`.
 *
 * ## Every number here is read, not typed
 *
 * A staff record has no attendance of its own — the schema does not track it —
 * so the drawer does not show one. It shows the things the record does know:
 * how long they have been here, what they teach, which class they are
 * responsible for, and the state of their account. The old panel's "18 periods
 * taught" was the same for the principal and for somebody who joined last week.
 *
 * ## What the drawer does not decide
 *
 * Which tabs appear. That is the route's decision: it sends `sections`, and a
 * section absent from that list is absent because the caller may not read it —
 * not because this person has no data.
 */

export interface StaffDrawerTarget {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  initials: string;
  tone?: string;
}

interface StaffDrawerProps {
  staff: StaffDrawerTarget;
  onClose: () => void;
  /** Called after a successful edit so the directory can reload its rows. */
  onUpdated: () => void;
  onOpenAccountLogins?: () => void;
}

export function StaffDrawer({
  staff,
  onClose,
  onUpdated,
  onOpenAccountLogins,
}: StaffDrawerProps) {
  const [detail, setDetail] = useState<StaffProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<StaffSection>("personal");
  const [wide, setWide] = useState(false);
  const [editing, setEditing] = useState(false);

  /*
   * Escape and the scroll lock live in `DrawerBackdrop`, as they do for the
   * pupil drawer: this app scrolls `.main-area`, so hiding the body's overflow
   * would leave the directory sliding along behind the panel.
   */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    setLoading(true);
    setFailed(null);
    setDetail(null);
    setTab("personal");
    fetchStaffProfile(staff.id, controller.signal)
      .then((data) => {
        if (!live) return;
        setDetail(data);
        // The first section the server actually sent, which is not necessarily
        // "personal": a caller refused that section must not land on an empty
        // tab.
        setTab(data.sections[0] ?? "personal");
      })
      .catch((err) => {
        if (!live || controller.signal.aborted) return;
        setFailed(
          err instanceof ApiError
            ? err.message
            : "This record could not be loaded. Check your connection and try again."
        );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [staff.id, reloadKey]);

  const record = detail?.staff;
  const account = detail?.account ?? null;
  const teaching = detail?.teaching ?? null;

  const subjectCount = teaching?.subjects.length ?? 0;
  const classTeacherOf = teaching?.class_teacher_of.length ?? 0;

  /*
   * Classes they actually stand in front of, gathered across every subject
   * assignment. A teacher can teach one subject to four sections, and that is
   * four classes rather than one subject repeated.
   */
  const taughtClassCount = useMemo(() => {
    if (!teaching) return 0;
    const ids = new Set<string>();
    for (const subject of teaching.subjects) {
      for (const klass of subject.classes) {
        if (klass.classroom_id) ids.add(String(klass.classroom_id));
      }
    }
    return ids.size;
  }, [teaching]);

  const tenure = tenureFrom(record?.joined_on ?? null);

  const labels = detail?.section_labels ?? STAFF_SECTION_LABELS;

  /*
   * The tab strip follows the pupil drawer: while the record is in flight every
   * section is offered, and once it lands only the ones the server said this
   * caller may read are left. A tab that disappears is one the route refused,
   * never one that quietly rendered empty.
   */
  const allowed = detail ? new Set<string>(detail.sections) : null;
  const visibleTabs = ALL_STAFF_SECTIONS.filter((key) => !allowed || allowed.has(key));

  return (
    <>
      <DrawerBackdrop onClose={() => closeRef.current()} />
      <aside
        className={`profile-drawer pupil-drawer${wide ? " expanded" : ""}`}
        aria-label={`${staff.name} record`}
      >
        <div className="drawer-header">
          <div className="min-w-0">
            <p className="eyebrow">Staff record</p>
            <h3 className="truncate">{staff.name}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="drawer-expand"
              onClick={() => setWide((value) => !value)}
              aria-pressed={wide}
              aria-label={wide ? "Narrow the panel" : "Widen the panel"}
              title={wide ? "Narrow the panel" : "Widen the panel to show more"}
            >
              {wide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              className="drawer-expand"
              onClick={onClose}
              aria-label="Close staff record"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="drawer-avatar">
          <span className={`avatar avatar-lg ${avatarTones[staff.tone ?? "teal"] ?? avatarTones.teal}`}>
            {staff.initials || initialsFor(staff.name)}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-[var(--text-secondary)]">
              {record?.designation ?? staff.role}
            </p>
            <p className="truncate text-[12.5px] text-[var(--text-muted)]">
              {record?.department ?? staff.department}
              {record?.employee_code ? ` · ${record.employee_code}` : ""}
            </p>
          </div>
        </div>

        <div className="drawer-stats">
          <div>
            <span>Tenure</span>
            <strong className="text-[var(--brand)]">
              {loading ? "—" : tenure}
            </strong>
          </div>
          <div>
            <span>Subjects</span>
            <strong>{loading ? "—" : String(subjectCount)}</strong>
          </div>
          <div>
            <span>Class teacher</span>
            <strong>{loading ? "—" : String(classTeacherOf)}</strong>
          </div>
        </div>

        <div className="drawer-stats">
          <div>
            <span>Employee code</span>
            <strong>{record?.employee_code ?? "—"}</strong>
          </div>
          <div>
            <span>Joined</span>
            <strong>{record ? formatDate(record.joined_on) : "—"}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{record ? (record.active ? "Active" : "Inactive") : "—"}</strong>
          </div>
        </div>

        <div className="drawer-tabs scroll-x">
          {visibleTabs.map((key) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              {labels[key] ?? key}
            </button>
          ))}
        </div>

        <div className="pupil-drawer-body">
          {loading && (
            <div className="drawer-section">
              <div className="skeleton-line" style={{ width: "70%" }} />
              <div className="skeleton-line" style={{ width: "90%" }} />
              <div className="skeleton-line" style={{ width: "60%" }} />
            </div>
          )}

          {!loading && failed && (
            <div className="empty-state">
              <p className="panel-title">Record unavailable</p>
              <p className="panel-subtitle">
                {failed} The name and department above are from the directory
                and are still accurate.
              </p>
              <button
                className="secondary-button compact"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !failed && detail && (
            <StaffSectionBody
              tab={tab}
              detail={detail}
              taughtClassCount={taughtClassCount}
              onOpenAccountLogins={onOpenAccountLogins}
            />
          )}
        </div>

        <div className="drawer-footer">
          <button
            className="secondary-button compact"
            onClick={() =>
              void copyText(record?.email ?? staff.email, "Email address copied")
            }
          >
            <Copy size={14} />
            Copy email
          </button>
          {detail?.viewer.is_manager ? (
            <button
              className="primary-button compact"
              onClick={() => setEditing(true)}
            >
              <Check size={14} />
              Edit details
            </button>
          ) : (
            /*
             * Nothing is claimed until the route has answered. A note that
             * says "only an administrator can edit this" while the record is
             * still in flight tells a super admin they have no permission.
             */
            detail && (
              <span className="ml-auto text-[12px] text-[var(--text-muted)]">
                {detail.viewer.is_self
                  ? "This is your own record."
                  : "Only an administrator can edit this record."}
              </span>
            )
          )}
        </div>
      </aside>

      {editing && record && (
        <StaffEditDialog
          record={record}
          accessRole={account?.role ?? null}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setReloadKey((key) => key + 1);
            onUpdated();
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Section bodies
 * ------------------------------------------------------------------ */

function StaffSectionBody({
  tab,
  detail,
  taughtClassCount,
  onOpenAccountLogins,
}: {
  tab: StaffSection;
  detail: StaffProfilePayload;
  taughtClassCount: number;
  onOpenAccountLogins?: () => void;
}) {
  const record = detail.staff;
  const teaching = detail.teaching;
  const rows: Array<[string, string]> = [];
  const push = (label: string, value: string | number | null | undefined) => {
    const text =
      value === null || value === undefined || value === ""
        ? "—"
        : String(value);
    rows.push([label, text]);
  };

  if (tab === "personal") {
    push("Full name", record.name);
    push("Designation", record.designation);
    push("Department", record.department);
    push("Email", record.email);
    push("Phone", record.phone);
    push("Employee code", record.employee_code);
    push("Status", record.active ? "Active" : "Inactive");
  } else if (tab === "employment") {
    push("Employee code", record.employee_code);
    push("Joined on", formatDate(record.joined_on));
    push("Tenure", tenureFrom(record.joined_on));
    push("Designation", record.designation);
    push("Department", record.department);
    push("Status", record.active ? "Active" : "Inactive");
    if (teaching) {
      push(
        "Class teacher of",
        teaching.class_teacher_of.length
          ? teaching.class_teacher_of
              .map((klass) =>
                [klass.grade, klass.section].filter(Boolean).join(" ")
              )
              .join(", ")
          : null
      );
    }
  } else if (tab === "teaching") {
    const hasSubjects = Boolean(teaching?.subjects.length);
    const hasHomeroom = Boolean(teaching?.class_teacher_of.length);

    if (!hasSubjects && !hasHomeroom) {
      return (
        <div className="empty-state">
          <p className="panel-title">No classes assigned</p>
          <p className="panel-subtitle">
            This record is not linked to a subject, a section or a class yet.
            Assignments are made from Academics.
          </p>
        </div>
      );
    }

    teaching?.class_teacher_of.forEach((klass) => {
      push(
        `Class teacher · ${[klass.grade, klass.section].filter(Boolean).join(" ")}`,
        klass.room ? `Room ${klass.room}` : "Homeroom"
      );
    });
    teaching?.subjects.forEach((subject) => {
      const classes = subject.classes
        .map((klass) => [klass.grade, klass.section].filter(Boolean).join(" "))
        .filter(Boolean)
        .join(", ");
      push(
        `${subject.name}${subject.code ? ` (${subject.code})` : ""}`,
        classes || "No class assigned"
      );
      subject.classes.forEach((klass) => {
        if (!klass.is_primary) return;
        push(
          `Primary teacher · ${[klass.grade, klass.section].filter(Boolean).join(" ")}`,
          klass.room ? `Room ${klass.room}` : null
        );
      });
    });
    if (taughtClassCount > 0) {
      push("Classes taught", `${taughtClassCount} section${taughtClassCount === 1 ? "" : "s"}`);
    }
  } else if (tab === "account") {
    const account = detail.account;
    if (!account) {
      rows.push(["Sign-in", "No account information available"]);
    } else {
      push("Portal access", account.has_account ? "Enabled" : "Not created");
      push("Username", account.username);
      push("Sign-in email", account.email);
      push("Access level", account.role);
      push(
        "Password",
        account.revoked_at
          ? "Revoked"
          : account.must_set_password
            ? "Owner has not set one yet"
            : account.has_account
              ? "Chosen by the account holder"
              : null
      );
      push("Issued", account.issued_at ? formatDate(account.issued_at) : null);
      push(
        "Username set",
        account.username_chosen_at ? formatDate(account.username_chosen_at) : null
      );
      push(
        "Last rotated",
        account.last_rotated_at ? formatDate(account.last_rotated_at) : null
      );
      push("Status", account.status);
    }
  } else if (tab === "activity") {
    const entries = detail.activity ?? [];
    if (!entries.length) {
      rows.push(["Changes", "No edits recorded against this record"]);
    }
    entries.forEach((entry) => {
      push(
        `${formatDate(entry.created_at)} · ${describeAction(entry.action)}`,
        entry.actor_name ?? "Recorded automatically"
      );
    });
  }

  if (!rows.length) {
    return (
      <div className="empty-state">
        <p className="panel-subtitle">Nothing recorded in this section yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="drawer-facts">
        {rows.map(([label, value], index) => (
          <div className="drawer-fact" key={`${label}-${index}`}>
            <span className="summary-label">{label}</span>
            <span className="summary-value">{value}</span>
          </div>
        ))}
      </div>

      {tab === "account" && detail.account && (
        <div className="drawer-section">
          {detail.account.username && (
            <button
              onClick={() =>
                void copyText(
                  detail.account?.username ?? "",
                  "Username copied",
                  "There is no username on this account yet."
                )
              }
            >
              <UserRound size={15} />
              Copy username
              <Copy size={14} aria-hidden="true" />
            </button>
          )}
          {detail.viewer.is_manager && onOpenAccountLogins && (
            <button onClick={onOpenAccountLogins}>
              Account logins
              <ExternalLink size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Edit
 * ------------------------------------------------------------------ */

const ACCESS_ROLES = ["admin", "staff", "teacher", "accountant"] as const;

const ACCESS_LABELS: Record<string, string> = {
  admin: "Administrator",
  principal: "Principal",
  staff: "Staff",
  teacher: "Teacher",
  accountant: "Accountant",
  super_admin: "Super admin",
};

function StaffEditDialog({
  record,
  accessRole,
  onClose,
  onSaved,
}: {
  record: StaffProfilePayload["staff"];
  accessRole: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: record.name ?? "",
    email: record.email ?? "",
    phone: record.phone ?? "",
    designation: record.designation ?? "",
    department: record.department ?? "",
    joined_on: record.joined_on ?? "",
    active: record.active,
    role: accessRole ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const submit = async () => {
    const local: Record<string, string> = {};
    if (!form.name.trim()) local.name = "Enter a name.";
    if (!form.email.trim())
      local.email = "Enter the address they sign in with.";
    if (form.joined_on && !/^\d{4}-\d{2}-\d{2}$/.test(form.joined_on))
      local.joined_on = "Use YYYY-MM-DD.";
    if (Object.keys(local).length) {
      setFieldErrors(local);
      return;
    }

    const draft: StaffDraft = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      designation: form.designation.trim(),
      department: form.department.trim(),
      joined_on: form.joined_on || undefined,
      active: form.active,
    };
    /*
     * The access level is only sent when it was changed. Saving a phone number
     * must not quietly rewrite somebody's role — the server treats a role it
     * receives as an instruction, and an unchanged value sent along with every
     * edit would be an instruction to keep it, at best.
     */
    if (form.role && form.role !== (accessRole ?? "")) draft.role = form.role;

    setSaving(true);
    setError(null);
    try {
      await updateStaffProfile(record.id, draft);
      toast.success("Staff record updated");
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        if (!Object.keys(err.fieldErrors).length) setError(err.message);
      } else {
        setError("That record could not be saved.");
      }
    } finally {
      setSaving(false);
    }
  };

  /* A current role the grantable list does not cover is still offered, so the
     select cannot show a value that differs from the record it edits. */
  const roleOptions = Array.from(
    new Set([...ACCESS_ROLES, form.role].filter(Boolean))
  );

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Edit staff record"
    >
      <div className="modal modal-wide">
        <div className="modal-header">
          <h2 className="panel-title">Edit {record.name}</h2>
        </div>

        <div className="modal-body">
          <p className="panel-subtitle">
            Changes are recorded in the audit history with your name against
            them. The sign-in address is how this person proves the account is
            theirs, so changing it changes the address they sign in with.
          </p>

          {error && (
            <div className="notice notice-danger" role="alert">
              {error}
            </div>
          )}

          <div className="form-grid">
            <label>
              Full name
              <input
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                autoFocus
              />
              {fieldErrors.name && (
                <span className="field-error">{fieldErrors.name}</span>
              )}
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => set("email", event.target.value)}
              />
              {fieldErrors.email && (
                <span className="field-error">{fieldErrors.email}</span>
              )}
            </label>
            <label>
              Phone
              <input
                value={form.phone}
                onChange={(event) => set("phone", event.target.value)}
              />
              {fieldErrors.phone && (
                <span className="field-error">{fieldErrors.phone}</span>
              )}
            </label>
            <label>
              Designation
              <input
                value={form.designation}
                onChange={(event) => set("designation", event.target.value)}
              />
              {fieldErrors.designation && (
                <span className="field-error">{fieldErrors.designation}</span>
              )}
            </label>
            <label>
              Department
              <input
                value={form.department}
                onChange={(event) => set("department", event.target.value)}
              />
              {fieldErrors.department && (
                <span className="field-error">{fieldErrors.department}</span>
              )}
            </label>
            <label>
              Joined on
              <input
                type="date"
                value={form.joined_on}
                onChange={(event) => set("joined_on", event.target.value)}
              />
              {fieldErrors.joined_on && (
                <span className="field-error">{fieldErrors.joined_on}</span>
              )}
            </label>
            <label>
              Access level
              <select
                value={form.role}
                onChange={(event) => set("role", event.target.value)}
              >
                {!form.role && <option value="">Not set</option>}
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {ACCESS_LABELS[role] ?? role}
                  </option>
                ))}
              </select>
              {fieldErrors.role && (
                <span className="field-error">{fieldErrors.role}</span>
              )}
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => set("active", event.target.checked)}
              />
              Active — keeps their sign-in and shows them in the directory
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** "4 yrs 2 mo" from a joining date, or an em dash. */
function tenureFrom(joinedOn: string | null | undefined): string {
  if (!joinedOn) return "—";
  const start = new Date(`${joinedOn}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "—";
  const now = new Date();
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0 && rest === 0) return "New";
  if (years === 0) return `${rest} mo`;
  return rest ? `${years} yrs ${rest} mo` : `${years} yrs`;
}

/** An audit action as a phrase somebody can read. */
function describeAction(action: string | null): string {
  const key = String(action ?? "change").replace(/^staff\./, "");
  if (key === "create" || key === "insert") return "Record created";
  if (key === "update" || key === "patch") return "Details updated";
  if (key === "delete") return "Record removed";
  return key.replace(/_/g, " ");
}

async function copyText(
  value: string,
  message: string,
  missing = "There is nothing on this record to copy."
) {
  if (!value) {
    toast.error(missing);
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message, { description: value });
  } catch {
    toast.error("This browser would not let the page copy to the clipboard.");
  }
}

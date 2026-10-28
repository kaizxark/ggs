import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";

/**
 * Every account in the school, and the credentials behind them.
 *
 * Reachable only by the school owner. The route behind it checks the caller's
 * immutable user id rather than a role, and the database has a policy that
 * admits the same one id and no other, so this screen being visible here is a
 * convenience rather than the thing keeping the passwords private.
 *
 * ## Why it is on one screen rather than two
 *
 * A school asking "what is Ahmed's login?" usually does not care whether he is
 * a pupil or a member of staff, and splitting them meant two searches for one
 * question. The filter is there instead, which answers the same question in a
 * click and keeps one list to read rather than two to reconcile.
 *
 * ## The password column
 *
 * It is shown because the owner has to be able to read it back to somebody over
 * the telephone. That is a real trade: it means a database read yields working
 * passwords rather than hashes. It is made defensible by the owner-only policy,
 * by the audit row written on every load, and by the warning at the top of this
 * screen, so that whoever is looking understands what they are holding.
 */

export interface PortalAccountRow {
  kind: "student" | "staff";
  recordId: string;
  name: string;
  detail: string;
  username: string;
  password: string;
  /**
   * True when the password shown is recomputed from the record rather than
   * read from a stored credential — a member of staff today. Marked on screen so
   * nobody is misled if the person has since changed it.
   */
  derived: boolean;
  email: string;
  issuedAt: string;
}

interface Summary {
  pupils: number;
  staff: number;
  withAccount: number;
  noAddress: number;
}

/** The school's shared pupil sign-in name, as the server reports it. */
interface SharedName {
  sharedUsername: string;
  onSharedName: number;
  withOwnName: number;
  /** How many profiles the last save moved onto the name. */
  applied?: number;
}

const FIELD =
  "w-full h-11 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)]";

export default function CredentialsView({ onBack }: { onBack: () => void }) {
  const [accounts, setAccounts] = useState<PortalAccountRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [shared, setShared] = useState<SharedName | null>(null);
  const [sharedDraft, setSharedDraft] = useState("");
  const [savingShared, setSavingShared] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "student" | "staff" | "missing">(
    "all"
  );
  const [revealed, setRevealed] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("You are not signed in.");
        return;
      }
      const res = await fetch("/api/portal-admin?action=all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        accounts?: PortalAccountRow[];
        summary?: Summary;
        message?: string;
      };
      if (!res.ok) {
        setError(json.message ?? "Those credentials could not be loaded.");
        return;
      }
      setAccounts(json.accounts ?? []);
      setSummary(json.summary ?? null);

      /*
       * The shared sign-in name is read separately: it is a setting rather
       * than a row, and the screen needs it whether or not the credentials
       * above loaded.
       */
      const sharedRes = await fetch("/api/portal-admin?action=shared-name", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (sharedRes.ok) {
        const sharedJson = (await sharedRes.json()) as SharedName;
        setShared(sharedJson);
        setSharedDraft(sharedJson.sharedUsername ?? "");
      }
    } catch {
      setError("Cannot reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runBackfill = async () => {
    setBackfilling(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/portal-admin?action=backfill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        emailsChanged?: Record<string, number>;
        placeholdersIssued?: Record<string, number>;
        accountsProvisioned?: Record<string, number>;
        testAddresses?: { email: string; record: string }[];
        message?: string;
      };
      if (!res.ok) {
        toast.error(json.message ?? "The backfill could not run.");
        return;
      }
      const placeholders =
        (json.placeholdersIssued?.students ?? 0) +
        (json.placeholdersIssued?.staff ?? 0);
      const made =
        (json.accountsProvisioned?.students ?? 0) +
        (json.accountsProvisioned?.staff ?? 0);
      toast.success("Backfill complete", {
        description: `${placeholders} placeholder addresses issued, ${made} accounts created.`,
      });
      for (const test of json.testAddresses ?? []) {
        toast.message(`${test.email} → ${test.record}`);
      }
      await load();
    } catch {
      toast.error("Cannot reach the server.");
    } finally {
      setBackfilling(false);
    }
  };

  /**
   * Change the name every pupil signs in with.
   *
   * Saving it puts every pupil who has not chosen a name of their own onto
   * it, and leaves the ones who have. A pupil who has chosen a name keeps it:
   * their name is theirs.
   */
  const saveSharedName = async () => {
    const wanted = sharedDraft.trim().toLowerCase();
    if (!wanted) {
      toast.error("Enter the sign-in name for pupils.");
      return;
    }
    setSavingShared(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/portal-admin?action=shared-name", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sharedUsername: wanted }),
      });
      const json = (await res.json()) as SharedName & { message?: string };
      if (!res.ok) {
        toast.error(json.message ?? "That name could not be saved.");
        return;
      }
      setShared(json);
      setSharedDraft(json.sharedUsername ?? wanted);
      toast.success("Sign-in name saved", {
        description: `${json.applied ?? 0} pupil${
          (json.applied ?? 0) === 1 ? "" : "s"
        } now sign in with it.`,
      });
      await load();
    } catch {
      toast.error("Cannot reach the server.");
    } finally {
      setSavingShared(false);
    }
  };

  /**
   * Put every pupil's password back to their date of birth.
   *
   * This is the one-off that makes the scheme true of every account, and it
   * overwrites anything a pupil has changed on purpose — so it is a separate
   * button rather than something the backfill does as it goes.
   */
  const resetPupilPasswords = async () => {
    setResetting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch(
        "/api/portal-admin?action=reset-pupil-passwords",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        }
      );
      const json = (await res.json()) as {
        reset?: number;
        skipped?: number;
        message?: string;
      };
      if (!res.ok) {
        toast.error(json.message ?? "That could not be done.");
        return;
      }
      toast.success("Passwords reset", {
        description: json.message ?? `${json.reset ?? 0} pupils updated.`,
      });
      await load();
    } catch {
      toast.error("Cannot reach the server.");
    } finally {
      setResetting(false);
    }
  };

  const needle = query.trim().toLowerCase();
  const rows = accounts.filter(row => {
    if (filter === "student" && row.kind !== "student") return false;
    if (filter === "staff" && row.kind !== "staff") return false;
    if (filter === "missing" && row.password) return false;
    if (!needle) return true;
    return [row.name, row.username, row.email, row.detail]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(needle));
  });

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  };

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <p className="eyebrow">System</p>
          <h1 className="page-title">Account logins</h1>
          <p className="page-subtitle">
            {summary
              ? `${summary.pupils} pupil${summary.pupils === 1 ? "" : "s"} · ${summary.staff} staff · ${summary.withAccount} ready to sign in`
              : "Every pupil and staff account in this school."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="secondary-button compact"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            className="primary-button"
            onClick={runBackfill}
            disabled={backfilling}
          >
            {backfilling ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <KeyRound size={16} />
            )}
            Run backfill
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-[#3a3020] bg-[#2a2416]/60 px-3.5 py-3 text-[12.5px] text-[#d9c48a]">
        <AlertTriangle size={15} className="mt-px flex-shrink-0" />
        <p className="leading-5">
          These are working passwords, not reset links. Every visit to this
          screen is written to the audit log with your name and the time. Do not
          share the list, and hand a family their details over the telephone
          rather than by message.
        </p>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Pupil sign-in</p>
            <h2 className="panel-title">The name every pupil uses</h2>
          </div>
          {shared && (
            <span className="count-badge success">
              <Users size={13} className="mr-1 inline" />
              {shared.onSharedName} on it · {shared.withOwnName} own
            </span>
          )}
        </div>
        <div className="px-5 pb-5 pt-4">
          <p className="text-[12.5px] leading-5 text-[var(--text-muted)]">
            A pupil types this name and their date of birth, and is in. It is
            one name for the whole school, held in one place rather than copied
            onto a hundred records. Saving it puts every pupil who has not
            chosen a name of their own onto it — a pupil who has chosen one
            keeps it.
          </p>
          <div className="form-grid mt-4">
            <label className="block">
              Sign-in name for pupils
              <input
                value={sharedDraft}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={event => setSharedDraft(event.target.value)}
                placeholder="kaizxark@gmail.com"
              />
            </label>
          </div>
          <div className="dialog-actions mt-4">
            <button
              className="primary-button"
              onClick={() => void saveSharedName()}
              disabled={savingShared}
            >
              {savingShared ? "Saving…" : "Save and apply to pupils"}
            </button>
            <button
              className="secondary-button"
              onClick={() => void resetPupilPasswords()}
              disabled={resetting}
              title="Writes every pupil's password as their date of birth again. A pupil who has changed their password will lose that change."
            >
              {resetting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CalendarDays size={15} />
              )}
              Reset pupil passwords to their date of birth
            </button>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-[var(--text-faint)]">
            The second button overwrites anything a pupil has changed on
            purpose. Use it once, to make every account match the school&apos;s
            way of signing in — not as a matter of routine.
          </p>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Credentials</p>
            <h2 className="panel-title">
              {revealed ? "Passwords visible" : "Passwords hidden"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none"
              />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search name, username or address"
                aria-label="Search accounts"
                className={`${FIELD} pl-9 w-64`}
              />
            </div>
            <select
              value={filter}
              onChange={event => setFilter(event.target.value as typeof filter)}
              aria-label="Filter accounts"
              className={`${FIELD} w-36`}
            >
              <option value="all">Everyone</option>
              <option value="student">Pupils</option>
              <option value="staff">Staff</option>
              <option value="missing">No password</option>
            </select>
            <button
              className="secondary-button compact"
              onClick={() => setRevealed(value => !value)}
              aria-pressed={revealed}
            >
              {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
              {revealed ? "Hide" : "Reveal"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="px-6 py-10 text-center text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-[var(--text-muted)]">
            <Loader2 size={16} className="animate-spin" /> Loading credentials…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--text-muted)]">
            No accounts match that search.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Username</th>
                  <th>Password</th>
                  <th>Email address</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={`${row.kind}-${row.recordId}`}>
                    <td>
                      <span className="font-medium text-[var(--text-primary)]">
                        {row.name}
                      </span>
                      <span className="muted-cell block text-[12px]">
                        {row.detail}
                      </span>
                    </td>
                    <td className="muted-cell">
                      {row.kind === "student" ? "Pupil" : "Staff"}
                    </td>
                    <td>
                      <Copyable value={row.username} label="Username" />
                    </td>
                    <td>
                      <Copyable
                        value={revealed ? row.password : "••••••••••••"}
                        label="Password"
                        masked={!revealed}
                      />
                    </td>
                    <td className="muted-cell">{row.email}</td>
                    <td>
                      {!row.password ? (
                        <span className="status-pill warning">No password</span>
                      ) : row.derived ? (
                        <span
                          className="status-pill neutral"
                          title="Recomputed from the record. If they have changed it, this no longer matches."
                        >
                          From record
                        </span>
                      ) : (
                        <span className="status-pill success">Set</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {summary && summary.noAddress > 0 && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Needs an address</p>
              <h2 className="panel-title">
                {summary.noAddress} records have no usable address
              </h2>
            </div>
          </div>
          <p className="px-6 pb-6 text-[12.5px] leading-5 text-[var(--text-muted)]">
            Sign-in is by emailed code, so a record with no address is a record
            nobody can reach. Run the backfill to give each one a placeholder in
            the reserved{" "}
            <code className="text-[var(--text-secondary)]">.invalid</code>{" "}
            domain — inert, undeliverable, and replaceable with a real address
            later. It also creates the missing accounts and attaches the test
            addresses to the first pupils in admission order.
          </p>
        </section>
      )}
    </div>
  );
}

function Copyable({
  value,
  label,
  masked,
}: {
  value: string;
  label: string;
  masked?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <code
        className={`font-mono text-[12.5px] ${masked ? "tracking-widest text-[var(--text-faint)]" : "text-[var(--text-hover)]"}`}
      >
        {value}
      </code>
      <button
        type="button"
        className="tiny-action"
        onClick={() =>
          navigator.clipboard
            .writeText(value)
            .then(() => toast.success(`${label} copied`))
            .catch(() => toast.error("Could not copy"))
        }
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        <Copy size={12} />
      </button>
    </span>
  );
}

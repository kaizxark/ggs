import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";
import {
  getRecoverySession,
  isRecoverySession,
  updatePassword,
} from "../lib/supabase";

/**
 * The page a password-recovery link lands on.
 *
 * This was previously a mode inside the login screen, which produced two bad
 * outcomes. Someone who opened the link on a phone and then typed out the
 * address by hand — the normal thing to want after the token expires — had no
 * way to get back to it, and the "you followed a recovery link" panel was
 * indistinguishable from a normal sign-in when the token was stale. A dedicated
 * route can be bookmarked, re-typed, and linked to from the email.
 *
 * The token is exchanged for a session asynchronously by supabase-js on load,
 * so "no session yet" is not the same as "invalid link". That distinction is
 * the whole reason this page waits instead of deciding immediately, and why it
 * never shows an expired-link message before the wait has finished.
 */

/** Minimum length Supabase enforces server-side. */
const MIN_LENGTH = 8;

interface Rule {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

/**
 * The rules shown to the person choosing a password.
 *
 * Only the length rule is enforced by Supabase; the rest are here because a
 * school admin account is worth protecting, and a checklist that stays greyed
 * out until the password is good teaches the standard far better than a single
 * error after a rejected submit.
 */
const RULES: Rule[] = [
  { id: "length", label: `At least ${MIN_LENGTH} characters`, test: (v) => v.length >= MIN_LENGTH },
  { id: "case", label: "An upper and a lower case letter", test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { id: "number", label: "A number", test: (v) => /\d/.test(v) },
];

type Phase = "checking" | "ready" | "expired" | "done";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // A link can arrive without any recovery marker at all (someone typed the
  // address in, or pasted the wrong half of a URL). That is not "expired".
  const [hadRecoveryParams] = useState(isRecoverySession);

  useEffect(() => {
    let cancelled = false;
    void getRecoverySession().then((session) => {
      if (cancelled) return;
      setPhase(session ? "ready" : "expired");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const failed = useMemo(
    () => RULES.filter((rule) => !rule.test(password)),
    [password]
  );

  const canSubmit =
    password.length > 0 && failed.length === 0 && password === confirm;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (failed.length > 0) {
      setError(`Still to do: ${failed[0].label.toLowerCase()}.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (result.status === "error") {
      // An expired token is not a wrong password — sending someone back to the
      // form to try again would just fail identically.
      if (result.message.toLowerCase().includes("no longer valid")) {
        setPhase("expired");
        return;
      }
      setError(result.message);
      return;
    }
    setPhase("done");
    window.setTimeout(() => setLocation("/dashboard"), 1200);
  };

  return (
    <div
      className="min-h-screen bg-[#0b0c10] relative flex items-center justify-center px-4 overflow-hidden"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-[var(--brand)]/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-200px] right-[-120px] h-[380px] w-[380px] rounded-full bg-[var(--violet)]/[0.05] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Global Kids School" className="h-20 w-auto rounded-full" />
          <p className="mt-4 text-[12.5px] font-semibold text-[var(--text-muted)] tracking-[0.14em] uppercase">
            School OS · Admin Portal
          </p>
        </div>

        <div className="bg-[#121419]/90 border border-[#232830] rounded-2xl p-8 shadow-2xl shadow-black/50 backdrop-blur">
          {phase === "checking" && (
            <div className="flex flex-col items-center py-6 text-center">
              <Loader2 size={22} className="animate-spin text-[var(--brand)]" />
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                Checking your recovery link…
              </p>
            </div>
          )}

          {phase === "expired" && (
            <>
              <div className="flex items-center gap-2.5 mb-3">
                <AlertCircle size={18} className="flex-shrink-0 text-[var(--danger)]" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  This link has expired
                </h2>
              </div>
              <p className="text-[var(--text-muted)] text-sm mb-6 leading-relaxed">
                {hadRecoveryParams
                  ? "Recovery links are only valid for a short time, and only once. Nothing has changed on your account — request a fresh link and use it straight away."
                  : "This page needs a recovery link from your email. Open the most recent \"reset your password\" email from Global Kids School and follow the link in it."}
              </p>
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="w-full bg-[#3fb8a2] hover:bg-[#2ea894] text-white font-semibold py-2.5 rounded-lg transition shadow-[0_0_24px_rgba(63,184,162,.25)]"
              >
                Request a new link
              </button>
            </>
          )}

          {phase === "done" && (
            <div className="flex flex-col items-center py-6 text-center">
              <Check size={22} className="text-[var(--brand)]" />
              <h2 className="mt-4 text-lg font-bold text-[var(--text-primary)]">
                Password updated
              </h2>
              <p className="mt-2 text-[var(--text-muted)] text-sm">
                Taking you to the dashboard…
              </p>
            </div>
          )}

          {phase === "ready" && (
            <>
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">
                Choose a new password
              </h2>
              <p className="text-[var(--text-muted)] text-sm mb-6">
                Pick something you have not used here before.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-[12.5px] font-medium text-[var(--text-muted)] mb-1.5"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none"
                    />
                    <input
                      id="new-password"
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      autoFocus
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg py-2.5 pl-9 pr-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-muted)] transition p-0.5"
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {password.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {RULES.map((rule) => {
                      const ok = rule.test(password);
                      return (
                        <li
                          key={rule.id}
                          className={`flex items-center gap-2 text-[12.5px] ${
                            ok ? "text-[var(--brand)]" : "text-[var(--text-faint)]"
                          }`}
                        >
                          <Check
                            size={12}
                            className={ok ? "opacity-100" : "opacity-0"}
                          />
                          {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-[12.5px] font-medium text-[var(--text-muted)] mb-1.5"
                  >
                    Confirm new password
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none"
                    />
                    <input
                      id="confirm-password"
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => {
                        setConfirm(e.target.value);
                        setError("");
                      }}
                      aria-invalid={confirm.length > 0 && confirm !== password}
                      className={`w-full bg-[var(--bg-input)] border rounded-lg py-2.5 pl-9 pr-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:ring-2 transition ${
                        confirm.length > 0 && confirm !== password
                          ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/20"
                          : "border-[#2a2e36] focus:border-[var(--brand)] focus:ring-[var(--brand)]/20"
                      }`}
                    />
                  </div>
                  {confirm.length > 0 && confirm !== password && (
                    <p className="mt-1.5 text-[12.5px] text-[var(--danger)]">
                      The two passwords do not match.
                    </p>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-[var(--danger)] text-[12.5px] bg-[#2a1a18]/60 border border-[#3a2020] rounded-lg px-3 py-2">
                    <AlertCircle size={14} className="flex-shrink-0 mt-px" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="w-full bg-[#3fb8a2] hover:bg-[#2ea894] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-primary)] font-semibold py-2.5 rounded-lg transition shadow-[0_0_24px_rgba(63,184,162,.25)] flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save new password"
                  )}
                </button>
              </form>
            </>
          )}

          {phase !== "done" && (
            <button
              type="button"
              onClick={() => setLocation("/login")}
              className="mt-5 w-full flex items-center justify-center gap-1.5 text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
            >
              <ArrowLeft size={13} /> Back to sign in
            </button>
          )}
        </div>

        <p className="mt-5 text-center text-[var(--text-faint)] text-[12.5px]">
          Global Kids School · Tumakuru
        </p>
      </div>
    </div>
  );
}

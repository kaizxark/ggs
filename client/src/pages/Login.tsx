import { useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  AtSign,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import {
  resetPasswordByUsername,
  signInWithUsername,
  verifySignInCode,
} from "../lib/supabase";

/**
 * Sign in with a username, a password and a code.
 *
 * The order is deliberate:
 *
 *   password — the username and the date-of-birth password. Students and staff get
 *              no session here; the route mails a code and returns nothing
 *              that can be used on its own.
 *   otp      — the six digits from that email. Only this step installs a
 *              session for a student or member of staff.
 *   forgot   — a reset link, for anyone who cannot remember their password.
 *
 * Admin, super-admin and parent accounts still finish at the password step.
 * They have no record email to prove, so requiring a code would lock them out
 * of their own accounts.
 */

type Mode = "password" | "otp" | "forgot";

export default function Login() {
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<Mode>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [otpEmailHint, setOtpEmailHint] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const go = (next: Mode) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  /* ---------------------------- password ---------------------------- */

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    if (username.includes("@")) {
      setError("Enter your username, not an email address.");
      return;
    }
    setLoading(true);
    const result = await signInWithUsername(username, password);
    setLoading(false);
    if (result.status === "ok") {
      setLocation("/dashboard");
      return;
    }
    if (result.status === "otp") {
      setCode("");
      setOtpEmailHint(result.emailHint);
      go("otp");
      setNotice(result.message);
      return;
    }
    if (result.status === "invalid") {
      setError("That username and password do not match an account.");
      return;
    }
    setError(result.message);
  };

  /* ------------------------------ otp ------------------------------- */

  const checkCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (code.trim().length < 6) {
      setError("Enter the six-digit code from the email.");
      return;
    }
    setLoading(true);
    const result = await verifySignInCode(username, code);
    setLoading(false);

    if (result.status === "ok") {
      setLocation("/dashboard");
      return;
    }
    setError(result.message);
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!username.trim()) {
      setError("Enter your username.");
      return;
    }
    if (username.includes("@")) {
      setError("Enter your username, not an email address.");
      return;
    }
    setLoading(true);
    const result = await resetPasswordByUsername(username);
    setLoading(false);
    if (result.status === "ok") setNotice(result.message);
    else setError(result.message);
  };

  /* ------------------------------ render ------------------------------ */

  const heading: Record<Mode, { title: string; blurb?: string }> = {
    password: {
      title: "Sign in",
    },
    otp: {
      title: "Check your email",
      blurb: otpEmailHint
        ? `We sent a six-digit code to ${otpEmailHint}.`
        : "We sent a six-digit code to the email on your record.",
    },
    forgot: {
      title: "Reset your password",
      blurb:
        "Enter your username and we'll email a link to the address on your record.",
    },
  };

  const submit = (e: React.FormEvent) => {
    if (mode === "otp") return checkCode(e);
    if (mode === "forgot") return sendReset(e);
    return signIn(e);
  };

  const busyLabel =
    mode === "otp"
      ? "Checking…"
      : mode === "forgot"
        ? "Sending…"
        : "Signing in…";

  return (
    <div
      className="min-h-screen bg-[#0b0c10] relative flex items-center justify-center px-4 overflow-hidden"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-[var(--brand)]/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-200px] right-[-120px] h-[380px] w-[380px] rounded-full bg-[var(--violet)]/[0.05] blur-[100px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/global-kids-logo.svg"
            alt="Global Kids School"
            className="h-20 w-20 rounded-full"
          />
        </div>

        <div className="bg-[#121419]/90 border border-[#232830] rounded-2xl p-8 shadow-2xl shadow-black/50 backdrop-blur">
          <h2
            className={`text-lg font-bold text-[var(--text-primary)] ${
              heading[mode].blurb ? "mb-1" : "mb-6"
            }`}
          >
            {heading[mode].title}
          </h2>
          {heading[mode].blurb && (
            <p className="text-[var(--text-muted)] text-sm mb-6">
              {heading[mode].blurb}
            </p>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === "otp" && (
              <div className="space-y-1.5">
                <label
                  htmlFor="code"
                  className="block text-[12.5px] font-medium text-[var(--text-muted)]"
                >
                  Six-digit code
                </label>
                <div className="relative">
                  <ShieldCheck
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none"
                  />
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full h-12 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg py-2.5 pl-9 pr-3 text-sm tracking-[0.35em] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => go("password")}
                  className="text-[12.5px] text-[var(--brand)] hover:text-[var(--brand-strong)] font-medium"
                >
                  Use a different username or password
                </button>
              </div>
            )}

            {(mode === "password" || mode === "forgot") && (
              <>
                <Field
                  id="username"
                  label="Username"
                  icon={<AtSign size={15} />}
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={setUsername}
                />
              </>
            )}

            {mode === "password" && (
              <PasswordField
                id="password"
                label="Password"
                value={password}
                onChange={setPassword}
                show={showPassword}
                onToggle={() => setShowPassword(s => !s)}
                autoComplete="current-password"
              />
            )}

            {mode === "password" && (
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => go("forgot")}
                  className="text-[12.5px] text-[var(--brand)] hover:text-[var(--brand-strong)] font-medium"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-[var(--danger)] text-[12.5px] bg-[#2a1a18]/60 border border-[#3a2020] rounded-lg px-3 py-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {notice && (
              <div className="flex items-start gap-2 text-[var(--brand)] text-[12.5px] bg-[#1d3d35]/60 border border-[#1d3d35] rounded-lg px-3 py-2">
                <Check size={14} className="flex-shrink-0 mt-px" />
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3fb8a2] hover:bg-[#2ea894] disabled:opacity-70 text-[var(--text-primary)] font-semibold py-2.5 rounded-lg transition shadow-[0_0_24px_rgba(63,184,162,.25)] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {busyLabel}
                </>
              ) : mode === "otp" ? (
                "Verify and sign in"
              ) : mode === "forgot" ? (
                "Email me a reset link"
              ) : (
                "Sign in"
              )}
            </button>

            {mode === "otp" && (
              <button
                type="button"
                onClick={() => go("password")}
                className="w-full flex items-center justify-center gap-1.5 text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              >
                <Lock size={13} /> Back to password
              </button>
            )}

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => go("password")}
                className="w-full flex items-center justify-center gap-1.5 text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              >
                <ArrowLeft size={13} /> Back to sign in
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */

function Field(props: {
  id: string;
  label: string;
  icon: React.ReactNode;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  autoCapitalize?: string;
  autoCorrect?: string;
  spellCheck?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={props.id}
        className="block text-[12.5px] font-medium text-[var(--text-muted)]"
      >
        {props.label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none">
          {props.icon}
        </span>
        <input
          id={props.id}
          type={props.type}
          autoComplete={props.autoComplete}
          autoCapitalize={props.autoCapitalize}
          autoCorrect={props.autoCorrect}
          spellCheck={props.spellCheck}
          value={props.value}
          onChange={e => props.onChange(e.target.value)}
          className="w-full h-12 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition"
        />
      </div>
    </div>
  );
}

function PasswordField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={props.id}
        className="block text-[12.5px] font-medium text-[var(--text-muted)]"
      >
        {props.label}
      </label>
      <div className="relative">
        <Lock
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none"
        />
        <input
          id={props.id}
          type={props.show ? "text" : "password"}
          autoComplete={props.autoComplete}
          value={props.value}
          onChange={e => props.onChange(e.target.value)}
          className="w-full h-12 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg py-2.5 pl-9 pr-10 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition"
        />
        <button
          type="button"
          onClick={props.onToggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-muted)] transition p-0.5"
          aria-label={props.show ? "Hide password" : "Show password"}
        >
          {props.show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

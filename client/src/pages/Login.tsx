import { useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, ArrowLeft, Check, Eye, EyeOff, Loader2, Lock, AtSign } from "lucide-react";
import {
  resetPasswordByUsername,
  signInWithUsername,
} from "../lib/supabase";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // "signin" | "forgot". Choosing a new password lives on its own
  // /reset-password page, because that is where the emailed link lands and the
  // two have to stay reachable from each other.
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [notice, setNotice] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (mode === "forgot") {
      if (!username.trim()) {
        setError("Enter your username.");
        return;
      }
      setLoading(true);
      const result = await resetPasswordByUsername(username);
      setLoading(false);
      // Same message either way, so this can't be used to test whether a
      // username is registered.
      if (result.status === "ok") setNotice(result.message);
      else setError(result.message);
      return;
    }

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    const result = await signInWithUsername(username, password);
    setLoading(false);
    if (result.status === "ok") {
      // A session was issued and persisted by supabase-js — go in.
      setLocation("/dashboard");
      return;
    }
    if (result.status === "invalid") {
      setError("That username and password do not match an account.");
      return;
    }
    setError(result.message);
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] relative flex items-center justify-center px-4 overflow-hidden" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-[var(--brand)]/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-200px] right-[-120px] h-[380px] w-[380px] rounded-full bg-[var(--violet)]/[0.05] blur-[100px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Global Kids School" className="h-20 w-20 rounded-full" />
          <p className="mt-4 text-[12.5px] font-semibold text-[var(--text-muted)] tracking-[0.14em] uppercase">
            School OS · Admin Portal
          </p>
        </div>

        <div className="bg-[#121419]/90 border border-[#232830] rounded-2xl p-8 shadow-2xl shadow-black/50 backdrop-blur">
          {mode === "forgot" ? (
            <>
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Reset your password</h2>
              <p className="text-[var(--text-muted)] text-sm mb-6">
                Enter your username and we&apos;ll email you a link to choose a new
                password.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Dashboard Access</h2>
              <p className="text-[var(--text-muted)] text-sm mb-6">Sign in with your username</p>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {(
            <div>
              <label htmlFor="username" className="block text-[12.5px] font-medium text-[var(--text-muted)] mb-1.5">Username</label>
              <div className="relative">
                <AtSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                <input
                  id="username"
                  /* Not type="email": the value is a username, and the browser's
                     email validation would reject a legitimate one. */
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="firstname.lastname"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition"
                />
              </div>
              {mode === "signin" && (
                <p className="mt-1.5 text-[12.5px] text-[var(--text-faint)]">
                  Your username is the part of your email before the @.
                </p>
              )}
            </div>
            )}
            {mode === "signin" && (
            <div>
              <label htmlFor="password" className="block text-[12.5px] font-medium text-[var(--text-muted)] mb-1.5">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg py-2.5 pl-9 pr-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-muted)] transition p-0.5"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            )}

            {mode === "signin" && (
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}
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
            >                {loading ? (
                <><Loader2 size={16} className="animate-spin" />
                  {mode === "forgot" ? "Sending…" : "Signing in…"}</>
              ) : mode === "forgot" ? "Email me a reset link" : "Sign in"}
            </button>

            {mode !== "signin" && (
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); setNotice(""); }}
                className="w-full flex items-center justify-center gap-1.5 text-[12.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              >
                <ArrowLeft size={13} /> Back to sign in
              </button>
            )}
          </form>

          <p className="mt-5 text-center text-[var(--text-faint)] text-[12.5px]">Global Kids School · Tumakuru</p>
        </div>

        <p className="mt-6 text-center text-[12.5px] text-[var(--text-faint)]">Protected admin area</p>
      </div>
    </div>
  );
}

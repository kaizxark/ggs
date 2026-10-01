import React, { useState } from "react";
import { useLocation } from "wouter";
import { GraduationCap, LogIn, Lock } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<"admin" | "teacher" | "parent">("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login and redirect to dashboard
    setLocation("/dashboard");
  };

  const handleAutoFill = () => {
    if (role === "admin") {
      setEmail("admin@globalkids.school");
      setPassword("admin123");
    } else if (role === "teacher") {
      setEmail("teacher@globalkids.school");
      setPassword("teacher123");
    } else {
      setEmail("parent@example.com");
      setPassword("parent123");
    }
  };

  return (
    <div className="min-h-screen bg-[#B9D6EC] font-['Inter',sans-serif] flex items-center justify-center p-5 sm:p-8">
      <div className="w-full max-w-[460px] bg-white rounded-[24px] border border-[#EFEDE6] shadow-[0_24px_60px_rgba(24,24,27,0.14)] p-8 sm:p-10">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-[10px] bg-[#18181B] text-white flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-[#DCF3A6]" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-[#18181B]">
            Global Kids
          </span>
        </div>

        <div className="text-center mb-7">
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#18181B]">Portal Login</h1>
          <p className="mt-1.5 text-xs text-[#71717A]">Staff & Parent Portal · Tumakuru campus</p>
        </div>

        {/* Role selector */}
        <div className="flex gap-1.5 mb-7">
          {(["admin", "teacher", "parent"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 py-2 text-[11px] font-bold rounded-full border transition-colors ${
                role === r
                  ? "bg-[#18181B] text-white border-[#18181B]"
                  : "bg-white text-[#52525B] border-[#E8E5DC] hover:bg-[#F6F4EF]"
              }`}
            >
              {r === "admin" ? "Admin" : r === "teacher" ? "Teacher" : "Parent"}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#71717A]">Email Address / User ID</label>
            <input
              required
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#E8E5DC] bg-[#FAF9F5] focus:bg-white focus:border-[#18181B] outline-none text-sm text-[#26262B] transition-colors"
              placeholder="Enter your ID"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#71717A]">Password</label>
              <a href="#" onClick={(e) => e.preventDefault()} className="text-[11px] font-bold text-[#3F3F46] hover:text-[#18181B]">Forgot?</a>
            </div>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#E8E5DC] bg-[#FAF9F5] focus:bg-white focus:border-[#18181B] outline-none text-sm text-[#26262B] transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-[#18181B] hover:bg-black text-white font-bold text-sm transition-all active:scale-[0.99]"
          >
            <span>Access Dashboard</span>
            <LogIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleAutoFill}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#E3F5C8] hover:bg-[#D6EFB2] text-[#567D2E] font-bold text-[11px] transition-colors"
            title="Use Auto Fill"
          >
            <Lock className="w-3.5 h-3.5" /> Demo Login for {role}
          </button>
        </form>

        <p className="mt-7 pt-5 border-t border-[#F2F0EA] text-center text-[10.5px] text-[#A1A1AA]">
          © {new Date().getFullYear()} Global Kids School, Tumakuru
        </p>
      </div>
    </div>
  );
}

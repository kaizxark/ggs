import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { GraduationCap, ArrowLeft, LogIn, Lock, ArrowRight } from "lucide-react";

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
    <div className="min-h-screen bg-[#f8faf9] font-['DM_Sans',sans-serif] flex">
      {/* Visual Identity Section (Hidden on small mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#214e49] text-white flex-col relative overflow-hidden">
        <div className="absolute top-[-5%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#2f6f68] blur-3xl opacity-40 pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-[#1e403d] blur-3xl opacity-60 pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between h-full p-12">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-[#dcebe7] hover:text-white transition-colors text-sm font-bold">
              <ArrowLeft className="w-4 h-4" /> Back to Public Website
            </Link>
          </div>
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-md">
              <GraduationCap className="w-8 h-8 text-[#fbd38d]" />
            </div>
            <h1 className="text-4xl font-extrabold font-['Manrope'] pr-12 leading-tight">
              Welcome to the Global Kids School Staff & Parent Portal.
            </h1>
            <p className="text-[#a4c9c2] text-sm max-w-md leading-relaxed">
              Log in to manage attendance, track academic progress, view timetables, and collaborate securely within our educational community.
            </p>
          </div>
          <div className="text-xs text-[#759f97] font-medium">
            © {new Date().getFullYear()} Global Kids School, Tumakuru.
          </div>
        </div>
      </div>

      {/* Login Form Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="lg:hidden absolute top-6 left-6">
           <Link href="/" className="inline-flex items-center gap-2 text-[#5e7771] hover:text-[#2f6f68] text-sm font-bold">
              <ArrowLeft className="w-4 h-4" /> Go Back
            </Link>
        </div>

        <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl shadow-[#244b44]/5 border border-[#e4ede8] p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2f6f68] to-[#1f4e48] text-white flex items-center justify-center shadow-lg mx-auto mb-4 lg:hidden">
              <GraduationCap className="w-7 h-7 text-[#fbd38d]" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#1a2d28] font-['Manrope'] mb-2">Portal Login</h2>
            <p className="text-xs text-[#637a74]">Sign in to access your dashboard</p>
          </div>

          <div className="flex bg-[#f3f7f5] p-1.5 rounded-xl border border-[#e8efe9] mb-8">
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${role === "admin" ? "bg-white text-[#2f6f68] shadow-sm font-extrabold" : "text-[#7f9994] hover:text-[#425e59]"}`}
            >
              School Admin
            </button>
            <button
              type="button"
              onClick={() => setRole("teacher")}
              className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${role === "teacher" ? "bg-white text-[#2f6f68] shadow-sm font-extrabold" : "text-[#7f9994] hover:text-[#425e59]"}`}
            >
              Teacher / Staff
            </button>
            <button
              type="button"
              onClick={() => setRole("parent")}
              className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${role === "parent" ? "bg-white text-[#2f6f68] shadow-sm font-extrabold" : "text-[#7f9994] hover:text-[#425e59]"}`}
            >
              Parent
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#637a74]">Email Address / User ID</label>
              <input
                required
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#dce6e1] focus:border-[#2f6f68] focus:ring-1 focus:ring-[#2f6f68] outline-none text-sm transition-all"
                placeholder="Enter your ID"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#637a74]">Password</label>
                <a href="#" onClick={(e) => e.preventDefault()} className="text-[11px] font-bold text-[#2f6f68] hover:underline">Forgot?</a>
              </div>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#dce6e1] focus:border-[#2f6f68] focus:ring-1 focus:ring-[#2f6f68] outline-none text-sm transition-all"
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#2f6f68] hover:bg-[#235852] text-white font-bold text-sm transition-all shadow-md active:scale-[0.98]"
              >
                <span>Access Dashboard</span>
                <LogIn className="w-4 h-4 shadow-xl" />
              </button>
            </div>

            <div className="pt-4 border-t border-[#eaf2ef]">
              <button
                type="button"
                onClick={handleAutoFill}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#eef7f4] hover:bg-[#e2f1ec] text-[#2f6f68] font-bold text-[11px] transition-colors"
                title="Use Auto Fill"
              >
                <Lock className="w-3.5 h-3.5" /> Demo Login for {role}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

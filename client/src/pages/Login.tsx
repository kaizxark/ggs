import { useState } from "react";
import { ShieldCheck } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === "kaizxark@gmail.com" && password === "Aliza@015") {
      sessionStorage.setItem("loggedIn", "true");
      window.location.href = "/dashboard";
    } else {
      setError("Invalid email or password.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] flex items-center justify-center px-4" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#3fb8a2] to-[#2ea894] flex items-center justify-center shadow-lg shadow-[#3fb8a2]/20">
            <ShieldCheck size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight leading-none">Global Kids</h1>
            <span className="text-[10px] font-semibold text-[#8b939c] tracking-[0.12em] uppercase">School OS</span>
          </div>
        </div>

        <div className="bg-[#131418] border border-[#1f2329] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-1">Dashboard Access</h2>
          <p className="text-[#8b939c] text-sm mb-6">Sign in with super admin credentials</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#8b939c] mb-1.5">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kaizxark@gmail.com"
                className="w-full bg-[#181b20] border border-[#2a2e36] rounded-lg py-2.5 px-3 text-sm text-white placeholder-[#5a6270] focus:outline-none focus:border-[#3fb8a2] focus:ring-1 focus:ring-[#3fb8a2]/30 transition"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-[#8b939c] mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Aliza@015"
                className="w-full bg-[#181b20] border border-[#2a2e36] rounded-lg py-2.5 px-3 text-sm text-white placeholder-[#5a6270] focus:outline-none focus:border-[#3fb8a2] focus:ring-1 focus:ring-[#3fb8a2]/30 transition"
              />
            </div>

            {error && (
              <div className="text-[#f0886a] text-xs bg-[#2a1a18]/60 border border-[#3a2020] rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#3fb8a2] hover:bg-[#2ea894] text-white font-semibold py-2.5 rounded-lg transition shadow-[0_0_20px_rgba(63,184,162,.25)]"
            >
              Sign in to Dashboard
            </button>
          </form>

          <p className="mt-5 text-center text-[#5a6270] text-[11px]">Global Kids School · Tumakuru</p>
        </div>
      </div>
    </div>
  );
}

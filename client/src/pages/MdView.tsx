import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  RefreshCw,
  Maximize2,
  Minimize2,
  LogOut,
  Clock,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Building2,
  ChevronRight,
  Filter,
  Check,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";

interface ClassAttendanceItem {
  id: string;
  grade: string;
  section: string;
  label: string;
  room: string;
  teacherName: string;
  enrolled: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  rate: number;
  status: "high" | "average" | "low";
  absentees: string[];
}

interface ClassFeeItem {
  id: string;
  grade: string;
  section: string;
  label: string;
  room: string;
  teacherName: string;
  enrolled: number;
  billed: number;
  collected: number;
  outstanding: number;
  rate: number;
  paidStudents: number;
  pendingStudents: number;
}

interface RecentPaymentItem {
  id: string;
  receiptNo: string;
  studentName: string;
  usn: string;
  classLabel: string;
  amount: number;
  method: string;
  paidAt: string;
}

interface MdViewData {
  ok: boolean;
  timestamp: string;
  schoolName: string;
  academicYear: string;
  totalStudents: number;
  totalClassrooms: number;
  attendance: {
    date: string;
    overallRate: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    leaveCount: number;
    attendingCount: number;
    classesReported: number;
    classesTotal: number;
    classes: ClassAttendanceItem[];
  };
  fees: {
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    totalOverdue: number;
    collectionRate: number;
    paidInvoicesCount: number;
    partialInvoicesCount: number;
    overdueInvoicesCount: number;
    classes: ClassFeeItem[];
    recentPayments: RecentPaymentItem[];
  };
}

// Format numbers in Indian Lakhs/Crores notation or standard currency
function formatIndianCurrency(num: number): string {
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  return `₹${num.toLocaleString("en-IN")}`;
}

function formatFullRupees(num: number): string {
  return `₹${num.toLocaleString("en-IN")}`;
}

export default function MdView() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return (
      localStorage.getItem("mdview_auth") === "admin123" ||
      sessionStorage.getItem("mdview_auth") === "admin123"
    );
  });
  const [usernameInput, setUsernameInput] = useState("admin");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<"attendance" | "fees">("attendance");
  const [autoCycle, setAutoCycle] = useState(true);
  const [cycleSecondsLeft, setCycleSecondsLeft] = useState(15);
  const [gradeFilter, setGradeFilter] = useState<"all" | "primary" | "middle" | "high">("all");
  const [data, setData] = useState<MdViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState("just now");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassAttendanceItem | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [flashUpdate, setFlashUpdate] = useState(false);

  // Digital clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Time ago ticker
  useEffect(() => {
    const timer = setInterval(() => {
      const diffSec = Math.round((Date.now() - lastUpdated.getTime()) / 1000);
      if (diffSec < 5) setTimeAgo("just now");
      else if (diffSec < 60) setTimeAgo(`${diffSec}s ago`);
      else setTimeAgo(`${Math.floor(diffSec / 60)}m ago`);
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Fetch live MD view data
  const fetchData = useCallback(async (isInitial = false) => {
    if (!isAuthenticated) return;
    try {
      if (isInitial) setLoading(true);
      const res = await fetch("/api/mdview?auth=admin123", {
        headers: { "X-MD-Auth": "admin123" },
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
        localStorage.removeItem("mdview_auth");
        sessionStorage.removeItem("mdview_auth");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MdViewData = await res.json();
      setData(json);
      setError(null);
      setLastUpdated(new Date());
      setFlashUpdate(true);
      setTimeout(() => setFlashUpdate(false), 1200);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("MD View fetch error:", msg);
      setError("Reconnecting to school feed…");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [isAuthenticated]);

  // Initial load
  useEffect(() => {
    if (isAuthenticated) {
      fetchData(true);
    }
  }, [isAuthenticated, fetchData]);

  // Live polling every 8 seconds
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, 8000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchData]);

  // Auto-cycle between Attendance and Fees every 15 seconds
  useEffect(() => {
    if (!autoCycle || !isAuthenticated) return;
    const interval = setInterval(() => {
      setCycleSecondsLeft((prev) => {
        if (prev <= 1) {
          setActiveTab((cur) => (cur === "attendance" ? "fees" : "attendance"));
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoCycle, isAuthenticated]);

  // Handle Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await fetch("/api/mdview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput,
        }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        localStorage.setItem("mdview_auth", "admin123");
        sessionStorage.setItem("mdview_auth", "admin123");
        setIsAuthenticated(true);
      } else {
        setLoginError(json.message || "Invalid credentials. Use admin / admin123");
      }
    } catch {
      setLoginError("Could not reach authentication server.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("mdview_auth");
    sessionStorage.removeItem("mdview_auth");
    setIsAuthenticated(false);
    setPasswordInput("");
  };

  // Filtered classes by grade group
  const filteredAttendanceClasses = useMemo(() => {
    if (!data?.attendance?.classes) return [];
    if (gradeFilter === "all") return data.attendance.classes;
    return data.attendance.classes.filter((c) => {
      const g = parseInt(c.grade, 10);
      if (gradeFilter === "primary") return g >= 1 && g <= 5;
      if (gradeFilter === "middle") return g >= 6 && g <= 8;
      if (gradeFilter === "high") return g >= 9 && g <= 10;
      return true;
    });
  }, [data?.attendance?.classes, gradeFilter]);

  const filteredFeeClasses = useMemo(() => {
    if (!data?.fees?.classes) return [];
    if (gradeFilter === "all") return data.fees.classes;
    return data.fees.classes.filter((c) => {
      const g = parseInt(c.grade, 10);
      if (gradeFilter === "primary") return g >= 1 && g <= 5;
      if (gradeFilter === "middle") return g >= 6 && g <= 8;
      if (gradeFilter === "high") return g >= 9 && g <= 10;
      return true;
    });
  }, [data?.fees?.classes, gradeFilter]);

  // If unauthenticated, show executive TV login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden select-none">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-[#0F141E]/90 border border-slate-800 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-xl relative z-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-400 shadow-lg shadow-emerald-500/10">
              <Building2 className="w-8 h-8" />
            </div>
            <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">
              Executive TV Command Wallboard
            </span>
            <h1 className="text-2xl font-black tracking-tight text-white">
              CHAIRMAN DASHBOARD
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Global Kids Academy · Live Telemetry
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Executive Username
              </label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                required
                className="w-full bg-[#161D2B] border border-slate-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
                required
                className="w-full bg-[#161D2B] border border-slate-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-xl text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loginLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Access Chairman Wallboard</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70" />
            <span>Encrypted TV Display Channel · 24-Class Telemetry</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden antialiased">
      {/* Top TV Command Header */}
      <header className="h-[76px] bg-[#0C1019]/90 border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0 z-40 backdrop-blur-md">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/10">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-base font-black tracking-tight text-white uppercase">
                GLOBAL KIDS ACADEMY
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
                CHAIRMAN TV
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Live updates active · {timeAgo}
              </span>
              {error && (
                <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1 ml-2">
                  <AlertTriangle className="w-3 h-3" />
                  {error}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Executive View Switcher & Auto-Cycle */}
        <div className="flex items-center bg-[#131926] p-1.5 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => {
              setActiveTab("attendance");
              setCycleSecondsLeft(15);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "attendance"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>ATTENDANCE DASH</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("fees");
              setCycleSecondsLeft(15);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "fees"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <IndianRupee className="w-4 h-4" />
            <span>FEES & REVENUE DASH</span>
          </button>

          <div className="h-5 w-px bg-slate-800 mx-2" />

          <button
            onClick={() => setAutoCycle(!autoCycle)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
              autoCycle
                ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                : "bg-transparent border-slate-700/60 text-slate-400 hover:text-slate-200"
            }`}
            title="Automatically switch between Attendance and Fees"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoCycle ? "animate-spin" : ""}`} style={{ animationDuration: "12s" }} />
            <span>AUTO-CYCLE</span>
            {autoCycle && (
              <span className="w-5 h-5 rounded-full bg-blue-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {cycleSecondsLeft}
              </span>
            )}
          </button>
        </div>

        {/* Right: Realtime Clock, Fullscreen & Controls */}
        <div className="flex items-center gap-5">
          {/* Wall Clock */}
          <div className="text-right">
            <div className="text-lg font-mono font-black text-white tracking-wider tabular-nums leading-none">
              {currentTime.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })}
            </div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1">
              {currentTime.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(false)}
              className="p-2.5 rounded-xl bg-[#131926] hover:bg-[#1A2234] border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Refresh Live Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-[#131926] hover:bg-[#1A2234] border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Enter TV Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-all cursor-pointer ml-1"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Auto-cycle subtle progress bar */}
      {autoCycle && (
        <div className="h-0.5 w-full bg-slate-900 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500 transition-all duration-1000 ease-linear"
            style={{ width: `${((15 - cycleSecondsLeft) / 15) * 100}%` }}
          />
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 flex flex-col gap-6 overflow-y-auto">
        {loading && !data ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="h-12 w-12 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
              Connecting to 1,000-student school telemetry…
            </p>
          </div>
        ) : (
          <>
            {/* VIEW 1: ATTENDANCE DASHBOARD */}
            {activeTab === "attendance" && data && (
              <div className="flex flex-col gap-6 animate-fadeIn">
                {/* 4 Executive KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Card 1: Attendance Rate */}
                  <div className="bg-[#0C111C] border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden shadow-xl shadow-emerald-950/20 flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">
                          Overall Attendance
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          Today · {data.attendance.date}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-5xl font-black font-mono tracking-tight text-white tabular-nums">
                          {data.attendance.overallRate}%
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            data.attendance.overallRate >= 90
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {data.attendance.overallRate >= 90 ? "Target Met" : "Below 90%"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>Threshold Benchmark</span>
                      <span className="font-mono font-bold text-slate-200">90.0% CBSE Standard</span>
                    </div>
                  </div>

                  {/* Card 2: Students Present */}
                  <div className="bg-[#0C111C] border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
                          Students Attending
                        </span>
                        <Users className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-5xl font-black font-mono tracking-tight text-emerald-400 tabular-nums">
                          {data.attendance.attendingCount.toLocaleString("en-IN")}
                        </span>
                        <span className="text-sm font-semibold text-slate-400">
                          / {data.totalStudents.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>On-Time: {data.attendance.presentCount}</span>
                      <span className="text-amber-400 font-semibold">Late: {data.attendance.lateCount}</span>
                    </div>
                  </div>

                  {/* Card 3: Absent / Leave */}
                  <div className="bg-[#0C111C] border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
                          Absentees Today
                        </span>
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-5xl font-black font-mono tracking-tight text-rose-400 tabular-nums">
                          {data.attendance.absentCount}
                        </span>
                        <span className="text-xs font-bold text-slate-400 px-2 py-0.5 rounded-full bg-slate-800">
                          Unexcused
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>Approved Leave: {data.attendance.leaveCount}</span>
                      <span className="text-slate-300 font-medium">Total Out: {data.attendance.absentCount + data.attendance.leaveCount}</span>
                    </div>
                  </div>

                  {/* Card 4: Classrooms Reporting */}
                  <div className="bg-[#0C111C] border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
                          Reporting Classes
                        </span>
                        <CheckCircle2 className="w-4 h-4 text-teal-400" />
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-5xl font-black font-mono tracking-tight text-white tabular-nums">
                          {data.attendance.classesReported}
                        </span>
                        <span className="text-sm font-semibold text-slate-400">
                          / {data.attendance.classesTotal} Classrooms
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>Status</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> 100% Registers Complete
                      </span>
                    </div>
                  </div>
                </div>

                {/* Filter and Class Count Strip */}
                <div className="flex items-center justify-between bg-[#0C1019] px-4 py-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Class-by-Class Live Telemetry ({filteredAttendanceClasses.length} Classes)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Grades 1 to 10 · Sections A, B, C
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#141A26] p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setGradeFilter("all")}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        gradeFilter === "all"
                          ? "bg-emerald-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      All Classes (24)
                    </button>
                    <button
                      onClick={() => setGradeFilter("primary")}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        gradeFilter === "primary"
                          ? "bg-emerald-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Primary (Grades 1–5)
                    </button>
                    <button
                      onClick={() => setGradeFilter("middle")}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        gradeFilter === "middle"
                          ? "bg-emerald-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Middle (Grades 6–8)
                    </button>
                    <button
                      onClick={() => setGradeFilter("high")}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        gradeFilter === "high"
                          ? "bg-emerald-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      High School (Grades 9–10)
                    </button>
                  </div>
                </div>

                {/* Class-wise Attendance Grid (24 Classrooms) */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {filteredAttendanceClasses.map((cls) => {
                    const isHigh = cls.rate >= 90;
                    const isMid = cls.rate >= 80 && cls.rate < 90;
                    return (
                      <div
                        key={cls.id}
                        onClick={() => setSelectedClass(cls)}
                        className={`bg-[#0C111C] border rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] cursor-pointer flex flex-col justify-between relative overflow-hidden group shadow-lg ${
                          isHigh
                            ? "border-slate-800 hover:border-emerald-500/50"
                            : isMid
                            ? "border-amber-500/30 hover:border-amber-500/60"
                            : "border-rose-500/40 hover:border-rose-500/70"
                        }`}
                      >
                        {/* Top: Class & Room */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-black text-white tracking-tight">
                              {cls.label}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {cls.room}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mb-3">
                            {cls.teacherName}
                          </div>

                          {/* Middle: Attendance % & Micro progress bar */}
                          <div className="flex items-baseline justify-between mb-1.5">
                            <span
                              className={`text-2xl font-black font-mono tracking-tight tabular-nums ${
                                isHigh
                                  ? "text-emerald-400"
                                  : isMid
                                  ? "text-amber-400"
                                  : "text-rose-400"
                              }`}
                            >
                              {cls.rate}%
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {cls.present + cls.late}/{cls.enrolled}
                            </span>
                          </div>

                          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isHigh
                                  ? "bg-emerald-500"
                                  : isMid
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(cls.rate, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Bottom: Attendance status breakdown */}
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                          <span className="text-emerald-400 font-medium">
                            {cls.present} Present
                          </span>
                          {cls.absent > 0 ? (
                            <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded">
                              {cls.absent} Absent
                            </span>
                          ) : (
                            <span className="text-slate-500 font-medium">0 Absent</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW 2: FEES & REVENUE DASHBOARD */}
            {activeTab === "fees" && data && (
              <div className="flex flex-col gap-6 animate-fadeIn">
                {/* 4 Executive KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Card 1: Collection Rate */}
                  <div className="bg-[#0C111C] border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden shadow-xl shadow-emerald-950/20 flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">
                          Total Collection Efficiency
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          FY 2026-27
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-5xl font-black font-mono tracking-tight text-white tabular-nums">
                          {data.fees.collectionRate}%
                        </span>
                        <span className="text-xs font-bold text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/20">
                          Active Collection
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>Annual Budget Goal</span>
                      <span className="font-mono font-bold text-slate-200">
                        {formatIndianCurrency(data.fees.totalBilled)}
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Total Revenue Collected */}
                  <div className="bg-[#0C111C] border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
                          Total Collected
                        </span>
                        <IndianRupee className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-4xl lg:text-5xl font-black font-mono tracking-tight text-emerald-400 tabular-nums">
                          {formatIndianCurrency(data.fees.totalCollected)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>Receipts Cleared</span>
                      <span className="font-mono font-bold text-slate-200">
                        {data.fees.paidInvoicesCount.toLocaleString("en-IN")} Invoices Paid
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Outstanding Dues */}
                  <div className="bg-[#0C111C] border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
                          Total Outstanding
                        </span>
                        <CreditCard className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-4xl lg:text-5xl font-black font-mono tracking-tight text-amber-400 tabular-nums">
                          {formatIndianCurrency(data.fees.totalOutstanding)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>Partially Paid Invoices</span>
                      <span className="font-mono font-bold text-slate-200">
                        {data.fees.partialInvoicesCount} In Progress
                      </span>
                    </div>
                  </div>

                  {/* Card 4: Overdue Deficit */}
                  <div className="bg-[#0C111C] border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
                          Overdue Balance
                        </span>
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-4xl lg:text-5xl font-black font-mono tracking-tight text-rose-400 tabular-nums">
                          {formatIndianCurrency(data.fees.totalOverdue)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>Defaulters Requiring Notice</span>
                      <span className="font-mono font-bold text-rose-300">
                        {data.fees.overdueInvoicesCount} Overdue
                      </span>
                    </div>
                  </div>
                </div>

                {/* Filter and Class Count Strip */}
                <div className="flex items-center justify-between bg-[#0C1019] px-4 py-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Class-by-Class Fee Performance ({filteredFeeClasses.length} Classes)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Tiered Tuition ₹35k - ₹60k · 1,000 Enrolled
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#141A26] p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setGradeFilter("all")}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        gradeFilter === "all"
                          ? "bg-emerald-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      All Classes (24)
                    </button>
                    <button
                      onClick={() => setGradeFilter("primary")}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        gradeFilter === "primary"
                          ? "bg-emerald-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Primary (Grades 1–5)
                    </button>
                    <button
                      onClick={() => setGradeFilter("middle")}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        gradeFilter === "middle"
                          ? "bg-emerald-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Middle (Grades 6–8)
                    </button>
                    <button
                      onClick={() => setGradeFilter("high")}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        gradeFilter === "high"
                          ? "bg-emerald-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      High School (Grades 9–10)
                    </button>
                  </div>
                </div>

                {/* Class-wise Fees Grid (24 Classrooms) */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {filteredFeeClasses.map((cls) => {
                    const isHigh = cls.rate >= 75;
                    const isMid = cls.rate >= 55 && cls.rate < 75;
                    return (
                      <div
                        key={cls.id}
                        className={`bg-[#0C111C] border rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] flex flex-col justify-between shadow-lg ${
                          isHigh
                            ? "border-slate-800 hover:border-emerald-500/50"
                            : isMid
                            ? "border-amber-500/30 hover:border-amber-500/60"
                            : "border-rose-500/40 hover:border-rose-500/70"
                        }`}
                      >
                        {/* Top: Class & Enrolled */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-black text-white tracking-tight">
                              {cls.label}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {cls.enrolled} Pupils
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mb-3">
                            {cls.teacherName}
                          </div>

                          {/* Middle: Collection % & Bar */}
                          <div className="flex items-baseline justify-between mb-1.5">
                            <span
                              className={`text-2xl font-black font-mono tracking-tight tabular-nums ${
                                isHigh
                                  ? "text-emerald-400"
                                  : isMid
                                  ? "text-amber-400"
                                  : "text-rose-400"
                              }`}
                            >
                              {cls.rate}%
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {formatIndianCurrency(cls.collected)}
                            </span>
                          </div>

                          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isHigh
                                  ? "bg-emerald-500"
                                  : isMid
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(cls.rate, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Bottom: Collected vs Pending */}
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-medium">
                            Target: {formatIndianCurrency(cls.billed)}
                          </span>
                          <span className="text-amber-400 font-bold">
                            {formatIndianCurrency(cls.outstanding)} Due
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Live Fee Stream Ticker */}
                <div className="bg-[#0C1019] border border-slate-800 rounded-2xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Recent Live Payment Stream
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Latest verified receipts recorded on Supabase
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {data.fees.recentPayments.slice(0, 5).map((pay) => (
                      <div
                        key={pay.id}
                        className="bg-[#121824] border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white truncate max-w-[130px]">
                            {pay.studentName}
                          </span>
                          <span className="text-xs font-black font-mono text-emerald-400">
                            {formatFullRupees(pay.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{pay.classLabel}</span>
                          <span className="font-mono bg-slate-800 px-1.5 py-0.2 rounded text-slate-300">
                            {pay.method}
                          </span>
                        </div>
                        <div className="text-[9px] font-mono text-slate-500 mt-1 truncate">
                          {pay.receiptNo}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Absentee Details Modal (when clicked on a class card in Attendance view) */}
      {selectedClass && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setSelectedClass(null)}
        >
          <div
            className="bg-[#0F1522] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white">
                  {selectedClass.label} · Attendance Roster
                </h3>
                <p className="text-xs text-slate-400">
                  Room {selectedClass.room} · Class Teacher: {selectedClass.teacherName}
                </p>
              </div>
              <button
                onClick={() => setSelectedClass(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-6 text-center">
              <div className="bg-[#141B2B] p-2.5 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">Enrolled</div>
                <div className="text-xl font-bold font-mono text-white mt-0.5">
                  {selectedClass.enrolled}
                </div>
              </div>
              <div className="bg-[#141B2B] p-2.5 rounded-xl border border-slate-800">
                <div className="text-xs text-emerald-400">Present</div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                  {selectedClass.present}
                </div>
              </div>
              <div className="bg-[#141B2B] p-2.5 rounded-xl border border-slate-800">
                <div className="text-xs text-amber-400">Late</div>
                <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                  {selectedClass.late}
                </div>
              </div>
              <div className="bg-[#141B2B] p-2.5 rounded-xl border border-slate-800">
                <div className="text-xs text-rose-400">Absent</div>
                <div className="text-xl font-bold font-mono text-rose-400 mt-0.5">
                  {selectedClass.absent}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5">
                Students Absent on Record ({selectedClass.absent})
              </h4>
              {selectedClass.absentees.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedClass.absentees.map((name, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 bg-[#141B2B] rounded-xl border border-rose-500/20 text-xs"
                    >
                      <span className="font-semibold text-white">{name}</span>
                      <span className="text-[10px] font-bold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10">
                        Absent Unexcused
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-xs text-emerald-400 font-medium">
                  ✓ Full attendance! No absentees recorded for this classroom.
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-right">
              <button
                onClick={() => setSelectedClass(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

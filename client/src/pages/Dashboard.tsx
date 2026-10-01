import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Bus,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Command,
  Download,
  FileBarChart,
  FileText,
  Filter,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  Library,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Receipt,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

const accent = "#F2A65A";

const navGroups = [
  {
    label: "School",
    items: [
      { label: "Overview", icon: LayoutDashboard },
      { label: "Students", icon: GraduationCap, count: "2,486" },
      { label: "Staff", icon: Users },
      { label: "Academics", icon: BookOpen },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Attendance", icon: ClipboardCheck },
      { label: "Examinations", icon: FileText },
      { label: "Assignments", icon: Check, count: "12" },
      { label: "Fees & Finance", icon: IndianRupee },
      { label: "Transport", icon: Bus },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Communication", icon: MessageSquare, count: "4" },
      { label: "Announcements", icon: Bell },
      { label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", icon: FileBarChart },
      { label: "Analytics", icon: Activity },
    ],
  },
];

const attendanceData = [
  { day: "Mon", present: 2268, absent: 118, late: 61, leave: 39 },
  { day: "Tue", present: 2310, absent: 92, late: 52, leave: 32 },
  { day: "Wed", present: 2290, absent: 104, late: 59, leave: 33 },
  { day: "Thu", present: 2354, absent: 70, late: 35, leave: 27 },
  { day: "Fri", present: 2318, absent: 86, late: 49, leave: 33 },
  { day: "Sat", present: 2380, absent: 46, late: 28, leave: 32 },
  { day: "Today", present: 2357, absent: 79, late: 33, leave: 17 },
];

const students = [
  { name: "Aarav Mehta", initials: "AM", grade: "Grade 8", section: "B", id: "GKS-24081", attendance: 97, average: 91, fees: "Paid", transport: "Route 04", status: "Active", tone: "teal" },
  { name: "Ishita Nair", initials: "IN", grade: "Grade 10", section: "A", id: "GKS-23819", attendance: 94, average: 88, fees: "Paid", transport: "Route 02", status: "Active", tone: "violet" },
  { name: "Vihaan Kapoor", initials: "VK", grade: "Grade 6", section: "C", id: "GKS-24211", attendance: 89, average: 82, fees: "Due", transport: "Route 09", status: "Review", tone: "amber" },
  { name: "Ananya Rao", initials: "AR", grade: "Grade 12", section: "A", id: "GKS-23104", attendance: 98, average: 95, fees: "Paid", transport: "Self", status: "Active", tone: "rose" },
  { name: "Kabir Malhotra", initials: "KM", grade: "Grade 9", section: "D", id: "GKS-23998", attendance: 92, average: 86, fees: "Paid", transport: "Route 06", status: "Active", tone: "blue" },
  { name: "Mira Thomas", initials: "MT", grade: "Grade 5", section: "A", id: "GKS-24306", attendance: 86, average: 79, fees: "Due", transport: "Route 03", status: "Review", tone: "orange" },
  { name: "Arjun Menon", initials: "AM", grade: "Grade 11", section: "C", id: "GKS-23277", attendance: 96, average: 90, fees: "Paid", transport: "Route 01", status: "Active", tone: "indigo" },
  { name: "Sara Fernandes", initials: "SF", grade: "Grade 7", section: "B", id: "GKS-24170", attendance: 93, average: 87, fees: "Paid", transport: "Route 07", status: "Active", tone: "pink" },
];

const recentActivity = [
  { title: "Fee payment received", detail: "Aarav Mehta · Term 1", time: "8 min ago", icon: IndianRupee, color: "emerald" },
  { title: "Attendance submitted", detail: "Grade 7 — Section B", time: "24 min ago", icon: ClipboardCheck, color: "blue" },
  { title: "Exam schedule published", detail: "Mid-term assessments", time: "1 hr ago", icon: CalendarDays, color: "violet" },
  { title: "Parent message received", detail: "Mrs. Nair · Grade 10A", time: "2 hrs ago", icon: MessageSquare, color: "amber" },
];

const schedule = [
  { time: "09:00", subject: "Mathematics", detail: "Grade 8 · Room 204", color: "#F2A65A" },
  { time: "10:00", subject: "Physics", detail: "Grade 11 · Lab 1", color: "#B79CE4" },
  { time: "11:00", subject: "English Literature", detail: "Grade 9 · Room 118", color: "#8FBFEA" },
  { time: "12:00", subject: "Lunch break", detail: "Campus-wide", color: "#9aa09f" },
  { time: "13:00", subject: "Chemistry", detail: "Grade 12 · Lab 2", color: "#8FBFEA" },
];

const todayOperations = [
  { time: "08:15", label: "Morning attendance window", detail: "32 classes · 2,357 present", icon: ClipboardCheck, tone: "teal" },
  { time: "11:30", label: "Mid-term timetable review", detail: "2 conflicts need a decision", icon: CalendarDays, tone: "violet" },
  { time: "14:00", label: "Finance reconciliation", detail: "₹1.8L received since yesterday", icon: IndianRupee, tone: "orange" },
  { time: "16:30", label: "Parent community update", detail: "Announcement scheduled to publish", icon: MessageSquare, tone: "blue" },
];

const healthMetrics = [
  { label: "Attendance", value: "94.8%", change: "+1.8%", progress: 94.8, color: "#F2A65A" },
  { label: "Academic average", value: "86.4%", change: "+3.2%", progress: 86.4, color: "#B79CE4" },
  { label: "Fee collection", value: "82.1%", change: "+6.4%", progress: 82.1, color: "#8FBFEA" },
  { label: "Parent engagement", value: "78.6%", change: "+4.1%", progress: 78.6, color: "#8FD18B" },
];

const revenueData = [
  { month: "Apr", collected: 24, pending: 8 },
  { month: "May", collected: 28, pending: 7 },
  { month: "Jun", collected: 31, pending: 6 },
  { month: "Jul", collected: 34, pending: 5 },
  { month: "Aug", collected: 37, pending: 4 },
  { month: "Sep", collected: 41, pending: 3 },
];

const classAttendance = [
  { label: "Grade 5 — A", value: 97, present: 31, total: 32 },
  { label: "Grade 6 — C", value: 89, present: 28, total: 32 },
  { label: "Grade 7 — B", value: 95, present: 30, total: 32 },
  { label: "Grade 8 — B", value: 94, present: 29, total: 31 },
  { label: "Grade 10 — A", value: 98, present: 30, total: 31 },
  { label: "Grade 12 — A", value: 96, present: 29, total: 30 },
];

const avatarTones: Record<string, string> = {
  teal: "bg-[#E3F5C8] text-[#567D2E]",
  violet: "bg-[#e9e3f6] text-[#7057b2]",
  amber: "bg-[#f8e9cd] text-[#a16d1c]",
  rose: "bg-[#f6dfdf] text-[#b26161]",
  blue: "bg-[#D6E9FA] text-[#3F74A3]",
  orange: "bg-[#f8e4d8] text-[#b86d4b]",
  indigo: "bg-[#e1e6f8] text-[#586aa8]",
  pink: "bg-[#f5dfeb] text-[#a75379]",
};

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function IconButton({ label, children, onClick, className = "" }: { label: string; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className={`icon-button ${className}`}>
      {children}
    </button>
  );
}

function MetricBlock({ label, value, comparison, positive = true, icon: Icon, spark }: { label: string; value: string; comparison: string; positive?: boolean; icon: React.ElementType; spark: number[] }) {
  const max = Math.max(...spark);
  const min = Math.min(...spark);
  const points = spark.map((point, index) => `${(index / (spark.length - 1)) * 100},${42 - ((point - min) / Math.max(max - min, 1)) * 30}`).join(" ");
  return (
    <div className="metric-block">
      <div className="flex items-center justify-between">
        <span className="metric-label">{label}</span>
        <span className="metric-icon"><Icon size={15} strokeWidth={1.8} /></span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="metric-value">{value}</div>
          <div className={`metric-change ${positive ? "text-[#3AA657]" : "text-[#E58F8F]"}`}>
            {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{comparison}
          </div>
        </div>
        <svg viewBox="0 0 100 48" className="h-11 w-[84px] overflow-visible" aria-hidden="true">
          <polyline points={points} fill="none" stroke={positive ? "#F2A65A" : "#E58F8F"} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (view: string) => void }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.toLowerCase();
    const people = students.filter((student) => `${student.name} ${student.grade} ${student.section}`.toLowerCase().includes(normalized));
    const commands = [
      { label: "Record attendance", detail: "Open today's attendance workspace", icon: ClipboardCheck, view: "Attendance" },
      { label: "Create announcement", detail: "Share an update with the school community", icon: MessageSquare, view: "Communication" },
      { label: "Generate fee report", detail: "Open finance and collection analytics", icon: FileBarChart, view: "Fees & Finance" },
      { label: "Open Grade 10", detail: "View classes, students and performance", icon: GraduationCap, view: "Students" },
    ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(normalized));
    return { people, commands };
  }, [query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop command-backdrop" onMouseDown={onClose}>
      <div className="command-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-search-row">
          <Search size={18} className="text-[#A1A1AA]" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students, commands, reports..." />
          <kbd>esc</kbd>
        </div>
        <div className="command-content">
          {results.people.length > 0 && (
            <div className="command-group">
              <p className="command-heading">People</p>
              {results.people.slice(0, 4).map((student) => (
                <button key={student.id} className="command-item" onClick={() => { onNavigate("Students"); onClose(); toast.success(`Opening ${student.name}'s profile`); }}>
                  <span className={`avatar avatar-sm ${avatarTones[student.tone]}`}>{student.initials}</span>
                  <span className="min-w-0 flex-1 text-left"><span className="block truncate font-medium text-[#18181B]">{student.name}</span><span className="block text-xs text-[#86918d]">{student.grade} · Section {student.section} · Attendance {student.attendance}%</span></span>
                  <ChevronRight size={15} className="text-[#a8b0ad]" />
                </button>
              ))}
            </div>
          )}
          <div className="command-group">
            <p className="command-heading">Quick actions</p>
            {results.commands.map((item) => (
              <button key={item.label} className="command-item" onClick={() => { onNavigate(item.view); onClose(); }}>
                <span className="command-icon"><item.icon size={16} /></span>
                <span className="min-w-0 flex-1 text-left"><span className="block font-medium text-[#18181B]">{item.label}</span><span className="block text-xs text-[#86918d]">{item.detail}</span></span>
                <span className="command-shortcut">↵</span>
              </button>
            ))}
          </div>
          {results.people.length === 0 && results.commands.length === 0 && <div className="empty-state py-12"><Search size={22} /><p>No results for “{query}”</p></div>}
        </div>
        <div className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
      </div>
    </div>
  );
}

function AppDialog({ title, description, children, onClose }: { title: string; description?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="app-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-5 border-b border-[#E8E5DC] px-6 py-5">
          <div><h3 className="text-lg font-semibold tracking-[-0.02em] text-[#18181B]">{title}</h3>{description && <p className="mt-1 text-sm text-[#71717A]">{description}</p>}</div>
          <IconButton label="Close dialog" onClick={onClose}><X size={17} /></IconButton>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function DashboardView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [range, setRange] = useState("7 days");
  return (
    <div className="page-stack">
      <div className="page-intro">
        <div><p className="eyebrow">Monday, 28 September 2026</p><span className="hero-pill"><GraduationCap size={13} />2026–2027 academic year · 2,357 students present today</span><h1 className="page-title">Good morning, Priya</h1><p className="page-subtitle">Here’s the pulse of Global Kids School today.</p></div>
        <div className="flex items-center gap-2"><button className="secondary-button" onClick={() => toast.success("Report exported", { description: "School health overview is ready to download." })}><Download size={15} />Export</button><button className="primary-button" onClick={() => onNavigate("Communication")}><Plus size={16} />New announcement</button></div>
      </div>
      <div className="metric-grid">
        <MetricBlock label="Students" value="2,486" comparison="4.2% this term" icon={GraduationCap} spark={[12, 16, 14, 19, 21, 23, 26]} />
        <MetricBlock label="Attendance" value="94.8%" comparison="1.8% today" icon={ClipboardCheck} spark={[20, 18, 23, 21, 26, 28, 31]} />
        <MetricBlock label="Staff on campus" value="138" comparison="of 142 total" icon={Users} spark={[18, 20, 18, 25, 24, 28, 30]} />
        <MetricBlock label="Fees collected" value="₹18.4L" comparison="82% of term target" icon={IndianRupee} spark={[11, 15, 17, 20, 24, 26, 29]} />
      </div>
      <div className="dashboard-grid dashboard-grid-top">
        <section className="panel attendance-panel">
          <div className="panel-header"><div><p className="eyebrow">School-wide signal</p><h2 className="panel-title">Attendance overview</h2></div><div className="flex items-center gap-2"><div className="segmented-control">{["Today", "7 days", "30 days", "Term"].map((item) => <button className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)}>{item}</button>)}</div><IconButton label="More attendance options"><MoreHorizontal size={17} /></IconButton></div></div>
          <div className="chart-legend"><span><i className="legend-dot bg-[#F2A65A]" />Present</span><span><i className="legend-dot bg-[#8FBFEA]" />Late</span><span><i className="legend-dot bg-[#E58F8F]" />Absent</span></div>
          <div className="chart-wrap"><ResponsiveContainer width="100%" height={250}><AreaChart data={attendanceData} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}><defs><linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F2A65A" stopOpacity={0.18} /><stop offset="100%" stopColor="#F2A65A" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#EFEDE6" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#8b9591", fontSize: 11 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#a2aaa7", fontSize: 10 }} /><Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E8E5DC", boxShadow: "0 12px 30px rgba(40,55,51,.08)", fontSize: 12 }} /><Area type="monotone" dataKey="present" stroke="#F2A65A" strokeWidth={2.4} fill="url(#presentFill)" /><Area type="monotone" dataKey="late" stroke="#8FBFEA" strokeWidth={1.8} fill="none" /><Area type="monotone" dataKey="absent" stroke="#E58F8F" strokeWidth={1.8} fill="none" /></AreaChart></ResponsiveContainer></div>
          <div className="chart-footnote"><span><strong>2,357</strong> students present today</span><span className="status-positive"><ArrowUpRight size={14} />1.8% vs. last Monday</span></div>
        </section>
        <section className="panel schedule-panel"><div className="panel-header"><div><p className="eyebrow">Campus rhythm</p><h2 className="panel-title">Today’s schedule</h2></div><button className="text-button" onClick={() => onNavigate("Academics")}>View calendar <ChevronRight size={14} /></button></div><div className="schedule-list">{schedule.map((item, index) => <div className="schedule-row" key={item.time}><div className="schedule-time">{item.time}</div><div className="schedule-line"><span className="schedule-dot" style={{ background: item.color }} />{index < schedule.length - 1 && <span className="schedule-connector" />}</div><div className="min-w-0 flex-1"><div className={`truncate text-sm ${item.subject === "Lunch break" ? "text-[#9ca6a2]" : "font-medium text-[#26262B]"}`}>{item.subject}</div><div className="mt-0.5 truncate text-xs text-[#9ba5a1]">{item.detail}</div></div></div>)}</div></section>
      </div>
      <div className="dashboard-grid dashboard-grid-mid">
        <section className="panel"><div className="panel-header"><div><p className="eyebrow">Needs a decision</p><h2 className="panel-title">Attention required</h2></div><span className="count-badge">5 open</span></div><div className="attention-list">{[{ label: "Students absent today", value: "23", detail: "Across 8 classes", icon: Users, tone: "coral", view: "Attendance" }, { label: "Overdue fee payments", value: "8", detail: "₹2.4L outstanding", icon: Receipt, tone: "amber", view: "Fees & Finance" }, { label: "Pending leave requests", value: "3", detail: "Awaiting your approval", icon: CalendarDays, tone: "violet", view: "Staff" }, { label: "Assignments to review", value: "5", detail: "Submitted this morning", icon: FileText, tone: "blue", view: "Assignments" }].map((item) => <button className="attention-row" key={item.label} onClick={() => onNavigate(item.view)}><span className={`attention-icon ${item.tone}`}><item.icon size={16} /></span><span className="min-w-0 flex-1 text-left"><span className="block text-sm font-medium text-[#26262B]">{item.label}</span><span className="mt-0.5 block text-xs text-[#929d99]">{item.detail}</span></span><span className="attention-value">{item.value}</span><ChevronRight size={15} className="text-[#aab2af]" /></button>)}</div></section>
        <section className="panel"><div className="panel-header"><div><p className="eyebrow">Live feed</p><h2 className="panel-title">Recent activity</h2></div><IconButton label="Activity filters"><SlidersHorizontal size={16} /></IconButton></div><div className="activity-list">{recentActivity.map((item) => <div className="activity-row" key={item.title}><span className={`activity-icon ${item.color}`}><item.icon size={15} /></span><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-[#26262B]">{item.title}</div><div className="mt-0.5 truncate text-xs text-[#929d99]">{item.detail}</div></div><span className="whitespace-nowrap text-[11px] text-[#a3aca9]">{item.time}</span></div>)}</div></section>
      </div>
      <section className="panel today-panel"><div className="panel-header"><div><p className="eyebrow">The operating day</p><h2 className="panel-title">Today’s operations</h2></div><span className="count-badge">4 checkpoints</span></div><div className="today-timeline">{todayOperations.map((item, index) => <button className="today-operation" key={item.label} onClick={() => onNavigate(item.label.includes("attendance") ? "Attendance" : item.label.includes("Finance") ? "Fees & Finance" : item.label.includes("Parent") ? "Communication" : "Examinations")}><span className="today-time">{item.time}</span><span className="today-rail"><span className={`today-icon ${item.tone}`}><item.icon size={15} /></span>{index < todayOperations.length - 1 && <span className="today-connector" />}</span><span className="min-w-0 flex-1 text-left"><span className="block text-sm font-medium text-[#26262B]">{item.label}</span><span className="mt-1 block text-xs text-[#929d99]">{item.detail}</span></span><ChevronRight size={15} className="text-[#aab2af]" /></button>)}</div></section>
      <section className="panel health-panel"><div className="panel-header"><div><p className="eyebrow">Leadership view</p><h2 className="panel-title">School health overview</h2></div><button className="text-button" onClick={() => onNavigate("Reports")}>Open reports <ChevronRight size={14} /></button></div><div className="health-grid">{healthMetrics.map((metric) => <div className="health-metric" key={metric.label}><div className="flex items-center justify-between"><span className="text-sm text-[#71717A]">{metric.label}</span><span className="text-xs font-medium text-[#3AA657]">{metric.change}</span></div><div className="mt-3 flex items-center gap-3"><div className="health-ring" style={{ background: `conic-gradient(${metric.color} ${metric.progress * 3.6}deg, #F4F2EC 0deg)` }}><div className="health-ring-inner">{metric.progress}%</div></div><div className="min-w-0 flex-1"><div className="h-1.5 overflow-hidden rounded-full bg-[#F4F2EC]"><div className="h-full rounded-full" style={{ width: `${metric.progress}%`, background: metric.color }} /></div><p className="mt-2 text-[11px] text-[#9aa49f]">vs. previous month</p></div></div></div>)}</div></section>
    </div>
  );
}

function StudentsView({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All students");
  const [showDialog, setShowDialog] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = students.filter((student) => `${student.name} ${student.id} ${student.grade} ${student.section}`.toLowerCase().includes(query.toLowerCase()) && (status === "All students" || student.status === status));
  return <div className="page-stack"><div className="page-intro"><div><button className="back-link" onClick={onBack}>← Overview</button><p className="eyebrow mt-4">People directory</p><h1 className="page-title">Students</h1><p className="page-subtitle">A connected view of every learner, class and family.</p></div><button className="primary-button" onClick={() => setShowDialog(true)}><Plus size={16} />Add student</button></div><div className="panel table-panel"><div className="table-toolbar"><div className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, admission ID or grade..." /></div><div className="toolbar-actions"><div className="filter-select"><Filter size={14} /><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All students</option><option>Active</option><option>Review</option></select><ChevronDown size={14} /></div><button className="secondary-button compact" onClick={() => toast.success("Student view saved", { description: "Your filters are now available from Saved views." })}><SlidersHorizontal size={14} />Saved view</button><IconButton label="More student table actions"><MoreHorizontal size={17} /></IconButton></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Student</th><th>Admission ID</th><th>Grade</th><th>Attendance</th><th>Academic average</th><th>Fee status</th><th>Transport</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((student) => <tr key={student.id} className={selected === student.id ? "row-selected" : ""} onClick={() => setSelected(student.id)}><td><div className="flex items-center gap-3"><span className={`avatar avatar-sm ${avatarTones[student.tone]}`}>{student.initials}</span><div><div className="font-medium text-[#26262B]">{student.name}</div><div className="mt-0.5 text-xs text-[#9aa49f]">Section {student.section}</div></div></div></td><td className="muted-cell">{student.id}</td><td><span className="grade-chip">{student.grade}</span></td><td><span className={student.attendance >= 92 ? "score-positive" : "score-warning"}>{student.attendance}%</span></td><td><span className="font-medium text-[#52525B]">{student.average}%</span></td><td><span className={`status-pill ${student.fees === "Paid" ? "success" : "warning"}`}><span className="status-dot" />{student.fees}</span></td><td className="muted-cell">{student.transport}</td><td><span className={`status-pill ${student.status === "Active" ? "success" : "warning"}`}>{student.status}</span></td><td><button className="row-more" onClick={(event) => { event.stopPropagation(); toast(`${student.name} selected`); }}><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div><div className="table-footer"><span>Showing <strong>{filtered.length}</strong> of 2,486 students</span><div className="pagination"><button disabled>←</button><button className="current">1</button><button>2</button><button>3</button><button>→</button></div></div></div>{selected && <div className="profile-drawer"><div className="drawer-header"><div><p className="eyebrow">Student profile</p><h3>{students.find((student) => student.id === selected)?.name}</h3></div><IconButton label="Close profile" onClick={() => setSelected(null)}><X size={17} /></IconButton></div><div className="drawer-avatar"><span className={`avatar avatar-lg ${avatarTones[students.find((student) => student.id === selected)?.tone ?? "teal"]}`}>{students.find((student) => student.id === selected)?.initials}</span><div><p className="font-medium text-[#26262B]">{students.find((student) => student.id === selected)?.grade} · Section {students.find((student) => student.id === selected)?.section}</p><p className="text-xs text-[#909b97]">Admission ID {selected}</p></div></div><div className="drawer-stats"><div><span>Attendance</span><strong>94%</strong></div><div><span>Average</span><strong>87%</strong></div><div><span>Fees</span><strong className="text-[#3AA657]">Paid</strong></div></div><div className="drawer-tabs"><button className="active">Overview</button><button onClick={() => toast("Academic tab opened")}>Academics</button><button onClick={() => toast("Activity tab opened")}>Activity</button></div><div className="drawer-snapshot"><div><p className="eyebrow">Academic trend</p><strong>+6.4%</strong><span>vs. last term</span></div><div><p className="eyebrow">Next exam</p><strong>Physics</strong><span>04 Oct · 10:00</span></div><div><p className="eyebrow">Attendance</p><strong>94%</strong><span>1 late arrival</span></div></div><div className="drawer-section"><p className="eyebrow">Connected records</p><button onClick={() => toast("Family records opened")}><Users size={16} />Family & guardians<ChevronRight size={15} /></button><button onClick={() => toast("Academic records opened")}><BookOpen size={16} />Academic performance<ChevronRight size={15} /></button><button onClick={() => toast("Attendance history opened")}><ClipboardCheck size={16} />Attendance history<ChevronRight size={15} /></button></div></div>}{showDialog && <AppDialog title="Add a student" description="Create a connected student profile for Global Kids School." onClose={() => setShowDialog(false)}><div className="form-grid"><label>First name<input placeholder="e.g. Aanya" /></label><label>Last name<input placeholder="e.g. Sharma" /></label><label>Grade<select defaultValue="Grade 8"><option>Grade 5</option><option>Grade 6</option><option>Grade 7</option><option>Grade 8</option><option>Grade 9</option><option>Grade 10</option><option>Grade 11</option><option>Grade 12</option></select></label><label>Section<select defaultValue="A"><option>A</option><option>B</option><option>C</option><option>D</option></select></label></div><div className="dialog-actions"><button className="secondary-button" onClick={() => setShowDialog(false)}>Cancel</button><button className="primary-button" onClick={() => { setShowDialog(false); toast.success("Student profile created", { description: "The new learner is ready for family and academic details." }); }}>Create student</button></div></AppDialog>}</div>;
}

function AttendanceView({ onBack }: { onBack: () => void }) {
  const [marked, setMarked] = useState<string[]>([]);
  return <div className="page-stack"><div className="page-intro"><div><button className="back-link" onClick={onBack}>← Overview</button><p className="eyebrow mt-4">Daily operations</p><h1 className="page-title">Attendance</h1><p className="page-subtitle">Monday, 28 September · 94.8% school-wide attendance.</p></div><button className="primary-button" onClick={() => toast.success("Attendance summary shared", { description: "The daily digest was sent to the leadership group." })}><MessageSquare size={16} />Share summary</button></div><div className="metric-grid three"><MetricBlock label="Present today" value="2,357" comparison="94.8% of students" icon={Check} spark={[19, 18, 23, 24, 25, 27, 30]} /><MetricBlock label="Absent today" value="79" comparison="23 need follow-up" icon={AlertCircle} spark={[27, 25, 24, 23, 21, 20, 18]} positive={false} /><MetricBlock label="Late arrivals" value="33" comparison="11 fewer than Friday" icon={Clock3} spark={[24, 27, 25, 23, 22, 20, 19]} /></div><div className="panel table-panel"><div className="panel-header"><div><p className="eyebrow">Live class roll-up</p><h2 className="panel-title">Class attendance</h2></div><div className="flex items-center gap-2"><button className="secondary-button compact" onClick={() => toast.success("Attendance CSV exported")}><Download size={14} />Export</button><button className="secondary-button compact" onClick={() => toast("Filters opened")}><Filter size={14} />Filter</button></div></div><div className="table-scroll"><table className="data-table attendance-table"><thead><tr><th>Class</th><th>Present</th><th>Attendance</th><th>Signal</th><th>Teacher</th><th /></tr></thead><tbody>{classAttendance.map((row) => <tr key={row.label}><td><span className="font-medium text-[#26262B]">{row.label}</span></td><td className="muted-cell">{row.present} / {row.total}</td><td><div className="flex items-center gap-3"><span className="progress-bar"><span style={{ width: `${row.value}%`, background: row.value < 92 ? "#8FBFEA" : accent }} /></span><span className="font-medium text-[#52525B]">{row.value}%</span></div></td><td><span className={`status-pill ${row.value < 92 ? "warning" : "success"}`}>{row.value < 92 ? "Follow-up" : "On track"}</span></td><td className="muted-cell">{["Neha Kulkarni", "Ravi Menon", "Sonia Joseph", "Arvind Iyer", "Meera Shah", "Daniel Thomas"][classAttendance.indexOf(row)]}</td><td><button className={marked.includes(row.label) ? "tiny-action done" : "tiny-action"} onClick={() => setMarked((current) => current.includes(row.label) ? current.filter((item) => item !== row.label) : [...current, row.label])}>{marked.includes(row.label) ? <><Check size={13} />Marked</> : "Review"}</button></td></tr>)}</tbody></table></div></div></div>;
}

function FinanceView({ onBack }: { onBack: () => void }) {
  const [showDialog, setShowDialog] = useState(false);
  return <div className="page-stack"><div className="page-intro"><div><button className="back-link" onClick={onBack}>← Overview</button><p className="eyebrow mt-4">Business operations</p><h1 className="page-title">Fees & finance</h1><p className="page-subtitle">A clear view of collections, outstanding balances and next actions.</p></div><button className="primary-button" onClick={() => setShowDialog(true)}><Plus size={16} />Record payment</button></div><div className="metric-grid three"><MetricBlock label="Collected this term" value="₹18.4L" comparison="82% of target" icon={IndianRupee} spark={[13, 15, 18, 20, 22, 25, 29]} /><MetricBlock label="Outstanding" value="₹4.1L" comparison="8 overdue accounts" icon={Receipt} spark={[29, 27, 26, 25, 23, 21, 19]} positive={false} /><MetricBlock label="Collection rate" value="82.1%" comparison="6.4% vs. last term" icon={Activity} spark={[18, 19, 20, 22, 23, 26, 29]} /></div><div className="dashboard-grid dashboard-grid-top"><section className="panel finance-chart-panel"><div className="panel-header"><div><p className="eyebrow">Term collections</p><h2 className="panel-title">Revenue movement</h2></div><span className="mini-label"><i className="legend-dot bg-[#F2A65A]" />Collected <i className="legend-dot bg-[#ECEAE4] ml-3" />Pending</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={260}><BarChart data={revenueData} barGap={5} margin={{ top: 8, right: 5, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="#EFEDE6" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#8b9591", fontSize: 11 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#a2aaa7", fontSize: 10 }} tickFormatter={(value) => `₹${value}L`} /><Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E8E5DC", fontSize: 12 }} /><Bar dataKey="collected" fill="#F2A65A" radius={[5, 5, 0, 0]} /><Bar dataKey="pending" fill="#ECEAE4" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></section><section className="panel"><div className="panel-header"><div><p className="eyebrow">Breakdown</p><h2 className="panel-title">Fee mix</h2></div></div><div className="fee-mix"><div className="pie-wrap"><ResponsiveContainer width="100%" height={170}><PieChart><Pie data={[{ name: "Tuition", value: 62 }, { name: "Transport", value: 18 }, { name: "Activities", value: 12 }, { name: "Other", value: 8 }]} cx="50%" cy="50%" innerRadius={48} outerRadius={68} dataKey="value" stroke="none">{["#F2A65A", "#B79CE4", "#8FBFEA", "#F4F2EC"].map((color) => <Cell key={color} fill={color} />)}</Pie></PieChart></ResponsiveContainer><div className="pie-center"><strong>₹22.5L</strong><span>total billed</span></div></div><div className="fee-legend">{[["Tuition", "62%", "#F2A65A"], ["Transport", "18%", "#B79CE4"], ["Activities", "12%", "#8FBFEA"], ["Other", "8%", "#F4F2EC"]].map(([label, value, color]) => <div key={label} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-[#71717A]"><i className="legend-dot" style={{ background: color }} />{label}</span><strong className="text-[#52525B]">{value}</strong></div>)}</div></div></section></div><section className="panel table-panel"><div className="panel-header"><div><p className="eyebrow">Follow-up queue</p><h2 className="panel-title">Outstanding payments</h2></div><button className="text-button" onClick={() => toast.success("Finance report exported")}>Export report <Download size={14} /></button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Family</th><th>Student</th><th>Invoice</th><th>Due date</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{[{ family: "Nair family", student: "Ishita Nair", invoice: "INV-2026-1048", due: "24 Sep 2026", amount: "₹42,500", status: "Reminder sent" }, { family: "Kapoor family", student: "Vihaan Kapoor", invoice: "INV-2026-1099", due: "20 Sep 2026", amount: "₹38,000", status: "Overdue" }, { family: "Thomas family", student: "Mira Thomas", invoice: "INV-2026-1126", due: "18 Sep 2026", amount: "₹31,500", status: "Overdue" }].map((row) => <tr key={row.invoice}><td className="font-medium text-[#26262B]">{row.family}</td><td className="muted-cell">{row.student}</td><td className="muted-cell">{row.invoice}</td><td className="muted-cell">{row.due}</td><td className="font-medium text-[#52525B]">{row.amount}</td><td><span className={`status-pill ${row.status === "Overdue" ? "warning" : "neutral"}`}>{row.status}</span></td><td><button className="tiny-action" onClick={() => toast.success("Payment reminder sent", { description: `Reminder sent to ${row.family}.` })}>Remind</button></td></tr>)}</tbody></table></div></section>{showDialog && <AppDialog title="Record payment" description="Log a payment against an existing family invoice." onClose={() => setShowDialog(false)}><div className="form-grid"><label>Student<input placeholder="Search student..." /></label><label>Amount<input placeholder="₹ 0.00" /></label><label>Payment date<input type="date" defaultValue="2026-09-28" /></label><label>Method<select defaultValue="Bank transfer"><option>Bank transfer</option><option>UPI</option><option>Cash</option><option>Card</option></select></label></div><div className="dialog-actions"><button className="secondary-button" onClick={() => setShowDialog(false)}>Cancel</button><button className="primary-button" onClick={() => { setShowDialog(false); toast.success("Payment recorded", { description: "The family ledger and collection rate were updated." }); }}>Record payment</button></div></AppDialog>}</div>;
}

function CommunicationView({ onBack }: { onBack: () => void }) {
  const [showDialog, setShowDialog] = useState(false);
  const announcements = [{ title: "Mid-term assessment week", audience: "All families", date: "Today, 9:12 AM", status: "Published", color: "teal" }, { title: "Campus maintenance · 3 Oct", audience: "Staff & families", date: "Yesterday", status: "Scheduled", color: "violet" }, { title: "Inter-school debate registrations", audience: "Grades 8–12", date: "26 Sep", status: "Published", color: "orange" }];
  return <div className="page-stack"><div className="page-intro"><div><button className="back-link" onClick={onBack}>← Overview</button><p className="eyebrow mt-4">School voice</p><h1 className="page-title">Communication</h1><p className="page-subtitle">Keep families, staff and students aligned with less noise.</p></div><button className="primary-button" onClick={() => setShowDialog(true)}><Plus size={16} />Create announcement</button></div><div className="communication-grid"><section className="panel announcement-panel"><div className="panel-header"><div><p className="eyebrow">Published & scheduled</p><h2 className="panel-title">Announcements</h2></div><span className="count-badge">4 unread</span></div><div className="announcement-list">{announcements.map((item) => <button className="announcement-row" key={item.title} onClick={() => toast(`Opening “${item.title}”`)}><span className={`announcement-mark ${item.color}`}><MessageSquare size={17} /></span><span className="min-w-0 flex-1 text-left"><span className="block font-medium text-[#26262B]">{item.title}</span><span className="mt-1 block text-xs text-[#929d99]">{item.audience} · {item.date}</span></span><span className={`status-pill ${item.status === "Published" ? "success" : "neutral"}`}>{item.status}</span><ChevronRight size={15} className="text-[#aab2af]" /></button>)}</div></section><section className="panel message-panel"><div className="panel-header"><div><p className="eyebrow">Inbox</p><h2 className="panel-title">Parent messages</h2></div><IconButton label="Inbox options"><MoreHorizontal size={17} /></IconButton></div><div className="message-list">{[{ initials: "MN", name: "Mrs. Nair", subject: "Ishita’s exam schedule", time: "11 min", unread: true }, { initials: "RD", name: "Mr. Deshmukh", subject: "Bus route 06 pickup", time: "1 hr", unread: true }, { initials: "FA", name: "Fatima Ahmed", subject: "Art club registration", time: "3 hrs", unread: false }].map((item, index) => <button className="message-row" key={item.name} onClick={() => toast(`Opening conversation with ${item.name}`)}><span className={`avatar avatar-sm ${["bg-[#e8def4] text-[#7554a7]", "bg-[#D6E9FA] text-[#3973a5]", "bg-[#f6e1d7] text-[#b76e4b]"][index]}`}>{item.initials}</span><span className="min-w-0 flex-1 text-left"><span className="flex items-center gap-2"><span className="truncate text-sm font-medium text-[#26262B]">{item.name}</span>{item.unread && <span className="unread-dot" />}</span><span className="mt-1 block truncate text-xs text-[#949e9a]">{item.subject}</span></span><span className="whitespace-nowrap text-[11px] text-[#a3aca9]">{item.time}</span></button>)}</div><button className="text-button mt-4" onClick={() => toast("Inbox opened")}>Open inbox <ChevronRight size={14} /></button></section></div>{showDialog && <AppDialog title="Create announcement" description="Share a clear update with the right school audience." onClose={() => setShowDialog(false)}><label className="block">Headline<input className="mt-2" placeholder="e.g. Library hours during assessment week" /></label><label className="mt-4 block">Audience<select className="mt-2" defaultValue="All families"><option>All families</option><option>All staff</option><option>Grades 8–12</option><option>Custom audience</option></select></label><label className="mt-4 block">Message<textarea className="mt-2" rows={4} placeholder="Write a short, useful update..." /></label><div className="dialog-actions"><button className="secondary-button" onClick={() => setShowDialog(false)}>Save draft</button><button className="primary-button" onClick={() => { setShowDialog(false); toast.success("Announcement published", { description: "Your update is now visible to the selected audience." }); }}>Publish now</button></div></AppDialog>}</div>;
}

function ReportsView({ onBack }: { onBack: () => void }) {
  return <div className="page-stack"><div className="page-intro"><div><button className="back-link" onClick={onBack}>← Overview</button><p className="eyebrow mt-4">Decision support</p><h1 className="page-title">Reports</h1><p className="page-subtitle">Fast answers for leadership reviews, board updates and daily operations.</p></div><button className="primary-button" onClick={() => toast.success("Report builder opened")}><Plus size={16} />Build a report</button></div><div className="report-card-grid">{[{ title: "Monthly principal review", detail: "Attendance, academics, fees & staffing", date: "Updated today", icon: ShieldCheck, color: "teal" }, { title: "Fee collection summary", detail: "Term 1 collections and outstanding balances", date: "Updated 2 hrs ago", icon: IndianRupee, color: "orange" }, { title: "Academic performance", detail: "Grade and subject-level outcomes", date: "Updated yesterday", icon: BookOpen, color: "violet" }, { title: "Parent engagement", detail: "Messages, events and portal activity", date: "Updated 26 Sep", icon: Users, color: "blue" }].map((report) => <button className="report-card" key={report.title} onClick={() => toast.success(`${report.title} opened`)}><span className={`report-icon ${report.color}`}><report.icon size={18} /></span><span className="mt-5 block text-left text-[15px] font-semibold tracking-[-0.015em] text-[#26262B]">{report.title}</span><span className="mt-2 block text-left text-xs leading-5 text-[#8d9893]">{report.detail}</span><span className="mt-6 flex items-center justify-between text-[11px] text-[#a0aaa6]"><span>{report.date}</span><ChevronRight size={15} /></span></button>)}</div><section className="panel"><div className="panel-header"><div><p className="eyebrow">Recent exports</p><h2 className="panel-title">Report history</h2></div><button className="secondary-button compact" onClick={() => toast("Report filters opened")}><Filter size={14} />Filter</button></div><div className="history-list">{[{ name: "September principal review.pdf", created: "28 Sep 2026 · Priya Shah", size: "2.4 MB" }, { name: "Fee collection — Term 1.csv", created: "26 Sep 2026 · Priya Shah", size: "184 KB" }, { name: "Grade 10 academic outcomes.pdf", created: "24 Sep 2026 · Rohan Mehta", size: "1.8 MB" }].map((report) => <div className="history-row" key={report.name}><span className="file-icon"><FileText size={16} /></span><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-[#26262B]">{report.name}</div><div className="mt-1 text-xs text-[#98a29e]">{report.created} · {report.size}</div></div><button className="tiny-action" onClick={() => toast.success("Download started")}>Download <Download size={13} /></button></div>)}</div></section></div>;
}

function PlaceholderView({ view, onBack }: { view: string; onBack: () => void }) {
  const config: Record<string, { icon: React.ElementType; kicker: string; detail: string }> = { Academics: { icon: BookOpen, kicker: "Learning operations", detail: "Curriculum, classes and outcomes are connected here." }, Examinations: { icon: FileText, kicker: "Assessment workspace", detail: "Plan exam windows, schedules and grade publishing." }, Assignments: { icon: Check, kicker: "Classwork flow", detail: "Track submissions and keep review queues moving." }, Transport: { icon: Bus, kicker: "Campus operations", detail: "Routes, vehicles and safe daily movement." }, Library: { icon: Library, kicker: "Resource centre", detail: "Catalogues, loans and reading engagement." }, Staff: { icon: Users, kicker: "People operations", detail: "Staff presence, leave and approvals." } };
  const item = config[view] ?? config.Academics;
  return <div className="page-stack"><div className="page-intro"><div><button className="back-link" onClick={onBack}>← Overview</button><p className="eyebrow mt-4">{item.kicker}</p><h1 className="page-title">{view}</h1><p className="page-subtitle">{item.detail}</p></div><button className="primary-button" onClick={() => toast(`${view} workspace ready to configure`)}><Sparkles size={16} />Explore workspace</button></div><div className="coming-soon-panel"><div className="coming-icon"><item.icon size={25} /></div><h2>Everything connected, nothing buried.</h2><p>This workspace shares the same operating model as the dashboard. The next layer of records, workflows and role views can be opened from here.</p><button className="secondary-button" onClick={() => toast.success("Workspace tour started")}>Take a quick tour <ChevronRight size={15} /></button></div></div>;
}

export default function Dashboard() {
  const [activeView, setActiveView] = useState("Overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [campusOpen, setCampusOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); }
      if (event.key === "Escape") { setCommandOpen(false); setCampusOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigate = (view: string) => { setActiveView(view); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const renderView = () => {
    if (activeView === "Overview") return <DashboardView onNavigate={navigate} />;
    if (activeView === "Students") return <StudentsView onBack={() => navigate("Overview")} />;
    if (activeView === "Attendance") return <AttendanceView onBack={() => navigate("Overview")} />;
    if (activeView === "Fees & Finance") return <FinanceView onBack={() => navigate("Overview")} />;
    if (activeView === "Communication") return <CommunicationView onBack={() => navigate("Overview")} />;
    if (activeView === "Reports") return <ReportsView onBack={() => navigate("Overview")} />;
    return <PlaceholderView view={activeView} onBack={() => navigate("Overview")} />;
  };

  return <div className="erp-app"><aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileNav ? "mobile-open" : ""}`}><div className="sidebar-top"><div className="brand-row"><div className="brand-mark"><span>G</span></div>{!collapsed && <div className="brand-copy"><strong>Global Kids</strong><span>School OS</span></div>}<button className="sidebar-close-mobile" onClick={() => setMobileNav(false)}><X size={18} /></button></div><div className="campus-switcher-wrap"><button className="campus-switcher" onClick={() => setCampusOpen((current) => !current)}><span className="campus-avatar">GK</span>{!collapsed && <span className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-semibold text-[#26262B]">Global Kids School</span><span className="mt-0.5 block text-[10px] text-[#9aa49f]">Tumakuru campus</span></span>}<ChevronDown size={14} className={`text-[#9ca7a2] transition-transform ${campusOpen ? "rotate-180" : ""}`} /></button>{campusOpen && !collapsed && <div className="campus-menu"><button onClick={() => { setCampusOpen(false); toast("Campus switcher is ready for multi-campus data"); }}>Tumakuru campus <Check size={14} /></button><button onClick={() => { setCampusOpen(false); toast("North campus is coming soon"); }}>North campus <span className="text-[10px] text-[#a1aaa6]">Soon</span></button></div>}</div></div><div className="sidebar-nav">{navGroups.map((group) => <div className="nav-group" key={group.label}><p className="nav-group-label">{!collapsed && group.label}</p>{group.items.map((item) => <button className={`nav-item ${activeView === item.label ? "active" : ""}`} key={item.label} onClick={() => navigate(item.label)} title={collapsed ? item.label : undefined}><item.icon size={17} strokeWidth={activeView === item.label ? 2.1 : 1.8} /><span className="nav-label">{item.label}</span>{item.count && <span className="nav-count">{item.count}</span>}</button>)}</div>)}<div className="nav-group settings-group"><p className="nav-group-label">{!collapsed && "System"}</p><button className={`nav-item ${activeView === "Settings" ? "active" : ""}`} onClick={() => navigate("Settings")} title={collapsed ? "Settings" : undefined}><Settings2 size={17} /><span className="nav-label">Settings</span></button></div></div><div className="sidebar-bottom"><button className="nav-item" onClick={() => toast("Help centre opened")} title={collapsed ? "Help centre" : undefined}><CircleHelp size={17} /><span className="nav-label">Help centre</span></button><div className={`user-card ${collapsed ? "compact" : ""}`}><span className="avatar avatar-sm bg-[#E3F5C8] text-[#567D2E]">PS</span>{!collapsed && <span className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-semibold text-[#26262B]">Priya Shah</span><span className="mt-0.5 block truncate text-[10px] text-[#9aa49f]">Principal · Admin</span></span>}<button className="user-more" onClick={() => toast("Profile options opened")}><MoreHorizontal size={15} /></button></div></div><button className="collapse-button" onClick={() => setCollapsed((current) => !current)}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}<span>{collapsed ? "Expand" : "Collapse"}</span></button></aside><div className={`mobile-nav-scrim ${mobileNav ? "visible" : ""}`} onClick={() => setMobileNav(false)} /><main className={`main-area ${collapsed ? "sidebar-collapsed" : ""}`}><header className="topbar"><div className="topbar-left"><IconButton label="Open navigation" className="mobile-menu-button" onClick={() => setMobileNav(true)}><Menu size={18} /></IconButton><button className="command-trigger" onClick={() => setCommandOpen(true)}><Search size={16} /><span>Search anything</span><kbd><Command size={11} />K</kbd></button></div><div className="topbar-actions">
            <a href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E5DC] text-xs font-bold text-[#52525B] hover:bg-[#F6F4EF] transition-colors">
              <span>🌐 Public Website</span>
            </a>
            <span className="live-status"><span className="live-dot" />All systems normal</span>
            <IconButton label="Notifications" onClick={() => toast("You’re all caught up", { description: "No new high-priority notifications." })}><Bell size={17} /></IconButton>
            <span className="topbar-divider" />
            <button className="topbar-profile" onClick={() => toast("Profile options opened")}><span className="avatar avatar-sm bg-[#E3F5C8] text-[#567D2E]">PS</span><ChevronDown size={13} className="text-[#9aa49f]" /></button>
          </div></header><div className="content-area">{renderView()}</div></main><CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onNavigate={navigate} /></div>;
}

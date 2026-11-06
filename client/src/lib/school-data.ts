import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "./toast";
import {
  AlertCircle,
  BookOpen,
  Bus,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileText,
  IndianRupee,
  Library,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "./supabase";
import { notifyDataChanged, useDataRevision } from "./live-data";

export type RowId = string | number;
export type BaseRow = { id: RowId } & Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* Mock data — offline fallback, replaced by Supabase rows when live   */
/* ------------------------------------------------------------------ */

export const mockAttendanceData = [
  { id: "mon", day: "Mon", present: 2268, absent: 218 },
  { id: "tue", day: "Tue", present: 2310, absent: 176 },
  { id: "wed", day: "Wed", present: 2290, absent: 196 },
  { id: "thu", day: "Thu", present: 2354, absent: 132 },
  { id: "fri", day: "Fri", present: 2318, absent: 168 },
  { id: "sat", day: "Sat", present: 2380, absent: 106 },
  { id: "today", day: "Today", present: 2357, absent: 129 },
];

export const mockStudents = [
  { id: "GKS-24081", name: "Aarav Mehta", initials: "AM", grade: "Grade 8", section: "B", attendance: 97, average: 91, fees: "Paid", status: "Active", tone: "teal" },
  { id: "GKS-23819", name: "Ishita Nair", initials: "IN", grade: "Grade 10", section: "A", attendance: 94, average: 88, fees: "Paid", status: "Active", tone: "violet" },
  { id: "GKS-24211", name: "Vihaan Kapoor", initials: "VK", grade: "Grade 6", section: "B", attendance: 89, average: 82, fees: "Due", status: "Review", tone: "amber" },
  { id: "GKS-23104", name: "Ananya Rao", initials: "AR", grade: "Grade 6", section: "A", attendance: 98, average: 95, fees: "Paid", status: "Active", tone: "rose" },
  { id: "GKS-23998", name: "Kabir Malhotra", initials: "KM", grade: "Grade 9", section: "B", attendance: 92, average: 86, fees: "Paid", status: "Active", tone: "blue" },
  { id: "GKS-24306", name: "Mira Thomas", initials: "MT", grade: "Grade 7", section: "A", attendance: 86, average: 79, fees: "Due", status: "Review", tone: "orange" },
  { id: "GKS-23277", name: "Arjun Menon", initials: "AM", grade: "Grade 9", section: "A", attendance: 96, average: 90, fees: "Paid", status: "Active", tone: "indigo" },
  { id: "GKS-24170", name: "Sara Fernandes", initials: "SF", grade: "Grade 7", section: "B", attendance: 93, average: 87, fees: "Paid", status: "Active", tone: "pink" },
  { id: "GKS-24401", name: "Rohan Verma", initials: "RV", grade: "Grade 8", section: "A", attendance: 95, average: 89, fees: "Due", status: "Active", tone: "emerald" },
  { id: "GKS-24512", name: "Tanvi Deshmukh", initials: "TD", grade: "Grade 10", section: "B", attendance: 99, average: 94, fees: "Paid", status: "Active", tone: "cyan" },
];

export const mockSchedule = [
  { id: "s1", time: "09:00", subject: "Mathematics", detail: "Grade 8 · Room 204", color: "#2f6f68" },
  { id: "s2", time: "10:00", subject: "Physics", detail: "Grade 10 · Lab 1", color: "#7c63c8" },
  { id: "s3", time: "11:00", subject: "English Literature", detail: "Grade 9 · Room 118", color: "#cf845a" },
  { id: "s4", time: "12:00", subject: "Lunch break", detail: "Campus-wide", color: "#9aa09f" },
  { id: "s5", time: "13:00", subject: "Chemistry", detail: "Grade 10 · Lab 2", color: "#3b82b4" },
];

export type ActivityCategory = "general" | "operation" | "library";

export const mockActivityLog: ActivityItem[] = [
  // General — recent activity feed (Overview)
  { id: "act-1", category: "general", time: "8 min ago", title: "Fee payment received", detail: "Aarav Mehta · Term 1", icon: "rupee", color: "emerald" },
  { id: "act-2", category: "general", time: "24 min ago", title: "Attendance submitted", detail: "Grade 7 — Section B", icon: "clipboard", color: "blue" },
  { id: "act-3", category: "general", time: "1 hr ago", title: "Exam schedule published", detail: "Mid-term assessments", icon: "calendar", color: "violet" },
  { id: "act-4", category: "general", time: "2 hrs ago", title: "Parent message received", detail: "Mrs. Nair · Grade 10A", icon: "message", color: "amber" },
  // Operations — today's checkpoints (Overview)
  { id: "ops-1", category: "operation", time: "08:15", title: "Morning attendance window", detail: "32 classes · 2,357 present", icon: "clipboard", color: "teal" },
  { id: "ops-2", category: "operation", time: "11:30", title: "Mid-term timetable review", detail: "2 conflicts need a decision", icon: "calendar", color: "violet" },
  { id: "ops-3", category: "operation", time: "14:00", title: "Finance reconciliation", detail: "₹1.8L received since yesterday", icon: "rupee", color: "orange" },
  { id: "ops-4", category: "operation", time: "16:30", title: "Parent community update", detail: "Announcement scheduled to publish", icon: "message", color: "blue" },
  // Library — returns feed
  { id: "lib-1", category: "library", time: "09:42", title: "Wings of Fire returned", detail: "Kabir Malhotra · Grade 9", icon: "book", color: "emerald" },
  { id: "lib-2", category: "library", time: "09:15", title: "Chemistry guide issued", detail: "Ishita Nair · Grade 10", icon: "library", color: "blue" },
  { id: "lib-3", category: "library", time: "08:50", title: "Novel returned late", detail: "Vihaan Kapoor · Grade 6 · +2 days", icon: "alert", color: "amber" },
  { id: "lib-4", category: "library", time: "08:30", title: "History atlas issued", detail: "Ananya Rao · Grade 12", icon: "library", color: "violet" },
];

export const mockHealthMetrics = [
  { id: "hm-1", label: "Attendance", value: "94.8%", change: "+1.8%", progress: 94.8, color: "#2f6f68" },
  { id: "hm-2", label: "Academic average", value: "86.4%", change: "+3.2%", progress: 86.4, color: "#7662bc" },
  { id: "hm-3", label: "Fee collection", value: "82.1%", change: "+6.4%", progress: 82.1, color: "#cf845a" },
  { id: "hm-4", label: "Parent engagement", value: "78.6%", change: "+4.1%", progress: 78.6, color: "#3b82b4" },
];

export const mockRevenueData = [
  { id: "apr", month: "Apr", collected: 24, pending: 8 },
  { id: "may", month: "May", collected: 28, pending: 7 },
  { id: "jun", month: "Jun", collected: 31, pending: 6 },
  { id: "jul", month: "Jul", collected: 34, pending: 5 },
  { id: "aug", month: "Aug", collected: 37, pending: 4 },
  { id: "sep", month: "Sep", collected: 41, pending: 3 },
];

export const mockClassAttendance = [
  { id: "ca-1", label: "Grade 6 — A", value: 97, present: 31, total: 32, teacher: "Neha Kulkarni" },
  { id: "ca-2", label: "Grade 6 — B", value: 89, present: 28, total: 32, teacher: "Ravi Menon" },
  { id: "ca-3", label: "Grade 7 — A", value: 95, present: 30, total: 32, teacher: "Sonia Joseph" },
  { id: "ca-4", label: "Grade 7 — B", value: 94, present: 29, total: 31, teacher: "Arvind Iyer" },
  { id: "ca-5", label: "Grade 8 — A", value: 98, present: 30, total: 31, teacher: "Meera Shah" },
  { id: "ca-6", label: "Grade 8 — B", value: 96, present: 29, total: 30, teacher: "Daniel Thomas" },
  { id: "ca-7", label: "Grade 9 — A", value: 94, present: 28, total: 30, teacher: "Karthik Rao" },
  { id: "ca-8", label: "Grade 9 — B", value: 95, present: 29, total: 30, teacher: "Priya Nair" },
  { id: "ca-9", label: "Grade 10 — A", value: 97, present: 30, total: 31, teacher: "Rohan Mehta" },
  { id: "ca-10", label: "Grade 10 — B", value: 96, present: 29, total: 30, teacher: "Ananya Sen" },
];

export const avatarTones: Record<string, string> = {
  teal: "bg-[rgba(99,102,241,0.14)] text-[var(--brand-strong)]",
  violet: "bg-[rgba(150,125,220,0.13)] text-[#ab95e8]",
  amber: "bg-[rgba(224,180,92,0.13)] text-[#e0b45c]",
  rose: "bg-[rgba(224,122,122,0.13)] text-[#ec9c9c]",
  blue: "bg-[rgba(92,155,210,0.13)] text-[#7cb8e8]",
  orange: "bg-[rgba(216,138,82,0.13)] text-[#ecab7e]",
  indigo: "bg-[rgba(112,128,200,0.13)] text-[#9aa8ec]",
  pink: "bg-[rgba(200,110,150,0.13)] text-[#ec9cc4]",
};

export const mockStaff = [
  { id: "STF-001", usn: "STF1001", name: "Neha Kulkarni", initials: "NK", role: "Class Teacher", department: "Grade 8", email: "neha.kulkarni@globalkids.edu", attendance: 98, status: "On campus", tone: "teal" },
  { id: "STF-002", usn: "STF1002", name: "Ravi Menon", initials: "RM", role: "Physics Teacher", department: "Senior School", email: "ravi.menon@globalkids.edu", attendance: 96, status: "On campus", tone: "blue" },
  { id: "STF-003", usn: "STF1003", name: "Sonia Joseph", initials: "SJ", role: "English Teacher", department: "Middle School", email: "sonia.joseph@globalkids.edu", attendance: 94, status: "On campus", tone: "violet" },
  { id: "STF-004", usn: "STF1004", name: "Arvind Iyer", initials: "AI", role: "Chemistry Teacher", department: "Senior School", email: "arvind.iyer@globalkids.edu", attendance: 91, status: "On leave", tone: "amber" },
  { id: "STF-005", usn: "STF1005", name: "Meera Shah", initials: "MS", role: "Mathematics Teacher", department: "Middle School", email: "meera.shah@globalkids.edu", attendance: 97, status: "On campus", tone: "rose" },
  { id: "STF-006", usn: "STF1006", name: "Daniel Thomas", initials: "DT", role: "Sports Coordinator", department: "Activities", email: "daniel.thomas@globalkids.edu", attendance: 93, status: "On campus", tone: "orange" },
  { id: "STF-007", usn: "STF1007", name: "Priya Nair", initials: "PN", role: "Admissions Officer", department: "Front Office", email: "priya.nair@globalkids.edu", attendance: 99, status: "On campus", tone: "indigo" },
  { id: "STF-008", usn: "STF1008", name: "Karthik Rao", initials: "KR", role: "IT Administrator", department: "Technology", email: "karthik.rao@globalkids.edu", attendance: 95, status: "On campus", tone: "pink" },
];

export const mockTimetable = [
  // Monday
  { id: "tt-mon-1", day: "Monday", period: "Period 1", time: "08:00 – 08:45", grade_6: "Mathematics", grade_7: "English", grade_8: "Physics", grade_9: "Chemistry", grade_10: "Mathematics" },
  { id: "tt-mon-2", day: "Monday", period: "Period 2", time: "08:45 – 09:30", grade_6: "Science", grade_7: "Mathematics", grade_8: "English", grade_9: "History", grade_10: "Physics" },
  { id: "tt-mon-3", day: "Monday", period: "Period 3", time: "09:30 – 10:15", grade_6: "Hindi", grade_7: "Physics", grade_8: "Mathematics", grade_9: "English", grade_10: "Chemistry" },
  { id: "tt-mon-4", day: "Monday", period: "Period 4", time: "10:15 – 11:00", grade_6: "Computer Science", grade_7: "Chemistry", grade_8: "Biology", grade_9: "Mathematics", grade_10: "Biology" },
  { id: "tt-mon-5", day: "Monday", period: "Period 5", time: "11:15 – 11:45", grade_6: "Art", grade_7: "Sports", grade_8: "Music", grade_9: "Library", grade_10: "Computer Science" },
  { id: "tt-mon-6", day: "Monday", period: "Period 6", time: "11:45 – 12:30", grade_6: "Social Studies", grade_7: "Biology", grade_8: "Chemistry", grade_9: "Physics", grade_10: "English" },
  // Tuesday
  { id: "tt-tue-1", day: "Tuesday", period: "Period 1", time: "08:00 – 08:45", grade_6: "English", grade_7: "Physics", grade_8: "Chemistry", grade_9: "Mathematics", grade_10: "Physics" },
  { id: "tt-tue-2", day: "Tuesday", period: "Period 2", time: "08:45 – 09:30", grade_6: "Mathematics", grade_7: "English", grade_8: "History", grade_9: "Science", grade_10: "Mathematics" },
  { id: "tt-tue-3", day: "Tuesday", period: "Period 3", time: "09:30 – 10:15", grade_6: "Physics", grade_7: "Mathematics", grade_8: "English", grade_9: "Hindi", grade_10: "Chemistry" },
  { id: "tt-tue-4", day: "Tuesday", period: "Period 4", time: "10:15 – 11:00", grade_6: "Chemistry", grade_7: "Biology", grade_8: "Mathematics", grade_9: "Computer Science", grade_10: "Biology" },
  { id: "tt-tue-5", day: "Tuesday", period: "Period 5", time: "11:15 – 11:45", grade_6: "Sports", grade_7: "Music", grade_8: "Library", grade_9: "Art", grade_10: "English" },
  { id: "tt-tue-6", day: "Tuesday", period: "Period 6", time: "11:45 – 12:30", grade_6: "Biology", grade_7: "Chemistry", grade_8: "Physics", grade_9: "Social Studies", grade_10: "History" },
  // Wednesday
  { id: "tt-wed-1", day: "Wednesday", period: "Period 1", time: "08:00 – 08:45", grade_6: "Physics", grade_7: "Chemistry", grade_8: "Mathematics", grade_9: "English", grade_10: "Chemistry" },
  { id: "tt-wed-2", day: "Wednesday", period: "Period 2", time: "08:45 – 09:30", grade_6: "English", grade_7: "History", grade_8: "Science", grade_9: "Mathematics", grade_10: "Physics" },
  { id: "tt-wed-3", day: "Wednesday", period: "Period 3", time: "09:30 – 10:15", grade_6: "Mathematics", grade_7: "English", grade_8: "Hindi", grade_9: "Physics", grade_10: "Mathematics" },
  { id: "tt-wed-4", day: "Wednesday", period: "Period 4", time: "10:15 – 11:00", grade_6: "Biology", grade_7: "Mathematics", grade_8: "Computer Science", grade_9: "Chemistry", grade_10: "Biology" },
  { id: "tt-wed-5", day: "Wednesday", period: "Period 5", time: "11:15 – 11:45", grade_6: "Music", grade_7: "Library", grade_8: "Art", grade_9: "Sports", grade_10: "Library" },
  { id: "tt-wed-6", day: "Wednesday", period: "Period 6", time: "11:45 – 12:30", grade_6: "Chemistry", grade_7: "Physics", grade_8: "Social Studies", grade_9: "Biology", grade_10: "Computer Science" },
  // Thursday
  { id: "tt-thu-1", day: "Thursday", period: "Period 1", time: "08:00 – 08:45", grade_6: "Chemistry", grade_7: "Mathematics", grade_8: "English", grade_9: "Physics", grade_10: "Mathematics" },
  { id: "tt-thu-2", day: "Thursday", period: "Period 2", time: "08:45 – 09:30", grade_6: "History", grade_7: "Science", grade_8: "Mathematics", grade_9: "English", grade_10: "Physics" },
  { id: "tt-thu-3", day: "Thursday", period: "Period 3", time: "09:30 – 10:15", grade_6: "English", grade_7: "Hindi", grade_8: "Physics", grade_9: "Mathematics", grade_10: "Chemistry" },
  { id: "tt-thu-4", day: "Thursday", period: "Period 4", time: "10:15 – 11:00", grade_6: "Mathematics", grade_7: "Computer Science", grade_8: "Chemistry", grade_9: "Biology", grade_10: "Biology" },
  { id: "tt-thu-5", day: "Thursday", period: "Period 5", time: "11:15 – 11:45", grade_6: "Library", grade_7: "Art", grade_8: "Sports", grade_9: "Music", grade_10: "Sports" },
  { id: "tt-thu-6", day: "Thursday", period: "Period 6", time: "11:45 – 12:30", grade_6: "Physics", grade_7: "Social Studies", grade_8: "Biology", grade_9: "Chemistry", grade_10: "Social Studies" },
  // Friday (rotation repeats every 4 days)
  { id: "tt-fri-1", day: "Friday", period: "Period 1", time: "08:00 – 08:45", grade_6: "Mathematics", grade_7: "English", grade_8: "Physics", grade_9: "Chemistry", grade_10: "Mathematics" },
  { id: "tt-fri-2", day: "Friday", period: "Period 2", time: "08:45 – 09:30", grade_6: "Science", grade_7: "Mathematics", grade_8: "English", grade_9: "History", grade_10: "Physics" },
  { id: "tt-fri-3", day: "Friday", period: "Period 3", time: "09:30 – 10:15", grade_6: "Hindi", grade_7: "Physics", grade_8: "Mathematics", grade_9: "English", grade_10: "Chemistry" },
  { id: "tt-fri-4", day: "Friday", period: "Period 4", time: "10:15 – 11:00", grade_6: "Computer Science", grade_7: "Chemistry", grade_8: "Biology", grade_9: "Mathematics", grade_10: "Biology" },
  { id: "tt-fri-5", day: "Friday", period: "Period 5", time: "11:15 – 11:45", grade_6: "Art", grade_7: "Sports", grade_8: "Music", grade_9: "Library", grade_10: "Art" },
  { id: "tt-fri-6", day: "Friday", period: "Period 6", time: "11:45 – 12:30", grade_6: "Social Studies", grade_7: "Biology", grade_8: "Chemistry", grade_9: "Physics", grade_10: "Computer Science" },
  // Saturday
  { id: "tt-sat-1", day: "Saturday", period: "Period 1", time: "08:00 – 08:45", grade_6: "English", grade_7: "Physics", grade_8: "Chemistry", grade_9: "Mathematics", grade_10: "Physics" },
  { id: "tt-sat-2", day: "Saturday", period: "Period 2", time: "08:45 – 09:30", grade_6: "Mathematics", grade_7: "English", grade_8: "History", grade_9: "Science", grade_10: "Mathematics" },
  { id: "tt-sat-3", day: "Saturday", period: "Period 3", time: "09:30 – 10:15", grade_6: "Physics", grade_7: "Mathematics", grade_8: "English", grade_9: "Hindi", grade_10: "Chemistry" },
  { id: "tt-sat-4", day: "Saturday", period: "Period 4", time: "10:15 – 11:00", grade_6: "Chemistry", grade_7: "Biology", grade_8: "Mathematics", grade_9: "Computer Science", grade_10: "Biology" },
  { id: "tt-sat-5", day: "Saturday", period: "Period 5", time: "11:15 – 11:45", grade_6: "Sports", grade_7: "Music", grade_8: "Library", grade_9: "Art", grade_10: "Sports" },
  { id: "tt-sat-6", day: "Saturday", period: "Period 6", time: "11:45 – 12:30", grade_6: "Biology", grade_7: "Chemistry", grade_8: "Physics", grade_9: "Social Studies", grade_10: "English" },
];

export const mockSubjects = [
  { id: "sub-1", name: "Mathematics", teacher: "Meera Shah", classes: "Grades 6–10", periods: 9, progress: 64 },
  { id: "sub-2", name: "Science", teacher: "Ravi Menon", classes: "Grades 6–10", periods: 8, progress: 71 },
  { id: "sub-3", name: "English", teacher: "Sonia Joseph", classes: "Grades 6–10", periods: 7, progress: 58 },
  { id: "sub-4", name: "Computer Science", teacher: "Karthik Rao", classes: "Grades 6–10", periods: 4, progress: 82 },
  { id: "sub-5", name: "Social Studies", teacher: "Arvind Iyer", classes: "Grades 6–10", periods: 5, progress: 49 },
  { id: "sub-6", name: "Languages", teacher: "Priya Nair", classes: "Grades 6–10", periods: 6, progress: 67 },
];

export const mockExams = [
  { id: "EXM-001", name: "Mid-term Mathematics", subject: "Mathematics", grade: "Grade 8", date: "02 Oct 2026", time: "09:00 – 10:30", venue: "Room 204", status: "Scheduled" },
  { id: "EXM-002", name: "Mid-term Physics", subject: "Physics", grade: "Grade 10", date: "03 Oct 2026", time: "09:00 – 10:30", venue: "Lab 1", status: "Scheduled" },
  { id: "EXM-003", name: "Unit English", subject: "English", grade: "Grade 7", date: "04 Oct 2026", time: "10:45 – 11:45", venue: "Room 118", status: "Scheduled" },
  { id: "EXM-004", name: "Chemistry practical", subject: "Chemistry", grade: "Grade 9", date: "07 Oct 2026", time: "13:00 – 15:00", venue: "Lab 2", status: "Draft" },
  { id: "EXM-005", name: "Mid-term Hindi", subject: "Hindi", grade: "Grade 6", date: "08 Oct 2026", time: "09:00 – 10:30", venue: "Room 102", status: "Scheduled" },
];

export const mockExamResults = [
  { id: "res-1", subject: "Mathematics", grade: "Grade 8 — B", graded: 29, total: 31, published: false },
  { id: "res-2", subject: "Physics", grade: "Grade 10 — A", graded: 30, total: 31, published: false },
  { id: "res-3", subject: "English", grade: "Grade 7 — B", graded: 24, total: 32, published: false },
  { id: "res-4", subject: "History", grade: "Grade 9 — B", graded: 28, total: 28, published: true },
];

export const mockLibraryBooks = [
  { id: "BK-001", title: "The Discovery of India", author: "Jawaharlal Nehru", category: "History", copies: 8, issued: 5, status: "Available" },
  { id: "BK-002", title: "A Brief History of Time", author: "Stephen Hawking", category: "Science", copies: 6, issued: 6, status: "All out" },
  { id: "BK-003", title: "Wings of Fire", author: "A. P. J. Abdul Kalam", category: "Biography", copies: 10, issued: 4, status: "Available" },
  { id: "BK-004", title: "The Giver", author: "Lois Lowry", category: "Fiction", copies: 7, issued: 7, status: "All out" },
  { id: "BK-005", title: "Economics: Class 10", author: "NCERT", category: "Textbook", copies: 12, issued: 9, status: "Available" },
  { id: "BK-006", title: "The Hate U Give", author: "Angie Thomas", category: "Fiction", copies: 5, issued: 2, status: "Available" },
];

export const mockAnnouncements = [
  { id: "ANN-001", title: "Mid-term assessment week", audience: "All families", date: "Today · 09:12", status: "Published", color: "teal", image_url: null, body: null },
  { id: "ANN-002", title: "Campus maintenance · 3 Oct", audience: "Staff & families", date: "Yesterday", status: "Scheduled", color: "violet", image_url: null, body: null },
  { id: "ANN-003", title: "Inter-school debate registrations", audience: "Grades 8–10", date: "26 Sep", status: "Published", color: "orange", image_url: null, body: null },
  { id: "ANN-004", title: "Parent-teacher meeting schedule", audience: "All families", date: "24 Sep", status: "Published", color: "teal", image_url: null, body: null },
  { id: "ANN-005", title: "Winter uniform distribution", audience: "All families", date: "22 Sep", status: "Published", color: "violet", image_url: null, body: null },
  { id: "ANN-006", title: "Staff development workshop", audience: "All staff", date: "20 Sep", status: "Published", color: "orange", image_url: null, body: null },
];

export const mockMessages = [
  { id: "MSG-001", initials: "MN", name: "Mrs. Nair", subject: "Ishita’s exam schedule", time: "11 min", unread: true },
  { id: "MSG-002", initials: "RD", name: "Mr. Deshmukh", subject: "School schedule update", time: "1 hr", unread: true },
  { id: "MSG-003", initials: "FA", name: "Fatima Ahmed", subject: "Art club registration", time: "3 hrs", unread: false },
];

export const mockNotifications = [
  { id: 1, title: "Attendance alert", detail: "Grade 6 — B dropped below 90% for today", time: "12 min ago", unread: true, tone: "coral", kind: "Attendance", icon: "alert" },
  { id: 2, title: "Fee payment received", detail: "Kapoor family paid ₹25,000 installment · INV-2026-1099", time: "48 min ago", unread: true, tone: "teal", kind: "Finance", icon: "rupee" },
  { id: 3, title: "Exam schedule published", detail: "Mid-term timetable is now visible to families", time: "2 hrs ago", unread: true, tone: "violet", kind: "Academic", icon: "file" },
  { id: 4, title: "Leave request pending", detail: "Arvind Iyer requested 2 days · 06–07 Oct", time: "3 hrs ago", unread: true, tone: "amber", kind: "Attendance", icon: "calendar" },
  { id: 6, title: "New parent message", detail: "Mrs. Nair · Ishita's exam schedule", time: "Yesterday", unread: false, tone: "teal", kind: "Message", icon: "message" },
];

export const mockInvoices = [
  { id: "INV-2026-1048", family: "Nair family", student: "Ishita Nair", due_date: "24 Sep 2026", amount: 60000, status: "Reminder sent" },
  { id: "INV-2026-1099", family: "Kapoor family", student: "Vihaan Kapoor", due_date: "20 Sep 2026", amount: 50000, status: "Overdue" },
  { id: "INV-2026-1126", family: "Thomas family", student: "Mira Thomas", due_date: "18 Sep 2026", amount: 50000, status: "Overdue" },
];

export const mockPayments: Payment[] = [
  { id: "PAY-001", invoice_id: "INV-2026-1048", student: "Ishita Nair", amount: 30000, method: "Bank transfer", paid_at: "2026-09-28T08:52:00Z" },
  { id: "PAY-002", invoice_id: null, student: "Sara Fernandes", amount: 25000, method: "UPI", paid_at: "2026-09-28T08:15:00Z" },
  { id: "PAY-003", invoice_id: null, student: "Arjun Menon", amount: 30000, method: "Card", paid_at: "2026-09-27T16:40:00Z" },
  { id: "PAY-004", invoice_id: "INV-2026-1099", student: "Vihaan Kapoor", amount: 25000, method: "Cash", paid_at: "2026-09-26T11:20:00Z" },
];

export const mockReportExports = [
  { id: "RPT-001", name: "September principal review.pdf", created: "28 Sep 2026 · Principal", size: "2.4 MB" },
  { id: "RPT-002", name: "Fee collection — Term 1.csv", created: "26 Sep 2026 · Accounts", size: "184 KB" },
  { id: "RPT-003", name: "Grade 10 academic outcomes.pdf", created: "24 Sep 2026 · Rohan Mehta", size: "1.8 MB" },
];

export const mockPerformanceTrend = [
  { id: "pt-apr", month: "Apr", mathematics: 78, science: 81, english: 74 },
  { id: "pt-may", month: "May", mathematics: 80, science: 82, english: 76 },
  { id: "pt-jun", month: "Jun", mathematics: 79, science: 84, english: 78 },
  { id: "pt-jul", month: "Jul", mathematics: 83, science: 85, english: 80 },
  { id: "pt-aug", month: "Aug", mathematics: 85, science: 86, english: 81 },
  { id: "pt-sep", month: "Sep", mathematics: 86, science: 88, english: 83 },
];

export const mockSubjectAverages = [
  { id: "sa-1", subject: "Math", average: 84 },
  { id: "sa-2", subject: "Science", average: 86 },
  { id: "sa-3", subject: "English", average: 82 },
  { id: "sa-4", subject: "Social", average: 79 },
  { id: "sa-5", subject: "Languages", average: 85 },
];

export const mockGradeOutcomes = [
  { id: "go-1", grade: "Grade 6", average: 84, attendance: 94, change: "+1.4%" },
  { id: "go-2", grade: "Grade 7", average: 86, attendance: 95, change: "+3.0%" },
  { id: "go-3", grade: "Grade 8", average: 83, attendance: 93, change: "+0.8%" },
  { id: "go-4", grade: "Grade 9", average: 88, attendance: 96, change: "+2.1%" },
  { id: "go-5", grade: "Grade 10", average: 85, attendance: 97, change: "+2.6%" },
];

export const mockFeeCategories = [
  { id: "fc-1", name: "Tuition Fee", value: 100, color: "#2f6f68" },
];

export const mockSettings: SettingRow[] = [
  { id: "set-1", key: "school_name", value: "Global Kids School" },
  { id: "set-2", key: "campus", value: "Tumakuru" },
  { id: "set-3", key: "address", value: "2nd Cross, Tumakuru, Karnataka" },
  { id: "set-4", key: "phone", value: "+91 98765 43210" },
  { id: "set-5", key: "academic_year", value: "2026–27" },
  { id: "set-6", key: "current_term", value: "Term 1" },
  { id: "set-7", key: "grade_scale", value: "Percentage (0–100)" },
  { id: "set-8", key: "attendance_threshold", value: "90%" },
  { id: "set-9", key: "notif_attendance", value: true },
  { id: "set-10", key: "notif_fees", value: true },
  { id: "set-11", key: "notif_messages", value: true },
  { id: "set-12", key: "notif_exams", value: false },
  { id: "set-13", key: "notif_digest", value: true },
];

/* ------------------------------------------------------------------ */
/* Row types — column names mirror the UI field names                  */
/* ------------------------------------------------------------------ */

export interface Student extends BaseRow { usn?: string; name: string; initials: string; grade: string; section: string; attendance: number; /** How many attendance rows back `attendance`. 0 means unmarked, not 0%. */ attendance_records: number; average: number; scored_papers: number; fees: string; status: string; tone: string; }
export interface StaffMember extends BaseRow { usn: string; name: string; initials: string; role: string; department: string; email: string; attendance: number; status: string; tone: string; photo_url?: string | null; }
export interface AttendanceDaily extends BaseRow { day: string; date?: string; label?: string; present: number; absent: number; late?: number; leave?: number; }
export interface ClassAttendanceRow extends BaseRow { label: string; value: number; present: number; total: number; teacher: string; }
export interface ScheduleItem extends BaseRow { time: string; subject: string; detail: string; color: string; }
export interface ActivityItem extends BaseRow { category: ActivityCategory; time: string; title: string; detail: string; icon: string; color: string; }
export interface HealthMetric extends BaseRow { label: string; value: string; change: string; progress: number; color: string; }
export interface FinanceMonth extends BaseRow { month: string; collected: number; pending: number; }
export interface FeeCategory extends BaseRow { name: string; value: number; color: string; }
export interface Invoice extends BaseRow { student_id?: string; family: string; student: string; due_date: string; amount: number; total?: number; paid?: number; outstanding?: number; status: string; }
export interface Payment extends BaseRow { invoice_id: string | null; student: string; amount: number; method: string; paid_at: string; }
export interface Announcement extends BaseRow { title: string; audience: string; date: string; status: string; color: string; image_url: string | null; body: string | null; }
export interface ParentMessage extends BaseRow { initials: string; name: string; subject: string; time: string; unread: boolean; }
export interface NotificationItem extends BaseRow { title: string; detail: string; time: string; unread: boolean; tone: string; icon: string; kind: string; }
export interface Exam extends BaseRow { name: string; subject: string; grade: string; date: string; time: string; venue: string; status: string; }
export interface ExamResult extends BaseRow { subject: string; grade: string; graded: number; total: number; published: boolean; }
export interface LibraryBook extends BaseRow { title: string; author: string; category: string; copies: number; issued: number; status: string; }
export interface TimetableEntry extends BaseRow { day: string; period: string; time: string; grade_6: string; grade_7: string; grade_8: string; grade_9: string; grade_10?: string; }
export const MIN_INSTALLMENT_AMOUNT = 5000;

export function getAnnualFeeForGrade(grade?: string | number | null): number {
  if (!grade) return 50000;
  const num = parseInt(String(grade).replace(/\D/g, ""), 10);
  if (num >= 9) return 60000;
  return 50000;
}
export interface SubjectRow extends BaseRow { name: string; teacher: string; classes: string; periods: number; progress: number; }
export interface PerformanceTrend extends BaseRow { month: string; mathematics: number; science: number; english: number; }
export interface SubjectAverage extends BaseRow { subject: string; average: number; }
export interface GradeOutcome extends BaseRow { grade: string; average: number; attendance: number; change: string; }
export interface ReportExport extends BaseRow { name: string; created: string; size: string; }
export interface SettingRow extends BaseRow { key: string; value: string | number | boolean; }

/* ------------------------------------------------------------------ */
/* Realtime channel registry — one channel per table, fanned out       */
/* ------------------------------------------------------------------ */

type ChangePayload = { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> };

const channelListeners = new Map<string, Set<(payload: ChangePayload) => void>>();
const channelHandles = new Map<string, { unsubscribe: () => void }>();

function subscribeToTable(table: string, key: string, cb: (payload: ChangePayload) => void): () => void {
  const mapKey = `${table}::${key}`;
  let listeners = channelListeners.get(mapKey);
  if (!listeners) {
    listeners = new Set();
    channelListeners.set(mapKey, listeners);
  }
  listeners.add(cb);
  if (listeners.size === 1) {
    const channel = supabase
      .channel(`public:${mapKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        listeners?.forEach((fn) => fn(payload as unknown as ChangePayload));
      })
      .subscribe();
    channelHandles.set(mapKey, channel);
  }
  return () => {
    listeners?.delete(cb);
    if (listeners && listeners.size === 0) {
      channelHandles.get(mapKey)?.unsubscribe();
      channelHandles.delete(mapKey);
      channelListeners.delete(mapKey);
    }
  };
}

/* ------------------------------------------------------------------ */
/* Generic table hook                                                  */
/* ------------------------------------------------------------------ */

export interface TableResult<T extends BaseRow> {
  rows: T[];
  source: "mock" | "db";
  loading: boolean;
  error: string | null;
  insert: (row: Record<string, unknown>) => Promise<T | null>;
  upsert: (row: Record<string, unknown>) => Promise<boolean>;
  update: (id: RowId, patch: Record<string, unknown>) => Promise<boolean>;
  remove: (id: RowId) => Promise<boolean>;
}

export function useSupabaseTable<T extends BaseRow>(
  table: string,
  mockRows: T[],
  options: {
    eq?: { column: string; value: string | number };
    orderBy?: string;
    realtime?: boolean;
    pk?: string;
  } = {}
): TableResult<T> {
  const pk = options.pk ?? "id";
  const eqKey = options.eq ? `${options.eq.column}=${options.eq.value}` : "all";
  const realtime = options.realtime ?? true;

  const [rows, setRows] = useState<T[]>(mockRows);
  const [source, setSource] = useState<"mock" | "db">("mock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const revision = useDataRevision();

  const sourceRef = useRef(source);
  sourceRef.current = source;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const mockRef = useRef(mockRows);
  mockRef.current = mockRows;
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!hasLoadedRef.current) {
      setRows(mockRef.current);
      setSource("mock");
      setLoading(true);
    }
    setError(null);

    void (async () => {
      try {
        let query = supabase.from(table).select("*");
        if (options.eq) query = query.eq(options.eq.column, options.eq.value);
        if (options.orderBy) query = query.order(options.orderBy, { ascending: true });
        const { data, error } = await query;
        if (cancelled) return;
        if (error) throw error;
        setRows((data as T[]) ?? []);
        setSource("db");
        hasLoadedRef.current = true;
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Supabase unreachable");
        if (!hasLoadedRef.current) {
          setRows(mockRef.current); // offline fallback
          setSource("mock");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    let unsubscribe: (() => void) | undefined;
    if (realtime) {
      unsubscribe = subscribeToTable(table, eqKey, (payload) => {
        if (cancelled) return;
        if (options.eq && payload.eventType !== "DELETE") {
          const rowValue = String((payload.new as Record<string, unknown>)?.[options.eq.column] ?? "");
          if (rowValue !== String(options.eq.value)) return;
        }
        setRows((current) => {
          if (payload.eventType === "INSERT") return [...current, payload.new as unknown as T];
          if (payload.eventType === "UPDATE") {
            const incoming = payload.new as unknown as T;
            return current.map((row) => (String(row[pk]) === String(incoming[pk]) ? incoming : row));
          }
          if (payload.eventType === "DELETE") {
            const gone = payload.old as unknown as T;
            return current.filter((row) => String(row[pk]) !== String(gone[pk]));
          }
          return current;
        });
      });
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, eqKey, revision]);

  const insert = useCallback(
    async (row: Record<string, unknown>): Promise<T | null> => {
      if (sourceRef.current !== "db") {
        const temp = { ...row, id: row.id ?? `local-${Date.now()}` } as T;
        setRows((current) => [...current, temp]);
        toast.info("Saved locally — Supabase unreachable", { description: "The row will sync once the database connection is live." });
        return temp;
      }
      const tempId = `pending-${Date.now()}`;
      setRows((current) => [...current, { ...row, id: tempId } as T]);
      const { data, error } = await supabase.from(table).insert(row).select().maybeSingle();
      if (error) {
        setRows((current) => current.filter((r) => String(r[pk]) !== tempId));
        toast.error("Could not save to Supabase", { description: error.message });
        return null;
      }
      const saved = (data ?? null) as T | null;
      setRows((current) => current.map((r) => (String(r[pk]) === tempId ? ((saved ?? r) as T) : r)));
      return saved;
    },
    [table, pk]
  );

  const upsert = useCallback(
    async (row: Record<string, unknown>): Promise<boolean> => {
      const key = row[pk];
      setRows((current) => {
        const exists = current.some((r) => String(r[pk]) === String(key));
        if (exists) return current.map((r) => (String(r[pk]) === String(key) ? ({ ...r, ...row } as T) : r));
        return [...current, row as unknown as T];
      });
      if (sourceRef.current !== "db") {
        toast.info("Saved locally — Supabase unreachable");
        return true;
      }
      const { error } = await supabase.from(table).upsert(row, { onConflict: pk });
      if (error) {
        toast.error("Could not save to Supabase", { description: error.message });
        return false;
      }
      return true;
    },
    [table, pk]
  );

  const update = useCallback(
    async (id: RowId, patch: Record<string, unknown>): Promise<boolean> => {
      const previous = rowsRef.current;
      setRows((current) => current.map((row) => (String(row[pk]) === String(id) ? ({ ...row, ...patch } as T) : row)));
      if (sourceRef.current !== "db") {
        toast.info("Saved locally — Supabase unreachable");
        return true;
      }
      const { error } = await supabase.from(table).update(patch).eq(pk, id);
      if (error) {
        setRows(previous);
        toast.error("Could not update Supabase", { description: error.message });
        return false;
      }
      return true;
    },
    [table, pk]
  );

  const remove = useCallback(
    async (id: RowId): Promise<boolean> => {
      const previous = rowsRef.current;
      setRows((current) => current.filter((row) => String(row[pk]) !== String(id)));
      if (sourceRef.current !== "db") {
        toast.info("Removed locally — Supabase unreachable");
        return true;
      }
      const { error } = await supabase.from(table).delete().eq(pk, id);
      if (error) {
        setRows(previous);
        toast.error("Could not delete from Supabase", { description: error.message });
        return false;
      }
      return true;
    },
    [table, pk]
  );

  return { rows, source, loading, error, insert, upsert, update, remove };
}

/* ------------------------------------------------------------------ */
/* Domain hooks                                                        */
/*                                                                     */
/* These delegate to erp-views.ts, which composes the normalised       */
/* Supabase tables into the flat rows the components render. Do not     */
/* point these at a single table — the schemas do not line up.         */
/* ------------------------------------------------------------------ */

export { usePeopleView as usePeople, type PeopleRow } from "./erp-views";
export {
  useStudentsView as useStudents,
  useStaffView as useStaff,
  useAttendanceDailyView as useAttendanceDaily,
  useClassAttendanceView as useClassAttendance,
  useDashboardAttendance as useDashboardAttendance,
  useScheduleView as useSchedule,
  useHealthMetricsView as useHealthMetrics,
  useFinanceMonthlyView as useFinanceMonthly,
  useFeeCategoriesView as useFeeCategories,
  useInvoicesView as useInvoices,
  usePaymentsView as usePayments,
  useAnnouncementsView as useAnnouncements,
  useMessagesView as useMessages,
  useNotificationsView as useNotifications,
  useCurrentUser,
  type CurrentUser,
  useExamsView as useExams,
  useExamResultsView as useExamResults,
  useLibraryBooksView as useLibraryBooks,
  useSubjectsView as useSubjects,
  usePerformanceTrendView as usePerformanceTrend,
  useSubjectAveragesView as useSubjectAverages,
  useGradeOutcomesView as useGradeOutcomes,
  useReportExportsView as useReportExports,
  useActivityFeedView as useActivityFeed,
  useTimetableView as useTimetable,
  useStudentCountsView as useStudentCounts,
  clearErpCache,
} from "./erp-views";

/* ------------------------------------------------------------------ */
/* Settings helper                                                     */
/* ------------------------------------------------------------------ */

export interface Settings {
  schoolName: string;
  campus: string;
  address: string;
  phone: string;
  academicYear: string;
  currentTerm: string;
  gradeScale: string;
  threshold: string;
  prefs: { attendance: boolean; fees: boolean; messages: boolean; exams: boolean; digest: boolean };
}

export function useSettings() {
  const { rows, source, loading, upsert } = useSupabaseTable<SettingRow>("settings", mockSettings, { pk: "key", realtime: false });

  const get = (key: string) => rows.find((row) => row.key === key)?.value;
  const str = (key: string, fallback: string) => {
    const value = get(key);
    return typeof value === "string" ? value : fallback;
  };
  const bool = (key: string, fallback: boolean) => {
    const value = get(key);
    return typeof value === "boolean" ? value : fallback;
  };

  const settings: Settings = {
    schoolName: str("school_name", "Global Kids School"),
    campus: str("campus", "Tumakuru"),
    address: str("address", "2nd Cross, Tumakuru, Karnataka"),
    phone: str("phone", "+91 98765 43210"),
    academicYear: str("academic_year", "2026–27"),
    currentTerm: str("current_term", "Term 1"),
    gradeScale: str("grade_scale", "Percentage (0–100)"),
    threshold: str("attendance_threshold", "90%"),
    prefs: {
      attendance: bool("notif_attendance", true),
      fees: bool("notif_fees", true),
      messages: bool("notif_messages", true),
      exams: bool("notif_exams", false),
      digest: bool("notif_digest", true),
    },
  };

  const save = async (next: Settings): Promise<boolean> => {
    const entries: Array<[string, string | boolean]> = [
      ["school_name", next.schoolName],
      ["campus", next.campus],
      ["address", next.address],
      ["phone", next.phone],
      ["academic_year", next.academicYear],
      ["current_term", next.currentTerm],
      ["grade_scale", next.gradeScale],
      ["attendance_threshold", next.threshold],
      ["notif_attendance", next.prefs.attendance],
      ["notif_fees", next.prefs.fees],
      ["notif_messages", next.prefs.messages],
      ["notif_exams", next.prefs.exams],
      ["notif_digest", next.prefs.digest],
    ];
    let ok = true;
    for (const [key, value] of entries) {
      const result = await upsert({ key, value });
      if (!result) ok = false;
    }
    if (ok) notifyDataChanged();
    return ok;
  };

  return { settings, save, source, loading };
}

/* ------------------------------------------------------------------ */
/* Icon resolvers for DB-stored icon keys                              */
/* ------------------------------------------------------------------ */

export const activityIconMap: Record<string, LucideIcon> = {
  rupee: IndianRupee,
  clipboard: ClipboardCheck,
  calendar: CalendarDays,
  message: MessageSquare,
  book: BookOpen,
  library: Library,
  alert: AlertCircle,
  bus: Bus,
  file: FileText,
  clock: Clock3,
};

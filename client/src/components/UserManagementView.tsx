import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import { usePageScrollLock } from "@/components/SmoothScroll";
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { notifyDataChanged, useDataRevision } from "../lib/live-data";
import { useRealtimeInvalidation } from "../lib/use-realtime";
import {
  avatarTones,
  useCurrentUser,
  usePeople,
  useStudents,
  type PeopleRow,
  type Student,
} from "../lib/school-data";
import { Breadcrumb } from "./Breadcrumb";
import { SegmentedControl } from "./SegmentedControl";
import { Pager, usePagination } from "./ErpPagination";
import { SkeletonTableRows } from "./ErpSkeleton";
import { effectiveRole, isSuperAdminId } from "@shared/super-admin";

export interface PortalAccountRow {
  kind: "student" | "staff";
  recordId: string;
  name: string;
  detail: string;
  username: string;
  password: string;
  /**
   * True when the owner has chosen their own password.
   *
   * The server cannot send that password — Auth stores a hash and the old
   * plaintext mirror is gone — so the screen shows "Set by the owner" rather
   * than a value that would be a lie.
   */
  passwordSet?: boolean;
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

const ALL_GRADES = [
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
] as const;

const CLASSROOM_OPTIONS = [
  "none",
  "Grade 6-A", "Grade 6-B",
  "Grade 7-A", "Grade 7-B",
  "Grade 8-A", "Grade 8-B",
  "Grade 9-A", "Grade 9-B",
  "Grade 10-A", "Grade 10-B",
] as const;

const COMMON_SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "General Science",
  "English Literature & Grammar",
  "Social Studies & History",
  "Computer Science & ICT",
  "Hindi",
  "Kannada & Regional Languages",
  "Art & Design",
  "Physical Education & Sports",
  "Music & Performing Arts",
] as const;

const ADMIN_MODULES_LIST = [
  { id: "Admissions", label: "Admissions & Enrollment", desc: "Student onboarding and records" },
  { id: "Finance", label: "Fee Collection & Finance", desc: "Fee registers, invoices, and ledger" },
  { id: "Staff", label: "Staff & Faculty Directory", desc: "Employee records and onboarding" },
  { id: "Academics", label: "Academics & Timetables", desc: "Schedules, exams, and grading" },
  { id: "Analytics", label: "Analytics & Reports", desc: "School performance and KPIs" },
  { id: "Settings", label: "School Identity & Settings", desc: "Campus configuration and branding" },
] as const;

function parseGradeNumber(gradeStr?: string, detailStr?: string): number | null {
  const combined = `${gradeStr ?? ""} ${detailStr ?? ""}`;
  const match =
    combined.match(/(?:grade|class|g)[\s-]*(\d+)/i) ||
    combined.match(/\b(\d+)(?:st|nd|rd|th)?\b/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 12) return num;
  }
  return null;
}

export function UserManagementView({ onBack }: { onBack: () => void }) {
  const currentUser = useCurrentUser();
  const [activeTab, setActiveTab] = useState<"staff" | "students">("staff");

  const [me, setMe] = useState<{ id: string; role: string; orgId: string }>({
    id: "",
    role: "",
    orgId: "",
  });

  const superAdmin = isSuperAdminId(me.id);
  const myRole = effectiveRole(me.id, me.role);
  const isAdmin = superAdmin || myRole === "admin";

  const isSuperAdminUser =
    isSuperAdminId(currentUser?.id ?? me.id) ||
    currentUser?.username?.toLowerCase() === "kaizxark" ||
    currentUser?.email?.toLowerCase().includes("kaizxark");

  const isPrincipalUser =
    !isSuperAdminUser &&
    (currentUser?.role === "admin" ||
      currentUser?.role === "principal" ||
      currentUser?.username?.toLowerCase() === "principal" ||
      /meera/i.test(currentUser?.email ?? ""));

  const isAdministrativeStaffUser =
    !isSuperAdminUser &&
    !isPrincipalUser &&
    (currentUser?.role === "staff" || me.role === "staff");

  /* ---------------------------- Data ---------------------------- */

  const {
    rows: people,
    loading: peopleLoading,
    reload: reloadPeople,
  } = usePeople();
  const { rows: students } = useStudents();

  const [accounts, setAccounts] = useState<PortalAccountRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  // Staff Tab: Principal is the only Admin, others are Teacher or Administrative Staff
  const [staffQuery, setStaffQuery] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState<
    "all" | "teacher" | "staff" | "principal"
  >("all");

  // Student Tab: Strictly Students with School Division filters
  const [studentQuery, setStudentQuery] = useState("");
  const [studentFilter, setStudentFilter] = useState<
    "all" | "primary" | "middle" | "high"
  >("all");

  // Invite Modal State: Only Teacher & Administrative Staff (Principal is already appointed)
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"teacher" | "staff">("teacher");
  const [teacherSubject, setTeacherSubject] = useState<string>("Mathematics");
  const [assignedGrades, setAssignedGrades] = useState<string[]>(["Grade 9", "Grade 10"]);
  const [classTeacherOf, setClassTeacherOf] = useState<string>("none");
  const [adminModules, setAdminModules] = useState<string[]>([
    "Admissions",
    "Finance",
    "Staff",
    "Academics",
  ]);
  const [inviting, setInviting] = useState(false);

  // Issued Credentials Slip
  const [issuedSlip, setIssuedSlip] = useState<{
    name: string;
    email: string;
    role: string;
    department: string;
    designation: string;
    username: string;
    password: string;
  } | null>(null);

  // Edit Role & Scope Modal State
  const [editingPerson, setEditingPerson] = useState<PeopleRow | null>(null);

  usePageScrollLock(inviteModalOpen || Boolean(editingPerson));
  const [editRole, setEditRole] = useState<"teacher" | "staff" | "admin">("teacher");
  const [editSubject, setEditSubject] = useState("Mathematics");
  const [editGrades, setEditGrades] = useState<string[]>([]);
  const [editClassTeacher, setEditClassTeacher] = useState<string>("none");
  const [editModules, setEditModules] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);
  const dataRevision = useDataRevision();
  // The accounts screen reads the person lists plus the roster rows behind
  // them; a change from an invite acceptance or a backfill elsewhere lands here.
  const realtimeRevision = useRealtimeInvalidation([
    "profiles",
    "staff",
    "students",
    "student_credentials",
    "staff_credentials",
  ]);

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id,role,organisation_id")
        .eq("id", session.user.id)
        .maybeSingle();
      setMe({
        id: String(data?.id ?? session.user.id),
        role: String(data?.role ?? "admin"),
        orgId: String(data?.organisation_id ?? ""),
      });
    })();
  }, [dataRevision, realtimeRevision]);

  const hasLoadedAccountsRef = useRef(false);

  const loadAccounts = useCallback(async () => {
    if (!hasLoadedAccountsRef.current) {
      setAccountsLoading(true);
    }
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/portal-admin?action=all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        accounts?: PortalAccountRow[];
        summary?: Summary;
        message?: string;
      };
      if (res.ok) {
        setAccounts(json.accounts ?? []);
        setSummary(json.summary ?? null);
        hasLoadedAccountsRef.current = true;
      }
    } catch {
      // Quiet fail if not admin or server offline
    } finally {
      setAccountsLoading(false);
    }
  }, [dataRevision, realtimeRevision]);

  // Load accounts immediately on mount so credentials are ready
  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

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
        toast.error(json.message ?? "The account sync could not run.");
        return;
      }
      const placeholders =
        (json.placeholdersIssued?.students ?? 0) +
        (json.placeholdersIssued?.staff ?? 0);
      const made =
        (json.accountsProvisioned?.students ?? 0) +
        (json.accountsProvisioned?.staff ?? 0);
      toast.success("Account sync complete", {
        description: `${placeholders} addresses verified, ${made} accounts provisioned.`,
      });
      await loadAccounts();
      void reloadPeople();
      notifyDataChanged();
    } catch {
      toast.error("Cannot reach the server.");
    } finally {
      setBackfilling(false);
    }
  };

  /* ---------------------------- Data Mappings ---------------------------- */

  // Staff accounts map for instant lookup by email / username / recordId
  const staffAccountsMap = useMemo(() => {
    const map = new Map<string, PortalAccountRow>();
    for (const acc of accounts) {
      if (acc.kind === "staff") {
        if (isSuperAdminId(acc.recordId)) continue;
        if (acc.email) map.set(acc.email.toLowerCase().trim(), acc);
        if (acc.username) map.set(acc.username.toLowerCase().trim(), acc);
        if (acc.recordId) map.set(acc.recordId, acc);
      }
    }
    return map;
  }, [accounts]);

  // Student accounts strictly (no staff!)
  const studentAccounts = useMemo(() => {
    return accounts.filter(acc => acc.kind === "student");
  }, [accounts]);

  // Students map for grade and section lookup
  const studentsMap = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of students) {
      if (s.id) map.set(String(s.id), s);
      if (s.usn) map.set(s.usn.toLowerCase().trim(), s);
    }
    return map;
  }, [students]);

  // Staff list filtered according to role visibility permissions:
  // - Principal can view all administrative staff & teachers, but NOT himself/herself
  // - Administrative staff can view ONLY teachers and students (not other admin staff, not principal, not himself/herself)
  // - Super admin can view all staff (Principal, Admin staff, Teachers), and super admin is excluded
  const visibleStaff = useMemo(() => {
    const currentId = currentUser?.id ?? me.id;
    const currentEmail = (currentUser?.email ?? "").toLowerCase().trim();
    const currentUsername = (currentUser?.username ?? "").toLowerCase().trim();

    return people.filter(p => {
      // 1. Super admin is never shown in directory
      if (
        isSuperAdminId(p.id) ||
        p.role === "super_admin" ||
        p.username?.toLowerCase() === "kaizxark" ||
        p.email?.toLowerCase().includes("kaizxark")
      ) {
        return false;
      }

      // 2. Hide logged-in user from seeing their own row in the directory
      const isSelf =
        (Boolean(currentId) && p.id === currentId) ||
        (Boolean(currentEmail) && p.email?.toLowerCase().trim() === currentEmail) ||
        (Boolean(currentUsername) && p.username?.toLowerCase().trim() === currentUsername);
      if (isSelf) {
        return false;
      }

      const isPrincipal =
        (/principal/i.test(p.designation ?? "") && !/vice/i.test(p.designation ?? "")) ||
        p.role === "admin";
      const isAdmStaff = p.role === "staff" || p.access === "Administrative Staff";

      // 3. Administrative staff can view ONLY teachers and students (not other administrative staff, not principal, not self):
      if (isAdministrativeStaffUser) {
        if (isPrincipal || isAdmStaff) {
          return false;
        }
      }

      return true;
    });
  }, [people, currentUser, me.id, isAdministrativeStaffUser]);
  const nonSuperAdminStaff = visibleStaff;

  /* ---------------------------- Copy Slips ---------------------------- */

  const copyStudentSlip = (row: PortalAccountRow) => {
    const matched =
      studentsMap.get(row.recordId) ||
      studentsMap.get(row.detail.toLowerCase()) ||
      studentsMap.get(row.username.toLowerCase());
    const gradeDisplay = matched
      ? `${matched.grade}${matched.section ? ` - ${matched.section}` : ""}`
      : row.detail || "Student";

    const slip = [
      `======================================`,
      `GLOBAL KIDS SCHOOL · STUDENT PORTAL ACCESS SLIP`,
      `======================================`,
      `Student Name: ${row.name}`,
      `Grade & Class: ${gradeDisplay}`,
      `Username (USN): ${row.username}`,
      `Initial Password: ${
        row.passwordSet
          ? "already changed by the student"
          : row.password || "not issued"
      }`,
      `Portal Login URL: https://ggs-erp.vercel.app/login`,
      `======================================`,
      `Use your USN and password to sign in. Please change your password after initial sign-in.`,
    ].join("\n");
    void navigator.clipboard.writeText(slip);
    toast.success(`Student access slip copied for ${row.name}`);
  };

  const copyStaffSlip = (person: PeopleRow, staffAcc?: PortalAccountRow) => {
    const username = staffAcc?.username || person.username;
    const password = staffAcc?.password || "";
    const isPrincipal =
      (/principal/i.test(person.designation ?? "") && !/vice/i.test(person.designation ?? "")) ||
      person.role === "admin";
    const roleLabel = isPrincipal
      ? "PRINCIPAL (ADMIN)"
      : person.role === "staff" || person.access === "Administrative Staff"
      ? "ADMINISTRATIVE STAFF"
      : "TEACHER";
    const scope =
      person.designation ||
      staffAcc?.detail ||
      (isPrincipal
        ? "Principal · Overall School Administration"
        : person.role === "staff"
        ? "Administrative Staff · Operations & Records"
        : "Teacher · Classroom Teaching & Academics");

    const slip = [
      `======================================`,
      `GLOBAL KIDS SCHOOL · STAFF LOGIN CREDENTIALS`,
      `======================================`,
      `Staff Member: ${person.name}`,
      `Staff Role: ${roleLabel}`,
      `Department: ${person.department || (isPrincipal ? "School Leadership" : person.role === "staff" ? "Administration" : "Academics")}`,
      `Assigned Scope: ${scope}`,
      `Portal Login URL: https://ggs-erp.vercel.app/login`,
      `Username / USN: ${username}`,
      `Password: ${
        staffAcc?.passwordSet
          ? "already set by the staff member"
          : password || "not issued"
      }`,
      `======================================`,
      `Sign in with your username or email at the portal to access your dashboard.`,
    ].join("\n");
    void navigator.clipboard.writeText(slip);
    toast.success(`Staff login slip copied for ${person.name}`);
  };

  /* ---------------------------- Submissions ---------------------------- */

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) {
      toast.error("Please enter both a full name and a valid email address.");
      return;
    }
    setInviting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      let computedDesignation = "";
      if (inviteRole === "teacher") {
        const parts: string[] = [];
        parts.push(teacherSubject ? `${teacherSubject} Teacher` : "Teacher");
        if (assignedGrades.length > 0) {
          parts.push(`Grades ${assignedGrades.map(g => g.replace(/^Grade\s*/i, "")).join(", ")}`);
        }
        if (classTeacherOf && classTeacherOf !== "none") {
          parts.push(`Class Teacher ${classTeacherOf.replace(/^Grade\s*/i, "")}`);
        }
        computedDesignation = parts.join(" · ");
      } else {
        computedDesignation =
          adminModules.length > 0
            ? `Administrative Staff · ${adminModules.join(", ")}`
            : "Administrative Staff · Operations & Records";
      }

      const res = await fetch("/api/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          action: "invite",
          email: inviteEmail.trim(),
          fullName: inviteName.trim(),
          role: inviteRole,
          department: inviteRole === "teacher" ? "Academics" : "Administration",
          designation: computedDesignation,
          subject: inviteRole === "teacher" ? teacherSubject : undefined,
          assignedClasses: inviteRole === "teacher" ? assignedGrades : undefined,
          classTeacherOf: inviteRole === "teacher" ? classTeacherOf : undefined,
          adminModules: inviteRole === "staff" ? adminModules : undefined,
          organisationId: me.orgId,
        }),
      });

      const result = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(result.message ?? "Invitation failed"));

      setIssuedSlip({
        name: inviteName.trim(),
        email: String(result.email ?? inviteEmail.trim()),
        role: inviteRole === "staff" ? "Administrative Staff" : "Teacher",
        department: inviteRole === "teacher" ? "Academics" : "Administration",
        designation: computedDesignation,
        username: String(result.username ?? inviteEmail.split("@")[0]),
        password: String(result.password ?? ""),
      });

      setInviteEmail("");
      setInviteName("");
      void reloadPeople();
      void loadAccounts();
      notifyDataChanged();
      toast.success("Staff account provisioned with login credentials!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create staff account");
    } finally {
      setInviting(false);
    }
  };

  const openEditModal = (person: PeopleRow) => {
    setEditingPerson(person);
    const isPrincipal =
      (/principal/i.test(person.designation ?? "") && !/vice/i.test(person.designation ?? "")) ||
      person.role === "admin";
    const isAdmStaff = person.role === "staff" || person.access === "Administrative Staff";
    setEditRole(isPrincipal ? "admin" : isAdmStaff ? "staff" : "teacher");
    const des = person.designation || "";
    if (!isPrincipal && !isAdmStaff) {
      const subjMatch = COMMON_SUBJECTS.find(s => des.includes(s));
      setEditSubject(subjMatch || "Mathematics");
      const gradesFound = ALL_GRADES.filter(g =>
        des.includes(g.replace("Grade ", "")) || des.includes(g)
      );
      setEditGrades(gradesFound.length > 0 ? gradesFound : ["Grade 9", "Grade 10"]);
      const ctMatch = CLASSROOM_OPTIONS.find(c => c !== "none" && des.includes(c));
      setEditClassTeacher(ctMatch || "none");
    } else {
      const mods = ADMIN_MODULES_LIST.filter(m => des.includes(m.id)).map(m => m.id);
      setEditModules(mods.length > 0 ? mods : ["Admissions", "Finance", "Staff", "Academics"]);
    }
  };

  const saveRoleChange = async () => {
    if (!editingPerson) return;
    setSavingRole(true);
    try {
      const isPrincipal =
        (/principal/i.test(editingPerson.designation ?? "") &&
          !/vice/i.test(editingPerson.designation ?? "")) ||
        editingPerson.role === "admin";

      const targetRole = isPrincipal ? "admin" : editRole === "teacher" ? "teacher" : "staff";

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role: targetRole })
        .eq("id", editingPerson.id);
      if (profileError) throw profileError;

      let newDes = "";
      if (editRole === "teacher") {
        const parts: string[] = [];
        parts.push(editSubject ? `${editSubject} Teacher` : "Teacher");
        if (editGrades.length > 0) {
          parts.push(`Grades ${editGrades.map(g => g.replace(/^Grade\s*/i, "")).join(", ")}`);
        }
        if (editClassTeacher && editClassTeacher !== "none") {
          parts.push(`Class Teacher ${editClassTeacher.replace(/^Grade\s*/i, "")}`);
        }
        newDes = parts.join(" · ");
      } else if (isPrincipal) {
        newDes = editingPerson.designation || "Principal";
      } else {
        newDes =
          editModules.length > 0
            ? `Administrative Staff · ${editModules.join(", ")}`
            : "Administrative Staff · Operations & Records";
      }

      await supabase
        .from("staff")
        .update({
          designation: newDes,
          department: isPrincipal
            ? "School Leadership"
            : editRole === "teacher"
            ? "Academics"
            : "Administration",
        })
        .eq("email", editingPerson.email);

      toast.success(`Updated role & permissions for ${editingPerson.name}`);
      setEditingPerson(null);
      void reloadPeople();
      void loadAccounts();
      notifyDataChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update permissions");
    } finally {
      setSavingRole(false);
    }
  };

  /* ---------------------------- Filtered Views ---------------------------- */

  // Staff Table Filter: Principal (Admin), Administrative Staff, Teachers
  const filteredStaff = useMemo(() => {
    const q = staffQuery.trim().toLowerCase();
    return nonSuperAdminStaff.filter(p => {
      const isPrincipal =
        (/principal/i.test(p.designation ?? "") && !/vice/i.test(p.designation ?? "")) ||
        p.role === "admin";
      const isAdmStaff = p.role === "staff" || p.access === "Administrative Staff";
      const isTeacher = p.role === "teacher" || (!isPrincipal && !isAdmStaff);

      if (staffRoleFilter === "principal" && !isPrincipal) return false;
      if (staffRoleFilter === "staff" && !isAdmStaff) return false;
      if (staffRoleFilter === "teacher" && !isTeacher) return false;
      if (!q) return true;

      const staffAcc =
        staffAccountsMap.get(p.id) ||
        staffAccountsMap.get(p.email.toLowerCase()) ||
        staffAccountsMap.get(p.username.toLowerCase());

      return (
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        (p.designation ?? "").toLowerCase().includes(q) ||
        (staffAcc?.detail ?? "").toLowerCase().includes(q)
      );
    });
  }, [nonSuperAdminStaff, staffQuery, staffRoleFilter, staffAccountsMap]);

  const staffPager = usePagination(filteredStaff, 10);

  // Student Table Filter: Strictly students with division tabs
  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return studentAccounts.filter(row => {
      const studentMatch =
        studentsMap.get(row.recordId) ||
        studentsMap.get(row.detail.toLowerCase()) ||
        studentsMap.get(row.username.toLowerCase());

      const gradeNum = parseGradeNumber(studentMatch?.grade, row.detail);

      if (studentFilter === "primary") {
        if (gradeNum === null || gradeNum < 1 || gradeNum > 5) return false;
      } else if (studentFilter === "middle") {
        if (gradeNum === null || gradeNum < 6 || gradeNum > 8) return false;
      } else if (studentFilter === "high") {
        if (gradeNum === null || gradeNum < 9 || gradeNum > 12) return false;
      }

      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.username.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.detail.toLowerCase().includes(q) ||
        (studentMatch?.grade ?? "").toLowerCase().includes(q)
      );
    });
  }, [studentAccounts, studentQuery, studentFilter, studentsMap]);

  const studentPager = usePagination(filteredStudents, 10);

  const principalCount = visibleStaff.filter(
    p =>
      (/principal/i.test(p.designation ?? "") && !/vice/i.test(p.designation ?? "")) ||
      p.role === "admin"
  ).length;
  const adminStaffCount = visibleStaff.filter(
    p =>
      !(
        (/principal/i.test(p.designation ?? "") && !/vice/i.test(p.designation ?? "")) ||
        p.role === "admin"
      ) && (p.role === "staff" || p.access === "Administrative Staff")
  ).length;
  const teacherCount = visibleStaff.filter(
    p =>
      p.role === "teacher" ||
      (!((/principal/i.test(p.designation ?? "") && !/vice/i.test(p.designation ?? "")) || p.role === "admin") &&
        !(p.role === "staff" || p.access === "Administrative Staff"))
  ).length;

  const availableStaffTabs = useMemo(() => {
    if (isAdministrativeStaffUser) {
      return [{ key: "teacher" as const, label: `Teachers (${teacherCount})` }];
    }
    const tabs: Array<{ key: "all" | "teacher" | "staff" | "principal"; label: string }> = [
      { key: "all", label: `All (${visibleStaff.length})` },
      { key: "teacher", label: `Teachers (${teacherCount})` },
      { key: "staff", label: `Admin Staff (${adminStaffCount})` },
    ];
    if (principalCount > 0) {
      tabs.push({ key: "principal", label: `Principal (${principalCount})` });
    }
    return tabs;
  }, [isAdministrativeStaffUser, visibleStaff.length, teacherCount, adminStaffCount, principalCount]);

  useEffect(() => {
    if (isAdministrativeStaffUser && staffRoleFilter !== "teacher") {
      setStaffRoleFilter("teacher");
    } else if (staffRoleFilter === "principal" && principalCount === 0) {
      setStaffRoleFilter("all");
    }
  }, [isAdministrativeStaffUser, principalCount, staffRoleFilter]);

  return (
    <div className="page-stack pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <Breadcrumb
            parent="Global Kids School"
            current="User & Access Management"
            onParentClick={onBack}
          />
          <h1 className="page-title">User & Access Management</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {superAdmin && (
            <button
              className="secondary-button h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm"
              disabled={backfilling}
              onClick={() => void runBackfill()}
              title="Verify and generate credentials for any missing accounts"
            >
              <RefreshCw size={14} className={backfilling ? "animate-spin" : ""} />
              <span>{backfilling ? "Syncing…" : "Sync USN Logins"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Metric Cards - Compact & Responsive */}
      <div
        className={`grid grid-cols-2 ${
          principalCount > 0
            ? "lg:grid-cols-4"
            : !isAdministrativeStaffUser
            ? "lg:grid-cols-3"
            : "lg:grid-cols-2"
        } gap-3 sm:gap-4`}
      >
        {/* Metric 1: Principal (Admin) */}
        {principalCount > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 sm:p-5 shadow-sm hover:border-[var(--border-strong)] transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Principal
              </span>
              <span className="p-2 rounded-lg bg-[var(--violet-soft)] text-[var(--violet)]">
                <Shield size={16} />
              </span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                {principalCount}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug truncate">
                Dr. Meera Iyer · Authority
              </p>
            </div>
          </div>
        )}

        {/* Metric 2: Administrative Staff */}
        {!isAdministrativeStaffUser && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 sm:p-5 shadow-sm hover:border-[var(--border-strong)] transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Admin Staff
              </span>
              <span className="p-2 rounded-lg bg-[var(--info-soft)] text-[var(--info)]">
                <Building2 size={16} />
              </span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                {adminStaffCount}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug truncate">
                Operations & coordination
              </p>
            </div>
          </div>
        )}

        {/* Metric 3: Teachers */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 sm:p-5 shadow-sm hover:border-[var(--border-strong)] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Faculty
            </span>
            <span className="p-2 rounded-lg bg-[var(--info-soft)] text-[var(--info)]">
              <BookOpen size={16} />
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {teacherCount}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug truncate">
              Educators across cohorts
            </p>
          </div>
        </div>

        {/* Metric 4: Students */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 sm:p-5 shadow-sm hover:border-[var(--border-strong)] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Student Portals
            </span>
            <span className="p-2 rounded-lg bg-[var(--success-soft)] text-[var(--success)]">
              <GraduationCap size={16} />
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {summary?.pupils ?? studentAccounts.length ?? students.length}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug truncate">
              Active pupil logins
            </p>
          </div>
        </div>
      </div>

      {/* Tab Switcher - Spacious Sliding Pill Toggle */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4 overflow-x-auto no-scrollbar">
        <SegmentedControl
          ariaLabel="User management category tabs"
          layoutId="userMgmtMainTabs"
          value={activeTab}
          onChange={(val) => setActiveTab(val as "staff" | "students")}
          indicatorVariant="brand"
          options={[
            {
              value: "staff",
              label: "Staff & Faculty Accounts",
              count: nonSuperAdminStaff.length,
              icon: <Users size={16} />,
            },
            {
              value: "students",
              label: "Student Portal Logins",
              count: studentAccounts.length || students.length,
              icon: <GraduationCap size={16} />,
            },
          ]}
        />
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: Staff & Faculty Accounts                                      */}
      {/* ==================================================================== */}
      {activeTab === "staff" && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm overflow-hidden">
          {/* Header Title Bar */}
          <div className="p-4 sm:p-5 border-b border-[var(--border)] bg-[var(--bg-raised)]/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <p className="eyebrow text-xs font-bold text-[var(--brand)] uppercase tracking-wider">
                Faculty Registry
              </p>
              <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                Staff Logins & Role Permissions
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {nonSuperAdminStaff.length} members with portal usernames, credentials, and role assignments.
              </p>
            </div>
          </div>

          {/* Controls Toolbar in a Single Clean Straight Line */}
          <div className="px-6 sm:px-7 py-3.5 border-b border-[var(--border)] bg-[var(--bg-panel)] flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Search */}
              <div className="search-field h-10 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] flex items-center gap-2.5 w-60 sm:w-72">
                <Search size={15} className="text-[var(--text-muted)] flex-shrink-0" />
                <input
                  value={staffQuery}
                  onChange={e => setStaffQuery(e.target.value)}
                  placeholder="Search staff, username, class…"
                  className="bg-transparent border-0 outline-none text-xs text-[var(--text-primary)] w-full placeholder:text-[var(--text-muted)]"
                />
              </div>

              {/* Roles: Dynamic tabs with Smooth Horizontal Sliding Indicator */}
              <SegmentedControl
                ariaLabel="Filter staff by role"
                layoutId="userMgmtStaffRoles"
                value={staffRoleFilter}
                onChange={(val) => setStaffRoleFilter(val as typeof staffRoleFilter)}
                options={availableStaffTabs.map(t => ({
                  value: t.key,
                  label: t.label,
                }))}
              />
            </div>

            {/* Show / Hide Passwords */}
            <div className="flex items-center flex-shrink-0">
              <button
                className={`secondary-button h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                  revealed
                    ? "border-[var(--warning-border)] text-[var(--warning)] bg-[var(--warning-soft)] shadow-sm"
                    : ""
                }`}
                onClick={() => setRevealed(!revealed)}
                title="Toggle password masking for all staff accounts"
              >
                {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
                <span>{revealed ? "Hide Passwords" : "Show Passwords"}</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="table-scroll">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th style={{ minWidth: 260 }} className="py-4 px-6 text-left">
                    Staff Member
                  </th>
                  <th style={{ minWidth: 150 }} className="py-4 px-6 text-left">
                    Role
                  </th>
                  <th style={{ minWidth: 260 }} className="py-4 px-6 text-left">
                    Assigned Scope & Classes
                  </th>
                  <th style={{ minWidth: 170 }} className="py-4 px-6 text-left">
                    Username (Login ID)
                  </th>
                  <th style={{ minWidth: 170 }} className="py-4 px-6 text-left">
                    Portal Password
                  </th>
                  <th style={{ minWidth: 110 }} className="py-4 px-6 text-left">
                    Status
                  </th>
                  <th style={{ minWidth: 130 }} className="py-4 px-6 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {peopleLoading ? (
                  <SkeletonTableRows rows={6} columns={7} />
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="empty-state max-w-sm mx-auto space-y-2">
                        <Users size={32} className="mx-auto text-[var(--text-muted)]" />
                        <p className="text-sm font-bold text-[var(--text-primary)]">
                          {visibleStaff.length === 0
                            ? "No staff accounts yet"
                            : "No staff members found"}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {visibleStaff.length === 0
                            ? "Add a staff member first; their portal login appears here."
                            : "Try adjusting your search query or role filter."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  staffPager.pageRows.map(person => {
                    const isPrincipal =
                      (/principal/i.test(person.designation ?? "") &&
                        !/vice/i.test(person.designation ?? "")) ||
                      person.role === "admin";
                    const isAdmStaff = person.role === "staff" || person.access === "Administrative Staff";
                    const staffAcc =
                      staffAccountsMap.get(person.id) ||
                      staffAccountsMap.get(person.email.toLowerCase()) ||
                      staffAccountsMap.get(person.username.toLowerCase());

                    const username = staffAcc?.username || person.username;
                    // Never invent a password. If the owner has set one, the
                    // server knows that but not the secret, so the cell says so.
                    const passwordSet = Boolean(staffAcc?.passwordSet);
                    const password = staffAcc?.password || "";
                    const hasPassword = Boolean(password);

                    const scopeText =
                      person.designation ||
                      staffAcc?.detail ||
                      (isPrincipal
                        ? "Principal · School Head & Overall Administration"
                        : isAdmStaff
                        ? "Administrative Staff · Operations & Records"
                        : "Teacher · Classroom Academics");

                    return (
                      <tr
                        key={person.id}
                        className="hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        {/* Member */}
                        <td className="py-4.5 px-6">
                          <div className="flex items-center gap-3.5">
                            <span
                              className={`avatar avatar-sm ${avatarTones[person.tone]} h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0`}
                            >
                              {person.initials}
                            </span>
                            <div className="min-w-0 space-y-0.5">
                              <span className="font-bold text-sm text-[var(--text-primary)] block truncate">
                                {person.name}
                              </span>
                              <span className="text-xs text-[var(--text-muted)] font-mono block truncate">
                                {person.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role: Principal (Admin), Administrative Staff, or Teacher */}
                        <td className="py-4.5 px-6">
                          {isPrincipal ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-[var(--violet-soft)] text-[var(--violet)] border-[var(--violet-border)]">
                              <Shield size={13} className="text-[var(--violet)]" />
                              <span>Principal (Admin)</span>
                            </span>
                          ) : isAdmStaff ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-[var(--info-soft)] text-[var(--info)] border-[var(--info-border)]">
                              <Building2 size={13} className="text-[var(--info)]" />
                              <span>Administrative Staff</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-[var(--info-soft)] text-[var(--info)] border-[var(--info-border)]">
                              <BookOpen size={13} className="text-[var(--info)]" />
                              <span>Teacher</span>
                            </span>
                          )}
                        </td>

                        {/* Assigned Scope & Classes */}
                        <td className="py-4.5 px-6">
                          <div className="max-w-[280px] space-y-1">
                            <span
                              className="text-xs font-semibold text-[var(--text-secondary)] block truncate"
                              title={scopeText}
                            >
                              {scopeText}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] block truncate">
                              Dept: {person.department || (isPrincipal ? "School Leadership" : isAdmStaff ? "Administration" : "Academics")}
                            </span>
                          </div>
                        </td>

                        {/* Username */}
                        <td className="py-4.5 px-6">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono font-bold text-[var(--brand)] bg-[var(--bg-card)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
                              {username}
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(username);
                                toast.success("Username copied to clipboard");
                              }}
                              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                              title="Copy username"
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                        </td>

                        {/* Password */}
                        <td className="py-4.5 px-6">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono font-medium text-[var(--success)] bg-[var(--bg-card)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
                              {passwordSet
                                ? "Set by owner"
                                : hasPassword
                                  ? revealed
                                    ? password
                                    : "••••••••"
                                  : "—"}
                            </code>
                            {hasPassword && !passwordSet && (
                              <button
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard.writeText(password);
                                  toast.success("Password copied");
                                }}
                                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                                title="Copy password"
                              >
                                <Copy size={13} />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4.5 px-6">
                          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--success)] font-semibold">
                            <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                            Active
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4.5 px-6 text-right">
                          <div className="flex items-center justify-end">
                            <button
                              className="secondary-button compact h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                              onClick={() => openEditModal(person)}
                              title="Assign classes or administrative modules"
                            >
                              <UserCog size={12} />
                              <span>Edit Scope</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pager pagination={staffPager} noun="staff members" />
        </section>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: Student Portal Logins (STRICTLY STUDENTS!)                    */}
      {/* ==================================================================== */}
      {activeTab === "students" && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm overflow-hidden">
          {/* Header Title Bar */}
          <div className="p-4 sm:p-5 border-b border-[var(--border)] bg-[var(--bg-raised)]/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <p className="eyebrow text-xs font-bold text-[var(--brand)] uppercase tracking-wider">
                Student Portals
              </p>
              <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                Student Portal Credentials
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Pupil USN sign-in handles, secure passwords, and portal login credentials.
              </p>
            </div>
          </div>

          {/* Controls Toolbar in a Single Clean Straight Line */}
          <div className="px-6 sm:px-7 py-3.5 border-b border-[var(--border)] bg-[var(--bg-panel)] flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Search */}
              <div className="search-field h-10 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] flex items-center gap-2.5 w-60 sm:w-72">
                <Search size={15} className="text-[var(--text-muted)] flex-shrink-0" />
                <input
                  value={studentQuery}
                  onChange={e => setStudentQuery(e.target.value)}
                  placeholder="Search student, USN, grade…"
                  className="bg-transparent border-0 outline-none text-xs text-[var(--text-primary)] w-full placeholder:text-[var(--text-muted)]"
                />
              </div>

              {/* Intuitive School Division Filters with Smooth Horizontal Sliding Indicator */}
              <SegmentedControl
                ariaLabel="Filter students by division"
                layoutId="userMgmtStudentDivisions"
                value={studentFilter}
                onChange={(val) => setStudentFilter(val as "all" | "primary" | "middle" | "high")}
                options={[
                  { value: "all", label: "All Students (G6–10)" },
                  { value: "middle", label: "Middle School (G6–8)" },
                  { value: "high", label: "High School (G9–10)" },
                ]}
              />
            </div>

            {/* Toggle Password Masking */}
            <div className="flex items-center flex-shrink-0">
              <button
                className={`secondary-button h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                  revealed
                    ? "border-[var(--warning-border)] text-[var(--warning)] bg-[var(--warning-soft)] shadow-sm"
                    : ""
                }`}
                onClick={() => setRevealed(!revealed)}
                title="Toggle password masking"
              >
                {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
                <span>{revealed ? "Hide Passwords" : "Show Passwords"}</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="table-scroll">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th style={{ minWidth: 260 }} className="py-4 px-6 text-left">
                    Student
                  </th>
                  <th style={{ minWidth: 160 }} className="py-4 px-6 text-left">
                    Grade & Section
                  </th>
                  <th style={{ minWidth: 170 }} className="py-4 px-6 text-left">
                    Username (USN)
                  </th>
                  <th style={{ minWidth: 180 }} className="py-4 px-6 text-left">
                    Portal Password
                  </th>
                  <th style={{ minWidth: 130 }} className="py-4 px-6 text-left">
                    Issued Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {accountsLoading ? (
                  <SkeletonTableRows rows={6} columns={5} />
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="empty-state max-w-sm mx-auto space-y-2">
                        <GraduationCap size={32} className="mx-auto text-[var(--text-muted)]" />
                        <p className="text-sm font-bold text-[var(--text-primary)]">
                          No student logins match that filter
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          Try switching to "All Students" or clicking "Sync USN Logins" above.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  studentPager.pageRows.map(row => {
                    const studentMatch =
                      studentsMap.get(row.recordId) ||
                      studentsMap.get(row.detail.toLowerCase()) ||
                      studentsMap.get(row.username.toLowerCase());

                    const gradeDisplay = studentMatch
                      ? `${studentMatch.grade}${studentMatch.section ? ` - ${studentMatch.section}` : ""}`
                      : row.detail || "Student";

                    return (
                      <tr
                        key={`student-${row.recordId}`}
                        className="hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        <td className="py-4.5 px-6">
                          <div className="space-y-0.5">
                            <span className="font-bold text-sm text-[var(--text-primary)] block">
                              {row.name}
                            </span>
                            <span className="text-xs text-[var(--text-muted)] font-mono block">
                              {row.email}
                            </span>
                          </div>
                        </td>

                        <td className="py-4.5 px-6">
                          <span className="grade-chip px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-secondary)]">
                            {gradeDisplay}
                          </span>
                        </td>

                        <td className="py-4.5 px-6">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono font-bold text-[var(--brand)] bg-[var(--bg-card)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
                              {row.username || "—"}
                            </code>
                            {row.username && (
                              <button
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard.writeText(row.username);
                                  toast.success("USN copied to clipboard");
                                }}
                                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                                title="Copy USN"
                              >
                                <Copy size={13} />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-4.5 px-6">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono font-medium text-[var(--success)] bg-[var(--bg-card)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
                              {row.passwordSet
                                ? "Set by owner"
                                : row.password
                                  ? revealed
                                    ? row.password
                                    : "••••••••"
                                  : "—"}
                            </code>
                            {revealed && row.password && !row.passwordSet && (
                              <button
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard.writeText(row.password);
                                  toast.success("Password copied");
                                }}
                                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                                title="Copy password"
                              >
                                <Copy size={13} />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-4.5 px-6 text-xs text-[var(--text-muted)]">
                          {row.issuedAt
                            ? new Date(row.issuedAt).toLocaleDateString()
                            : "Active"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pager pagination={studentPager} noun="student logins" />
        </section>
      )}

      {/* MODAL 2: Edit Staff Role & Scope (TEACHER or ADMINISTRATOR ONLY)     */}
      {/* ==================================================================== */}
      {editingPerson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-xl bg-[var(--bg-panel)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-7 py-6 border-b border-[var(--border)] bg-[var(--bg-raised)]/60 flex-shrink-0">
              <div className="space-y-0.5">
                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
                  <UserCog size={20} className="text-[var(--brand)]" />
                  Edit Staff Role & Scope
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Updating role and assignments for {editingPerson.name} ({editingPerson.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPerson(null)}
                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-7 space-y-6 overflow-y-auto flex-1">
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Select Staff Role
                </label>
                {/principal/i.test(editingPerson.designation ?? "") &&
                !/vice/i.test(editingPerson.designation ?? "") ? (
                  <div className="p-4 rounded-2xl bg-[var(--violet-soft)] border border-[var(--violet-border)] flex items-center gap-3">
                    <Shield size={20} className="text-[var(--violet)] flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        School Principal (Admin)
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Dr. Meera Iyer holds the primary school leadership and overall administrative authority.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3.5">
                    {[
                      { id: "teacher", label: "Teacher", icon: BookOpen },
                      { id: "staff", label: "Administrative Staff", icon: Building2 },
                    ].map(r => {
                      const Icon = r.icon;
                      return (
                        <label
                          key={r.id}
                          className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer text-xs font-bold transition-all ${
                            editRole === r.id
                              ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--text-primary)] shadow-sm"
                              : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="editRole"
                            value={r.id}
                            checked={editRole === r.id}
                            onChange={() => setEditRole(r.id as "teacher" | "staff")}
                          />
                          <Icon size={16} className="text-[var(--brand)]" />
                          <span>{r.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Dynamic Edit: Teacher Scope */}
              {editRole === "teacher" && (
                <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-raised)]/50 space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                      Subject
                    </label>
                    <select
                      value={editSubject}
                      onChange={e => setEditSubject(e.target.value)}
                      className="w-full h-11 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 text-xs text-[var(--text-primary)] font-medium"
                    >
                      {COMMON_SUBJECTS.map(s => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                        Assigned Grades
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditGrades([...ALL_GRADES])}
                        className="text-xs text-[var(--brand)] hover:underline cursor-pointer font-medium"
                      >
                        Select All
                      </button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {ALL_GRADES.map(grade => {
                        const sel = editGrades.includes(grade);
                        return (
                          <button
                            key={grade}
                            type="button"
                            onClick={() =>
                              setEditGrades(prev =>
                                sel ? prev.filter(g => g !== grade) : [...prev, grade]
                              )
                            }
                            className={`py-1.5 px-2 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                              sel
                                ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)]"
                            }`}
                          >
                            {grade.replace("Grade ", "G")}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                      Class Teacher of
                    </label>
                    <select
                      value={editClassTeacher}
                      onChange={e => setEditClassTeacher(e.target.value)}
                      className="w-full h-11 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 text-xs text-[var(--text-primary)] font-medium"
                    >
                      <option value="none">None (Subject Teacher)</option>
                      {CLASSROOM_OPTIONS.filter(c => c !== "none").map(cls => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Dynamic Edit: Administrative Modules */}
              {(editRole === "admin" || editRole === "staff") && (
                <div className="p-5 rounded-2xl border border-[var(--info-border)] bg-[var(--info-soft-2)] space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--info)] block">
                    Administrative Modules & Operations
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {ADMIN_MODULES_LIST.map(mod => {
                      const isChecked = editModules.includes(mod.id);
                      return (
                        <label
                          key={mod.id}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                            isChecked
                              ? "bg-[var(--info-soft)] border-[var(--info-border)] text-[var(--text-primary)]"
                              : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() =>
                              setEditModules(prev =>
                                isChecked
                                  ? prev.filter(m => m !== mod.id)
                                  : [...prev, mod.id]
                              )
                            }
                          />
                          <span>{mod.id}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3.5 pt-5 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setEditingPerson(null)}
                  className="secondary-button h-11 px-5 rounded-xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingRole}
                  onClick={() => void saveRoleChange()}
                  className="primary-button h-11 px-6 rounded-xl text-sm font-bold shadow-md"
                >
                  {savingRole ? "Saving…" : "Save Permissions"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

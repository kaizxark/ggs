import { describe, it, expect } from "vitest";
import {
  canViewStudent,
  canApplyForLeave,
  canDecideLeave,
  canEditHealth,
  canEditStudent,
  canListStudents,
  canManageActivities,
  canManageAccount,
  canManageDocuments,
  canManageFees,
  canManageGuardians,
  canManageLibrary,
  canRecordAttendance,
  canViewDocuments,
  canViewFees,
  canViewHealth,
  canViewObservations,
  canViewStudent,
  canWriteObservations,
  exportColumnsForRole,
  PUBLIC_ACCOUNT_FIELDS,
  SECTION_LABELS,
  sectionsForRole,
  type StudentSection,
} from "@shared/student-access";

describe("directory access", () => {
  it("lets staff roles open the student list", () => {
    for (const role of ["super_admin", "admin", "principal", "teacher", "staff", "accountant"]) {
      expect(canListStudents(role), role).toBe(true);
    }
  });

  it("refuses parents and pupils the whole roll call", () => {
    // The failure this prevents: a parent reading every child's USN.
    expect(canListStudents("parent")).toBe(false);
    expect(canListStudents("student")).toBe(false);
  });

  it("refuses an unknown role rather than defaulting to the widest view", () => {
    for (const role of ["", "  ", "headmaster", "superadmin2", "ADMIN_DROP_TABLE"]) {
      expect(canListStudents(role), role).toBe(false);
    }
  });
});

describe("record level access", () => {
  it("gives management access to every pupil", () => {
    for (const role of ["super_admin", "admin", "principal"]) {
      expect(canViewStudent(role, null), role).toBe(true);
    }
  });

  it("lets a parent reach only their own child", () => {
    expect(canViewStudent("parent", "guardian")).toBe(true);
    expect(canViewStudent("parent", null)).toBe(false);
    // A teacher relationship is not a parent's relationship.
    expect(canViewStudent("parent", "teacher")).toBe(false);
    expect(canViewStudent("parent", "self")).toBe(false);
  });

  it("lets a pupil reach only themselves", () => {
    expect(canViewStudent("student", "self")).toBe(true);
    expect(canViewStudent("student", "guardian")).toBe(false);
    expect(canViewStudent("student", null)).toBe(false);
  });

  it("scopes a teacher to the classes they teach", () => {
    expect(canViewStudent("teacher", "teacher")).toBe(true);
    expect(canViewStudent("teacher", null)).toBe(false);
  });

  it("keeps staff and accountants at role access, not relationship access", () => {
    // They do not need a link row to read a directory row; the route grants that
    // by role. This asserts the helper does not accidentally deny them.
    expect(canViewStudent("staff", null)).toBe(true);
    expect(canViewStudent("accountant", null)).toBe(true);
  });
});

describe("write permissions", () => {
  it("restricts core student edits to management", () => {
    for (const role of ["super_admin", "admin", "principal"]) {
      expect(canEditStudent(role), role).toBe(true);
    }
    for (const role of ["teacher", "staff", "accountant", "parent", "student"]) {
      expect(canEditStudent(role), role).toBe(false);
    }
  });

  it("lets teachers take a register but not approve leave", () => {
    expect(canRecordAttendance("teacher")).toBe(true);
    expect(canDecideLeave("teacher")).toBe(false);
    expect(canDecideLeave("admin")).toBe(true);
  });

  it("lets a parent apply for leave on their child's behalf", () => {
    expect(canApplyForLeave("parent")).toBe(true);
    // Deciding is still an administrator's job.
    expect(canDecideLeave("parent")).toBe(false);
  });

  it("keeps fee changes with the finance roles", () => {
    for (const role of ["super_admin", "admin", "principal", "accountant"]) {
      expect(canManageFees(role), role).toBe(true);
    }
    for (const role of ["teacher", "staff", "parent", "student"]) {
      expect(canManageFees(role), role).toBe(false);
    }
  });

  it("does not let a teacher open documents, matching api/documents.ts", () => {
    // This pair drifted apart before: the Documents screen was visible to
    // teachers while the route returned 403 for every request.
    expect(canViewDocuments("teacher")).toBe(false);
    expect(canViewDocuments("admin")).toBe(true);
    expect(canViewDocuments("super_admin")).toBe(true);
    expect(canManageDocuments("principal")).toBe(true);
    expect(canManageDocuments("teacher")).toBe(false);
  });
});

describe("section visibility", () => {
  it("gives an administrator every section", () => {
    const all = sectionsForRole("admin", null);
    for (const section of Object.keys(SECTION_LABELS) as StudentSection[]) {
      expect(all, section).toContain(section);
    }
  });

  it("withholds the fee tab from a teacher", () => {
    expect(sectionsForRole("teacher", "teacher")).not.toContain("fees");
  });

  it("withholds the documents tab from a teacher", () => {
    expect(sectionsForRole("teacher", "teacher")).not.toContain("documents");
  });

  it("withholds admission history from a parent", () => {
    expect(sectionsForRole("parent", "guardian")).not.toContain("admission");
  });

  it("withholds fee details from a parent by default", () => {
    // A guardian only sees fees when their link row grants it, and that decision
    // is made per guardian in the database, not here.
    expect(sectionsForRole("parent", "guardian")).not.toContain("fees");
  });

  it("gives a parent the academic record of their own child", () => {
    const sections = sectionsForRole("parent", "guardian");
    expect(sections).toContain("personal");
    expect(sections).toContain("guardians");
    expect(sections).toContain("academics");
    expect(sections).toContain("attendance");
    expect(sections).not.toContain("activities");
  });

  it("withholds health from a parent by default", () => {
    expect(sectionsForRole("parent", "guardian")).not.toContain("health");
  });

  it("withholds the money and health sections from a teacher", () => {
    const sections = sectionsForRole("teacher", "teacher");
    expect(sections).not.toContain("health");
    expect(sections).not.toContain("fees");
  });

  it("returns nothing for an unrelated pupil", () => {
    expect(sectionsForRole("parent", null)).toEqual([]);
    expect(sectionsForRole("student", null)).toEqual([]);
  });

  it("never repeats a section", () => {
    for (const role of ["super_admin", "admin", "principal", "teacher", "staff", "accountant", "student", "parent"]) {
      for (const rel of [null, "guardian", "self", "teacher"] as const) {
        const sections = sectionsForRole(role, rel);
        expect(new Set(sections).size, `${role}/${rel}`).toBe(sections.length);
      }
    }
  });

  it("is case and separator insensitive", () => {
    expect(sectionsForRole("Admin", null)).toEqual(sectionsForRole("admin", null));
    expect(sectionsForRole("super admin", null)).toEqual(sectionsForRole("super_admin", null));
  });
});

describe("observation visibility", () => {
  it("never lets a parent read observations through this helper", () => {
    // A parent's access is governed by visible_to_guardians on the row itself,
    // which the RLS policy reads. This helper must not be the thing that grants it.
    expect(canViewObservations("parent", "guardian")).toBe(false);
    expect(canViewObservations("teacher", "teacher")).toBe(true);
    expect(canViewObservations("admin", null)).toBe(true);
    // A teacher does not read observations for a child outside their classes.
    expect(canViewObservations("teacher", null)).toBe(false);
  });

  it("lets teachers write observations", () => {
    expect(canWriteObservations("teacher")).toBe(true);
    expect(canWriteObservations("parent")).toBe(false);
  });
});

describe("exports", () => {
  it("gives an administrator the wider column set", () => {
    const columns = exportColumnsForRole("admin");
    expect(columns).toContain("date_of_birth");
    expect(columns).toContain("guardian_phone");
  });

  it("narrows a teacher's export to academic columns with no family contact details", () => {
    const columns = exportColumnsForRole("teacher");
    expect(columns).toContain("attendance_percentage");
    // A spreadsheet leaves the building far more easily than a screen does.
    expect(columns).not.toContain("date_of_birth");
    expect(columns).not.toContain("guardian_phone");
    expect(columns).not.toContain("address");
  });

  it("does not put money in a teacher's export", () => {
    expect(exportColumnsForRole("teacher")).not.toContain("outstanding_fees");
    expect(exportColumnsForRole("accountant")).not.toContain("date_of_birth");
  });

  it("never includes a credential field in any export", () => {
    for (const role of ["super_admin", "admin", "principal", "teacher", "staff", "accountant", "parent", "student"]) {
      const columns = exportColumnsForRole(role);
      for (const forbidden of ["password", "password_hash", "token", "credential", "secret"]) {
        expect(columns.some((c) => c.toLowerCase().includes(forbidden)), `${role}/${forbidden}`).toBe(false);
      }
    }
  });
});

describe("account fields", () => {
  it("never names a credential in the public field list", () => {
    for (const field of PUBLIC_ACCOUNT_FIELDS) {
      expect(field.toLowerCase(), field).not.toContain("password");
    }
    expect(PUBLIC_ACCOUNT_FIELDS).not.toContain("password" as never);
  });
});

describe("normalisation", () => {
  it("treats differently spelled role names as the same role", () => {
    expect(canEditStudent("Super Admin")).toBe(true);
    expect(canEditStudent("super-admin")).toBe(true);
    expect(canViewFees("  Principal ")).toBe(true);
  });

  it("does not treat a lookalike role as privileged", () => {
    expect(canEditStudent("super_admin_impersonator")).toBe(false);
    expect(canManageFees("accountant2")).toBe(false);
  });
});

describe("the whole matrix holds together", () => {
  it("never grants a pupil write access to anything", () => {
    const studentChecks = [
      canEditStudent("student"),
      canManageGuardians("student"),
      canRecordAttendance("student"),
      canManageFees("student"),
      canEditHealth("student"),
      canManageDocuments("student"),
      canWriteObservations("student"),
      canDecideLeave("student"),
      canManageActivities("student"),
      canManageLibrary("student"),
      canManageAccount("student"),
    ];
    expect(studentChecks.some(Boolean)).toBe(false);
  });

  it("never grants a teacher access to another teacher's pupil", () => {
    // The relationship argument is the only thing standing between a teacher and
    // the whole student body, so a null relationship must deny.
    expect(canViewStudent("teacher", null)).toBe(false);
    expect(sectionsForRole("teacher", null)).toEqual([]);
  });
});
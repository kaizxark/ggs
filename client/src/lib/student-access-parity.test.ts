import { describe, expect, it } from "vitest";
import { canSeeScreen, screensForRole } from "@shared/ai-access";
import { canListStudents, canViewDocuments, canViewStudent } from "@shared/student-access";

/**
 * These two modules describe the same permissions from opposite ends: one
 * decides which screens the navigation offers, the other which API routes answer.
 * When they disagreed, a teacher was shown a Documents screen whose every request
 * returned 403 — a screen that looks broken rather than one that correctly hides
 * itself, and a support call that starts "Documents doesn't work".
 *
 * Nothing in the type system connects them, so this test is the thing that stops
 * them drifting again.
 */

const ROLES = [
  "super_admin",
  "admin",
  "principal",
  "teacher",
  "staff",
  "accountant",
  "student",
  "parent",
];

describe("screen matrix and route permissions agree", () => {
  it("does not offer a separate Documents screen to any role (documents live under students)", () => {
    for (const role of ROLES) {
      const offered = screensForRole(role).indexOf("documents" as any) !== -1;
      expect(offered, `${role}: Documents screen should not be in navigation`).toBe(false);
    }
  });

  it("restricts canViewDocuments to administrators", () => {
    expect(canViewDocuments("super_admin")).toBe(true);
    expect(canViewDocuments("admin")).toBe(true);
    expect(canViewDocuments("teacher")).toBe(false);
    expect(canViewDocuments("principal")).toBe(false);
    expect(canViewDocuments("staff")).toBe(false);
    expect(canViewDocuments("student")).toBe(false);
    expect(canViewDocuments("parent")).toBe(false);
  });

  it("offers the Students screen to exactly the roles that may list students", () => {
    for (const role of ROLES) {
      const offered = screensForRole(role).indexOf("students") !== -1;
      // A parent and a pupil are refused the directory outright: it is the
      // whole roll call, not their own child.
      expect(canListStudents(role), `${role}: students screen`).toBe(offered);
    }
  });

  it("does not offer any screen to an unknown role", () => {
    for (const role of ["", "headmaster", "root"]) {
      expect(screensForRole(role), role).toEqual(["overview"]);
      expect(canSeeScreen(role, "students"), role).toBe(false);
      expect(canListStudents(role), role).toBe(false);
      expect(canViewDocuments(role), role).toBe(false);
    }
  });

  it("keeps record-level student access separate from the directory", () => {
    // A parent may see a linked child without being able to see the list. These
    // two rules answer different questions and must not be collapsed.
    expect(canListStudents("parent")).toBe(false);
    expect(canViewStudent("parent", "guardian")).toBe(true);
    expect(canViewStudent("parent", null)).toBe(false);
  });

  it("denies a teacher an unassigned pupil", () => {
    expect(canViewStudent("teacher", "teacher")).toBe(true);
    expect(canViewStudent("teacher", null)).toBe(false);
  });
});
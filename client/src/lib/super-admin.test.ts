import { describe, expect, it } from "vitest";
import {
  SUPER_ADMIN_ID,
  SUPER_ADMIN_ROLE,
  effectiveRole,
  isSuperAdminId,
  ROLE_LABELS,
  roleLabel,
  superAdminGuard,
} from "@shared/super-admin";

/*
 * The super admin has to be permanent and unassailable, and almost every
 * regression here is the same bug wearing a different hat: a check that
 * outranks him on something he can change. These tests pin the invariant that
 * only the immutable user id grants the role.
 */
describe("isSuperAdminId", () => {
  it("recognises the super admin's own id", () => {
    expect(isSuperAdminId(SUPER_ADMIN_ID)).toBe(true);
  });

  it("ignores anything that is not that exact id", () => {
    // Case and padding are normalised: these are the same id as far as a UUID
    // is concerned, and a near-miss must not be treated as the super admin.
    expect(isSuperAdminId(SUPER_ADMIN_ID.toUpperCase())).toBe(true);
    expect(isSuperAdminId(`  ${SUPER_ADMIN_ID}  `)).toBe(true);
    expect(isSuperAdminId(`${SUPER_ADMIN_ID}0`)).toBe(false);
    expect(isSuperAdminId(SUPER_ADMIN_ID.replace("60ff", "60fe"))).toBe(false);
  });

  it("rejects empty and non-string values instead of coercing them", () => {
    // Coercing here would mean `isSuperAdminId(0)` or a null-ish object
    // accidentally matching, so the signature stays `unknown`.
    expect(isSuperAdminId("")).toBe(false);
    expect(isSuperAdminId(null)).toBe(false);
    expect(isSuperAdminId(undefined)).toBe(false);
    expect(isSuperAdminId({ id: SUPER_ADMIN_ID })).toBe(false);
    expect(isSuperAdminId([SUPER_ADMIN_ID])).toBe(false);
  });
});

describe("effectiveRole", () => {
  it("overrides the stored role for the super admin", () => {
    // This is the case the whole module exists for. The database can only
    // store "admin" today, and a screen that trusted the column would show
    // the most powerful account as one of several equals.
    expect(effectiveRole(SUPER_ADMIN_ID, "admin")).toBe(SUPER_ADMIN_ROLE);
  });

  it("is unmoved by anything the super admin can edit about his own account", () => {
    // Renaming the account rewrites the email, and the Settings screen
    // derives the username from it. None of that is passed in here — only the
    // id — so none of it can cost him the role.
    for (const stored of ["admin", "principal", "staff", "teacher", "parent", null, undefined, ""]) {
      expect(effectiveRole(SUPER_ADMIN_ID, stored)).toBe(SUPER_ADMIN_ROLE);
    }
  });

  it("passes everyone else's stored role through untouched", () => {
    expect(effectiveRole("some-other-id", "principal")).toBe("principal");
    expect(effectiveRole("some-other-id", "teacher")).toBe("teacher");
  });

  it("falls back to parent when the column is empty", () => {
    // A profile with no role is a parent by the old default. Guessing anything
    // more privileged than that would be an escalation.
    expect(effectiveRole("some-other-id", null)).toBe("parent");
    expect(effectiveRole("some-other-id", "")).toBe("parent");
  });

  it("does not let a non-super-admin claim the role", () => {
    // The stored column is attacker-influenced only in theory, but a stray
    // "super_admin" string must not become real here. The enum rejects it
    // today; this keeps the module honest if that ever changes.
    expect(effectiveRole("someone-else", "super_admin")).not.toBe(SUPER_ADMIN_ROLE);
  });
});

describe("roleLabel", () => {
  it("labels the super admin as Super admin, not Admin", () => {
    // The label is what every screen shows, so getting it wrong is how the
    // account ends up looking like any other admin in the directory.
    expect(roleLabel(SUPER_ADMIN_ID, "admin")).toBe("Super admin");
  });

  it("needs no second argument for the super admin", () => {
    expect(roleLabel(SUPER_ADMIN_ID)).toBe("Super admin");
    expect(roleLabel(SUPER_ADMIN_ID, null)).toBe("Super admin");
  });

  it("labels the other roles as before", () => {
    expect(roleLabel("id-a", "admin")).toBe("Admin");
    expect(roleLabel("id-a", "principal")).toBe("Admin");
    expect(roleLabel("id-a", "teacher")).toBe("Staff");
    expect(roleLabel("id-a", "parent")).toBe("Parent");
    expect(roleLabel("id-a", "student")).toBe("Student");
  });

  it("has a label for every role it can produce", () => {
    // Guards against a new role being added to effectiveRole without a
    // matching label, which would render a raw slug in the UI.
    expect(ROLE_LABELS[SUPER_ADMIN_ROLE]).toBe("Super admin");
    for (const role of ["admin", "principal", "staff", "teacher", "parent"]) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it("falls back to the raw role rather than rendering nothing", () => {
    expect(roleLabel("id-a", "librarian")).toBe("librarian");
  });
});

describe("superAdminGuard", () => {
  it("blocks every protected action", () => {
    for (const action of [
      "change the role of",
      "delete",
      "replace the account of",
    ] as const) {
      expect(superAdminGuard(SUPER_ADMIN_ID, action)).toBeTruthy();
    }
  });

  it("explains the rule instead of returning a bare 'forbidden'", () => {
    const message = superAdminGuard(SUPER_ADMIN_ID, "delete") ?? "";
    expect(message).toContain("super admin");
    expect(message).toContain("Nobody can delete");
  });

  it("reads as a sentence whichever action is passed", () => {
    // The action is interpolated mid-sentence, so a past-tense or prepositional
    // caller used to produce "cannot be delete by anyone". Every combination has
    // to parse as English, because this text is shown to a person.
    for (const action of [
      "change the role of",
      "delete",
      "replace the account of",
    ] as const) {
      const message = superAdminGuard(SUPER_ADMIN_ID, action) ?? "";
      expect(message).toMatch(/^[A-Z]/);
      expect(message.endsWith(".")).toBe(true);
      expect(message).not.toMatch(/\b(delete|replace) by\b/);
    }
  });

  it("lets everyone else through", () => {
    // null, not false: the caller treats null as "no objection" and this keeps
    // the check a single `if (blocked)` at every call site.
    expect(superAdminGuard("some-other-id", "delete")).toBeNull();
    expect(superAdminGuard(null, "delete")).toBeNull();
  });

  it("cannot be talked round by a renamed account", () => {
    // The guard takes an id and nothing else, so there is no email or username
    // an attacker could substitute to get a pass.
    expect(superAdminGuard(SUPER_ADMIN_ID.toUpperCase(), "delete")).toBeTruthy();
  });
});

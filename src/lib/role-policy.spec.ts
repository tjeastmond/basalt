import { describe, expect, it } from "vitest";

import {
  canAdminEditUserProfile,
  canChangeUserAccessLevel,
  canChangeUserEmail,
  canCreateUserWithLevel,
} from "@/lib/role-policy";

describe("canCreateUserWithLevel", () => {
  it("allows owner to create any level", () => {
    expect(canCreateUserWithLevel("owner", "owner").ok).toBe(true);
    expect(canCreateUserWithLevel("owner", "admin").ok).toBe(true);
    expect(canCreateUserWithLevel("owner", "user").ok).toBe(true);
  });

  it("allows admin to create admin and user only", () => {
    expect(canCreateUserWithLevel("admin", "owner").ok).toBe(false);
    expect(canCreateUserWithLevel("admin", "admin").ok).toBe(true);
    expect(canCreateUserWithLevel("admin", "user").ok).toBe(true);
  });

  it("denies user", () => {
    expect(canCreateUserWithLevel("user", "user").ok).toBe(false);
  });
});

describe("canChangeUserAccessLevel", () => {
  it("denies assigning owner unless actor is owner", () => {
    const r = canChangeUserAccessLevel("admin", "user", "owner", 1);
    expect(r.ok).toBe(false);
  });

  it("denies admin changing an existing owner", () => {
    const r = canChangeUserAccessLevel("admin", "owner", "admin", 2);
    expect(r.ok).toBe(false);
  });

  it("denies removing the last owner", () => {
    const r = canChangeUserAccessLevel("owner", "owner", "user", 1);
    expect(r.ok).toBe(false);
  });

  it("allows owner to demote another owner when two exist", () => {
    const r = canChangeUserAccessLevel("owner", "owner", "admin", 2);
    expect(r.ok).toBe(true);
  });

  it("allows owner to promote user to owner", () => {
    const r = canChangeUserAccessLevel("owner", "user", "owner", 1);
    expect(r.ok).toBe(true);
  });
});

describe("canAdminEditUserProfile", () => {
  it("allows owner and admin", () => {
    expect(canAdminEditUserProfile("owner").ok).toBe(true);
    expect(canAdminEditUserProfile("admin").ok).toBe(true);
  });

  it("denies regular user", () => {
    expect(canAdminEditUserProfile("user").ok).toBe(false);
  });
});

describe("canChangeUserEmail", () => {
  it("denies admin changing an owner target", () => {
    expect(canChangeUserEmail("admin", "owner").ok).toBe(false);
  });

  it("allows owner changing an owner target", () => {
    expect(canChangeUserEmail("owner", "owner").ok).toBe(true);
  });

  it("allows admin changing user or admin targets", () => {
    expect(canChangeUserEmail("admin", "user").ok).toBe(true);
    expect(canChangeUserEmail("admin", "admin").ok).toBe(true);
  });

  it("allows owner changing user or admin targets", () => {
    expect(canChangeUserEmail("owner", "user").ok).toBe(true);
    expect(canChangeUserEmail("owner", "admin").ok).toBe(true);
  });

  it("denies regular user", () => {
    expect(canChangeUserEmail("user", "user").ok).toBe(false);
  });
});

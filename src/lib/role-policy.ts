import type { AccessSlug } from "@/lib/access-level";

export type LevelChangeResult = { ok: true } | { ok: false; message: string };

/**
 * Whether an actor may create a new user whose initial access level is `newLevel`.
 */
export function canCreateUserWithLevel(actor: AccessSlug, newLevel: AccessSlug): LevelChangeResult {
  if (actor === "owner") {
    return { ok: true };
  }
  if (actor === "admin") {
    if (newLevel === "owner") {
      return { ok: false, message: "Only an Owner can assign the Owner role." };
    }
    return { ok: true };
  }
  return { ok: false, message: "Insufficient permissions." };
}

/**
 * Whether an actor may change a user's access level.
 * `ownerCountBefore` is the count of users with the Owner level before this change applies.
 */
export function canChangeUserAccessLevel(
  actor: AccessSlug,
  targetCurrentLevel: AccessSlug,
  nextLevel: AccessSlug,
  ownerCountBefore: number,
): LevelChangeResult {
  if (actor !== "owner" && actor !== "admin") {
    return { ok: false, message: "Insufficient permissions." };
  }

  if (nextLevel === "owner" && actor !== "owner") {
    return { ok: false, message: "Only an Owner can assign the Owner role." };
  }

  if (targetCurrentLevel === "owner" && actor !== "owner") {
    return { ok: false, message: "Only an Owner can change an Owner's access level." };
  }

  if (targetCurrentLevel === "owner" && nextLevel !== "owner") {
    if (ownerCountBefore < 2) {
      return { ok: false, message: "Cannot remove the last Owner." };
    }
  }

  return { ok: true };
}

/**
 * Whether an actor may update another user's profile fields (name, password).
 * Access level must be changed only via {@link canChangeUserAccessLevel} on the dedicated mutation.
 */
export function canAdminEditUserProfile(actor: AccessSlug): LevelChangeResult {
  if (actor === "owner" || actor === "admin") {
    return { ok: true };
  }
  return { ok: false, message: "Insufficient permissions." };
}

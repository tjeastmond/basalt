import { eq } from "drizzle-orm";

import { db, accessLevels, user } from "@/db";
import type { AccessSlug } from "@/lib/access-level";
import { auth } from "@/lib/auth";

export type Member = {
  userId: string;
  email: string;
  name: string;
  image: string | null;
  accessLevelId: string;
  accessSlug: AccessSlug;
  sortOrder: number;
  onboardingCompletedAt: Date | null;
};

function isAccessSlug(value: string): value is AccessSlug {
  return value === "owner" || value === "admin" || value === "user";
}

/** Loads the signed-in user plus access level from the database (source of truth for roles). */
export async function getMemberFromHeaders(headers: Headers): Promise<Member | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) {
    return null;
  }

  const [row] = await db
    .select({
      userId: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      accessLevelId: user.accessLevelId,
      onboardingCompletedAt: user.onboardingCompletedAt,
      slug: accessLevels.slug,
      sortOrder: accessLevels.sortOrder,
    })
    .from(user)
    .innerJoin(accessLevels, eq(user.accessLevelId, accessLevels.id))
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!row || !isAccessSlug(row.slug)) {
    return null;
  }

  return {
    userId: row.userId,
    email: row.email,
    name: row.name,
    image: row.image,
    accessLevelId: row.accessLevelId,
    accessSlug: row.slug,
    sortOrder: row.sortOrder,
    onboardingCompletedAt: row.onboardingCompletedAt,
  };
}

/** Owner bypasses all admin-level gates; used for superuser-style checks. */
export function isOwner(member: Member): boolean {
  return member.accessSlug === "owner";
}

export function isAdminOrOwner(member: Member): boolean {
  return member.accessSlug === "owner" || member.accessSlug === "admin";
}

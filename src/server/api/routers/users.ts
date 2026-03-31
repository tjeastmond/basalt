import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { TRPCError } from "@trpc/server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";

import { db, accessLevels, account, user } from "@/db";
import type { AccessSlug } from "@/lib/access-level";
import { canChangeUserAccessLevel, canCreateUserWithLevel } from "@/lib/role-policy";
import { adminProcedure, router } from "@/server/api/trpc";

const accessSlugSchema = z.enum(["owner", "admin", "user"]);

function assertAccessSlug(s: string): AccessSlug {
  if (s === "owner" || s === "admin" || s === "user") {
    return s;
  }
  throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid access level." });
}

async function getOwnerLevelId(): Promise<string | null> {
  const [row] = await db
    .select({ id: accessLevels.id })
    .from(accessLevels)
    .where(eq(accessLevels.slug, "owner"))
    .limit(1);
  return row?.id ?? null;
}

async function countUsersWithAccessLevel(levelId: string): Promise<number> {
  const [row] = await db.select({ value: count() }).from(user).where(eq(user.accessLevelId, levelId));
  return Number(row?.value ?? 0);
}

async function resolveLevelId(slug: AccessSlug): Promise<string> {
  const [row] = await db.select({ id: accessLevels.id }).from(accessLevels).where(eq(accessLevels.slug, slug)).limit(1);
  if (!row) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Missing access_levels row for '${slug}'. Run pnpm db:seed.`,
    });
  }
  return row.id;
}

export const usersRouter = router({
  list: adminProcedure.query(async () => {
    const rows = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        accessSlug: accessLevels.slug,
      })
      .from(user)
      .innerJoin(accessLevels, eq(user.accessLevelId, accessLevels.id))
      .orderBy(user.email);

    return { users: rows };
  }),

  create: adminProcedure
    .input(
      z.object({
        email: z.string().email().max(320),
        password: z.string().min(8).max(128),
        name: z.string().min(1).max(200),
        accessLevelSlug: accessSlugSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.member.accessSlug;
      const newLevel = input.accessLevelSlug;
      const createCheck = canCreateUserWithLevel(actor, newLevel);
      if (!createCheck.ok) {
        throw new TRPCError({ code: "FORBIDDEN", message: createCheck.message });
      }

      const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, input.email)).limit(1);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A user with this email already exists." });
      }

      const levelId = await resolveLevelId(newLevel);
      const userId = randomUUID();
      const accountId = randomUUID();
      const passwordHash = await hashPassword(input.password);

      await db.insert(user).values({
        id: userId,
        name: input.name,
        email: input.email,
        emailVerified: true,
        image: null,
        accessLevelId: levelId,
        onboardingCompletedAt: null,
      });

      await db.insert(account).values({
        id: accountId,
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
      });

      return { id: userId };
    }),

  updateAccessLevel: adminProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        accessLevelSlug: accessSlugSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [target] = await db
        .select({
          id: user.id,
          slug: accessLevels.slug,
        })
        .from(user)
        .innerJoin(accessLevels, eq(user.accessLevelId, accessLevels.id))
        .where(eq(user.id, input.userId))
        .limit(1);

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      const targetCurrent = assertAccessSlug(target.slug);
      const nextLevel = input.accessLevelSlug;
      const actor = ctx.member.accessSlug;

      const ownerLevelId = await getOwnerLevelId();
      if (!ownerLevelId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Owner access level missing." });
      }
      const ownerCountBefore = await countUsersWithAccessLevel(ownerLevelId);

      const change = canChangeUserAccessLevel(actor, targetCurrent, nextLevel, ownerCountBefore);
      if (!change.ok) {
        throw new TRPCError({ code: "FORBIDDEN", message: change.message });
      }

      const nextLevelId = await resolveLevelId(nextLevel);
      await db.update(user).set({ accessLevelId: nextLevelId }).where(eq(user.id, input.userId));

      return { ok: true as const };
    }),
});

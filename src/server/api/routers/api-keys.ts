import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { accessLevels, apiKeys, db } from "@/db";
import type { AccessSlug } from "@/lib/access-level";
import { canCreateUserWithLevel } from "@/lib/role-policy";
import { generateApiKeyPlaintext, hashApiKeySecret } from "@/server/api-key-crypto";
import { adminProcedure, router } from "@/server/api/trpc";

function isAccessSlug(value: string): value is AccessSlug {
  return value === "owner" || value === "admin" || value === "user";
}

const createInput = z.object({
  label: z.string().min(1).max(200),
  accessLevelId: z.string().uuid(),
  allowedCollectionIds: z.array(z.string().uuid()).nullable().optional(),
});

export const apiKeysRouter = router({
  list: adminProcedure.query(async () => {
    const rows = await db
      .select({
        id: apiKeys.id,
        label: apiKeys.label,
        keyPrefix: apiKeys.keyPrefix,
        accessLevelId: apiKeys.accessLevelId,
        accessSlug: accessLevels.slug,
        allowedCollectionIds: apiKeys.allowedCollectionIds,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .innerJoin(accessLevels, eq(apiKeys.accessLevelId, accessLevels.id))
      .orderBy(desc(apiKeys.createdAt));

    return {
      keys: rows.map((r) => ({
        id: r.id,
        label: r.label,
        keyPrefix: r.keyPrefix,
        accessLevelId: r.accessLevelId,
        accessSlug: r.accessSlug,
        allowedCollectionIds: r.allowedCollectionIds ?? null,
        revokedAt: r.revokedAt,
        createdAt: r.createdAt,
      })),
    };
  }),

  create: adminProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const [level] = await db
      .select({ slug: accessLevels.slug })
      .from(accessLevels)
      .where(eq(accessLevels.id, input.accessLevelId))
      .limit(1);

    if (!level || !isAccessSlug(level.slug)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown access level." });
    }

    const gate = canCreateUserWithLevel(ctx.member.accessSlug, level.slug);
    if (!gate.ok) {
      throw new TRPCError({ code: "FORBIDDEN", message: gate.message });
    }

    const plaintext = generateApiKeyPlaintext();
    const { keyPrefix, keySalt, keyHash } = hashApiKeySecret(plaintext);

    const [row] = await db
      .insert(apiKeys)
      .values({
        label: input.label,
        keyPrefix,
        keySalt,
        keyHash,
        accessLevelId: input.accessLevelId,
        allowedCollectionIds: input.allowedCollectionIds ?? null,
      })
      .returning({
        id: apiKeys.id,
        label: apiKeys.label,
        keyPrefix: apiKeys.keyPrefix,
        createdAt: apiKeys.createdAt,
      });

    if (!row) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create API key." });
    }

    return {
      id: row.id,
      label: row.label,
      keyPrefix: row.keyPrefix,
      createdAt: row.createdAt,
      secret: plaintext,
    };
  }),

  revoke: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
    const [updated] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, input.id), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });

    if (!updated) {
      throw new TRPCError({ code: "NOT_FOUND", message: "API key not found or already revoked." });
    }

    return { ok: true as const };
  }),
});

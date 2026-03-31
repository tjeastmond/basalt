import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { db, collections } from "@/db";
import {
  collectionFieldsLooseArraySchema,
  computeSchemaChangeFlags,
  finalizeFieldDefinitions,
  parseCollectionFields,
  setsEqual,
} from "@/lib/collection-fields";
import { MAX_TABLE_SUFFIX_LENGTH } from "@/lib/collection-physical-table";
import { collectionCreateInputSchema, createCollectionAsAdmin } from "@/server/collection-admin-commands";
import {
  collectionDataTableExists,
  createCollectionDataTable,
  dropCollectionDataTable,
  syncCollectionDataTableSchema,
} from "@/server/collection-data-ddl";
import { adminProcedure, router } from "@/server/api/trpc";

const collectionSlugSchema = z
  .string()
  .min(1)
  .max(MAX_TABLE_SUFFIX_LENGTH)
  .regex(/^[a-z][a-z0-9_]*$/, "Slug: lowercase letters, numbers, underscores; start with a letter.");

const updateInput = z.object({
  id: z.string().uuid(),
  slug: collectionSlugSchema,
  name: z.string().min(1).max(200),
  fields: collectionFieldsLooseArraySchema,
  /** Must list every removed field id when the update drops fields (explicit confirmation). */
  removedFieldIds: z.array(z.string().uuid()).optional(),
  /** Must list every field id whose type changes in an unsafe way, after user confirms. */
  confirmedUnsafeTypeFieldIds: z.array(z.string().uuid()).optional(),
});

export const collectionsRouter = router({
  list: adminProcedure.query(async () => {
    const rows = await db
      .select({
        id: collections.id,
        slug: collections.slug,
        name: collections.name,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
      })
      .from(collections)
      .orderBy(collections.name);

    return { collections: rows };
  }),

  byId: adminProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
    const [row] = await db.select().from(collections).where(eq(collections.id, input.id)).limit(1);
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found." });
    }
    return row;
  }),

  create: adminProcedure.input(collectionCreateInputSchema).mutation(async ({ input }) => {
    return createCollectionAsAdmin(input);
  }),

  update: adminProcedure.input(updateInput).mutation(async ({ input }) => {
    const [existing] = await db.select().from(collections).where(eq(collections.id, input.id)).limit(1);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found." });
    }

    const previousFields = parseCollectionFields(existing.fields);
    const nextFields = finalizeFieldDefinitions(input.fields);

    const [slugConflict] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.slug, input.slug), ne(collections.id, input.id)))
      .limit(1);
    if (slugConflict) {
      throw new TRPCError({ code: "CONFLICT", message: "Another collection already uses this slug." });
    }

    const { removedFieldIds, unsafeTypeFieldIds } = computeSchemaChangeFlags(previousFields, nextFields);

    const removalOk =
      removedFieldIds.length === 0 ||
      (input.removedFieldIds !== undefined &&
        setsEqual([...input.removedFieldIds].sort(), [...removedFieldIds].sort()));

    const unsafeOk =
      unsafeTypeFieldIds.length === 0 ||
      (input.confirmedUnsafeTypeFieldIds !== undefined &&
        setsEqual([...input.confirmedUnsafeTypeFieldIds].sort(), [...unsafeTypeFieldIds].sort()));

    if (!removalOk || !unsafeOk) {
      return {
        status: "needsConfirmation" as const,
        removedFieldIds,
        unsafeTypeFieldIds,
      };
    }

    try {
      const row = await db.transaction(async (tx) => {
        const exists = await collectionDataTableExists(tx, existing.tableSuffix);
        if (!exists) {
          await createCollectionDataTable(tx, existing.tableSuffix, nextFields);
        } else {
          await syncCollectionDataTableSchema(tx, existing.tableSuffix, previousFields, nextFields);
        }

        const [updated] = await tx
          .update(collections)
          .set({
            slug: input.slug,
            name: input.name,
            fields: nextFields,
          })
          .where(eq(collections.id, input.id))
          .returning();

        if (!updated) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update collection." });
        }
        return updated;
      });

      return { status: "ok" as const, collection: row };
    } catch (e) {
      if (e instanceof TRPCError) {
        throw e;
      }
      const message = e instanceof Error ? e.message : "Failed to sync collection data table.";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
    }
  }),

  delete: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
    const [existing] = await db
      .select({ id: collections.id, tableSuffix: collections.tableSuffix })
      .from(collections)
      .where(eq(collections.id, input.id))
      .limit(1);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found." });
    }

    try {
      await db.transaction(async (tx) => {
        await dropCollectionDataTable(tx, existing.tableSuffix);
        await tx.delete(collections).where(eq(collections.id, input.id));
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete collection data table.";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
    }

    return { ok: true as const };
  }),
});

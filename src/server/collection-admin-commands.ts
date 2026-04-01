import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { collections, db } from "@/db";
import type { CollectionApiPermissions } from "@/lib/collection-api-permissions";
import { collectionFieldsLooseArraySchema, finalizeFieldDefinitions } from "@/lib/collection-fields";
import { MAX_TABLE_SUFFIX_LENGTH } from "@/lib/collection-physical-table";
import { createCollectionDataTable, dropCollectionDataTable } from "@/server/collection-data-ddl";

const collectionSlugSchema = z
  .string()
  .min(1)
  .max(MAX_TABLE_SUFFIX_LENGTH)
  .regex(/^[a-z][a-z0-9_]*$/, "Slug: lowercase letters, numbers, underscores; start with a letter.");

export const collectionCreateInputSchema = z.object({
  slug: collectionSlugSchema,
  name: z.string().min(1).max(200),
  fields: collectionFieldsLooseArraySchema,
});

export type CollectionCreateInput = z.infer<typeof collectionCreateInputSchema>;

export async function createCollectionAsAdmin(input: CollectionCreateInput) {
  const fields = finalizeFieldDefinitions(input.fields);
  const [existing] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, input.slug))
    .limit(1);
  if (existing) {
    throw new TRPCError({ code: "CONFLICT", message: "A collection with this slug already exists." });
  }

  const [suffixTaken] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.tableSuffix, input.slug))
    .limit(1);
  if (suffixTaken) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Another collection already uses this table name (table suffix).",
    });
  }

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(collections)
        .values({
          slug: input.slug,
          tableSuffix: input.slug,
          name: input.name,
          fields,
        })
        .returning();

      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create collection." });
      }

      await createCollectionDataTable(tx, row.tableSuffix, fields);
      return row;
    });
  } catch (e) {
    if (e instanceof TRPCError) {
      throw e;
    }
    const message = e instanceof Error ? e.message : "Failed to create collection data table.";
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
  }
}

export async function deleteCollectionBySlug(slug: string): Promise<void> {
  const [existing] = await db
    .select({ id: collections.id, tableSuffix: collections.tableSuffix })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found." });
  }

  try {
    await db.transaction(async (tx) => {
      await dropCollectionDataTable(tx, existing.tableSuffix);
      await tx.delete(collections).where(eq(collections.id, existing.id));
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete collection data table.";
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
  }
}

export async function updateCollectionApiPermissionsBySlug(
  slug: string,
  next: CollectionApiPermissions,
): Promise<CollectionApiPermissions> {
  const [existing] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found." });
  }

  const [updated] = await db
    .update(collections)
    .set({ apiPermissions: next })
    .where(eq(collections.id, existing.id))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update API permissions." });
  }

  return updated.apiPermissions;
}

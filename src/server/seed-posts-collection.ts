import { eq } from "drizzle-orm";

import { collections, db, getPool } from "@/db";
import type { CollectionFieldLooseInput } from "@/lib/collection-fields";
import { finalizeFieldDefinitions, parseCollectionFields } from "@/lib/collection-fields";
import { collectionDataTableExists, createCollectionDataTable } from "@/server/collection-data-ddl";
import { insertCollectionRecord, loadCollectionRecordsTarget } from "@/server/collection-records";

export const POSTS_COLLECTION_SLUG = "posts" as const;

/** Stable field ids so the stored JSON matches across fresh installs. */
const defaultPostsFieldsLoose: CollectionFieldLooseInput[] = [
  {
    id: "0f000000-0000-4000-8000-000000000001",
    name: "Title",
    type: "text",
    required: true,
    unique: false,
  },
  {
    id: "0f000000-0000-4000-8000-000000000002",
    name: "Slug",
    type: "text",
    required: true,
    unique: true,
  },
  {
    id: "0f000000-0000-4000-8000-000000000003",
    name: "Body",
    type: "text",
    required: false,
    unique: false,
    multiline: true,
  },
];

/**
 * Ensures the default `posts` collection exists (`collections` row + `col_posts` via DDL)
 * and inserts a few sample rows when the physical table is empty (local dev convenience).
 */
export async function ensurePostsCollectionAndSampleData(): Promise<void> {
  const fields = finalizeFieldDefinitions(defaultPostsFieldsLoose);

  const [existing] = await db.select().from(collections).where(eq(collections.slug, POSTS_COLLECTION_SLUG)).limit(1);

  if (!existing) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(collections)
        .values({
          slug: POSTS_COLLECTION_SLUG,
          tableSuffix: POSTS_COLLECTION_SLUG,
          name: "Posts",
          fields,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to insert default posts collection.");
      }

      await createCollectionDataTable(tx, row.tableSuffix, fields);
    });
    console.info("Seeded default collection: posts (physical table col_posts).");
  } else {
    const tableOk = await collectionDataTableExists(db, existing.tableSuffix);
    if (!tableOk) {
      const storedFields = parseCollectionFields(existing.fields);
      await db.transaction(async (tx) => {
        await createCollectionDataTable(tx, existing.tableSuffix, storedFields);
      });
      console.info("Repaired missing physical table for collection posts (col_%s).", existing.tableSuffix);
    }
  }

  const [row] = await db.select({ id: collections.id }).from(collections).where(eq(collections.slug, POSTS_COLLECTION_SLUG)).limit(1);
  if (!row) {
    throw new Error("Expected posts collection after seed step.");
  }

  const target = await loadCollectionRecordsTarget(row.id);
  if (!target) {
    throw new Error("Failed to load posts collection for record seed.");
  }

  const pool = getPool();
  const countRes = await pool.query<{ c: number }>(`SELECT count(*)::int AS c FROM ${target.tableSql}`);
  const count = countRes.rows[0]?.c ?? 0;
  if (count > 0) {
    console.info("Posts sample rows skipped: %s already has %i row(s).", target.tableSql, count);
    return;
  }

  const samples: Record<string, unknown>[] = [
    {
      title: "Welcome to Basalt",
      slug: "welcome-to-basalt",
      body: "This post was created by `pnpm db:seed`. Edit the schema and records under Collections in the admin UI.",
    },
    {
      title: "Collections and physical tables",
      slug: "collections-and-physical-tables",
      body: "Each collection stores rows in a dedicated Postgres table (here, col_posts). Metadata lives in the collections registry.",
    },
    {
      title: "Try the REST API",
      slug: "try-the-rest-api",
      body: "Issue an API key, then use GET /api/v1/collections/posts/records to read these rows as JSON.",
    },
  ];

  for (const input of samples) {
    await insertCollectionRecord(target, input);
  }

  console.info("Seeded %i sample row(s) into %s.", samples.length, target.tableSql);
}

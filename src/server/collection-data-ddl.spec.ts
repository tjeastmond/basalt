import { describe, expect, it } from "vitest";

import { buildAddColumnStatementsForExistingTable, collectionDataTableExists } from "@/server/collection-data-ddl";

const sampleField = (patch: Record<string, unknown>) =>
  ({
    id: "aaaaaaaa-bbbb-4ccc-a111-eeeeeeeeeeee",
    name: "publish_date",
    type: "date",
    required: true,
    unique: false,
    ...patch,
  }) as import("@/lib/collection-fields").CollectionFieldDefinition;

describe("collectionDataTableExists", () => {
  it("treats Drizzle/node-pg execute result as { rows }", async () => {
    const executor = {
      execute: async () => ({ rows: [{ ok: true }], rowCount: 1 }),
    };
    await expect(collectionDataTableExists(executor, "posts")).resolves.toBe(true);
  });

  it("returns false when first row ok is false", async () => {
    const executor = {
      execute: async () => ({ rows: [{ ok: false }], rowCount: 1 }),
    };
    await expect(collectionDataTableExists(executor, "posts")).resolves.toBe(false);
  });
});

describe("buildAddColumnStatementsForExistingTable", () => {
  const table = "col_posts";

  it("uses plain ADD COLUMN when the table is empty", () => {
    const f = sampleField({ name: "publish_date", type: "date", required: true });
    const stmts = buildAddColumnStatementsForExistingTable(table, f, 0);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toBe("ALTER TABLE col_posts ADD COLUMN publish_date timestamptz NOT NULL");
  });

  it("adds NOT NULL with a server backfill then DROP DEFAULT when required, no user default, not unique", () => {
    const f = sampleField({ name: "publish_date", type: "date", required: true, unique: false });
    const stmts = buildAddColumnStatementsForExistingTable(table, f, 3);
    expect(stmts).toEqual([
      "ALTER TABLE col_posts ADD COLUMN publish_date timestamptz NOT NULL DEFAULT now()",
      "ALTER TABLE col_posts ALTER COLUMN publish_date DROP DEFAULT",
    ]);
  });

  it("uses user default in a single ADD when provided", () => {
    const f = sampleField({
      name: "publish_date",
      type: "date",
      required: true,
      defaultValue: "2020-01-01T00:00:00.000Z",
    });
    const stmts = buildAddColumnStatementsForExistingTable(table, f, 5);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toContain("NOT NULL DEFAULT");
    expect(stmts[0]).toContain("2020-01-01");
  });

  it("throws when unique + required + constant default with multiple rows", () => {
    const f = sampleField({
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      defaultValue: "x",
    });
    expect(() => buildAddColumnStatementsForExistingTable(table, f, 2)).toThrow(/constant default/);
  });
});

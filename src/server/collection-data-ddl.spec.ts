import { describe, expect, it } from "vitest";

import { collectionDataTableExists } from "@/server/collection-data-ddl";

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

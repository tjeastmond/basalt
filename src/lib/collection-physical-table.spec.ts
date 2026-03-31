import { describe, expect, it } from "vitest";

import {
  COLLECTION_DATA_TABLE_PREFIX,
  MAX_TABLE_SUFFIX_LENGTH,
  assertValidTableSuffix,
  collectionDataTableName,
} from "@/lib/collection-physical-table";

describe("collectionDataTableName", () => {
  it("prefixes validated suffix", () => {
    expect(collectionDataTableName("posts")).toBe(`${COLLECTION_DATA_TABLE_PREFIX}posts`);
  });

  it("rejects invalid suffixes", () => {
    expect(() => collectionDataTableName("123bad")).toThrow();
    expect(() => collectionDataTableName("")).toThrow();
  });
});

describe("assertValidTableSuffix", () => {
  it("allows suffix up to max length", () => {
    const s = "a".repeat(MAX_TABLE_SUFFIX_LENGTH);
    expect(() => assertValidTableSuffix(s)).not.toThrow();
  });

  it("rejects suffix over max length", () => {
    const s = "a".repeat(MAX_TABLE_SUFFIX_LENGTH + 1);
    expect(() => assertValidTableSuffix(s)).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import {
  collectionFieldsArraySchema,
  computeSchemaChangeFlags,
  isSafeTypeTransition,
  setsEqual,
} from "@/lib/collection-fields";

describe("isSafeTypeTransition", () => {
  it("allows same type", () => {
    expect(isSafeTypeTransition("text", "text")).toBe(true);
  });

  it("allows planned safe cross-type transitions", () => {
    expect(isSafeTypeTransition("text", "json")).toBe(true);
    expect(isSafeTypeTransition("number", "text")).toBe(true);
    expect(isSafeTypeTransition("boolean", "text")).toBe(true);
    expect(isSafeTypeTransition("date", "text")).toBe(true);
  });

  it("blocks unsafe transitions", () => {
    expect(isSafeTypeTransition("text", "number")).toBe(false);
    expect(isSafeTypeTransition("json", "text")).toBe(false);
    expect(isSafeTypeTransition("number", "boolean")).toBe(false);
  });
});

describe("computeSchemaChangeFlags", () => {
  const a = {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    name: "a",
    type: "text" as const,
    required: false,
    unique: false,
  };
  const b = {
    id: "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee",
    name: "b",
    type: "number" as const,
    required: false,
    unique: false,
  };

  it("detects removed field ids", () => {
    const flags = computeSchemaChangeFlags([a, b], [a]);
    expect(flags.removedFieldIds).toEqual([b.id]);
    expect(flags.unsafeTypeFieldIds).toEqual([]);
  });

  it("detects unsafe type changes for the same field id", () => {
    const changed = { ...a, type: "number" as const };
    const flags = computeSchemaChangeFlags([a], [changed]);
    expect(flags.removedFieldIds).toEqual([]);
    expect(flags.unsafeTypeFieldIds).toEqual([a.id]);
  });

  it("does not flag safe type transitions", () => {
    const changed = { ...a, type: "json" as const };
    const flags = computeSchemaChangeFlags([a], [changed]);
    expect(flags.unsafeTypeFieldIds).toEqual([]);
  });
});

describe("collectionFieldsArraySchema", () => {
  it("rejects duplicate field names", () => {
    const id = "cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee";
    const result = collectionFieldsArraySchema.safeParse([
      { id, name: "dup", type: "text", required: false, unique: false },
      { id: "dddddddd-bbbb-cccc-dddd-eeeeeeeeeeee", name: "dup", type: "text", required: false, unique: false },
    ]);
    expect(result.success).toBe(false);
  });
});

describe("setsEqual", () => {
  it("compares as sets", () => {
    expect(setsEqual(["a", "b"], ["b", "a"])).toBe(true);
    expect(setsEqual(["a"], ["a", "b"])).toBe(false);
  });
});

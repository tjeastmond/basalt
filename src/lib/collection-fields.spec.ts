import { describe, expect, it } from "vitest";

import {
  collectionFieldsArraySchema,
  computeSchemaChangeFlags,
  dedupeMachineNames,
  finalizeFieldDefinitions,
  humanizeFieldMachineName,
  isSafeTypeTransition,
  normalizeFieldMachineName,
  setsEqual,
} from "@/lib/collection-fields";

describe("humanizeFieldMachineName", () => {
  it("turns snake_case into title words", () => {
    expect(humanizeFieldMachineName("character_name")).toBe("Character Name");
    expect(humanizeFieldMachineName("post_title")).toBe("Post Title");
  });

  it("collapses repeated underscores", () => {
    expect(humanizeFieldMachineName("a__b")).toBe("A B");
  });

  it("sentence-cases a single segment", () => {
    expect(humanizeFieldMachineName("email")).toBe("Email");
    expect(humanizeFieldMachineName("SKU")).toBe("Sku");
  });
});

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
    id: "aaaaaaaa-bbbb-4ccc-a111-eeeeeeeeeeee",
    name: "a",
    type: "text" as const,
    required: false,
    unique: false,
  };
  const b = {
    id: "bbbbbbbb-bbbb-4ddd-b222-eeeeeeeeeeee",
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
    const id = "cccccccc-bbbb-4eee-c333-eeeeeeeeeeee";
    const result = collectionFieldsArraySchema.safeParse([
      { id, name: "dup", type: "text", required: false, unique: false },
      { id: "dddddddd-bbbb-4fff-d444-eeeeeeeeeeee", name: "dup", type: "text", required: false, unique: false },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects reserved system column names", () => {
    const id = "eeeeeeee-bbbb-4eee-e555-eeeeeeeeeeee";
    const result = collectionFieldsArraySchema.safeParse([
      { id, name: "id", type: "text", required: false, unique: false },
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

describe("normalizeFieldMachineName", () => {
  it("lowercases and replaces spaces", () => {
    expect(normalizeFieldMachineName("Post Title")).toBe("post_title");
  });

  it("prefixes when the first character is not a letter", () => {
    expect(normalizeFieldMachineName("123x")).toBe("f_123x");
  });
});

describe("dedupeMachineNames", () => {
  it("adds numeric suffixes for collisions", () => {
    expect(dedupeMachineNames(["title", "title", "title"])).toEqual(["title", "title_2", "title_3"]);
  });
});

describe("finalizeFieldDefinitions", () => {
  it("accepts human labels and produces strict names", () => {
    const id1 = "aaaaaaaa-bbbb-4ccc-a111-eeeeeeeeeeee";
    const id2 = "bbbbbbbb-bbbb-4ddd-b222-eeeeeeeeeeee";
    const out = finalizeFieldDefinitions([
      { id: id1, name: "Post Title", type: "text", required: false, unique: false },
      { id: id2, name: "Body (HTML)", type: "text", required: true, unique: false },
    ]);
    expect(out[0]!.name).toBe("post_title");
    expect(out[1]!.name).toBe("body_html");
  });
});

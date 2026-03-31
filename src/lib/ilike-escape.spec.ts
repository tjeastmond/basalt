import { describe, expect, it } from "vitest";

import { escapeIlikePattern } from "@/lib/ilike-escape";

describe("escapeIlikePattern", () => {
  it("escapes ILIKE metacharacters and backslash", () => {
    expect(escapeIlikePattern("100%")).toBe("100\\%");
    expect(escapeIlikePattern("a_b")).toBe("a\\_b");
    expect(escapeIlikePattern("a\\b")).toBe("a\\\\b");
  });
});

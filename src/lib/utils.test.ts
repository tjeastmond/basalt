import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("merges conflicting tailwind utilities", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("joins conditional classes", () => {
    expect(cn("base", false && "hidden", "block")).toBe("base block");
  });
});

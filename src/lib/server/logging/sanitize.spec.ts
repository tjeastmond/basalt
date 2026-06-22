import { hostFromUrl, serializeError } from "@/lib/server/logging/sanitize";
import { describe, expect, it } from "vitest";

describe("logging sanitize helpers", () => {
  it("extracts hostnames from urls", () => {
    expect(hostFromUrl("https://jobs.example.com/role/123")).toBe("jobs.example.com");
    expect(hostFromUrl("https://api.basalt.dev/v1/collections")).toBe("api.basalt.dev");
  });

  it("returns undefined for invalid urls", () => {
    expect(hostFromUrl("not-a-url")).toBeUndefined();
  });

  it("serializes errors", () => {
    const serialized = serializeError(new Error("boom"));
    expect(serialized.message).toBe("boom");
    expect(serialized.name).toBe("Error");
    expect(serialized.stack).toBeTruthy();
  });
});

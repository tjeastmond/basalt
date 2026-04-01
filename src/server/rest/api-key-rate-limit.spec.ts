import { afterEach, describe, expect, it, vi } from "vitest";

describe("api-key-rate-limit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("allows up to configured requests per window", async () => {
    vi.stubEnv("API_KEY_RATE_LIMIT_PER_MINUTE", "3");
    const { allowApiKeyRequest } = await import("@/server/rest/api-key-rate-limit");
    expect(allowApiKeyRequest("k1")).toBe(true);
    expect(allowApiKeyRequest("k1")).toBe(true);
    expect(allowApiKeyRequest("k1")).toBe(true);
    expect(allowApiKeyRequest("k1")).toBe(false);
    expect(allowApiKeyRequest("k2")).toBe(true);
  });
});

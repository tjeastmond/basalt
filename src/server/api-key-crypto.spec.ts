import { describe, expect, it } from "vitest";

import {
  apiKeyLookupPrefix,
  generateApiKeyPlaintext,
  hashApiKeySecret,
  looksLikeBasaltApiKeyToken,
  verifyApiKeySecret,
} from "@/server/api-key-crypto";

describe("api-key-crypto", () => {
  it("generates verifiable keys with stable lookup prefix", async () => {
    const secret = generateApiKeyPlaintext();
    expect(secret.startsWith("bslt_")).toBe(true);
    expect(looksLikeBasaltApiKeyToken(secret)).toBe(true);
    const { keyPrefix, keySalt, keyHash } = hashApiKeySecret(secret);
    expect(keyPrefix).toBe(apiKeyLookupPrefix(secret));
    expect(await verifyApiKeySecret(secret, keySalt, keyHash)).toBe(true);
    expect(await verifyApiKeySecret(`${secret}x`, keySalt, keyHash)).toBe(false);
  });

  it("rejects tokens that are too short for prefix lookup", () => {
    expect(looksLikeBasaltApiKeyToken("bslt_")).toBe(false);
  });

  it("rejects oversized or malformed bearer-shaped tokens", () => {
    const valid = generateApiKeyPlaintext();
    expect(looksLikeBasaltApiKeyToken(`${valid}${"x".repeat(20)}`)).toBe(false);
    expect(looksLikeBasaltApiKeyToken(`bslt_${"a".repeat(200)}`)).toBe(false);
    expect(looksLikeBasaltApiKeyToken(`bslt_${"!".repeat(32)}`)).toBe(false);
  });
});

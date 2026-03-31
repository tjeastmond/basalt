import { describe, expect, it } from "vitest";

import {
  apiKeyLookupPrefix,
  generateApiKeyPlaintext,
  hashApiKeySecret,
  looksLikeBasaltApiKeyToken,
  verifyApiKeySecret,
} from "@/server/api-key-crypto";

describe("api-key-crypto", () => {
  it("generates verifiable keys with stable lookup prefix", () => {
    const secret = generateApiKeyPlaintext();
    expect(secret.startsWith("bslt_")).toBe(true);
    expect(looksLikeBasaltApiKeyToken(secret)).toBe(true);
    const { keyPrefix, keySalt, keyHash } = hashApiKeySecret(secret);
    expect(keyPrefix).toBe(apiKeyLookupPrefix(secret));
    expect(verifyApiKeySecret(secret, keySalt, keyHash)).toBe(true);
    expect(verifyApiKeySecret(`${secret}x`, keySalt, keyHash)).toBe(false);
  });

  it("rejects tokens that are too short for prefix lookup", () => {
    expect(looksLikeBasaltApiKeyToken("bslt_")).toBe(false);
  });
});

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_PREFIX = "bslt_";
const PREFIX_LOOKUP_LEN = 16;
const SCRYPT_KEYLEN = 64;

export function generateApiKeyPlaintext(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function apiKeyLookupPrefix(plaintext: string): string {
  return plaintext.slice(0, PREFIX_LOOKUP_LEN);
}

export function hashApiKeySecret(plaintext: string): { keyPrefix: string; keySalt: string; keyHash: string } {
  const keyPrefix = apiKeyLookupPrefix(plaintext);
  const salt = randomBytes(16);
  const hash = scryptSync(plaintext, salt, SCRYPT_KEYLEN);
  return {
    keyPrefix,
    keySalt: salt.toString("base64"),
    keyHash: hash.toString("base64"),
  };
}

export function verifyApiKeySecret(plaintext: string, keySaltB64: string, keyHashB64: string): boolean {
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(keySaltB64, "base64");
    expected = Buffer.from(keyHashB64, "base64");
  } catch {
    return false;
  }
  if (expected.length !== SCRYPT_KEYLEN) {
    return false;
  }
  const derived = scryptSync(plaintext, salt, SCRYPT_KEYLEN);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function looksLikeBasaltApiKeyToken(token: string): boolean {
  return token.startsWith(KEY_PREFIX) && token.length >= PREFIX_LOOKUP_LEN;
}

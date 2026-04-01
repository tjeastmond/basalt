import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const KEY_PREFIX = "bslt_";
const PREFIX_LOOKUP_LEN = 16;
const SCRYPT_KEYLEN = 64;
/** 24 random bytes → 32 base64url chars after `bslt_`. */
const TOKEN_BODY_MIN_LEN = 32;
const TOKEN_BODY_MAX_LEN = 48;
const TOKEN_MAX_LEN = 128;
const BASE64URL_BODY = /^[a-zA-Z0-9_-]+$/;

const scryptAsync = promisify(scrypt);

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

export async function verifyApiKeySecret(plaintext: string, keySaltB64: string, keyHashB64: string): Promise<boolean> {
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
  try {
    const derived = (await scryptAsync(plaintext, salt, SCRYPT_KEYLEN)) as Buffer;
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function looksLikeBasaltApiKeyToken(token: string): boolean {
  if (token.length > TOKEN_MAX_LEN || !token.startsWith(KEY_PREFIX)) {
    return false;
  }
  const body = token.slice(KEY_PREFIX.length);
  if (body.length < TOKEN_BODY_MIN_LEN || body.length > TOKEN_BODY_MAX_LEN) {
    return false;
  }
  return BASE64URL_BODY.test(body);
}

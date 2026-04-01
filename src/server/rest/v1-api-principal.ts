import { and, eq, isNull } from "drizzle-orm";

import { accessLevels, apiKeys, db } from "@/db";
import type { AccessSlug } from "@/lib/access-level";
import { apiKeyLookupPrefix, looksLikeBasaltApiKeyToken, verifyApiKeySecret } from "@/server/api-key-crypto";

export type V1ApiPrincipal = {
  apiKeyId: string;
  accessSlug: AccessSlug;
  /** `null` means all collections; otherwise only these UUIDs. */
  allowedCollectionIds: string[] | null;
};

function isAccessSlug(value: string): value is AccessSlug {
  return value === "owner" || value === "admin" || value === "user";
}

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) {
    return null;
  }
  const m = authorization.match(/^Bearer\s+(\S+)/i);
  return m?.[1]?.trim() ?? null;
}

export async function resolveV1ApiPrincipal(request: Request): Promise<V1ApiPrincipal | null> {
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token || !looksLikeBasaltApiKeyToken(token)) {
    return null;
  }

  const prefix = apiKeyLookupPrefix(token);
  const [row] = await db
    .select({
      id: apiKeys.id,
      keySalt: apiKeys.keySalt,
      keyHash: apiKeys.keyHash,
      slug: accessLevels.slug,
      allowedCollectionIds: apiKeys.allowedCollectionIds,
    })
    .from(apiKeys)
    .innerJoin(accessLevels, eq(apiKeys.accessLevelId, accessLevels.id))
    .where(and(eq(apiKeys.keyPrefix, prefix), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row || !isAccessSlug(row.slug)) {
    return null;
  }

  if (!(await verifyApiKeySecret(token, row.keySalt, row.keyHash))) {
    return null;
  }

  const allowed = row.allowedCollectionIds;
  return {
    apiKeyId: row.id,
    accessSlug: row.slug,
    allowedCollectionIds: allowed === undefined ? null : allowed,
  };
}

export function v1PrincipalMayAccessCollection(principal: V1ApiPrincipal, collectionId: string): boolean {
  if (principal.allowedCollectionIds === null) {
    return true;
  }
  return principal.allowedCollectionIds.includes(collectionId);
}

export function v1PrincipalIsOwner(principal: V1ApiPrincipal): boolean {
  return principal.accessSlug === "owner";
}

export function v1PrincipalIsAdminOrOwner(principal: V1ApiPrincipal): boolean {
  return principal.accessSlug === "owner" || principal.accessSlug === "admin";
}

/** Record writes require admin or owner; user-level keys are read-only for data. */
export function v1PrincipalMayMutateRecords(principal: V1ApiPrincipal): boolean {
  return v1PrincipalIsAdminOrOwner(principal);
}

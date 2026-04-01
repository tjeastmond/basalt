import { eq } from "drizzle-orm";

import { collections, db } from "@/db";
import { collectionApiPermissionsSchema } from "@/lib/collection-api-permissions";
import { MAX_TABLE_SUFFIX_LENGTH } from "@/lib/collection-physical-table";
import { updateCollectionApiPermissionsBySlug } from "@/server/collection-admin-commands";
import { mapTrpcOrUnknownToV1Response } from "@/server/rest/map-trpc-to-v1";
import { v1PrincipalIsOwner, v1PrincipalMayAccessCollection } from "@/server/rest/v1-api-principal";
import { v1RequireApiKey } from "@/server/rest/v1-guard";
import { v1JsonError, v1JsonOk } from "@/server/rest/v1-json";

export const runtime = "nodejs";

const slugParamSchema = /^[a-z][a-z0-9_]*$/;

function isValidSlugSegment(slug: string): boolean {
  return slug.length > 0 && slug.length <= MAX_TABLE_SUFFIX_LENGTH && slugParamSchema.test(slug);
}

type RouteCtx = { params: Promise<{ slug: string }> };

export async function PATCH(request: Request, context: RouteCtx) {
  const guard = await v1RequireApiKey(request);
  if (guard instanceof Response) {
    return guard;
  }
  const { principal } = guard;
  if (!v1PrincipalIsOwner(principal)) {
    return v1JsonError(403, "FORBIDDEN", "Updating API permissions requires an Owner API key.");
  }

  const { slug } = await context.params;
  if (!isValidSlugSegment(slug)) {
    return v1JsonError(400, "VALIDATION_ERROR", "Invalid collection slug.");
  }

  const [row] = await db.select({ id: collections.id }).from(collections).where(eq(collections.slug, slug)).limit(1);
  if (!row) {
    return v1JsonError(404, "NOT_FOUND", "Collection not found.");
  }
  if (!v1PrincipalMayAccessCollection(principal, row.id)) {
    return v1JsonError(403, "FORBIDDEN", "This API key cannot access this collection.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return v1JsonError(400, "VALIDATION_ERROR", "Request body must be JSON.");
  }

  if (!body || typeof body !== "object") {
    return v1JsonError(400, "VALIDATION_ERROR", "Body must be an object.");
  }

  const raw = (body as Record<string, unknown>).apiPermissions;
  const parsed = collectionApiPermissionsSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(" ");
    return v1JsonError(400, "VALIDATION_ERROR", msg || "Invalid apiPermissions.");
  }

  try {
    const next = await updateCollectionApiPermissionsBySlug(slug, parsed.data);
    return v1JsonOk(200, { apiPermissions: next });
  } catch (e) {
    return mapTrpcOrUnknownToV1Response(e);
  }
}

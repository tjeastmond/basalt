import { asc } from "drizzle-orm";

import { collections, db } from "@/db";
import { normalizeCollectionApiPermissions } from "@/lib/collection-api-permissions";
import { collectionCreateInputSchema, createCollectionAsAdmin } from "@/server/collection-admin-commands";
import { mapTrpcOrUnknownToV1Response } from "@/server/rest/map-trpc-to-v1";
import {
  v1PrincipalIsAdminOrOwner,
  v1PrincipalIsOwner,
  v1PrincipalMayAccessCollection,
} from "@/server/rest/v1-api-principal";
import { v1RequireApiKey } from "@/server/rest/v1-guard";
import { v1JsonError, v1JsonOk } from "@/server/rest/v1-json";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await v1RequireApiKey(request);
  if (guard instanceof Response) {
    return guard;
  }
  const { principal } = guard;
  if (!v1PrincipalIsAdminOrOwner(principal)) {
    return v1JsonError(403, "FORBIDDEN", "This endpoint requires an Admin or Owner API key.");
  }

  const rows = await db
    .select({
      id: collections.id,
      slug: collections.slug,
      name: collections.name,
      apiPermissions: collections.apiPermissions,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
    })
    .from(collections)
    .orderBy(asc(collections.name));

  const filtered = rows.filter((r) => v1PrincipalMayAccessCollection(principal, r.id));

  return v1JsonOk(200, {
    collections: filtered.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      apiPermissions: normalizeCollectionApiPermissions(r.apiPermissions),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const guard = await v1RequireApiKey(request);
  if (guard instanceof Response) {
    return guard;
  }
  const { principal } = guard;
  if (!v1PrincipalIsOwner(principal)) {
    return v1JsonError(403, "FORBIDDEN", "Creating collections requires an Owner API key.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return v1JsonError(400, "VALIDATION_ERROR", "Request body must be JSON.");
  }

  const parsed = collectionCreateInputSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(" ");
    return v1JsonError(400, "VALIDATION_ERROR", msg || "Invalid body.");
  }

  if (principal.allowedCollectionIds !== null) {
    return v1JsonError(403, "FORBIDDEN", "API keys with a collection allowlist cannot create collections via the API.");
  }

  try {
    const row = await createCollectionAsAdmin(parsed.data);
    return v1JsonOk(201, {
      collection: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        tableSuffix: row.tableSuffix,
        fields: row.fields,
        apiPermissions: normalizeCollectionApiPermissions(row.apiPermissions),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (e) {
    return mapTrpcOrUnknownToV1Response(e);
  }
}

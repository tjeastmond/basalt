import { z } from "zod";

import { MAX_TABLE_SUFFIX_LENGTH } from "@/lib/collection-physical-table";
import {
  RecordValidationError,
  insertCollectionRecord,
  listCollectionRecords,
  loadCollectionTargetWithApiBySlug,
} from "@/server/collection-records";
import { mapTrpcOrUnknownToV1Response } from "@/server/rest/map-trpc-to-v1";
import { v1PrincipalMayAccessCollection, v1PrincipalMayMutateRecords } from "@/server/rest/v1-api-principal";
import { v1RequireApiKey } from "@/server/rest/v1-guard";
import { v1JsonError, v1JsonOk } from "@/server/rest/v1-json";

export const runtime = "nodejs";

const slugParamSchema = /^[a-z][a-z0-9_]*$/;

function isValidSlugSegment(slug: string): boolean {
  return slug.length > 0 && slug.length <= MAX_TABLE_SUFFIX_LENGTH && slugParamSchema.test(slug);
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(500).optional(),
  sortBy: z.string().max(63).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

type RouteCtx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteCtx) {
  const guard = await v1RequireApiKey(request);
  if (guard instanceof Response) {
    return guard;
  }
  const { principal } = guard;

  const { slug } = await context.params;
  if (!isValidSlugSegment(slug)) {
    return v1JsonError(400, "VALIDATION_ERROR", "Invalid collection slug.");
  }

  const target = await loadCollectionTargetWithApiBySlug(slug);
  if (!target) {
    return v1JsonError(404, "NOT_FOUND", "Collection not found.");
  }
  if (!v1PrincipalMayAccessCollection(principal, target.collectionId)) {
    return v1JsonError(403, "FORBIDDEN", "This API key cannot access this collection.");
  }
  if (!target.apiPermissions.read) {
    return v1JsonError(403, "FORBIDDEN", "API read is disabled for this collection.");
  }

  const url = new URL(request.url);
  const q = listQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!q.success) {
    const msg = q.error.issues.map((i) => i.message).join(" ");
    return v1JsonError(400, "VALIDATION_ERROR", msg || "Invalid query.");
  }

  const page = q.data.page ?? 1;
  const pageSize = q.data.pageSize ?? 25;
  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  try {
    const result = await listCollectionRecords(target, {
      limit,
      offset,
      search: q.data.search,
      sortBy: q.data.sortBy,
      sortDir: q.data.sortDir ?? "desc",
    });
    return v1JsonOk(200, {
      page,
      pageSize,
      total: result.total,
      records: result.rows,
    });
  } catch (e) {
    if (e instanceof RecordValidationError) {
      return v1JsonError(400, "VALIDATION_ERROR", e.message);
    }
    return mapTrpcOrUnknownToV1Response(e);
  }
}

export async function POST(request: Request, context: RouteCtx) {
  const guard = await v1RequireApiKey(request);
  if (guard instanceof Response) {
    return guard;
  }
  const { principal } = guard;

  if (!v1PrincipalMayMutateRecords(principal)) {
    return v1JsonError(403, "FORBIDDEN", "Record create requires an Admin or Owner API key.");
  }

  const { slug } = await context.params;
  if (!isValidSlugSegment(slug)) {
    return v1JsonError(400, "VALIDATION_ERROR", "Invalid collection slug.");
  }

  const target = await loadCollectionTargetWithApiBySlug(slug);
  if (!target) {
    return v1JsonError(404, "NOT_FOUND", "Collection not found.");
  }
  if (!v1PrincipalMayAccessCollection(principal, target.collectionId)) {
    return v1JsonError(403, "FORBIDDEN", "This API key cannot access this collection.");
  }
  if (!target.apiPermissions.create) {
    return v1JsonError(403, "FORBIDDEN", "API create is disabled for this collection.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return v1JsonError(400, "VALIDATION_ERROR", "Request body must be JSON.");
  }

  const values =
    body && typeof body === "object" && !Array.isArray(body) && "values" in body
      ? (body as { values: unknown }).values
      : body;

  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return v1JsonError(400, "VALIDATION_ERROR", "Body must be an object of field values, or { values: object }.");
  }

  try {
    const row = await insertCollectionRecord(target, values as Record<string, unknown>);
    return v1JsonOk(201, { record: row });
  } catch (e) {
    if (e instanceof RecordValidationError) {
      return v1JsonError(400, "VALIDATION_ERROR", e.message);
    }
    return mapTrpcOrUnknownToV1Response(e);
  }
}

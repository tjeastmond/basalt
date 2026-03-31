import { MAX_TABLE_SUFFIX_LENGTH } from "@/lib/collection-physical-table";
import { RecordValidationError } from "@/server/collection-records";
import {
  deleteCollectionRecord,
  getCollectionRecord,
  loadCollectionTargetWithApiBySlug,
  updateCollectionRecord,
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

const uuidSchema = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteCtx = { params: Promise<{ slug: string; recordId: string }> };

export async function GET(request: Request, context: RouteCtx) {
  const guard = await v1RequireApiKey(request);
  if (guard instanceof Response) {
    return guard;
  }
  const { principal } = guard;

  const { slug, recordId } = await context.params;
  if (!isValidSlugSegment(slug)) {
    return v1JsonError(400, "VALIDATION_ERROR", "Invalid collection slug.");
  }
  if (!uuidSchema.test(recordId)) {
    return v1JsonError(400, "VALIDATION_ERROR", "Invalid record id.");
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

  try {
    const row = await getCollectionRecord(target, recordId);
    if (!row) {
      return v1JsonError(404, "NOT_FOUND", "Record not found.");
    }
    return v1JsonOk(200, { record: row });
  } catch (e) {
    return mapTrpcOrUnknownToV1Response(e);
  }
}

export async function PATCH(request: Request, context: RouteCtx) {
  const guard = await v1RequireApiKey(request);
  if (guard instanceof Response) {
    return guard;
  }
  const { principal } = guard;

  if (!v1PrincipalMayMutateRecords(principal)) {
    return v1JsonError(403, "FORBIDDEN", "Record update requires an Admin or Owner API key.");
  }

  const { slug, recordId } = await context.params;
  if (!isValidSlugSegment(slug)) {
    return v1JsonError(400, "VALIDATION_ERROR", "Invalid collection slug.");
  }
  if (!uuidSchema.test(recordId)) {
    return v1JsonError(400, "VALIDATION_ERROR", "Invalid record id.");
  }

  const target = await loadCollectionTargetWithApiBySlug(slug);
  if (!target) {
    return v1JsonError(404, "NOT_FOUND", "Collection not found.");
  }
  if (!v1PrincipalMayAccessCollection(principal, target.collectionId)) {
    return v1JsonError(403, "FORBIDDEN", "This API key cannot access this collection.");
  }
  if (!target.apiPermissions.update) {
    return v1JsonError(403, "FORBIDDEN", "API update is disabled for this collection.");
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
    const row = await updateCollectionRecord(target, recordId, values as Record<string, unknown>);
    if (!row) {
      return v1JsonError(404, "NOT_FOUND", "Record not found.");
    }
    return v1JsonOk(200, { record: row });
  } catch (e) {
    if (e instanceof RecordValidationError) {
      return v1JsonError(400, "VALIDATION_ERROR", e.message);
    }
    return mapTrpcOrUnknownToV1Response(e);
  }
}

export async function DELETE(request: Request, context: RouteCtx) {
  const guard = await v1RequireApiKey(request);
  if (guard instanceof Response) {
    return guard;
  }
  const { principal } = guard;

  if (!v1PrincipalMayMutateRecords(principal)) {
    return v1JsonError(403, "FORBIDDEN", "Record delete requires an Admin or Owner API key.");
  }

  const { slug, recordId } = await context.params;
  if (!isValidSlugSegment(slug)) {
    return v1JsonError(400, "VALIDATION_ERROR", "Invalid collection slug.");
  }
  if (!uuidSchema.test(recordId)) {
    return v1JsonError(400, "VALIDATION_ERROR", "Invalid record id.");
  }

  const target = await loadCollectionTargetWithApiBySlug(slug);
  if (!target) {
    return v1JsonError(404, "NOT_FOUND", "Collection not found.");
  }
  if (!v1PrincipalMayAccessCollection(principal, target.collectionId)) {
    return v1JsonError(403, "FORBIDDEN", "This API key cannot access this collection.");
  }
  if (!target.apiPermissions.delete) {
    return v1JsonError(403, "FORBIDDEN", "API delete is disabled for this collection.");
  }

  try {
    const ok = await deleteCollectionRecord(target, recordId);
    if (!ok) {
      return v1JsonError(404, "NOT_FOUND", "Record not found.");
    }
    return v1JsonOk(200, { ok: true as const });
  } catch (e) {
    return mapTrpcOrUnknownToV1Response(e);
  }
}

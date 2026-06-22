import { TRPCError } from "@trpc/server";
import type { NextResponse } from "next/server";

import { log } from "@/lib/server/logging/logger";
import { v1JsonError, type V1ErrorBody } from "@/server/rest/v1-json";

const INTERNAL_MSG = "An unexpected error occurred.";

function logV1InternalError(e: unknown): void {
  log.errorFromUnknown(e, { route: "api/v1" });
}

export function mapTrpcOrUnknownToV1Response(e: unknown): NextResponse<V1ErrorBody> {
  if (e instanceof TRPCError) {
    switch (e.code) {
      case "NOT_FOUND":
        return v1JsonError(404, "NOT_FOUND", e.message);
      case "CONFLICT":
        return v1JsonError(409, "CONFLICT", e.message);
      case "BAD_REQUEST":
        return v1JsonError(400, "VALIDATION_ERROR", e.message);
      case "FORBIDDEN":
        return v1JsonError(403, "FORBIDDEN", e.message);
      case "UNAUTHORIZED":
        return v1JsonError(401, "UNAUTHORIZED", e.message);
      default:
        logV1InternalError(e);
        return v1JsonError(500, "INTERNAL_ERROR", INTERNAL_MSG);
    }
  }
  logV1InternalError(e);
  return v1JsonError(500, "INTERNAL_ERROR", INTERNAL_MSG);
}

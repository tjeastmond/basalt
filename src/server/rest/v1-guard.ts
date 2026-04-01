import { allowApiKeyRequest, allowV1RequestForClient, v1ClientRateLimitKey } from "@/server/rest/api-key-rate-limit";
import { resolveV1ApiPrincipal, type V1ApiPrincipal } from "@/server/rest/v1-api-principal";
import { v1JsonError, type V1ErrorBody } from "@/server/rest/v1-json";
import type { NextResponse } from "next/server";

export type V1GuardOk = { principal: V1ApiPrincipal };

export async function v1RequireApiKey(request: Request): Promise<V1GuardOk | NextResponse<V1ErrorBody>> {
  if (!allowV1RequestForClient(v1ClientRateLimitKey(request))) {
    return v1JsonError(429, "RATE_LIMITED", "Too many requests.");
  }
  const principal = await resolveV1ApiPrincipal(request);
  if (!principal) {
    return v1JsonError(401, "UNAUTHORIZED", "Missing or invalid API key.");
  }
  if (!allowApiKeyRequest(principal.apiKeyId)) {
    return v1JsonError(429, "RATE_LIMITED", "Too many requests for this API key.");
  }
  return { principal };
}

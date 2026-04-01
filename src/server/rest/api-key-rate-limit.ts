const WINDOW_MS = 60_000;
/** Drop bucket entries this long after their window started (amortized cleanup). */
const STALE_MS = WINDOW_MS * 2;
const MAX_BUCKETS = 20_000;

/**
 * In-process fixed-window counters only: limits are not shared across Node instances.
 * For a global cap in production, put a reverse proxy or Redis-backed limiter in front.
 */
function limitPerMinute(): number {
  const raw = process.env.API_KEY_RATE_LIMIT_PER_MINUTE;
  const n = raw === undefined || raw === "" ? 120 : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120;
}

function limitPerIpPerMinute(): number {
  const raw = process.env.API_V1_RATE_LIMIT_PER_IP_PER_MINUTE;
  const n = raw === undefined || raw === "" ? 600 : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 600;
}

type Bucket = { windowStart: number; count: number };

const buckets = new Map<string, Bucket>();
const ipBuckets = new Map<string, Bucket>();

let sweepTick = 0;

function pruneStaleEntries(map: Map<string, Bucket>, now: number): void {
  for (const [k, b] of map) {
    if (now - b.windowStart >= STALE_MS) {
      map.delete(k);
    }
  }
}

function pruneIfNeeded(map: Map<string, Bucket>, now: number): void {
  sweepTick += 1;
  if (map.size > 500 && sweepTick % 64 === 0) {
    pruneStaleEntries(map, now);
  }
  if (map.size < MAX_BUCKETS * 0.9) {
    return;
  }
  pruneStaleEntries(map, now);
  if (map.size <= MAX_BUCKETS) {
    return;
  }
  let removed = 0;
  const over = map.size - MAX_BUCKETS;
  for (const k of map.keys()) {
    map.delete(k);
    removed += 1;
    if (removed >= over) {
      break;
    }
  }
}

function allowInWindow(map: Map<string, Bucket>, key: string, limit: number, now: number): boolean {
  pruneIfNeeded(map, now);
  const b = map.get(key);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    map.set(key, { windowStart: now, count: 1 });
    return true;
  }
  if (b.count >= limit) {
    return false;
  }
  b.count += 1;
  return true;
}

/** Fixed-window counter per API key id. Returns false when over limit. */
export function allowApiKeyRequest(apiKeyId: string): boolean {
  const limit = limitPerMinute();
  const now = Date.now();
  return allowInWindow(buckets, apiKeyId, limit, now);
}

/**
 * Applies before API key resolution so unauthenticated floods still hit a per-client cap.
 * Key is typically client IP (see `v1ClientRateLimitKey`).
 */
export function allowV1RequestForClient(clientKey: string): boolean {
  const limit = limitPerIpPerMinute();
  const now = Date.now();
  return allowInWindow(ipBuckets, clientKey, limit, now);
}

export function v1ClientRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return `ip:${first}`;
    }
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return `ip:${realIp}`;
  }
  return "ip:unknown";
}

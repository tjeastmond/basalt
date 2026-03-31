const WINDOW_MS = 60_000;

function limitPerMinute(): number {
  const raw = process.env.API_KEY_RATE_LIMIT_PER_MINUTE;
  const n = raw === undefined || raw === "" ? 120 : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120;
}

type Bucket = { windowStart: number; count: number };

const buckets = new Map<string, Bucket>();

/** Fixed-window counter per API key id. Returns false when over limit. */
export function allowApiKeyRequest(apiKeyId: string): boolean {
  const limit = limitPerMinute();
  const now = Date.now();
  const b = buckets.get(apiKeyId);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    buckets.set(apiKeyId, { windowStart: now, count: 1 });
    return true;
  }
  if (b.count >= limit) {
    return false;
  }
  b.count += 1;
  return true;
}

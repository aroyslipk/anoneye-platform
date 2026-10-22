/**
 * In-process fixed-window rate limiter.
 *
 * This is the correct default for a single Node.js instance and for local
 * development. A horizontally scaled deployment must replace the store with a
 * shared one (for example Upstash Redis) — see docs/SECURITY.md. Limits are
 * enforced on the server; the UI never receives a client-side bypass.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 20_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    // Still oversized (many live clients): drop oldest insertions.
    if (buckets.size > MAX_BUCKETS) {
      let excess = buckets.size - MAX_BUCKETS;
      for (const bucketKey of buckets.keys()) {
        buckets.delete(bucketKey);
        if (--excess <= 0) break;
      }
    }
  }

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  current.count += 1;
  const allowed = current.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}

/**
 * Client IP used only as a rate-limit key, never for authorization.
 * Hosting proxies set these headers; direct clients can spoof them, so a
 * shared limiter should also key on user id where available.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return (
    headers.get("cf-connecting-ip")?.trim().slice(0, 64) ||
    headers.get("x-real-ip")?.trim().slice(0, 64) ||
    "unknown"
  );
}

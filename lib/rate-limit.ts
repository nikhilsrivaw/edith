/**
 * Best-effort in-memory rate limiter. Works on single-instance dev + small
 * Vercel deployments. For real scale: Upstash Redis + sliding window.
 *
 * Keys are usually `${ip}:${route}` or `${userId}:${route}`.
 */
import "server-only";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const DEFAULT_WINDOW_MS = 60_000; // 1 minute

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number = DEFAULT_WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return {
    ok: true,
    remaining: limit - bucket.count,
    resetAt: bucket.resetAt,
  };
}

/** Periodically purge old buckets so the Map doesn't grow forever. */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(
    () => {
      const now = Date.now();
      for (const [k, b] of buckets.entries()) {
        if (b.resetAt < now) buckets.delete(k);
      }
    },
    5 * 60_000,
  );
  // Node should let the process exit even if the timer's still scheduled.
  if (cleanupTimer.unref) cleanupTimer.unref();
}
ensureCleanup();

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Build a standard 429 response with the right headers. */
export function rateLimited(result: RateLimitResult) {
  const retryAfter = Math.max(1, Math.round((result.resetAt - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: "Too many requests. Slow down.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(result.resetAt),
      },
    },
  );
}

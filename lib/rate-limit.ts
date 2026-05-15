// In-memory per-session rate limiter.
//
// Note: on a serverless platform like Vercel, each function invocation may
// run in a separate process. This limiter is therefore best-effort and only
// constrains traffic within a warm container. Across-container limits would
// require an external store (e.g., Vercel KV). For our threat model, this is
// sufficient to make sustained industrial-scale abuse impractical without
// adding infrastructure complexity.

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_SESSION = 200;

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

export function checkAndIncrement(sessionId: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  let bucket = buckets.get(sessionId);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    buckets.set(sessionId, bucket);
  }
  if (bucket.count >= MAX_REQUESTS_PER_SESSION) {
    const retryAfter = Math.ceil(
      (bucket.windowStart + WINDOW_MS - now) / 1000
    );
    return { allowed: false, retryAfterSeconds: Math.max(retryAfter, 1) };
  }
  bucket.count++;

  // Opportunistic cleanup of expired buckets to bound memory growth.
  if (buckets.size > 1000) {
    for (const [k, v] of buckets.entries()) {
      if (now - v.windowStart > WINDOW_MS) buckets.delete(k);
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

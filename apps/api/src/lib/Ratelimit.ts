// src/lib/rateLimit.ts
// Sliding-window in-memory rate limiter.
// Keyed by an arbitrary string (e.g. "login:ip", "forgot:email").
//
// For a multi-instance deployment you'd replace this with a Redis-backed
// store, but for a single Render instance this is sufficient.

const _windows = new Map<string, number[]>();

// Prune stale buckets every 10 min to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of _windows) {
    // Keep only buckets that still have recent hits
    const fresh = hits.filter((t) => t > now - 15 * 60 * 1000);
    if (fresh.length === 0) _windows.delete(key);
    else _windows.set(key, fresh);
  }
}, 10 * 60 * 1000).unref();

/**
 * Returns `true` if the request is allowed, `false` if it should be blocked.
 *
 * @param key       Unique key for this limiter bucket (e.g. "login:127.0.0.1")
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window length in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;

  const hits = (_windows.get(key) ?? []).filter((t) => t > windowStart);

  if (hits.length >= limit) return false; // blocked

  hits.push(now);
  _windows.set(key, hits);
  return true; // allowed
}

// Pre-built configs for common endpoints
export const LIMITS = {
  // 10 login attempts per IP per 15 min
  LOGIN: { limit: 10, windowMs: 15 * 60 * 1000 },
  // 5 forgot-password requests per IP per hour
  FORGOT_PASSWORD: { limit: 5, windowMs: 60 * 60 * 1000 },
  // 10 reset-password attempts per token per hour
  RESET_PASSWORD: { limit: 10, windowMs: 60 * 60 * 1000 },
  // 20 register attempts per IP per hour
  REGISTER: { limit: 20, windowMs: 60 * 60 * 1000 },
} as const;
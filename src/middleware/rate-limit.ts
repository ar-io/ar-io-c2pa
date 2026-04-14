/**
 * Minimal in-memory per-IP rate limiter.
 *
 * Token-bucket semantics: each bucket holds `capacity` tokens that refill at
 * `capacity / windowMs` tokens per ms. Every request consumes one token;
 * if the bucket is empty, the request is rejected with 429.
 *
 * Limits are intentionally per-process — this service is deployed one node
 * per gateway, so a shared Redis-backed limiter isn't worth the dependency.
 * The map is bounded to 10k entries to prevent memory growth from unique-IP
 * flood; oldest entries are evicted when the cap is hit.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { logger } from '../utils/logger.js';

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const MAX_TRACKED_IPS = 10_000;

export interface RateLimitOptions {
  /** Number of requests permitted per window. */
  capacity: number;
  /** Window length in ms. Tokens refill linearly across the window. */
  windowMs: number;
  /** Optional tag for logs/headers. */
  name?: string;
}

export function createRateLimiter(opts: RateLimitOptions): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();
  const refillRatePerMs = opts.capacity / opts.windowMs;

  return async (c, next) => {
    const key = clientKey(c);
    const now = Date.now();

    const bucket = buckets.get(key) ?? { tokens: opts.capacity, lastRefillMs: now };
    buckets.delete(key); // re-insert at tail for LRU-style eviction

    const elapsed = now - bucket.lastRefillMs;
    bucket.tokens = Math.min(opts.capacity, bucket.tokens + elapsed * refillRatePerMs);
    bucket.lastRefillMs = now;

    if (bucket.tokens < 1) {
      // Put the bucket back before short-circuiting so the next request still
      // sees the refill state.
      buckets.set(key, bucket);
      const retryAfterMs = Math.ceil((1 - bucket.tokens) / refillRatePerMs);
      const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
      logger.warn({ ip: key, route: opts.name, retryAfterSec }, 'Rate limit exceeded');
      c.header('Retry-After', String(retryAfterSec));
      return c.json({ success: false, error: 'Too many requests' }, 429);
    }

    bucket.tokens -= 1;
    buckets.set(key, bucket);

    if (buckets.size > MAX_TRACKED_IPS) {
      const oldest = buckets.keys().next().value;
      if (oldest) buckets.delete(oldest);
    }

    await next();
  };
}

function clientKey(c: Context): string {
  // Trust the first hop of x-forwarded-for only — anything beyond that is
  // forgeable by the client. For environments behind nginx (the compose
  // setup in this repo), the first entry is the real client IP.
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = c.req.header('x-real-ip');
  if (real) return real.trim();
  // Fall back to a constant when we can't determine the client — limits
  // still apply, just globally for that bucket.
  return 'unknown';
}

/**
 * CRDT Token Rate Limiter (in-process, per-user).
 *
 * Mirrors the auth-service login rate limiter pattern (in-process Map
 * keyed by identifier, sliding window, prune on check). The CRDT token
 * endpoint is authenticated, so the natural key is userId (not IP).
 *
 * Default: 60 requests per user per 60-second window. Typical client
 * refresh is every 4.5 min (TTL 5 min minus 30s buffer); even 10 tabs
 * produce only ~10 requests per 5 minutes, so 60/min is generous.
 *
 * This is a web-only module (in-process state does not survive
 * serverless cold starts). Acceptable for single-node Dokploy
 * deployment; swap to Redis when the deployment topology changes.
 */

// ── Constants ────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60;

// ── In-process counter map ───────────────────────────────────────────

const counters = new Map<
  string,
  { count: number; windowStart: number }
>();

// ── Service ──────────────────────────────────────────────────────────

export const crdtRateLimit = {
  /**
   * Check whether a user is within the rate limit window.
   *
   * Returns `{ allowed: true }` when the request may proceed, or
   * `{ allowed: false, retryAfterMs }` when the limit is exceeded.
   *
   * Also prunes stale entries on each call to prevent unbounded
   * memory growth (same pattern as auth-service login rate limiter).
   */
  check(userId: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const now = Date.now();

    // Prune stale entries
    for (const [key, entry] of counters) {
      if (entry.windowStart + RATE_LIMIT_WINDOW_MS < now) {
        counters.delete(key);
      }
    }

    const entry = counters.get(userId);
    if (!entry) {
      return { allowed: true };
    }

    if (entry.windowStart + RATE_LIMIT_WINDOW_MS < now) {
      counters.delete(userId);
      return { allowed: true };
    }

    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
      const retryAfterMs = entry.windowStart + RATE_LIMIT_WINDOW_MS - now;
      return { allowed: false, retryAfterMs };
    }

    return { allowed: true };
  },

  /**
   * Record a successful token request for rate limiting.
   * Call this AFTER the token has been issued.
   */
  record(userId: string): void {
    const now = Date.now();
    const existing = counters.get(userId);

    if (existing && existing.windowStart + RATE_LIMIT_WINDOW_MS > now) {
      existing.count += 1;
    } else {
      counters.set(userId, { count: 1, windowStart: now });
    }
  },
};

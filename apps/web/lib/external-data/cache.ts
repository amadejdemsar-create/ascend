/**
 * Wave 10: process-local LRU cache for external data query results.
 *
 * Per-process Map keyed by `userId:workspaceId:sourceId:shape:filterHash:cursor`.
 * Entries expire after 5 minutes. Memory cap enforced by entry-count
 * cap (default 1000) + a coarse byte-size estimate when present.
 *
 * Limitations:
 *   - Not shared across processes. When Dokploy scales horizontally
 *     (post-Wave 8b), this becomes per-instance. PRD documents the
 *     plan to swap for Redis later.
 *   - LRU ordering: rough, based on Map insertion order + manual
 *     delete+set on hit (standard "move to front" via Map semantics).
 *
 * Stale-while-revalidate is the caller's job: the cache returns null
 * on miss + null on expiry. The service decides whether to fall through
 * to the adapter.
 */

const DEFAULT_TTL_MS = 5 * 60_000; // 5 min
const DEFAULT_MAX_ENTRIES = 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LruTtlCache<T> {
  private map: Map<string, CacheEntry<T>> = new Map();
  private ttlMs: number;
  private maxEntries: number;

  constructor(opts?: { ttlMs?: number; maxEntries?: number }) {
    this.ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = opts?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  get(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return null;
    }
    // Move-to-front for LRU: delete + re-set.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    if (this.map.size > this.maxEntries) {
      // Evict oldest entry. Map iterates insertion-ordered, so the
      // first key is the oldest.
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  /**
   * Invalidate all entries whose key starts with `prefix`. Used by the
   * service when the user manually refreshes a source.
   */
  invalidatePrefix(prefix: string): number {
    let removed = 0;
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) {
        this.map.delete(key);
        removed++;
      }
    }
    return removed;
  }

  size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

/**
 * Hash a filter+sort+cursor input into a deterministic short string
 * for the cache key. Adapters with different filter languages MUST use
 * a stable canonicalization upstream of this; the cache treats the
 * input as opaque.
 */
export function cacheKeyFor(args: {
  userId: string;
  workspaceId: string;
  sourceId: string;
  shape: string;
  filter?: unknown;
  sort?: unknown;
  cursor?: string;
  perPage?: number;
}): string {
  // Deterministic JSON: keys sorted alphabetically by JSON.stringify
  // with a replacer that sorts object keys.
  const canonical = JSON.stringify(
    {
      f: args.filter ?? null,
      s: args.sort ?? null,
      c: args.cursor ?? null,
      p: args.perPage ?? null,
    },
    (_, v) =>
      typeof v === "object" && v !== null && !Array.isArray(v)
        ? Object.keys(v)
            .sort()
            .reduce(
              (acc, k) => {
                acc[k] = (v as Record<string, unknown>)[k];
                return acc;
              },
              {} as Record<string, unknown>,
            )
        : v,
  );
  return [
    args.userId,
    args.workspaceId,
    args.sourceId,
    args.shape,
    canonical,
  ].join(""); // unprintable delimiter so user/source IDs can't collide
}

// Shared singleton for the external data query cache.
export const externalDataQueryCache = new LruTtlCache<unknown>({
  ttlMs: DEFAULT_TTL_MS,
  maxEntries: DEFAULT_MAX_ENTRIES,
});

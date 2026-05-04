"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────

interface RelationEntry {
  id: string;
  title: string;
  databaseName?: string;
}

interface SearchResult {
  id: string;
  title: string;
  type?: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * Returns a stable `onSearch` callback and a `useResolvedEntries` sub-hook
 * for use by RELATION cells in the Table view.
 *
 * - `onSearch` hits GET /api/context/search?q=<query>&mode=text&limit=20
 *   and returns matching entries as { id, title }.
 * - `resolvedEntries` resolves a list of entry IDs to their titles using
 *   a batch query (GET /api/context?ids=<csv> if available, else individual fetches).
 */
export function useRelationSearch() {
  const onSearch = useCallback(
    async (query: string): Promise<RelationEntry[]> => {
      if (!query.trim()) return [];
      try {
        const results = await apiFetch<SearchResult[]>(
          `/api/context/search?q=${encodeURIComponent(query)}&mode=text&limit=20`,
        );
        return results.map((r) => ({
          id: r.id,
          title: r.title,
        }));
      } catch {
        return [];
      }
    },
    [],
  );

  return onSearch;
}

/**
 * Resolves an array of entry IDs to their titles. Uses a single query
 * that fetches all needed entries. Cached with a 60s stale time.
 *
 * Returns the resolved entries matching the given IDs.
 */
export function useResolvedEntries(entryIds: string[]): RelationEntry[] {
  // Sort IDs for stable cache key.
  const sortedIds = useMemo(
    () => [...new Set(entryIds)].filter(Boolean).sort(),
    [entryIds],
  );

  const cacheKey = sortedIds.join(",");

  const { data } = useQuery<RelationEntry[]>({
    queryKey: ["context", "resolve-titles", cacheKey],
    queryFn: async () => {
      if (sortedIds.length === 0) return [];
      // Fetch each entry title individually. This uses the context detail
      // endpoint. In a future optimization, a batch endpoint can replace this.
      const results = await Promise.all(
        sortedIds.map(async (id) => {
          try {
            const entry = await apiFetch<{ id: string; title: string }>(
              `/api/context/${id}`,
            );
            return { id: entry.id, title: entry.title };
          } catch {
            return { id, title: id.slice(0, 8) + "..." };
          }
        }),
      );
      return results;
    },
    enabled: sortedIds.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  return data ?? [];
}

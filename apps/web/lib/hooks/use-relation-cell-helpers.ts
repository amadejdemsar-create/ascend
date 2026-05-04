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

interface DatabaseRowResult {
  id: string;
  entryId: string;
  properties: Record<string, unknown>;
}

interface DatabaseRowsPageResult {
  rows: DatabaseRowResult[];
  total: number;
}

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * Returns a stable `onSearch` callback for use by RELATION cells.
 *
 * When `targetDatabaseId` and `targetPrimaryFieldId` are provided, search is
 * scoped to the target database's rows using a text-contains filter on the
 * primary field. Otherwise, falls back to the unscoped context search.
 */
export function useRelationSearch(
  targetDatabaseId?: string | null,
  targetPrimaryFieldId?: string | null,
) {
  const onSearch = useCallback(
    async (query: string): Promise<RelationEntry[]> => {
      if (!query.trim()) return [];

      try {
        // Scoped search: query the target database's rows directly.
        if (targetDatabaseId && targetPrimaryFieldId) {
          const filter = JSON.stringify({
            combinator: "AND",
            clauses: [
              {
                type: "field",
                fieldId: targetPrimaryFieldId,
                op: "contains",
                value: query.trim(),
              },
            ],
          });
          const params = new URLSearchParams({
            filter,
            perPage: "20",
          });
          const result = await apiFetch<DatabaseRowsPageResult>(
            `/api/databases/${targetDatabaseId}/rows?${params.toString()}`,
          );
          return result.rows.map((r) => {
            const title = r.properties[targetPrimaryFieldId];
            return {
              id: r.entryId,
              title:
                typeof title === "string" && title.trim()
                  ? title
                  : "(Untitled)",
            };
          });
        }

        // Fallback: unscoped context search.
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
    [targetDatabaseId, targetPrimaryFieldId],
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

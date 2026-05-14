"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/queries/keys";
import { fireFirstRowConfetti } from "@/lib/confetti";

// ---------------------------------------------------------------------------
// Relation Backlinks
// ---------------------------------------------------------------------------

export interface RelationBacklinkGroup {
  fieldId: string;
  fieldName: string;
  databaseId: string;
  databaseName: string;
  rows: Array<{ entryId: string; title: string }>;
}

/**
 * Fetch incoming DATABASE_RELATION links for a row's entry, grouped by
 * source database and field.
 */
export function useRelationBacklinks(rowEntryId: string) {
  return useQuery({
    queryKey: ["databases", "relation-backlinks", rowEntryId],
    queryFn: () =>
      apiFetch<RelationBacklinkGroup[]>(
        `/api/databases/relation-backlinks/${rowEntryId}`,
      ),
    enabled: !!rowEntryId,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DatabaseRowResponse {
  id: string;
  databaseId: string;
  entryId: string;
  properties: Record<string, unknown>;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseRowsPage {
  rows: DatabaseRowResponse[];
  total: number;
  page: number;
  perPage: number;
}

export interface RowQueryOptions {
  viewId?: string;
  filter?: Record<string, unknown>;
  sort?: Array<{ fieldId: string; direction: "asc" | "desc" }>;
  page?: number;
  perPage?: number;
}

// ---------------------------------------------------------------------------
// Stable hash for query key differentiation
// ---------------------------------------------------------------------------

/**
 * Produce a stable string hash of row query options so React Query caches
 * different filter/sort/page combinations separately.
 *
 * Normalizes by: sorting object keys alphabetically, dropping undefined
 * values, and using JSON.stringify on the cleaned object.
 */
function stableHash(options?: RowQueryOptions): string | undefined {
  if (!options) return undefined;

  // Drop undefined values and sort keys for stability.
  const cleaned: Record<string, unknown> = {};
  const keys = Object.keys(options).sort();
  for (const key of keys) {
    const value = (options as Record<string, unknown>)[key];
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }

  // Empty object means no filters applied; return undefined so the query
  // key collapses to the shorter prefix form.
  if (Object.keys(cleaned).length === 0) return undefined;

  return JSON.stringify(cleaned);
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch paginated, filtered, sorted rows for a database.
 *
 * The query key includes a stable hash of the options so React Query caches
 * each unique filter/sort/page combination independently.
 *
 * staleTime: 30s, gcTime: 5 min (rows change frequently during editing).
 */
export function useDatabaseRows(
  databaseId: string,
  options?: RowQueryOptions,
) {
  const queryHash = stableHash(options);

  return useQuery({
    queryKey: queryKeys.databases.rows(databaseId, queryHash),
    queryFn: () => {
      const params = new URLSearchParams();
      if (options?.viewId) params.set("viewId", options.viewId);
      if (options?.filter) {
        params.set("filter", JSON.stringify(options.filter));
      }
      if (options?.sort) {
        params.set("sort", JSON.stringify(options.sort));
      }
      if (options?.page != null) params.set("page", String(options.page));
      if (options?.perPage != null) {
        params.set("perPage", String(options.perPage));
      }
      const qs = params.toString();
      return apiFetch<DatabaseRowsPage>(
        `/api/databases/${databaseId}/rows${qs ? `?${qs}` : ""}`,
      );
    },
    enabled: !!databaseId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

export interface CreateRowInput {
  properties?: Record<string, unknown>;
}

/**
 * Create a new row in a database.
 *
 * Cross-domain: rows ARE ContextEntries (type RECORD), so context list and
 * search caches must refresh.
 */
export function useCreateRow(databaseId: string) {
  const queryClient = useQueryClient();

  return useMutation<DatabaseRowResponse, Error, CreateRowInput | undefined>({
    mutationFn: (data) =>
      apiFetch<DatabaseRowResponse>(
        `/api/databases/${databaseId}/rows`,
        {
          method: "POST",
          body: JSON.stringify(data ?? {}),
        },
      ),
    onSuccess: () => {
      // First-row confetti: celebrate the user's first row in this database.
      const storageKey = `ascend.firstRowCelebrated.${databaseId}`;
      if (typeof window !== "undefined" && !localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, "1");
        fireFirstRowConfetti();
      }

      // Prefix invalidation: catches all query hashes for this database.
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.rows(databaseId),
      });
      // Rows ARE ContextEntries (type RECORD), so list/search caches must refresh.
      queryClient.invalidateQueries({ queryKey: ["context", "list"] });
      queryClient.invalidateQueries({ queryKey: ["context", "search"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.activity.all() });
    },
  });
}

export interface UpdateRowInput {
  rowId: string;
  properties: Record<string, unknown>;
  /** Hint: set to true if the patch contains RELATION field values. */
  affectsRelations?: boolean;
  /** The entry ID of this row, for targeted detail cache invalidation. */
  rowEntryId?: string;
}

/**
 * Update a row's properties (partial patch).
 *
 * If `affectsRelations` is true, also invalidates context links and graph
 * caches because RELATION values map to ContextLink rows.
 */
export function useUpdateRow(databaseId: string) {
  const queryClient = useQueryClient();

  return useMutation<DatabaseRowResponse, Error, UpdateRowInput>({
    mutationFn: ({ rowId, properties }) =>
      apiFetch<DatabaseRowResponse>(
        `/api/databases/${databaseId}/rows/${rowId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ propertiesPatch: properties }),
        },
      ),
    onSuccess: (_result, { affectsRelations, rowEntryId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.rows(databaseId),
      });
      // Search results may change because property text feeds search_vector.
      queryClient.invalidateQueries({ queryKey: ["context", "search"] });
      // If the caller knows the entry ID, refresh its detail.
      if (rowEntryId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.context.detail(rowEntryId),
        });
      }
      // RELATION values map to ContextLink rows; invalidate if applicable.
      if (affectsRelations) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.context.links.all(),
        });
        queryClient.invalidateQueries({ queryKey: ["context", "graph"] });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.activity.all() });
    },
  });
}

/**
 * Delete a row from a database.
 *
 * Cross-domain: removes a ContextEntry (type RECORD) and all its links.
 * Context list, search, links, and graph all need invalidation.
 */
export function useDeleteRow(databaseId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { rowId: string }>({
    mutationFn: ({ rowId }) =>
      apiFetch<void>(
        `/api/databases/${databaseId}/rows/${rowId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.rows(databaseId),
      });
      // Rows ARE ContextEntries; list and search caches must refresh.
      queryClient.invalidateQueries({ queryKey: ["context", "list"] });
      queryClient.invalidateQueries({ queryKey: ["context", "search"] });
      // Row may have had RELATION links.
      queryClient.invalidateQueries({
        queryKey: queryKeys.context.links.all(),
      });
      queryClient.invalidateQueries({ queryKey: ["context", "graph"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.activity.all() });
    },
  });
}

/**
 * Reorder rows manually (drag-and-drop in table/board views).
 */
export function useReorderRows(databaseId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { orderedRowIds: string[] }>({
    mutationFn: (data) =>
      apiFetch<void>(
        `/api/databases/${databaseId}/rows/reorder`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.rows(databaseId),
      });
    },
  });
}

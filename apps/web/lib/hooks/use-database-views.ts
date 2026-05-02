"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/queries/keys";
import type { DatabaseResponse, DatabaseViewResponse } from "./use-databases";

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Read views for a database from the detail cache (no separate fetch).
 *
 * Uses React Query `select` to project the views array from the full
 * database detail query. Avoids a duplicate network request since
 * `useDatabase(databaseId)` already fetches views.
 */
export function useDatabaseViews(databaseId: string) {
  return useQuery({
    queryKey: queryKeys.databases.detail(databaseId),
    queryFn: () =>
      apiFetch<DatabaseResponse>(`/api/databases/${databaseId}`),
    enabled: !!databaseId,
    select: (db) => db.views,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

export interface CreateViewInput {
  databaseId: string;
  name: string;
  type: string;
  config?: Record<string, unknown>;
}

/**
 * Create a new view for a database.
 */
export function useCreateView(databaseId: string) {
  const queryClient = useQueryClient();

  return useMutation<DatabaseViewResponse, Error, Omit<CreateViewInput, "databaseId">>({
    mutationFn: (data) =>
      apiFetch<DatabaseViewResponse>(
        `/api/databases/${databaseId}/views`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.views(databaseId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.detail(databaseId),
      });
    },
  });
}

export interface UpdateViewInput {
  viewId: string;
  name?: string;
  config?: Record<string, unknown>;
  isDefault?: boolean;
}

/**
 * Update a view's metadata or config.
 *
 * Does NOT invalidate rows: the row query hash is keyed on inline
 * filter/sort, not viewId. The next rows read with the updated view config
 * will produce a new hash naturally.
 */
export function useUpdateView(databaseId: string) {
  const queryClient = useQueryClient();

  return useMutation<DatabaseViewResponse, Error, UpdateViewInput>({
    mutationFn: ({ viewId, ...data }) =>
      apiFetch<DatabaseViewResponse>(
        `/api/databases/${databaseId}/views/${viewId}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.views(databaseId),
      });
    },
  });
}

/**
 * Delete a view from a database.
 */
export function useDeleteView(databaseId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { viewId: string }>({
    mutationFn: ({ viewId }) =>
      apiFetch<void>(
        `/api/databases/${databaseId}/views/${viewId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.views(databaseId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.detail(databaseId),
      });
    },
  });
}

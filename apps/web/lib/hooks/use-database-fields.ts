"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/queries/keys";
import type { DatabaseFieldResponse, DatabaseResponse } from "./use-databases";

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Read fields for a database from the detail cache (no separate fetch).
 *
 * Uses React Query `select` to project the fields array from the full
 * database detail query. This avoids a duplicate network request since
 * `useDatabase(databaseId)` already fetches fields.
 */
export function useFields(databaseId: string) {
  return useQuery({
    queryKey: queryKeys.databases.detail(databaseId),
    queryFn: () =>
      apiFetch<DatabaseResponse>(`/api/databases/${databaseId}`),
    enabled: !!databaseId,
    select: (db) => db.fields,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

export interface AddFieldInput {
  databaseId: string;
  name: string;
  type: string;
  config?: Record<string, unknown>;
}

/**
 * Add a new field (column) to a database.
 *
 * Invalidates: database detail (field list changed) + rows (cells may need
 * to render a new empty column).
 */
export function useAddField() {
  const queryClient = useQueryClient();

  return useMutation<DatabaseFieldResponse, Error, AddFieldInput>({
    mutationFn: ({ databaseId, ...data }) =>
      apiFetch<DatabaseFieldResponse>(
        `/api/databases/${databaseId}/fields`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: (_result, { databaseId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.detail(databaseId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.rows(databaseId),
      });
    },
  });
}

export interface UpdateFieldInput {
  databaseId: string;
  fieldId: string;
  name?: string;
  config?: Record<string, unknown>;
}

/**
 * Update field metadata (name, config).
 *
 * Invalidates: database detail (field definition changed) + rows (cells
 * may render differently with new config, e.g. SELECT options changed).
 */
export function useUpdateField(databaseId: string) {
  const queryClient = useQueryClient();

  return useMutation<DatabaseFieldResponse, Error, UpdateFieldInput>({
    mutationFn: ({ databaseId: dbId, fieldId, ...data }) =>
      apiFetch<DatabaseFieldResponse>(
        `/api/databases/${dbId}/fields/${fieldId}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.detail(databaseId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.rows(databaseId),
      });
    },
  });
}

/**
 * Delete a field from a database.
 *
 * Defensively invalidates context links and graph because the field may be
 * of type RELATION (the hook cannot know the field type at call time; the
 * invalidation is cheap since React Query refetches lazily).
 */
export function useDeleteField(databaseId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { fieldId: string }>({
    mutationFn: ({ fieldId }) =>
      apiFetch<void>(
        `/api/databases/${databaseId}/fields/${fieldId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.detail(databaseId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.rows(databaseId),
      });
      // Defensive: if the deleted field was RELATION, links and graph changed.
      queryClient.invalidateQueries({
        queryKey: queryKeys.context.links.all(),
      });
      queryClient.invalidateQueries({ queryKey: ["context", "graph"] });
    },
  });
}

/**
 * Reorder fields within a database (drag-and-drop column reordering).
 */
export function useReorderFields(databaseId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { orderedFieldIds: string[] }>({
    mutationFn: (data) =>
      apiFetch<void>(
        `/api/databases/${databaseId}/fields/reorder`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.detail(databaseId),
      });
    },
  });
}

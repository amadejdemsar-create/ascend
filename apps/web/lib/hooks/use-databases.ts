"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/queries/keys";
import { fireDatabaseCreatedConfetti } from "@/lib/confetti";

// ---------------------------------------------------------------------------
// Response types (mirror the API route JSON shapes)
// ---------------------------------------------------------------------------

export interface DatabaseFieldResponse {
  id: string;
  databaseId: string;
  name: string;
  type: string;
  config: Record<string, unknown> | null;
  isPrimary: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseViewResponse {
  id: string;
  databaseId: string;
  name: string;
  type: string;
  config: Record<string, unknown> | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseResponse {
  id: string;
  userId: string;
  name: string;
  entryId: string;
  defaultViewId: string | null;
  fields: DatabaseFieldResponse[];
  views: DatabaseViewResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseListItem {
  id: string;
  name: string;
  entryId: string;
  defaultViewId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all databases for the current user.
 */
export function useDatabases() {
  return useQuery({
    queryKey: queryKeys.databases.lists(),
    queryFn: () => apiFetch<DatabaseListItem[]>("/api/databases"),
  });
}

/**
 * Fetch a single database with its fields and views.
 */
export function useDatabase(id: string) {
  return useQuery({
    queryKey: queryKeys.databases.detail(id),
    queryFn: () => apiFetch<DatabaseResponse>(`/api/databases/${id}`),
    enabled: !!id,
  });
}

/**
 * Fetch a database by its backing ContextEntry ID.
 * Used when opening a DATABASE entry in the detail panel.
 */
export function useDatabaseByEntry(entryId: string) {
  return useQuery({
    queryKey: ["databases", "by-entry", entryId],
    queryFn: () => apiFetch<DatabaseResponse>(`/api/databases/by-entry/${entryId}`),
    enabled: !!entryId,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

export interface CreateDatabaseInput {
  name: string;
  parentEntryId?: string;
}

/**
 * Create a new database.
 *
 * Cross-domain: creates a ContextEntry (type DATABASE), so context list
 * caches must be invalidated. If attached to a parent entry, that detail
 * cache needs a refresh too. Graph invalidated because new node appears.
 */
export function useCreateDatabase() {
  const queryClient = useQueryClient();

  return useMutation<DatabaseResponse, Error, CreateDatabaseInput>({
    mutationFn: (data) =>
      apiFetch<DatabaseResponse>("/api/databases", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.databases.all() });
      // Database creates a ContextEntry of type DATABASE.
      queryClient.invalidateQueries({ queryKey: ["context", "list"] });
      // Graph: new node added.
      queryClient.invalidateQueries({ queryKey: ["context", "graph"] });
      // If attached to a parent entry, refresh that detail.
      if (variables.parentEntryId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.context.detail(variables.parentEntryId),
        });
      }
      // Celebration: gentle confetti burst on database creation.
      fireDatabaseCreatedConfetti();
    },
  });
}

export interface UpdateDatabaseInput {
  name?: string;
  defaultViewId?: string;
}

/**
 * Update database metadata (name, default view).
 */
export function useUpdateDatabase(id: string) {
  const queryClient = useQueryClient();

  return useMutation<DatabaseResponse, Error, UpdateDatabaseInput>({
    mutationFn: (data) =>
      apiFetch<DatabaseResponse>(`/api/databases/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.databases.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.databases.lists() });
    },
  });
}

/**
 * Delete a database and cascade all its rows, fields, views, and links.
 *
 * Cross-domain: removes a ContextEntry (type DATABASE) plus all RECORD
 * entries (rows), so context list, search, links, and graph all need
 * invalidation.
 */
export function useDeleteDatabase() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiFetch<void>(`/api/databases/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.databases.all() });
      // Rows ARE ContextEntries; list and search caches must refresh.
      queryClient.invalidateQueries({ queryKey: ["context", "list"] });
      queryClient.invalidateQueries({ queryKey: ["context", "search"] });
      // RELATION fields on the database created ContextLinks; clean up.
      queryClient.invalidateQueries({
        queryKey: queryKeys.context.links.all(),
      });
      // Graph: nodes removed.
      queryClient.invalidateQueries({ queryKey: ["context", "graph"] });
    },
  });
}

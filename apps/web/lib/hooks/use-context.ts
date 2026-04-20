"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch as fetchJson } from "@/lib/api-client";
import type { ContextFilters, CreateContextInput, UpdateContextInput } from "@/lib/validations";

// --- Query Hooks ---

export function useContextEntries(filters?: ContextFilters) {
  return useQuery({
    queryKey: queryKeys.context.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.categoryId) params.set("categoryId", filters.categoryId);
      if (filters?.tag) params.set("tag", filters.tag);
      const qs = params.toString();
      return fetchJson<unknown[]>(`/api/context${qs ? `?${qs}` : ""}`);
    },
  });
}

export function useContextEntry(id: string) {
  return useQuery({
    queryKey: queryKeys.context.detail(id),
    queryFn: () => fetchJson(`/api/context/${id}`),
    enabled: !!id,
  });
}

export function useSearchContext(query: string) {
  return useQuery({
    queryKey: queryKeys.context.search(query),
    queryFn: () => fetchJson(`/api/context/search?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
  });
}

// --- Mutation Hooks ---

export function useCreateContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateContextInput) =>
      fetchJson("/api/context", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
    },
  });
}

export function useUpdateContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContextInput }) =>
      fetchJson(`/api/context/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.context.detail(id) });
    },
  });
}

export function useDeleteContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/context/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
    },
  });
}

export function useTogglePin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned?: boolean }) =>
      fetchJson(`/api/context/${id}/pin`, {
        method: "PATCH",
        body: JSON.stringify(typeof isPinned === "boolean" ? { isPinned } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
    },
  });
}

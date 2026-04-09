"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import type { ContextFilters, CreateContextInput, UpdateContextInput } from "@/lib/validations";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;

const headers: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers, ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  // 204 No Content returns no body
  if (res.status === 204) return undefined as T;
  return res.json();
}

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

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/lib/validations";

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
  return res.json();
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.tree(),
    queryFn: () => fetchJson<unknown[]>("/api/categories"),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryInput) =>
      fetchJson("/api/categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryInput }) =>
      fetchJson(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Category rename or color change must propagate to every query
      // that includes category info in its payload: goals, todos, and
      // context all render { category: true } relations.
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      // Deleting a category sets categoryId to null on every goal,
      // todo, and context entry that referenced it (onDelete: SetNull),
      // so all three domains need invalidation.
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

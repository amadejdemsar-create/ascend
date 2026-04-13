"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch as fetchJson } from "@/lib/api-client";
import type { TodoFilters, CreateTodoInput, UpdateTodoInput } from "@/lib/validations";

// --- Query Hooks ---

export function useTodos(filters?: TodoFilters) {
  return useQuery({
    queryKey: queryKeys.todos.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.priority) params.set("priority", filters.priority);
      if (filters?.categoryId) params.set("categoryId", filters.categoryId);
      if (filters?.goalId) params.set("goalId", filters.goalId);
      if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters?.dateTo) params.set("dateTo", filters.dateTo);
      if (filters?.isBig3) params.set("isBig3", filters.isBig3);
      const qs = params.toString();
      return fetchJson<unknown[]>(`/api/todos${qs ? `?${qs}` : ""}`);
    },
  });
}

export function useTodo(id: string) {
  return useQuery({
    queryKey: queryKeys.todos.detail(id),
    queryFn: () => fetchJson(`/api/todos/${id}`),
    enabled: !!id,
  });
}

export function useTodosByDate(date: string) {
  return useQuery({
    queryKey: queryKeys.todos.byDate(date),
    queryFn: () => fetchJson(`/api/todos/by-date?date=${date}`),
    enabled: !!date,
  });
}

export function useTodosByRange(start: string, end: string) {
  return useQuery({
    queryKey: queryKeys.todos.byRange(start, end),
    queryFn: () => fetchJson(`/api/todos/by-range?start=${start}&end=${end}`),
    enabled: !!start && !!end,
  });
}

export function useTop3Todos(date?: string) {
  return useQuery({
    queryKey: queryKeys.todos.big3(date),
    queryFn: () => fetchJson(`/api/todos/big3${date ? `?date=${date}` : ""}`),
  });
}

export function useSearchTodos(query: string) {
  return useQuery({
    queryKey: queryKeys.todos.search(query),
    queryFn: () => fetchJson(`/api/todos/search?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
  });
}

export function useStreakHistory(todoId: string) {
  return useQuery({
    queryKey: queryKeys.todos.streakHistory(todoId),
    queryFn: () => fetchJson(`/api/todos/${todoId}/streak-history`),
    enabled: !!todoId,
  });
}

// --- Mutation Hooks ---

export function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTodoInput) =>
      fetchJson("/api/todos", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTodoInput }) =>
      fetchJson(`/api/todos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/todos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useCompleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/todos/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
    },
  });
}

export function useUncompleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/todos/${id}/uncomplete`, { method: "POST" }),
    onSuccess: () => {
      // Same cross-domain invalidation as completeTodo: stats, goals,
      // and progress can all change as a result of the reversal.
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
    },
  });
}

export function useSkipTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/todos/${id}/skip`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useSetBig3() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { todoIds: string[]; date?: string }) =>
      fetchJson("/api/todos/big3", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.big3() });
    },
  });
}

export function useReorderTodos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      fetchJson("/api/todos/reorder", {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
    },
  });
}

export function useBulkCompleteTodos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      fetchJson("/api/todos/bulk-complete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
    },
  });
}

export function useGenerateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (range?: { start: string; end: string }) => {
      const params = range
        ? `?start=${range.start}&end=${range.end}`
        : "";
      return fetchJson(`/api/todos/recurring/generate${params}`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
    },
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/queries/keys";
import type {
  CreateFocusSessionInput,
  FocusSessionFilters,
} from "@/lib/validations";

interface FocusSummary {
  totalSeconds: number;
  sessionCount: number;
}

// --- Query Hooks ---

export function useFocusSessions(filters?: FocusSessionFilters) {
  return useQuery({
    queryKey: queryKeys.focus.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.todoId) params.set("todoId", filters.todoId);
      if (filters?.goalId) params.set("goalId", filters.goalId);
      if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters?.dateTo) params.set("dateTo", filters.dateTo);
      const qs = params.toString();
      return apiFetch<unknown[]>(`/api/focus-sessions${qs ? `?${qs}` : ""}`);
    },
  });
}

export function useTodoFocusSummary(todoId: string) {
  return useQuery<FocusSummary>({
    queryKey: queryKeys.focus.summaryTodo(todoId),
    queryFn: () =>
      apiFetch<FocusSummary>(`/api/focus-sessions/summary?todoId=${todoId}`),
    enabled: !!todoId,
  });
}

export function useGoalFocusSummary(goalId: string) {
  return useQuery<FocusSummary>({
    queryKey: queryKeys.focus.summaryGoal(goalId),
    queryFn: () =>
      apiFetch<FocusSummary>(`/api/focus-sessions/summary?goalId=${goalId}`),
    enabled: !!goalId,
  });
}

export function useWeekFocusSummary() {
  return useQuery<FocusSummary>({
    queryKey: queryKeys.focus.summaryWeek(),
    queryFn: () => apiFetch<FocusSummary>("/api/focus-sessions/summary"),
  });
}

// --- Mutation Hooks ---

export function useCreateFocusSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFocusSessionInput) =>
      apiFetch("/api/focus-sessions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.focus.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
      if (vars.todoId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.todos.detail(vars.todoId),
        });
      }
    },
  });
}

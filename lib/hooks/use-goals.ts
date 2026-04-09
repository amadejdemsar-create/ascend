"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import type {
  GoalFilters,
  CreateGoalInput,
  UpdateGoalInput,
} from "@/lib/validations";

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

export interface TreeGoal {
  id: string;
  title: string;
  status: string;
  horizon: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  progress: number;
  startDate: string | null;
  deadline: string | null;
  category: { id: string; name: string; color: string; icon: string | null } | null;
  children: TreeGoal[];
}

export function useGoalTree() {
  return useQuery({
    queryKey: queryKeys.goals.tree(),
    queryFn: () => fetchJson<TreeGoal[]>("/api/goals/tree"),
  });
}

export interface GoalDeadlineItem {
  id: string;
  title: string;
  horizon: string;
  priority: string;
  deadline: string;
  status: string;
  category: { id: string; name: string; color: string; icon: string | null } | null;
}

export function useGoalDeadlinesByRange(start: string, end: string) {
  return useQuery({
    queryKey: queryKeys.goals.deadlineRange(start, end),
    queryFn: () =>
      fetchJson<GoalDeadlineItem[]>(
        `/api/goals/by-deadline-range?start=${start}&end=${end}`,
      ),
    enabled: !!start && !!end,
  });
}

export function useGoals(filters?: GoalFilters) {
  return useQuery({
    queryKey: queryKeys.goals.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.horizon) params.set("horizon", filters.horizon);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.categoryId) params.set("categoryId", filters.categoryId);
      if (filters?.parentId !== undefined) {
        params.set("parentId", filters.parentId ?? "null");
      }
      const qs = params.toString();
      return fetchJson<unknown[]>(`/api/goals${qs ? `?${qs}` : ""}`);
    },
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: queryKeys.goals.detail(id),
    queryFn: () => fetchJson(`/api/goals/${id}`),
    enabled: !!id,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGoalInput) =>
      fetchJson("/api/goals", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGoalInput }) =>
      fetchJson(`/api/goals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.goals.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/goals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useReorderGoals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      fetchJson("/api/goals/reorder", {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
    },
  });
}

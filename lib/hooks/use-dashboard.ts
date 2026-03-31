"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import type { DashboardData } from "@/lib/services/dashboard-service";
import type { AddProgressInput } from "@/lib/validations";

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

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: () => fetchJson<DashboardData>("/api/dashboard"),
  });
}

export function useLogProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, data }: { goalId: string; data: AddProgressInput }) =>
      fetchJson(`/api/goals/${goalId}/progress`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(goalId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
}

export function useProgressHistory(goalId: string) {
  return useQuery({
    queryKey: queryKeys.goals.progress(goalId),
    queryFn: () => fetchJson(`/api/goals/${goalId}/progress`),
    enabled: !!goalId,
  });
}

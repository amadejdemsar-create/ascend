"use client";

import { useEffect } from "react";
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

// Module-level flag to prevent re-triggering recurring generation on every refetch
let recurringGenerated = false;

export function useDashboard() {
  const query = useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: () => fetchJson<DashboardData>("/api/dashboard"),
  });

  // Trigger both goal and todo recurring instance generation once per
  // session on the first successful dashboard load. Calendar-only
  // triggering meant recurring todos never materialized for users who
  // skipped the calendar view (including every MCP client).
  useEffect(() => {
    if (query.data && !recurringGenerated) {
      recurringGenerated = true;
      // Fire and forget: generate recurring instances in the background.
      // Errors are swallowed so a missing endpoint does not disrupt
      // the dashboard render.
      fetch("/api/goals/recurring/generate", {
        method: "POST",
        headers,
      }).catch(() => {});
      fetch("/api/todos/recurring/generate", {
        method: "POST",
        headers,
      }).catch(() => {});
    }
  }, [query.data]);

  return query;
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

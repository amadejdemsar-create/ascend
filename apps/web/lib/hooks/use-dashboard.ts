"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch as fetchJson } from "@/lib/api-client";
import type { DashboardData } from "@/lib/services/dashboard-service";
import type { AddProgressInput } from "@/lib/validations";

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
      // the dashboard render. Uses bare fetch with credentials: "include"
      // so cookies handle auth (no API key needed in browser).
      fetch("/api/goals/recurring/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
      fetch("/api/todos/recurring/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
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

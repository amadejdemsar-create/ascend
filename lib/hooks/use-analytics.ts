"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";

export interface AnalyticsTrendsData {
  weeks: number;
  todoCompletions: Array<{ week: string; weekStart: string; count: number }>;
  xpEarned: Array<{ week: string; weekStart: string; amount: number }>;
  goalProgress: Array<{
    week: string;
    weekStart: string;
    goalsProgressed: number;
  }>;
  summary: {
    todosThisWeek: number;
    todosPrevWeek: number;
    xpThisWeek: number;
    xpPrevWeek: number;
    goalsProgressedThisWeek: number;
    goalsProgressedPrevWeek: number;
  };
}

export function useAnalytics(weeks = 12) {
  return useQuery({
    queryKey: queryKeys.analytics.trends(weeks),
    queryFn: () =>
      apiFetch<AnalyticsTrendsData>(
        `/api/analytics?weeks=${weeks}`,
      ),
    staleTime: 5 * 60 * 1000,
  });
}

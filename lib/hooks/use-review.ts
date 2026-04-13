"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";
import type { WeeklyReviewData } from "@/lib/services/review-service";

// --- Query Hooks ---

export function useWeeklyReview(weekStart: string) {
  return useQuery<WeeklyReviewData>({
    queryKey: queryKeys.review.weekly(weekStart),
    queryFn: () =>
      apiFetch<WeeklyReviewData>(
        `/api/review?weekStart=${encodeURIComponent(weekStart)}`,
      ),
    enabled: !!weekStart,
  });
}

// --- Mutation Hooks ---

export function useSaveReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      weekStart: string;
      wentWell: string;
      toImprove: string;
    }) =>
      apiFetch("/api/review/save", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Saving a review creates a context entry, so invalidate context queries
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
    },
  });
}

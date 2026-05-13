"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";
import type { ActivityEventType, ActivityEventPayload } from "@/lib/validations";

// ── Response types ───────────────────────────────────────────────────

export interface ActivityEventItem {
  id: string;
  workspaceId: string;
  userId: string | null;
  eventType: ActivityEventType;
  payload: ActivityEventPayload;
  createdAt: string;
  actorDisplayName: string | null;
}

export interface ActivityFeedPage {
  events: ActivityEventItem[];
  nextCursor: string | null;
}

// ── Filters ──────────────────────────────────────────────────────────

export interface ActivityFeedFilters {
  eventTypes?: ActivityEventType[];
  since?: Date;
}

// ── Hook ─────────────────────────────────────────────────────────────

/**
 * Paginated activity feed for a workspace.
 *
 * Uses `useInfiniteQuery` with cursor-based pagination.
 * Disabled when `workspaceId` is null (identity not resolved yet).
 *
 * The query key includes the filters so that changing filters
 * triggers a fresh fetch.
 */
export function useActivityFeed(
  workspaceId: string | null,
  filters?: ActivityFeedFilters,
) {
  return useInfiniteQuery<ActivityFeedPage>({
    queryKey: queryKeys.activity.feed(workspaceId, filters),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();

      if (filters?.eventTypes) {
        for (const et of filters.eventTypes) {
          params.append("eventType", et);
        }
      }
      if (filters?.since) {
        params.set("since", filters.since.toISOString());
      }
      if (pageParam) {
        params.set("cursor", pageParam as string);
      }
      params.set("limit", "50");

      const qs = params.toString();
      return apiFetch<ActivityFeedPage>(
        `/api/workspaces/${workspaceId}/activity${qs ? `?${qs}` : ""}`,
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!workspaceId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

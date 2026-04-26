"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";
import type { ContextMapContent } from "@/lib/validations";

export interface ContextMapResponse {
  id: string;
  userId: string;
  content: ContextMapContent;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch the current Context Map for the authenticated user.
 * Returns undefined (not an error) if no map has been generated yet,
 * since a 404 is expected for new users.
 */
export function useContextMap() {
  return useQuery({
    queryKey: queryKeys.context.map(),
    queryFn: async () => {
      try {
        return await apiFetch<ContextMapResponse>("/api/context/map");
      } catch (error) {
        // 404 means no map yet; treat as empty rather than error
        if (error instanceof Error && error.message === "No map yet") {
          return null;
        }
        throw error;
      }
    },
  });
}

/**
 * Trigger a Context Map refresh. On success, invalidates the map cache
 * and the LLM usage cache (since the refresh logs a usage event).
 */
export function useRefreshContextMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<ContextMapResponse>("/api/context/map/refresh", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.context.map() });
      queryClient.invalidateQueries({ queryKey: queryKeys.llm.all() });
    },
  });
}

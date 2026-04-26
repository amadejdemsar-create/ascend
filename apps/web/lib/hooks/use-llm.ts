"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";
import type { ChatProviderKind, ModelDescriptor } from "@ascend/llm";

// ── Usage types ──────────────────────────────────────────────────

export interface LlmUsageResponse {
  totalCostCents: number;
  softCapCents: number;
  hardCapCents: number;
  perProvider: Array<{ provider: ChatProviderKind; costCents: number }>;
  perPurpose: Array<{ purpose: string; costCents: number }>;
}

/**
 * Fetch LLM usage rollup for the authenticated user.
 *
 * @param window - "day" (default) or "week"
 * @param opts.refetchInterval - optional auto-refresh interval in ms
 */
export function useLlmUsage(
  window: "day" | "week" = "day",
  opts?: { refetchInterval?: number },
) {
  return useQuery({
    queryKey: queryKeys.llm.usage(window),
    queryFn: () =>
      apiFetch<LlmUsageResponse>(`/api/llm/usage?window=${window}`),
    refetchInterval: opts?.refetchInterval,
  });
}

// ── Providers types ──────────────────────────────────────────────

export interface ProviderInfo {
  kind: ChatProviderKind;
  available: boolean;
  models: ModelDescriptor[];
}

export interface LlmProvidersResponse {
  providers: ProviderInfo[];
}

/**
 * Fetch available LLM providers and their model catalogs.
 * The `available` field indicates whether the API key env var is set.
 */
export function useLlmProviders() {
  return useQuery({
    queryKey: queryKeys.llm.providers(),
    queryFn: () => apiFetch<LlmProvidersResponse>("/api/llm/providers"),
    // Provider availability changes only when env vars change (deploy),
    // so a long stale time is appropriate.
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ── AI Settings types ───────────────────────────────────────────

export interface AiSettingsResponse {
  id?: string;
  chatProvider: ChatProviderKind;
  chatModel: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Fetch current AI settings (provider + model).
 */
export function useAiSettings() {
  return useQuery({
    queryKey: queryKeys.settings.ai(),
    queryFn: () => apiFetch<AiSettingsResponse>("/api/settings"),
  });
}

/**
 * Update AI settings (chatProvider, chatModel).
 * Invalidates settings, LLM providers, and usage caches on success.
 */
export function useUpdateAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { chatProvider?: string; chatModel?: string | null }) =>
      apiFetch<AiSettingsResponse>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.llm.all() });
    },
  });
}

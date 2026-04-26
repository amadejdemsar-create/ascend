"use client";

import { useQuery } from "@tanstack/react-query";
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
 */
export function useLlmUsage(window: "day" | "week" = "day") {
  return useQuery({
    queryKey: queryKeys.llm.usage(window),
    queryFn: () =>
      apiFetch<LlmUsageResponse>(`/api/llm/usage?window=${window}`),
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

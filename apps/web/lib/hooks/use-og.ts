"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/queries/keys";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OgResponse {
  ogImage: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch the OpenGraph image URL for a given page URL.
 *
 * Uses the authenticated /api/og endpoint which performs SSRF-safe fetching
 * and regex-based OG meta tag extraction. The response is cached for 24 hours
 * (staleTime) since OG images rarely change.
 *
 * @param url The page URL to extract the OG image from. Pass null/undefined
 *            to disable the query.
 * @returns { ogImage, isLoading, isError }
 */
export function useOpenGraphImage(url: string | null | undefined) {
  const query = useQuery({
    queryKey: queryKeys.og.image(url ?? ""),
    queryFn: () =>
      apiFetch<OgResponse>(
        `/api/og?url=${encodeURIComponent(url!)}`,
      ),
    enabled: !!url,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    retry: false, // OG fetch failures are not transient; no retry
  });

  return {
    ogImage: query.data?.ogImage ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

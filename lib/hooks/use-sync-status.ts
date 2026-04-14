"use client";

import { useEffect, useState } from "react";
import { useQueryClient, useIsMutating } from "@tanstack/react-query";

export type SyncDomain =
  | "goals"
  | "todos"
  | "context"
  | "dashboard"
  | "analytics"
  | "review"
  | "focus";

export interface SyncStatus {
  isOnline: boolean;
  activeMutations: number;
  lastSynced: Record<SyncDomain, number | null>;
}

const DOMAINS: SyncDomain[] = [
  "goals",
  "todos",
  "context",
  "dashboard",
  "analytics",
  "review",
  "focus",
];

function computeLastSynced(
  queryClient: ReturnType<typeof useQueryClient>,
): Record<SyncDomain, number | null> {
  const result = {} as Record<SyncDomain, number | null>;
  const cache = queryClient.getQueryCache();
  for (const domain of DOMAINS) {
    const queries = cache.findAll({ queryKey: [domain], exact: false });
    let maxTs: number | null = null;
    for (const q of queries) {
      const ts = q.state.dataUpdatedAt;
      if (ts > 0 && (maxTs === null || ts > maxTs)) maxTs = ts;
    }
    result[domain] = maxTs;
  }
  return result;
}

/**
 * Observes React Query cache + navigator.onLine to report sync status.
 * Used by the footer SyncIndicator and the popover. Purely client-side:
 * no network calls, no service layer touches.
 */
export function useSyncStatus(): SyncStatus {
  const queryClient = useQueryClient();
  const activeMutations = useIsMutating();

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const [lastSynced, setLastSynced] = useState<
    Record<SyncDomain, number | null>
  >(() => computeLastSynced(queryClient));

  // Online/offline listeners
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // React to query cache changes
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe(() => {
      setLastSynced(computeLastSynced(queryClient));
    });
    return unsubscribe;
  }, [queryClient]);

  // Keep relative times fresh (tick every 30s)
  useEffect(() => {
    const id = setInterval(() => {
      setLastSynced(computeLastSynced(queryClient));
    }, 30_000);
    return () => clearInterval(id);
  }, [queryClient]);

  return { isOnline, activeMutations, lastSynced };
}

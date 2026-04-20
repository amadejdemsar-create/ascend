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
  /**
   * True only after the component has mounted on the client. Consumers
   * should render a neutral placeholder while this is false so SSR and
   * the first client render match (navigator.onLine is not available
   * server-side).
   */
  hasMounted: boolean;
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

  // SSR-safe defaults. navigator.onLine is unavailable on the server, so
  // we initialize to true and correct it in an effect after mount. This
  // guarantees the first server and client renders match.
  const [isOnline, setIsOnline] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);

  const [lastSynced, setLastSynced] = useState<
    Record<SyncDomain, number | null>
  >(() => computeLastSynced(queryClient));

  // Mark mounted and read navigator.onLine once on the client.
  useEffect(() => {
    setHasMounted(true);
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }
  }, []);

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

  // React to query cache changes. cache.subscribe() fires synchronously
  // during other components' renders (e.g. a mutation's onSuccess call
  // to queryClient.setQueryData), which would trigger a setState here
  // mid-render and produce a "Cannot update a component while rendering"
  // warning. queueMicrotask defers the setState past the current render.
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe(() => {
      queueMicrotask(() => {
        setLastSynced(computeLastSynced(queryClient));
      });
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

  return { isOnline, activeMutations, lastSynced, hasMounted };
}

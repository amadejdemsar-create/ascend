"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Listens for the `ascend:session-expired` custom event (dispatched by the
 * 401 interceptor in `lib/api-client.ts`) and clears the React Query cache
 * so stale authenticated data does not persist after the user is redirected
 * to the login page.
 *
 * Renders nothing. Mount inside the (app) layout where QueryClientProvider
 * is available.
 */
export function SessionExpiredListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function onExpired() {
      queryClient.clear();
    }
    window.addEventListener("ascend:session-expired", onExpired);
    return () =>
      window.removeEventListener("ascend:session-expired", onExpired);
  }, [queryClient]);

  return null;
}

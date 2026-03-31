"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { drain } from "@/lib/offline/outbox";

export function OfflineSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    async function handleOnline() {
      const drained = await drain();
      if (drained > 0) {
        // Refresh all cached queries so the UI reflects synced data
        queryClient.invalidateQueries();
      }
    }

    window.addEventListener("online", handleOnline);

    // If the app was reopened while already online, drain any leftover queue
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [queryClient]);

  return <>{children}</>;
}

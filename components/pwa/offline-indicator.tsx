"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { getPendingCount } from "@/lib/offline/outbox";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOffline = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB may not be available
    }
  }, []);

  useEffect(() => {
    // Initialize from actual navigator state (SSR safe)
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
      if (!navigator.onLine) {
        wasOffline.current = true;
      }
    }

    function handleOnline() {
      setIsOnline(true);
      if (wasOffline.current) {
        setShowReconnected(true);
        wasOffline.current = false;
        setTimeout(() => setShowReconnected(false), 2000);
      }
    }

    function handleOffline() {
      setIsOnline(false);
      wasOffline.current = true;
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Poll pending count while offline
  useEffect(() => {
    if (!isOnline) {
      updatePendingCount();
      pollRef.current = setInterval(updatePendingCount, 3000);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isOnline, updatePendingCount]);

  // Nothing to show when online and no reconnected message
  if (isOnline && !showReconnected) {
    return null;
  }

  // Briefly show "Back online" message
  if (isOnline && showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-emerald-500 px-4 py-2 text-sm font-medium text-white dark:bg-emerald-600">
        <Wifi className="h-4 w-4" />
        <span>Back online, syncing...</span>
      </div>
    );
  }

  // Offline state
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 dark:bg-amber-600 dark:text-white">
      <WifiOff className="h-4 w-4" />
      <span>
        You&apos;re offline
        {pendingCount > 0 && (
          <> &middot; {pendingCount} {pendingCount === 1 ? "change" : "changes"} pending sync</>
        )}
      </span>
    </div>
  );
}

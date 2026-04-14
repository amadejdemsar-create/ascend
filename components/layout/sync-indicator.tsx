"use client";

import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useSyncStatus } from "@/lib/hooks/use-sync-status";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SyncStatusPopover } from "./sync-status-popover";

/**
 * Footer sync indicator. Shows the current online/offline state, any
 * in-flight mutations, and the most recent sync time across all
 * tracked domains. Clicking opens a per-domain breakdown with a
 * "Refresh all" action.
 */
export function SyncIndicator() {
  const status = useSyncStatus();

  // Most recent cross-domain sync time for the compact footer label.
  const mostRecent = Object.values(status.lastSynced).reduce<number | null>(
    (acc, ts) => {
      if (ts === null) return acc;
      if (acc === null || ts > acc) return ts;
      return acc;
    },
    null,
  );

  let label: React.ReactNode;
  if (!status.isOnline) {
    label = (
      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <WifiOff className="size-3.5" />
        Offline
      </span>
    );
  } else if (status.activeMutations > 0) {
    label = (
      <span className="flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" />
        Saving {status.activeMutations}...
      </span>
    );
  } else if (mostRecent) {
    label = (
      <span className="flex items-center gap-1">
        <Wifi className="size-3" />
        Synced {formatDistanceToNowStrict(mostRecent, { addSuffix: true })}
      </span>
    );
  } else {
    label = (
      <span className="flex items-center gap-1">
        <Wifi className="size-3" />
        Online
      </span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
            {label}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72 p-3">
        <SyncStatusPopover status={status} />
      </PopoverContent>
    </Popover>
  );
}

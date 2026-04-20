"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Wifi,
  WifiOff,
  Loader2,
  Target,
  CheckSquare,
  Brain,
  LayoutDashboard,
  TrendingUp,
  ClipboardCheck,
  Clock,
  RefreshCw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { SyncStatus, SyncDomain } from "@/lib/hooks/use-sync-status";

const DOMAIN_CONFIG: Record<
  SyncDomain,
  { label: string; icon: typeof Target }
> = {
  goals: { label: "Goals", icon: Target },
  todos: { label: "Todos", icon: CheckSquare },
  context: { label: "Context", icon: Brain },
  dashboard: { label: "Dashboard", icon: LayoutDashboard },
  analytics: { label: "Analytics", icon: TrendingUp },
  review: { label: "Review", icon: ClipboardCheck },
  focus: { label: "Focus", icon: Clock },
};

interface Props {
  status: SyncStatus;
}

export function SyncStatusPopover({ status }: Props) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries();
      toast.success("All data refreshed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Connection header */}
      <div className="flex items-center gap-2 border-b pb-2">
        {status.isOnline ? (
          <Wifi className="size-4 text-green-500" />
        ) : (
          <WifiOff className="size-4 text-amber-500" />
        )}
        <span className="text-sm font-medium">
          {status.isOnline ? "Online" : "Offline"}
        </span>
        {status.activeMutations > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Saving {status.activeMutations}
          </span>
        )}
      </div>

      {/* Domain rows */}
      <div className="space-y-1.5">
        {(Object.keys(DOMAIN_CONFIG) as SyncDomain[]).map((domain) => {
          const { label, icon: Icon } = DOMAIN_CONFIG[domain];
          const ts = status.lastSynced[domain];
          return (
            <div
              key={domain}
              className="flex items-center justify-between text-xs"
            >
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="size-3" />
                {label}
              </span>
              <span className="text-muted-foreground">
                {ts
                  ? formatDistanceToNowStrict(ts, { addSuffix: true })
                  : "not synced"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Refresh button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={refreshing || !status.isOnline}
        className="w-full gap-1.5"
      >
        {refreshing ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        Refresh all
      </Button>
    </div>
  );
}

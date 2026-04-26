"use client";

import { useState } from "react";
import { Activity, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLlmUsage } from "@/lib/hooks/use-llm";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function capPercentage(spent: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.min((spent / cap) * 100, 100);
}

function capColor(spent: number, softCap: number, hardCap: number): string {
  if (spent >= hardCap) return "bg-red-500";
  if (spent >= softCap) return "bg-amber-500";
  return "bg-green-500";
}

function capTextColor(spent: number, softCap: number, hardCap: number): string {
  if (spent >= hardCap) return "text-red-500";
  if (spent >= softCap) return "text-amber-500";
  return "text-green-500";
}

export function LlmUsagePanel() {
  const [window, setWindow] = useState<"day" | "week">("day");
  const { data, isLoading, error } = useLlmUsage(window, {
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-muted-foreground" />
            LLM Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-muted-foreground" />
            LLM Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load usage data.
          </p>
        </CardContent>
      </Card>
    );
  }

  const spent = data.totalCostCents;
  const softCap = data.softCapCents;
  const hardCap = data.hardCapCents;
  const pct = capPercentage(spent, hardCap);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-muted-foreground" />
            LLM Usage
          </CardTitle>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setWindow("day")}
              className={`text-xs px-2 py-0.5 rounded ${
                window === "day"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setWindow("week")}
              className={`text-xs px-2 py-0.5 rounded ${
                window === "week"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              This week
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Spend bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className={capTextColor(spent, softCap, hardCap)}>
              {formatCents(spent)}
            </span>
            <span className="text-muted-foreground text-xs">
              {formatCents(softCap)} soft / {formatCents(hardCap)} hard
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${capColor(spent, softCap, hardCap)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* Soft cap marker */}
          <div className="relative h-0">
            <div
              className="absolute top-[-10px] w-px h-2 bg-amber-500/50"
              style={{
                left: `${capPercentage(softCap, hardCap)}%`,
              }}
            />
          </div>
        </div>

        {/* Per-provider breakdown */}
        {data.perProvider.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              By provider
            </p>
            <div className="flex flex-wrap gap-2">
              {data.perProvider.map((p) => (
                <div
                  key={p.provider}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <DollarSign className="size-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {p.provider.charAt(0) + p.provider.slice(1).toLowerCase()}
                  </span>
                  <span className="font-medium">{formatCents(p.costCents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-purpose breakdown */}
        {data.perPurpose.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              By purpose
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.perPurpose.map((p) => (
                <Badge
                  key={p.purpose}
                  variant="secondary"
                  className="text-[10px] font-normal"
                >
                  {p.purpose.replace(/_/g, " ")} {formatCents(p.costCents)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

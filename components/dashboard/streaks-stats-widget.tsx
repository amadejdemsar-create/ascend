"use client";

import {
  Flame,
  CalendarCheck,
  Percent,
  Target,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { StatsData } from "@/lib/services/dashboard-service";

interface StreaksStatsWidgetProps {
  stats: StatsData;
}

const statItems = [
  {
    key: "completedThisMonth" as const,
    label: "Completed this month",
    icon: CalendarCheck,
  },
  {
    key: "completionRate" as const,
    label: "Completion rate",
    icon: Percent,
    suffix: "%",
  },
  { key: "totalGoals" as const, label: "Total goals", icon: Target },
  {
    key: "totalCompleted" as const,
    label: "Total completed",
    icon: CheckCircle2,
  },
];

export function StreaksStatsWidget({ stats }: StreaksStatsWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="size-4 text-muted-foreground" />
          Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {statItems.map((item) => {
            const Icon = item.icon;
            const value = stats[item.key];
            return (
              <div key={item.key} className="space-y-1">
                <Icon className="size-4 text-muted-foreground" />
                <p className="font-mono text-2xl font-bold">
                  {value}
                  {item.suffix ?? ""}
                </p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

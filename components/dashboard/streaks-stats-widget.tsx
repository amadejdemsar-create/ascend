"use client";

import {
  Flame,
  CalendarCheck,
  Percent,
  CheckCircle2,
  Trophy,
  Zap,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { XpProgressBar } from "@/components/ui/xp-progress-bar";
import type { StatsData } from "@/lib/services/dashboard-service";

interface StreaksStatsWidgetProps {
  stats: StatsData;
}

const statItems = [
  {
    key: "level" as const,
    label: "Level",
    icon: Trophy,
  },
  {
    key: "weeklyScore" as const,
    label: "Weekly score",
    icon: Zap,
    suffix: "pts",
  },
  {
    key: "activeStreaks" as const,
    label: "Active streaks",
    icon: Flame,
  },
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
          <Trophy className="size-4 text-muted-foreground" />
          Level & Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <XpProgressBar
          current={stats.xpToNext.current}
          needed={stats.xpToNext.needed}
          percentage={stats.xpToNext.percentage}
          level={stats.level}
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {statItems.map((item) => {
            const Icon = item.icon;
            const value = stats[item.key];
            return (
              <div key={item.key} className="space-y-1">
                <Icon className="size-4 text-muted-foreground" />
                <p className="font-mono text-2xl font-bold">
                  {value}
                  {item.suffix ? ` ${item.suffix}` : ""}
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

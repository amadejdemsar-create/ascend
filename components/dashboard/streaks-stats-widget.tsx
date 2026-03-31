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
import { useAnimatedCounter } from "@/lib/hooks/use-animated-counter";
import type { StatsData } from "@/lib/services/dashboard-service";

interface StreaksStatsWidgetProps {
  stats: StatsData;
}

export function StreaksStatsWidget({ stats }: StreaksStatsWidgetProps) {
  const animatedLevel = useAnimatedCounter(stats.level);
  const animatedWeeklyScore = useAnimatedCounter(stats.weeklyScore);
  const animatedActiveStreaks = useAnimatedCounter(stats.activeStreaks);
  const animatedCompletedThisMonth = useAnimatedCounter(stats.completedThisMonth);
  const animatedTotalCompleted = useAnimatedCounter(stats.totalCompleted);

  const statItems = [
    { label: "Level", icon: Trophy, value: animatedLevel },
    { label: "Weekly score", icon: Zap, value: animatedWeeklyScore, suffix: "pts" },
    { label: "Active streaks", icon: Flame, value: animatedActiveStreaks },
    { label: "Completed this month", icon: CalendarCheck, value: animatedCompletedThisMonth },
    { label: "Completion rate", icon: Percent, value: stats.completionRate, suffix: "%" },
    { label: "Total completed", icon: CheckCircle2, value: animatedTotalCompleted },
  ];

  return (
    <Card className="hover-lift">
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
            return (
              <div key={item.label} className="space-y-1">
                <Icon className="size-4 text-muted-foreground" />
                <p className="font-mono text-2xl font-bold">
                  {item.value}
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

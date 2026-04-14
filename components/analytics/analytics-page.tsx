"use client";

import {
  ArrowUp,
  ArrowDown,
  Minus,
  CheckCircle2,
  Zap,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TodoCompletionChart } from "./todo-completion-chart";
import { XpEarnedChart } from "./xp-earned-chart";
import { GoalProgressChart } from "./goal-progress-chart";
import type { AnalyticsTrendsData } from "@/lib/hooks/use-analytics";

interface Props {
  data: AnalyticsTrendsData | undefined;
  isLoading: boolean;
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3.5" />
        No change
      </span>
    );
  }
  if (diff > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-500">
        <ArrowUp className="size-3.5" />
        +{diff}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <ArrowDown className="size-3.5" />
      {diff}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  previous,
  icon: Icon,
}: {
  label: string;
  value: number;
  previous: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-1">
        <div className="flex items-center justify-between">
          <Icon className="size-4 text-muted-foreground" />
          <Delta current={value} previous={previous} />
        </div>
        <p className="font-mono text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export function AnalyticsPage({ data, isLoading }: Props) {
  if (isLoading || !data) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-muted-foreground">Last 12 weeks</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[220px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalActivity =
    data.todoCompletions.reduce((sum, x) => sum + x.count, 0) +
    data.xpEarned.reduce((sum, x) => sum + x.amount, 0) +
    data.goalProgress.reduce((sum, x) => sum + x.goalsProgressed, 0);

  if (totalActivity === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-muted-foreground">Last 12 weeks</p>
        </div>
        <Card>
          <CardContent className="pt-10 pb-10 flex flex-col items-center gap-3">
            <BarChart3 className="size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground text-center">
              Not enough data yet. Complete some todos and goals to see trends.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">Last 12 weeks</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <SummaryCard
          label="Todos completed this week"
          value={data.summary.todosThisWeek}
          previous={data.summary.todosPrevWeek}
          icon={CheckCircle2}
        />
        <SummaryCard
          label="XP earned this week"
          value={data.summary.xpThisWeek}
          previous={data.summary.xpPrevWeek}
          icon={Zap}
        />
        <SummaryCard
          label="Goals progressed this week"
          value={data.summary.goalsProgressedThisWeek}
          previous={data.summary.goalsProgressedPrevWeek}
          icon={TrendingUp}
        />
      </div>

      {/* Charts */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              Todo Completions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TodoCompletionChart data={data.todoCompletions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="size-4 text-muted-foreground" />
              XP Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <XpEarnedChart data={data.xpEarned} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-muted-foreground" />
              Goal Progress Velocity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GoalProgressChart data={data.goalProgress} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

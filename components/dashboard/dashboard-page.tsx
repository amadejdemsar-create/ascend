"use client";

import { useDashboard } from "@/lib/hooks/use-dashboard";
import { useUIStore } from "@/lib/stores/ui-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WeeklyFocusWidget } from "./weekly-focus-widget";
import { ProgressOverviewWidget } from "./progress-overview-widget";
import { StreaksStatsWidget } from "./streaks-stats-widget";
import { UpcomingDeadlinesWidget } from "./upcoming-deadlines-widget";

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useDashboard();
  const openGoalModal = useUIStore((s) => s.openGoalModal);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          What should you focus on right now?
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 pt-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-destructive">
              {error?.message ?? "Failed to load dashboard data."}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {data && data.streaksStats.totalGoals === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <h2 className="font-serif text-2xl font-bold">
              Welcome to Ascend
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Start by creating your first yearly goal. Everything flows from
              there.
            </p>
            <Button onClick={() => openGoalModal("create", "YEARLY")}>
              Create your first goal
            </Button>
          </CardContent>
        </Card>
      )}

      {data && data.streaksStats.totalGoals > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <WeeklyFocusWidget goals={data.weeklyFocus} />
          <ProgressOverviewWidget categories={data.progressOverview} />
          <StreaksStatsWidget stats={data.streaksStats} />
          <UpcomingDeadlinesWidget goals={data.upcomingDeadlines} />
        </div>
      )}
    </div>
  );
}

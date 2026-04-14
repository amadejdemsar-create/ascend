"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useDashboard } from "@/lib/hooks/use-dashboard";
import { useUIStore } from "@/lib/stores/ui-store";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { TodaysBig3Widget } from "./todays-big3-widget";
import { WeeklyFocusWidget } from "./weekly-focus-widget";
import { ProgressOverviewWidget } from "./progress-overview-widget";
import { StreaksStatsWidget } from "./streaks-stats-widget";
import { UpcomingDeadlinesWidget } from "./upcoming-deadlines-widget";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { ContextualHints } from "@/components/onboarding/contextual-hints";

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useDashboard();
  const openGoalModal = useUIStore((s) => s.openGoalModal);
  const queryClient = useQueryClient();

  const handleOnboardingComplete = useCallback(async () => {
    try {
      await apiFetch("/api/goals/onboarding", { method: "PATCH" });
    } catch {
      // Silently continue; the onboarding will be marked next time
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
  }, [queryClient]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={format(new Date(), "EEEE, d MMMM yyyy")}
      />

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

      {data && data.onboardingComplete === false && (
        <OnboardingGate onComplete={handleOnboardingComplete} />
      )}

      {data && data.onboardingComplete !== false && data.streaksStats.totalGoals === 0 && (
        <>
          <ContextualHints />
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
        </>
      )}

      {data && data.onboardingComplete !== false && data.streaksStats.totalGoals > 0 && (
        <>
          {/* Quick Actions */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {/*
              New Todo button: passes nativeButton={false} so Base UI
              does not complain about rendering a non-<button> element
              (the <Link> is an <a>). Without this prop Base UI logs
              a console error on every mount. (C2)
            */}
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/todos" />}
            >
              <PlusIcon className="size-3.5" />
              New Todo
            </Button>
            {/*
              One New Goal button, no horizon-specific variants. The goal
              modal has a Horizon dropdown (default WEEKLY) that lets the
              user pick any of the four levels. Having per-horizon buttons
              in the header was asymmetric (weekly + yearly but not
              monthly or quarterly) and cluttered the action row. (H2)
            */}
            <Button variant="outline" size="sm" onClick={() => openGoalModal("create", "WEEKLY")}>
              <PlusIcon className="size-3.5" />
              New Goal
            </Button>
          </div>

          <TodaysBig3Widget />

          <div className="mb-4" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <WeeklyFocusWidget goals={data.weeklyFocus} />
            <ProgressOverviewWidget categories={data.progressOverview} />
            <StreaksStatsWidget stats={data.streaksStats} />
            <UpcomingDeadlinesWidget goals={data.upcomingDeadlines} />
          </div>
        </>
      )}
    </div>
  );
}

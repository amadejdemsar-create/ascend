"use client";

import { useState } from "react";
import { useGoals } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import { HORIZON_ORDER } from "@/lib/constants";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalDetail } from "@/components/goals/goal-detail";
import { GoalModal } from "@/components/goals/goal-modal";
import { QuickAdd } from "@/components/goals/quick-add";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusIcon, TargetIcon } from "lucide-react";
import type { GoalFilters } from "@/lib/validations";

const HORIZON_FILTERS = [
  { value: "ALL", label: "All" },
  ...HORIZON_ORDER.map((h) => ({
    value: h,
    label: h.charAt(0) + h.slice(1).toLowerCase(),
  })),
];

export default function GoalsPage() {
  const [horizonFilter, setHorizonFilter] = useState<string>("ALL");
  const { selectedGoalId, selectGoal, openGoalModal } = useUIStore();

  const filters: GoalFilters | undefined =
    horizonFilter !== "ALL"
      ? { horizon: horizonFilter as GoalFilters["horizon"] }
      : undefined;

  const { data: goals, isLoading } = useGoals(filters);

  interface GoalListItem {
    id: string;
    title: string;
    status: string;
    horizon: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    progress: number;
    deadline?: string | null;
    children?: Array<{ id: string }>;
  }

  const goalList = (goals ?? []) as GoalListItem[];

  return (
    <>
      <div className="flex h-full">
        {/* Left panel: Goal list */}
        <div
          className={`flex-1 flex flex-col border-r overflow-y-auto ${
            selectedGoalId ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 border-b bg-background p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="font-serif text-2xl font-bold">Goals</h1>
              <Button size="sm" onClick={() => openGoalModal("create")}>
                <PlusIcon className="size-3.5" />
                New Goal
              </Button>
            </div>
            <QuickAdd />
            <Tabs
              defaultValue="ALL"
              value={horizonFilter}
              onValueChange={(val) => setHorizonFilter(val as string)}
            >
              <TabsList variant="line" className="w-full">
                {HORIZON_FILTERS.map((hf) => (
                  <TabsTrigger key={hf.value} value={hf.value}>
                    {hf.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Goal list */}
          <div className="flex-1 p-4 space-y-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))
            ) : goalList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <TargetIcon className="size-12 text-muted-foreground/40 mb-4" />
                <p className="text-lg font-medium">No goals yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first goal to start tracking your ambitions.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => openGoalModal("create")}
                >
                  <PlusIcon className="size-3.5" />
                  Create Goal
                </Button>
              </div>
            ) : (
              goalList.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onSelect={selectGoal}
                  isSelected={selectedGoalId === goal.id}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel: Detail (desktop) or full-screen overlay (mobile) */}
        {selectedGoalId && (
          <>
            {/* Desktop: side panel */}
            <div className="hidden md:flex w-[400px] lg:w-[440px] flex-col overflow-hidden">
              <GoalDetail
                goalId={selectedGoalId}
                onClose={() => selectGoal(null)}
              />
            </div>

            {/* Mobile: full-screen overlay */}
            <div className="flex md:hidden fixed inset-0 z-40 bg-background">
              <GoalDetail
                goalId={selectedGoalId}
                onClose={() => selectGoal(null)}
                isMobileOverlay
              />
            </div>
          </>
        )}

        {/* Desktop empty state when nothing selected */}
        {!selectedGoalId && (
          <div className="hidden md:flex w-[400px] lg:w-[440px] items-center justify-center text-muted-foreground border-l">
            <p className="text-sm">Select a goal to see details</p>
          </div>
        )}
      </div>

      <GoalModal />
    </>
  );
}

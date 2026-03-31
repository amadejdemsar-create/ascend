"use client";

import { useGoals } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import { HORIZON_ORDER } from "@/lib/constants";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalDetail } from "@/components/goals/goal-detail";
import { GoalModal } from "@/components/goals/goal-modal";
import { GoalViewSwitcher } from "@/components/goals/goal-view-switcher";
import { GoalFilterBar } from "@/components/goals/goal-filter-bar";
import { GoalListView } from "@/components/goals/goal-list-view";
import { GoalBoardView } from "@/components/goals/goal-board-view";
import { GoalTreeView } from "@/components/goals/goal-tree-view";
import { QuickAdd } from "@/components/goals/quick-add";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlusIcon,
  TargetIcon,
  Columns3Icon,
  GanttChartIcon,
} from "lucide-react";
import type { GoalFilters } from "@/lib/validations";

const HORIZON_FILTERS = [
  { value: "ALL", label: "All" },
  ...HORIZON_ORDER.map((h) => ({
    value: h,
    label: h.charAt(0) + h.slice(1).toLowerCase(),
  })),
];

const PLACEHOLDER_VIEWS: Record<string, { icon: typeof Columns3Icon; label: string }> = {
  timeline: { icon: GanttChartIcon, label: "Timeline view coming in Phase 7" },
};

export default function GoalsPage() {
  const activeView = useUIStore((s) => s.activeView);
  const activeFilters = useUIStore((s) => s.activeFilters);
  const setActiveFilters = useUIStore((s) => s.setActiveFilters);
  const selectedGoalId = useUIStore((s) => s.selectedGoalId);
  const selectGoal = useUIStore((s) => s.selectGoal);
  const openGoalModal = useUIStore((s) => s.openGoalModal);

  // Build GoalFilters from store activeFilters
  // The horizon tabs also sync through activeFilters.horizon
  const horizonTabValue = activeFilters.horizon ?? "ALL";

  const filters: GoalFilters | undefined = (() => {
    const f: GoalFilters = {};
    if (activeFilters.horizon) f.horizon = activeFilters.horizon;
    if (activeFilters.status) f.status = activeFilters.status;
    if (activeFilters.priority) f.priority = activeFilters.priority as GoalFilters["priority"];
    if (activeFilters.categoryId) f.categoryId = activeFilters.categoryId;
    return Object.keys(f).length > 0 ? f : undefined;
  })();

  const { data: goals, isLoading } = useGoals(filters);

  interface GoalListItem {
    id: string;
    title: string;
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
    horizon: "YEARLY" | "QUARTERLY" | "MONTHLY" | "WEEKLY";
    priority: "LOW" | "MEDIUM" | "HIGH";
    progress: number;
    deadline: string | null;
    category: {
      id: string;
      name: string;
      color: string;
      icon: string | null;
    } | null;
    children?: Array<{ id: string }>;
  }

  const goalList = (goals ?? []) as GoalListItem[];

  function handleHorizonTabChange(value: string) {
    setActiveFilters({
      ...activeFilters,
      horizon: value === "ALL" ? undefined : (value as typeof activeFilters.horizon),
    });
  }

  // Render content based on active view
  function renderContent() {
    if (isLoading) {
      return (
        <div className="p-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (goalList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <TargetIcon className="size-12 text-muted-foreground/40 mb-4" />
          <p className="text-lg font-medium">No goals yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first goal to start tracking your ambitions.
          </p>
          <Button className="mt-4" onClick={() => openGoalModal("create")}>
            <PlusIcon className="size-3.5" />
            Create Goal
          </Button>
        </div>
      );
    }

    if (activeView === "board") {
      return (
        <div className="p-4">
          <GoalBoardView goals={goalList} />
        </div>
      );
    }

    if (activeView === "tree") {
      return (
        <div className="p-4">
          <GoalTreeView />
        </div>
      );
    }

    // Future views show placeholder
    const placeholder = PLACEHOLDER_VIEWS[activeView];
    if (placeholder) {
      const Icon = placeholder.icon;
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <Icon className="size-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground">{placeholder.label}</p>
        </div>
      );
    }

    if (activeView === "list") {
      return (
        <div className="p-4">
          <GoalListView goals={goalList} />
        </div>
      );
    }

    // Default: cards view
    return (
      <div className="flex-1 p-4 space-y-2">
        {goalList.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onSelect={selectGoal}
            isSelected={selectedGoalId === goal.id}
          />
        ))}
      </div>
    );
  }

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
            {/* Row 1: Title + View Switcher + New Goal */}
            <div className="flex items-center justify-between gap-3">
              <h1 className="font-serif text-2xl font-bold">Goals</h1>
              <div className="flex items-center gap-2">
                <GoalViewSwitcher />
                <Button size="sm" onClick={() => openGoalModal("create")}>
                  <PlusIcon className="size-3.5" />
                  New Goal
                </Button>
              </div>
            </div>

            {/* Row 2: Filter bar */}
            <GoalFilterBar />

            {/* Row 3: Horizon tabs + QuickAdd */}
            <QuickAdd />
            <Tabs
              value={horizonTabValue}
              onValueChange={handleHorizonTabChange}
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

          {/* Content area */}
          {renderContent()}
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

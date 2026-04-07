"use client";

import { useCallback } from "react";
import { useGoals, useGoalTree, useReorderGoals } from "@/lib/hooks/use-goals";
import { useUIStore } from "@/lib/stores/ui-store";
import { HORIZON_ORDER } from "@/lib/constants";
import { DndGoalProvider } from "@/components/goals/dnd-goal-provider";
import { GoalCard } from "@/components/goals/goal-card";
import { GoalDetail } from "@/components/goals/goal-detail";
import { GoalViewSwitcher } from "@/components/goals/goal-view-switcher";
import { GoalFilterBar } from "@/components/goals/goal-filter-bar";
import { GoalListView } from "@/components/goals/goal-list-view";
import { GoalBoardView } from "@/components/goals/goal-board-view";
import { GoalTreeView } from "@/components/goals/goal-tree-view";
import { GoalTimelineView } from "@/components/goals/goal-timeline-view";
import { QuickAdd } from "@/components/goals/quick-add";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusIcon, TargetIcon } from "lucide-react";
import type { GoalFilters } from "@/lib/validations";
import type { GoalDragOverlayData } from "@/components/goals/goal-drag-overlay";

const HORIZON_FILTERS = [
  { value: "ALL", label: "All" },
  ...HORIZON_ORDER.map((h) => ({
    value: h,
    label: h.charAt(0) + h.slice(1).toLowerCase(),
  })),
];

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
  const { data: treeData } = useGoalTree();
  const reorderMutation = useReorderGoals();

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

  const findGoal = useCallback(
    (id: string): GoalDragOverlayData | null => {
      const g = goalList.find((gl) => gl.id === id);
      return g
        ? {
            id: g.id,
            title: g.title,
            priority: g.priority,
            progress: g.progress,
            category: g.category
              ? { name: g.category.name, color: g.category.color }
              : null,
          }
        : null;
    },
    [goalList],
  );

  const handleDragEndExtra = useCallback(
    (event: unknown) => {
      const evt = event as { canceled?: boolean; operation?: { source?: { type?: string; id?: unknown; data?: unknown } } };
      if (evt.canceled) return;
      const source = evt.operation?.source;
      if (!source) return;

      if (source.type === "goal-row") {
        // List reorder: persist all visible goals in their current order
        const items = goalList.map((g, i) => ({ id: g.id, sortOrder: i }));
        reorderMutation.mutate(items);
        return;
      }

      if (source.type === "tree-node") {
        // Tree reorder: find siblings in the same parent group
        const parentId = (source.data as Record<string, unknown>)?.parentId as string | null;
        function findSiblings(nodes: unknown[], pid: string | null): unknown[] {
          if (pid === null) return nodes;
          for (const node of nodes) {
            const n = node as { id: string; children?: unknown[] };
            if (n.id === pid) return n.children ?? [];
            const found = findSiblings(n.children ?? [], pid);
            if (found.length > 0) return found;
          }
          return [];
        }
        const siblings = findSiblings(treeData ?? [], parentId);
        if (siblings.length > 1) {
          reorderMutation.mutate(
            siblings.map((g, i) => ({
              id: (g as { id: string }).id,
              sortOrder: i,
            })),
          );
        }
      }
    },
    [goalList, treeData, reorderMutation],
  );

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
        <DndGoalProvider findGoal={findGoal} onDragEndExtra={handleDragEndExtra}>
          <div className="p-4">
            <GoalTreeView />
          </div>
        </DndGoalProvider>
      );
    }

    if (activeView === "timeline") {
      return (
        <div className="p-4">
          <GoalTimelineView />
        </div>
      );
    }

    if (activeView === "list") {
      return (
        <DndGoalProvider findGoal={findGoal} onDragEndExtra={handleDragEndExtra}>
          <div className="p-4">
            <GoalListView goals={goalList} />
          </div>
        </DndGoalProvider>
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
                  <span className="hidden sm:inline">New Goal</span>
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
    </>
  );
}

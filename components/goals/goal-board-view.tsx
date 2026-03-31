"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import { GoalBoardColumn } from "@/components/goals/goal-board-column";
import { GoalDragOverlay } from "@/components/goals/goal-drag-overlay";
import { useUIStore, type BoardGroupBy } from "@/lib/stores/ui-store";
import { useReorderGoals, useUpdateGoal } from "@/lib/hooks/use-goals";
import { useCategories } from "@/lib/hooks/use-categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { GoalListItem } from "@/components/goals/goal-list-columns";

const STATUS_COLUMNS = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"] as const;
const HORIZON_COLUMNS = ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"] as const;

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
};

const HORIZON_LABELS: Record<string, string> = {
  YEARLY: "Yearly",
  QUARTERLY: "Quarterly",
  MONTHLY: "Monthly",
  WEEKLY: "Weekly",
};

interface GoalBoardViewProps {
  goals: GoalListItem[];
}

export function GoalBoardView({ goals }: GoalBoardViewProps) {
  const boardGroupBy = useUIStore((s) => s.boardGroupBy);
  const setBoardGroupBy = useUIStore((s) => s.setBoardGroupBy);

  const { data: categories } = useCategories();
  const reorderMutation = useReorderGoals();
  const updateMutation = useUpdateGoal();

  // Derive category columns from data
  const categoryColumns = useMemo(() => {
    if (boardGroupBy !== "category") return { keys: [] as string[], labels: {} as Record<string, string> };
    const flat: { id: string; name: string }[] = [];
    function walk(cats: unknown[]) {
      for (const c of cats) {
        const cat = c as { id: string; name: string; children?: unknown[] };
        flat.push({ id: cat.id, name: cat.name });
        if (cat.children) walk(cat.children);
      }
    }
    walk(categories ?? []);
    const keys = [...flat.map((c) => c.id), "uncategorized"];
    const labels: Record<string, string> = {};
    for (const c of flat) labels[c.id] = c.name;
    labels["uncategorized"] = "Uncategorized";
    return { keys, labels };
  }, [categories, boardGroupBy]);

  // Choose columns and labels based on groupBy
  const effectiveColumns: string[] = useMemo(() => {
    if (boardGroupBy === "category") return categoryColumns.keys;
    if (boardGroupBy === "status") return [...STATUS_COLUMNS];
    return [...HORIZON_COLUMNS];
  }, [boardGroupBy, categoryColumns.keys]);

  const effectiveLabels: Record<string, string> = useMemo(() => {
    if (boardGroupBy === "category") return categoryColumns.labels;
    if (boardGroupBy === "status") return STATUS_LABELS;
    return HORIZON_LABELS;
  }, [boardGroupBy, categoryColumns.labels]);

  // Group goals into columns
  const grouped = useMemo(() => {
    const map: Record<string, GoalListItem[]> = {};
    for (const col of effectiveColumns) map[col] = [];
    for (const goal of goals) {
      const key =
        boardGroupBy === "status"
          ? goal.status
          : boardGroupBy === "horizon"
            ? goal.horizon
            : (goal.category?.id ?? "uncategorized");
      if (map[key]) map[key].push(goal);
    }
    return map;
  }, [goals, boardGroupBy, effectiveColumns]);

  // DnD state management with optimistic reorder via move()
  const [items, setItems] = useState<Record<string, GoalListItem[]>>({});
  useEffect(() => {
    setItems(grouped);
  }, [grouped]);
  const snapshot = useRef(items);

  return (
    <DragDropProvider
      onDragStart={() => {
        snapshot.current = { ...items };
        for (const key of Object.keys(snapshot.current)) {
          snapshot.current[key] = [...snapshot.current[key]];
        }
      }}
      onDragOver={(event) => {
        const { source } = event.operation;
        if (source?.type === "column") return;
        setItems((prev) => move(prev, event));
      }}
      onDragEnd={(event) => {
        if (event.canceled) {
          setItems(snapshot.current);
          return;
        }

        const source = event.operation?.source;
        if (!source) return;

        const goalId = String(source.id);

        // Find new column for this goal
        let newCol: string | null = null;
        for (const [col, colGoals] of Object.entries(items)) {
          if (colGoals.some((g) => g.id === goalId)) {
            newCol = col;
            break;
          }
        }

        let oldCol: string | null = null;
        for (const [col, colGoals] of Object.entries(snapshot.current)) {
          if (colGoals.some((g) => g.id === goalId)) {
            oldCol = col;
            break;
          }
        }

        // Cross-column: update the field
        if (newCol && oldCol && newCol !== oldCol) {
          const field =
            boardGroupBy === "status"
              ? "status"
              : boardGroupBy === "horizon"
                ? "horizon"
                : "categoryId";
          const value =
            boardGroupBy === "category" && newCol === "uncategorized"
              ? null
              : newCol;
          const data: Record<string, unknown> = { [field]: value };
          if (field === "horizon") data.parentId = null;
          updateMutation.mutate(
            { id: goalId, data: data as Parameters<typeof updateMutation.mutate>[0]["data"] },
            {
              onError: () => {
                setItems(snapshot.current);
                toast.error("Failed to move goal");
              },
            },
          );
        }

        // Persist sortOrder within the target column
        if (newCol && items[newCol]) {
          reorderMutation.mutate(
            items[newCol].map((g, i) => ({ id: g.id, sortOrder: i })),
          );
        }
      }}
    >
      <div className="space-y-3">
        {/* Grouping toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Group by:</span>
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
            {(["status", "horizon", "category"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setBoardGroupBy(option)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  boardGroupBy === option
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "status"
                  ? "Status"
                  : option === "horizon"
                    ? "Horizon"
                    : "Category"}
              </button>
            ))}
          </div>
        </div>

        {/* Column grid */}
        <div
          className={cn(
            "grid gap-3",
            effectiveColumns.length <= 4
              ? "grid-cols-2 lg:grid-cols-4"
              : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          )}
        >
          {effectiveColumns.map((col) => (
            <GoalBoardColumn
              key={col}
              columnKey={col}
              label={effectiveLabels[col] ?? col}
              goals={items[col] ?? []}
              groupBy={boardGroupBy}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease-out" }}>
        {(source) => {
          const goal = goals.find((g) => g.id === String(source?.id));
          if (!goal) return null;
          return (
            <GoalDragOverlay
              goal={{
                id: goal.id,
                title: goal.title,
                priority: goal.priority,
                progress: goal.progress,
                category: goal.category
                  ? { name: goal.category.name, color: goal.category.color }
                  : null,
              }}
            />
          );
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}

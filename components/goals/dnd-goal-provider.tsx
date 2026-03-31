"use client";

import { useRef, useCallback } from "react";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/react";
import { GoalDragOverlay } from "./goal-drag-overlay";
import type { GoalDragOverlayData } from "./goal-drag-overlay";
import { useUpdateGoal } from "@/lib/hooks/use-goals";
import { toast } from "sonner";

type DragStartEventArg = Parameters<DragStartEvent>[0];
type DragEndEventArg = Parameters<DragEndEvent>[0];

interface DndGoalProviderProps {
  children: React.ReactNode;
  /** Called to look up goal data for the drag overlay by source.id */
  findGoal?: (id: string) => GoalDragOverlayData | null;
  /** Called after the default onDragEnd handler for view-specific reorder logic */
  onDragEndExtra?: (event: DragEndEventArg) => void;
}

export function DndGoalProvider({ children, findGoal, onDragEndExtra }: DndGoalProviderProps) {
  const updateMutation = useUpdateGoal();
  const draggedGoalRef = useRef<GoalDragOverlayData | null>(null);

  const handleDragStart = useCallback(
    (event: DragStartEventArg) => {
      const source = event.operation?.source;
      if (source && findGoal) {
        draggedGoalRef.current = findGoal(String(source.id));
      }
    },
    [findGoal],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEventArg) => {
      draggedGoalRef.current = null;

      if (event.canceled) return;

      const source = event.operation?.source;
      const target = event.operation?.target;
      if (!source || !target) return;

      // Detect cross-column move (horizon or category change)
      const sourceData = source.data as Record<string, unknown> | undefined;
      const targetData = target.data as Record<string, unknown> | undefined;

      if (
        sourceData?.horizon &&
        targetData?.columnKey &&
        sourceData.horizon !== targetData.columnKey
      ) {
        // Horizon change via board view
        const newHorizon = String(targetData.columnKey) as
          | "YEARLY"
          | "QUARTERLY"
          | "MONTHLY"
          | "WEEKLY";
        updateMutation.mutate(
          {
            id: String(source.id),
            data: { horizon: newHorizon, parentId: null },
          },
          {
            onError: () =>
              toast.error(
                "Failed to change horizon. Hierarchy rules may prevent this move.",
              ),
          },
        );
        return;
      }

      if (
        sourceData?.categoryId !== undefined &&
        targetData?.categoryDropId
      ) {
        // Category change via sidebar drop
        updateMutation.mutate(
          {
            id: String(source.id),
            data: { categoryId: String(targetData.categoryDropId) },
          },
          {
            onError: () => toast.error("Failed to change category"),
          },
        );
        return;
      }

      // Call view-specific handler for reorder persistence
      onDragEndExtra?.(event);
    },
    [updateMutation, onDragEndExtra],
  );

  return (
    <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {children}
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease-out" }}>
        <GoalDragOverlay goal={draggedGoalRef.current} />
      </DragOverlay>
    </DragDropProvider>
  );
}

"use client";

import { useDroppable } from "@dnd-kit/react";
import { X, Target } from "lucide-react";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TodoListItem } from "@/components/todos/todo-list-columns";

interface Big3SlotProps {
  slotIndex: 0 | 1 | 2;
  todo: TodoListItem | null;
  onRemove: () => void;
}

export function Big3Slot({ slotIndex, todo, onRemove }: Big3SlotProps) {
  const { ref, isDropTarget } = useDroppable({
    id: `slot-${slotIndex}`,
    type: "big3-slot",
    accept: "big3-todo",
    data: { slotIndex },
  });

  if (todo === null) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-3 min-h-[100px] transition-colors",
          isDropTarget
            ? "border-primary bg-primary/10"
            : "border-border bg-background/40",
        )}
      >
        <Target className="size-4 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">#{slotIndex + 1}</p>
        <p className="text-[0.65rem] text-muted-foreground/70">Drop a todo</p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-lg border-2 p-3 min-h-[100px] transition-colors",
        isDropTarget
          ? "border-primary bg-primary/20"
          : "border-amber-400/60 bg-amber-500/10",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[0.65rem] font-semibold text-amber-600 dark:text-amber-400">
          #{slotIndex + 1}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          className="size-5 -mr-1 -mt-1"
          aria-label="Remove from slot"
        >
          <X className="size-3" />
        </Button>
      </div>
      <p className="text-sm font-medium leading-snug mt-1 line-clamp-2">
        {todo.title}
      </p>
      <div className="mt-2">
        <GoalPriorityBadge priority={todo.priority} />
      </div>
    </div>
  );
}

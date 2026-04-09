"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Star, Sparkles, X } from "lucide-react";
import { useSetBig3 } from "@/lib/hooks/use-todos";
import type { TodoListItem } from "@/components/todos/todo-list-columns";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { Button } from "@/components/ui/button";

interface MorningPlanningPromptProps {
  todayTodos: TodoListItem[];
  onDismiss: () => void;
}

export function MorningPlanningPrompt({
  todayTodos,
  onDismiss,
}: MorningPlanningPromptProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const setBig3 = useSetBig3();

  function handleToggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 3) {
          toast("You can only pick 3 priorities. Deselect one first.");
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  async function handleSetBig3() {
    try {
      await setBig3.mutateAsync({ todoIds: Array.from(selectedIds) });
      toast.success("Big 3 set for today!");
      onDismiss();
    } catch {
      toast.error("Failed to set Big 3. Please try again.");
    }
  }

  // Empty state: no pending todos for today
  if (todayTodos.length === 0) {
    return (
      <div className="mx-4 mt-4 rounded-xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="font-serif text-xl font-semibold">Plan Your Day</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          No to-dos for today. Create some from the to-dos page to plan your day.
        </p>
        <Button variant="outline" size="sm" onClick={onDismiss}>
          Got it
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-4 rounded-xl border border-primary/20 bg-primary/5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="font-serif text-xl font-semibold">Plan Your Day</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDismiss}
          className="text-muted-foreground"
        >
          <X className="size-4" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Pick up to 3 priorities for today
      </p>

      {/* Selectable todo list */}
      <div className="space-y-1.5 mb-4">
        {todayTodos.map((todo) => {
          const isSelected = selectedIds.has(todo.id);
          return (
            <button
              key={todo.id}
              type="button"
              onClick={() => handleToggle(todo.id)}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                isSelected
                  ? "border-amber-400/60 bg-amber-500/10"
                  : "border-transparent bg-background/60 hover:bg-background"
              }`}
            >
              <Star
                className={`size-4 shrink-0 transition-colors ${
                  isSelected
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/40"
                }`}
              />
              <span className="flex-1 min-w-0 text-sm font-medium truncate">
                {todo.title}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <GoalPriorityBadge priority={todo.priority} />
                {todo.goal && (
                  <span className="text-xs text-muted-foreground max-w-[120px] truncate">
                    {todo.goal.title}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer buttons */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={selectedIds.size === 0 || setBig3.isPending}
          onClick={handleSetBig3}
        >
          {setBig3.isPending ? "Setting..." : "Set Big 3"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

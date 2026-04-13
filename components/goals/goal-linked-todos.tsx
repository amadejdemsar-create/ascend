"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, Star, Repeat } from "lucide-react";
import { useTodos, useCompleteTodo, useUncompleteTodo } from "@/lib/hooks/use-todos";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { TodoListItem } from "@/components/todos/todo-list-columns";

interface GoalLinkedTodosProps {
  goalId: string;
}

export function GoalLinkedTodos({ goalId }: GoalLinkedTodosProps) {
  const { data, isLoading } = useTodos({ goalId });
  const completeTodo = useCompleteTodo();
  const uncompleteTodo = useUncompleteTodo();

  const todos = data as TodoListItem[] | undefined;

  const sortedTodos = useMemo(() => {
    if (!todos) return [];
    return [...todos].sort((a, b) => {
      // Pending first, then done
      if (a.status !== b.status) {
        if (a.status === "PENDING") return -1;
        if (b.status === "PENDING") return 1;
      }
      // Within the same status group, sort by due date ascending (nulls last)
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aDate - bDate;
    });
  }, [todos]);

  const pendingCount = useMemo(
    () => sortedTodos.filter((t) => t.status === "PENDING").length,
    [sortedTodos],
  );

  async function handleToggle(todo: TodoListItem) {
    try {
      if (todo.status === "DONE") {
        await uncompleteTodo.mutateAsync(todo.id);
        toast.success("Todo reopened");
      } else {
        await completeTodo.mutateAsync(todo.id);
        toast.success("Todo completed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Linked Todos</Label>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">
        Linked Todos ({pendingCount}/{sortedTodos.length})
      </Label>

      {sortedTodos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No todos linked to this goal. Link a todo from the Todos page.
        </p>
      ) : (
        <div className="space-y-1">
          {sortedTodos.map((todo) => {
            const isDone = todo.status === "DONE";
            return (
              <div
                key={todo.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
              >
                <button
                  type="button"
                  aria-label={isDone ? "Mark as pending" : "Mark as done"}
                  onClick={() => handleToggle(todo)}
                  className={`size-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 hover:border-primary"
                  }`}
                >
                  {isDone && <Check className="size-3" strokeWidth={3} />}
                </button>

                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {todo.isBig3 && (
                    <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
                  )}
                  <span
                    className={`truncate text-sm ${
                      isDone ? "line-through text-muted-foreground" : "font-medium"
                    }`}
                  >
                    {todo.title}
                  </span>
                  {todo.isRecurring && (
                    <Repeat className="size-3 shrink-0 text-muted-foreground" />
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <GoalPriorityBadge priority={todo.priority} />
                  {todo.dueDate && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(todo.dueDate), "MMM d")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

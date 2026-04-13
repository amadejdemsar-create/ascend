"use client";

import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { toast } from "sonner";
import {
  useTodosByDate,
  useTop3Todos,
  useCompleteTodo,
  useUncompleteTodo,
} from "@/lib/hooks/use-todos";
import { useGoalDeadlinesByRange } from "@/lib/hooks/use-goals";
import type { GoalDeadlineItem } from "@/lib/hooks/use-goals";
import type { TodoListItem } from "@/components/todos/todo-list-columns";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { MorningPlanningPrompt } from "@/components/calendar/morning-planning-prompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeftIcon,
  AlertTriangle,
  Star,
  Repeat,
  Flag,
  CheckCircle2,
} from "lucide-react";

interface CalendarDayDetailProps {
  date: Date;
  onClose?: () => void;
  isMobileOverlay?: boolean;
}

export function CalendarDayDetail({
  date,
  onClose,
  isMobileOverlay,
}: CalendarDayDetailProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const isViewingToday = isSameDay(date, new Date());
  const [promptDismissed, setPromptDismissed] = useState(false);

  const { data: rawDayTodos, isLoading: todosLoading } = useTodosByDate(dateStr);
  const { data: rawBig3, isLoading: big3Loading } = useTop3Todos(dateStr);
  const { data: rawDeadlines, isLoading: deadlinesLoading } =
    useGoalDeadlinesByRange(dateStr, dateStr);
  const completeTodo = useCompleteTodo();
  const uncompleteTodo = useUncompleteTodo();

  const dayTodos = (rawDayTodos ?? []) as TodoListItem[];
  const big3 = (rawBig3 ?? []) as TodoListItem[];
  const deadlines = (rawDeadlines ?? []) as GoalDeadlineItem[];

  const isLoading = todosLoading || big3Loading || deadlinesLoading;

  // Compute overdue items (only for today view)
  const overdueTodos = isViewingToday
    ? dayTodos.filter((t) => {
        if (t.status !== "PENDING" || !t.dueDate) return false;
        const due = new Date(t.dueDate);
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        return due < todayMidnight;
      })
    : [];

  // Big 3 IDs for exclusion
  const big3Ids = new Set(big3.map((t) => t.id));
  const overdueIds = new Set(overdueTodos.map((t) => t.id));

  // Other todos: not Big 3, not overdue from previous days
  const otherTodos = dayTodos.filter(
    (t) => !big3Ids.has(t.id) && !overdueIds.has(t.id),
  );

  const isEmpty =
    big3.length === 0 &&
    overdueTodos.length === 0 &&
    otherTodos.length === 0 &&
    deadlines.length === 0;

  async function handleToggle(todoId: string, currentStatus: string) {
    try {
      if (currentStatus === "DONE") {
        // Use the proper inverse: uncomplete reverses XP, goal progress,
        // and the recurring streak inside a transaction. The previous
        // implementation used updateTodo to flip status, which left XP,
        // progress, and streak permanently inflated.
        await uncompleteTodo.mutateAsync(todoId);
      } else if (currentStatus === "SKIPPED") {
        // SKIPPED never awarded XP or touched goal progress, so a
        // straight re-complete is correct here.
        await completeTodo.mutateAsync(todoId);
      } else {
        await completeTodo.mutateAsync(todoId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update to-do");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 border-b p-4">
        {isMobileOverlay && onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <ArrowLeftIcon className="size-4" />
          </Button>
        )}
        <h2 className="text-lg font-serif font-semibold">
          {format(date, "EEEE, d MMMM yyyy")}
        </h2>
      </div>

      {/* Morning planning prompt (today only, when no Big 3 set) */}
      {isViewingToday && !promptDismissed && big3.length === 0 && (
        <MorningPlanningPrompt
          todayTodos={dayTodos.filter((t) => t.status === "PENDING")}
          onDismiss={() => setPromptDismissed(true)}
        />
      )}

      <div className="flex-1 space-y-4 p-4">
        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No to-dos or deadlines for this day.
            </p>
          </div>
        )}

        {/* Overdue section (today only) */}
        {overdueTodos.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertTriangle className="size-4" />
              <h3 className="text-sm font-semibold">Overdue</h3>
            </div>
            <div className="space-y-1.5 border-l-2 border-destructive pl-3">
              {overdueTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{todo.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due{" "}
                      {todo.dueDate
                        ? format(new Date(todo.dueDate), "d MMM")
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <GoalPriorityBadge priority={todo.priority} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(todo.id, todo.status)}
                      disabled={completeTodo.isPending}
                      className="gap-1"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Done
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Big 3 section */}
        {big3.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-amber-500">
              <Star className="size-4 fill-amber-400 text-amber-400" />
              <h3 className="text-sm font-semibold">
                {isViewingToday ? "Today's Big 3" : `Big 3`}
              </h3>
            </div>
            <div className="space-y-1.5">
              {big3.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-2 rounded-lg border bg-card p-3"
                >
                  <button
                    className={`shrink-0 size-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      todo.status === "DONE"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40 hover:border-primary"
                    }`}
                    onClick={() => handleToggle(todo.id, todo.status)}
                    disabled={completeTodo.isPending || uncompleteTodo.isPending}
                  >
                    {todo.status === "DONE" && (
                      <CheckCircle2 className="size-3" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        todo.status === "DONE"
                          ? "line-through text-muted-foreground"
                          : ""
                      }`}
                    >
                      {todo.title}
                    </p>
                    {todo.goal && (
                      <span className="text-xs text-muted-foreground">
                        {todo.goal.title}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Other to-dos section */}
        {otherTodos.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Todos
            </h3>
            <div className="space-y-1">
              {otherTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/50 transition-colors"
                >
                  <button
                    className={`shrink-0 size-4 rounded border flex items-center justify-center transition-colors ${
                      todo.status === "DONE"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40 hover:border-primary"
                    }`}
                    onClick={() => handleToggle(todo.id, todo.status)}
                    disabled={completeTodo.isPending || uncompleteTodo.isPending}
                  >
                    {todo.status === "DONE" && (
                      <CheckCircle2 className="size-2.5" />
                    )}
                  </button>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {todo.isRecurring && (
                      <Repeat className="size-3 shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className={`text-sm truncate ${
                        todo.status === "DONE"
                          ? "line-through text-muted-foreground"
                          : ""
                      }`}
                    >
                      {todo.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <GoalPriorityBadge priority={todo.priority} />
                    {todo.category && (
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: todo.category.color }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Goal deadlines section */}
        {deadlines.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Flag className="size-4 text-amber-500" />
              <h3 className="text-sm font-semibold">Goal Deadlines</h3>
            </div>
            <div className="space-y-1.5">
              {deadlines.map((goal) => (
                <div
                  key={goal.id}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1"
                >
                  <p className="text-sm font-medium">{goal.title}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[0.65rem] px-1.5 py-0">
                      {goal.horizon}
                    </Badge>
                    <GoalPriorityBadge
                      priority={goal.priority as "LOW" | "MEDIUM" | "HIGH"}
                    />
                    {goal.category && (
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: goal.category.color }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

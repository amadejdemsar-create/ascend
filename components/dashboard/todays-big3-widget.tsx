"use client";

import Link from "next/link";
import { Star, ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { useTop3Todos, useCompleteTodo } from "@/lib/hooks/use-todos";
import type { TodoListItem } from "@/components/todos/todo-list-columns";

export function TodaysBig3Widget() {
  const { data: rawBig3, isLoading } = useTop3Todos();
  const completeTodo = useCompleteTodo();

  const big3 = (rawBig3 ?? []) as TodoListItem[];

  async function handleComplete(todoId: string) {
    await completeTodo.mutateAsync(todoId);
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="size-4 fill-amber-400 text-amber-400" />
            Today&apos;s Big 3
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-5 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (big3.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="size-4 fill-amber-400 text-amber-400" />
            Today&apos;s Big 3
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              No Big 3 set for today
            </p>
            <Link
              href="/calendar"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1 text-sm font-medium hover:bg-muted transition-colors"
            >
              Set priorities
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="size-4 fill-amber-400 text-amber-400" />
          Today&apos;s Big 3
        </CardTitle>
        <p className="text-xs text-muted-foreground">Three todos you will finish today, no matter what.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {big3.map((todo) => (
          <div
            key={todo.id}
            className="flex items-center gap-3 rounded-lg border bg-card p-3"
          >
            <button
              className={`shrink-0 size-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                todo.status === "DONE"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40 hover:border-primary"
              }`}
              onClick={() => handleComplete(todo.id)}
              disabled={completeTodo.isPending || todo.status === "DONE"}
            >
              {todo.status === "DONE" && (
                <CheckCircle2 className="size-3" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {todo.category && (
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: todo.category.color }}
                  />
                )}
                <span
                  className={`text-sm font-medium truncate ${
                    todo.status === "DONE"
                      ? "line-through text-muted-foreground"
                      : ""
                  }`}
                >
                  {todo.title}
                </span>
              </div>
              {todo.goal && (
                <div className="flex items-center gap-1 mt-0.5">
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">
                    {todo.goal.title}
                  </span>
                </div>
              )}
            </div>
            <GoalPriorityBadge priority={todo.priority} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTodo, useCompleteTodo, useSkipTodo, useDeleteTodo, useUpdateTodo } from "@/lib/hooks/use-todos";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  XIcon,
  ArrowLeftIcon,
  Trash2Icon,
  CheckCircle2,
  SkipForward,
  Star,
  Repeat,
  Flame,
  Link2,
  CalendarDays,
  AlertCircle,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pending", variant: "outline" },
  DONE: { label: "Done", variant: "default" },
  SKIPPED: { label: "Skipped", variant: "secondary" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TodoData = Record<string, any>;

interface TodoDetailProps {
  todoId: string;
  onClose: () => void;
  isMobileOverlay?: boolean;
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status !== "PENDING") return false;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}

export function TodoDetail({ todoId, onClose, isMobileOverlay }: TodoDetailProps) {
  const { data: todo, isLoading } = useTodo(todoId) as {
    data: TodoData | undefined;
    isLoading: boolean;
  };
  const completeTodo = useCompleteTodo();
  const skipTodo = useSkipTodo();
  const deleteTodo = useDeleteTodo();
  const updateTodo = useUpdateTodo();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!todo) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        To-do not found.
      </div>
    );
  }

  async function handleComplete() {
    try {
      await completeTodo.mutateAsync(todoId);
      toast.success("To-do completed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete";
      toast.error(message);
    }
  }

  async function handleSkip() {
    try {
      await skipTodo.mutateAsync(todoId);
      toast.success("To-do skipped");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to skip";
      toast.error(message);
    }
  }

  async function handleDelete() {
    try {
      await deleteTodo.mutateAsync(todoId);
      toast.success("To-do deleted");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error(message);
    }
  }

  const statusConfig = STATUS_CONFIG[todo.status] ?? STATUS_CONFIG.PENDING;
  const overdue = isOverdue(todo.dueDate, todo.status);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-start gap-2 border-b p-4">
        {isMobileOverlay && (
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <ArrowLeftIcon className="size-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {todo.isBig3 && (
              <Star className="size-4 shrink-0 fill-amber-400 text-amber-400" />
            )}
            <h2 className="text-lg font-serif font-semibold leading-tight truncate">
              {todo.title}
            </h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <GoalPriorityBadge priority={todo.priority} />
            {todo.isRecurring && (
              <Badge variant="ghost" className="text-[0.65rem] px-1.5 py-0 gap-1">
                <Repeat className="size-2.5" />
                Recurring
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isMobileOverlay && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close">
              <XIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-5 p-4">
        {/* Status section */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <div className="flex items-center gap-2">
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            {todo.status === "PENDING" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleComplete}
                  disabled={completeTodo.isPending}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" />
                  {completeTodo.isPending ? "Completing..." : "Complete"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={skipTodo.isPending}
                  className="gap-1.5"
                >
                  <SkipForward className="size-3.5" />
                  {skipTodo.isPending ? "Skipping..." : "Skip"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Details section */}
        <div className="space-y-3 rounded-lg border border-border p-3">
          {/* Due date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Due date</span>
            </div>
            {todo.dueDate ? (
              <div className="flex items-center gap-1.5">
                {overdue && <AlertCircle className="size-3.5 text-destructive" />}
                <span
                  className={`text-sm ${overdue ? "text-destructive font-medium" : ""}`}
                >
                  {new Date(todo.dueDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">None</span>
            )}
          </div>

          {/* Category */}
          {todo.category && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Category</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: todo.category.color }}
                />
                <span className="text-sm">{todo.category.name}</span>
              </div>
            </div>
          )}

          {/* Linked goal */}
          {todo.goal && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Link2 className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Linked goal</span>
              </div>
              <span className="text-sm font-medium truncate max-w-[200px]">
                {todo.goal.title}
              </span>
            </div>
          )}

          {/* Recurring info */}
          {todo.isRecurring && (
            <div className="flex items-center gap-4 mt-2 pt-2 border-t">
              <div className="flex items-center gap-1.5">
                <Flame className="size-3.5 text-orange-500" />
                <span className="text-sm font-medium">{todo.currentStreak ?? 0}</span>
                <span className="text-xs text-muted-foreground">streak</span>
              </div>
              {todo.consistencyScore != null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">
                    {Math.round(todo.consistencyScore * 100)}%
                  </span>
                  <span className="text-xs text-muted-foreground">consistency</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Description</Label>
          {todo.description ? (
            <p className="text-sm whitespace-pre-wrap">{todo.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description</p>
          )}
        </div>

        <Separator />

        {/* Danger zone */}
        <div className="space-y-2">
          <Label className="text-xs text-destructive">Danger Zone</Label>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="gap-1.5"
          >
            <Trash2Icon className="size-3.5" />
            Delete To-do
          </Button>
        </div>
      </div>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(o) => setDeleteDialogOpen(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete To-do?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{todo.title}&rdquo;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteTodo.isPending}
            >
              {deleteTodo.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

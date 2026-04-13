"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTodo, useCompleteTodo, useSkipTodo, useDeleteTodo, useUpdateTodo } from "@/lib/hooks/use-todos";
import { useCategories } from "@/lib/hooks/use-categories";
import { useGoals } from "@/lib/hooks/use-goals";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  RotateCcw,
  PencilIcon,
} from "lucide-react";
import { isOverdue } from "@/lib/todo-utils";
import { StreakHeatmap } from "./streak-heatmap";

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

export function TodoDetail({ todoId, onClose, isMobileOverlay }: TodoDetailProps) {
  const { data: todo, isLoading } = useTodo(todoId) as {
    data: TodoData | undefined;
    isLoading: boolean;
  };
  const completeTodo = useCompleteTodo();
  const skipTodo = useSkipTodo();
  const deleteTodo = useDeleteTodo();
  const updateTodo = useUpdateTodo();
  const { data: rawCategories } = useCategories();
  const { data: rawGoals } = useGoals();
  const categories = (rawCategories ?? []) as Array<{ id: string; name: string; color: string }>;
  const goals = (rawGoals ?? []) as Array<{ id: string; title: string }>;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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
        Todo not found.
      </div>
    );
  }

  function startEditing(field: string, currentValue: string) {
    setEditingField(field);
    setEditValue(currentValue || "");
  }

  async function saveField(field: string) {
    setEditingField(null);
    const trimmed = editValue.trim();
    if (trimmed === (todo?.[field] ?? "")) return;

    try {
      await updateTodo.mutateAsync({
        id: todoId,
        data: { [field]: trimmed || null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      toast.error(message);
    }
  }

  async function handleComplete() {
    try {
      await completeTodo.mutateAsync(todoId);
      toast.success("Todo completed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete";
      toast.error(message);
    }
  }

  async function handleSkip() {
    try {
      await skipTodo.mutateAsync(todoId);
      toast.success("Todo skipped");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to skip";
      toast.error(message);
    }
  }

  async function handleReopen() {
    try {
      await updateTodo.mutateAsync({
        id: todoId,
        data: { status: "PENDING" },
      });
      toast.success("Todo reopened");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reopen";
      toast.error(message);
    }
  }

  async function handleDelete() {
    try {
      await deleteTodo.mutateAsync(todoId);
      toast.success("Todo deleted");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error(message);
    }
  }

  async function handleDueDateChange(val: string) {
    try {
      await updateTodo.mutateAsync({
        id: todoId,
        data: { dueDate: val ? new Date(val).toISOString() : undefined },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update due date";
      toast.error(message);
    }
  }

  async function handleCategoryChange(val: string) {
    try {
      await updateTodo.mutateAsync({
        id: todoId,
        data: { categoryId: val === "__none__" ? null : val },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update category";
      toast.error(message);
    }
  }

  async function handleGoalChange(val: string) {
    try {
      await updateTodo.mutateAsync({
        id: todoId,
        data: { goalId: val === "__none__" ? null : val },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update linked goal";
      toast.error(message);
    }
  }

  async function handlePriorityChange(val: string) {
    if (!val || val === todo?.priority) return;
    try {
      await updateTodo.mutateAsync({
        id: todoId,
        data: { priority: val as "LOW" | "MEDIUM" | "HIGH" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update priority";
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
          {editingField === "title" ? (
            <Input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveField("title")}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveField("title");
                if (e.key === "Escape") setEditingField(null);
              }}
              className="text-lg font-serif font-semibold"
            />
          ) : (
            <div className="flex items-center gap-1.5">
              {todo.isBig3 && (
                <Star className="size-4 shrink-0 fill-amber-400 text-amber-400" />
              )}
              <button
                type="button"
                onClick={() => startEditing("title", todo.title)}
                className="text-left text-lg font-serif font-semibold hover:text-primary transition-colors leading-tight truncate"
              >
                {todo.title}
              </button>
            </div>
          )}
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
        {/* Status and Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
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
                    {completeTodo.isPending ? "..." : "Complete"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSkip}
                    disabled={skipTodo.isPending}
                    className="gap-1.5"
                  >
                    <SkipForward className="size-3.5" />
                    {skipTodo.isPending ? "..." : "Skip"}
                  </Button>
                </>
              )}
              {(todo.status === "DONE" || todo.status === "SKIPPED") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReopen}
                  disabled={updateTodo.isPending}
                  className="gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  {updateTodo.isPending ? "Reopening..." : "Reopen"}
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select value={todo.priority} onValueChange={handlePriorityChange}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  <GoalPriorityBadge priority={todo.priority} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
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
            <div className="flex items-center gap-1.5">
              {overdue && <AlertCircle className="size-3.5 text-destructive" />}
              <Input
                type="date"
                value={todo.dueDate ? format(new Date(todo.dueDate), "yyyy-MM-dd") : ""}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="w-fit h-8 text-sm"
              />
            </div>
          </div>

          {/* Category */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Category</span>
            <Select
              value={todo.category?.id ?? "__none__"}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue>
                  {todo.category ? (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: todo.category.color }}
                      />
                      <span className="text-sm">{todo.category.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">None</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linked goal */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Link2 className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Linked goal</span>
            </div>
            <Select
              value={todo.goal?.id ?? "__none__"}
              onValueChange={handleGoalChange}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue>
                  {todo.goal ? (
                    <span className="text-sm font-medium truncate">
                      {todo.goal.title}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">None</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          {/* Streak heatmap for recurring todos */}
          {todo.isRecurring && (
            <StreakHeatmap todoId={todo.recurringSourceId ?? todoId} />
          )}
        </div>

        {/* Description */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Description</Label>
          {editingField === "description" ? (
            <Textarea
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveField("description")}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingField(null);
              }}
              rows={3}
              placeholder="Add a description..."
            />
          ) : (
            <button
              type="button"
              onClick={() => startEditing("description", todo.description ?? "")}
              className="w-full text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted transition-colors min-h-[2rem]"
            >
              {todo.description ? (
                <span className="whitespace-pre-wrap">{todo.description}</span>
              ) : (
                <span className="text-muted-foreground">Click to add description...</span>
              )}
            </button>
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
            Delete Todo
          </Button>
        </div>
      </div>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(o) => setDeleteDialogOpen(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Todo?</AlertDialogTitle>
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

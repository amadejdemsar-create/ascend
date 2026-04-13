"use client";

import { toast } from "sonner";
import { useUpdateTodo, useCompleteTodo } from "@/lib/hooks/use-todos";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AlertCircle, CalendarClock, CheckCircle2 } from "lucide-react";

interface TodoOverdueActionsProps {
  todoId: string;
  dueDate: string;
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function TodoOverdueActions({ todoId, dueDate }: TodoOverdueActionsProps) {
  const updateTodo = useUpdateTodo();
  const completeTodo = useCompleteTodo();

  async function handleReschedule(newDate: string) {
    try {
      await updateTodo.mutateAsync({
        id: todoId,
        data: { dueDate: newDate },
      });
      toast.success("Todo rescheduled");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reschedule";
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

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 text-destructive hover:text-destructive"
            title="Overdue actions"
          />
        }
      >
        <AlertCircle className="size-3.5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
        <DropdownMenuItem onClick={() => handleReschedule(toISODate(today))}>
          <CalendarClock className="size-4" />
          Reschedule to today
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleReschedule(toISODate(tomorrow))}>
          <CalendarClock className="size-4" />
          Reschedule to tomorrow
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleComplete}>
          <CheckCircle2 className="size-4" />
          Complete now
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

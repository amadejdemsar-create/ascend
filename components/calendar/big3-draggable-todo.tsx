"use client";

import { useDraggable } from "@dnd-kit/react";
import { Star, Repeat } from "lucide-react";
import { GoalPriorityBadge } from "@/components/goals/goal-priority-badge";
import { cn } from "@/lib/utils";
import type { TodoListItem } from "@/components/todos/todo-list-columns";

interface DraggableTodoProps {
  todo: TodoListItem;
}

export function Big3DraggableTodo({ todo }: DraggableTodoProps) {
  const { ref, isDragging } = useDraggable({
    id: todo.id,
    type: "big3-todo",
    data: { todoId: todo.id },
  });

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-3 py-2 cursor-grab active:cursor-grabbing transition-opacity touch-none",
        isDragging && "opacity-40",
      )}
    >
      {todo.isBig3 && (
        <>
          <Star aria-hidden="true" className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
          <span className="sr-only">Big 3</span>
        </>
      )}
      {todo.isRecurring && (
        <>
          <Repeat aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
          <span className="sr-only">Recurring</span>
        </>
      )}
      <span className="flex-1 text-sm truncate">{todo.title}</span>
      <GoalPriorityBadge priority={todo.priority} />
    </div>
  );
}

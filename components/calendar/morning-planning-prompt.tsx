"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";
import { DragDropProvider, PointerSensor } from "@dnd-kit/react";
import type { DragEndEvent } from "@dnd-kit/react";
import { PointerActivationConstraints } from "@dnd-kit/dom";
import { useSetBig3 } from "@/lib/hooks/use-todos";
import type { TodoListItem } from "@/components/todos/todo-list-columns";
import { Button } from "@/components/ui/button";
import { Big3Slot } from "./big3-slot";
import { Big3DraggableTodo } from "./big3-draggable-todo";

type DragEndEventArg = Parameters<DragEndEvent>[0];

interface MorningPlanningPromptProps {
  todayTodos: TodoListItem[];
  onDismiss: () => void;
}

type Slots = [
  TodoListItem | null,
  TodoListItem | null,
  TodoListItem | null,
];

export function MorningPlanningPrompt({
  todayTodos,
  onDismiss,
}: MorningPlanningPromptProps) {
  const [slots, setSlots] = useState<Slots>([null, null, null]);
  const setBig3 = useSetBig3();

  // Todos not currently in any slot
  const pool = todayTodos.filter((t) => !slots.some((s) => s?.id === t.id));
  const filledCount = slots.filter((s) => s !== null).length;

  function handleRemoveFromSlot(index: number) {
    const removed = slots[index];
    if (!removed) return;
    setSlots((prev) => {
      const next = [...prev] as Slots;
      next[index] = null;
      return next;
    });
    toast(`Removed "${removed.title}" from slot #${index + 1}`, {
      action: {
        label: "Undo",
        onClick: () => {
          setSlots((prev) => {
            const next = [...prev] as Slots;
            next[index] = removed;
            return next;
          });
        },
      },
    });
  }

  const handleDragEnd = useCallback(
    (event: DragEndEventArg) => {
      if (event.canceled) return;

      const source = event.operation?.source;
      const target = event.operation?.target;
      if (!source || !target) return;

      // Only handle big3-todo → big3-slot drops
      if (source.type !== "big3-todo" || target.type !== "big3-slot") return;

      const todoId = String(source.id);
      const targetData = target.data as
        | { slotIndex?: number }
        | undefined;
      const slotIndex = targetData?.slotIndex;
      if (slotIndex !== 0 && slotIndex !== 1 && slotIndex !== 2) return;

      const todo = todayTodos.find((t) => t.id === todoId);
      if (!todo) return;

      setSlots((prev) => {
        const next = [...prev] as Slots;
        // If the todo is already in another slot, clear that slot first
        for (let i = 0; i < 3; i++) {
          if (next[i]?.id === todoId) next[i] = null;
        }
        // Place todo in the target slot (any previous occupant drops out
        // and re-appears in the pool via the filter above).
        next[slotIndex] = todo;
        return next;
      });
    },
    [todayTodos],
  );

  async function handleSetBig3() {
    const todoIds = slots
      .filter((s): s is TodoListItem => s !== null)
      .map((s) => s.id);
    if (todoIds.length === 0) return;
    try {
      await setBig3.mutateAsync({ todoIds });
      toast.success("Big 3 set for today!");
      onDismiss();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to set Big 3",
      );
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
        Drag your 3 priorities into the slots below
      </p>

      <DragDropProvider
        sensors={[
          PointerSensor.configure({
            activationConstraints: [
              new PointerActivationConstraints.Distance({ value: 8 }),
            ],
          }),
        ]}
        onDragEnd={handleDragEnd}
      >
        {/* Big 3 slots */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {slots.map((todo, i) => (
            <Big3Slot
              key={i}
              slotIndex={i as 0 | 1 | 2}
              todo={todo}
              onRemove={() => handleRemoveFromSlot(i)}
            />
          ))}
        </div>

        {/* Pool of remaining todos */}
        <div className="flex flex-col gap-1.5 mb-4">
          {pool.map((todo) => (
            <Big3DraggableTodo key={todo.id} todo={todo} />
          ))}
          {pool.length === 0 && filledCount === 3 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              All todos placed. Ready to go!
            </p>
          )}
        </div>
      </DragDropProvider>

      {/* Footer */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={filledCount === 0 || setBig3.isPending}
          onClick={handleSetBig3}
        >
          {setBig3.isPending ? "Setting..." : `Set Big 3 (${filledCount}/3)`}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

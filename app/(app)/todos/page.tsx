"use client";

import { useState } from "react";
import { useTodos } from "@/lib/hooks/use-todos";
import { TodoFilterBar } from "@/components/todos/todo-filter-bar";
import { TodoQuickAdd } from "@/components/todos/todo-quick-add";
import { TodoListView } from "@/components/todos/todo-list-view";
import type { TodoListItem } from "@/components/todos/todo-list-columns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare, PlusIcon } from "lucide-react";
import type { TodoFilters } from "@/lib/validations";

const PRIORITY_RANK: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

const STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  DONE: 1,
  SKIPPED: 2,
};

export default function TodosPage() {
  const [filters, setFilters] = useState<TodoFilters>({});
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

  const { data: rawTodos, isLoading } = useTodos(filters);

  // Default sort: due date ascending, then priority (high first), then status (pending first)
  const todos: TodoListItem[] = (() => {
    const items = (rawTodos ?? []) as TodoListItem[];
    return [...items].sort((a, b) => {
      // Due date ascending (nulls last)
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (aDate !== bDate) return aDate - bDate;

      // Priority: HIGH first
      const aPri = PRIORITY_RANK[a.priority] ?? 1;
      const bPri = PRIORITY_RANK[b.priority] ?? 1;
      if (aPri !== bPri) return aPri - bPri;

      // Status: PENDING first
      const aStat = STATUS_RANK[a.status] ?? 0;
      const bStat = STATUS_RANK[b.status] ?? 0;
      return aStat - bStat;
    });
  })();

  function renderContent() {
    if (isLoading) {
      return (
        <div className="p-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (todos.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <CheckSquare className="size-12 text-muted-foreground/40 mb-4" />
          <p className="text-lg font-medium">No to-dos yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first to-do to start getting things done.
          </p>
        </div>
      );
    }

    return (
      <div className="p-4">
        <TodoListView
          todos={todos}
          onSelect={setSelectedTodoId}
          selectedId={selectedTodoId}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left panel: Todo list */}
      <div
        className={`flex-1 flex flex-col border-r overflow-y-auto ${
          selectedTodoId ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-background p-4 space-y-3">
          {/* Row 1: Title */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-serif text-2xl font-bold">To-dos</h1>
          </div>

          {/* Row 2: Quick add */}
          <TodoQuickAdd />

          {/* Row 3: Filters */}
          <TodoFilterBar filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Content area */}
        {renderContent()}
      </div>

      {/* Right panel: Detail placeholder (detail panel comes in Plan 02) */}
      {selectedTodoId ? (
        <>
          {/* Desktop: side panel placeholder */}
          <div className="hidden md:flex w-[400px] lg:w-[440px] flex-col items-center justify-center text-muted-foreground">
            <p className="text-sm">To-do detail panel coming soon</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setSelectedTodoId(null)}
            >
              Close
            </Button>
          </div>

          {/* Mobile: full-screen overlay placeholder */}
          <div className="flex md:hidden fixed inset-0 z-40 bg-background items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">To-do detail panel coming soon</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setSelectedTodoId(null)}
              >
                Back to list
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="hidden md:flex w-[400px] lg:w-[440px] items-center justify-center text-muted-foreground border-l">
          <p className="text-sm">Select a to-do to see details</p>
        </div>
      )}
    </div>
  );
}

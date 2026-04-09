"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useTodos, useBulkCompleteTodos, useDeleteTodo } from "@/lib/hooks/use-todos";
import { TodoFilterBar } from "@/components/todos/todo-filter-bar";
import { TodoQuickAdd } from "@/components/todos/todo-quick-add";
import { TodoListView } from "@/components/todos/todo-list-view";
import { TodoBulkBar } from "@/components/todos/todo-bulk-bar";
import { TodoDetail } from "@/components/todos/todo-detail";
import type { TodoListItem } from "@/components/todos/todo-list-columns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare } from "lucide-react";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: rawTodos, isLoading } = useTodos(filters);
  const bulkComplete = useBulkCompleteTodos();
  const deleteTodo = useDeleteTodo();

  // Clear bulk selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters]);

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

  // Selection handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === todos.length && todos.length > 0) {
        return new Set();
      }
      return new Set(todos.map((t) => t.id));
    });
  }, [todos]);

  const allSelected = todos.length > 0 && selectedIds.size === todos.length;

  // Bulk action handlers
  async function handleBulkComplete() {
    const ids = Array.from(selectedIds);
    try {
      await bulkComplete.mutateAsync(ids);
      toast.success(`${ids.length} to-do(s) completed`);
      setSelectedIds(new Set());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete";
      toast.error(message);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => deleteTodo.mutateAsync(id)));
      toast.success(`${ids.length} to-do(s) deleted`);
      // Clear selected todo detail if it was deleted
      if (selectedTodoId && ids.includes(selectedTodoId)) {
        setSelectedTodoId(null);
      }
      setSelectedIds(new Set());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error(message);
    }
  }

  function handleDetailClose() {
    setSelectedTodoId(null);
  }

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
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          allSelected={allSelected}
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

      {/* Right panel: Detail */}
      {selectedTodoId ? (
        <>
          {/* Desktop: side panel */}
          <div className="hidden md:flex w-[400px] lg:w-[440px] flex-col border-l">
            <TodoDetail todoId={selectedTodoId} onClose={handleDetailClose} />
          </div>

          {/* Mobile: full-screen overlay */}
          <div className="flex md:hidden fixed inset-0 z-40 bg-background">
            <TodoDetail
              todoId={selectedTodoId}
              onClose={handleDetailClose}
              isMobileOverlay
            />
          </div>
        </>
      ) : (
        <div className="hidden md:flex w-[400px] lg:w-[440px] items-center justify-center text-muted-foreground border-l">
          <p className="text-sm">Select a to-do to see details</p>
        </div>
      )}

      {/* Bulk action bar */}
      <TodoBulkBar
        selectedIds={Array.from(selectedIds)}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkComplete={handleBulkComplete}
        onBulkDelete={handleBulkDelete}
      />
    </div>
  );
}

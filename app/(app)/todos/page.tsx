"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { endOfDay, addDays, endOfWeek, isBefore } from "date-fns";
import { useTodos, useBulkCompleteTodos, useDeleteTodo } from "@/lib/hooks/use-todos";
import { useUIStore, type TodoDateTab } from "@/lib/stores/ui-store";
import { TodoFilterBar } from "@/components/todos/todo-filter-bar";
import { TodoQuickAdd } from "@/components/todos/todo-quick-add";
import { TodoListView } from "@/components/todos/todo-list-view";
import { TodoBulkBar } from "@/components/todos/todo-bulk-bar";
import { TodoDetail } from "@/components/todos/todo-detail";
import type { TodoListItem } from "@/components/todos/todo-list-columns";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodoFilters } from "@/lib/validations";

const PRIORITY_RANK: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

const DATE_TABS: { value: TodoDateTab; label: string }[] = [
  { value: "today", label: "Today & Overdue" },
  { value: "week", label: "This Week" },
  { value: "all", label: "All" },
];

export default function TodosPage() {
  const [filters, setFilters] = useState<TodoFilters>({});
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const todoDateTab = useUIStore((s) => s.todoDateTab);
  const todoHideCompleted = useUIStore((s) => s.todoHideCompleted);
  const setTodoDateTab = useUIStore((s) => s.setTodoDateTab);
  const setTodoHideCompleted = useUIStore((s) => s.setTodoHideCompleted);

  const { data: rawTodos, isLoading } = useTodos(filters);
  const bulkComplete = useBulkCompleteTodos();
  const deleteTodo = useDeleteTodo();

  // Clear bulk selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters, todoDateTab, todoHideCompleted]);

  // Filter by date tab + hide completed, then sort: Big 3 first, due date asc, priority desc
  const todos: TodoListItem[] = useMemo(() => {
    let items = (rawTodos ?? []) as TodoListItem[];

    // Hide completed/skipped
    if (todoHideCompleted) {
      items = items.filter((t) => t.status === "PENDING");
    }

    // Date tab filtering
    const now = new Date();
    const todayEnd = endOfDay(now);
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    if (todoDateTab === "today") {
      items = items.filter((t) => {
        if (!t.dueDate) return true; // No due date: always show
        const due = new Date(t.dueDate);
        // Show if due today or overdue
        return isBefore(due, addDays(todayEnd, 1));
      });
    } else if (todoDateTab === "week") {
      items = items.filter((t) => {
        if (!t.dueDate) return true;
        const due = new Date(t.dueDate);
        // Show if due this week or overdue
        return isBefore(due, addDays(weekEnd, 1));
      });
    }
    // "all" tab: no date filtering

    // Sort: Big 3 first, then due date asc, then priority desc
    return [...items].sort((a, b) => {
      // Big 3 first
      const aBig3 = a.isBig3 ? 0 : 1;
      const bBig3 = b.isBig3 ? 0 : 1;
      if (aBig3 !== bBig3) return aBig3 - bBig3;

      // Due date ascending (nulls last)
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (aDate !== bDate) return aDate - bDate;

      // Priority: HIGH first
      const aPri = PRIORITY_RANK[a.priority] ?? 1;
      const bPri = PRIORITY_RANK[b.priority] ?? 1;
      return aPri - bPri;
    });
  }, [rawTodos, todoDateTab, todoHideCompleted]);

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
          {/* Row 1: Title + hide completed toggle */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-serif text-2xl font-bold">Todos</h1>
            <button
              type="button"
              onClick={() => setTodoHideCompleted(!todoHideCompleted)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={todoHideCompleted ? "Show completed" : "Hide completed"}
            >
              {todoHideCompleted ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
              {todoHideCompleted ? "Show done" : "Hide done"}
            </button>
          </div>

          {/* Row 2: Date tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {DATE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setTodoDateTab(tab.value)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  todoDateTab === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Row 3: Quick add */}
          <TodoQuickAdd />

          {/* Row 4: Filters */}
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

import type { GoalFilters, TodoFilters, ContextFilters } from "@/lib/validations";

export const queryKeys = {
  goals: {
    all: () => ["goals"] as const,
    list: (filters?: GoalFilters) => ["goals", "list", filters] as const,
    detail: (id: string) => ["goals", "detail", id] as const,
    tree: () => ["goals", "tree"] as const,
    progress: (goalId: string) => ["goals", "progress", goalId] as const,
    deadlineRange: (start: string, end: string) => ["goals", "deadline-range", start, end] as const,
  },
  todos: {
    all: () => ["todos"] as const,
    list: (filters?: TodoFilters) => ["todos", "list", filters] as const,
    detail: (id: string) => ["todos", "detail", id] as const,
    byDate: (date: string) => ["todos", "by-date", date] as const,
    byRange: (start: string, end: string) => ["todos", "by-range", start, end] as const,
    big3: (date?: string) => ["todos", "big3", date] as const,
    search: (q: string) => ["todos", "search", q] as const,
    streakHistory: (todoId: string) => ["todos", "streak-history", todoId] as const,
  },
  context: {
    all: () => ["context"] as const,
    list: (filters?: ContextFilters) => ["context", "list", filters] as const,
    detail: (id: string) => ["context", "detail", id] as const,
    search: (q: string) => ["context", "search", q] as const,
  },
  categories: {
    all: () => ["categories"] as const,
    tree: () => ["categories", "tree"] as const,
  },
  review: {
    weekly: (weekStart: string) => ["review", "weekly", weekStart] as const,
  },
  analytics: {
    all: () => ["analytics"] as const,
    trends: (weeks?: number) => ["analytics", "trends", weeks] as const,
  },
  focus: {
    all: () => ["focus"] as const,
    list: (filters?: unknown) => ["focus", "list", filters] as const,
    summaryWeek: () => ["focus", "summary", "week"] as const,
    summaryTodo: (todoId: string) => ["focus", "summary", "todo", todoId] as const,
    summaryGoal: (goalId: string) => ["focus", "summary", "goal", goalId] as const,
  },
  dashboard: () => ["dashboard"] as const,
};

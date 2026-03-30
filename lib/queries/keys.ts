import type { GoalFilters } from "@/lib/validations";

export const queryKeys = {
  goals: {
    all: () => ["goals"] as const,
    list: (filters?: GoalFilters) => ["goals", "list", filters] as const,
    detail: (id: string) => ["goals", "detail", id] as const,
    tree: () => ["goals", "tree"] as const,
  },
  categories: {
    all: () => ["categories"] as const,
    tree: () => ["categories", "tree"] as const,
  },
};

"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useCategories } from "@/lib/hooks/use-categories";
import { useGoals } from "@/lib/hooks/use-goals";
import type { TodoFilters } from "@/lib/validations";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "DONE", label: "Done" },
  { value: "SKIPPED", label: "Skipped" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
] as const;

interface CategoryFlat {
  id: string;
  name: string;
  depth: number;
  children?: CategoryFlat[];
}

function flattenCategories(nodes: CategoryFlat[], depth = 0): CategoryFlat[] {
  const result: CategoryFlat[] = [];
  for (const node of nodes) {
    result.push({ ...node, depth });
    if (node.children?.length) {
      result.push(...flattenCategories(node.children, depth + 1));
    }
  }
  return result;
}

interface TodoFilterBarProps {
  filters: TodoFilters;
  onFiltersChange: (filters: TodoFilters) => void;
}

export function TodoFilterBar({ filters, onFiltersChange }: TodoFilterBarProps) {
  const { data: categoryTree } = useCategories();
  const { data: goals } = useGoals();

  const flatCategories = categoryTree
    ? flattenCategories(categoryTree as CategoryFlat[])
    : [];

  // Group goals by horizon for a structured dropdown instead of a flat list
  const allGoals = (goals ?? []) as Array<{ id: string; title: string; horizon: string; parentId: string | null }>;
  const topLevelGoals = allGoals.filter((g) => g.parentId === null);
  const childGoals = allGoals.filter((g) => g.parentId !== null);

  const hasActiveFilters =
    !!filters.status ||
    !!filters.priority ||
    !!filters.categoryId ||
    !!filters.goalId;

  function handleChange(
    field: keyof TodoFilters,
    value: string | null,
  ) {
    onFiltersChange({
      ...filters,
      [field]: value || undefined,
    });
  }

  function clearAll() {
    onFiltersChange({});
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={filters.status ?? ""}
        onValueChange={(v) => handleChange("status", v)}
      >
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All statuses</SelectItem>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.priority ?? ""}
        onValueChange={(v) => handleChange("priority", v)}
      >
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue placeholder="All priorities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All priorities</SelectItem>
          {PRIORITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.categoryId ?? ""}
        onValueChange={(v) => handleChange("categoryId", v)}
      >
        <SelectTrigger className="h-8 w-[160px]">
          <SelectValue placeholder="All categories">
            {filters.categoryId
              ? flatCategories.find((c) => c.id === filters.categoryId)?.name ?? "All categories"
              : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All categories</SelectItem>
          {flatCategories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              <span style={{ paddingLeft: cat.depth > 0 ? `${cat.depth * 12}px` : undefined }}>
                {cat.depth > 0 && <span className="text-[10px] text-muted-foreground/50 mr-1">&#x2514;</span>}
                {cat.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.goalId ?? ""}
        onValueChange={(v) => handleChange("goalId", v)}
      >
        <SelectTrigger className="h-8 w-[160px]">
          <SelectValue placeholder="All goals">
            {filters.goalId
              ? allGoals.find((g) => g.id === filters.goalId)?.title ?? "All goals"
              : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectItem value="">All goals</SelectItem>
          {topLevelGoals.map((goal) => {
            const children = childGoals.filter((c) => c.parentId === goal.id);
            return (
              <div key={goal.id}>
                <SelectItem value={goal.id}>
                  <span className="font-medium">{goal.title.length > 35 ? `${goal.title.slice(0, 35)}...` : goal.title}</span>
                </SelectItem>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    <span className="pl-3 text-muted-foreground">└ {child.title.length > 30 ? `${child.title.slice(0, 30)}...` : child.title}</span>
                  </SelectItem>
                ))}
              </div>
            );
          })}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={clearAll}
        >
          <X className="mr-1 size-3.5" />
          Clear all
        </Button>
      )}
    </div>
  );
}

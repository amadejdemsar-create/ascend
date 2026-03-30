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
import { useUIStore } from "@/lib/stores/ui-store";
import { useCategories } from "@/lib/hooks/use-categories";

const HORIZON_OPTIONS = [
  { value: "YEARLY", label: "Yearly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "WEEKLY", label: "Weekly" },
] as const;

const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ABANDONED", label: "Abandoned" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
] as const;

interface CategoryFlat {
  id: string;
  name: string;
  children?: CategoryFlat[];
}

function flattenCategories(nodes: CategoryFlat[]): CategoryFlat[] {
  const result: CategoryFlat[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) {
      result.push(...flattenCategories(node.children));
    }
  }
  return result;
}

export function GoalFilterBar() {
  const activeFilters = useUIStore((s) => s.activeFilters);
  const setActiveFilters = useUIStore((s) => s.setActiveFilters);
  const resetFilters = useUIStore((s) => s.resetFilters);
  const { data: categoryTree } = useCategories();

  const flatCategories = categoryTree
    ? flattenCategories(categoryTree as CategoryFlat[])
    : [];

  const hasActiveFilters =
    !!activeFilters.horizon ||
    !!activeFilters.status ||
    !!activeFilters.priority ||
    !!activeFilters.categoryId;

  const handleChange = (
    field: "horizon" | "status" | "priority" | "categoryId",
    value: string | null,
  ) => {
    setActiveFilters({
      ...activeFilters,
      [field]: value || undefined,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={activeFilters.horizon ?? ""}
        onValueChange={(v) => handleChange("horizon", v)}
      >
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue placeholder="All horizons" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All horizons</SelectItem>
          {HORIZON_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={activeFilters.status ?? ""}
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
        value={activeFilters.priority ?? ""}
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
        value={activeFilters.categoryId ?? ""}
        onValueChange={(v) => handleChange("categoryId", v)}
      >
        <SelectTrigger className="h-8 w-[160px]">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All categories</SelectItem>
          {flatCategories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={resetFilters}
        >
          <X className="mr-1 size-3.5" />
          Clear all
        </Button>
      )}
    </div>
  );
}

"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { goalStatusItems, priorityItems } from "@/lib/enum-display";

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

/**
 * Filter bar for the goals page.
 *
 * Horizon is intentionally NOT in this bar; it is the tab row above
 * the list view (see goal-view-switcher / goal-horizon-tabs) to avoid
 * the dual-control UI that duplicated the filter across two different
 * affordances (H1 from 2026-04-11 UX review).
 */
export function GoalFilterBar() {
  const activeFilters = useUIStore((s) => s.activeFilters);
  const setActiveFilters = useUIStore((s) => s.setActiveFilters);
  const resetFilters = useUIStore((s) => s.resetFilters);
  const { data: categoryTree } = useCategories();

  const flatCategories = categoryTree
    ? flattenCategories(categoryTree as CategoryFlat[])
    : [];

  // Count active filters excluding horizon (horizon lives in the tab row).
  const activeFilterCount =
    (activeFilters.status ? 1 : 0) +
    (activeFilters.priority ? 1 : 0) +
    (activeFilters.categoryId ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const handleChange = (
    field: "status" | "priority" | "categoryId",
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
        value={activeFilters.status ?? ""}
        onValueChange={(v) => handleChange("status", v)}
      >
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All statuses</SelectItem>
          {goalStatusItems.map((opt) => (
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
          {priorityItems.map((opt) => (
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
          <SelectValue placeholder="All categories">
            {activeFilters.categoryId
              ? flatCategories.find((c) => c.id === activeFilters.categoryId)?.name ?? "All categories"
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

      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={resetFilters}
        disabled={!hasActiveFilters}
        aria-label={hasActiveFilters ? `Clear ${activeFilterCount} active filters` : "No active filters"}
      >
        <X className="mr-1 size-3.5" />
        Clear all
        {hasActiveFilters && (
          <Badge
            variant="secondary"
            className="ml-2 h-5 min-w-5 px-1.5 text-[10px]"
          >
            {activeFilterCount}
          </Badge>
        )}
      </Button>
    </div>
  );
}

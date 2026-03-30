"use client";

import { DynamicIcon } from "lucide-react/dynamic";
import type { IconName } from "lucide-react/dynamic";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { useCategories } from "@/lib/hooks/use-categories";
import { useUIStore } from "@/lib/stores/ui-store";

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CategoryNode {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  children: CategoryNode[];
}

export function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const { data: categories } = useCategories();
  const { setActiveFilters, activeFilters } = useUIStore();

  const topLevelCategories = ((categories ?? []) as CategoryNode[]);

  function handleCategoryClick(categoryId: string) {
    if (activeFilters.categoryId === categoryId) {
      const { categoryId: _, ...rest } = activeFilters;
      setActiveFilters(rest);
    } else {
      setActiveFilters({ ...activeFilters, categoryId });
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="font-serif text-lg">Ascend</SheetTitle>
          <SheetDescription>Navigation and settings</SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="flex flex-col gap-4 p-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Categories
            </p>
            {topLevelCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet</p>
            ) : (
              <div className="flex flex-col gap-1">
                {topLevelCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryClick(cat.id)}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                      activeFilters.categoryId === cat.id
                        ? "bg-accent font-medium"
                        : ""
                    }`}
                  >
                    <span
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <DynamicIcon
                      name={(cat.icon ?? "folder") as IconName}
                      className="size-4 shrink-0"
                    />
                    <span className="truncate">{cat.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

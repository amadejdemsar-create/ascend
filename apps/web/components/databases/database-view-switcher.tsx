"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useCreateView } from "@/lib/hooks/use-database-views";
import type { DatabaseViewResponse } from "@/lib/hooks/use-databases";

interface DatabaseViewSwitcherProps {
  views: DatabaseViewResponse[];
  activeViewId: string | null;
  onSelectView: (viewId: string) => void;
  databaseId: string;
}

const VIEW_TYPE_LABELS: Record<string, string> = {
  TABLE: "Table",
  BOARD: "Board",
  CALENDAR: "Calendar",
  GALLERY: "Gallery",
  TIMELINE: "Timeline",
};

/**
 * Pill tab strip for switching between database views. Includes a "+"
 * button that opens a popover to create a new view with a name and type.
 */
export function DatabaseViewSwitcher({
  views,
  activeViewId,
  onSelectView,
  databaseId,
}: DatabaseViewSwitcherProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("New view");
  const [newType, setNewType] = useState<string>("TABLE");
  const createView = useCreateView(databaseId);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("View name is required");
      return;
    }
    try {
      const result = await createView.mutateAsync({
        name: trimmed,
        type: newType,
      });
      onSelectView(result.id);
      setAddOpen(false);
      setNewName("New view");
      setNewType("TABLE");
      toast.success(`Created "${trimmed}" view`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create view");
    }
  }

  return (
    <div className="flex items-center gap-1 border-b px-4 py-1.5 overflow-x-auto" role="tablist" aria-label="Database views">
      {views.map((view) => (
        <button
          key={view.id}
          role="tab"
          aria-selected={view.id === activeViewId}
          className={cn(
            "px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
            view.id === activeViewId
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          onClick={() => onSelectView(view.id)}
        >
          {view.name}
        </button>
      ))}

      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger
          className="inline-flex items-center justify-center shrink-0 rounded-md size-7 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Add view"
        >
          <Plus className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3 space-y-2" align="start">
          <Input
            placeholder="View name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="text-sm"
            aria-label="View name"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            aria-label="View type"
          >
            {Object.entries(VIEW_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="w-full"
            onClick={handleCreate}
            disabled={createView.isPending}
          >
            {createView.isPending ? "Creating..." : "Create view"}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

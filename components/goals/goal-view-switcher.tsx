"use client";

import {
  LayoutGrid,
  List,
  Columns3,
  GitBranch,
  GanttChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useUIStore, type ViewType } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";

const VIEW_OPTIONS: Array<{
  value: ViewType;
  label: string;
  icon: typeof LayoutGrid;
  enabled: boolean;
}> = [
  { value: "cards", label: "Cards", icon: LayoutGrid, enabled: true },
  { value: "list", label: "List", icon: List, enabled: true },
  { value: "board", label: "Board", icon: Columns3, enabled: true },
  { value: "tree", label: "Tree", icon: GitBranch, enabled: true },
  { value: "timeline", label: "Timeline", icon: GanttChart, enabled: true },
];

export function GoalViewSwitcher() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
        {VIEW_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = activeView === opt.value;

          if (!opt.enabled) {
            return (
              <Tooltip key={opt.value}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      disabled
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground/40 cursor-not-allowed"
                    />
                  }
                >
                  <Icon className="size-4" />
                </TooltipTrigger>
                <TooltipContent side="bottom">Coming soon</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Button
              key={opt.value}
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-md",
                isActive &&
                  "bg-background text-foreground shadow-sm hover:bg-background",
                !isActive && "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveView(opt.value)}
              aria-label={opt.label}
            >
              <Icon className="size-4" />
            </Button>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

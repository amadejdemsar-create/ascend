"use client";

import { List, Network, Pin, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore, type ContextViewType } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";

const VIEW_OPTIONS: Array<{
  value: ContextViewType;
  label: string;
  icon: typeof List;
}> = [
  { value: "list", label: "List", icon: List },
  { value: "graph", label: "Graph", icon: Network },
  { value: "pinned", label: "Pinned", icon: Pin },
  { value: "backlinks", label: "Backlinks", icon: ArrowLeftRight },
];

export function ContextViewSwitcher() {
  const contextActiveView = useUIStore((s) => s.contextActiveView);
  const setContextActiveView = useUIStore((s) => s.setContextActiveView);

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5"
      role="group"
      aria-label="Context view options"
    >
      {VIEW_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isActive = contextActiveView === opt.value;

        return (
          <Button
            key={opt.value}
            variant="ghost"
            size="icon"
            className={cn(
              "size-8 rounded-md",
              isActive &&
                "bg-background text-foreground shadow-sm hover:bg-background",
              !isActive && "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setContextActiveView(opt.value)}
            aria-label={opt.label}
          >
            <Icon className="size-4" />
          </Button>
        );
      })}
    </div>
  );
}

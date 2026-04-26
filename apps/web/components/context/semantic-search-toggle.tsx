"use client";

import { Type, Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useUIStore,
  type ContextSearchMode,
} from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";

const MODE_OPTIONS: Array<{
  value: ContextSearchMode;
  label: string;
  description: string;
  icon: typeof Type;
}> = [
  {
    value: "text",
    label: "Text",
    description: "Full-text keyword search",
    icon: Type,
  },
  {
    value: "semantic",
    label: "Semantic",
    description: "AI meaning-based search (uses embedding API)",
    icon: Brain,
  },
  {
    value: "hybrid",
    label: "Hybrid",
    description: "Blends keyword and semantic search for best results",
    icon: Sparkles,
  },
];

export function SemanticSearchToggle() {
  const contextSearchMode = useUIStore((s) => s.contextSearchMode);
  const setContextSearchMode = useUIStore((s) => s.setContextSearchMode);

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5"
      role="group"
      aria-label="Search mode"
    >
      {MODE_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isActive = contextSearchMode === opt.value;

        return (
          <Tooltip key={opt.value}>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 gap-1.5 rounded-md px-2 text-xs",
                    isActive &&
                      "bg-background text-foreground shadow-sm hover:bg-background",
                    !isActive && "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setContextSearchMode(opt.value)}
                  aria-label={`${opt.label} search mode`}
                  aria-pressed={isActive}
                />
              }
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{opt.label}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px]">
              <p className="text-xs">{opt.description}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

"use client";

import { Maximize2, Minimize2, Square } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CardSize } from "@ascend/core";

interface Props {
  cardSize: CardSize;
  onChange: (cardSize: CardSize) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{
  value: CardSize;
  label: string;
  description: string;
  icon: typeof Square;
}> = [
  {
    value: "compact",
    label: "Compact",
    description: "Title only, small cards.",
    icon: Minimize2,
  },
  {
    value: "default",
    label: "Default",
    description: "Adapt detail to zoom level.",
    icon: Square,
  },
  {
    value: "expanded",
    label: "Expanded",
    description: "Full title, type, and tags.",
    icon: Maximize2,
  },
];

/**
 * Wave 9 polish: toolbar dropdown that lets the user override the
 * zoom-based card-detail regime. "Compact" forces title-only at any
 * zoom, "Default" uses the zoom thresholds (mini-dot < 0.35x, compact
 * < 0.6x, full at >= 0.6x), "Expanded" always shows full detail.
 *
 * Setting is persisted per-layout in `viewport.cardSize`.
 */
export function CanvasCardSizeToggle({ cardSize, onChange, disabled }: Props) {
  const active = OPTIONS.find((o) => o.value === cardSize) ?? OPTIONS[1];
  const ActiveIcon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            aria-label={`Card size: ${active.label}`}
            title={`Card size: ${active.label}`}
          />
        }
      >
        <ActiveIcon className="size-3.5" aria-hidden="true" />
        <span className="text-xs">{active.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = opt.value === cardSize;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex items-start gap-2 py-2",
                isActive && "bg-accent/40",
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground">
                  {opt.description}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DatabaseField, DatabaseFieldConfig } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

type Mode = "cell" | "expanded";

interface RatingEditorProps {
  field: DatabaseField & { config: Extract<DatabaseFieldConfig, { type: "RATING" }> };
  value: number | null;
  onChange: (next: number | null) => void;
  mode: Mode;
  disabled?: boolean;
  autoFocus?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────

export function RatingEditor({
  field,
  value,
  onChange,
  mode,
  disabled,
}: RatingEditorProps) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const max = field.config.max ?? 5;
  const currentRating = value ?? 0;

  function handleClick(star: number) {
    if (disabled) return;
    // Click the same star again to clear
    if (star === currentRating) {
      onChange(null);
    } else {
      onChange(star);
    }
  }

  const starSize = mode === "expanded" ? "size-5" : "size-4";

  return (
    <div
      className={cn(
        "flex items-center gap-0.5",
        disabled && "pointer-events-none opacity-50",
      )}
      role="group"
      aria-label={`${field.name} rating: ${currentRating} of ${max}`}
      onMouseLeave={() => setHoveredStar(null)}
    >
      {Array.from({ length: max }, (_, i) => {
        const starNumber = i + 1;
        const isFilled =
          hoveredStar != null
            ? starNumber <= hoveredStar
            : starNumber <= currentRating;

        return (
          <button
            key={starNumber}
            type="button"
            onClick={() => handleClick(starNumber)}
            onMouseEnter={() => setHoveredStar(starNumber)}
            className={cn(
              "transition-colors rounded-sm p-0.5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-label={`${starNumber} star${starNumber > 1 ? "s" : ""}`}
            disabled={disabled}
          >
            <Star
              className={cn(
                starSize,
                "transition-colors",
                isFilled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/40",
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

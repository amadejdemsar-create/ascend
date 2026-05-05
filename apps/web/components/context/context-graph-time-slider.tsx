"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format, subDays, startOfDay } from "date-fns";
import { Clock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────

const TOTAL_DAYS = 90;
const TICK_INTERVAL_DAYS = 7;
const LABEL_INTERVAL_DAYS = 30;

// ── Props ──────────────────────────────────────────────────────────

export interface ContextGraphTimeSliderProps {
  /** ISO date string (YYYY-MM-DD) when viewing a past state. null = live/now. */
  value: string | null;
  /** Called with ISO date string or null to return to live state. */
  onChange: (date: string | null) => void;
  className?: string;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Convert a days-from-now value (0 = 90 days ago, 90 = now) to an ISO date string. */
function daysToDate(daysValue: number): string {
  const daysAgo = TOTAL_DAYS - daysValue;
  const date = subDays(startOfDay(new Date()), daysAgo);
  return format(date, "yyyy-MM-dd");
}

/** Convert an ISO date string to a days-from-now value (0 = 90 days ago, 90 = now). */
function dateToSliderValue(dateStr: string): number {
  const date = startOfDay(new Date(dateStr));
  const now = startOfDay(new Date());
  const diffMs = now.getTime() - date.getTime();
  const daysAgo = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.min(TOTAL_DAYS, TOTAL_DAYS - daysAgo));
}

// ── Component ──────────────────────────────────────────────────────

/**
 * A horizontal 90-day time slider for navigating historical graph states.
 *
 * Renders tick marks every 7 days with labels at 30-day intervals.
 * The right edge represents "Now" (live state). When a past date is selected,
 * the track tints amber to signal the user is viewing historical data.
 *
 * Supports pointer-based dragging, keyboard navigation (arrows, home, end),
 * and full ARIA slider semantics.
 */
export function ContextGraphTimeSlider({
  value,
  onChange,
  className,
}: ContextGraphTimeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // The internal slider value: 0 = 90 days ago, TOTAL_DAYS = today/now.
  const sliderValue = value ? dateToSliderValue(value) : TOTAL_DAYS;
  const isLive = value === null;

  // ── Pointer interaction ──────────────────────────────────────────

  const computeValueFromPointer = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return TOTAL_DAYS;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * TOTAL_DAYS);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);

      const val = computeValueFromPointer(e.clientX);
      if (val >= TOTAL_DAYS) {
        onChange(null);
      } else {
        onChange(daysToDate(val));
      }
    },
    [computeValueFromPointer, onChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const val = computeValueFromPointer(e.clientX);
      if (val >= TOTAL_DAYS) {
        onChange(null);
      } else {
        onChange(daysToDate(val));
      }
    },
    [isDragging, computeValueFromPointer, onChange],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setIsDragging(false);
    },
    [],
  );

  // ── Keyboard interaction ─────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let newVal = sliderValue;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          e.preventDefault();
          newVal = Math.min(TOTAL_DAYS, sliderValue + (e.shiftKey ? 7 : 1));
          break;
        case "ArrowLeft":
        case "ArrowDown":
          e.preventDefault();
          newVal = Math.max(0, sliderValue - (e.shiftKey ? 7 : 1));
          break;
        case "Home":
          e.preventDefault();
          newVal = 0;
          break;
        case "End":
          e.preventDefault();
          newVal = TOTAL_DAYS;
          break;
        default:
          return;
      }

      if (newVal >= TOTAL_DAYS) {
        onChange(null);
      } else {
        onChange(daysToDate(newVal));
      }
    },
    [sliderValue, onChange],
  );

  // ── Escape to return to now ──────────────────────────────────────

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && !isLive) {
        onChange(null);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isLive, onChange]);

  // ── Tick marks and labels ────────────────────────────────────────

  const ticks: Array<{
    position: number;
    label: string | null;
    isLabel: boolean;
  }> = [];

  for (let d = 0; d <= TOTAL_DAYS; d += TICK_INTERVAL_DAYS) {
    const isLabel = d % LABEL_INTERVAL_DAYS === 0;
    const position = (d / TOTAL_DAYS) * 100;
    const date = subDays(startOfDay(new Date()), TOTAL_DAYS - d);
    const label = isLabel ? format(date, "MMM d") : null;
    ticks.push({ position, label, isLabel });
  }

  // ── ARIA value text ──────────────────────────────────────────────

  const daysFromNow = TOTAL_DAYS - sliderValue;
  const ariaValueText = isLive
    ? "Now (live)"
    : `${format(new Date(value!), "d. M. yyyy")} (${daysFromNow} day${daysFromNow === 1 ? "" : "s"} ago)`;

  // ── Handle position ──────────────────────────────────────────────

  const handlePosition = (sliderValue / TOTAL_DAYS) * 100;

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b px-4 py-2",
        !isLive && "border-amber-300/50 bg-amber-50/50 dark:border-amber-700/30 dark:bg-amber-950/20",
        className,
      )}
    >
      <Clock
        className={cn(
          "size-4 shrink-0",
          isLive
            ? "text-muted-foreground"
            : "text-amber-600 dark:text-amber-400",
        )}
        aria-hidden="true"
      />

      {/* Slider track */}
      <div
        ref={trackRef}
        className="relative flex-1 cursor-pointer select-none"
        style={{ height: 32 }}
        role="slider"
        aria-label="Graph time slider"
        aria-valuemin={0}
        aria-valuemax={TOTAL_DAYS}
        aria-valuenow={sliderValue}
        aria-valuetext={ariaValueText}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        {/* Track background */}
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted">
          {/* Filled portion */}
          <div
            className={cn(
              "absolute left-0 top-0 h-full rounded-full motion-safe:transition-[width] motion-safe:duration-100",
              isLive
                ? "bg-primary/30"
                : "bg-amber-400/60 dark:bg-amber-600/40",
            )}
            style={{ width: `${handlePosition}%` }}
          />
        </div>

        {/* Tick marks */}
        {ticks.map((tick) => (
          <div
            key={tick.position}
            className="absolute top-1/2 -translate-x-1/2"
            style={{ left: `${tick.position}%` }}
            aria-hidden="true"
          >
            <div
              className={cn(
                "w-px -translate-y-1/2",
                tick.isLabel ? "h-2.5 bg-muted-foreground/40" : "h-1.5 bg-muted-foreground/20",
              )}
            />
            {tick.label && (
              <span className="absolute top-2.5 -translate-x-1/2 whitespace-nowrap text-[9px] text-muted-foreground">
                {tick.label}
              </span>
            )}
          </div>
        ))}

        {/* "Now" label at the right edge */}
        <span
          className="absolute right-0 top-2.5 text-[9px] font-medium text-muted-foreground"
          aria-hidden="true"
        >
          Now
        </span>

        {/* Draggable handle */}
        <div
          className={cn(
            "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm motion-safe:transition-[left] motion-safe:duration-75",
            isDragging && "scale-125 shadow-md",
            isLive
              ? "border-primary bg-background"
              : "border-amber-500 bg-amber-100 dark:border-amber-400 dark:bg-amber-900",
          )}
          style={{ left: `${handlePosition}%` }}
          aria-hidden="true"
        />
      </div>

      {/* Return to now pill */}
      {!isLive && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/80"
          aria-label="Return to live graph state"
        >
          <RotateCcw className="size-3" aria-hidden="true" />
          Now
        </button>
      )}
    </div>
  );
}

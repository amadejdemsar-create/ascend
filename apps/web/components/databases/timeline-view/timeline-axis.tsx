"use client";

import { useMemo } from "react";
import {
  differenceInDays,
  format,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isToday,
  getISOWeek,
  startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

export interface TimelineAxisProps {
  rangeStart: Date;
  rangeEnd: Date;
  pixelsPerDay: number;
  zoom: "day" | "week" | "month";
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * Top axis for the timeline view. Renders tick marks with date labels at
 * the granularity determined by the zoom level. Designed to be sticky at
 * the top of the scroll container.
 */
export function TimelineAxis({
  rangeStart,
  rangeEnd,
  pixelsPerDay,
  zoom,
}: TimelineAxisProps) {
  const totalWidth = differenceInDays(rangeEnd, rangeStart) * pixelsPerDay;

  interface TickData {
    date: Date;
    x: number;
    label: string;
    sublabel?: string;
    isHighlighted: boolean;
  }

  const ticks: TickData[] = useMemo(() => {
    switch (zoom) {
      case "day": {
        return eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map(
          (date) => ({
            date,
            x: differenceInDays(date, rangeStart) * pixelsPerDay,
            label: format(date, "d. M."),
            isHighlighted: isToday(date),
          }),
        );
      }
      case "week": {
        return eachWeekOfInterval(
          { start: rangeStart, end: rangeEnd },
          { weekStartsOn: 1 },
        ).map((date) => ({
          date,
          x: differenceInDays(date, rangeStart) * pixelsPerDay,
          label: format(date, "d. M. yyyy"),
          sublabel: `W${getISOWeek(date)}`,
          isHighlighted: false,
        }));
      }
      case "month": {
        return eachMonthOfInterval({
          start: rangeStart,
          end: rangeEnd,
        }).map((date) => ({
          date,
          x: differenceInDays(date, rangeStart) * pixelsPerDay,
          label: format(date, "MMMM yyyy"),
          isHighlighted: false,
        }));
      }
    }
  }, [rangeStart, rangeEnd, pixelsPerDay, zoom]);

  // Today's x-position for the vertical indicator line.
  const todayOffset = useMemo(() => {
    const today = new Date();
    const offset = differenceInDays(today, rangeStart) * pixelsPerDay;
    if (offset < 0 || offset > totalWidth) return null;
    return offset;
  }, [rangeStart, pixelsPerDay, totalWidth]);

  return (
    <div
      className="relative h-8 border-b border-border/40 shrink-0"
      style={{ width: totalWidth }}
      role="presentation"
      aria-hidden="true"
    >
      {ticks.map((tick, index) => (
        <div
          key={index}
          className="absolute top-0 h-full flex flex-col justify-center"
          style={{ left: tick.x }}
        >
          {/* Tick line */}
          <div className="absolute top-0 h-2 w-px bg-border/60" />
          {/* Label */}
          <span
            className={cn(
              "absolute top-2.5 text-[10px] whitespace-nowrap text-muted-foreground select-none",
              tick.isHighlighted && "text-primary font-semibold",
            )}
          >
            {tick.label}
            {tick.sublabel && (
              <span className="ml-1 text-muted-foreground/60">
                {tick.sublabel}
              </span>
            )}
          </span>
        </div>
      ))}

      {/* Today marker */}
      {todayOffset !== null && (
        <div
          className="absolute top-0 bottom-0 w-px bg-primary/70 z-10"
          style={{ left: todayOffset }}
        />
      )}
    </div>
  );
}

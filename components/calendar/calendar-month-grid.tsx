"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/src/style.css";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface DayIndicator {
  hasPending: boolean;
  hasBig3: boolean;
  allDone: boolean;
}

interface CalendarMonthGridProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  todoCounts: Record<string, number>;
  goalDeadlineDates: Set<string>;
  dayIndicators: Record<string, DayIndicator>;
  month: Date;
  onMonthChange: (month: Date) => void;
}

function formatDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function CalendarMonthGrid({
  selectedDate,
  onSelectDate,
  todoCounts,
  goalDeadlineDates,
  dayIndicators,
  month,
  onMonthChange,
}: CalendarMonthGridProps) {
  function handleToday() {
    const today = new Date();
    onSelectDate(today);
    onMonthChange(today);
  }

  return (
    <div className="w-full">
      {/* Header with month label and Today button */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-lg font-semibold">
          {format(month, "MMMM yyyy")}
        </h2>
        <Button variant="outline" size="sm" onClick={handleToday}>
          Today
        </Button>
      </div>

      <DayPicker
        mode="single"
        selected={selectedDate}
        onSelect={(date) => {
          if (date) onSelectDate(date);
        }}
        month={month}
        onMonthChange={onMonthChange}
        weekStartsOn={1}
        showWeekNumber
        formatters={{ formatWeekNumber: (weekNumber) => `W${weekNumber}` }}
        showOutsideDays
        fixedWeeks
        classNames={{
          root: "w-full",
          months: "w-full",
          month_grid: "w-full border-collapse",
          week: "w-full",
          day: "relative p-0 text-center",
          day_button:
            "relative w-full min-h-[44px] flex flex-col items-center justify-start pt-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors",
          selected:
            "bg-primary text-primary-foreground hover:bg-primary/90",
          today: "font-bold text-primary",
          outside: "text-muted-foreground/50",
          week_number: "text-xs text-muted-foreground/60 pr-2",
          caption_label: "hidden",
          nav: "hidden",
        }}
        components={{
          DayButton: ({ day, modifiers, ...buttonProps }) => {
            const dateKey = formatDateKey(day.date);
            const indicator = dayIndicators[dateKey];
            const hasDeadline = goalDeadlineDates.has(dateKey);

            // Build dot list, capped at 3, in priority order:
            // 1. Goal deadline (destructive red)
            // 2. Big 3 (amber)
            // 3. All done (green) OR pending (muted neutral)
            const dots: Array<{ key: string; className: string }> = [];

            if (hasDeadline) {
              dots.push({
                key: "deadline",
                className: "bg-destructive",
              });
            }

            if (indicator?.hasBig3) {
              dots.push({
                key: "big3",
                className: "bg-amber-400",
              });
            }

            if (indicator) {
              if (indicator.allDone) {
                dots.push({
                  key: "done",
                  className: "bg-green-500",
                });
              } else if (indicator.hasPending) {
                dots.push({
                  key: "pending",
                  className: "bg-muted-foreground",
                });
              }
            }

            const visibleDots = dots.slice(0, 3);

            return (
              <button {...buttonProps}>
                <span>{day.date.getDate()}</span>
                <span className="flex items-center justify-center gap-0.5 h-2.5 mt-0.5">
                  {visibleDots.map((dot) => (
                    <span
                      key={dot.key}
                      className={`inline-block size-1.5 rounded-full ${dot.className}`}
                    />
                  ))}
                </span>
              </button>
            );
          },
        }}
      />
    </div>
  );
}

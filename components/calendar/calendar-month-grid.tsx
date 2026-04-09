"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/src/style.css";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface CalendarMonthGridProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  todoCounts: Record<string, number>;
  goalDeadlineDates: Set<string>;
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
            const todoCount = todoCounts[dateKey] ?? 0;
            const hasDeadline = goalDeadlineDates.has(dateKey);

            return (
              <button {...buttonProps}>
                <span>{day.date.getDate()}</span>
                <span className="flex items-center gap-0.5 h-2.5 mt-0.5">
                  {todoCount > 0 && (
                    <span className="inline-block size-1.5 rounded-full bg-primary" />
                  )}
                  {hasDeadline && (
                    <span className="inline-block size-1.5 rounded-sm rotate-45 bg-amber-500" />
                  )}
                </span>
              </button>
            );
          },
        }}
      />
    </div>
  );
}

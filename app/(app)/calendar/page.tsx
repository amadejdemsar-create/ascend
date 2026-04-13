"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useTodosByRange, useGenerateRecurring } from "@/lib/hooks/use-todos";
import { useGoalDeadlinesByRange } from "@/lib/hooks/use-goals";
import type { GoalDeadlineItem } from "@/lib/hooks/use-goals";
import { CalendarMonthGrid } from "@/components/calendar/calendar-month-grid";
import { CalendarDayDetail } from "@/components/calendar/calendar-day-detail";

interface RangeTodoItem {
  dueDate?: string | null;
  scheduledDate?: string | null;
  status?: string;
  isBig3?: boolean;
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  // Track whether user has explicitly selected a date (for mobile overlay)
  const [showDetail, setShowDetail] = useState(false);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const rangeStart = format(monthStart, "yyyy-MM-dd");
  const rangeEnd = format(monthEnd, "yyyy-MM-dd");

  // Generate recurring to-do instances for the visible month.
  // This ensures daily/weekly recurring to-dos have actual DB rows
  // for each occurrence date, so they appear in by-date and by-range queries.
  const generateRecurring = useGenerateRecurring();
  const generatedRangeRef = useRef<string>("");
  useEffect(() => {
    const rangeKey = `${rangeStart}:${rangeEnd}`;
    if (generatedRangeRef.current === rangeKey) return;
    generatedRangeRef.current = rangeKey;
    generateRecurring.mutate({ start: rangeStart, end: rangeEnd });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  const { data: rawMonthTodos } = useTodosByRange(rangeStart, rangeEnd);
  const { data: rawMonthDeadlines } = useGoalDeadlinesByRange(
    rangeStart,
    rangeEnd,
  );

  const monthTodos = (rawMonthTodos ?? []) as RangeTodoItem[];
  const monthDeadlines = (rawMonthDeadlines ?? []) as GoalDeadlineItem[];

  // Compute todo counts per day
  const todoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const todo of monthTodos) {
      const dateStr =
        todo.scheduledDate ?? todo.dueDate;
      if (!dateStr) continue;
      const key = format(new Date(dateStr), "yyyy-MM-dd");
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [monthTodos]);

  // Compute per-day indicators for the month grid dots
  const dayIndicators = useMemo(() => {
    const indicators: Record<
      string,
      { hasPending: boolean; hasBig3: boolean; allDone: boolean }
    > = {};

    // Group todos by date
    const byDate: Record<string, RangeTodoItem[]> = {};
    for (const todo of monthTodos) {
      const dateStr = todo.scheduledDate ?? todo.dueDate;
      if (!dateStr) continue;
      const key = format(new Date(dateStr), "yyyy-MM-dd");
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(todo);
    }

    for (const [key, todos] of Object.entries(byDate)) {
      const hasPending = todos.some((t) => t.status === "PENDING");
      const hasBig3 = todos.some((t) => t.isBig3);
      const allDone =
        todos.length > 0 && todos.every((t) => t.status === "DONE");

      indicators[key] = { hasPending, hasBig3, allDone };
    }

    return indicators;
  }, [monthTodos]);

  // Compute goal deadline dates
  const goalDeadlineDates = useMemo(() => {
    const dates = new Set<string>();
    for (const goal of monthDeadlines) {
      if (goal.deadline) {
        dates.add(format(new Date(goal.deadline), "yyyy-MM-dd"));
      }
    }
    return dates;
  }, [monthDeadlines]);

  function handleSelectDate(date: Date) {
    setSelectedDate(date);
    setShowDetail(true);
  }

  function handleCloseDetail() {
    setShowDetail(false);
  }

  return (
    <div className="flex h-full">
      {/* Left panel: Month grid (65-70% width) */}
      <div
        className={`flex-[2] min-w-0 flex flex-col border-r overflow-y-auto ${
          showDetail ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-background p-4">
          <h1 className="font-serif text-2xl font-bold">Calendar</h1>
        </div>

        {/* Calendar grid */}
        <div className="p-4">
          <CalendarMonthGrid
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            todoCounts={todoCounts}
            goalDeadlineDates={goalDeadlineDates}
            dayIndicators={dayIndicators}
            month={month}
            onMonthChange={setMonth}
          />
        </div>
      </div>

      {/* Right panel: Day detail */}
      {showDetail ? (
        <>
          {/* Desktop: side panel (30-35% width) */}
          <div className="hidden md:flex flex-1 min-w-0 flex-col border-l">
            <CalendarDayDetail date={selectedDate} />
          </div>

          {/* Mobile: full-screen overlay */}
          <div className="flex md:hidden fixed inset-0 z-40 bg-background">
            <CalendarDayDetail
              date={selectedDate}
              onClose={handleCloseDetail}
              isMobileOverlay
            />
          </div>
        </>
      ) : (
        <div className="hidden md:flex flex-1 min-w-0 items-center justify-center text-muted-foreground border-l">
          <p className="text-sm">Select a day to see details</p>
        </div>
      )}
    </div>
  );
}

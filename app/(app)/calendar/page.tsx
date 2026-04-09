"use client";

import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { useTodosByRange, useTodosByDate, useTop3Todos } from "@/lib/hooks/use-todos";
import { useGoalDeadlinesByRange } from "@/lib/hooks/use-goals";
import type { GoalDeadlineItem } from "@/lib/hooks/use-goals";
import type { TodoListItem } from "@/components/todos/todo-list-columns";
import { CalendarMonthGrid } from "@/components/calendar/calendar-month-grid";
import { CalendarDayDetail } from "@/components/calendar/calendar-day-detail";
import { MorningPlanningPrompt } from "@/components/calendar/morning-planning-prompt";

interface RangeTodoItem {
  dueDate?: string | null;
  scheduledDate?: string | null;
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  // Track whether user has explicitly selected a date (for mobile overlay)
  const [showDetail, setShowDetail] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);

  // Morning planning prompt data
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: rawTodayBig3 } = useTop3Todos(todayStr);
  const { data: rawTodayTodos } = useTodosByDate(todayStr);
  const todayBig3 = (rawTodayBig3 ?? []) as TodoListItem[];
  const todayTodos = (rawTodayTodos ?? []) as TodoListItem[];
  const pendingTodayTodos = todayTodos.filter((t) => t.status === "PENDING");
  const isViewingToday = isSameDay(selectedDate, new Date());
  const showPrompt =
    !promptDismissed && isViewingToday && todayBig3.length === 0;

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const rangeStart = format(monthStart, "yyyy-MM-dd");
  const rangeEnd = format(monthEnd, "yyyy-MM-dd");

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
      {/* Left panel: Month grid */}
      <div
        className={`flex-1 flex flex-col border-r overflow-y-auto ${
          showDetail ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-background p-4">
          <h1 className="font-serif text-2xl font-bold">Calendar</h1>
        </div>

        {/* Morning planning prompt */}
        {showPrompt && (
          <MorningPlanningPrompt
            todayTodos={pendingTodayTodos}
            onDismiss={() => setPromptDismissed(true)}
          />
        )}

        {/* Calendar grid */}
        <div className="p-4">
          <CalendarMonthGrid
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            todoCounts={todoCounts}
            goalDeadlineDates={goalDeadlineDates}
            month={month}
            onMonthChange={setMonth}
          />
        </div>
      </div>

      {/* Right panel: Day detail */}
      {showDetail ? (
        <>
          {/* Desktop: side panel */}
          <div className="hidden md:flex w-[400px] lg:w-[440px] flex-col border-l">
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
        <div className="hidden md:flex w-[400px] lg:w-[440px] items-center justify-center text-muted-foreground border-l">
          <p className="text-sm">Select a day to see details</p>
        </div>
      )}
    </div>
  );
}

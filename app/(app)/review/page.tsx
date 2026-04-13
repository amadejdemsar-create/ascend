"use client";

import { useState, useCallback } from "react";
import { startOfWeek, addDays, subDays, format } from "date-fns";
import { useWeeklyReview } from "@/lib/hooks/use-review";
import { WeeklyReviewPage } from "@/components/review/weekly-review-page";

export default function ReviewPage() {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );

  const { data, isLoading } = useWeeklyReview(format(weekStart, "yyyy-MM-dd"));

  const handlePrevWeek = useCallback(() => {
    setWeekStart((prev) => subDays(prev, 7));
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekStart((prev) => addDays(prev, 7));
  }, []);

  const handleThisWeek = useCallback(() => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }, []);

  return (
    <WeeklyReviewPage
      data={data}
      isLoading={isLoading}
      weekStart={weekStart}
      onPrevWeek={handlePrevWeek}
      onNextWeek={handleNextWeek}
      onThisWeek={handleThisWeek}
    />
  );
}

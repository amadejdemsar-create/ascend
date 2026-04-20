"use client";

import { useAnalytics } from "@/lib/hooks/use-analytics";
import { AnalyticsPage } from "@/components/analytics/analytics-page";

export default function AnalyticsRoute() {
  const { data, isLoading } = useAnalytics();
  return <AnalyticsPage data={data} isLoading={isLoading} />;
}

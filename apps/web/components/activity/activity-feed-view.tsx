"use client";

import { useState, useMemo } from "react";
import { Brain, SlidersHorizontal } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { useMe } from "@/lib/hooks/use-me";
import { useActivityFeed } from "@/lib/hooks/use-activity";
import type { ActivityEventItem } from "@/lib/hooks/use-activity";
import { ActivityEventRow } from "./activity-event-row";
import {
  ActivityFilters,
  dateRangeToSince,
  type DateRange,
} from "./activity-filters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ActivityEventType } from "@/lib/validations";

// ── Date grouping ────────────────────────────────────────────────────

function groupByDay(
  events: ActivityEventItem[],
): Array<{ label: string; events: ActivityEventItem[] }> {
  const groups: Map<string, { label: string; events: ActivityEventItem[] }> =
    new Map();

  for (const event of events) {
    const date = new Date(event.createdAt);
    let label: string;
    if (isToday(date)) {
      label = "Today";
    } else if (isYesterday(date)) {
      label = "Yesterday";
    } else {
      // D. M. YYYY format per locale rules
      label = format(date, "d. M. yyyy");
    }

    const existing = groups.get(label);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(label, { label, events: [event] });
    }
  }

  return Array.from(groups.values());
}

// ── Component ────────────────────────────────────────────────────────

export function ActivityFeedView() {
  const me = useMe();
  const workspaceId = me.data?.workspaceId ?? null;

  // Local filter state (not Zustand; page-local per spec)
  const [selectedEventTypes, setSelectedEventTypes] = useState<
    ActivityEventType[]
  >([]);
  const [dateRange, setDateRange] = useState<DateRange>("all");

  const since = useMemo(() => dateRangeToSince(dateRange), [dateRange]);

  const filters = useMemo(
    () => ({
      eventTypes: selectedEventTypes.length > 0 ? selectedEventTypes : undefined,
      since,
    }),
    [selectedEventTypes, since],
  );

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useActivityFeed(workspaceId, filters);

  // Flatten all pages into a single event list
  const allEvents = useMemo(
    () => data?.pages.flatMap((page) => page.events) ?? [],
    [data],
  );

  const dayGroups = useMemo(() => groupByDay(allEvents), [allEvents]);

  // Count active filters for the mobile badge
  const activeFilterCount =
    selectedEventTypes.length + (dateRange !== "all" ? 1 : 0);

  return (
    <div className="flex h-full">
      {/* Filters sidebar (desktop only) */}
      <div className="hidden md:block w-[240px] border-r overflow-y-auto p-4">
        <ActivityFilters
          selectedEventTypes={selectedEventTypes}
          onEventTypesChange={setSelectedEventTypes}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Feed */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-background p-4">
          <div className="flex items-center justify-between">
            <div>
              <PageHeader
                title="Activity"
                className="mb-0"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Everything that happened in this workspace.
              </p>
            </div>

            {/* Mobile filter trigger */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      aria-label="Open activity filters"
                    />
                  }
                >
                  <SlidersHorizontal className="size-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 min-w-5 px-1 text-[10px]"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Activity Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 px-1 overflow-y-auto">
                    <ActivityFilters
                      selectedEventTypes={selectedEventTypes}
                      onEventTypesChange={setSelectedEventTypes}
                      dateRange={dateRange}
                      onDateRangeChange={setDateRange}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : allEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Brain className="w-12 h-12 mb-4 opacity-40" />
              <p className="text-sm font-medium">No activity yet</p>
              <p className="text-xs mt-1">
                Actions like creating entries, linking nodes, and restoring versions
                will show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {dayGroups.map((group) => (
                <div key={group.label}>
                  {/* Day divider */}
                  <div className="sticky top-[73px] z-[5] bg-background pb-1 pt-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </p>
                  </div>
                  {/* Events in this day */}
                  <div className="divide-y divide-border/50">
                    {group.events.map((event) => (
                      <ActivityEventRow key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Load more */}
              {hasNextPage && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage
                      ? "Loading..."
                      : "Show older activity"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

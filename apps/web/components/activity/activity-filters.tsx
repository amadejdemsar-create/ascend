"use client";

import { useMemo } from "react";
import type { ActivityEventType } from "@/lib/validations";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Event type grouping ──────────────────────────────────────────────

interface EventTypeGroup {
  label: string;
  types: ActivityEventType[];
}

const EVENT_TYPE_GROUPS: EventTypeGroup[] = [
  {
    label: "Nodes",
    types: ["NODE_CREATED", "NODE_UPDATED", "NODE_DELETED", "NODE_RESTORED", "NODE_BRANCHED"],
  },
  {
    label: "Links",
    types: ["LINK_CREATED", "LINK_REMOVED"],
  },
  {
    label: "Canvas",
    types: [
      "CANVAS_LAYOUT_CREATED",
      "CANVAS_LAYOUT_DELETED",
      "CANVAS_NODE_ADDED",
      "CANVAS_NODE_REMOVED",
    ],
  },
  {
    label: "Members",
    types: ["MEMBER_ADDED", "MEMBER_REMOVED", "MEMBER_ROLE_CHANGED"],
  },
];

// ── Date range options ───────────────────────────────────────────────

type DateRange = "24h" | "7d" | "30d" | "all";

interface DateRangeOption {
  value: DateRange;
  label: string;
}

const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

function dateRangeToSince(range: DateRange): Date | undefined {
  const now = new Date();
  switch (range) {
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "all":
      return undefined;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatEventTypeLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

// ── Props and component ──────────────────────────────────────────────

interface ActivityFiltersProps {
  selectedEventTypes: ActivityEventType[];
  onEventTypesChange: (types: ActivityEventType[]) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export type { DateRange };

export { dateRangeToSince };

export function ActivityFilters({
  selectedEventTypes,
  onEventTypesChange,
  dateRange,
  onDateRangeChange,
}: ActivityFiltersProps) {
  const selectedSet = useMemo(
    () => new Set(selectedEventTypes),
    [selectedEventTypes],
  );

  function toggleEventType(type: ActivityEventType) {
    if (selectedSet.has(type)) {
      onEventTypesChange(selectedEventTypes.filter((t) => t !== type));
    } else {
      onEventTypesChange([...selectedEventTypes, type]);
    }
  }

  // "All" means no filter (empty array), not "all types selected"
  const isAllSelected = selectedEventTypes.length === 0;

  function handleSelectAll() {
    onEventTypesChange([]);
  }

  return (
    <div className="space-y-6" role="group" aria-label="Activity filters">
      {/* Event type filters */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Event Types
        </h3>
        <div className="space-y-1">
          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAll}
              className="accent-primary h-4 w-4 rounded"
              aria-label="All event types"
            />
            <span className="text-sm">All</span>
          </label>
        </div>

        {EVENT_TYPE_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground/70 pl-6">
              {group.label}
            </p>
            {group.types.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer py-1 pl-2"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(type)}
                  onChange={() => toggleEventType(type)}
                  className="accent-primary h-4 w-4 rounded"
                  aria-label={formatEventTypeLabel(type)}
                />
                <span className="text-sm">
                  {formatEventTypeLabel(type)}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>

      {/* Date range */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Date Range
        </h3>
        <div className="space-y-1">
          {DATE_RANGE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 cursor-pointer py-1"
            >
              <input
                type="radio"
                name="dateRange"
                value={option.value}
                checked={dateRange === option.value}
                onChange={() => onDateRangeChange(option.value)}
                className="accent-primary"
                aria-label={option.label}
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Actor filter (disabled in Wave 8 single-user) */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Actor
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <select
                disabled
                className="w-full text-sm bg-muted/50 border rounded px-2 py-1.5 text-muted-foreground cursor-not-allowed"
                aria-label="Actor filter (not yet available)"
              >
                <option>All actors</option>
              </select>
            </TooltipTrigger>
            <TooltipContent>
              <p>Filtering by actor will be available when collaboration launches</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

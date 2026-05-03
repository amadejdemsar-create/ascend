"use client";

import { useMemo, useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import type {
  DatabaseResponse,
  DatabaseViewResponse,
  DatabaseFieldResponse,
} from "@/lib/hooks/use-databases";
import {
  useDatabaseRows,
  useUpdateRow,
  type DatabaseRowResponse,
  type DatabaseRowsPage,
} from "@/lib/hooks/use-database-rows";
import { useUpdateView } from "@/lib/hooks/use-database-views";
import { CalendarRowChip } from "./calendar-row-chip";
import { CalendarDayDetail } from "./calendar-day-detail";
import { CalendarViewErrorBoundary } from "./calendar-view-error-boundary";
import { ViewConfigPopover } from "@/components/databases/view-config";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────

const MAX_VISIBLE_CHIPS = 3;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Types ────────────────────────────────────────────────────────────────

interface DatabaseCalendarViewProps {
  database: DatabaseResponse;
  view: DatabaseViewResponse;
  onOpenRow: (rowEntryId: string) => void;
}

// ── Droppable Cell ───────────────────────────────────────────────────────

function DroppableCell({
  dateKey,
  children,
}: {
  dateKey: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dateKey });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[100px] border-t border-r border-border/40 p-1 transition-colors",
        isOver && "bg-primary/5",
      )}
    >
      {children}
    </div>
  );
}

// ── Inner Component ──────────────────────────────────────────────────────

function CalendarViewInner({
  database,
  view,
  onOpenRow,
}: DatabaseCalendarViewProps) {
  const queryClient = useQueryClient();

  // ── Parse view config ──────────────────────────────────────────────────

  const viewConfig = useMemo(() => {
    const cfg = (view.config ?? {}) as {
      type?: string;
      dateFieldId?: string;
      filter?: Record<string, unknown>;
      sort?: Array<{ fieldId: string; direction: "asc" | "desc" }>;
    };
    return cfg;
  }, [view.config]);

  // Resolve the date field.
  const dateField = useMemo(() => {
    if (!viewConfig.dateFieldId) return null;
    return (
      database.fields.find(
        (f) => f.id === viewConfig.dateFieldId && f.type === "DATE",
      ) ?? null
    );
  }, [database.fields, viewConfig.dateFieldId]);

  // Primary field.
  const primaryField = useMemo(
    () => database.fields.find((f) => f.isPrimary) ?? database.fields[0],
    [database.fields],
  );

  // Visible secondary fields (first 2 non-primary, non-formula, non-date-field).
  const visibleFields = useMemo(
    () =>
      database.fields
        .filter(
          (f) =>
            !f.isPrimary &&
            f.type !== "FORMULA" &&
            f.id !== dateField?.id,
        )
        .slice(0, 2),
    [database.fields, dateField],
  );

  // All available DATE fields (for empty state quick-pick).
  const dateFields = useMemo(
    () => database.fields.filter((f) => f.type === "DATE"),
    [database.fields],
  );

  // ── Month navigation state ─────────────────────────────────────────────

  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const handlePrevMonth = useCallback(() => {
    setCurrentMonth((m) => subMonths(m, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth((m) => addMonths(m, 1));
  }, []);

  const handleToday = useCallback(() => {
    setCurrentMonth(startOfMonth(new Date()));
  }, []);

  // ── Compute grid days (Monday start) ───────────────────────────────────

  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  // ── Fetch rows ─────────────────────────────────────────────────────────

  const {
    data: rowsPage,
    isLoading,
    isError,
    refetch,
  } = useDatabaseRows(database.id, {
    viewId: view.id,
    sort: viewConfig.sort,
    filter: viewConfig.filter,
  });

  const rows = rowsPage?.rows ?? [];

  // ── Group rows by date key ─────────────────────────────────────────────

  const rowsByDate = useMemo(() => {
    if (!dateField) return new Map<string, DatabaseRowResponse[]>();

    const map = new Map<string, DatabaseRowResponse[]>();
    for (const row of rows) {
      const dateValue = row.properties[dateField.id];
      if (typeof dateValue !== "string") continue;

      // Parse the ISO date and extract the yyyy-MM-dd key.
      try {
        const parsed = parseISO(dateValue);
        const key = format(parsed, "yyyy-MM-dd");
        const bucket = map.get(key);
        if (bucket) {
          bucket.push(row);
        } else {
          map.set(key, [row]);
        }
      } catch {
        // Skip rows with unparseable dates.
      }
    }
    return map;
  }, [rows, dateField]);

  // ── DnD state ──────────────────────────────────────────────────────────

  const [activeRow, setActiveRow] = useState<DatabaseRowResponse | null>(null);
  const updateRow = useUpdateRow(database.id);
  const updateView = useUpdateView(database.id);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const rowId = event.active.id as string;
      const row = rows.find((r) => r.id === rowId);
      if (row) setActiveRow(row);
    },
    [rows],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveRow(null);
      const { active, over } = event;
      if (!over || !dateField) return;

      const sourceDateKey = (active.data.current as { sourceDateKey?: string })
        ?.sourceDateKey;
      const targetDateKey = over.id as string;

      // If same date, no change needed.
      if (sourceDateKey === targetDateKey) return;

      const rowId = active.id as string;
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;

      // Build new ISO date from the target date key.
      const newDateISO = `${targetDateKey}T00:00:00.000Z`;
      const patch = { [dateField.id]: newDateISO };

      // Optimistic update: modify the React Query cache directly.
      const queryHash = JSON.stringify(
        Object.fromEntries(
          Object.entries({
            viewId: view.id,
            sort: viewConfig.sort,
            filter: viewConfig.filter,
          })
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => a.localeCompare(b)),
        ),
      );
      const rowsQueryKey = queryKeys.databases.rows(
        database.id,
        queryHash || undefined,
      );

      queryClient.setQueryData<DatabaseRowsPage>(rowsQueryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          rows: old.rows.map((r) =>
            r.id === rowId
              ? { ...r, properties: { ...r.properties, ...patch } }
              : r,
          ),
        };
      });

      // Fire the mutation.
      updateRow.mutate(
        {
          rowId,
          properties: patch,
          rowEntryId: row.entryId,
        },
        {
          onError: (err) => {
            // Rollback: re-fetch rows.
            queryClient.invalidateQueries({
              queryKey: queryKeys.databases.rows(database.id),
            });
            toast.error(`Failed to move row: ${err.message}`);
          },
        },
      );
    },
    [
      dateField,
      rows,
      view.id,
      viewConfig.sort,
      viewConfig.filter,
      database.id,
      queryClient,
      updateRow,
    ],
  );

  // ── Quick-pick handler for empty state ─────────────────────────────────

  const handleQuickPick = useCallback(
    (fieldId: string) => {
      updateView.mutate(
        {
          viewId: view.id,
          config: { ...(view.config ?? {}), type: "CALENDAR", dateFieldId: fieldId },
        },
        {
          onError: (err) => toast.error(err.message),
        },
      );
    },
    [updateView, view.id, view.config],
  );

  // ── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-7 gap-0">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
        <p>Failed to load rows.</p>
        <button
          type="button"
          className="text-primary underline underline-offset-4 hover:text-primary/80"
          onClick={() => refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Empty state: no valid dateFieldId ──────────────────────────────────

  if (!dateField) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-8">
        <div className="flex flex-col items-center gap-2 text-center max-w-sm">
          <CalendarIcon
            className="size-10 text-muted-foreground/40"
            aria-hidden="true"
          />
          <h3 className="text-sm font-medium text-foreground">
            Pick a date field to see the calendar
          </h3>
          <p className="text-xs text-muted-foreground">
            {dateFields.length > 0
              ? "Choose which DATE field determines where rows appear on the calendar."
              : "Add a DATE field to your database to use the calendar view."}
          </p>
        </div>

        {dateFields.length > 0 && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-muted-foreground">Quick pick:</span>
            <div className="flex flex-wrap gap-2 justify-center">
              {dateFields.map((f) => (
                <Button
                  key={f.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPick(f.id)}
                  disabled={updateView.isPending}
                >
                  {f.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main calendar grid ─────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full" role="region" aria-label={`${database.name} calendar by ${dateField.name}`}>
        {/* Header: month title + navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <h2 className="text-lg font-semibold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevMonth}
                aria-label="Previous month"
              >
                <ChevronLeftIcon className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                aria-label="Next month"
              >
                <ChevronRightIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <ViewConfigPopover database={database} view={view} />
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border/40">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center border-r border-border/40 last:border-r-0"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 flex-1 border-l border-b border-border/40 overflow-y-auto">
          {gridDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayRows = rowsByDate.get(dateKey) ?? [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const visibleChips = dayRows.slice(0, MAX_VISIBLE_CHIPS);
            const overflowCount = dayRows.length - MAX_VISIBLE_CHIPS;

            return (
              <DroppableCell key={dateKey} dateKey={dateKey}>
                <div className="flex flex-col h-full gap-0.5">
                  {/* Date number */}
                  <div className="flex justify-end px-1 pt-0.5">
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        !isCurrentMonth && "text-muted-foreground/50",
                        isCurrentMonth && "text-foreground",
                        isTodayDate &&
                          "bg-primary text-primary-foreground rounded-full size-5 flex items-center justify-center font-bold",
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Row chips */}
                  <div className="flex flex-col gap-0.5 px-0.5">
                    {visibleChips.map((row) => (
                      <CalendarRowChip
                        key={row.id}
                        row={row}
                        primaryFieldId={primaryField.id}
                        sourceDateKey={dateKey}
                        onClick={() => onOpenRow(row.entryId)}
                      />
                    ))}

                    {/* Overflow indicator with popover */}
                    {overflowCount > 0 && (
                      <CalendarDayDetail
                        date={day}
                        rows={dayRows}
                        primaryFieldId={primaryField.id}
                        visibleFields={visibleFields}
                        onOpenRow={onOpenRow}
                        triggerLabel={`+ ${overflowCount} more`}
                      />
                    )}
                  </div>
                </div>
              </DroppableCell>
            );
          })}
        </div>
      </div>

      {/* Drag overlay: a floating chip that follows the cursor */}
      <DragOverlay>
        {activeRow ? (
          <div className="rounded px-1.5 py-0.5 text-xs font-medium bg-primary/20 text-primary shadow-lg ring-2 ring-primary/30 rotate-[2deg] max-w-[140px] truncate">
            {typeof activeRow.properties[primaryField.id] === "string" &&
            (activeRow.properties[primaryField.id] as string).trim()
              ? (activeRow.properties[primaryField.id] as string)
              : "(Untitled)"}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Exported with error boundary ──────────────────────────────────────────

/**
 * Database Calendar View.
 *
 * Renders rows on a month grid based on a chosen DATE field. Rows appear as
 * chips inside the date cell; drag a chip to a different date to update the
 * property. Wrapped in an error boundary (DZ-7).
 */
export function DatabaseCalendarView(props: DatabaseCalendarViewProps) {
  return (
    <CalendarViewErrorBoundary>
      <CalendarViewInner {...props} />
    </CalendarViewErrorBoundary>
  );
}

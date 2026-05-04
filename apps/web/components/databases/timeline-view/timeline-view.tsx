"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  differenceInDays,
  addDays,
  subDays,
  parseISO,
  min as dateMin,
  max as dateMax,
  startOfDay,
  format,
} from "date-fns";
import { GanttChartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { formatErrorMessage } from "@/lib/format-error";
import type {
  DatabaseResponse,
  DatabaseViewResponse,
} from "@/lib/hooks/use-databases";
import {
  useDatabaseRows,
  useUpdateRow,
  type DatabaseRowResponse,
  type DatabaseRowsPage,
} from "@/lib/hooks/use-database-rows";
import { useUpdateView } from "@/lib/hooks/use-database-views";
import { TimelineAxis } from "./timeline-axis";
import { TimelineBar } from "./timeline-bar";
import { TimelineViewErrorBoundary } from "./timeline-view-error-boundary";
import { ViewConfigPopover } from "@/components/databases/view-config";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────

const PIXELS_PER_DAY: Record<"day" | "week" | "month", number> = {
  day: 40,
  week: 12,
  month: 4,
};

const ROW_HEIGHT = 36;
const PADDING_DAYS = 14;
const FALLBACK_RANGE_DAYS = 30;

// ── Types ────────────────────────────────────────────────────────────────

interface TimelineViewProps {
  database: DatabaseResponse;
  view: DatabaseViewResponse;
  onOpenRow: (rowEntryId: string) => void;
}

interface TimelineRowData {
  row: DatabaseRowResponse;
  startDate: Date;
  endDate: Date;
}

// ── Inner Component ──────────────────────────────────────────────────────

function TimelineViewInner({
  database,
  view,
  onOpenRow,
}: TimelineViewProps) {
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Parse view config ──────────────────────────────────────────────────

  const viewConfig = useMemo(() => {
    const cfg = (view.config ?? {}) as {
      type?: string;
      startFieldId?: string;
      endFieldId?: string;
      zoom?: "day" | "week" | "month";
      filter?: Record<string, unknown>;
      sort?: Array<{ fieldId: string; direction: "asc" | "desc" }>;
    };
    return cfg;
  }, [view.config]);

  const zoom = viewConfig.zoom ?? "week";

  // Resolve start and end fields.
  const startField = useMemo(() => {
    if (!viewConfig.startFieldId) return null;
    return (
      database.fields.find(
        (f) => f.id === viewConfig.startFieldId && f.type === "DATE",
      ) ?? null
    );
  }, [database.fields, viewConfig.startFieldId]);

  const endField = useMemo(() => {
    if (!viewConfig.endFieldId) return null;
    return (
      database.fields.find(
        (f) => f.id === viewConfig.endFieldId && f.type === "DATE",
      ) ?? null
    );
  }, [database.fields, viewConfig.endFieldId]);

  // Primary field for display.
  const primaryField = useMemo(
    () => database.fields.find((f) => f.isPrimary) ?? database.fields[0],
    [database.fields],
  );

  // Available DATE fields for the empty-state picker.
  const dateFields = useMemo(
    () => database.fields.filter((f) => f.type === "DATE"),
    [database.fields],
  );

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

  // ── Build valid timeline rows ──────────────────────────────────────────

  const timelineRows: TimelineRowData[] = useMemo(() => {
    if (!startField || !endField) return [];

    const result: TimelineRowData[] = [];
    for (const row of rows) {
      const startVal = row.properties[startField.id];
      const endVal = row.properties[endField.id];
      if (typeof startVal !== "string" || typeof endVal !== "string") continue;

      try {
        const sDate = startOfDay(parseISO(startVal));
        const eDate = startOfDay(parseISO(endVal));
        if (sDate <= eDate) {
          result.push({ row, startDate: sDate, endDate: eDate });
        }
      } catch {
        // Skip rows with unparseable dates.
      }
    }
    return result;
  }, [rows, startField, endField]);

  // ── Compute timeline range ─────────────────────────────────────────────

  const { rangeStart, rangeEnd } = useMemo(() => {
    const today = startOfDay(new Date());

    if (timelineRows.length === 0) {
      return {
        rangeStart: subDays(today, FALLBACK_RANGE_DAYS),
        rangeEnd: addDays(today, FALLBACK_RANGE_DAYS),
      };
    }

    const allStarts = timelineRows.map((r) => r.startDate);
    const allEnds = timelineRows.map((r) => r.endDate);
    const earliest = dateMin(allStarts);
    const latest = dateMax(allEnds);

    return {
      rangeStart: subDays(earliest, PADDING_DAYS),
      rangeEnd: addDays(latest, PADDING_DAYS),
    };
  }, [timelineRows]);

  const pixelsPerDay = PIXELS_PER_DAY[zoom];
  const totalWidth = differenceInDays(rangeEnd, rangeStart) * pixelsPerDay;

  // ── Today scroll ───────────────────────────────────────────────────────

  const handleScrollToToday = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const today = startOfDay(new Date());
    const todayOffset = differenceInDays(today, rangeStart) * pixelsPerDay;
    const containerWidth = scrollContainerRef.current.clientWidth;
    scrollContainerRef.current.scrollLeft = Math.max(
      0,
      todayOffset - containerWidth / 2,
    );
  }, [rangeStart, pixelsPerDay]);

  // ── Zoom change ────────────────────────────────────────────────────────

  const updateView = useUpdateView(database.id);

  const handleZoomChange = useCallback(
    (newZoom: string) => {
      updateView.mutate(
        {
          viewId: view.id,
          config: {
            ...(view.config ?? {}),
            type: "TIMELINE",
            startFieldId: viewConfig.startFieldId,
            endFieldId: viewConfig.endFieldId,
            zoom: newZoom as "day" | "week" | "month",
          },
        },
        {
          onError: (err) => toast.error(err.message),
        },
      );
    },
    [updateView, view.id, view.config, viewConfig.startFieldId, viewConfig.endFieldId],
  );

  // ── DnD setup (bar move) ───────────────────────────────────────────────

  const updateRow = useUpdateRow(database.id);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event;
      if (!startField || !endField) return;

      // Only use x-delta (horizontal axis only).
      const dayDelta = Math.round(delta.x / pixelsPerDay);
      if (dayDelta === 0) return;

      const rowId = active.id as string;
      const timelineRow = timelineRows.find((tr) => tr.row.id === rowId);
      if (!timelineRow) return;

      const newStartISO = format(
        addDays(timelineRow.startDate, dayDelta),
        "yyyy-MM-dd'T'00:00:00.000'Z'",
      );
      const newEndISO = format(
        addDays(timelineRow.endDate, dayDelta),
        "yyyy-MM-dd'T'00:00:00.000'Z'",
      );

      const patch = {
        [startField.id]: newStartISO,
        [endField.id]: newEndISO,
      };

      // Optimistic update.
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

      updateRow.mutate(
        {
          rowId,
          properties: patch,
          rowEntryId: timelineRow.row.entryId,
        },
        {
          onError: (err) => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.databases.rows(database.id),
            });
            toast.error(`Failed to move bar: ${formatErrorMessage(err)}`);
          },
        },
      );
    },
    [
      startField,
      endField,
      pixelsPerDay,
      timelineRows,
      view.id,
      viewConfig.sort,
      viewConfig.filter,
      database.id,
      queryClient,
      updateRow,
    ],
  );

  // ── Resize handlers ────────────────────────────────────────────────────

  const handleResizeStart = useCallback(
    (rowId: string, dayDelta: number) => {
      if (!startField || !endField) return;
      const timelineRow = timelineRows.find((tr) => tr.row.id === rowId);
      if (!timelineRow) return;

      const newStartISO = format(
        addDays(timelineRow.startDate, dayDelta),
        "yyyy-MM-dd'T'00:00:00.000'Z'",
      );
      const patch = { [startField.id]: newStartISO };

      // Optimistic update.
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

      updateRow.mutate(
        {
          rowId,
          properties: patch,
          rowEntryId: timelineRow.row.entryId,
        },
        {
          onError: (err) => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.databases.rows(database.id),
            });
            toast.error(`Failed to resize bar: ${formatErrorMessage(err)}`);
          },
        },
      );
    },
    [
      startField,
      endField,
      timelineRows,
      view.id,
      viewConfig.sort,
      viewConfig.filter,
      database.id,
      queryClient,
      updateRow,
    ],
  );

  const handleResizeEnd = useCallback(
    (rowId: string, dayDelta: number) => {
      if (!startField || !endField) return;
      const timelineRow = timelineRows.find((tr) => tr.row.id === rowId);
      if (!timelineRow) return;

      const newEndISO = format(
        addDays(timelineRow.endDate, dayDelta),
        "yyyy-MM-dd'T'00:00:00.000'Z'",
      );
      const patch = { [endField.id]: newEndISO };

      // Optimistic update.
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

      updateRow.mutate(
        {
          rowId,
          properties: patch,
          rowEntryId: timelineRow.row.entryId,
        },
        {
          onError: (err) => {
            queryClient.invalidateQueries({
              queryKey: queryKeys.databases.rows(database.id),
            });
            toast.error(`Failed to resize bar: ${formatErrorMessage(err)}`);
          },
        },
      );
    },
    [
      startField,
      endField,
      timelineRows,
      view.id,
      viewConfig.sort,
      viewConfig.filter,
      database.id,
      queryClient,
      updateRow,
    ],
  );

  // ── Empty state quick-pick ─────────────────────────────────────────────

  const [pickedStart, setPickedStart] = useState<string>("");
  const [pickedEnd, setPickedEnd] = useState<string>("");

  const handleApplyFieldPick = useCallback(() => {
    if (!pickedStart || !pickedEnd) return;
    updateView.mutate(
      {
        viewId: view.id,
        config: {
          ...(view.config ?? {}),
          type: "TIMELINE",
          startFieldId: pickedStart,
          endFieldId: pickedEnd,
          zoom: zoom,
        },
      },
      {
        onError: (err) => toast.error(err.message),
      },
    );
  }, [pickedStart, pickedEnd, updateView, view.id, view.config, zoom]);

  // ── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
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

  // ── Empty state: fields not configured ─────────────────────────────────

  if (!startField || !endField) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-8">
        <div className="flex flex-col items-center gap-2 text-center max-w-sm">
          <GanttChartIcon
            className="size-10 text-muted-foreground/40"
            aria-hidden="true"
          />
          <h3 className="text-sm font-medium text-foreground">
            Pick start and end DATE fields to see the timeline
          </h3>
          <p className="text-xs text-muted-foreground">
            {dateFields.length >= 2
              ? "Choose which DATE fields determine where rows appear on the timeline."
              : "Add two DATE fields to your database to use the timeline view."}
          </p>
        </div>

        {dateFields.length >= 2 && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="timeline-start-field"
                  className="text-xs text-muted-foreground"
                >
                  Start
                </label>
                <Select
                  value={pickedStart}
                  onValueChange={(v) => setPickedStart(v ?? "")}
                >
                  <SelectTrigger
                    id="timeline-start-field"
                    className="w-[160px]"
                  >
                    <SelectValue placeholder="Start field" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateFields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="timeline-end-field"
                  className="text-xs text-muted-foreground"
                >
                  End
                </label>
                <Select
                  value={pickedEnd}
                  onValueChange={(v) => setPickedEnd(v ?? "")}
                >
                  <SelectTrigger
                    id="timeline-end-field"
                    className="w-[160px]"
                  >
                    <SelectValue placeholder="End field" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateFields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              variant="default"
              size="sm"
              disabled={
                !pickedStart ||
                !pickedEnd ||
                pickedStart === pickedEnd ||
                updateView.isPending
              }
              onClick={handleApplyFieldPick}
            >
              Apply
            </Button>

            {pickedStart && pickedEnd && pickedStart === pickedEnd && (
              <p className="text-xs text-destructive">
                Start and end must be different fields.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Compute today marker position ──────────────────────────────────────

  const today = startOfDay(new Date());
  const todayX = differenceInDays(today, rangeStart) * pixelsPerDay;
  const showTodayLine = todayX >= 0 && todayX <= totalWidth;

  // ── Main timeline render ───────────────────────────────────────────────

  const bodyHeight = Math.max(timelineRows.length * ROW_HEIGHT, 200);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        className="flex flex-col h-full"
        role="region"
        aria-label={`${database.name} timeline from ${startField.name} to ${endField.name}`}
      >
        {/* Header: zoom controls + Today button */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Zoom:</span>
            <div className="flex items-center gap-1">
              {(["day", "week", "month"] as const).map((level) => (
                <Button
                  key={level}
                  variant={zoom === level ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5 text-xs capitalize"
                  onClick={() => handleZoomChange(level)}
                  aria-pressed={zoom === level}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleScrollToToday}
            >
              Today
            </Button>
            <ViewConfigPopover database={database} view={view} />
          </div>
        </div>

        {/* Scrollable timeline area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-auto"
        >
          <div style={{ width: totalWidth, minHeight: "100%" }}>
            {/* Sticky axis */}
            <div className="sticky top-0 z-20 bg-background">
              <TimelineAxis
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                pixelsPerDay={pixelsPerDay}
                zoom={zoom}
              />
            </div>

            {/* Body: bars */}
            <div
              className="relative"
              style={{ height: bodyHeight }}
            >
              {/* Today vertical line */}
              {showTodayLine && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-primary/40 z-10 pointer-events-none"
                  style={{ left: todayX }}
                />
              )}

              {/* Row bars */}
              {timelineRows.map((tr, index) => (
                <div
                  key={tr.row.id}
                  className={cn(
                    "relative border-b border-border/20",
                    index % 2 === 0
                      ? "bg-transparent"
                      : "bg-muted/20",
                  )}
                  style={{ height: ROW_HEIGHT }}
                >
                  <TimelineBar
                    row={tr.row}
                    startDate={tr.startDate}
                    endDate={tr.endDate}
                    primaryFieldId={primaryField.id}
                    rangeStart={rangeStart}
                    pixelsPerDay={pixelsPerDay}
                    onResizeStart={(dayDelta) =>
                      handleResizeStart(tr.row.id, dayDelta)
                    }
                    onResizeEnd={(dayDelta) =>
                      handleResizeEnd(tr.row.id, dayDelta)
                    }
                    onOpen={() => onOpenRow(tr.row.entryId)}
                  />
                </div>
              ))}

              {/* Empty rows message */}
              {timelineRows.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    Add rows with start and end dates to see the timeline.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}

// ── Exported with error boundary ──────────────────────────────────────────

/**
 * Database Timeline View (Gantt).
 *
 * Renders rows as horizontal bars anchored to two DATE fields (start, end).
 * Drag a bar to move both dates; drag the left/right edge to resize.
 * Supports day/week/month zoom levels persisted via view config.
 * Wrapped in an error boundary (DZ-7).
 */
export function DatabaseTimelineView(props: TimelineViewProps) {
  return (
    <TimelineViewErrorBoundary>
      <TimelineViewInner {...props} />
    </TimelineViewErrorBoundary>
  );
}

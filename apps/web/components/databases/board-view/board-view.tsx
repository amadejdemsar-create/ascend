"use client";

import { useMemo, useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { LayoutGridIcon } from "lucide-react";
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
  useCreateRow,
  useUpdateRow,
  type DatabaseRowResponse,
  type DatabaseRowsPage,
} from "@/lib/hooks/use-database-rows";
import { useUpdateView } from "@/lib/hooks/use-database-views";
import { BoardColumn } from "./board-column";
import { BoardCard } from "./board-card";
import { BoardViewErrorBoundary } from "./board-view-error-boundary";

// ── Types ─────────────────────────────────────────────────────────────────

interface BoardViewProps {
  database: DatabaseResponse;
  view: DatabaseViewResponse;
  onOpenRow: (rowEntryId: string) => void;
}

interface SelectOption {
  id: string;
  label: string;
  color?: string;
}

// ── Inner Component ──────────────────────────────────────────────────────

function BoardViewInner({ database, view, onOpenRow }: BoardViewProps) {
  const queryClient = useQueryClient();

  // Parse view config.
  const viewConfig = useMemo(() => {
    const cfg = (view.config ?? {}) as {
      type?: string;
      groupByFieldId?: string;
      visiblePropertyIds?: string[];
      filter?: Record<string, unknown>;
      sort?: Array<{ fieldId: string; direction: "asc" | "desc" }>;
    };
    return cfg;
  }, [view.config]);

  // Find the group-by field.
  const groupByField = useMemo(() => {
    if (!viewConfig.groupByFieldId) return null;
    return database.fields.find((f) => f.id === viewConfig.groupByFieldId) ?? null;
  }, [database.fields, viewConfig.groupByFieldId]);

  // Determine if the group-by field is valid (SELECT or MULTI_SELECT).
  const isValidGroupBy =
    groupByField &&
    (groupByField.type === "SELECT" || groupByField.type === "MULTI_SELECT");

  // Get options from the group-by field config.
  const options: SelectOption[] = useMemo(() => {
    if (!isValidGroupBy || !groupByField) return [];
    const config = groupByField.config as { options?: SelectOption[] } | null;
    return config?.options ?? [];
  }, [isValidGroupBy, groupByField]);

  // Find the primary field.
  const primaryField = useMemo(
    () => database.fields.find((f) => f.isPrimary) ?? database.fields[0],
    [database.fields],
  );

  // Visible property IDs (default: first 3 non-primary, non-formula fields).
  const visiblePropertyIds = useMemo(() => {
    if (viewConfig.visiblePropertyIds?.length) {
      return viewConfig.visiblePropertyIds;
    }
    return database.fields
      .filter(
        (f) => !f.isPrimary && f.type !== "FORMULA" && f.id !== groupByField?.id,
      )
      .slice(0, 3)
      .map((f) => f.id);
  }, [database.fields, viewConfig.visiblePropertyIds, groupByField]);

  // Fetch rows.
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

  // Mutations.
  const createRow = useCreateRow(database.id);
  const updateRow = useUpdateRow(database.id);
  const updateView = useUpdateView(database.id);

  // DnD state.
  const [activeRow, setActiveRow] = useState<DatabaseRowResponse | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  // Group rows by the group-by field value.
  const groupedRows = useMemo(() => {
    if (!isValidGroupBy || !groupByField) return new Map<string, DatabaseRowResponse[]>();

    const groups = new Map<string, DatabaseRowResponse[]>();
    // Initialize with empty arrays for each option + null.
    groups.set("__null__", []);
    for (const opt of options) {
      groups.set(opt.id, []);
    }

    for (const row of rows) {
      const value = row.properties[groupByField.id];

      if (groupByField.type === "SELECT") {
        const optionId = typeof value === "string" ? value : null;
        const key = optionId && options.some((o) => o.id === optionId) ? optionId : "__null__";
        const bucket = groups.get(key);
        if (bucket) bucket.push(row);
        else groups.set(key, [row]);
      } else {
        // MULTI_SELECT: row appears in every bucket it belongs to.
        const valueArray = Array.isArray(value) ? (value as string[]) : [];
        const validValues = valueArray.filter((v) => options.some((o) => o.id === v));
        if (validValues.length === 0) {
          const bucket = groups.get("__null__");
          if (bucket) bucket.push(row);
        } else {
          for (const optId of validValues) {
            const bucket = groups.get(optId);
            if (bucket) bucket.push(row);
            else groups.set(optId, [row]);
          }
        }
      }
    }

    return groups;
  }, [isValidGroupBy, groupByField, options, rows]);

  // ── DnD handlers ────────────────────────────────────────────────────────

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
      if (!over || !groupByField) return;

      // Determine the target column (droppable container id).
      const sourceOptionId = (active.data.current as { sourceOptionId?: string })?.sourceOptionId;
      let targetOptionId: string | undefined;

      // The "over" can be a droppable (column) or a sortable (card inside column).
      // If over is a sortable card, we need to find which column it belongs to.
      if (over.data.current && "sourceOptionId" in (over.data.current as Record<string, unknown>)) {
        targetOptionId = (over.data.current as { sourceOptionId: string }).sourceOptionId;
      } else {
        // over.id IS the droppable id (column id).
        targetOptionId = over.id as string;
      }

      // If same column, no property change needed.
      if (sourceOptionId === targetOptionId) return;

      const rowId = active.id as string;
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;

      // Compute the property patch.
      let patch: Record<string, unknown>;

      if (groupByField.type === "SELECT") {
        // SELECT: set the value to targetOptionId (or null for __null__).
        const newValue = targetOptionId === "__null__" ? null : targetOptionId;
        patch = { [groupByField.id]: newValue };
      } else {
        // MULTI_SELECT: remove source option, add target option.
        const currentValue = Array.isArray(row.properties[groupByField.id])
          ? [...(row.properties[groupByField.id] as string[])]
          : [];

        // Remove source (unless source is __null__).
        if (sourceOptionId && sourceOptionId !== "__null__") {
          const idx = currentValue.indexOf(sourceOptionId);
          if (idx !== -1) currentValue.splice(idx, 1);
        }

        // Add target (unless target is __null__).
        if (targetOptionId && targetOptionId !== "__null__" && !currentValue.includes(targetOptionId)) {
          currentValue.push(targetOptionId);
        }

        const newValue = currentValue.length > 0 ? currentValue : null;
        patch = { [groupByField.id]: newValue };
      }

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
      const rowsQueryKey = queryKeys.databases.rows(database.id, queryHash || undefined);

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
            toast.error(`Failed to move card: ${err.message}`);
          },
        },
      );
    },
    [groupByField, rows, view.id, viewConfig.sort, viewConfig.filter, database.id, queryClient, updateRow],
  );

  // ── Add row to a specific column ───────────────────────────────────────

  const handleAddRowToColumn = useCallback(
    (optionId: string | null) => {
      if (!groupByField) return;
      const properties: Record<string, unknown> = {};

      if (optionId) {
        if (groupByField.type === "SELECT") {
          properties[groupByField.id] = optionId;
        } else {
          properties[groupByField.id] = [optionId];
        }
      }

      createRow.mutate(
        { properties },
        {
          onError: (err) => toast.error(err.message),
        },
      );
    },
    [groupByField, createRow],
  );

  // ── Quick-pick: set groupByFieldId on the view ─────────────────────────

  const selectMultiSelectFields = useMemo(
    () => database.fields.filter((f) => f.type === "SELECT" || f.type === "MULTI_SELECT"),
    [database.fields],
  );

  const handleQuickPick = useCallback(
    (fieldId: string) => {
      updateView.mutate(
        {
          viewId: view.id,
          config: { ...(view.config ?? {}), type: "BOARD", groupByFieldId: fieldId },
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
      <div className="flex gap-3 p-4 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 w-[280px] shrink-0 rounded-lg border border-border/50 p-3"
          >
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ))}
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

  // ── Empty state: no valid groupByFieldId ───────────────────────────────

  if (!isValidGroupBy) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-8">
        <div className="flex flex-col items-center gap-2 text-center max-w-sm">
          <LayoutGridIcon className="size-10 text-muted-foreground/40" aria-hidden="true" />
          <h3 className="text-sm font-medium text-foreground">
            Group by a field to see a board
          </h3>
          <p className="text-xs text-muted-foreground">
            Pick or add a SELECT or MULTI_SELECT field to group rows into columns.
          </p>
        </div>

        {selectMultiSelectFields.length > 0 && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-muted-foreground">Quick pick:</span>
            <div className="flex flex-wrap gap-2 justify-center">
              {selectMultiSelectFields.map((f) => (
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

        <Button
          variant="secondary"
          size="sm"
          onClick={() => toast.info("View config UI lands in Phase 12")}
        >
          Configure board
        </Button>
      </div>
    );
  }

  // ── Main board render ──────────────────────────────────────────────────

  // Build column list: "No value" first, then options in order.
  const columnEntries: Array<{ option: SelectOption | null; rows: DatabaseRowResponse[] }> = [
    { option: null, rows: groupedRows.get("__null__") ?? [] },
    ...options.map((opt) => ({ option: opt, rows: groupedRows.get(opt.id) ?? [] })),
  ];

  // Compute visible properties for the active overlay card.
  const overlayVisibleFields = database.fields
    .filter(
      (f) =>
        visiblePropertyIds.includes(f.id) &&
        f.id !== primaryField.id &&
        f.type !== "FORMULA",
    )
    .slice(0, 3);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex gap-3 p-4 overflow-x-auto h-full items-start"
        role="region"
        aria-label={`${database.name} board grouped by ${groupByField.name}`}
      >
        {columnEntries.map(({ option, rows: columnRows }) => (
          <BoardColumn
            key={option?.id ?? "__null__"}
            field={groupByField}
            option={option}
            rows={columnRows}
            visiblePropertyIds={visiblePropertyIds}
            primaryFieldId={primaryField.id}
            primaryFieldName={primaryField.name}
            fields={database.fields}
            onOpenRow={onOpenRow}
            onAddRow={() => handleAddRowToColumn(option?.id ?? null)}
            addRowPending={createRow.isPending}
          />
        ))}
      </div>

      {/* Drag overlay: a floating card that follows the cursor */}
      <DragOverlay>
        {activeRow ? (
          <BoardCard
            row={activeRow}
            primaryFieldId={primaryField.id}
            primaryFieldName={primaryField.name}
            visibleProperties={overlayVisibleFields.map((f) => ({
              field: f,
              value: activeRow.properties[f.id],
            }))}
            isOverlay
            onOpen={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Exported with error boundary ──────────────────────────────────────────

/**
 * Database Board View (Kanban).
 *
 * Groups rows into columns based on a SELECT or MULTI_SELECT field.
 * Cards can be dragged between columns to update the group-by property.
 * Wrapped in an error boundary (DZ-7) that catches render failures.
 */
export function BoardView(props: BoardViewProps) {
  return (
    <BoardViewErrorBoundary>
      <BoardViewInner {...props} />
    </BoardViewErrorBoundary>
  );
}

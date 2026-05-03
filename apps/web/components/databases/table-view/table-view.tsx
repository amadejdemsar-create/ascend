"use client";

import { useMemo, useRef, useCallback, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnSizingState,
  type ColumnOrderState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { GripVerticalIcon, DatabaseIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SortItem, DatabaseFieldType } from "@ascend/core";
import type {
  DatabaseResponse,
  DatabaseViewResponse,
  DatabaseFieldResponse,
} from "@/lib/hooks/use-databases";
import {
  useDatabaseRows,
  useCreateRow,
  useUpdateRow,
  useReorderRows,
} from "@/lib/hooks/use-database-rows";
import { useUpdateField, useDeleteField, useAddField } from "@/lib/hooks/use-database-fields";
import { useUpdateView } from "@/lib/hooks/use-database-views";
import { useDatabases } from "@/lib/hooks/use-databases";
import { TableHeaderCell } from "./table-header-cell";
import { TableCell } from "./table-cell";
import { TableAddRow } from "./table-add-row";
import { TableAddColumn } from "./table-add-column";
import { TableViewErrorBoundary } from "./table-view-error-boundary";

// ── Types ─────────────────────────────────────────────────────────────────

interface TableViewProps {
  database: DatabaseResponse;
  view: DatabaseViewResponse;
  onOpenRow: (rowEntryId: string) => void;
}

// TanStack Table row data shape: a flat object with field IDs as keys.
type RowData = Record<string, unknown> & {
  __id: string;
  __entryId: string;
  __position: number;
};

// ── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_COLUMN_WIDTH = 180;
const MIN_COLUMN_WIDTH = 80;
const ROW_HEIGHT = 36;
const OVERSCAN = 8;
const RESIZE_DEBOUNCE_MS = 300;

// ── Component ─────────────────────────────────────────────────────────────

function TableViewInner({ database, view, onOpenRow }: TableViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse view config.
  const viewConfig = useMemo(() => {
    const cfg = (view.config ?? {}) as {
      type?: string;
      columnWidths?: Record<string, number>;
      columnOrder?: string[];
      hiddenFieldIds?: string[];
      frozenPrimary?: boolean;
      sort?: SortItem[];
      filter?: Record<string, unknown>;
    };
    return cfg;
  }, [view.config]);

  // Fetch rows using view-level sort (server-side).
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
  const reorderRows = useReorderRows(database.id);
  const updateField = useUpdateField(database.id);
  const deleteField = useDeleteField(database.id);
  const addField = useAddField();
  const updateView = useUpdateView(database.id);
  const { data: allDatabases } = useDatabases();

  // Compute visible fields (sorted by position, hidden removed).
  const visibleFields = useMemo(() => {
    const hidden = new Set(viewConfig.hiddenFieldIds ?? []);
    let sorted = [...database.fields]
      .filter((f) => !hidden.has(f.id))
      .sort((a, b) => a.position - b.position);

    // If custom column order is set, apply it.
    if (viewConfig.columnOrder?.length) {
      const orderMap = new Map(viewConfig.columnOrder.map((id, idx) => [id, idx]));
      sorted = sorted.sort((a, b) => {
        const ai = orderMap.get(a.id) ?? a.position;
        const bi = orderMap.get(b.id) ?? b.position;
        return ai - bi;
      });
    }

    return sorted;
  }, [database.fields, viewConfig.hiddenFieldIds, viewConfig.columnOrder]);

  // Determine if manual sort is active (no server sort).
  const hasActiveSort = (viewConfig.sort?.length ?? 0) > 0;

  // Transform rows into flat data for TanStack Table.
  const tableData: RowData[] = useMemo(
    () =>
      rows.map((r) => ({
        ...r.properties,
        __id: r.id,
        __entryId: r.entryId,
        __position: r.position,
      })),
    [rows],
  );

  // ── Column definitions ─────────────────────────────────���──────────────

  const columns: ColumnDef<RowData, unknown>[] = useMemo(() => {
    const cols: ColumnDef<RowData, unknown>[] = [];

    // Leading row-handle column (only when manual sort is possible).
    if (!hasActiveSort) {
      cols.push({
        id: "__drag_handle",
        header: () => null,
        cell: () => (
          <div className="flex items-center justify-center h-full cursor-grab active:cursor-grabbing opacity-40 hover:opacity-100">
            <GripVerticalIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </div>
        ),
        size: 28,
        minSize: 28,
        maxSize: 28,
        enableResizing: false,
      });
    }

    // Data columns from fields.
    for (const field of visibleFields) {
      cols.push({
        id: field.id,
        accessorFn: (row) => row[field.id],
        header: ({ header }) => (
          <TableHeaderCell
            header={header}
            field={field}
            sort={viewConfig.sort}
            onSortChange={handleSortChange}
            onHide={handleHideField}
            onRename={handleRenameField}
            onChangeType={handleChangeType}
            onDelete={handleDeleteField}
          />
        ),
        cell: ({ row }) => (
          <TableCell
            field={field}
            value={row.original[field.id]}
            isPrimary={field.isPrimary}
            onOpenRow={
              field.isPrimary
                ? () => onOpenRow(row.original.__entryId)
                : undefined
            }
            onUpdate={(newValue) => handleCellUpdate(row.original, field, newValue)}
          />
        ),
        size: viewConfig.columnWidths?.[field.id] ?? DEFAULT_COLUMN_WIDTH,
        minSize: MIN_COLUMN_WIDTH,
        enableResizing: true,
      });
    }

    return cols;
  }, [visibleFields, hasActiveSort, viewConfig.sort, viewConfig.columnWidths]);

  // ── Column state ──────────────────────────────────────────────────────

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    viewConfig.columnWidths ?? {},
  );

  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => {
    if (viewConfig.columnOrder?.length) return viewConfig.columnOrder;
    const ids: string[] = [];
    if (!hasActiveSort) ids.push("__drag_handle");
    ids.push(...visibleFields.map((f) => f.id));
    return ids;
  });

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const hidden = new Set(viewConfig.hiddenFieldIds ?? []);
    const vis: VisibilityState = {};
    for (const f of database.fields) {
      if (hidden.has(f.id)) vis[f.id] = false;
    }
    return vis;
  });

  // ── Table instance ────────────────────────────────────────────────────

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    state: {
      columnSizing,
      columnOrder,
      columnVisibility,
    },
    onColumnSizingChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnSizing) : updater;
      setColumnSizing(next);
      // Debounce persistence.
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        persistViewConfig({ columnWidths: next });
      }, RESIZE_DEBOUNCE_MS);
    },
    onColumnOrderChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnOrder) : updater;
      setColumnOrder(next);
      persistViewConfig({ columnOrder: next });
    },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(next);
      const hiddenIds = Object.entries(next)
        .filter(([, visible]) => !visible)
        .map(([id]) => id);
      persistViewConfig({ hiddenFieldIds: hiddenIds });
    },
    manualSorting: true,
  });

  // ── Virtualizer ───────────────────────────────────────────────────────

  const tableRows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = virtualizer.getVirtualItems();

  // ── Handlers ──────────────────────────────────────────────────────────

  const persistViewConfig = useCallback(
    (patch: Record<string, unknown>) => {
      const merged = { ...(view.config ?? {}), ...patch };
      updateView.mutate({ viewId: view.id, config: merged });
    },
    [view.id, view.config, updateView],
  );

  const handleSortChange = useCallback(
    (sort: SortItem[] | undefined) => {
      persistViewConfig({ sort: sort ?? null });
    },
    [persistViewConfig],
  );

  const handleHideField = useCallback(
    (fieldId: string) => {
      const current = new Set(viewConfig.hiddenFieldIds ?? []);
      current.add(fieldId);
      const hiddenIds = Array.from(current);
      setColumnVisibility((prev) => ({ ...prev, [fieldId]: false }));
      persistViewConfig({ hiddenFieldIds: hiddenIds });
    },
    [viewConfig.hiddenFieldIds, persistViewConfig],
  );

  const handleRenameField = useCallback(
    (fieldId: string, name: string) => {
      updateField.mutate(
        { databaseId: database.id, fieldId, name },
        {
          onError: (err) => toast.error(err.message),
        },
      );
    },
    [database.id, updateField],
  );

  const handleChangeType = useCallback(
    (fieldId: string, currentType: string) => {
      // Phase 7 surfaces the kebab; the actual type-change popover with
      // compatible-type picker is deferred to a follow-up. For now, toast.
      toast.info("Type change UI will be expanded in a future phase");
    },
    [],
  );

  const handleDeleteField = useCallback(
    (fieldId: string) => {
      deleteField.mutate(
        { fieldId },
        {
          onSuccess: () => toast.success("Column deleted"),
          onError: (err) => toast.error(err.message),
        },
      );
    },
    [deleteField],
  );

  const handleCellUpdate = useCallback(
    (row: RowData, field: DatabaseFieldResponse, newValue: unknown) => {
      // Determine if this is a RELATION field for cross-domain invalidation.
      const affectsRelations = field.type === "RELATION";
      updateRow.mutate(
        {
          rowId: row.__id,
          properties: { [field.id]: newValue },
          affectsRelations,
          rowEntryId: row.__entryId,
        },
        {
          onError: (err) => toast.error(err.message),
        },
      );
    },
    [updateRow],
  );

  const handleAddRow = useCallback(() => {
    createRow.mutate(undefined, {
      onError: (err) => toast.error(err.message),
    });
  }, [createRow]);

  const handleAddField = useCallback(
    (input: { name: string; type: DatabaseFieldType; config?: Record<string, unknown> }) => {
      addField.mutate(
        { databaseId: database.id, ...input },
        {
          onSuccess: () => toast.success("Column added"),
          onError: (err) => toast.error(err.message),
        },
      );
    },
    [addField, database.id],
  );

  // ── Drag row reorder ──────────────────────────────────────────────────

  const [dragRowIndex, setDragRowIndex] = useState<number | null>(null);

  const handleRowDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragRowIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    [],
  );

  const handleRowDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleRowDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (dragRowIndex === null || dragRowIndex === targetIndex) {
        setDragRowIndex(null);
        return;
      }
      // Compute new order.
      const newOrder = [...tableData.map((r) => r.__id)];
      const [moved] = newOrder.splice(dragRowIndex, 1);
      newOrder.splice(targetIndex, 0, moved);
      reorderRows.mutate(
        { orderedRowIds: newOrder },
        {
          onError: (err) => toast.error(err.message),
        },
      );
      setDragRowIndex(null);
    },
    [dragRowIndex, tableData, reorderRows],
  );

  // ── Loading state ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col gap-0 w-full h-full">
        <div className="flex items-center h-9 border-b border-border px-2">
          {visibleFields.slice(0, 4).map((f) => (
            <Skeleton key={f.id} className="h-4 w-24 mr-4" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center h-9 border-b border-border/50 px-2 gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────

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

  // ── Empty state ───────────────────────────────────────────────────────

  if (tableData.length === 0) {
    return (
      <div className="flex flex-col w-full h-full">
        {/* Header row (even when empty) */}
        <div className="flex items-center h-9 border-b border-border bg-muted/30 shrink-0">
          {table.getHeaderGroups().map((hg) =>
            hg.headers.map((header) => (
              <div
                key={header.id}
                className="flex items-center h-full"
                style={{ width: header.getSize() }}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
              </div>
            )),
          )}
          <TableAddColumn
            onAddField={handleAddField}
            isPending={addField.isPending}
            databases={allDatabases ?? []}
          />
        </div>
        {/* Empty body */}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
          <DatabaseIcon className="size-10 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No rows yet.</p>
          <button
            type="button"
            className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
            onClick={handleAddRow}
            disabled={createRow.isPending}
          >
            Add your first row
          </button>
        </div>
      </div>
    );
  }

  // ── Main table render ─────────────────────────────────────────────────

  const headerGroups = table.getHeaderGroups();
  const totalWidth = table.getTotalSize();

  return (
    <div className="flex flex-col w-full h-full">
      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto relative"
        role="grid"
        aria-label={`${database.name} table`}
        aria-rowcount={tableData.length}
        aria-colcount={visibleFields.length}
      >
        {/* Sticky header */}
        <div
          className="sticky top-0 z-20 flex items-center h-9 border-b border-border bg-muted/50 backdrop-blur-sm"
          style={{ minWidth: totalWidth }}
          role="row"
        >
          {headerGroups.map((hg) =>
            hg.headers.map((header) => {
              const isPrimary =
                header.id !== "__drag_handle" &&
                database.fields.find((f) => f.id === header.id)?.isPrimary;
              return (
                <div
                  key={header.id}
                  className={cn(
                    "flex items-center h-full shrink-0",
                    isPrimary && "sticky left-0 z-30 bg-muted/50 backdrop-blur-sm",
                  )}
                  style={{ width: header.getSize() }}
                  role="columnheader"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </div>
              );
            }),
          )}
          {/* Add column button at the end of header */}
          <div className="flex items-center h-full shrink-0 sticky right-0">
            <TableAddColumn
              onAddField={handleAddField}
              isPending={addField.isPending}
              databases={allDatabases ?? []}
            />
          </div>
        </div>

        {/* Virtual body */}
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            minWidth: totalWidth,
            position: "relative",
          }}
        >
          {virtualRows.map((virtualRow) => {
            const row = tableRows[virtualRow.index];
            if (!row) return null;
            return (
              <div
                key={row.id}
                className={cn(
                  "absolute top-0 left-0 flex items-center w-full border-b border-border/30 hover:bg-muted/30 transition-colors",
                  dragRowIndex === virtualRow.index && "opacity-50",
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                role="row"
                aria-rowindex={virtualRow.index + 2} // +2 because header is row 1
                draggable={!hasActiveSort}
                onDragStart={(e) => handleRowDragStart(e, virtualRow.index)}
                onDragOver={handleRowDragOver}
                onDrop={(e) => handleRowDrop(e, virtualRow.index)}
              >
                {row.getVisibleCells().map((cell) => {
                  const isPrimary =
                    cell.column.id !== "__drag_handle" &&
                    database.fields.find((f) => f.id === cell.column.id)?.isPrimary;
                  return (
                    <div
                      key={cell.id}
                      className={cn(
                        "flex items-center h-full shrink-0 border-r border-border/20 last:border-r-0",
                        isPrimary && "sticky left-0 z-10 bg-background",
                      )}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer: add row */}
      <TableAddRow onAddRow={handleAddRow} isPending={createRow.isPending} />
    </div>
  );
}

// ── Exported with error boundary ────────────────────────────────────────

/**
 * Database Table View.
 *
 * Built on TanStack Table v8 + TanStack Virtual v3 for performant
 * virtualized rendering with sticky header and primary column.
 *
 * Wrapped in an error boundary (DZ-7) that catches render failures and
 * shows a reload fallback.
 */
export function TableView(props: TableViewProps) {
  return (
    <TableViewErrorBoundary>
      <TableViewInner {...props} />
    </TableViewErrorBoundary>
  );
}

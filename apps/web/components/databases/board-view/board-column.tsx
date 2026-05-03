"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DatabaseFieldResponse } from "@/lib/hooks/use-databases";
import type { DatabaseRowResponse } from "@/lib/hooks/use-database-rows";
import { BoardCard } from "./board-card";

// ── Types ─────────────────────────────────────────────────────────────────

interface SelectOption {
  id: string;
  label: string;
  color?: string;
}

export interface BoardColumnProps {
  field: DatabaseFieldResponse;
  option: SelectOption | null; // null = "no value" column
  rows: DatabaseRowResponse[];
  visiblePropertyIds: string[];
  primaryFieldId: string;
  primaryFieldName: string;
  fields: DatabaseFieldResponse[];
  onOpenRow: (rowEntryId: string) => void;
  onAddRow: () => void;
  addRowPending: boolean;
}

// ── Sortable Card Wrapper ────────────────────────────────────────────────

function SortableBoardCard({
  row,
  primaryFieldId,
  primaryFieldName,
  visibleProperties,
  onOpen,
  sourceOptionId,
}: {
  row: DatabaseRowResponse;
  primaryFieldId: string;
  primaryFieldName: string;
  visibleProperties: Array<{ field: DatabaseFieldResponse; value: unknown }>;
  onOpen: () => void;
  sourceOptionId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
    data: { sourceOptionId },
  });

  const transformStr = transform
    ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
    : undefined;

  const style = {
    transform: transformStr,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <BoardCard
        row={row}
        primaryFieldId={primaryFieldId}
        primaryFieldName={primaryFieldName}
        visibleProperties={visibleProperties}
        isDragging={isDragging}
        onOpen={onOpen}
      />
    </div>
  );
}

// ── Column Component ─────────────────────────────────────────────────────

/**
 * A single column in the Board view. Acts as a droppable target.
 * Renders a list of sortable cards for the rows grouped to this option.
 */
export function BoardColumn({
  field,
  option,
  rows,
  visiblePropertyIds,
  primaryFieldId,
  primaryFieldName,
  fields,
  onOpenRow,
  onAddRow,
  addRowPending,
}: BoardColumnProps) {
  const droppableId = option?.id ?? "__null__";

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
  });

  // Compute visible properties for cards (limit to 3).
  const visibleFields = fields.filter(
    (f) =>
      visiblePropertyIds.includes(f.id) &&
      f.id !== primaryFieldId &&
      f.type !== "FORMULA",
  ).slice(0, 3);

  const columnLabel = option?.label ?? `No ${field.name}`;

  return (
    <div
      className={cn(
        "flex flex-col shrink-0 w-[280px] min-h-[200px] rounded-lg bg-muted/30 border border-border/50",
        isOver && "ring-2 ring-primary/40 bg-primary/5",
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30">
        {option?.color && (
          <span
            className="size-2.5 rounded-full shrink-0"
            style={{ backgroundColor: option.color }}
            aria-hidden="true"
          />
        )}
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {columnLabel}
        </span>
        <Badge variant="secondary" className="text-xs font-normal">
          {rows.length}
        </Badge>
      </div>

      {/* Card list (droppable) */}
      <div
        ref={setNodeRef}
        className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto min-h-[60px]"
      >
        <SortableContext
          items={rows.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          {rows.map((row) => (
            <SortableBoardCard
              key={row.id}
              row={row}
              primaryFieldId={primaryFieldId}
              primaryFieldName={primaryFieldName}
              visibleProperties={visibleFields.map((f) => ({
                field: f,
                value: row.properties[f.id],
              }))}
              onOpen={() => onOpenRow(row.entryId)}
              sourceOptionId={droppableId}
            />
          ))}
        </SortableContext>
      </div>

      {/* Add row button */}
      <div className="px-2 pb-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground gap-1.5"
          onClick={onAddRow}
          disabled={addRowPending}
          aria-label={`Add row to ${columnLabel}`}
        >
          <PlusIcon className="size-3.5" aria-hidden="true" />
          <span className="text-xs">Add</span>
        </Button>
      </div>
    </div>
  );
}

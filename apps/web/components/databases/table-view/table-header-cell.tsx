"use client";

import { useState, useCallback, useRef } from "react";
import type { Header } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  MoreHorizontalIcon,
  GripVerticalIcon,
  PencilIcon,
  EyeOffIcon,
  TrashIcon,
  FilterIcon,
  RepeatIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { DatabaseFieldResponse } from "@/lib/hooks/use-databases";
import type { SortItem } from "@ascend/core";

// ── Types ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TableHeaderCellProps {
  header: Header<any, unknown>;
  field: DatabaseFieldResponse;
  sort: SortItem[] | undefined;
  onSortChange: (sort: SortItem[] | undefined) => void;
  onHide: (fieldId: string) => void;
  onRename: (fieldId: string, name: string) => void;
  onChangeType: (fieldId: string, newType: string) => void;
  onDelete: (fieldId: string) => void;
  onFilterByColumn?: (fieldId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

function TableHeaderCellInner({
  header,
  field,
  sort,
  onSortChange,
  onHide,
  onRename,
  onChangeType,
  onDelete,
  onFilterByColumn,
  dragHandleProps,
}: TableHeaderCellProps & {
  dragHandleProps?: Record<string, unknown>;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(field.name);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Determine current sort direction for this field.
  const currentSort = sort?.find((s) => s.fieldId === field.id);
  const sortDirection = currentSort?.direction;

  // Cycle sort: none -> asc -> desc -> none
  const handleSortCycle = useCallback(() => {
    if (!sortDirection) {
      onSortChange([{ fieldId: field.id, direction: "asc" }]);
    } else if (sortDirection === "asc") {
      onSortChange([{ fieldId: field.id, direction: "desc" }]);
    } else {
      onSortChange(undefined);
    }
  }, [field.id, onSortChange, sortDirection]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== field.name) {
      onRename(field.id, trimmed);
    }
    setIsRenaming(false);
  }, [field.id, field.name, onRename, renameValue]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleRenameSubmit();
      } else if (e.key === "Escape") {
        setRenameValue(field.name);
        setIsRenaming(false);
      }
    },
    [field.name, handleRenameSubmit],
  );

  const handleDeleteConfirm = useCallback(() => {
    onDelete(field.id);
    setShowDeleteDialog(false);
  }, [field.id, onDelete]);

  const handleFilterClick = useCallback(() => {
    if (onFilterByColumn) {
      onFilterByColumn(field.id);
    }
  }, [onFilterByColumn, field.id]);

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-0.5 h-full group select-none",
          "border-r border-border/50 last:border-r-0",
        )}
      >
        {/* Drag handle for column reorder (dnd-kit) */}
        <div
          className="flex-none opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing px-0.5"
          aria-label={`Drag to reorder column ${field.name}`}
          {...dragHandleProps}
        >
          <GripVerticalIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </div>

        {/* Label area (click to sort) */}
        {isRenaming ? (
          <Input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            className="h-6 text-xs px-1 py-0 min-w-0 flex-1"
            autoFocus
            aria-label={`Rename column ${field.name}`}
          />
        ) : (
          <button
            type="button"
            className="flex-1 flex items-center gap-1 text-left text-xs font-medium text-muted-foreground truncate px-1 py-1 hover:text-foreground transition-colors"
            onClick={handleSortCycle}
            aria-label={`Sort by ${field.name}${sortDirection ? ` (currently ${sortDirection})` : ""}`}
          >
            <span className="truncate">{field.name}</span>
            {sortDirection === "asc" && (
              <ArrowUpIcon className="size-3 shrink-0 text-primary" aria-hidden="true" />
            )}
            {sortDirection === "desc" && (
              <ArrowDownIcon className="size-3 shrink-0 text-primary" aria-hidden="true" />
            )}
          </button>
        )}

        {/* Kebab menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-5 opacity-0 group-hover:opacity-100 shrink-0"
                aria-label={`Column options for ${field.name}`}
              />
            }
          >
            <MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem
              onClick={() => {
                setRenameValue(field.name);
                setIsRenaming(true);
              }}
            >
              <PencilIcon className="size-4 mr-2" aria-hidden="true" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onChangeType(field.id, field.type)}>
              <RepeatIcon className="size-4 mr-2" aria-hidden="true" />
              Change type
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSortChange([{ fieldId: field.id, direction: "asc" }])}>
              <ArrowUpIcon className="size-4 mr-2" aria-hidden="true" />
              Sort ascending
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange([{ fieldId: field.id, direction: "desc" }])}>
              <ArrowDownIcon className="size-4 mr-2" aria-hidden="true" />
              Sort descending
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleFilterClick}>
              <FilterIcon className="size-4 mr-2" aria-hidden="true" />
              Filter by this column
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onHide(field.id)}>
              <EyeOffIcon className="size-4 mr-2" aria-hidden="true" />
              Hide
            </DropdownMenuItem>
            {field.isPrimary ? (
              <DropdownMenuItem disabled>
                <TrashIcon className="size-4 mr-2" aria-hidden="true" />
                Cannot delete primary field
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <TrashIcon className="size-4 mr-2" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Resize handle */}
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={cn(
            "w-1 h-full cursor-col-resize select-none touch-none",
            "opacity-0 group-hover:opacity-100 bg-border hover:bg-primary transition-colors",
            header.column.getIsResizing() && "opacity-100 bg-primary",
          )}
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize column ${field.name}`}
        />
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete column &ldquo;{field.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the column and all its values from every row
              in this database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Sortable wrapper (uses dnd-kit) ──────────────────────────────────────

/**
 * Wraps TableHeaderCellInner with useSortable from dnd-kit so the column
 * header can participate in horizontal drag-and-drop reordering.
 *
 * The __drag_handle column is not sortable (it won't be in the
 * SortableContext items), so this wrapper is only rendered for data columns.
 */
export function SortableHeaderCell(props: TableHeaderCellProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.field.id });

  const transformStr = transform
    ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
    : undefined;

  const style = {
    transform: transformStr,
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="h-full w-full">
      <TableHeaderCellInner
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ── Legacy export (for backwards compat) ─────────────────────────────────

export { TableHeaderCellInner as TableHeaderCell };

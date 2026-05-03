"use client";

import { useCallback, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import type { DatabaseRowResponse } from "@/lib/hooks/use-database-rows";

// ── Types ────────────────────────────────────────────────────────────────

export interface TimelineBarProps {
  row: DatabaseRowResponse;
  startDate: Date;
  endDate: Date;
  primaryFieldId: string;
  rangeStart: Date;
  pixelsPerDay: number;
  onResizeStart: (dayDelta: number) => void;
  onResizeEnd: (dayDelta: number) => void;
  onOpen: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────

const HANDLE_WIDTH = 6;
const CLICK_THRESHOLD = 8;

// ── Component ────────────────────────────────────────────────────────────

/**
 * A single bar in the timeline representing a database row.
 *
 * The bar body is a dnd-kit draggable for horizontal-only move (the parent
 * DndContext only uses the x-delta). The left and right edges use raw
 * pointer events with setPointerCapture for resize behavior.
 */
export function TimelineBar({
  row,
  startDate,
  endDate,
  primaryFieldId,
  rangeStart,
  pixelsPerDay,
  onResizeStart,
  onResizeEnd,
  onOpen,
}: TimelineBarProps) {
  // ── Position + size ─────────────────────────────────────────────────────

  const baseLeft = differenceInDays(startDate, rangeStart) * pixelsPerDay;
  const baseWidth =
    (differenceInDays(endDate, startDate) + 1) * pixelsPerDay;

  // ── Resize state (local preview offsets in pixels) ──────────────────────

  const [leftResizeOffset, setLeftResizeOffset] = useState(0);
  const [rightResizeOffset, setRightResizeOffset] = useState(0);
  const leftResizeStartX = useRef(0);
  const rightResizeStartX = useRef(0);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  // ── DnD for the bar body (move) ─────────────────────────────────────────

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: row.id,
    });

  // Apply transform.x only (horizontal move); ignore y.
  const translateX = transform?.x ?? 0;

  // ── Click detection (distinguish click from drag) ───────────────────────

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDownBody = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
    },
    [],
  );

  const handleClickBody = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // If we were dragging (transform above threshold), don't fire click.
      if (pointerStartRef.current) {
        const dx = Math.abs(e.clientX - pointerStartRef.current.x);
        const dy = Math.abs(e.clientY - pointerStartRef.current.y);
        if (dx > CLICK_THRESHOLD || dy > CLICK_THRESHOLD) {
          pointerStartRef.current = null;
          return;
        }
      }
      pointerStartRef.current = null;
      onOpen();
    },
    [onOpen],
  );

  // ── Left edge resize (raw pointer events) ──────────────────────────────

  const handleLeftPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      isResizingLeft.current = true;
      leftResizeStartX.current = e.clientX;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handleLeftPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isResizingLeft.current) return;
      const dx = e.clientX - leftResizeStartX.current;
      setLeftResizeOffset(dx);
    },
    [],
  );

  const handleLeftPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isResizingLeft.current) return;
      isResizingLeft.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      const dx = e.clientX - leftResizeStartX.current;
      const dayDelta = Math.round(dx / pixelsPerDay);
      setLeftResizeOffset(0);
      if (dayDelta !== 0) {
        onResizeStart(dayDelta);
      }
    },
    [pixelsPerDay, onResizeStart],
  );

  // ── Right edge resize (raw pointer events) ─────────────────────────────

  const handleRightPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      isResizingRight.current = true;
      rightResizeStartX.current = e.clientX;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handleRightPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isResizingRight.current) return;
      const dx = e.clientX - rightResizeStartX.current;
      setRightResizeOffset(dx);
    },
    [],
  );

  const handleRightPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isResizingRight.current) return;
      isResizingRight.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      const dx = e.clientX - rightResizeStartX.current;
      const dayDelta = Math.round(dx / pixelsPerDay);
      setRightResizeOffset(0);
      if (dayDelta !== 0) {
        onResizeEnd(dayDelta);
      }
    },
    [pixelsPerDay, onResizeEnd],
  );

  // ── Display value ───────────────────────────────────────────────────────

  const primaryValue = row.properties[primaryFieldId];
  const displayTitle =
    typeof primaryValue === "string" && primaryValue.trim()
      ? primaryValue
      : "(Untitled)";

  // ── Computed dimensions with resize offsets ─────────────────────────────

  const effectiveLeft = baseLeft + leftResizeOffset + translateX;
  const effectiveWidth =
    baseWidth - leftResizeOffset + rightResizeOffset;

  return (
    <div
      className="absolute h-7 flex items-center"
      style={{
        left: effectiveLeft,
        width: Math.max(effectiveWidth, pixelsPerDay),
        top: 4,
      }}
    >
      {/* Left resize handle */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 cursor-col-resize z-20",
          "hover:bg-primary/30 rounded-l transition-colors",
        )}
        style={{ width: HANDLE_WIDTH }}
        onPointerDown={handleLeftPointerDown}
        onPointerMove={handleLeftPointerMove}
        onPointerUp={handleLeftPointerUp}
        role="separator"
        aria-label={`Resize start date for ${displayTitle}`}
        aria-orientation="vertical"
      />

      {/* Bar body (draggable for move) */}
      <div
        ref={setNodeRef}
        className={cn(
          "absolute inset-0 rounded-md px-2 flex items-center overflow-hidden",
          "bg-primary/15 border border-primary/25 hover:bg-primary/25",
          "cursor-grab active:cursor-grabbing select-none transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDragging && "opacity-60 shadow-lg",
        )}
        style={{
          marginLeft: HANDLE_WIDTH,
          marginRight: HANDLE_WIDTH,
        }}
        onPointerDown={handlePointerDownBody}
        onClick={handleClickBody}
        data-dragging={isDragging || undefined}
        {...attributes}
        {...listeners}
      >
        <span className="text-xs font-medium text-foreground truncate">
          {displayTitle}
        </span>
      </div>

      {/* Right resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 cursor-col-resize z-20",
          "hover:bg-primary/30 rounded-r transition-colors",
        )}
        style={{ width: HANDLE_WIDTH }}
        onPointerDown={handleRightPointerDown}
        onPointerMove={handleRightPointerMove}
        onPointerUp={handleRightPointerUp}
        role="separator"
        aria-label={`Resize end date for ${displayTitle}`}
        aria-orientation="vertical"
      />
    </div>
  );
}

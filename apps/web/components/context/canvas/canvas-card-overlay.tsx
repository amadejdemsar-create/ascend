"use client";

import { useEffect, useRef, useState } from "react";
import { useUIStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";
import type { CanvasNodeItem } from "@/lib/hooks/use-canvas";

interface Props {
  /** Excalidraw API ref. Lazily resolved by the parent. */
  excalidrawAPI: {
    getAppState: () => unknown;
  } | null;
  nodes: CanvasNodeItem[];
  onCardClick?: (contextEntryId: string) => void;
}

interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

/**
 * Wave 9 Phase 5: card overlay synced to Excalidraw scroll/zoom.
 *
 * For each CanvasNode, renders an absolutely-positioned <div> whose
 * `transform: translate3d(x, y, 0)` is recomputed every animation frame
 * from `excalidrawAPI.getAppState()` so cards stay glued to their
 * rectangles during pan + zoom.
 *
 * Card body uses the denormalized `node.contextEntry` (title, type, tags)
 * to avoid a second fetch per render.
 *
 * Click selects the entry detail (sets selectedContextEntryId in Zustand).
 */
export function CanvasCardOverlay({
  excalidrawAPI,
  nodes,
  onCardClick,
}: Props) {
  const setContextActiveView = useUIStore((s) => s.setContextActiveView);
  void setContextActiveView; // reserved for future click-to-back-to-list
  const [viewport, setViewport] = useState<Viewport>({
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
  });
  const rafRef = useRef<number | null>(null);
  const apiRef = useRef(excalidrawAPI);
  apiRef.current = excalidrawAPI;

  // Continuous rAF loop: read appState, update viewport state only on
  // meaningful change to avoid wasteful re-renders.
  useEffect(() => {
    function tick() {
      const api = apiRef.current;
      if (!api) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const ax = api.getAppState() as {
        scrollX?: number;
        scrollY?: number;
        zoom?: number | { value?: number };
      };
      const nextScrollX = ax.scrollX ?? 0;
      const nextScrollY = ax.scrollY ?? 0;
      const nextZoom =
        typeof ax.zoom === "number"
          ? ax.zoom
          : (ax.zoom?.value ?? 1);
      setViewport((prev) => {
        if (
          Math.abs(prev.scrollX - nextScrollX) < 0.5 &&
          Math.abs(prev.scrollY - nextScrollY) < 0.5 &&
          Math.abs(prev.zoom - nextZoom) < 0.001
        ) {
          return prev;
        }
        return { scrollX: nextScrollX, scrollY: nextScrollY, zoom: nextZoom };
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      aria-hidden="false"
    >
      {nodes.map((node) => {
        const screenX = (node.x + viewport.scrollX) * viewport.zoom;
        const screenY = (node.y + viewport.scrollY) * viewport.zoom;
        const w = node.w * viewport.zoom;
        const h = node.h * viewport.zoom;
        return (
          <CanvasCard
            key={node.id}
            node={node}
            screenX={screenX}
            screenY={screenY}
            w={w}
            h={h}
            zoom={viewport.zoom}
            onClick={() => onCardClick?.(node.contextEntryId)}
          />
        );
      })}
    </div>
  );
}

interface CanvasCardProps {
  node: CanvasNodeItem;
  screenX: number;
  screenY: number;
  w: number;
  h: number;
  zoom: number;
  onClick: () => void;
}

const ENTRY_TYPE_LABEL: Record<string, string> = {
  NOTE: "Note",
  SOURCE: "Source",
  PROJECT: "Project",
  PERSON: "Person",
  DECISION: "Decision",
  QUESTION: "Question",
  AREA: "Area",
  DATABASE: "Database",
  RECORD: "Record",
};

function CanvasCard({
  node,
  screenX,
  screenY,
  w,
  h,
  zoom,
  onClick,
}: CanvasCardProps) {
  const entry = node.contextEntry;
  const title = entry?.title ?? "Untitled";
  const typeLabel = ENTRY_TYPE_LABEL[entry?.type ?? "NOTE"] ?? "Note";
  // Below 0.6x zoom show only the title; below 0.35x render a dot only.
  const isCompact = zoom < 0.6;
  const isMini = zoom < 0.35;

  return (
    <button
      type="button"
      className={cn(
        "pointer-events-auto absolute flex flex-col gap-1 overflow-hidden rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isMini && "items-center justify-center p-0",
      )}
      style={{
        transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
        width: w,
        height: h,
        fontSize: Math.max(10, 13 * zoom),
        willChange: "transform",
      }}
      onClick={onClick}
      aria-label={`${typeLabel}: ${title}`}
    >
      {isMini ? (
        <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              style={{ fontSize: Math.max(9, 10 * zoom) }}
            >
              {typeLabel}
            </span>
            {entry?.isPinned && (
              <span
                className="size-1.5 rounded-full bg-amber-500"
                aria-label="Pinned"
              />
            )}
          </div>
          <div
            className="line-clamp-2 font-semibold text-foreground"
            style={{ fontSize: Math.max(12, 14 * zoom) }}
          >
            {title}
          </div>
          {!isCompact && entry?.tags && entry.tags.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1">
              {entry.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  style={{ fontSize: Math.max(9, 10 * zoom) }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </button>
  );
}

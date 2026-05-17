"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CanvasNodeItem } from "@/lib/hooks/use-canvas";
import type { CardSize } from "@ascend/core";

interface Props {
  /** Excalidraw API ref. Lazily resolved by the parent. */
  excalidrawAPI: {
    getAppState: () => unknown;
    getSceneElements: () => readonly unknown[];
  } | null;
  nodes: CanvasNodeItem[];
  onCardClick?: (contextEntryId: string) => void;
  /** Entry ID currently selected (highlighted on the canvas). */
  selectedEntryId?: string | null;
  /**
   * User-controlled override of the zoom-based detail regime.
   * "compact" forces title-only at any zoom; "default" uses the zoom
   * thresholds (mini-dot < 0.35x, compact < 0.6x, full at >= 0.6x);
   * "expanded" always shows full detail (title + type + tags).
   * Persisted per-layout in `viewport.cardSize`.
   */
  cardSize?: CardSize;
}

interface Viewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

/** Per-card position resolved from the live Excalidraw scene element. */
interface CardPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Wave 9 Phase 5: card overlay synced to Excalidraw scroll/zoom AND
 * live element positions.
 *
 * For each CanvasNode, renders an absolutely-positioned <div> whose
 * `transform: translate3d(x, y, 0)` is recomputed every animation frame
 * from BOTH `excalidrawAPI.getAppState()` (viewport) and
 * `excalidrawAPI.getSceneElements()` (element x/y) so cards stay glued
 * to their rectangles during pan, zoom, AND user drag.
 *
 * Card body uses the denormalized `node.contextEntry` (title, type, tags)
 * to avoid a second fetch per render.
 *
 * Click selects the entry detail (via onCardClick callback).
 */
export function CanvasCardOverlay({
  excalidrawAPI,
  nodes,
  onCardClick,
  selectedEntryId,
  cardSize = "default",
}: Props) {
  const [viewport, setViewport] = useState<Viewport>({
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
  });
  // Live element positions keyed by excalidrawElementId.
  const [elementPositions, setElementPositions] = useState<
    Map<string, CardPosition>
  >(new Map());
  const rafRef = useRef<number | null>(null);
  const apiRef = useRef(excalidrawAPI);
  apiRef.current = excalidrawAPI;

  // Continuous rAF loop: read appState + scene elements, update state
  // only on meaningful change to avoid wasteful re-renders.
  useEffect(() => {
    function tick() {
      const api = apiRef.current;
      if (!api) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // 1) Read viewport state.
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

      // 2) Read live element positions for card rectangles.
      const elements = api.getSceneElements();
      setElementPositions((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const el of elements) {
          const elObj = el as {
            id?: string;
            x?: number;
            y?: number;
            width?: number;
            height?: number;
            customData?: { kind?: string };
          };
          if (elObj.customData?.kind !== "node-card") continue;
          const id = elObj.id;
          if (!id) continue;
          const ex = elObj.x ?? 0;
          const ey = elObj.y ?? 0;
          const ew = elObj.width ?? 240;
          const eh = elObj.height ?? 140;
          const existing = prev.get(id);
          if (
            existing &&
            Math.abs(existing.x - ex) < 0.5 &&
            Math.abs(existing.y - ey) < 0.5 &&
            Math.abs(existing.w - ew) < 0.5 &&
            Math.abs(existing.h - eh) < 0.5
          ) {
            continue;
          }
          changed = true;
          next.set(id, { x: ex, y: ey, w: ew, h: eh });
        }
        return changed ? next : prev;
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
        // Use live element position if available, fall back to server-persisted.
        const livePos = elementPositions.get(node.excalidrawElementId);
        const cardX = livePos?.x ?? node.x;
        const cardY = livePos?.y ?? node.y;
        const cardW = livePos?.w ?? node.w;
        const cardH = livePos?.h ?? node.h;

        const screenX = (cardX + viewport.scrollX) * viewport.zoom;
        const screenY = (cardY + viewport.scrollY) * viewport.zoom;
        const w = cardW * viewport.zoom;
        const h = cardH * viewport.zoom;
        return (
          <CanvasCard
            key={node.id}
            node={node}
            screenX={screenX}
            screenY={screenY}
            w={w}
            h={h}
            zoom={viewport.zoom}
            cardSize={cardSize}
            onClick={() => onCardClick?.(node.contextEntryId)}
            isSelected={selectedEntryId === node.contextEntryId}
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
  cardSize: CardSize;
  onClick: () => void;
  isSelected: boolean;
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
  cardSize,
  onClick,
  isSelected,
}: CanvasCardProps) {
  const entry = node.contextEntry;
  const title = entry?.title ?? "Untitled";
  const typeLabel = ENTRY_TYPE_LABEL[entry?.type ?? "NOTE"] ?? "Note";
  // Detail regime: combine zoom thresholds with the user's cardSize
  // preference. "expanded" forces full detail (overrides zoom-based
  // mini-dot and compact). "compact" forces compact mode at any zoom.
  // "default" is the original zoom-based behavior.
  let isMini = zoom < 0.35;
  let isCompact = zoom < 0.6;
  if (cardSize === "expanded") {
    isMini = false;
    isCompact = false;
  } else if (cardSize === "compact") {
    isMini = false;
    isCompact = true;
  }

  return (
    <button
      type="button"
      className={cn(
        "pointer-events-auto absolute flex flex-col gap-1 overflow-hidden rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isMini && "items-center justify-center p-0",
        isSelected && "border-primary ring-2 ring-primary/30",
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

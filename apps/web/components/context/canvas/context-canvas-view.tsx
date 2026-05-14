"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "@excalidraw/excalidraw/index.css";

import {
  useCanvasLayout,
  useDefaultCanvasLayout,
  useUpsertNodes,
  type CanvasLayoutDetail,
  type CanvasNodeItem,
} from "@/lib/hooks/use-canvas";
import { useContextEntries } from "@/lib/hooks/use-context";
import { useUIStore } from "@/lib/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { CanvasLoadingSkeleton } from "./canvas-loading-skeleton";
import { ContextCanvasEmptyState } from "./context-canvas-empty-state";
import { CanvasCardOverlay } from "./canvas-card-overlay";
import { CanvasSaveStatus } from "./canvas-save-status";
import {
  buildNodeCardRect,
  isCardRect,
  makeCardElementId,
} from "./canvas-scene-utils";
import { useCanvasAutosave } from "@/lib/hooks/use-canvas-autosave";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false, loading: () => <CanvasLoadingSkeleton /> },
);

const NODE_W = 240;
const NODE_H = 140;
const QUICK_ADD_GAP = 40;
const DRAG_MIME = "application/x-ascend-entry";

interface ExcalidrawAPILite {
  getAppState: () => unknown;
  getSceneElements: () => readonly unknown[];
  updateScene: (input: { elements?: unknown }) => void;
}

export function ContextCanvasView() {
  const activeLayoutId = useUIStore((s) => s.canvasActiveLayoutId);
  const setActiveLayoutId = useUIStore((s) => s.setCanvasActiveLayoutId);
  const graphViewAtDate = useUIStore((s) => s.graphViewAtDate);
  const isReadOnly = !!graphViewAtDate;

  const explicitQuery = useCanvasLayout(activeLayoutId);
  const defaultQuery = useDefaultCanvasLayout(activeLayoutId === null);

  const data = activeLayoutId ? explicitQuery.data : defaultQuery.data;
  const isLoading = activeLayoutId
    ? explicitQuery.isLoading
    : defaultQuery.isLoading;
  const isError = activeLayoutId
    ? explicitQuery.isError
    : defaultQuery.isError;
  const error = activeLayoutId ? explicitQuery.error : defaultQuery.error;

  useEffect(() => {
    if (!activeLayoutId && data?.layout?.id) {
      setActiveLayoutId(data.layout.id);
    }
  }, [activeLayoutId, data?.layout?.id, setActiveLayoutId]);

  if (isLoading || !data) return <CanvasLoadingSkeleton />;
  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="max-w-md rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load canvas:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </div>
    );
  }

  return (
    <ContextCanvasViewMounted
      layout={data.layout}
      isReadOnly={isReadOnly}
    />
  );
}

interface MountedProps {
  layout: CanvasLayoutDetail;
  isReadOnly: boolean;
}

function ContextCanvasViewMounted({ layout, isReadOnly }: MountedProps) {
  const upsertNodes = useUpsertNodes();
  const recentEntries = useContextEntries();
  const apiRef = useRef<ExcalidrawAPILite | null>(null);
  const [apiReady, setApiReady] = useState(false);

  const autosave = useCanvasAutosave({
    layoutId: layout.id,
    initialNodes: layout.nodes,
  });

  // Build initial Excalidraw scene from the server-side canvas blob.
  // Ensure every CanvasNode has a matching rectangle element (defensive:
  // if a node was added via the API without scene sync, we synthesize
  // its rect on first mount so the overlay has something to anchor to).
  const initialData = useMemo(() => {
    const scene = layout.canvas as
      | { elements?: unknown; appState?: unknown; files?: unknown }
      | undefined;
    const existingElements = Array.isArray(scene?.elements)
      ? (scene.elements as Array<{ id?: string; customData?: { kind?: string } }>)
      : [];
    const existingCardIds = new Set(
      existingElements.filter(isCardRect).map((el) => el.id ?? ""),
    );
    const synthesized: unknown[] = [];
    for (const node of layout.nodes) {
      if (!existingCardIds.has(node.excalidrawElementId)) {
        synthesized.push(
          buildNodeCardRect({
            elementId: node.excalidrawElementId,
            x: node.x,
            y: node.y,
            w: node.w,
            h: node.h,
            contextEntryId: node.contextEntryId,
          }),
        );
      }
    }
    const appState =
      typeof scene?.appState === "object" && scene.appState !== null
        ? (scene.appState as Record<string, unknown>)
        : {};
    return {
      elements: [...existingElements, ...synthesized] as never,
      appState: appState as never,
      files: scene?.files as never,
    };
  }, [layout.canvas, layout.nodes]);

  const handleQuickAddRecent = useCallback(() => {
    if (!Array.isArray(recentEntries.data) || !apiRef.current) return;
    const entries = (recentEntries.data as Array<{ id: string }>).slice(0, 5);
    if (entries.length === 0) return;
    const stride = NODE_W + QUICK_ADD_GAP;
    const newRects = entries.map((entry, i) =>
      buildNodeCardRect({
        elementId: makeCardElementId(entry.id),
        x: i * stride,
        y: 0,
        w: NODE_W,
        h: NODE_H,
        contextEntryId: entry.id,
      }),
    );
    const current = apiRef.current.getSceneElements();
    apiRef.current.updateScene({ elements: [...current, ...newRects] });
    upsertNodes.mutate({
      layoutId: layout.id,
      body: {
        upsert: entries.map((entry, i) => ({
          contextEntryId: entry.id,
          x: i * stride,
          y: 0,
          w: NODE_W,
          h: NODE_H,
          excalidrawElementId: makeCardElementId(entry.id),
        })),
        remove: [],
      },
    });
  }, [layout.id, recentEntries.data, upsertNodes]);

  // Drag-from-sidebar: convert a screen-coord drop into canvas coords
  // using the live appState scrollX/Y/zoom, append a card rect, and
  // upsert the CanvasNode.
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const payload = event.dataTransfer.getData(DRAG_MIME);
      if (!payload || !apiRef.current) return;
      let parsed: { id?: string };
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }
      const entryId = parsed.id;
      if (!entryId) return;

      // Don't accept drops twice for the same entry; the unique
      // constraint will catch it server-side too.
      const existingNode = layout.nodes.find(
        (n) => n.contextEntryId === entryId,
      );
      if (existingNode) return;

      // Convert clientX/Y to canvas coords.
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const ax = apiRef.current.getAppState() as {
        scrollX?: number;
        scrollY?: number;
        zoom?: number | { value?: number };
      };
      const zoom =
        typeof ax.zoom === "number" ? ax.zoom : (ax.zoom?.value ?? 1);
      const scrollX = ax.scrollX ?? 0;
      const scrollY = ax.scrollY ?? 0;
      const cx = (event.clientX - rect.left) / zoom - scrollX - NODE_W / 2;
      const cy = (event.clientY - rect.top) / zoom - scrollY - NODE_H / 2;

      const elementId = makeCardElementId(entryId);
      const newRect = buildNodeCardRect({
        elementId,
        x: cx,
        y: cy,
        w: NODE_W,
        h: NODE_H,
        contextEntryId: entryId,
      });
      const current = apiRef.current.getSceneElements();
      apiRef.current.updateScene({ elements: [...current, newRect] });
      upsertNodes.mutate({
        layoutId: layout.id,
        body: {
          upsert: [
            {
              contextEntryId: entryId,
              x: cx,
              y: cy,
              w: NODE_W,
              h: NODE_H,
              excalidrawElementId: elementId,
            },
          ],
          remove: [],
        },
      });
    },
    [layout.id, layout.nodes, upsertNodes],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (event.dataTransfer.types.includes(DRAG_MIME)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    },
    [],
  );

  // Wire Excalidraw onChange to the autosave hook.
  const onSceneChange = useCallback(
    (
      elements: readonly unknown[],
      appState: unknown,
      files?: unknown,
    ) => {
      autosave.onChange(
        elements,
        (appState ?? {}) as Record<string, unknown>,
        files as Record<string, unknown> | undefined,
      );
    },
    [autosave],
  );

  const hasContent =
    layout.nodes.length > 0 ||
    (Array.isArray((layout.canvas as { elements?: unknown[] })?.elements) &&
      ((layout.canvas as { elements: unknown[] }).elements.length ?? 0) > 0);

  return (
    <div
      className="relative h-full w-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isReadOnly && <TimeTravelBanner />}
      <div className="pointer-events-auto absolute right-4 top-4 z-30">
        <CanvasSaveStatus
          status={autosave.status}
          lastSavedAt={autosave.lastSavedAt}
          onRetry={() => void autosave.flush()}
        />
      </div>
      <Excalidraw
        initialData={initialData}
        viewModeEnabled={isReadOnly}
        onChange={onSceneChange}
        excalidrawAPI={(api) => {
          apiRef.current = api as ExcalidrawAPILite;
          setApiReady(true);
        }}
      />
      {apiReady && (
        <CanvasCardOverlay
          excalidrawAPI={apiRef.current}
          nodes={layout.nodes}
        />
      )}
      {!hasContent && !isReadOnly && (
        <ContextCanvasEmptyState
          onQuickAddRecent={handleQuickAddRecent}
          isQuickAddPending={upsertNodes.isPending}
        />
      )}
    </div>
  );
}

function TimeTravelBanner() {
  const setGraphViewAtDate = useUIStore((s) => s.setGraphViewAtDate);
  return (
    <div className="pointer-events-auto absolute left-1/2 top-4 z-20 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border bg-background/95 px-4 py-2 shadow-md backdrop-blur">
        <Clock className="size-4 text-amber-600" aria-hidden="true" />
        <span className="text-sm text-foreground">
          Map shows current state only. Switch to Graph for time-travel.
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setGraphViewAtDate(null)}
        >
          Return to now
        </Button>
      </div>
    </div>
  );
}

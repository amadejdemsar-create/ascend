"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import "@excalidraw/excalidraw/index.css";

import {
  useCanvasLayout,
  useDefaultCanvasLayout,
  useUpsertNodes,
  type CanvasLayoutDetail,
} from "@/lib/hooks/use-canvas";
import { useContextEntries } from "@/lib/hooks/use-context";
import { useUIStore } from "@/lib/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { CanvasLoadingSkeleton } from "./canvas-loading-skeleton";
import { ContextCanvasEmptyState } from "./context-canvas-empty-state";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false, loading: () => <CanvasLoadingSkeleton /> },
);

const NODE_W = 240;
const NODE_H = 140;
const QUICK_ADD_GAP = 40;

/**
 * Wave 9: Map view. Embeds Excalidraw with the user's active canvas
 * layout. Phase 4 ships the mount + empty state + time-travel banner;
 * Phase 5 adds card overlay sync, drag-from-sidebar, and autosave;
 * Phase 6 adds edge rendering + arrow-to-create-link flow.
 *
 * Mounting strategy:
 *   - If useUIStore.canvasActiveLayoutId is null (first visit or after
 *     a layout delete), call useDefaultCanvasLayout which lazily
 *     creates "Personal" on the server.
 *   - Otherwise call useCanvasLayout with the persisted id.
 *   - After either resolves, persist the id so refresh restores the
 *     same layout.
 */
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

  // After the default loads, persist its id so future visits skip the
  // /default endpoint and go straight to /[id].
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
  // Pull entries (already ordered by updatedAt desc server-side); the
  // quick-add button slices the first 5.
  const recentEntries = useContextEntries();

  // Excalidraw expects its own `initialData` shape. The `canvas` blob
  // from the server is opaque JSONB; we narrow it just enough to pass
  // through.
  const initialData = useMemo(() => {
    const scene = layout.canvas as
      | { elements?: unknown; appState?: unknown; files?: unknown }
      | undefined;
    if (!scene) return null;
    // `elements` must be an array; cast through unknown because the
    // ElementType union from @excalidraw/excalidraw is too large to
    // import for a v0.18 typecheck.
    const elements = Array.isArray(scene.elements) ? scene.elements : [];
    // appState is partial; Excalidraw fills defaults. Pass through.
    const appState =
      typeof scene.appState === "object" && scene.appState !== null
        ? (scene.appState as Record<string, unknown>)
        : {};
    return {
      elements: elements as never,
      appState: appState as never,
      files: scene.files as never,
    };
  }, [layout.canvas]);

  const hasContent =
    layout.nodes.length > 0 ||
    (Array.isArray((layout.canvas as { elements?: unknown[] })?.elements) &&
      ((layout.canvas as { elements: unknown[] }).elements.length ?? 0) > 0);

  function handleQuickAddRecent() {
    if (!Array.isArray(recentEntries.data)) return;
    const entries = (recentEntries.data as Array<{ id: string }>).slice(0, 5);
    const stride = NODE_W + QUICK_ADD_GAP;
    upsertNodes.mutate({
      layoutId: layout.id,
      body: {
        upsert: entries.map((entry, i) => ({
          contextEntryId: entry.id,
          x: i * stride,
          y: 0,
          w: NODE_W,
          h: NODE_H,
          excalidrawElementId: `el-${entry.id}`,
        })),
        remove: [],
      },
    });
  }

  return (
    <div className="relative h-full w-full">
      {isReadOnly && <TimeTravelBanner />}
      <Excalidraw
        initialData={initialData ?? undefined}
        viewModeEnabled={isReadOnly}
      />
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

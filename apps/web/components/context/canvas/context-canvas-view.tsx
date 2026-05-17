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
  useUpdateLayout,
  useUpsertNodes,
  type CanvasLayoutDetail,
} from "@/lib/hooks/use-canvas";
import {
  useContextEntries,
  useContextGraph,
  useDeleteContextLink,
} from "@/lib/hooks/use-context";
import { useUIStore } from "@/lib/stores/ui-store";
import type { CanvasViewport } from "@/lib/validations";
import type { ContextLinkType } from "@ascend/core";
import { Button } from "@/components/ui/button";
import { Clock, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ContextEntryDetail } from "@/components/context/context-entry-detail";
import { CanvasLoadingSkeleton } from "./canvas-loading-skeleton";
import { CanvasViewErrorBoundary } from "./canvas-view-error-boundary";
import { ContextCanvasEmptyState } from "./context-canvas-empty-state";
import { CanvasCardOverlay } from "./canvas-card-overlay";
import { CanvasSaveStatus } from "./canvas-save-status";
import { CanvasEdgeToggle } from "./canvas-edge-toggle";
import { CanvasLinkTypePicker } from "./canvas-link-type-picker";
import { CanvasLayoutSwitcher } from "./canvas-layout-switcher";
import { CanvasImportDialog } from "./canvas-import-dialog";
import { CanvasAddCardDialog } from "./canvas-add-card-dialog";
import { exportLayoutAsExcalidraw } from "./canvas-export";
import { Upload as UploadIcon, Download } from "lucide-react";
import {
  buildNodeCardRect,
  isCardRect,
  makeCardElementId,
  rehydrateAppStateForExcalidraw,
} from "./canvas-scene-utils";
import {
  buildEdgeArrow,
  diffArrows,
  isManagedEdgeArrow,
} from "./canvas-edge-sync";
import { useCanvasAutosave } from "@/lib/hooks/use-canvas-autosave";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false, loading: () => <CanvasLoadingSkeleton /> },
);

const NODE_W = 240;
const NODE_H = 140;
const QUICK_ADD_GAP = 40;
const DRAG_MIME = "application/x-ascend-entry";

/** Stable no-op for bisection's noOnChange flag. Module-level so identity
 * stays the same across renders (matches what Excalidraw would expect). */
const noopOnChange = () => {};

interface ExcalidrawAPILite {
  getAppState: () => unknown;
  getSceneElements: () => readonly unknown[];
  getSceneElementsIncludingDeleted: () => readonly unknown[];
  getFiles?: () => Record<string, unknown>;
  updateScene: (input: { elements?: unknown; appState?: unknown }) => void;
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
    <CanvasViewErrorBoundary>
      <ContextCanvasViewMounted
        layout={data.layout}
        isReadOnly={isReadOnly}
      />
    </CanvasViewErrorBoundary>
  );
}

/**
 * Bisection flags for /test-canvas-full diagnostics. ALL default to false
 * (i.e., full production behavior). Setting any flag to true SKIPS that
 * sibling/feature so the next session can identify which one triggers
 * the Excalidraw "Maximum update depth exceeded" loop.
 *
 * Do NOT use in production. Only the /test-canvas-full route ever passes
 * non-empty flags. The CanvasView wrapper never threads bisection through,
 * so the (app)/context Map view continues to render the full tree.
 */
export interface CanvasBisectionFlags {
  /** Mount everything EXCEPT the actual <Excalidraw> component. */
  noExcalidraw?: boolean;
  /** Don't render the card overlay (still does its rAF if mounted by parent). */
  noOverlay?: boolean;
  /** Don't render the autosave status pill. */
  noSaveStatus?: boolean;
  /** Don't render the layout switcher dropdown. */
  noLayoutSwitcher?: boolean;
  /** Don't render the Import dialog (still mounts, just hidden). */
  noImportDialog?: boolean;
  /** Don't render the Add-card dialog. */
  noAddCardDialog?: boolean;
  /** Don't render the link-type picker. */
  noTypePicker?: boolean;
  /** Don't render the right-side detail Sheet. */
  noSheet?: boolean;
  /** Don't render the empty-state CTA. */
  noEmptyState?: boolean;
  /** Don't render the top-right toolbar buttons (Import/Export/Add card/Edges toggle). */
  noToolbar?: boolean;
  /** Pass undefined as Excalidraw's onChange so onSceneChange is bypassed. */
  noOnChange?: boolean;
  /** Pass empty initialData (no synthesized cards or edges). */
  noInitialData?: boolean;
  /** Pass undefined for the excalidrawAPI callback (apiReady never flips true). */
  noApiCallback?: boolean;
}

interface MountedProps {
  layout: CanvasLayoutDetail;
  isReadOnly: boolean;
  bisection?: CanvasBisectionFlags;
}

export function ContextCanvasViewMounted({
  layout,
  isReadOnly,
  bisection,
}: MountedProps) {
  const b = bisection ?? {};
  const upsertNodes = useUpsertNodes();
  const updateLayout = useUpdateLayout();
  const recentEntries = useContextEntries();
  const graphQuery = useContextGraph();
  const deleteLink = useDeleteContextLink();
  const apiRef = useRef<ExcalidrawAPILite | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const openPicker = useUIStore((s) => s.openCanvasLinkTypePicker);

  // Must-fix 2: local selected entry state for the detail Sheet.
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const viewport = (layout.viewport ?? {}) as Partial<CanvasViewport>;
  const showEdges = viewport.showEdges !== false;

  const autosave = useCanvasAutosave({
    layoutId: layout.id,
    initialNodes: layout.nodes,
  });

  // Map contextEntryId -> CanvasNode for arrow geometry lookups.
  const nodesByEntryId = useMemo(() => {
    const map = new Map(layout.nodes.map((n) => [n.contextEntryId, n]));
    return map;
  }, [layout.nodes]);

  // Set of card element IDs for quick membership checks in the diff.
  const cardElementIds = useMemo(
    () => new Set(layout.nodes.map((n) => n.excalidrawElementId)),
    [layout.nodes],
  );

  // Set of contextEntryIds on the canvas for the add-card picker.
  const existingEntryIds = useMemo(
    () => new Set(layout.nodes.map((n) => n.contextEntryId)),
    [layout.nodes],
  );

  // Build initial Excalidraw scene from server canvas blob, synthesize
  // missing card rects, then merge edge arrows from the graph.
  const initialData = useMemo(() => {
    const scene = layout.canvas as
      | { elements?: unknown; appState?: unknown; files?: unknown }
      | undefined;
    const existingElements = Array.isArray(scene?.elements)
      ? (scene.elements as Array<{
          id?: string;
          customData?: { kind?: string };
        }>)
      : [];
    const existingCardIds = new Set(
      existingElements.filter(isCardRect).map((el) => el.id ?? ""),
    );
    const existingEdgeIds = new Set(
      existingElements
        .filter(isManagedEdgeArrow)
        .map((el) => (el as { id: string }).id),
    );

    // 1) Synthesize missing card rectangles for any CanvasNode that
    //    lacks one in the scene blob.
    const synthesizedCards: unknown[] = [];
    for (const node of layout.nodes) {
      if (!existingCardIds.has(node.excalidrawElementId)) {
        synthesizedCards.push(
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

    // 2) For every graph edge whose both endpoints sit on this layout,
    //    synthesize an edge arrow (unless already present).
    const synthesizedEdges: unknown[] = [];
    const edges = graphQuery.data?.edges ?? [];
    for (const edge of edges) {
      const fromNode = nodesByEntryId.get(edge.fromId);
      const toNode = nodesByEntryId.get(edge.toId);
      if (!fromNode || !toNode) continue;
      const arrowId = `edge-${edge.id}`;
      if (existingEdgeIds.has(arrowId)) continue;
      synthesizedEdges.push(
        buildEdgeArrow({
          linkId: edge.id,
          linkType: edge.type,
          fromElementId: fromNode.excalidrawElementId,
          toElementId: toNode.excalidrawElementId,
          fromX: fromNode.x,
          fromY: fromNode.y,
          fromW: fromNode.w,
          fromH: fromNode.h,
          toX: toNode.x,
          toY: toNode.y,
          toW: toNode.w,
          toH: toNode.h,
          hidden: !showEdges,
        }),
      );
    }

    // Rehydrate Map/Set fields (collaborators, followedBy) so Excalidraw
    // doesn't crash calling .forEach() on a plain object from JSON.parse.
    // This is the incoming defense: handles existing bad data in the DB
    // without requiring a backfill migration.
    const rawAppState =
      typeof scene?.appState === "object" && scene.appState !== null
        ? (scene.appState as Record<string, unknown>)
        : {};
    const appState = rehydrateAppStateForExcalidraw(rawAppState);
    return {
      elements: [
        ...existingElements,
        ...synthesizedCards,
        ...synthesizedEdges,
      ] as never,
      appState: appState as never,
      files: scene?.files as never,
    };
  }, [
    layout.canvas,
    layout.nodes,
    nodesByEntryId,
    graphQuery.data?.edges,
    showEdges,
  ]);

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
      const existingNode = layout.nodes.find(
        (n) => n.contextEntryId === entryId,
      );
      if (existingNode) return;

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

  // Track previous element set so onChange can diff new+removed arrows.
  const prevElementsRef = useRef<readonly unknown[]>([]);

  const onSceneChange = useCallback(
    (
      elements: readonly unknown[],
      appState: unknown,
      files?: unknown,
    ) => {
      const prev = prevElementsRef.current;
      prevElementsRef.current = elements;

      // 1) Detect newly drawn user arrows bound to two cards.
      const { newBoundArrows, removedLinkIds } = diffArrows(
        prev,
        elements,
        cardElementIds,
      );
      for (const arrow of newBoundArrows) {
        // Map element ids back to contextEntryIds.
        const fromNode = layout.nodes.find(
          (n) => n.excalidrawElementId === arrow.fromElementId,
        );
        const toNode = layout.nodes.find(
          (n) => n.excalidrawElementId === arrow.toElementId,
        );
        if (!fromNode || !toNode) continue;
        openPicker({
          pendingArrowId: arrow.id,
          fromEntryId: fromNode.contextEntryId,
          toEntryId: toNode.contextEntryId,
        });
        break; // one picker at a time
      }

      // 2) For arrows removed since last tick that had a linkId, fire
      //    a ContextLink delete (debounced via mutate; the autosave
      //    will persist the scene shape too).
      for (const linkId of removedLinkIds) {
        // We need the from/to entry IDs for invalidation. Look them
        // up from the prev scene's arrow that had this linkId.
        for (const el of prev) {
          if (!isManagedEdgeArrow(el)) continue;
          if (el.customData.linkId !== linkId) continue;
          const startElId = (el as { startBinding?: { elementId?: string } })
            .startBinding?.elementId;
          const endElId = (el as { endBinding?: { elementId?: string } })
            .endBinding?.elementId;
          const fromNode = layout.nodes.find(
            (n) => n.excalidrawElementId === startElId,
          );
          const toNode = layout.nodes.find(
            (n) => n.excalidrawElementId === endElId,
          );
          if (!fromNode || !toNode) break;
          deleteLink.mutate({
            id: linkId,
            fromEntryId: fromNode.contextEntryId,
            toEntryId: toNode.contextEntryId,
          });
          break;
        }
      }

      // 3) Forward to autosave for the scene blob + node position deltas.
      autosave.onChange(
        elements,
        (appState ?? {}) as Record<string, unknown>,
        files as Record<string, unknown> | undefined,
      );
    },
    [autosave, cardElementIds, deleteLink, layout.nodes, openPicker],
  );

  // ── Excalidraw prop identity stabilization (Wave 9 crash fix) ──────
  //
  // Excalidraw's internal tunnel-rat portal stores prop callbacks in a
  // `useSyncExternalStore` external store. When a prop callback's
  // identity changes between renders, tunnel-rat's
  // `useIsomorphicLayoutEffect` re-subscribes inside the commit phase
  // and forces every consumer to re-render. Each forced re-render fires
  // the same layout effect again, producing an infinite loop that React
  // bails out of with "Maximum update depth exceeded" (the `Set.forEach`
  // + `forceStoreRerender` + `tunnel.useIsomorphicLayoutEffect` chain).
  //
  // `onSceneChange` and the excalidrawAPI callback both had new
  // identity every render because `useCanvasAutosave` returns a fresh
  // object literal, which is in `onSceneChange`'s useCallback deps, and
  // the excalidrawAPI callback was an inline arrow.
  //
  // Fix: keep the latest closure in a ref and expose stable wrappers
  // whose identity never changes after first render. Excalidraw sees
  // the same function references on every render, so the layout-effect
  // loop never fires. Latest props/state are read through the ref.
  const onSceneChangeRef = useRef(onSceneChange);
  onSceneChangeRef.current = onSceneChange;
  const stableOnSceneChange = useCallback(
    (
      elements: readonly unknown[],
      appState: unknown,
      files?: unknown,
    ) => {
      onSceneChangeRef.current(elements, appState, files);
    },
    [],
  );

  const stableExcalidrawAPI = useCallback((api: unknown) => {
    apiRef.current = api as ExcalidrawAPILite;
    setApiReady(true);
  }, []);

  // Picker confirm: patch the pending arrow's customData.linkId.
  const handlePickerConfirmed = useCallback(
    ({
      pendingArrowId,
      linkId,
      linkType,
    }: {
      pendingArrowId: string;
      linkId: string;
      linkType: ContextLinkType;
    }) => {
      const api = apiRef.current;
      if (!api) return;
      const current = api.getSceneElements();
      const next = current.map((el) => {
        const elObj = el as { id?: unknown };
        if (elObj.id === pendingArrowId) {
          return {
            ...(el as Record<string, unknown>),
            customData: {
              kind: "edge" as const,
              linkId,
              linkType,
            },
            id: `edge-${linkId}`,
          };
        }
        return el;
      });
      api.updateScene({ elements: next });
    },
    [],
  );

  // Picker cancel: drop the pending arrow from the scene.
  const handlePickerCancelled = useCallback(
    (pendingArrowId: string) => {
      const api = apiRef.current;
      if (!api) return;
      const current = api.getSceneElements();
      const next = current.filter((el) => {
        const elObj = el as { id?: unknown };
        return elObj.id !== pendingArrowId;
      });
      api.updateScene({ elements: next });
    },
    [],
  );

  // Toggle edge visibility. Updates viewport.showEdges via the layout
  // PATCH AND rewrites every managed-edge arrow's opacity in place.
  const handleToggleEdges = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const nextShow = !showEdges;
    const current = api.getSceneElements();
    const next = current.map((el) => {
      if (isManagedEdgeArrow(el)) {
        return {
          ...(el as Record<string, unknown>),
          opacity: nextShow ? 100 : 0,
          locked: !nextShow,
        };
      }
      return el;
    });
    api.updateScene({ elements: next });
    updateLayout.mutate({
      id: layout.id,
      input: {
        viewport: {
          x: viewport.x ?? 0,
          y: viewport.y ?? 0,
          zoom: viewport.zoom ?? 1,
          showEdges: nextShow,
          cardSize: viewport.cardSize ?? "default",
        },
      },
    });
  }, [layout.id, showEdges, updateLayout, viewport]);

  // Must-fix 2: handle card click to open the detail Sheet.
  const handleCardClick = useCallback((contextEntryId: string) => {
    setSelectedEntryId(contextEntryId);
  }, []);

  const handleDetailClose = useCallback(() => {
    setSelectedEntryId(null);
  }, []);

  const handleDetailNavigate = useCallback((id: string) => {
    setSelectedEntryId(id);
  }, []);

  // Must-fix 3: compute center of current viewport in canvas coords
  // and place a new card there.
  const handleAddEntry = useCallback(
    (entryId: string) => {
      const api = apiRef.current;
      if (!api) return;
      const ax = api.getAppState() as {
        scrollX?: number;
        scrollY?: number;
        zoom?: number | { value?: number };
        width?: number;
        height?: number;
      };
      const zoom =
        typeof ax.zoom === "number" ? ax.zoom : (ax.zoom?.value ?? 1);
      const scrollX = ax.scrollX ?? 0;
      const scrollY = ax.scrollY ?? 0;
      // Excalidraw canvas container dimensions.
      const vw = (ax.width ?? window.innerWidth);
      const vh = (ax.height ?? window.innerHeight);
      const centerX = -scrollX + vw / 2 / zoom - NODE_W / 2;
      const centerY = -scrollY + vh / 2 / zoom - NODE_H / 2;

      const elementId = makeCardElementId(entryId);
      const newRect = buildNodeCardRect({
        elementId,
        x: centerX,
        y: centerY,
        w: NODE_W,
        h: NODE_H,
        contextEntryId: entryId,
      });
      const current = api.getSceneElements();
      api.updateScene({ elements: [...current, newRect] });
      upsertNodes.mutate({
        layoutId: layout.id,
        body: {
          upsert: [
            {
              contextEntryId: entryId,
              x: centerX,
              y: centerY,
              w: NODE_W,
              h: NODE_H,
              excalidrawElementId: elementId,
            },
          ],
          remove: [],
        },
      });
    },
    [layout.id, upsertNodes],
  );

  // Must-fix 3: pan to an existing entry on the canvas.
  const handleFocusExisting = useCallback(
    (entryId: string) => {
      const api = apiRef.current;
      if (!api) return;
      const node = layout.nodes.find((n) => n.contextEntryId === entryId);
      if (!node) return;

      // Read live element position if available; fall back to node db position.
      const elements = api.getSceneElements();
      let ex = node.x;
      let ey = node.y;
      let ew = node.w;
      let eh = node.h;
      for (const el of elements) {
        const elObj = el as {
          id?: string;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
        };
        if (elObj.id === node.excalidrawElementId) {
          ex = elObj.x ?? ex;
          ey = elObj.y ?? ey;
          ew = elObj.width ?? ew;
          eh = elObj.height ?? eh;
          break;
        }
      }

      const ax = api.getAppState() as {
        zoom?: number | { value?: number };
        width?: number;
        height?: number;
      };
      const zoom =
        typeof ax.zoom === "number" ? ax.zoom : (ax.zoom?.value ?? 1);
      const vw = ax.width ?? window.innerWidth;
      const vh = ax.height ?? window.innerHeight;

      // Center the element in the viewport.
      const newScrollX = -(ex + ew / 2) + vw / 2 / zoom;
      const newScrollY = -(ey + eh / 2) + vh / 2 / zoom;

      api.updateScene({
        appState: { scrollX: newScrollX, scrollY: newScrollY } as never,
      });
    },
    [layout.nodes],
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
      {!b.noLayoutSwitcher && (
        <div className="pointer-events-auto absolute left-4 top-4 z-30">
          <CanvasLayoutSwitcher
            activeLayoutId={layout.id}
            activeLayoutName={layout.name}
          />
        </div>
      )}
      {!b.noToolbar && (
        <div className="pointer-events-auto absolute right-4 top-4 z-30 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddCardOpen(true)}
            disabled={isReadOnly}
            className="gap-1.5"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span className="text-xs">Add card</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setImportOpen(true)}
            disabled={isReadOnly}
            className="gap-1.5"
          >
            <UploadIcon className="size-3.5" aria-hidden="true" />
            <span className="text-xs">Import</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              apiRef.current && exportLayoutAsExcalidraw(apiRef.current, layout.name)
            }
            disabled={!apiReady}
            className="gap-1.5"
          >
            <Download className="size-3.5" aria-hidden="true" />
            <span className="text-xs">Export</span>
          </Button>
          <CanvasEdgeToggle
            showEdges={showEdges}
            onToggle={handleToggleEdges}
            disabled={isReadOnly || updateLayout.isPending}
          />
          {!b.noSaveStatus && (
            <CanvasSaveStatus
              status={autosave.status}
              lastSavedAt={autosave.lastSavedAt}
              onRetry={() => void autosave.flush()}
            />
          )}
        </div>
      )}
      {!b.noImportDialog && (
        <CanvasImportDialog
          layoutId={layout.id}
          open={importOpen}
          onOpenChange={setImportOpen}
        />
      )}
      {!b.noAddCardDialog && (
        <CanvasAddCardDialog
          open={addCardOpen}
          onOpenChange={setAddCardOpen}
          existingEntryIds={existingEntryIds}
          onAddEntry={handleAddEntry}
          onFocusExisting={handleFocusExisting}
        />
      )}
      {!b.noExcalidraw && (
        <Excalidraw
          initialData={b.noInitialData ? undefined : initialData}
          viewModeEnabled={isReadOnly}
          onChange={b.noOnChange ? noopOnChange : stableOnSceneChange}
          excalidrawAPI={
            b.noApiCallback ? undefined : stableExcalidrawAPI
          }
        />
      )}
      {apiReady && !b.noOverlay && (
        <CanvasCardOverlay
          excalidrawAPI={apiRef.current}
          nodes={layout.nodes}
          onCardClick={handleCardClick}
          selectedEntryId={selectedEntryId}
        />
      )}
      {!b.noTypePicker && (
        <CanvasLinkTypePicker
          onConfirmed={handlePickerConfirmed}
          onCancelled={handlePickerCancelled}
        />
      )}
      {!hasContent && !isReadOnly && !b.noEmptyState && (
        <ContextCanvasEmptyState
          onQuickAddRecent={handleQuickAddRecent}
          isQuickAddPending={upsertNodes.isPending}
        />
      )}

      {/* Must-fix 2: detail Sheet overlay on card click. */}
      {!b.noSheet && (
        <Sheet
          open={selectedEntryId !== null}
          onOpenChange={(open) => {
            if (!open) handleDetailClose();
          }}
        >
          <SheetContent
            side="right"
            className="w-[480px] sm:max-w-[560px] overflow-y-auto p-0"
            showCloseButton={false}
          >
            <SheetTitle className="sr-only">Entry detail</SheetTitle>
            <SheetDescription className="sr-only">
              Detail view for the selected context entry
            </SheetDescription>
            {selectedEntryId && (
              <ContextEntryDetail
                entryId={selectedEntryId}
                onClose={handleDetailClose}
                onEdit={() => {
                  // Editing is handled inline by the detail component.
                }}
                onNavigate={handleDetailNavigate}
              />
            )}
          </SheetContent>
        </Sheet>
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

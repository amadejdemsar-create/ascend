"use client";

// Wave 9 diagnostic: mount ContextCanvasViewMounted with fake data so we
// can bisect which sibling/feature triggers the Excalidraw "Maximum
// update depth exceeded" loop on /context Map view.
//
// Auth: this route is gated by middleware.ts. To use it, sign in at
// /login first, then visit /test-canvas-full.
//
// Bisection via URL flags. Add any combination to disable that piece:
//   ?noExcalidraw       — render everything EXCEPT the <Excalidraw> mount
//   ?noOverlay          — skip <CanvasCardOverlay>
//   ?noSaveStatus       — skip the autosave status pill
//   ?noLayoutSwitcher   — skip the layout switcher dropdown
//   ?noImportDialog     — skip <CanvasImportDialog>
//   ?noAddCardDialog    — skip <CanvasAddCardDialog>
//   ?noTypePicker       — skip <CanvasLinkTypePicker>
//   ?noSheet            — skip the right-side detail Sheet
//   ?noEmptyState       — skip the empty-state CTA
//   ?noToolbar          — skip the top-right toolbar buttons + edge toggle
//   ?noOnChange         — pass a no-op onChange to Excalidraw
//   ?noInitialData      — pass undefined as initialData
//   ?noApiCallback      — pass undefined as excalidrawAPI (apiReady stays false)
//
// Example: /test-canvas-full?noOverlay&noSheet&noTypePicker

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/keys";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  ContextCanvasViewMounted,
  type CanvasBisectionFlags,
} from "@/components/context/canvas/context-canvas-view";
import { CanvasViewErrorBoundary } from "@/components/context/canvas/canvas-view-error-boundary";
import type { CanvasLayoutDetail } from "@/lib/hooks/use-canvas";

const FAKE_LAYOUT_ID = "test-layout-bisection";
const FAKE_USER_ID = "test-user";
const FAKE_WORKSPACE_ID = "test-workspace";

function makeFakeLayout(): CanvasLayoutDetail {
  const now = new Date().toISOString();
  return {
    id: FAKE_LAYOUT_ID,
    userId: FAKE_USER_ID,
    workspaceId: FAKE_WORKSPACE_ID,
    name: "Bisection",
    slug: "bisection",
    isDefault: true,
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
      showEdges: true,
      cardSize: "default",
    },
    canvas: {
      elements: [],
      appState: {},
      files: {},
    },
    createdAt: now,
    updatedAt: now,
    nodes: [],
  };
}

/** Parse the URL search params into a CanvasBisectionFlags object. */
function readFlagsFromUrl(params: URLSearchParams): CanvasBisectionFlags {
  const flagKeys: (keyof CanvasBisectionFlags)[] = [
    "noExcalidraw",
    "noOverlay",
    "noSaveStatus",
    "noLayoutSwitcher",
    "noImportDialog",
    "noAddCardDialog",
    "noTypePicker",
    "noSheet",
    "noEmptyState",
    "noToolbar",
    "noOnChange",
    "noInitialData",
    "noApiCallback",
  ];
  const flags: CanvasBisectionFlags = {};
  for (const key of flagKeys) {
    if (params.has(key)) {
      flags[key] = true;
    }
  }
  return flags;
}

export default function TestCanvasFullPage() {
  // Wrap in Suspense so useSearchParams works in the production build
  // without throwing a missing-suspense-with-csr-bailout error. The
  // route is auth-gated and diagnostic-only; the loading fallback here
  // doubles as the seed-state placeholder.
  return (
    <Suspense
      fallback={
        <div
          style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui",
          }}
        >
          Loading bisection harness...
        </div>
      }
    >
      <TestCanvasFullInner />
    </Suspense>
  );
}

function TestCanvasFullInner() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const setCanvasActiveLayoutId = useUIStore(
    (s) => s.setCanvasActiveLayoutId,
  );
  const setGraphViewAtDate = useUIStore((s) => s.setGraphViewAtDate);
  const closeTypePicker = useUIStore((s) => s.closeCanvasLinkTypePicker);

  const [seeded, setSeeded] = useState(false);

  // Seed React Query cache + Zustand state before mounting the canvas.
  // Without this, hooks like useContextEntries/useContextGraph would
  // hit the real API, and the picker/banner states from prior sessions
  // (persisted in localStorage) could leak into the test.
  useEffect(() => {
    const layout = makeFakeLayout();

    // Canvas layout detail (DetailResponse shape: { layout, nodes }).
    const detail = { layout, nodes: layout.nodes };
    qc.setQueryData(queryKeys.canvas.layout(FAKE_LAYOUT_ID), detail);
    qc.setQueryData(queryKeys.canvas.layout("__default__"), detail);
    qc.setQueryData(queryKeys.canvas.layouts(), [
      {
        id: layout.id,
        name: layout.name,
        slug: layout.slug,
        isDefault: layout.isDefault,
        viewport: layout.viewport,
        createdAt: layout.createdAt,
        updatedAt: layout.updatedAt,
        _count: { nodes: 0 },
      },
    ]);

    // Empty context entry list + graph so useContextEntries/useContextGraph
    // resolve synchronously without hitting the network.
    qc.setQueryData(queryKeys.context.list(undefined), []);
    qc.setQueryData(queryKeys.context.graph(undefined), {
      nodes: [],
      edges: [],
    });

    // Zustand: pin the active layout id and clear any persisted picker
    // state from a previous broken Map-view visit.
    setCanvasActiveLayoutId(FAKE_LAYOUT_ID);
    setGraphViewAtDate(null);
    closeTypePicker();

    setSeeded(true);
  }, [qc, setCanvasActiveLayoutId, setGraphViewAtDate, closeTypePicker]);

  const flags = useMemo(
    () => readFlagsFromUrl(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const activeFlags = useMemo(() => {
    const keys = Object.keys(flags) as (keyof CanvasBisectionFlags)[];
    return keys.filter((k) => flags[k]);
  }, [flags]);

  const layout = useMemo(() => makeFakeLayout(), []);

  if (!seeded) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
        }}
      >
        Seeding fake data...
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          zIndex: 100,
          background: "rgba(0,0,0,0.85)",
          color: "white",
          fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
          fontSize: 11,
          padding: "6px 10px",
          borderTopRightRadius: 6,
          pointerEvents: "none",
        }}
      >
        bisection {activeFlags.length === 0 ? "off" : activeFlags.join("+")}
      </div>
      <CanvasViewErrorBoundary>
        <ContextCanvasViewMounted
          layout={layout}
          isReadOnly={false}
          bisection={flags}
        />
      </CanvasViewErrorBoundary>
    </div>
  );
}

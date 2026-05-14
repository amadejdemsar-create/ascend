"use client";

/**
 * Wave 9 Phase 0 spike: validate Excalidraw + React 19 + custom card overlay perf.
 *
 * Goals:
 *  1. Confirm @excalidraw/excalidraw v0.18.1 renders on React 19.2.4 despite peer-dep warning.
 *  2. Confirm 50 absolutely-positioned overlay divs stay in sync with Excalidraw rectangles
 *     during pan + zoom at ~60 fps.
 *  3. Confirm customData.kind="node-card" round-trips through Excalidraw scene state.
 *
 * Remove this entire folder (apps/web/app/(app)/_spike) at Phase 0 close.
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@excalidraw/excalidraw/index.css";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false, loading: () => <p className="p-4">Loading canvas...</p> },
);

const NODE_COUNT = 50;
const NODE_W = 240;
const NODE_H = 140;
const COLS = 10;
const GAP = 40;

type NodeShape = {
  id: string;
  excalidrawElementId: string;
  x: number;
  y: number;
  title: string;
};

function buildInitialScene(): {
  elements: Array<Record<string, unknown>>;
  nodes: NodeShape[];
} {
  const nodes: NodeShape[] = [];
  const elements: Array<Record<string, unknown>> = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * (NODE_W + GAP);
    const y = row * (NODE_H + GAP);
    const id = `node-${i}`;
    const excalidrawElementId = `el-${i}`;
    nodes.push({ id, excalidrawElementId, x, y, title: `Card ${i + 1}` });
    elements.push({
      id: excalidrawElementId,
      type: "rectangle",
      x,
      y,
      width: NODE_W,
      height: NODE_H,
      angle: 0,
      strokeColor: "#1e293b",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roundness: { type: 3 },
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      seed: i,
      versionNonce: 0,
      isDeleted: false,
      boundElements: [],
      updated: 1,
      link: null,
      locked: true,
      customData: { kind: "node-card", contextEntryId: id },
    });
  }
  return { elements, nodes };
}

export default function CanvasSpikePage() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const { elements: initialElements, nodes } = useMemo(buildInitialScene, []);
  const [appState, setAppState] = useState<{
    scrollX: number;
    scrollY: number;
    zoom: number;
  }>({ scrollX: 0, scrollY: 0, zoom: 1 });
  const rafRef = useRef<number | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);

  // RAF loop: read Excalidraw appState every frame and update our overlay state.
  useEffect(() => {
    if (!api) return;
    let lastTime = performance.now();
    let frames = 0;
    let lastFpsLog = lastTime;

    function tick(now: number) {
      if (!api) return;
      const ax = api.getAppState();
      setAppState({
        scrollX: ax.scrollX ?? 0,
        scrollY: ax.scrollY ?? 0,
        zoom: typeof ax.zoom === "number" ? ax.zoom : (ax.zoom?.value ?? 1),
      });
      frames++;
      setFrameCount((c) => c + 1);
      if (now - lastFpsLog >= 1000) {
        setFps(Math.round((frames * 1000) / (now - lastFpsLog)));
        frames = 0;
        lastFpsLog = now;
      }
      lastTime = now;
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [api]);

  // Push initial scene once the API is ready.
  useEffect(() => {
    if (!api) return;
    api.updateScene({ elements: initialElements as never });
  }, [api, initialElements]);

  const handleApi = useCallback((excalidrawApi: ExcalidrawImperativeAPI) => {
    setApi(excalidrawApi);
  }, []);

  return (
    <div className="relative" style={{ width: "100vw", height: "100vh" }}>
      <Excalidraw excalidrawAPI={handleApi} />

      {/* Overlay layer */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {nodes.map((node) => {
          const screenX = node.x * appState.zoom + appState.scrollX * appState.zoom;
          const screenY = node.y * appState.zoom + appState.scrollY * appState.zoom;
          const screenW = NODE_W * appState.zoom;
          const screenH = NODE_H * appState.zoom;
          return (
            <div
              key={node.id}
              className="absolute rounded-md border border-slate-300 bg-white/95 p-3 shadow-sm"
              style={{
                transform: `translate(${screenX}px, ${screenY}px)`,
                width: screenW,
                height: screenH,
                fontSize: 12 * appState.zoom,
                willChange: "transform",
              }}
            >
              <div className="truncate font-medium text-slate-900">
                {node.title}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                NOTE · 3 links
              </div>
              <div className="mt-2 line-clamp-2 text-[10px] leading-snug text-slate-600">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </div>
            </div>
          );
        })}
      </div>

      {/* Debug HUD */}
      <div
        className="pointer-events-none absolute right-4 top-4 rounded bg-black/70 px-3 py-2 font-mono text-xs text-white"
        aria-hidden="true"
      >
        <div>FPS: {fps}</div>
        <div>frames: {frameCount}</div>
        <div>
          scrollX: {appState.scrollX.toFixed(1)} scrollY:{" "}
          {appState.scrollY.toFixed(1)}
        </div>
        <div>zoom: {appState.zoom.toFixed(2)}</div>
        <div>nodes: {nodes.length}</div>
      </div>
    </div>
  );
}

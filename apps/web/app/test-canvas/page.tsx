"use client";

// Wave 9 diagnostic: bare Excalidraw mount for repro isolation.
// Confirmed (15. 5. 2026) that bare Excalidraw 0.18.1 works in our
// React 19.2.4 + Next 16 + pnpm monorepo. The Map view crash is in the
// full ContextCanvasViewMounted tree, not Excalidraw itself.
//
// Auth: this route is gated by middleware.ts. To use it, sign in at
// /login first, then visit /test-canvas.

import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false, loading: () => <div>Loading Excalidraw...</div> },
);

export default function TestCanvasPage() {
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
      <Excalidraw />
    </div>
  );
}

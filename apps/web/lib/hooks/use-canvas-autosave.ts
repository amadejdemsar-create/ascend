"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUpdateLayout, useUpsertNodes } from "@/lib/hooks/use-canvas";
import type { CanvasNodeItem } from "@/lib/hooks/use-canvas";
import {
  isCardRect,
  sanitizeAppStateForPersist,
} from "@/components/context/canvas/canvas-scene-utils";

const AUTOSAVE_DELAY_MS = 1500;
const FLUSH_BEFORE_UNLOAD = true;

export type AutosaveStatus = "idle" | "saving" | "saved" | "failed";

interface Args {
  layoutId: string;
  /** Latest canvas node rows (server-authoritative). */
  initialNodes: CanvasNodeItem[];
}

interface SceneElementLike {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  customData?: { kind?: string; contextEntryId?: string };
}

/**
 * Wave 9 Phase 5: debounced canvas autosave.
 *
 * Owns:
 *   - A 1.5s debounce timer that fires:
 *     - PATCH /api/canvas/layouts/[id] with the full scene blob
 *     - POST /api/canvas/layouts/[id]/nodes with any position deltas
 *       derived from card-rect elements
 *   - A status pill state: idle/saving/saved/failed.
 *
 * `onChange` must be wired to the Excalidraw component's onChange.
 * The caller passes the latest `elements` + `appState` + `files`
 * snapshot and our hook decides whether anything material changed.
 *
 * On blur / beforeunload, flushes synchronously via the same code path.
 */
export function useCanvasAutosave({ layoutId, initialNodes }: Args) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const updateLayout = useUpdateLayout();
  const upsertNodes = useUpsertNodes();

  // Latest pending scene + node deltas. We keep refs because the rAF
  // and debounce timer don't need React re-renders.
  const pendingSceneRef = useRef<{
    elements: unknown[];
    appState: Record<string, unknown>;
    files?: Record<string, unknown>;
  } | null>(null);
  const knownNodesRef = useRef<Map<string, CanvasNodeItem>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed knownNodes from server snapshot. Updates whenever the
  // upstream layout query re-fetches.
  useEffect(() => {
    const map = new Map<string, CanvasNodeItem>();
    for (const n of initialNodes) map.set(n.contextEntryId, n);
    knownNodesRef.current = map;
  }, [initialNodes]);

  const flush = useCallback(async () => {
    const scene = pendingSceneRef.current;
    if (!scene) return;
    pendingSceneRef.current = null;
    setStatus("saving");

    try {
      // 1) Derive node-position deltas from card-rect elements.
      const upsert: Array<{
        contextEntryId: string;
        x: number;
        y: number;
        w: number;
        h: number;
        excalidrawElementId: string;
      }> = [];
      for (const el of scene.elements as SceneElementLike[]) {
        if (!isCardRect(el)) continue;
        const entryId = el.customData?.contextEntryId;
        if (!entryId) continue;
        const known = knownNodesRef.current.get(entryId);
        const next = {
          contextEntryId: entryId,
          x: el.x ?? 0,
          y: el.y ?? 0,
          w: el.width ?? 240,
          h: el.height ?? 140,
          excalidrawElementId: el.id,
        };
        if (
          !known ||
          Math.abs(known.x - next.x) > 0.5 ||
          Math.abs(known.y - next.y) > 0.5 ||
          Math.abs(known.w - next.w) > 0.5 ||
          Math.abs(known.h - next.h) > 0.5 ||
          known.excalidrawElementId !== next.excalidrawElementId
        ) {
          upsert.push(next);
        }
      }

      // 2) Persist the canvas blob (best-effort; the server enforces
      //    the 2 MiB cap and rejects oversize with a clear error).
      //    Sanitize appState to strip Map/Set and transient fields that
      //    don't survive JSON round-trip (Bug 1 fix).
      const cleanAppState = sanitizeAppStateForPersist(scene.appState);
      await updateLayout.mutateAsync({
        id: layoutId,
        input: {
          canvas: {
            elements: scene.elements as never,
            appState: cleanAppState as never,
            files: scene.files as never,
          },
        },
      });

      // 3) Bulk-upsert node deltas (only when non-empty).
      if (upsert.length > 0) {
        await upsertNodes.mutateAsync({
          layoutId,
          body: { upsert, remove: [] },
        });
      }

      setStatus("saved");
      setLastSavedAt(Date.now());
    } catch {
      setStatus("failed");
    }
  }, [layoutId, updateLayout, upsertNodes]);

  // Called on every Excalidraw onChange.
  const onChange = useCallback(
    (
      elements: readonly unknown[],
      appState: Record<string, unknown>,
      files?: Record<string, unknown>,
    ) => {
      pendingSceneRef.current = {
        elements: elements as unknown[],
        appState,
        files,
      };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, AUTOSAVE_DELAY_MS);
    },
    [flush],
  );

  // Flush on unmount / page unload.
  useEffect(() => {
    if (!FLUSH_BEFORE_UNLOAD) return;
    function handleBeforeUnload() {
      if (pendingSceneRef.current) void flush();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
      // Final flush (best-effort) on unmount.
      if (pendingSceneRef.current) void flush();
    };
  }, [flush]);

  return {
    status,
    lastSavedAt,
    onChange,
    flush,
  };
}

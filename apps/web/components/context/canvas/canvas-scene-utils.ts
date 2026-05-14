/**
 * Wave 9 Phase 5: small helpers for building Excalidraw scene
 * primitives that represent CanvasNode cards.
 *
 * Excalidraw's full ElementType union is huge; we only need rectangle
 * here. The shape mirrors what `excalidrawAPI.getSceneElements()`
 * returns (subset of fields). When pushed via `updateScene`, Excalidraw
 * fills in defaults for any fields we omit.
 */

export interface NodeCardRect {
  id: string;
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  angle: 0;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roundness: { type: number } | null;
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  seed: number;
  versionNonce: number;
  isDeleted: false;
  boundElements: null;
  updated: number;
  link: null;
  locked: boolean;
  customData: { kind: "node-card"; contextEntryId: string };
}

let seedCounter = 1_000_000;

/**
 * Build an Excalidraw rectangle element for a card. The rectangle is
 * `locked: true` so the user can't accidentally drag it independently
 * of its card overlay (the overlay handles movement in Phase 5).
 *
 * The card content (title, type, tags) lives in the React overlay
 * synced to this rectangle's screen-space position.
 */
export function buildNodeCardRect(args: {
  elementId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  contextEntryId: string;
}): NodeCardRect {
  const seed = seedCounter++;
  return {
    id: args.elementId,
    type: "rectangle",
    x: args.x,
    y: args.y,
    width: args.w,
    height: args.h,
    angle: 0,
    // Stroke is faint and matches our card border; the rectangle is
    // effectively a hit-target placeholder under the React overlay.
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roundness: { type: 3 },
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    seed,
    versionNonce: seed,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: true,
    customData: { kind: "node-card", contextEntryId: args.contextEntryId },
  };
}

/**
 * Stable Excalidraw element id for a context entry. Used so the same
 * entry produces the same rectangle id on remount, simplifying merge.
 */
export function makeCardElementId(contextEntryId: string): string {
  return `card-${contextEntryId}`;
}

/**
 * Sentinel custom-data check for the card-overlay sync. Anything else
 * (freehand strokes, sticky notes, the user's own rectangles) is left
 * alone by Phase 5 logic.
 */
export function isCardRect(
  element: { customData?: { kind?: unknown } } | null | undefined,
): boolean {
  return element?.customData?.kind === "node-card";
}

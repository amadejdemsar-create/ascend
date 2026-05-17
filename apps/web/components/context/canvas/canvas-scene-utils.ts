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
 * `locked: false` so the user can drag it with Excalidraw's native
 * pointer interaction. The React card overlay tracks the rectangle's
 * live position via rAF + getSceneElements() and follows along.
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
    locked: false,
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

// ── AppState round-trip sanitization ─────────────────────────────────
//
// Excalidraw's AppState contains fields typed as Map<> and Set<> at
// runtime. JSON.stringify serializes Map to `{}` and Set to `{}`, which
// breaks Excalidraw on restore because it calls `.forEach()` (Map
// method) or iterates with Set semantics on what is now a plain object.
//
// Two complementary helpers harden the autosave (outgoing) and restore
// (incoming) paths so existing bad data in the DB is gracefully
// repaired on read and never re-persisted on write.
//
// Source of truth for the field list: @excalidraw/excalidraw@0.18.1
// dist/types/excalidraw/types.d.ts, `export interface AppState`.
//   - collaborators: Map<SocketId, Collaborator>  (line 314)
//   - followedBy: Set<SocketId>                   (line 341)
//
// Additional transient/non-serializable fields stripped on persist:
//   - contextMenu: contains React component items
//   - errorMessage: React.ReactNode
//   - newElement, resizingElement, multiElement, selectionElement:
//     live element references that are null between interactions
//   - editingTextElement, editingLinearElement: editing session state
//   - startBoundElement: binding session state
//   - suggestedBindings: binding session state (array of elements)
//   - fileHandle: FileSystemHandle (Web API, non-serializable)
//   - activeEmbeddable: references a live element
//   - toast: transient notification state
//   - snapLines: transient snap guides
//   - isLoading: runtime-only
//   - elementsToHighlight: transient hover state
//   - frameToHighlight: transient hover state
//   - pendingImageElementId: in-flight placement
//   - searchMatches: transient search highlights

/**
 * Fields that must NEVER be persisted to the database. They are either:
 * 1. Map/Set instances that don't survive JSON round-trip, or
 * 2. Runtime-only / transient state that is meaningless across sessions.
 *
 * Keeping the list as a const Set makes the strip operation O(1) per key.
 */
const TRANSIENT_APP_STATE_KEYS: ReadonlySet<string> = new Set([
  // Map/Set instances (the two confirmed crashers)
  "collaborators",
  "followedBy",
  // React.ReactNode / DOM handle (non-JSON-serializable)
  "contextMenu",
  "errorMessage",
  "fileHandle",
  // Live element references (null between interactions; non-serializable
  // element objects if captured mid-interaction)
  "newElement",
  "resizingElement",
  "multiElement",
  "selectionElement",
  "editingTextElement",
  "editingLinearElement",
  "startBoundElement",
  "suggestedBindings",
  "activeEmbeddable",
  // Transient UI state
  "toast",
  "snapLines",
  "isLoading",
  "elementsToHighlight",
  "frameToHighlight",
  "pendingImageElementId",
  "searchMatches",
]);

/**
 * Strip transient and non-serializable AppState fields before persisting
 * the canvas scene to the database. Pure function; does not mutate the input.
 *
 * Call this on the autosave path BEFORE JSON.stringify / PATCH body.
 */
export function sanitizeAppStateForPersist(
  appState: unknown,
): Record<string, unknown> {
  if (
    appState === null ||
    appState === undefined ||
    typeof appState !== "object"
  ) {
    return {};
  }

  const input = appState as Record<string, unknown>;
  const clean: Record<string, unknown> = {};

  for (const key of Object.keys(input)) {
    if (!TRANSIENT_APP_STATE_KEYS.has(key)) {
      clean[key] = input[key];
    }
  }

  return clean;
}

/**
 * Ensure Map/Set fields expected by Excalidraw are proper instances
 * before passing appState to `<Excalidraw initialData={{ appState }}>`.
 *
 * Handles three cases per field:
 *   - Missing/undefined: initialize to empty Map()/Set()
 *   - Already a Map/Set: pass through unchanged (fresh from Excalidraw API)
 *   - Plain object/array from JSON.parse: convert to proper instance
 *
 * Pure function; returns a new object. Does not mutate the input.
 */
export function rehydrateAppStateForExcalidraw(
  appState: unknown,
): Record<string, unknown> {
  if (
    appState === null ||
    appState === undefined ||
    typeof appState !== "object"
  ) {
    return {
      collaborators: new Map(),
      followedBy: new Set(),
    };
  }

  const input = appState as Record<string, unknown>;
  const result: Record<string, unknown> = { ...input };

  // collaborators: Map<SocketId, Collaborator>
  // In single-user Wave 8, this is always empty. If the stored value
  // is a plain object (from JSON round-trip), convert; if missing, init.
  const collab = input.collaborators;
  if (collab instanceof Map) {
    result.collaborators = collab;
  } else if (
    collab !== null &&
    collab !== undefined &&
    typeof collab === "object" &&
    !Array.isArray(collab)
  ) {
    // Plain object from JSON.parse (e.g. {} or {"socketId": {...}}).
    result.collaborators = new Map(
      Object.entries(collab as Record<string, unknown>),
    );
  } else {
    result.collaborators = new Map();
  }

  // followedBy: Set<SocketId>
  const followed = input.followedBy;
  if (followed instanceof Set) {
    result.followedBy = followed;
  } else if (Array.isArray(followed)) {
    result.followedBy = new Set(followed);
  } else {
    result.followedBy = new Set();
  }

  return result;
}

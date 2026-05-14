/**
 * Wave 9 Phase 6: helpers for syncing ContextLinks <-> Excalidraw
 * arrow elements.
 *
 * Excalidraw arrows that we manage carry customData = {
 *   kind: "edge",
 *   linkId: string,          // ContextLink.id once persisted
 *   linkType: ContextLinkType,
 * }
 *
 * User-drawn arrows that bind two card rectangles START without a
 * linkId. The view's onChange handler detects those and opens the
 * link-type picker; on confirm the arrow's customData.linkId is
 * patched in. On cancel the arrow is removed from the scene.
 */

import { edgeColor } from "@ascend/graph";
import type { ContextLinkType } from "@ascend/core";

/**
 * User-facing link types. DERIVED_FROM (Wave 7 branching) and
 * DATABASE_RELATION (Wave 5 RELATION field auto-managed) are
 * intentionally excluded from the picker.
 */
export const CANVAS_PICKER_LINK_TYPES: ContextLinkType[] = [
  "REFERENCES",
  "EXTENDS",
  "CONTRADICTS",
  "SUPPORTS",
  "EXAMPLE_OF",
  "SUPERSEDES",
  "APPLIES_TO",
  "PART_OF",
];

/**
 * Minimal shape used for arrow construction. Excalidraw fills in
 * defaults for fields we omit.
 */
export interface EdgeArrowElement {
  id: string;
  type: "arrow";
  x: number;
  y: number;
  width: number;
  height: number;
  angle: 0;
  strokeColor: string;
  backgroundColor: "transparent";
  fillStyle: "solid";
  strokeWidth: number;
  strokeStyle: "solid";
  roughness: 0;
  opacity: number;
  groupIds: string[];
  frameId: null;
  seed: number;
  versionNonce: number;
  isDeleted: false;
  boundElements: null;
  updated: number;
  link: null;
  locked: false;
  startBinding: { elementId: string; focus: 0; gap: 4 } | null;
  endBinding: { elementId: string; focus: 0; gap: 4 } | null;
  startArrowhead: null;
  endArrowhead: "arrow";
  points: Array<[number, number]>;
  customData: {
    kind: "edge";
    linkId: string;
    linkType: ContextLinkType;
  };
}

let arrowSeedCounter = 2_000_000;

/**
 * Build an Excalidraw arrow that represents a ContextLink between two
 * card rectangles. Coordinates are derived from the card-rect anchor
 * points (top-left + width/height). Excalidraw's bindings system will
 * snap the arrow's endpoints to the card edges at render time as long
 * as we set start/end binding by elementId.
 */
export function buildEdgeArrow(args: {
  linkId: string;
  linkType: ContextLinkType;
  fromElementId: string;
  toElementId: string;
  fromX: number;
  fromY: number;
  fromW: number;
  fromH: number;
  toX: number;
  toY: number;
  toW: number;
  toH: number;
  hidden: boolean;
}): EdgeArrowElement {
  const seed = arrowSeedCounter++;
  const startX = args.fromX + args.fromW / 2;
  const startY = args.fromY + args.fromH / 2;
  const endX = args.toX + args.toW / 2;
  const endY = args.toY + args.toH / 2;
  return {
    id: `edge-${args.linkId}`,
    type: "arrow",
    x: startX,
    y: startY,
    width: endX - startX,
    height: endY - startY,
    angle: 0,
    strokeColor: edgeColor(args.linkType),
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    opacity: args.hidden ? 0 : 100,
    groupIds: [],
    frameId: null,
    seed,
    versionNonce: seed,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    startBinding: { elementId: args.fromElementId, focus: 0, gap: 4 },
    endBinding: { elementId: args.toElementId, focus: 0, gap: 4 },
    startArrowhead: null,
    endArrowhead: "arrow",
    points: [
      [0, 0],
      [endX - startX, endY - startY],
    ],
    customData: {
      kind: "edge",
      linkId: args.linkId,
      linkType: args.linkType,
    },
  };
}

/**
 * Sentinel for the onChange diff: "is this an arrow element that
 * connects two card rectangles?" Used to identify net-new arrows the
 * user drew that should trigger the link-type picker.
 */
export function isUntaggedBoundArrow(
  element: unknown,
  cardElementIds: Set<string>,
): element is {
  id: string;
  type: "arrow";
  startBinding?: { elementId?: string };
  endBinding?: { elementId?: string };
} {
  if (
    typeof element !== "object" ||
    element === null ||
    (element as { type?: unknown }).type !== "arrow"
  )
    return false;
  const el = element as {
    id?: unknown;
    customData?: { kind?: unknown; linkId?: unknown };
    startBinding?: { elementId?: unknown };
    endBinding?: { elementId?: unknown };
  };
  if (typeof el.id !== "string") return false;
  // Already tagged as an existing link arrow? Skip.
  if (el.customData?.kind === "edge" && typeof el.customData.linkId === "string")
    return false;
  const startId = el.startBinding?.elementId;
  const endId = el.endBinding?.elementId;
  if (typeof startId !== "string" || typeof endId !== "string") return false;
  if (startId === endId) return false; // self-loop ignored
  return cardElementIds.has(startId) && cardElementIds.has(endId);
}

/**
 * Returns the element if its customData identifies it as a managed
 * edge arrow (i.e. corresponds to a ContextLink we created).
 */
export function isManagedEdgeArrow(element: unknown): element is {
  id: string;
  customData: {
    kind: "edge";
    linkId: string;
    linkType: ContextLinkType;
  };
} {
  if (typeof element !== "object" || element === null) return false;
  const el = element as { customData?: { kind?: unknown; linkId?: unknown } };
  return (
    el.customData?.kind === "edge" &&
    typeof el.customData.linkId === "string"
  );
}

/**
 * Diff previous vs next scene: returns newly-bound-untagged arrows
 * (candidates for the type picker) and any managed arrows that were
 * removed (candidates for deletion).
 */
export function diffArrows(
  prevElements: readonly unknown[],
  nextElements: readonly unknown[],
  cardElementIds: Set<string>,
): {
  newBoundArrows: Array<{
    id: string;
    fromElementId: string;
    toElementId: string;
  }>;
  removedLinkIds: string[];
} {
  const prevIds = new Set<string>();
  const prevManaged = new Map<string, string>(); // arrowId -> linkId
  for (const el of prevElements) {
    if (typeof el === "object" && el !== null) {
      const id = (el as { id?: unknown }).id;
      if (typeof id === "string") prevIds.add(id);
      if (isManagedEdgeArrow(el)) prevManaged.set(el.id, el.customData.linkId);
    }
  }

  const newBoundArrows: Array<{
    id: string;
    fromElementId: string;
    toElementId: string;
  }> = [];
  const nextIds = new Set<string>();
  for (const el of nextElements) {
    if (typeof el !== "object" || el === null) continue;
    const id = (el as { id?: unknown }).id;
    if (typeof id !== "string") continue;
    nextIds.add(id);
    if (prevIds.has(id)) continue;
    if (isUntaggedBoundArrow(el, cardElementIds)) {
      newBoundArrows.push({
        id: el.id,
        fromElementId: el.startBinding!.elementId!,
        toElementId: el.endBinding!.elementId!,
      });
    }
  }

  const removedLinkIds: string[] = [];
  for (const [arrowId, linkId] of prevManaged) {
    if (!nextIds.has(arrowId)) removedLinkIds.push(linkId);
  }

  return { newBoundArrows, removedLinkIds };
}

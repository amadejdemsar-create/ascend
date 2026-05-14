import { z } from "zod";

// =====================================================================
//  Wave 9: Spatial canvas (Map view) Zod surface.
//
//  Pure TS + Zod. No DOM, no Excalidraw runtime types (the editor lives
//  in apps/web; this package describes the wire shape only).
//
//  The Excalidraw scene is opaque to shared code: we validate its outer
//  envelope ({ elements, appState, files }) and enforce coarse size
//  caps. The full ElementType union (rectangle, ellipse, arrow, freedraw,
//  etc.) is too large to mirror here and would drift on every Excalidraw
//  release. Per-element shape checks happen at runtime in apps/web's
//  canvas-import-service.
// =====================================================================

// ── Card size enum ────────────────────────────────────────────────────
// Three card visual sizes the user can toggle from the toolbar.
// Persisted per-layout inside viewport.

export const CARD_SIZE_VALUES = ["compact", "default", "expanded"] as const;
export type CardSize = (typeof CARD_SIZE_VALUES)[number];
export const cardSizeSchema = z.enum(CARD_SIZE_VALUES);

// ── Canvas import format ──────────────────────────────────────────────
// W9 ships only .excalidraw native. .tldr was dropped in Phase 0 (see
// the wave 9 PRD Open Question 2). The enum has one value so any
// future format addition is a single-line change.

export const CANVAS_IMPORT_FORMAT_VALUES = ["excalidraw"] as const;
export type CanvasImportFormat = (typeof CANVAS_IMPORT_FORMAT_VALUES)[number];
export const canvasImportFormatSchema = z.enum(CANVAS_IMPORT_FORMAT_VALUES);

// ── Viewport ──────────────────────────────────────────────────────────
// Per-layout cursor-resume state. Numeric fields are unbounded by
// design: Excalidraw uses arbitrary canvas coordinates and zoom can be
// fractional. The DB CHECK constraint caps the JSON size at 8 KiB.

export const canvasViewportSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().finite().positive(),
  showEdges: z.boolean(),
  cardSize: cardSizeSchema,
});
export type CanvasViewport = z.infer<typeof canvasViewportSchema>;

// ── Excalidraw scene (loose envelope) ─────────────────────────────────
// We do not mirror Excalidraw's full ElementType. The DB CHECK caps the
// stringified scene at 2 MiB. Service-layer code parses individual
// elements when it needs to enumerate node-card rectangles.

const excalidrawElementSchema = z.record(z.string(), z.unknown());

export const excalidrawSceneSchema = z.object({
  elements: z.array(excalidrawElementSchema),
  appState: z.record(z.string(), z.unknown()),
  files: z.record(z.string(), z.unknown()).optional(),
});
export type ExcalidrawScene = z.infer<typeof excalidrawSceneSchema>;

// ── CanvasNode wire shape ─────────────────────────────────────────────
// Used both as an input (POST /api/canvas/layouts/[id]/nodes upsert
// payload) and as an output (GET /api/canvas/layouts/[id] response).
// `id` is optional on input because the server upserts on the
// (canvasLayoutId, contextEntryId) composite.

export const canvasNodeSchema = z.object({
  id: z.string().optional(),
  contextEntryId: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().positive().optional(),
  h: z.number().finite().positive().optional(),
  excalidrawElementId: z.string().min(1),
});
export type CanvasNodeInput = z.infer<typeof canvasNodeSchema>;

// ── Create layout ─────────────────────────────────────────────────────
// Slug is optional; server auto-derives from name when missing.

export const CANVAS_LAYOUT_NAME_MIN = 1;
export const CANVAS_LAYOUT_NAME_MAX = 200;
export const CANVAS_LAYOUT_SLUG_MAX = 200;

export const createCanvasLayoutSchema = z.object({
  name: z.string().min(CANVAS_LAYOUT_NAME_MIN).max(CANVAS_LAYOUT_NAME_MAX),
  slug: z
    .string()
    .min(1)
    .max(CANVAS_LAYOUT_SLUG_MAX)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, digits, hyphens")
    .optional(),
});
export type CreateCanvasLayoutInput = z.infer<typeof createCanvasLayoutSchema>;

// ── Update layout ─────────────────────────────────────────────────────
// Partial update. Service-layer pre-flight enforces the 2 MiB cap on
// `canvas` before the Prisma write hits the CHECK constraint.

export const updateCanvasLayoutSchema = z
  .object({
    name: z.string().min(CANVAS_LAYOUT_NAME_MIN).max(CANVAS_LAYOUT_NAME_MAX),
    slug: z
      .string()
      .min(1)
      .max(CANVAS_LAYOUT_SLUG_MAX)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, digits, hyphens"),
    isDefault: z.boolean(),
    viewport: canvasViewportSchema,
    canvas: excalidrawSceneSchema,
  })
  .partial();
export type UpdateCanvasLayoutInput = z.infer<typeof updateCanvasLayoutSchema>;

// ── Bulk node upsert ──────────────────────────────────────────────────
// Single autosave round-trip can include many node deltas and many
// removals. The per-call array caps prevent runaway requests from a
// pathological client.

export const UPSERT_CANVAS_NODES_MAX = 500;

export const upsertCanvasNodesBodySchema = z.object({
  upsert: z.array(canvasNodeSchema).max(UPSERT_CANVAS_NODES_MAX),
  remove: z.array(z.string().min(1)).max(UPSERT_CANVAS_NODES_MAX),
});
export type UpsertCanvasNodesBody = z.infer<typeof upsertCanvasNodesBodySchema>;

// ── Single node convenience routes ────────────────────────────────────

export const removeCanvasNodeParamsSchema = z.object({
  layoutId: z.string().min(1),
  contextEntryId: z.string().min(1),
});
export type RemoveCanvasNodeParams = z.infer<
  typeof removeCanvasNodeParamsSchema
>;

// ── Import ────────────────────────────────────────────────────────────
// JSON body, not multipart. The client parses the .excalidraw file
// (which is already JSON) and POSTs the parsed scene. The server
// re-validates the scene shape and applies the merge/replace.
//
// .tldr was dropped from W9 (Phase 0 spike). The `format` field exists
// for forward-compat but currently only accepts "excalidraw".

export const canvasImportBodySchema = z.object({
  layoutId: z.string().min(1),
  format: canvasImportFormatSchema,
  mode: z.enum(["replace", "merge"]),
  scene: excalidrawSceneSchema,
});
export type CanvasImportBody = z.infer<typeof canvasImportBodySchema>;

// ── MCP tool args ─────────────────────────────────────────────────────
// Reused by apps/web/lib/mcp/tools/canvas-tools.ts. Same shape as the
// HTTP API where possible.

export const getCanvasLayoutQuerySchema = z.object({
  layoutId: z.string().min(1).optional(),
});
export type GetCanvasLayoutQuery = z.infer<typeof getCanvasLayoutQuerySchema>;

export const setNodePositionSchema = z.object({
  layoutId: z.string().min(1),
  contextEntryId: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().positive().optional(),
  h: z.number().finite().positive().optional(),
});
export type SetNodePositionInput = z.infer<typeof setNodePositionSchema>;

// Annotation kinds the MCP tool exposes. Subset of Excalidraw element
// types that make sense as agent-creatable annotations.

export const ANNOTATION_KIND_VALUES = [
  "freehand",
  "rectangle",
  "ellipse",
  "text",
  "sticky",
  "frame",
] as const;
export type AnnotationKind = (typeof ANNOTATION_KIND_VALUES)[number];
export const annotationKindSchema = z.enum(ANNOTATION_KIND_VALUES);

export const annotationGeometrySchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().positive().optional(),
  h: z.number().finite().positive().optional(),
  points: z
    .array(
      z.object({
        x: z.number().finite(),
        y: z.number().finite(),
      }),
    )
    .optional(),
});
export type AnnotationGeometry = z.infer<typeof annotationGeometrySchema>;

export const createAnnotationSchema = z.object({
  layoutId: z.string().min(1),
  kind: annotationKindSchema,
  geometry: annotationGeometrySchema,
  content: z.string().max(10000).optional(),
});
export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;

import { z } from "zod";

// ── Lexical editor state (permissive) ───────────────────────────────
//
// We validate the outer shape of Lexical's SerializedEditorState without
// enforcing inner block shapes, because Lexical evolves those freely
// across minor versions. The important invariant is: a root node of type
// "root" containing an array of children.

export const serializedEditorStateSchema = z.object({
  root: z.object({
    type: z.literal("root"),
    children: z.array(z.unknown()),
    direction: z.string().nullable().optional(),
    format: z.string().optional(),
    indent: z.number().optional(),
    version: z.number().optional(),
  }),
});

export type SerializedEditorStateInput = z.infer<
  typeof serializedEditorStateSchema
>;

// ── Sync endpoint ───────────────────────────────────────────────────
//
// Body for POST /api/context/:id/blocks/sync
// The `update` field is a base64-encoded Yjs binary update. Capped at
// 1 MiB encoded (the application layer also enforces 256 KiB decoded).

export const syncBlockUpdateSchema = z.object({
  update: z
    .string()
    .regex(/^[A-Za-z0-9+/]+=*$/, "Must be valid base64")
    .max(1024 * 1024),
  expectedVersion: z.number().int().nonnegative(),
  // Client-supplied snapshot: the client computes this via
  // editor.getEditorState().toJSON() and sends it alongside the Yjs update.
  // Required because @lexical/yjs has no clean server-side API to extract
  // a Lexical snapshot from a Yjs Doc without a full editor + Provider
  // binding. For Wave 3 single-user this is safe; Wave 8 collaboration
  // would replace this with a server-side Lexical headless editor wired
  // to the Yjs doc via the V2 binding.
  snapshot: serializedEditorStateSchema,
});

export type SyncBlockUpdateInput = z.infer<typeof syncBlockUpdateSchema>;

// ── LLM-friendly block mutation schemas ─────────────────────────────
//
// These schemas validate the bodies for surgical block-level API routes
// that let connected agents (MCP tools, AIBlock) manipulate individual
// blocks without round-tripping the full Yjs state.

export const blockOpAddSchema = z.object({
  block: z
    .object({
      type: z.string().min(1).max(64),
      content: z.string().optional(),
    })
    .passthrough(), // permissive on extra fields (Lexical node properties vary)
  afterBlockId: z.string().min(1).max(64).optional(),
  parentBlockId: z.string().min(1).max(64).optional(),
});

export type BlockOpAddInput = z.infer<typeof blockOpAddSchema>;

export const blockOpUpdateSchema = z.object({
  patch: z.record(z.string(), z.unknown()),
});

export type BlockOpUpdateInput = z.infer<typeof blockOpUpdateSchema>;

export const blockOpMoveSchema = z
  .object({
    blockId: z.string().min(1).max(64),
    beforeId: z.string().min(1).max(64).optional(),
    afterId: z.string().min(1).max(64).optional(),
    parentId: z.string().min(1).max(64).optional(),
  })
  .refine((v) => Boolean(v.beforeId || v.afterId || v.parentId), {
    message: "Must specify at least one of beforeId, afterId, or parentId",
  });

export type BlockOpMoveInput = z.infer<typeof blockOpMoveSchema>;

// ── Read response schema ────────────────────────────────────────────

export const blockDocumentSnapshotSchema = z.object({
  snapshot: serializedEditorStateSchema,
  version: z.number().int().nonnegative(),
  extractedText: z.string().nullable().optional(),
  updatedAt: z.coerce.date(),
});

export type BlockDocumentSnapshot = z.infer<
  typeof blockDocumentSnapshotSchema
>;

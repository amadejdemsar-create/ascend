/**
 * CRDT schemas (Wave 8 Phase 4).
 *
 * Validation schemas for the CRDT token request and persist body
 * endpoints used by the Hocuspocus server and browser clients.
 */

import { z } from "zod";

/**
 * Schema for POST /api/crdt/token request body.
 *
 * The client sends the entryId of the ContextEntry whose BlockDocument
 * it wants to connect to via Hocuspocus WebSocket.
 */
export const crdtTokenRequestSchema = z.object({
  entryId: z.string().min(1).max(100),
});

export type CrdtTokenRequestInput = z.infer<typeof crdtTokenRequestSchema>;

/**
 * Schema for POST /api/blockdocs/[entryId]/persist request body.
 *
 * The CRDT server sends base64-encoded Yjs state for persistence.
 * The 2 MiB string cap on base64 accommodates ~1.5 MiB of raw binary
 * state, which is above the DZ-10 1 MiB cap. The service layer
 * enforces the 1 MiB cap after base64 decode.
 *
 * snapshot: optional Lexical JSON snapshot. Phase 4 sends null; Phase 5
 * fills this in when server-side or client-side snapshot extraction is
 * implemented.
 *
 * version: optional version hint. -1 or omitted means the service
 * should increment atomically without optimistic concurrency.
 */
export const crdtPersistBodySchema = z.object({
  state: z.string().min(1).max(2_097_152),
  snapshot: z.unknown().optional(),
  version: z.number().int().optional(),
});

export type CrdtPersistBodyInput = z.infer<typeof crdtPersistBodySchema>;

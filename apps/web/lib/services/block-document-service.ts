/**
 * Block Document Service.
 *
 * Manages BlockDocument CRUD, Yjs state persistence, and optimistic
 * concurrency control via version integers. Every query is userId-scoped
 * (safety rule 1). Only this service and block-migration-service.ts may
 * write to the BlockDocument table.
 *
 * Key design decisions:
 *
 * 1. Client-supplied snapshots: @lexical/yjs has no clean server-side API
 *    to extract a Lexical SerializedEditorState from a Yjs Doc without a
 *    full editor + Provider binding. The client sends the snapshot alongside
 *    the Yjs update in the /sync endpoint. For Wave 3 single-user HTTP
 *    autosave this is safe. Wave 8 collaboration would wire a server-side
 *    headless Lexical editor to the Yjs doc via the V2 binding.
 *
 * 2. Size caps: 1 MiB on the full state column (DB CHECK constraint
 *    backstop), 256 KiB on individual update payloads. Both enforced at the
 *    service boundary before hitting the database.
 *
 * 3. Zero LLM calls: the block editor is purely a content storage system.
 *    AIBlock cost happens in Phase 6 via llmService.chat (DZ-9 unaffected).
 *
 * Follows the const-object service pattern (see goal-service.ts).
 * userId is always the first parameter.
 */

import { prisma } from "@/lib/db";
import { extractText } from "@ascend/editor";
import * as Y from "yjs";

// ── Size caps ──────────────────────────────────────────────────────
const MAX_STATE_BYTES = 1024 * 1024; // 1 MiB
const MAX_UPDATE_BYTES = 256 * 1024; // 256 KiB

// ── Typed errors ───────────────────────────────────────────────────

export class BlockDocumentSizeError extends Error {
  public readonly actual: number;
  public readonly limit: number;

  constructor(actual: number, limit: number) {
    super(`Yjs state size ${actual} exceeds limit ${limit}`);
    this.name = "BlockDocumentSizeError";
    this.actual = actual;
    this.limit = limit;
  }
}

export class BlockDocumentDecodeError extends Error {
  public override readonly cause: unknown;

  constructor(cause: unknown) {
    super("Failed to decode base64 Yjs update");
    this.name = "BlockDocumentDecodeError";
    this.cause = cause;
  }
}

export class BlockDocumentVersionConflictError extends Error {
  public readonly expected: number;
  public readonly actual: number;

  constructor(expected: number, actual: number) {
    super(`Version conflict: expected ${expected}, got ${actual}`);
    this.name = "BlockDocumentVersionConflictError";
    this.expected = expected;
    this.actual = actual;
  }
}

// ── Service ────────────────────────────────────────────────────────

export const blockDocumentService = {
  /**
   * Get the BlockDocument for an entry. Returns null if the entry has no
   * block document yet. userId-scoped via entry ownership check.
   */
  async getByEntryId(
    userId: string,
    entryId: string,
  ): Promise<{
    id: string;
    snapshot: unknown;
    version: number;
    extractedText: string | null;
    updatedAt: Date;
  } | null> {
    // Verify entry ownership first (safety rule 1: userId in where clause).
    const entry = await prisma.contextEntry.findFirst({
      where: { id: entryId, userId },
      select: { id: true, blockDocumentId: true, extractedText: true },
    });
    if (!entry || !entry.blockDocumentId) return null;

    const doc = await prisma.blockDocument.findFirst({
      where: { id: entry.blockDocumentId, userId },
      select: { id: true, snapshot: true, version: true, updatedAt: true },
    });
    if (!doc) return null;

    return {
      id: doc.id,
      snapshot: doc.snapshot,
      version: doc.version,
      extractedText: entry.extractedText,
      updatedAt: doc.updatedAt,
    };
  },

  /**
   * Apply a Yjs update to the stored doc. Returns updated version + conflict flag.
   *
   * If expectedVersion matches, applies the update; returns the new version.
   * If expectedVersion is stale, returns conflict=true with the latest snapshot
   * so the client can merge via Yjs CRDT semantics.
   *
   * The client supplies the snapshot because @lexical/yjs has no clean
   * server-side snapshot extraction API (see module docstring).
   *
   * Cost-free (no LLM call). userId-scoped.
   */
  async applySync(
    userId: string,
    entryId: string,
    base64Update: string,
    expectedVersion: number,
    clientSnapshot: unknown,
  ): Promise<{
    version: number;
    conflict: boolean;
    latest?: { snapshot: unknown; version: number };
  }> {
    // 1. Decode + size cap on the update payload
    let updateBytes: Uint8Array;
    try {
      const buf = Buffer.from(base64Update, "base64");
      if (buf.length > MAX_UPDATE_BYTES) {
        throw new BlockDocumentSizeError(buf.length, MAX_UPDATE_BYTES);
      }
      updateBytes = new Uint8Array(buf);
    } catch (e) {
      if (e instanceof BlockDocumentSizeError) throw e;
      throw new BlockDocumentDecodeError(e);
    }

    // 2. Verify entry ownership (safety rule 1)
    const entry = await prisma.contextEntry.findFirst({
      where: { id: entryId, userId },
      select: { id: true, blockDocumentId: true },
    });
    if (!entry) throw new Error("Entry not found");

    if (!entry.blockDocumentId) {
      throw new Error("Block document not initialized; call /migrate first");
    }

    // 3. Load existing block document (userId-scoped)
    const existing = await prisma.blockDocument.findFirst({
      where: { id: entry.blockDocumentId, userId },
    });
    if (!existing) throw new Error("Block document missing");

    // 4. Version conflict check
    if (existing.version > expectedVersion) {
      // Client is stale; return latest for client-side merge.
      return {
        version: existing.version,
        conflict: true,
        latest: {
          snapshot: existing.snapshot as unknown,
          version: existing.version,
        },
      };
    }

    // 5. Apply Yjs update to the existing state
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, new Uint8Array(existing.state));
    Y.applyUpdate(ydoc, updateBytes);

    // 6. Encode the merged doc back to bytes
    const merged = Y.encodeStateAsUpdate(ydoc);
    if (merged.length > MAX_STATE_BYTES) {
      throw new BlockDocumentSizeError(merged.length, MAX_STATE_BYTES);
    }

    // 7. Extract plain text from the client-supplied snapshot for search indexing
    const text = extractText(clientSnapshot);

    // 8. Persist in a transaction (BlockDocument + ContextEntry.extractedText)
    const updated = await prisma.$transaction(async (tx) => {
      const newDoc = await tx.blockDocument.update({
        where: { id: existing.id },
        data: {
          state: Buffer.from(merged),
          snapshot: clientSnapshot as never,
          version: existing.version + 1,
        },
        select: { version: true },
      });
      await tx.contextEntry.update({
        where: { id: entryId },
        data: { extractedText: text },
      });
      return newDoc;
    });

    return { version: updated.version, conflict: false };
  },

  /**
   * Apply a snapshot replacement. Used by LLM-friendly mutation routes that
   * operate on the snapshot directly, not as Yjs updates.
   *
   * Internally: build a fresh Yjs doc from the snapshot using the headless
   * editor (markdownToBlocks round-trip would lose fidelity, so we store
   * the snapshot as-is and build a minimal Yjs doc to hold it).
   *
   * The expectedVersion check uses the same optimistic concurrency pattern
   * as applySync.
   */
  async replaceSnapshot(
    userId: string,
    entryId: string,
    newSnapshot: unknown,
    expectedVersion: number,
  ): Promise<{ version: number; conflict: boolean }> {
    // 1. Verify entry ownership (safety rule 1)
    const entry = await prisma.contextEntry.findFirst({
      where: { id: entryId, userId },
      select: { id: true, blockDocumentId: true },
    });
    if (!entry) throw new Error("Entry not found");

    if (!entry.blockDocumentId) {
      throw new Error("Block document not initialized; call /migrate first");
    }

    // 2. Load existing block document (userId-scoped)
    const existing = await prisma.blockDocument.findFirst({
      where: { id: entry.blockDocumentId, userId },
    });
    if (!existing) throw new Error("Block document missing");

    // 3. Version conflict check
    if (existing.version > expectedVersion) {
      return { version: existing.version, conflict: true };
    }

    // 4. Build a fresh Yjs doc to hold the new snapshot.
    // We store the snapshot JSON in the snapshot column and create a new
    // Yjs doc state. Since the snapshot came from an LLM-friendly route
    // (not a Yjs client), we need to create a fresh Yjs doc that represents
    // this state. For Wave 3 single-user, the Yjs doc acts as the CRDT
    // container; when a Yjs-aware client reconnects, it will receive this
    // new state and its local Yjs doc will merge via CRDT semantics.
    const ydoc = new Y.Doc();
    // Store a marker in the Yjs doc so that Yjs-aware clients know the
    // snapshot was replaced externally. The actual Lexical content is
    // reconstructed from the snapshot column on client load.
    const meta = ydoc.getMap("meta");
    meta.set("snapshotReplaced", true);
    meta.set("version", existing.version + 1);

    const state = Y.encodeStateAsUpdate(ydoc);
    if (state.length > MAX_STATE_BYTES) {
      throw new BlockDocumentSizeError(state.length, MAX_STATE_BYTES);
    }

    // 5. Extract plain text for search indexing
    const text = extractText(newSnapshot);

    // 6. Persist in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const newDoc = await tx.blockDocument.update({
        where: { id: existing.id },
        data: {
          state: Buffer.from(state),
          snapshot: newSnapshot as never,
          version: existing.version + 1,
        },
        select: { version: true },
      });
      await tx.contextEntry.update({
        where: { id: entryId },
        data: { extractedText: text },
      });
      return newDoc;
    });

    return { version: updated.version, conflict: false };
  },

  /**
   * Delete the BlockDocument for an entry. Usually handled by FK CASCADE,
   * but exposed for explicit cleanup paths.
   *
   * userId-scoped via deleteMany where clause (safety rule 1).
   */
  async deleteByEntryId(userId: string, entryId: string): Promise<void> {
    // deleteMany is safe with userId scope; returns count=0 if not found.
    await prisma.blockDocument.deleteMany({
      where: { entryId, userId },
    });
  },
};

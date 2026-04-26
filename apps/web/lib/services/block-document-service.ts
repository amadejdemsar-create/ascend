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
import type {
  BlockOpAddInput,
  BlockOpMoveInput,
  BlockOpUpdateInput,
} from "@ascend/core";
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
    // Phase 6a: empty update string means snapshot-only sync (no Yjs binary).
    // Wave 3 single-user sends snapshot only; Wave 8 will send real Yjs updates.
    const isSnapshotOnly = base64Update === "" || base64Update.length === 0;

    // 1. Decode + size cap on the update payload (skip for snapshot-only)
    let updateBytes: Uint8Array | null = null;
    if (!isSnapshotOnly) {
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

    // 5. Compute merged state
    let mergedState: Uint8Array;

    if (isSnapshotOnly) {
      // Snapshot-only path: rebuild a minimal Yjs doc from the snapshot
      // metadata. The actual content is in the snapshot JSON column;
      // the Yjs state serves as the CRDT container for Wave 8.
      const ydoc = new Y.Doc();
      const meta = ydoc.getMap("meta");
      meta.set("snapshotVersion", existing.version + 1);
      mergedState = Y.encodeStateAsUpdate(ydoc);
    } else {
      // Full Yjs update path (Wave 8 and beyond)
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, new Uint8Array(existing.state));
      Y.applyUpdate(ydoc, updateBytes!);
      mergedState = Y.encodeStateAsUpdate(ydoc);
    }

    if (mergedState.length > MAX_STATE_BYTES) {
      throw new BlockDocumentSizeError(mergedState.length, MAX_STATE_BYTES);
    }

    // 6. Extract plain text from the client-supplied snapshot for search indexing
    const text = extractText(clientSnapshot);

    // 7. Persist in a transaction (BlockDocument + ContextEntry.extractedText)
    const updated = await prisma.$transaction(async (tx) => {
      const newDoc = await tx.blockDocument.update({
        where: { id: existing.id },
        data: {
          state: Buffer.from(mergedState),
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

  // ── LLM-friendly block manipulation methods ─────────────────────
  //
  // These methods operate on the snapshot JSON tree directly (no headless
  // Lexical editor). After tree manipulation, they delegate to
  // replaceSnapshot for persistence (Yjs doc rebuild + extractedText +
  // version bump). This approach is simpler and avoids the complexity of
  // hydrating a Lexical editor on the server for each mutation.

  /**
   * Add a block at a position in the document.
   *
   * Positioning rules:
   *   - afterBlockId: insert immediately after the matching block in its parent's children
   *   - parentBlockId: append as the last child of the matching block
   *   - Neither: append at the end of root.children
   *
   * Assigns a stable key to the new block using crypto.randomUUID().
   */
  async addBlock(
    userId: string,
    entryId: string,
    op: BlockOpAddInput,
  ): Promise<{ snapshot: unknown; version: number }> {
    const doc = await this.getByEntryId(userId, entryId);
    if (!doc) throw new Error("Block document not found");

    const snapshot = structuredClone(doc.snapshot) as SnapshotRoot;
    const blockData = op.block as Record<string, unknown>;
    const existingChildren = Array.isArray(blockData.children)
      ? (blockData.children as BlockNode[])
      : [];
    const newBlock: BlockNode = {
      ...blockData,
      key: crypto.randomUUID().slice(0, 8),
      children: existingChildren,
      type: op.block.type,
      version: 1,
    };

    if (op.afterBlockId) {
      const inserted = insertAfter(snapshot.root.children, op.afterBlockId, newBlock);
      if (!inserted) throw new Error(`Block ${op.afterBlockId} not found`);
    } else if (op.parentBlockId) {
      const parent = findBlock(snapshot.root.children, op.parentBlockId);
      if (!parent) throw new Error(`Block ${op.parentBlockId} not found`);
      if (!Array.isArray(parent.children)) parent.children = [];
      parent.children.push(newBlock);
    } else {
      snapshot.root.children.push(newBlock);
    }

    const result = await this.replaceSnapshot(userId, entryId, snapshot, doc.version);
    if (result.conflict) {
      throw new Error("Concurrent modification; retry");
    }
    return { snapshot, version: result.version };
  },

  /**
   * Update a single block's properties via shallow merge.
   *
   * The patch is shallow-merged into the block's own properties (NOT
   * deep-merged to avoid surprising behavior on nested children). The
   * `key`, `type`, and `children` fields cannot be overwritten via patch.
   */
  async updateBlock(
    userId: string,
    entryId: string,
    blockId: string,
    patch: BlockOpUpdateInput["patch"],
  ): Promise<{ snapshot: unknown; version: number }> {
    const doc = await this.getByEntryId(userId, entryId);
    if (!doc) throw new Error("Block document not found");

    const snapshot = structuredClone(doc.snapshot) as SnapshotRoot;
    const block = findBlock(snapshot.root.children, blockId);
    if (!block) throw new Error(`Block ${blockId} not found`);

    // Shallow merge: protect structural fields from accidental overwrite
    const { key: _k, type: _t, children: _c, ...safePatch } = patch as Record<string, unknown>;
    Object.assign(block, safePatch);

    const result = await this.replaceSnapshot(userId, entryId, snapshot, doc.version);
    if (result.conflict) {
      throw new Error("Concurrent modification; retry");
    }
    return { snapshot, version: result.version };
  },

  /**
   * Move a block to a new position.
   *
   * Positioning rules:
   *   - afterId: insert immediately after the target block
   *   - beforeId: insert immediately before the target block
   *   - parentId: append as the last child of the target block
   *
   * At least one of afterId, beforeId, parentId must be specified
   * (validated by the Zod schema's refine).
   */
  async moveBlock(
    userId: string,
    entryId: string,
    op: BlockOpMoveInput,
  ): Promise<{ snapshot: unknown; version: number }> {
    const doc = await this.getByEntryId(userId, entryId);
    if (!doc) throw new Error("Block document not found");

    const snapshot = structuredClone(doc.snapshot) as SnapshotRoot;

    // 1. Splice the block from its current position
    const removed = removeBlock(snapshot.root.children, op.blockId);
    if (!removed) throw new Error(`Block ${op.blockId} not found`);

    // 2. Insert at new position
    if (op.afterId) {
      const inserted = insertAfter(snapshot.root.children, op.afterId, removed);
      if (!inserted) throw new Error(`Target block ${op.afterId} not found`);
    } else if (op.beforeId) {
      const inserted = insertBefore(snapshot.root.children, op.beforeId, removed);
      if (!inserted) throw new Error(`Target block ${op.beforeId} not found`);
    } else if (op.parentId) {
      const parent = findBlock(snapshot.root.children, op.parentId);
      if (!parent) throw new Error(`Target block ${op.parentId} not found`);
      if (!Array.isArray(parent.children)) parent.children = [];
      parent.children.push(removed);
    }

    const result = await this.replaceSnapshot(userId, entryId, snapshot, doc.version);
    if (result.conflict) {
      throw new Error("Concurrent modification; retry");
    }
    return { snapshot, version: result.version };
  },

  /**
   * Delete a block by its key.
   *
   * If deleting the last block, inserts an empty paragraph to maintain
   * Lexical's non-empty root invariant.
   */
  async deleteBlock(
    userId: string,
    entryId: string,
    blockId: string,
  ): Promise<{ snapshot: unknown; version: number }> {
    const doc = await this.getByEntryId(userId, entryId);
    if (!doc) throw new Error("Block document not found");

    const snapshot = structuredClone(doc.snapshot) as SnapshotRoot;
    const removed = removeBlock(snapshot.root.children, blockId);
    if (!removed) throw new Error(`Block ${blockId} not found`);

    // Lexical requires at least one child in root
    if (snapshot.root.children.length === 0) {
      snapshot.root.children.push({
        type: "paragraph",
        key: crypto.randomUUID().slice(0, 8),
        children: [],
        direction: null,
        format: "",
        indent: 0,
        textFormat: 0,
        textStyle: "",
        version: 1,
      });
    }

    const result = await this.replaceSnapshot(userId, entryId, snapshot, doc.version);
    if (result.conflict) {
      throw new Error("Concurrent modification; retry");
    }
    return { snapshot, version: result.version };
  },
};

// ── Block tree types ──────────────────────────────────────────────

interface BlockNode {
  key?: string;
  type: string;
  children?: BlockNode[];
  [prop: string]: unknown;
}

interface SnapshotRoot {
  root: {
    type: string;
    children: BlockNode[];
    [prop: string]: unknown;
  };
}

// ── Block tree helpers ────────────────────────────────────────────
//
// Recursive utilities for finding, inserting, and removing blocks
// in the Lexical snapshot JSON tree. Blocks are identified by their
// `key` field (Lexical's stable node identifier).

/**
 * Find a block by key in a tree of children. Recurses into nested children.
 */
function findBlock(children: BlockNode[], key: string): BlockNode | null {
  for (const child of children) {
    if (child.key === key) return child;
    if (child.children && child.children.length > 0) {
      const found = findBlock(child.children, key);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Remove a block by key from a tree. Returns the removed block or null.
 * Recurses into nested children.
 */
function removeBlock(children: BlockNode[], key: string): BlockNode | null {
  for (let i = 0; i < children.length; i++) {
    if (children[i].key === key) {
      return children.splice(i, 1)[0];
    }
    if (children[i].children && children[i].children!.length > 0) {
      const found = removeBlock(children[i].children!, key);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Insert a block immediately after the block with the given key.
 * Returns true if the target was found and the block was inserted.
 */
function insertAfter(
  children: BlockNode[],
  afterKey: string,
  block: BlockNode,
): boolean {
  for (let i = 0; i < children.length; i++) {
    if (children[i].key === afterKey) {
      children.splice(i + 1, 0, block);
      return true;
    }
    if (children[i].children && children[i].children!.length > 0) {
      if (insertAfter(children[i].children!, afterKey, block)) return true;
    }
  }
  return false;
}

/**
 * Insert a block immediately before the block with the given key.
 * Returns true if the target was found and the block was inserted.
 */
function insertBefore(
  children: BlockNode[],
  beforeKey: string,
  block: BlockNode,
): boolean {
  for (let i = 0; i < children.length; i++) {
    if (children[i].key === beforeKey) {
      children.splice(i, 0, block);
      return true;
    }
    if (children[i].children && children[i].children!.length > 0) {
      if (insertBefore(children[i].children!, beforeKey, block)) return true;
    }
  }
  return false;
}

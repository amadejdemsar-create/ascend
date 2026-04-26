/**
 * Block Migration Service.
 *
 * Converts legacy ContextEntry markdown content to a BlockDocument.
 * Called on first edit of an entry in the block editor (lazy migration)
 * or explicitly via the /migrate API endpoint.
 *
 * Design:
 * - Idempotent: if the entry already has a blockDocumentId, returns the
 *   existing BlockDocument metadata without modification.
 * - Non-destructive: the original ContextEntry.content field is preserved
 *   as a fallback. The new BlockDocument becomes the source of truth.
 * - extractedText is written in the same transaction so the search_vector
 *   trigger picks it up immediately.
 * - The Yjs doc is built as a fresh empty doc with the snapshot stored
 *   separately. This is the same pattern as replaceSnapshot in
 *   blockDocumentService. When a Yjs-aware client loads this doc, it
 *   initializes from the snapshot column (not the Yjs state), since the
 *   Yjs state only serves as the CRDT container for future edits.
 *
 * Zero LLM calls. userId-scoped on every query (safety rule 1).
 *
 * Follows the const-object service pattern (see goal-service.ts).
 */

import { prisma } from "@/lib/db";
import { markdownToBlocks, extractText } from "@ascend/editor";
import * as Y from "yjs";

export const blockMigrationService = {
  /**
   * Convert the entry's legacy markdown content to a BlockDocument.
   * Idempotent: returns existing if already migrated.
   * Preserves ContextEntry.content as fallback (no destructive change).
   * Triggers search_vector update via the extractedText write.
   */
  async migrateEntryToBlocks(
    userId: string,
    entryId: string,
  ): Promise<{
    blockDocumentId: string;
    version: number;
  }> {
    // 1. Verify entry ownership (safety rule 1: userId in where clause)
    const entry = await prisma.contextEntry.findFirst({
      where: { id: entryId, userId },
      select: { id: true, content: true, blockDocumentId: true },
    });
    if (!entry) throw new Error("Entry not found");

    // 2. Idempotent: if already migrated, return existing.
    if (entry.blockDocumentId) {
      const existing = await prisma.blockDocument.findFirst({
        where: { id: entry.blockDocumentId, userId },
        select: { id: true, version: true },
      });
      if (existing) {
        return {
          blockDocumentId: existing.id,
          version: existing.version,
        };
      }
      // blockDocumentId is set but the document is missing (orphan FK).
      // Fall through to re-create.
    }

    // 3. Convert markdown to Lexical serialized editor state
    const md = entry.content ?? "";
    const snapshot = markdownToBlocks(md);
    const text = extractText(snapshot);

    // 4. Build a Yjs doc to serve as the CRDT container.
    // For the migration path, the Yjs doc is a fresh empty doc. The actual
    // Lexical content is stored in the snapshot column and used by the
    // client to initialize the editor. Future Yjs updates from the client
    // will be applied on top of this base state.
    const ydoc = new Y.Doc();
    const meta = ydoc.getMap("meta");
    meta.set("migrated", true);
    meta.set("sourceFormat", "markdown");
    const state = Y.encodeStateAsUpdate(ydoc);

    // 5. Persist in a transaction (BlockDocument creation + ContextEntry link)
    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.blockDocument.create({
        data: {
          userId,
          entryId,
          state: Buffer.from(state),
          snapshot: snapshot as never,
          version: 1,
        },
      });
      await tx.contextEntry.update({
        where: { id: entryId },
        data: { blockDocumentId: doc.id, extractedText: text },
      });
      return doc;
    });

    return {
      blockDocumentId: result.id,
      version: result.version,
    };
  },

  /**
   * Re-migrate an entry from updated markdown content. Used when an external
   * write (MCP set_context, admin tool) changes ContextEntry.content and the
   * entry already has a BlockDocument. Overwrites the existing BlockDocument
   * with the new content while preserving the document ID and incrementing
   * the version.
   *
   * This is NOT called for normal editor saves (those go through applySync).
   * It is specifically for external-content-changes-regenerate-blocks flow.
   */
  async regenerateFromContent(
    userId: string,
    entryId: string,
    newContent: string,
  ): Promise<{ version: number }> {
    // 1. Verify entry ownership (safety rule 1)
    const entry = await prisma.contextEntry.findFirst({
      where: { id: entryId, userId },
      select: { id: true, blockDocumentId: true },
    });
    if (!entry) throw new Error("Entry not found");
    if (!entry.blockDocumentId) {
      // No block document yet; nothing to regenerate. The next time the
      // user opens the entry in the block editor, migrateEntryToBlocks
      // will handle the conversion.
      return { version: 0 };
    }

    // 2. Load existing block document (userId-scoped)
    const existing = await prisma.blockDocument.findFirst({
      where: { id: entry.blockDocumentId, userId },
      select: { id: true, version: true },
    });
    if (!existing) {
      return { version: 0 };
    }

    // 3. Convert new markdown to blocks
    const snapshot = markdownToBlocks(newContent);
    const text = extractText(snapshot);

    // 4. Build a fresh Yjs doc (same pattern as migrateEntryToBlocks)
    const ydoc = new Y.Doc();
    const meta = ydoc.getMap("meta");
    meta.set("externalRewrite", true);
    meta.set("version", existing.version + 1);
    const state = Y.encodeStateAsUpdate(ydoc);

    // 5. Persist in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.blockDocument.update({
        where: { id: existing.id },
        data: {
          state: Buffer.from(state),
          snapshot: snapshot as never,
          version: existing.version + 1,
        },
        select: { version: true },
      });
      await tx.contextEntry.update({
        where: { id: entryId },
        data: { extractedText: text },
      });
      return doc;
    });

    return { version: updated.version };
  },
};

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";
import type { SyncBlockUpdateInput } from "@/lib/validations";
import type { SyncResult } from "@/lib/hooks/use-block-document";

/**
 * AutosavePlugin: debounced save of editor state to the server.
 *
 * Phase 6a simplification: sends snapshot-only sync (empty Yjs update
 * string). The server stores the snapshot directly. Wave 8 collaboration
 * will send real Yjs binary updates.
 *
 * On version conflict, replaces the editor state with the server's latest
 * snapshot and notifies the user via toast.
 */

interface Props {
  entryId: string;
  version: number;
  sync: UseMutationResult<SyncResult, Error, SyncBlockUpdateInput>;
  debounceMs?: number;
}

export function AutosavePlugin({
  entryId,
  version,
  sync,
  debounceMs = 1500,
}: Props) {
  const [editor] = useLexicalComposerContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(version);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const entryIdRef = useRef(entryId);

  // Keep version ref current
  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  useEffect(() => {
    entryIdRef.current = entryId;
  }, [entryId]);

  const doSave = useCallback(async () => {
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    pendingSaveRef.current = false;

    try {
      // The snapshot type from Lexical's toJSON() has root.type as `string`,
      // but our Zod schema expects `"root"` (literal). The cast is safe
      // because Lexical always produces root.type === "root".
      const snapshot = editor.getEditorState().toJSON() as unknown as {
        root: { type: "root"; children: unknown[] };
      };
      const result = await sync.mutateAsync({
        update: "", // Phase 6a: snapshot-only sync
        expectedVersion: versionRef.current,
        snapshot,
      });

      if (result.conflict && result.latest) {
        // Version conflict: replace editor state with server's latest
        const serverSnapshot = result.latest.snapshot;
        editor.update(() => {
          const state = editor.parseEditorState(
            JSON.stringify(serverSnapshot),
          );
          editor.setEditorState(state);
        });
        versionRef.current = result.latest.version;
        toast.info("Content was updated elsewhere. Synced to latest version.");
      } else {
        versionRef.current = result.version;
      }
    } catch (err) {
      console.error("[AutosavePlugin] Save failed:", err);
      toast.error("Failed to save. Retrying in 5 seconds...");
      // Retry once after 5s
      setTimeout(() => {
        doSave();
      }, 5000);
    } finally {
      isSavingRef.current = false;
      // If a save was queued while we were saving, flush it now
      if (pendingSaveRef.current) {
        doSave();
      }
    }
  }, [editor, sync]);

  useEffect(() => {
    const unregister = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      // Only save when there are actual content changes (not selection-only updates)
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(doSave, debounceMs);
    });

    return () => {
      unregister();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [editor, doSave, debounceMs]);

  // Flush on unmount (entry navigation, page leave)
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // Fire save immediately on unmount
        doSave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

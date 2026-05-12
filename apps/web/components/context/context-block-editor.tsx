"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { ALL_NODES, EDITOR_THEME, TRANSFORMERS } from "@ascend/editor";
import type { Klass, LexicalNode } from "lexical";
import { toast } from "sonner";

import { AutosavePlugin } from "@/components/editor/autosave-plugin";
import {
  CollaborationPluginWrapper,
  type CollaborationStatus,
} from "@/components/editor/collaboration-plugin";
import { SlashMenuPlugin } from "@/components/editor/slash-menu-plugin";
import { InlineToolbarPlugin } from "@/components/editor/inline-toolbar-plugin";
import { WikiLinkAutocompletePlugin } from "@/components/editor/wikilink-autocomplete-plugin";
import { MentionAutocompletePlugin } from "@/components/editor/mention-autocomplete-plugin";
import { KeyboardShortcutsPlugin } from "@/components/editor/keyboard-shortcuts-plugin";
import { DecoratorPlugin } from "@/components/editor/decorator-plugin";
import { FileDropPlugin } from "@/components/editor/file-drop-plugin";
import {
  useBlockDocument,
  useMigrateBlockDocument,
  useSyncBlockDocument,
} from "@/lib/hooks/use-block-document";
import { ContextBlockEditorErrorBoundary } from "./context-block-editor-error-boundary";

/**
 * ContextBlockEditor: the main Lexical block editor component.
 *
 * Replaces the legacy <textarea> in the context entry detail panel.
 * Mounts inside the existing detail panel layout.
 *
 * First mount reads the block document via useBlockDocument. If no block
 * document exists (entry not yet migrated), fires useMigrateBlockDocument
 * to perform the one-time markdown-to-blocks conversion.
 *
 * Real-time mode (Wave 8 Phase 5): connects to the Hocuspocus CRDT
 * server via CollaborationPluginWrapper. If the WS connection fails
 * or times out (5s), falls back to the legacy AutosavePlugin with
 * a one-time warning toast.
 *
 * DZ-7: wrapped in ContextBlockEditorErrorBoundary.
 */

interface Props {
  entryId: string;
  fallbackContent?: string;
}

// Merge ALL_NODES from @ascend/editor with web-only nodes (HorizontalRuleNode)
const EDITOR_NODES: Array<Klass<LexicalNode>> = [
  ...ALL_NODES,
  HorizontalRuleNode,
];

export function ContextBlockEditor({ entryId, fallbackContent }: Props) {
  const { data: doc, isLoading, isError } = useBlockDocument(entryId);
  const migrate = useMigrateBlockDocument(entryId);
  const sync = useSyncBlockDocument(entryId);
  const [isMigrating, setIsMigrating] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  // If doc is null (not yet migrated) and we're not loading, trigger migration.
  useEffect(() => {
    if (isLoading || isMigrating) return;
    if (doc === null && !migrate.isPending && !migrate.isSuccess) {
      setIsMigrating(true);
      migrate.mutate(undefined, {
        onSuccess: () => {
          setIsMigrating(false);
          // Force editor re-mount after migration provides the snapshot
          setEditorKey((k) => k + 1);
        },
        onError: (err) => {
          setIsMigrating(false);
          console.error("[ContextBlockEditor] Migration failed:", err);
          toast.error("Failed to convert document to block editor format");
        },
      });
    }
  }, [doc, isLoading, isMigrating, migrate]);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground animate-pulse py-4">
        Loading editor...
      </div>
    );
  }

  if (isMigrating || (doc === null && migrate.isPending)) {
    return (
      <div className="text-sm text-muted-foreground animate-pulse py-4">
        Converting markdown to blocks...
      </div>
    );
  }

  if (isError) {
    return (
      <ContextBlockEditorErrorBoundary
        entryId={entryId}
        fallbackContent={fallbackContent}
      >
        <div />
      </ContextBlockEditorErrorBoundary>
    );
  }

  if (!doc) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No block document available.
      </div>
    );
  }

  return (
    <ContextBlockEditorErrorBoundary
      entryId={entryId}
      fallbackContent={fallbackContent}
    >
      <EditorInner
        key={`${entryId}-${editorKey}`}
        entryId={entryId}
        snapshot={doc.snapshot}
        version={doc.version}
        sync={sync}
      />
    </ContextBlockEditorErrorBoundary>
  );
}

/**
 * Inner editor component. Separated so LexicalComposer can be keyed
 * and re-mounted cleanly when the entry changes or migration completes.
 *
 * Manages the realtime vs. fallback decision: starts by attempting a
 * CRDT connection. If the connection succeeds, mounts CollaborationPlugin
 * (and omits AutosavePlugin). If the connection fails or times out (5s),
 * mounts AutosavePlugin as the fallback persistence layer.
 */
function EditorInner({
  entryId,
  snapshot,
  version,
  sync,
}: {
  entryId: string;
  snapshot: unknown;
  version: number;
  sync: ReturnType<typeof useSyncBlockDocument>;
}) {
  // ── Realtime vs. fallback state machine ─────────────────────────
  // "pending"  : waiting for CollaborationPluginWrapper to report
  // "realtime" : CRDT connection established
  // "fallback" : CRDT failed or timed out, using AutosavePlugin
  const [mode, setMode] = useState<"pending" | "realtime" | "fallback">(
    "pending",
  );
  const fallbackToastFiredRef = useRef(false);

  const handleCollaborationStatus = useCallback(
    (status: CollaborationStatus) => {
      if (status === "connected") {
        setMode("realtime");
      } else if (status === "error") {
        setMode("fallback");
        // Show warning toast ONCE per editor session
        if (!fallbackToastFiredRef.current) {
          fallbackToastFiredRef.current = true;
          toast.warning(
            "Real-time disabled, edits will save on a delay",
          );
        }
      }
      // "connecting" keeps mode as "pending"
    },
    [],
  );

  // ── LexicalComposer config ──────────────────────────────────────
  // When CollaborationPlugin is active (or pending), editorState MUST
  // be undefined per @lexical/react docs; otherwise the bootstrap
  // conflicts with CollaborationPlugin's Yjs-based state init.
  // When in fallback mode, we provide the snapshot as initial state.
  const initialConfig = useMemo(
    () => ({
      namespace: `context-entry-${entryId}`,
      theme: EDITOR_THEME,
      nodes: EDITOR_NODES,
      onError: (error: Error) => {
        console.error("[Lexical] Editor error:", error);
        throw error;
      },
      editorState:
        mode === "fallback"
          ? snapshot
            ? JSON.stringify(snapshot)
            : undefined
          : undefined,
    }),
    // initialConfig should only be computed once for this editor instance,
    // or when the mode settles to "fallback" (which triggers a re-mount
    // via the key change below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entryId, mode],
  );

  // When switching to fallback mode, the editor needs to re-mount so
  // LexicalComposer picks up the editorState from the snapshot.
  // We key on mode to force this re-mount.
  const composerKey = `${entryId}-${mode}`;

  return (
    <div className="relative">
      <LexicalComposer key={composerKey} initialConfig={initialConfig}>
        <div className="editor-shell relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="editor-content outline-none min-h-[200px]"
                aria-label="Document editor"
              />
            }
            placeholder={
              <div className="editor-placeholder absolute top-0 left-0 pointer-events-none text-muted-foreground text-sm">
                Start writing...
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          {/* HistoryPlugin is NOT mounted when CollaborationPlugin
              is active: CollaborationPlugin provides its own Yjs-based
              undo manager. Mount only in fallback or pending-before-fallback. */}
          {mode === "fallback" && <HistoryPlugin />}
          <ListPlugin />
          <CheckListPlugin />
          <LinkPlugin />
          <HorizontalRulePlugin />
          <TabIndentationPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />

          {/* ── Persistence layer: realtime or legacy ───────────── */}
          {mode !== "fallback" && (
            <CollaborationPluginWrapper
              entryId={entryId}
              snapshot={snapshot}
              onStatusChange={handleCollaborationStatus}
            />
          )}
          {mode === "fallback" && (
            <AutosavePlugin
              entryId={entryId}
              version={version}
              sync={sync}
            />
          )}

          <SlashMenuPlugin entryId={entryId} />
          <InlineToolbarPlugin />
          <WikiLinkAutocompletePlugin />
          <MentionAutocompletePlugin />
          <KeyboardShortcutsPlugin />
          <DecoratorPlugin entryId={entryId} />
          <FileDropPlugin entryId={entryId} />
        </div>
      </LexicalComposer>

      {/* ── Connection status indicator ──────────────────────────── */}
      <ConnectionStatusIndicator mode={mode} />
    </div>
  );
}

/**
 * Inline connection status indicator rendered at the bottom-right
 * of the editor shell. Shows a colored dot with label text.
 *
 * Accessibility: the indicator is a status region (role="status")
 * so screen readers announce changes. The dot is decorative
 * (aria-hidden), and the text label conveys the state.
 */
function ConnectionStatusIndicator({
  mode,
}: {
  mode: "pending" | "realtime" | "fallback";
}) {
  if (mode === "pending") {
    return (
      <div
        role="status"
        className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs text-muted-foreground select-none"
      >
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50 motion-safe:animate-pulse"
        />
        <span>Connecting</span>
      </div>
    );
  }

  if (mode === "realtime") {
    return (
      <div
        role="status"
        className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 select-none"
      >
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full bg-emerald-500"
        />
        <span>Live</span>
      </div>
    );
  }

  // fallback
  return (
    <div
      role="status"
      className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 select-none"
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full bg-amber-500"
      />
      <span>Offline (autosave)</span>
    </div>
  );
}

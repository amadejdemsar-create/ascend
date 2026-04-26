"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { SlashMenuPlugin } from "@/components/editor/slash-menu-plugin";
import { InlineToolbarPlugin } from "@/components/editor/inline-toolbar-plugin";
import { WikiLinkAutocompletePlugin } from "@/components/editor/wikilink-autocomplete-plugin";
import { MentionAutocompletePlugin } from "@/components/editor/mention-autocomplete-plugin";
import { KeyboardShortcutsPlugin } from "@/components/editor/keyboard-shortcuts-plugin";
import { DecoratorPlugin } from "@/components/editor/decorator-plugin";
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
 * Autosave: snapshot-only sync (Phase 6a simplification). Real Yjs
 * binary updates deferred to Wave 8.
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
  const initialConfig = useMemo(
    () => ({
      namespace: `context-entry-${entryId}`,
      theme: EDITOR_THEME,
      nodes: EDITOR_NODES,
      onError: (error: Error) => {
        console.error("[Lexical] Editor error:", error);
        // Let the error boundary catch this
        throw error;
      },
      editorState: snapshot ? JSON.stringify(snapshot) : undefined,
    }),
    // initialConfig should only be computed once for this editor instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entryId],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
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
        <HistoryPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <LinkPlugin />
        <HorizontalRulePlugin />
        <TabIndentationPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <AutosavePlugin
          entryId={entryId}
          version={version}
          sync={sync}
        />
        <SlashMenuPlugin />
        <InlineToolbarPlugin />
        <WikiLinkAutocompletePlugin />
        <MentionAutocompletePlugin />
        <KeyboardShortcutsPlugin />
        <DecoratorPlugin />
      </div>
    </LexicalComposer>
  );
}

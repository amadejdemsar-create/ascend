"use client";

/**
 * CollaborationPluginWrapper: thin wrapper over @lexical/react's
 * CollaborationPlugin that bridges the HocuspocusProvider from
 * useRealtimeDocument into Lexical's Provider interface.
 *
 * Mounting rules:
 *   - Must be rendered INSIDE a <LexicalComposer> whose initialConfig
 *     has editorState set to undefined (CollaborationPlugin manages
 *     the editor state lifecycle via Yjs).
 *   - The parent is responsible for falling back to AutosavePlugin
 *     when this component reports an error or connection timeout.
 *
 * Phase 5 scope: no cursor rendering (cursors land in Phase 6).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import type { Provider } from "@lexical/yjs";
import type { Doc } from "yjs";
import { useRealtimeDocument } from "@/lib/realtime/use-realtime-document";

// ── Connection timeout (ms) ──────────────────────────────────────
const CONNECTION_TIMEOUT_MS = 5_000;

// ── Status type exposed to the parent ────────────────────────────
export type CollaborationStatus = "connecting" | "connected" | "error";

interface Props {
  entryId: string;
  snapshot: unknown;
  onStatusChange?: (status: CollaborationStatus) => void;
}

/**
 * Wraps useRealtimeDocument + Lexical CollaborationPlugin.
 *
 * Returns null (renders nothing) when the CRDT connection fails or
 * times out. The parent detects this via onStatusChange and mounts
 * the legacy AutosavePlugin instead.
 */
export function CollaborationPluginWrapper({
  entryId,
  snapshot,
  onStatusChange,
}: Props) {
  const { doc, provider, isConnected, error } = useRealtimeDocument(entryId);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<CollaborationStatus>("connecting");

  // ── Connection timeout logic ────────────────────────────────────
  useEffect(() => {
    if (isConnected || error) {
      // Connection resolved; cancel timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Start timeout timer if not already started
    if (!timeoutRef.current && !timedOut) {
      timeoutRef.current = setTimeout(() => {
        setTimedOut(true);
        timeoutRef.current = null;
      }, CONNECTION_TIMEOUT_MS);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isConnected, error, timedOut]);

  // ── Notify parent of status changes ─────────────────────────────
  useEffect(() => {
    let newStatus: CollaborationStatus;
    if (error || timedOut) {
      newStatus = "error";
    } else if (isConnected && doc && provider) {
      newStatus = "connected";
    } else {
      newStatus = "connecting";
    }

    if (newStatus !== statusRef.current) {
      statusRef.current = newStatus;
      onStatusChange?.(newStatus);
    }
  }, [error, timedOut, isConnected, doc, provider, onStatusChange]);

  // ── providerFactory for CollaborationPlugin ─────────────────────
  // CollaborationPlugin calls this synchronously during render.
  // We capture doc and provider in a stable callback ref.
  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Doc>): Provider => {
      if (!doc || !provider) {
        // This should not happen because we only render CollaborationPlugin
        // when doc and provider are available, but satisfy the type.
        throw new Error("CRDT provider not ready");
      }
      yjsDocMap.set(id, doc);
      // HocuspocusProvider is structurally compatible with @lexical/yjs's
      // Provider interface: it has on/off/connect/disconnect/awareness.
      // The awareness type mismatch (Awareness vs ProviderAwareness) is
      // resolved by the structural compatibility of the getLocalState,
      // getStates, on, off, setLocalState, and setLocalStateField methods
      // that Awareness exposes.
      return provider as unknown as Provider;
    },
    [doc, provider],
  );

  // ── If errored or timed out, render nothing ─────────────────────
  if (error || timedOut) {
    return null;
  }

  // ── Wait for doc + provider to be ready ─────────────────────────
  if (!doc || !provider) {
    return null;
  }

  // ── Build the initialEditorState callback ───────────────────────
  // CollaborationPlugin's shouldBootstrap seeds the Yjs doc from the
  // initial Lexical state on the first client. We provide the
  // existing BlockDocument snapshot so the Yjs doc starts with the
  // current content rather than an empty document.
  const initialEditorState = snapshot
    ? (editor: import("lexical").LexicalEditor) => {
        const parsed = editor.parseEditorState(JSON.stringify(snapshot));
        editor.setEditorState(parsed);
      }
    : null;

  return (
    <CollaborationPlugin
      id={entryId}
      providerFactory={providerFactory}
      shouldBootstrap={true}
      initialEditorState={initialEditorState}
    />
  );
}

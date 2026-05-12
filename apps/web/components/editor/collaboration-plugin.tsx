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
 * Phase 6 refactor: the parent (EditorInner) now owns the
 * useRealtimeDocument hook call and passes doc, provider, isConnected,
 * and error as props. This avoids creating two providers (two WS
 * connections) and allows the parent to also pass awareness to the
 * PresenceAvatars component.
 *
 * Cursor rendering: the parent passes username, cursorColor, and
 * cursorsContainerRef. CollaborationPlugin renders cursors natively
 * via @lexical/yjs's awareness protocol + theme.collaboration CSS.
 */

import type React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import type { Provider } from "@lexical/yjs";
import type { Doc } from "yjs";
import type { HocuspocusProvider } from "@hocuspocus/provider";

// CursorsContainerRef type from @lexical/react (not re-exported from
// the public API, so we replicate the definition here).
type CursorsContainerRef = React.RefObject<HTMLElement | null>;

// ── Connection timeout (ms) ──────────────────────────────────────
const CONNECTION_TIMEOUT_MS = 5_000;

// ── Status type exposed to the parent ────────────────────────────
export type CollaborationStatus = "connecting" | "connected" | "error";

interface Props {
  entryId: string;
  snapshot: unknown;
  /** Y.Doc from useRealtimeDocument */
  doc: Doc | null;
  /** HocuspocusProvider from useRealtimeDocument */
  provider: HocuspocusProvider | null;
  /** Whether the WS connection is established */
  isConnected: boolean;
  /** Error message from the CRDT connection */
  connectionError: string | null;
  /** Display name for the remote cursor label */
  username?: string;
  /** HSL color string for the remote cursor */
  cursorColor?: string;
  /** Container ref for Lexical to portal cursor decorations into */
  cursorsContainerRef?: CursorsContainerRef;
  onStatusChange?: (status: CollaborationStatus) => void;
}

/**
 * Wraps doc + provider + Lexical CollaborationPlugin.
 *
 * Returns null (renders nothing) when the CRDT connection fails or
 * times out. The parent detects this via onStatusChange and mounts
 * the legacy AutosavePlugin instead.
 */
export function CollaborationPluginWrapper({
  entryId,
  snapshot,
  doc,
  provider,
  isConnected,
  connectionError,
  username,
  cursorColor,
  cursorsContainerRef,
  onStatusChange,
}: Props) {
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<CollaborationStatus>("connecting");

  // ── Connection timeout logic ────────────────────────────────────
  useEffect(() => {
    if (isConnected || connectionError) {
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
  }, [isConnected, connectionError, timedOut]);

  // ── Notify parent of status changes ─────────────────────────────
  useEffect(() => {
    let newStatus: CollaborationStatus;
    if (connectionError || timedOut) {
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
  }, [connectionError, timedOut, isConnected, doc, provider, onStatusChange]);

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
  if (connectionError || timedOut) {
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
      username={username}
      cursorColor={cursorColor}
      cursorsContainerRef={cursorsContainerRef}
    />
  );
}

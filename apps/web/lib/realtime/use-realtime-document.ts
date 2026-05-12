"use client";

/**
 * useRealtimeDocument: React hook for real-time collaborative editing
 * via a Hocuspocus CRDT WebSocket connection.
 *
 * On mount:
 *   1. POSTs to /api/crdt/token to get { token, wsUrl, documentName, expiresAt }.
 *   2. Creates a Y.Doc and HocuspocusProvider connected to the CRDT server.
 *   3. Wires y-indexeddb for offline recovery (edits survive tab close).
 *   4. Schedules proactive token refresh 30s before expiry.
 *
 * On unmount: destroys the provider, Y.Doc, IndexedDB persistence,
 * and clears the refresh timer.
 *
 * On auth failure or connection error: sets `error` so the consumer
 * can fall back to the legacy AutosavePlugin.
 *
 * Cross-platform note: this hook is web-specific (uses IndexedDB).
 * It lives in apps/web/lib/realtime/, NOT in packages/*.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import {
  HocuspocusProvider,
  WebSocketStatus,
} from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import { apiFetch } from "@/lib/api-client";

// Awareness type extracted from HocuspocusProvider to avoid a direct
// dependency on y-protocols (which pnpm does not hoist to the web app).
type Awareness = NonNullable<HocuspocusProvider["awareness"]>;

// ── Token endpoint response shape ────────────────────────────────
interface CrdtTokenResponse {
  token: string;
  wsUrl: string;
  documentName: string;
  expiresAt: string;
}

// ── Hook return type ─────────────────────────────────────────────
export interface RealtimeDocumentState {
  doc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  isConnected: boolean;
  error: string | null;
  awareness: Awareness | null;
}

// ── Token refresh safety margin (ms) ─────────────────────────────
const REFRESH_MARGIN_MS = 30_000; // 30 seconds before expiry

export function useRealtimeDocument(entryId: string): RealtimeDocumentState {
  const [state, setState] = useState<RealtimeDocumentState>({
    doc: null,
    provider: null,
    isConnected: false,
    error: null,
    awareness: null,
  });

  // Refs for cleanup and token refresh scheduling
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const idbRef = useRef<IndexeddbPersistence | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // Track the latest token response for refresh scheduling
  const latestTokenRef = useRef<CrdtTokenResponse | null>(null);

  // ── Fetch a CRDT token from the web app ─────────────────────────
  const fetchToken = useCallback(async (): Promise<CrdtTokenResponse> => {
    return apiFetch<CrdtTokenResponse>("/api/crdt/token", {
      method: "POST",
      body: JSON.stringify({ entryId }),
    });
  }, [entryId]);

  // ── Schedule proactive token refresh ────────────────────────────
  const scheduleRefresh = useCallback(
    (expiresAt: string) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      const expiryMs = new Date(expiresAt).getTime();
      const delayMs = expiryMs - Date.now() - REFRESH_MARGIN_MS;

      if (delayMs <= 0) {
        // Token is already near expiry or expired; refresh immediately
        void doRefresh();
        return;
      }

      refreshTimerRef.current = setTimeout(() => {
        void doRefresh();
      }, delayMs);
    },
    // doRefresh is defined below; both are stable via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Perform the token refresh ───────────────────────────────────
  const doRefresh = useCallback(async () => {
    if (!mountedRef.current || !providerRef.current) return;

    try {
      const tokenResponse = await fetchToken();
      latestTokenRef.current = tokenResponse;

      // Update the provider's token configuration and trigger re-auth.
      // HocuspocusProvider accepts token as string | (() => string) | (() => Promise<string>) | null.
      // We set the raw string and call sendToken() to re-authenticate
      // on the existing connection without a full reconnect.
      providerRef.current.setConfiguration({
        token: tokenResponse.token,
      });
      await providerRef.current.sendToken();

      // Schedule the next refresh
      if (mountedRef.current) {
        scheduleRefresh(tokenResponse.expiresAt);
      }
    } catch (err) {
      // Token refresh failure is non-fatal for the current session.
      // The connection will eventually fail when the old token expires
      // and the server rejects the stale auth. At that point, the
      // provider's authenticationFailed handler fires and sets the error.
      console.warn(
        "[useRealtimeDocument] Token refresh failed; connection will degrade on expiry:",
        err,
      );
    }
  }, [fetchToken, scheduleRefresh]);

  // ── Main effect: bootstrap provider on mount / entryId change ───
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function bootstrap() {
      try {
        // 1. Fetch the initial CRDT token
        const tokenResponse = await fetchToken();
        if (cancelled) return;
        latestTokenRef.current = tokenResponse;

        // 2. Create a Y.Doc
        const ydoc = new Y.Doc();
        docRef.current = ydoc;

        // 3. Wire y-indexeddb for offline recovery
        const idb = new IndexeddbPersistence(
          tokenResponse.documentName,
          ydoc,
        );
        idbRef.current = idb;

        // 4. Create the HocuspocusProvider
        const provider = new HocuspocusProvider({
          url: tokenResponse.wsUrl,
          name: tokenResponse.documentName,
          document: ydoc,
          token: tokenResponse.token,
          // Do not auto-connect until after we wire event listeners
          // (the constructor does auto-connect by default; listeners
          // are wired synchronously below so this is safe).
        });
        providerRef.current = provider;

        // 5. Wire connection state tracking
        provider.on("status", ({ status }: { status: WebSocketStatus }) => {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              isConnected: status === WebSocketStatus.Connected,
            }));
          }
        });

        provider.on(
          "authenticationFailed",
          ({ reason }: { reason: string }) => {
            if (!cancelled) {
              console.error(
                "[useRealtimeDocument] Authentication failed:",
                reason,
              );
              setState((prev) => ({
                ...prev,
                error: `CRDT authentication failed: ${reason}`,
                isConnected: false,
              }));
            }
          },
        );

        // 6. Expose the provider and doc to consumers
        if (!cancelled) {
          setState({
            doc: ydoc,
            provider,
            isConnected: false, // Will update via status event
            error: null,
            awareness: provider.awareness ?? null,
          });
        }

        // 7. Schedule proactive token refresh
        scheduleRefresh(tokenResponse.expiresAt);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to connect to CRDT server";
          console.error("[useRealtimeDocument] Bootstrap failed:", err);
          setState({
            doc: null,
            provider: null,
            isConnected: false,
            error: message,
            awareness: null,
          });
        }
      }
    }

    void bootstrap();

    // ── Cleanup ─────────────────────────────────────────────────────
    return () => {
      cancelled = true;
      mountedRef.current = false;

      // Clear the refresh timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      // Destroy the provider (disconnects WS, cleans up event listeners)
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }

      // Destroy IndexedDB persistence
      if (idbRef.current) {
        // IndexeddbPersistence.destroy() returns a Promise; fire-and-forget
        // since we're in a synchronous cleanup.
        void idbRef.current.destroy();
        idbRef.current = null;
      }

      // Destroy the Y.Doc
      if (docRef.current) {
        docRef.current.destroy();
        docRef.current = null;
      }

      // Reset state
      setState({
        doc: null,
        provider: null,
        isConnected: false,
        error: null,
        awareness: null,
      });
    };
  }, [entryId, fetchToken, scheduleRefresh]);

  return state;
}

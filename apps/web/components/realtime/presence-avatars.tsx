"use client";

/**
 * PresenceAvatars: renders a horizontally-stacked list of avatars
 * representing connected clients other than the current user.
 *
 * Subscribes to the Yjs awareness protocol events (change, update)
 * and re-renders when the set of connected clients changes.
 *
 * Each avatar shows the user's initials inside a colored ring that
 * matches their cursor color. Tooltip on hover shows the full name.
 *
 * Accessibility:
 *   - role="group" with aria-label="Active editors"
 *   - Each avatar has aria-label="{name} is editing"
 *
 * Returns null when awareness is null, currentUserId is null,
 * or there are no other connected clients.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Awareness type: same approach as use-realtime-document.ts to avoid
// a direct dependency on y-protocols.
interface AwarenessState {
  name?: string;
  color?: string;
  userId?: string;
  [key: string]: unknown;
}

interface AwarenessLike {
  clientID: number;
  getStates(): Map<number, AwarenessState>;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
}

interface ConnectedClient {
  clientID: number;
  name: string;
  color: string;
  initials: string;
}

const MAX_VISIBLE_AVATARS = 5;

/**
 * Extract up to two initials from a display name.
 * Falls back to "?" if the name is empty or undefined.
 */
function getInitials(name: string | undefined): string {
  if (!name || name.trim().length === 0) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Collect all remote clients from awareness, filtering out the
 * local client by clientID.
 */
function collectRemoteClients(
  awareness: AwarenessLike,
): ConnectedClient[] {
  const localClientID = awareness.clientID;
  const clients: ConnectedClient[] = [];
  const states = awareness.getStates();

  states.forEach((state, clientID) => {
    if (clientID === localClientID) return;
    if (!state || Object.keys(state).length === 0) return;

    const name = (state.name as string) || "Anonymous";
    const color = (state.color as string) || "hsl(0, 70%, 55%)";
    clients.push({
      clientID,
      name,
      color,
      initials: getInitials(name),
    });
  });

  return clients;
}

export function PresenceAvatars({
  awareness,
  currentUserId,
}: {
  awareness: AwarenessLike | null;
  currentUserId: string | null;
}) {
  const [clients, setClients] = useState<ConnectedClient[]>([]);

  const syncClients = useCallback(() => {
    if (!awareness) {
      setClients([]);
      return;
    }
    setClients(collectRemoteClients(awareness));
  }, [awareness]);

  useEffect(() => {
    if (!awareness) return;

    // Initial sync
    syncClients();

    // Subscribe to awareness changes
    const handler = () => syncClients();
    awareness.on("change", handler);
    awareness.on("update", handler);

    return () => {
      awareness.off("change", handler);
      awareness.off("update", handler);
    };
  }, [awareness, syncClients]);

  // Don't render when there's nothing to show
  if (!awareness || !currentUserId || clients.length === 0) {
    return null;
  }

  const visible = clients.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = clients.length - MAX_VISIBLE_AVATARS;

  return (
    <TooltipProvider>
      <div
        role="group"
        aria-label="Active editors"
        className="flex items-center"
      >
        {visible.map((client) => (
          <Tooltip key={client.clientID}>
            <TooltipTrigger
              aria-label={`${client.name} is editing`}
              className="relative -ml-2 first:ml-0 flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white select-none cursor-default"
              style={{
                backgroundColor: client.color,
                boxShadow: `0 0 0 2px var(--color-background, white)`,
              }}
            >
              {client.initials}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {client.name} is editing
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <div
            aria-label={`${overflow} more editor${overflow > 1 ? "s" : ""}`}
            className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground select-none"
            style={{
              boxShadow: `0 0 0 2px var(--color-background, white)`,
            }}
          >
            +{overflow}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

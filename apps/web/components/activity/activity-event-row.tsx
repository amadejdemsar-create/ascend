"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { getUserColor } from "@/lib/realtime/awareness-color";
import type { ActivityEventItem } from "@/lib/hooks/use-activity";
import type {
  NodeCreatedPayload,
  NodeDeletedPayload,
  NodeUpdatedPayload,
  NodeRestoredPayload,
  NodeBranchedPayload,
  LinkCreatedPayload,
  LinkRemovedPayload,
  MemberAddedPayload,
  MemberRemovedPayload,
  MemberRoleChangedPayload,
  WorkspaceCreatedPayload,
} from "@/lib/validations";

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Build a deep-link URL to the entity detail panel based on node type.
 *
 * Context entries (NOTE, SOURCE, PROJECT, etc.), databases, and database
 * rows all live at `/context?id=<nodeId>`. Goals use `/goals?id=<nodeId>`.
 * Todos use `/todos?id=<nodeId>`. The `?id=` param is consumed by
 * `useSelectionSync` on each page, which opens the detail panel for the
 * specified entity.
 */
function entityPath(
  nodeType: string,
  nodeId: string,
): string | null {
  switch (nodeType) {
    case "CONTEXT_ENTRY":
    case "NOTE":
    case "SOURCE":
    case "PROJECT":
    case "PERSON":
    case "DECISION":
    case "QUESTION":
    case "AREA":
    case "DATABASE":
    case "DATABASE_ROW":
      return `/context?id=${encodeURIComponent(nodeId)}`;
    case "GOAL":
      return `/goals?id=${encodeURIComponent(nodeId)}`;
    case "TODO":
      return `/todos?id=${encodeURIComponent(nodeId)}`;
    default:
      return null;
  }
}

function nodeTypeLabel(nodeType: string): string {
  switch (nodeType) {
    case "CONTEXT_ENTRY":
      return "entry";
    case "GOAL":
      return "goal";
    case "TODO":
      return "todo";
    case "DATABASE":
      return "database";
    case "DATABASE_ROW":
      return "row";
    default:
      return nodeType.toLowerCase();
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Component ────────────────────────────────────────────────────────

interface ActivityEventRowProps {
  event: ActivityEventItem;
}

export function ActivityEventRow({ event }: ActivityEventRowProps) {
  const displayName = event.actorDisplayName ?? "Unknown";
  const color = event.userId ? getUserColor(event.userId) : "hsl(0, 0%, 50%)";
  const timestamp = formatDistanceToNow(new Date(event.createdAt), {
    addSuffix: true,
  });

  return (
    <div className="flex items-start gap-3 py-2.5 px-1">
      {/* Avatar */}
      <div
        className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium text-white select-none"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {initials(displayName)}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 text-sm">
        <span className="font-medium text-foreground">{displayName}</span>{" "}
        <VerbFragment event={event} />
      </div>

      {/* Timestamp */}
      <span
        className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap mt-0.5"
        title={new Date(event.createdAt).toLocaleString()}
      >
        {timestamp}
      </span>
    </div>
  );
}

// ── Verb renderer ────────────────────────────────────────────────────

function VerbFragment({ event }: { event: ActivityEventItem }) {
  const payload = event.payload;

  switch (event.eventType) {
    case "NODE_CREATED": {
      const p = payload as NodeCreatedPayload;
      const path = entityPath(p.nodeType, p.nodeId);
      return (
        <span className="text-muted-foreground">
          created {nodeTypeLabel(p.nodeType)}{" "}
          {path ? (
            <Link
              href={path}
              className="font-medium text-foreground hover:underline"
            >
              &ldquo;{p.title}&rdquo;
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              &ldquo;{p.title}&rdquo;
            </span>
          )}
        </span>
      );
    }

    case "NODE_DELETED": {
      const p = payload as NodeDeletedPayload;
      return (
        <span className="text-muted-foreground">
          deleted {nodeTypeLabel(p.nodeType)}{" "}
          <span className="font-medium text-foreground">
            &ldquo;{p.title}&rdquo;
          </span>
        </span>
      );
    }

    case "NODE_UPDATED": {
      const p = payload as NodeUpdatedPayload;
      const path = entityPath(p.nodeType, p.nodeId);
      return (
        <span className="text-muted-foreground">
          updated {nodeTypeLabel(p.nodeType)}{" "}
          {path ? (
            <Link
              href={path}
              className="font-medium text-foreground hover:underline"
            >
              &ldquo;{p.title}&rdquo;
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              &ldquo;{p.title}&rdquo;
            </span>
          )}
          {p.summary && (
            <span className="text-xs text-muted-foreground">
              {" "}
              ({p.summary})
            </span>
          )}
        </span>
      );
    }

    case "NODE_RESTORED": {
      const p = payload as NodeRestoredPayload;
      const path = entityPath(p.nodeType, p.nodeId);
      return (
        <span className="text-muted-foreground">
          restored{" "}
          {path ? (
            <Link
              href={path}
              className="font-medium text-foreground hover:underline"
            >
              &ldquo;{p.title}&rdquo;
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              &ldquo;{p.title}&rdquo;
            </span>
          )}{" "}
          from a previous version
        </span>
      );
    }

    case "NODE_BRANCHED": {
      const p = payload as NodeBranchedPayload;
      const sourcePath = entityPath(p.sourceNodeType, p.sourceNodeId);
      const newPath = entityPath(p.sourceNodeType, p.newNodeId);
      return (
        <span className="text-muted-foreground">
          branched{" "}
          {sourcePath ? (
            <Link
              href={sourcePath}
              className="font-medium text-foreground hover:underline"
            >
              source
            </Link>
          ) : (
            <span className="font-medium text-foreground">source</span>
          )}{" "}
          to{" "}
          {newPath ? (
            <Link
              href={newPath}
              className="font-medium text-foreground hover:underline"
            >
              &ldquo;{p.title}&rdquo;
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              &ldquo;{p.title}&rdquo;
            </span>
          )}
        </span>
      );
    }

    case "LINK_CREATED": {
      const p = payload as LinkCreatedPayload;
      const fromLabel = p.fromTitle ?? "entry";
      const toLabel = p.toTitle ?? "entry";
      const fromPath = entityPath("CONTEXT_ENTRY", p.fromEntryId);
      const toPath = entityPath("CONTEXT_ENTRY", p.toEntryId);
      return (
        <span className="text-muted-foreground">
          linked{" "}
          {fromPath ? (
            <Link
              href={fromPath}
              className="font-medium text-foreground hover:underline"
            >
              &ldquo;{fromLabel}&rdquo;
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              &ldquo;{fromLabel}&rdquo;
            </span>
          )}{" "}
          to{" "}
          {toPath ? (
            <Link
              href={toPath}
              className="font-medium text-foreground hover:underline"
            >
              &ldquo;{toLabel}&rdquo;
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              &ldquo;{toLabel}&rdquo;
            </span>
          )}{" "}
          <span className="text-xs">({p.linkType})</span>
        </span>
      );
    }

    case "LINK_REMOVED": {
      const p = payload as LinkRemovedPayload;
      const fromLabel = p.fromTitle ?? "entry";
      const toLabel = p.toTitle ?? "entry";
      const fromPath = entityPath("CONTEXT_ENTRY", p.fromEntryId);
      const toPath = entityPath("CONTEXT_ENTRY", p.toEntryId);
      return (
        <span className="text-muted-foreground">
          unlinked{" "}
          {fromPath ? (
            <Link
              href={fromPath}
              className="font-medium text-foreground hover:underline"
            >
              &ldquo;{fromLabel}&rdquo;
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              &ldquo;{fromLabel}&rdquo;
            </span>
          )}{" "}
          from{" "}
          {toPath ? (
            <Link
              href={toPath}
              className="font-medium text-foreground hover:underline"
            >
              &ldquo;{toLabel}&rdquo;
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              &ldquo;{toLabel}&rdquo;
            </span>
          )}{" "}
          <span className="text-xs">({p.linkType})</span>
        </span>
      );
    }

    case "MEMBER_ADDED": {
      const p = payload as MemberAddedPayload;
      return (
        <span className="text-muted-foreground">
          added{" "}
          <span className="font-medium text-foreground">
            {p.memberDisplayName}
          </span>
          {p.role ? ` as ${p.role}` : ""}
        </span>
      );
    }

    case "MEMBER_REMOVED": {
      const p = payload as MemberRemovedPayload;
      return (
        <span className="text-muted-foreground">
          removed{" "}
          <span className="font-medium text-foreground">
            {p.memberDisplayName}
          </span>
        </span>
      );
    }

    case "MEMBER_ROLE_CHANGED": {
      const p = payload as MemberRoleChangedPayload;
      return (
        <span className="text-muted-foreground">
          changed{" "}
          <span className="font-medium text-foreground">
            {p.memberDisplayName}
          </span>
          &apos;s role to {p.role}
        </span>
      );
    }

    case "WORKSPACE_CREATED": {
      const p = payload as WorkspaceCreatedPayload;
      return (
        <span className="text-muted-foreground">
          created workspace{" "}
          <span className="font-medium text-foreground">
            {p.workspaceName}
          </span>
        </span>
      );
    }

    default:
      return (
        <span className="text-muted-foreground">
          performed an action
        </span>
      );
  }
}

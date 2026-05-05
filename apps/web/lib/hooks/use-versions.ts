"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/queries/keys";
import type { NodeType, ListVersionsQuery } from "@/lib/validations";
import type { DiffResult } from "@ascend/diff";

// ---------------------------------------------------------------------------
// Response types (mirror the API route JSON shapes)
// ---------------------------------------------------------------------------

export interface VersionListItem {
  id: string;
  versionNumber: number;
  trigger: string;
  byteSize: number;
  createdAt: string;
  parentVersionId: string | null;
}

export interface VersionListResponse {
  versions: VersionListItem[];
  nextCursor: string | null;
}

export interface VersionDetailResponse {
  id: string;
  userId: string;
  nodeType: string;
  nodeId: string;
  versionNumber: number;
  payload: Record<string, unknown>;
  contentHash: string;
  byteSize: number;
  trigger: string;
  parentVersionId: string | null;
  createdAt: string;
}

export interface RestoreResult {
  restoredVersionId: string;
  newVersionId: string | null;
  warnings: string[];
}

export interface RestorePreview {
  previewPayload: Record<string, unknown>;
  warnings: string[];
}

export interface BranchResult {
  newNodeId: string;
  newVersionId: string | null;
  derivedFromLinkId: string;
  warning?: string;
}

export interface GraphAtResponse {
  nodes: unknown[];
  edges: unknown[];
  source: "live" | "snapshot";
  snapshotDate?: string;
}

// ---------------------------------------------------------------------------
// Mutation variable types
// ---------------------------------------------------------------------------

export interface RestoreVars {
  versionId: string;
  dryRun?: boolean;
  /** Required for cross-domain cache invalidation after restore */
  nodeType: NodeType;
  /** Required for targeted version list invalidation */
  nodeId: string;
  /** For DATABASE_ROW/DATABASE_FIELD, the parent databaseId for cache invalidation */
  databaseId?: string;
}

export interface BranchVars {
  versionId: string;
  title: string;
  /** Required for cross-domain cache invalidation */
  nodeType: NodeType;
  /** Required for version list invalidation on the source node */
  nodeId: string;
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch the paginated version history for a specific node.
 *
 * Returns versions in reverse chronological order (newest first).
 * 5min staleTime: the only freshness concern is whether new versions have
 * been appended, not the content of existing immutable versions.
 */
export function useVersions(
  nodeType: NodeType,
  nodeId: string,
  opts?: ListVersionsQuery,
) {
  const params = new URLSearchParams();
  if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();

  return useQuery<VersionListResponse>({
    queryKey: queryKeys.versions.list(nodeType, nodeId),
    queryFn: () =>
      apiFetch<VersionListResponse>(
        `/api/versions/${nodeType}/${nodeId}${qs ? `?${qs}` : ""}`,
      ),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!nodeType && !!nodeId,
  });
}

/**
 * Fetch a single version by ID, including the full payload.
 *
 * 1h staleTime: versions are immutable once written.
 * Conditional: disabled when versionId is null/undefined.
 */
export function useVersion(versionId: string | null | undefined) {
  return useQuery<VersionDetailResponse>({
    queryKey: versionId
      ? queryKeys.versions.detail(versionId)
      : (["versions", "detail", "_disabled"] as const),
    queryFn: () => {
      if (!versionId) throw new Error("versionId required");
      return apiFetch<VersionDetailResponse>(`/api/versions/${versionId}`);
    },
    staleTime: 60 * 60 * 1000, // 1 hour (immutable)
    enabled: !!versionId,
  });
}

/**
 * Diff two versions (or a version against the current live state).
 *
 * Uses POST despite being a "read" operation because the diff payload can
 * be large. 1h staleTime because both version payloads are immutable.
 *
 * Conditional: disabled when args is null or toVersionId is missing.
 */
export function useDiff(
  args: { fromVersionId: string | null; toVersionId: string } | null,
) {
  return useQuery<DiffResult>({
    queryKey:
      args
        ? queryKeys.versions.diff(args.fromVersionId, args.toVersionId)
        : (["versions", "diff", "_disabled"] as const),
    queryFn: () => {
      if (!args) throw new Error("diff args required");
      return apiFetch<DiffResult>("/api/versions/diff", {
        method: "POST",
        body: JSON.stringify({
          fromVersionId: args.fromVersionId,
          toVersionId: args.toVersionId,
        }),
      });
    },
    staleTime: 60 * 60 * 1000, // 1 hour (immutable version payloads)
    enabled: !!args && !!args.toVersionId,
  });
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/**
 * Restore a node to a historical version.
 *
 * Cross-domain invalidation varies by nodeType. The caller must pass
 * nodeType, nodeId (and optionally databaseId for DB_ROW/DB_FIELD) in
 * the mutation variables so onSuccess can target the right caches.
 */
export function useRestore() {
  const queryClient = useQueryClient();

  return useMutation<RestoreResult | RestorePreview, Error, RestoreVars>({
    mutationFn: ({ versionId, dryRun }) =>
      apiFetch<RestoreResult | RestorePreview>("/api/versions/restore", {
        method: "POST",
        body: JSON.stringify({ versionId, dryRun }),
      }),
    onSuccess: (data, { nodeType, nodeId, databaseId, dryRun }) => {
      // Dry-run responses are previews; no cache invalidation needed.
      if (dryRun) return;

      // A RESTORE-triggered snapshot was added to the version history.
      queryClient.invalidateQueries({
        queryKey: queryKeys.versions.list(nodeType, nodeId),
      });

      // Per-nodeType entity cache invalidation.
      switch (nodeType) {
        case "CONTEXT_ENTRY":
          queryClient.invalidateQueries({
            queryKey: queryKeys.context.detail(nodeId),
          });
          queryClient.invalidateQueries({ queryKey: ["context", "list"] });
          queryClient.invalidateQueries({ queryKey: ["context", "search"] });
          // Block document may have been reverted.
          queryClient.invalidateQueries({
            queryKey: queryKeys.context.blocks(nodeId),
          });
          break;

        case "GOAL":
          queryClient.invalidateQueries({
            queryKey: queryKeys.goals.detail(nodeId),
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.goals.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
          break;

        case "TODO":
          queryClient.invalidateQueries({
            queryKey: queryKeys.todos.detail(nodeId),
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.todos.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
          break;

        case "DATABASE_ROW":
          if (databaseId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.databases.rows(databaseId),
            });
          }
          // Rows ARE ContextEntries; list and search caches must refresh.
          queryClient.invalidateQueries({ queryKey: ["context", "list"] });
          queryClient.invalidateQueries({ queryKey: ["context", "search"] });
          queryClient.invalidateQueries({
            queryKey: queryKeys.context.detail(nodeId),
          });
          break;

        case "DATABASE_FIELD":
          if (databaseId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.databases.fields(databaseId),
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.databases.detail(databaseId),
            });
          }
          break;
      }

      // Graph may reflect changed node payload regardless of type.
      queryClient.invalidateQueries({ queryKey: ["context", "graph"] });

      // Surface warnings via toast if present.
      const result = data as RestoreResult;
      if (result.warnings && result.warnings.length > 0) {
        toast.success("Version restored", {
          description: result.warnings.join(" "),
        });
      } else {
        toast.success("Version restored");
      }
    },
  });
}

/**
 * Branch (fork) a node from a specific historical version.
 *
 * Creates a new entity populated from the version's payload and links it
 * back to the source via a DERIVED_FROM edge.
 *
 * The caller must pass nodeType and nodeId for cross-domain invalidation.
 */
export function useBranch() {
  const queryClient = useQueryClient();

  return useMutation<BranchResult, Error, BranchVars>({
    mutationFn: ({ versionId, title }) =>
      apiFetch<BranchResult>("/api/versions/branch", {
        method: "POST",
        body: JSON.stringify({ versionId, title }),
      }),
    onSuccess: (result, { nodeType, nodeId }) => {
      // Source node got a new outgoing DERIVED_FROM link captured in versions.
      queryClient.invalidateQueries({
        queryKey: queryKeys.versions.list(nodeType, nodeId),
      });

      // A new ContextEntry was created.
      queryClient.invalidateQueries({ queryKey: ["context", "list"] });
      queryClient.invalidateQueries({ queryKey: ["context", "search"] });

      // A new DERIVED_FROM ContextLink was created.
      queryClient.invalidateQueries({
        queryKey: queryKeys.context.links.all(),
      });

      // New node + new edge in the graph.
      queryClient.invalidateQueries({ queryKey: ["context", "graph"] });

      // Success toast with the new node ID for navigation.
      if (result.warning) {
        toast.success("Branched successfully", {
          description: result.warning,
        });
      } else {
        toast.success("Branched successfully");
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Graph Time-Travel Hook
// ---------------------------------------------------------------------------

/**
 * Fetch the context graph as it existed at a specific historical date.
 *
 * Disabled when date is null (the UI falls back to the live useContextGraph).
 * 24h staleTime: daily snapshots are immutable once computed.
 *
 * The endpoint returns:
 * - 200 with `{ nodes, edges, source: "live"|"snapshot" }` on success.
 * - 404 when no snapshot exists for the date (within retention window).
 * - 410 when the date is outside the 90-day retention window.
 *
 * apiFetch throws Error on non-2xx; the error message will be the server's
 * JSON error field, which is human-readable for direct UI rendering.
 */
export function useGraphAt(date: string | null) {
  return useQuery<GraphAtResponse>({
    queryKey: date
      ? queryKeys.context.graphAt(date)
      : (["context", "graph", "at", "_disabled"] as const),
    queryFn: () => {
      if (!date) throw new Error("date required");
      return apiFetch<GraphAtResponse>(`/api/graph/at?date=${date}`);
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours (snapshots are immutable)
    enabled: !!date,
    retry: false, // 404/410 are expected responses, not transient failures
  });
}

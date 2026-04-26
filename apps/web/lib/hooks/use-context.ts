"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch as fetchJson } from "@/lib/api-client";
import type {
  ContextFilters,
  ContextGraphFilters,
  CreateContextInput,
  CreateContextLinkInput,
  UpdateContextInput,
  UpdateContextLinkInput,
} from "@/lib/validations";
import type {
  ContextEntryType,
  ContextLinkType,
} from "@ascend/core";

// --- Response types for graph endpoints ---

export interface ContextGraphNode {
  id: string;
  title: string;
  type: ContextEntryType;
  isPinned: boolean;
  outgoingCount: number;
  incomingCount: number;
}

export interface ContextGraphEdge {
  id: string;
  fromId: string;
  toId: string;
  type: ContextLinkType;
}

export interface ContextGraphResponse {
  nodes: ContextGraphNode[];
  edges: ContextGraphEdge[];
}

export interface ContextNeighborsResponse {
  nodes: Array<{
    id: string;
    title: string;
    type: ContextEntryType;
    isPinned: boolean;
  }>;
  edges: ContextGraphEdge[];
}

export interface RelatedContextItem {
  id: string;
  title: string;
  type: ContextEntryType;
  score: number;
}

export interface ContextLink {
  id: string;
  userId: string;
  fromEntryId: string;
  toEntryId: string;
  type: ContextLinkType;
  source: "CONTENT" | "MANUAL";
  createdAt: string;
  updatedAt: string;
}

// --- Query Hooks ---

export function useContextEntries(filters?: ContextFilters) {
  return useQuery({
    queryKey: queryKeys.context.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.categoryId) params.set("categoryId", filters.categoryId);
      if (filters?.tag) params.set("tag", filters.tag);
      const qs = params.toString();
      return fetchJson<unknown[]>(`/api/context${qs ? `?${qs}` : ""}`);
    },
  });
}

export function useContextEntry(id: string) {
  return useQuery({
    queryKey: queryKeys.context.detail(id),
    queryFn: () => fetchJson(`/api/context/${id}`),
    enabled: !!id,
  });
}

export interface ContextSearchResult {
  id: string;
  title: string;
  content: string;
  tags: string[];
  type: string;
  isPinned: boolean;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
  score: number;
  matchedVia: "text" | "semantic" | "both";
}

export function useSearchContext(
  query: string,
  opts?: { mode?: "text" | "semantic" | "hybrid" },
) {
  const mode = opts?.mode ?? "hybrid";
  return useQuery({
    queryKey: queryKeys.context.search(query, mode),
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("q", query);
      if (mode !== "hybrid") params.set("mode", mode);
      return fetchJson<ContextSearchResult[]>(
        `/api/context/search?${params.toString()}`,
      );
    },
    enabled: query.length > 0,
  });
}

// --- Graph Query Hooks ---

export function useContextGraph(filters?: ContextGraphFilters) {
  return useQuery({
    queryKey: queryKeys.context.graph(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.types && filters.types.length > 0)
        params.set("types", filters.types.join(","));
      if (filters?.categoryId) params.set("categoryId", filters.categoryId);
      if (filters?.tag) params.set("tag", filters.tag);
      if (filters?.cap != null) params.set("cap", String(filters.cap));
      const qs = params.toString();
      return fetchJson<ContextGraphResponse>(
        `/api/context/graph${qs ? `?${qs}` : ""}`,
      );
    },
  });
}

export function useNodeNeighbors(
  id: string | null | undefined,
  depth: number,
) {
  return useQuery({
    queryKey: queryKeys.context.neighbors(id ?? "", depth),
    queryFn: () =>
      fetchJson<ContextNeighborsResponse>(
        `/api/context/${id}/neighbors?depth=${depth}`,
      ),
    enabled: !!id,
  });
}

export function useRelatedContext(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.context.related(id ?? ""),
    queryFn: () =>
      fetchJson<RelatedContextItem[]>(`/api/context/${id}/related`),
    enabled: !!id,
  });
}

// --- Mutation Hooks ---

export function useCreateContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateContextInput) =>
      fetchJson("/api/context", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
    },
  });
}

export function useUpdateContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContextInput }) =>
      fetchJson(`/api/context/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.context.detail(id) });
    },
  });
}

export function useDeleteContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/context/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
    },
  });
}

export function useTogglePin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned?: boolean }) =>
      fetchJson(`/api/context/${id}/pin`, {
        method: "PATCH",
        body: JSON.stringify(typeof isPinned === "boolean" ? { isPinned } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
    },
  });
}

// --- Context Link Mutation Hooks ---

/**
 * Invalidate all graph, neighbor, and link caches for both endpoints of a link.
 * Shared by create, update, and delete link mutations.
 */
function invalidateLinkCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  fromEntryId: string,
  toEntryId: string,
) {
  // Graph changed (prefix match catches all filter variants)
  queryClient.invalidateQueries({ queryKey: ["context", "graph"] });
  // Both endpoint detail caches
  queryClient.invalidateQueries({
    queryKey: queryKeys.context.detail(fromEntryId),
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.context.detail(toEntryId),
  });
  // Links for both endpoints
  queryClient.invalidateQueries({
    queryKey: queryKeys.context.links.forEntry(fromEntryId),
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.context.links.forEntry(toEntryId),
  });
  // Neighbors for both endpoints (prefix match catches all depths)
  queryClient.invalidateQueries({
    queryKey: ["context", "neighbors", fromEntryId],
  });
  queryClient.invalidateQueries({
    queryKey: ["context", "neighbors", toEntryId],
  });
  // Related context for both endpoints
  queryClient.invalidateQueries({
    queryKey: queryKeys.context.related(fromEntryId),
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.context.related(toEntryId),
  });
}

export function useCreateContextLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateContextLinkInput) =>
      fetchJson<ContextLink>("/api/context-links", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (result) => {
      invalidateLinkCaches(queryClient, result.fromEntryId, result.toEntryId);
    },
  });
}

export function useUpdateContextLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      fromEntryId: string;
      toEntryId: string;
      data: UpdateContextLinkInput;
    }) =>
      fetchJson<ContextLink>(`/api/context-links/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, variables) => {
      invalidateLinkCaches(
        queryClient,
        variables.fromEntryId,
        variables.toEntryId,
      );
    },
  });
}

export function useDeleteContextLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      fromEntryId: _from,
      toEntryId: _to,
      force,
    }: {
      id: string;
      fromEntryId: string;
      toEntryId: string;
      force?: boolean;
    }) => {
      const params = force ? "?force=true" : "";
      return fetchJson<void>(`/api/context-links/${id}${params}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_result, variables) => {
      invalidateLinkCaches(
        queryClient,
        variables.fromEntryId,
        variables.toEntryId,
      );
    },
  });
}

// --- Context Type Mutation Hook ---

export function useUpdateContextType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: ContextEntryType }) =>
      fetchJson(`/api/context/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ type }),
      }),
    onSuccess: (_result, { id }) => {
      // Entry moved between type buckets; invalidate all list and type queries
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.context.detail(id),
      });
      // Graph positions and colors may change
      queryClient.invalidateQueries({ queryKey: ["context", "graph"] });
      // We do not know the old type from the mutation, so invalidate all byType
      // queries via prefix match (covers both old and new type buckets)
      queryClient.invalidateQueries({ queryKey: ["context", "byType"] });
    },
  });
}

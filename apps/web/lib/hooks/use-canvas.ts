"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";
import type {
  CreateCanvasLayoutInput,
  UpdateCanvasLayoutInput,
  UpsertCanvasNodesBody,
  CanvasImportBody,
  CanvasViewport,
  ExcalidrawScene,
} from "@/lib/validations";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types (HTTP wire shape; mirrors the API route response payloads).
// ---------------------------------------------------------------------------

export interface CanvasLayoutListItem {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  viewport: CanvasViewport;
  createdAt: string;
  updatedAt: string;
  _count: { nodes: number };
}

export interface CanvasNodeItem {
  id: string;
  canvasLayoutId: string;
  contextEntryId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  excalidrawElementId: string;
  createdAt: string;
  updatedAt: string;
  /** Denormalized from ContextEntry for inline card rendering (Phase 5). */
  contextEntry?: {
    id: string;
    title: string;
    type: string;
    isPinned: boolean;
    tags: string[];
  };
}

export interface CanvasLayoutDetail {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  slug: string;
  isDefault: boolean;
  viewport: CanvasViewport;
  canvas: ExcalidrawScene;
  createdAt: string;
  updatedAt: string;
  nodes: CanvasNodeItem[];
}

interface ListResponse {
  layouts: CanvasLayoutListItem[];
}
interface DetailResponse {
  layout: CanvasLayoutDetail;
  nodes: CanvasNodeItem[];
}
interface UpsertNodesResponse {
  nodes: CanvasNodeItem[];
  inserted: number;
  updated: number;
  removed: number;
}
interface ImportResponse {
  layout: CanvasLayoutDetail;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List the user's canvas layouts in the current workspace. Excludes the
 * `canvas` blob; use useCanvasLayout for the full scene.
 */
export function useCanvasLayouts() {
  return useQuery({
    queryKey: queryKeys.canvas.layouts(),
    queryFn: async () => {
      const res = await apiFetch<ListResponse>("/api/canvas/layouts");
      return res.layouts;
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch one layout with the full Excalidraw scene + nodes.
 * Disabled when id is null.
 */
export function useCanvasLayout(id: string | null) {
  return useQuery({
    queryKey: queryKeys.canvas.layout(id),
    queryFn: () =>
      apiFetch<DetailResponse>(`/api/canvas/layouts/${id}`),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch the user's default canvas layout, lazily creating "Personal"
 * on first visit. Used by the canvas view on initial mount when no
 * `canvasActiveLayoutId` is persisted yet.
 */
export function useDefaultCanvasLayout(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.canvas.layout("__default__"),
    queryFn: () =>
      apiFetch<DetailResponse>("/api/canvas/layouts/default"),
    enabled,
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCanvasLayoutInput) =>
      apiFetch<{ layout: CanvasLayoutDetail }>("/api/canvas/layouts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.canvas.layouts() });
      qc.invalidateQueries({ queryKey: queryKeys.activity.all() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateCanvasLayoutInput;
    }) =>
      apiFetch<{ layout: CanvasLayoutDetail }>(
        `/api/canvas/layouts/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.canvas.layout(id) });
      // The list endpoint excludes the canvas blob; opportunistic
      // refetch on next list mount is sufficient. Skip the list
      // invalidation for autosave-heavy update flows.
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/canvas/layouts/${id}`, { method: "DELETE" }),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.canvas.layouts() });
      qc.removeQueries({ queryKey: queryKeys.canvas.layout(id) });
      qc.invalidateQueries({ queryKey: queryKeys.activity.all() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpsertNodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      layoutId,
      body,
    }: {
      layoutId: string;
      body: UpsertCanvasNodesBody;
    }) =>
      apiFetch<UpsertNodesResponse>(
        `/api/canvas/layouts/${layoutId}/nodes`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      ),
    onSuccess: (_res, { layoutId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.canvas.layout(layoutId) });
      qc.invalidateQueries({ queryKey: queryKeys.activity.all() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      layoutId,
      contextEntryId,
    }: {
      layoutId: string;
      contextEntryId: string;
    }) =>
      apiFetch<void>(
        `/api/canvas/layouts/${layoutId}/nodes/${contextEntryId}`,
        { method: "DELETE" },
      ),
    onSuccess: (_res, { layoutId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.canvas.layout(layoutId) });
      qc.invalidateQueries({ queryKey: queryKeys.activity.all() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useImportFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CanvasImportBody) =>
      apiFetch<ImportResponse>("/api/canvas/import", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (_res, body) => {
      qc.invalidateQueries({
        queryKey: queryKeys.canvas.layout(body.layoutId),
      });
      qc.invalidateQueries({ queryKey: queryKeys.activity.all() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

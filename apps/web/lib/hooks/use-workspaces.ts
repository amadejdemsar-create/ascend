"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";
import type {
  UpdateWorkspaceInput,
  WorkspaceRole,
  MembershipStatus,
} from "@/lib/validations";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Workspace shape returned by the list/detail API routes. */
export interface WorkspaceListItem {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  myRole: WorkspaceRole;
  memberCount: number;
}

/** Workspace detail shape (same as Prisma row). */
export interface WorkspaceDetail {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/** Member shape returned by the members API route. */
export interface WorkspaceMemberItem {
  userId: string;
  displayName: string | null;
  email: string | null;
  role: WorkspaceRole;
  status: MembershipStatus;
  joinedAt: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetches all workspaces the current user belongs to.
 *
 * In Wave 8 single-user, this returns exactly one workspace.
 * 5min staleTime since workspace list rarely changes.
 */
export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => apiFetch<WorkspaceListItem[]>("/api/workspaces"),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches a single workspace by ID.
 *
 * Disabled when id is null (workspace not yet resolved).
 * 5min staleTime.
 */
export function useWorkspace(id: string | null) {
  return useQuery({
    queryKey: queryKeys.workspaces.detail(id),
    queryFn: () => apiFetch<WorkspaceDetail>(`/api/workspaces/${id}`),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation to update a workspace's name or slug.
 *
 * Invalidates the workspace detail and list caches on success.
 */
export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWorkspaceInput }) =>
      apiFetch<WorkspaceDetail>(`/api/workspaces/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.list(),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Fetches the member list for a workspace.
 *
 * 1min staleTime since members can change more frequently in Wave 8b.
 * Disabled when id is null.
 */
export function useWorkspaceMembers(id: string | null) {
  return useQuery({
    queryKey: queryKeys.workspaces.members(id),
    queryFn: () =>
      apiFetch<WorkspaceMemberItem[]>(`/api/workspaces/${id}/members`),
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
  });
}

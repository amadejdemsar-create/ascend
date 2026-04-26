"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/queries/keys";
import type {
  SyncBlockUpdateInput,
  BlockOpAddInput,
  BlockOpUpdateInput,
  BlockOpMoveInput,
} from "@/lib/validations";

// ---------------------------------------------------------------------------
// Response types (mirror the API route JSON shapes)
// ---------------------------------------------------------------------------

export interface BlockDocumentApiResponse {
  snapshot: unknown;
  version: number;
  extractedText: string | null;
  updatedAt: string;
}

export interface SyncResult {
  version: number;
  conflict: boolean;
  latest?: { snapshot: unknown; version: number };
}

export interface BlockMutationResult {
  snapshot: unknown;
  version: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Read the current block document for a context entry.
 *
 * Returns `null` when the entry has no block document yet (the API returns
 * 404 in that case). A null result is the cue for the editor to call
 * `useMigrateBlockDocument` to convert legacy markdown into blocks.
 */
export function useBlockDocument(entryId: string | null | undefined) {
  return useQuery({
    queryKey: entryId
      ? queryKeys.context.blocks(entryId)
      : (["context", "blocks", "_disabled"] as const),
    enabled: Boolean(entryId),
    queryFn: async () => {
      if (!entryId) throw new Error("entryId required");
      try {
        return await apiFetch<BlockDocumentApiResponse>(
          `/api/context/${entryId}/blocks`,
        );
      } catch (err) {
        // The blocks GET route returns 404 when no BlockDocument exists.
        // apiFetch re-throws ApiError as plain Error with the server's
        // error field as the message. Match the known 404 messages.
        if (err instanceof Error) {
          const msg = err.message.toLowerCase();
          if (
            msg.includes("no block document") ||
            msg.includes("request failed (404)") ||
            msg.includes("not found")
          ) {
            return null;
          }
        }
        throw err;
      }
    },
    staleTime: 1000 * 30, // 30s; editor refreshes on focus anyway
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Sync the editor state to the server. The editor component composes this
 * with a debounce helper (e.g., 1.5s timer) and only calls when the user
 * pauses typing.
 */
export function useSyncBlockDocument(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation<SyncResult, Error, SyncBlockUpdateInput>({
    mutationFn: (input) =>
      apiFetch<SyncResult>(`/api/context/${entryId}/blocks/sync`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      // Refresh the read so the next render picks up the new version.
      queryClient.invalidateQueries({
        queryKey: queryKeys.context.blocks(entryId),
      });
      // Cross-domain: detail panel parts outside the editor read the entry.
      queryClient.invalidateQueries({
        queryKey: queryKeys.context.detail(entryId),
      });
      // Cross-domain: search results may use the new extractedText
      // (the search_vector trigger fires on extractedText changes).
      // Use prefix match since search keys include the query string.
      queryClient.invalidateQueries({
        queryKey: ["context", "search"],
      });
    },
  });
}

/**
 * One-shot migration of legacy markdown to blocks. Idempotent: the server
 * returns the existing BlockDocument if the entry already has one.
 */
export function useMigrateBlockDocument(entryId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    { blockDocumentId: string; version: number },
    Error,
    void
  >({
    mutationFn: () =>
      apiFetch<{ blockDocumentId: string; version: number }>(
        `/api/context/${entryId}/blocks/migrate`,
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.context.blocks(entryId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.context.detail(entryId),
      });
    },
  });
}

/**
 * LLM-friendly block operations. Each mutation targets a single block
 * within the document and returns the updated snapshot + version so the
 * editor can re-initialize from the response without a separate fetch.
 *
 * Used by AIBlockNode rendering and by MCP-driven external workflows.
 */
export function useBlockOps(entryId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.context.blocks(entryId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.context.detail(entryId),
    });
    // extractedText changes propagate to search via the trigger.
    queryClient.invalidateQueries({
      queryKey: ["context", "search"],
    });
  };

  const addBlock = useMutation<BlockMutationResult, Error, BlockOpAddInput>({
    mutationFn: (input) =>
      apiFetch<BlockMutationResult>(`/api/context/${entryId}/blocks`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });

  const updateBlock = useMutation<
    BlockMutationResult,
    Error,
    { blockId: string; patch: BlockOpUpdateInput["patch"] }
  >({
    mutationFn: ({ blockId, patch }) =>
      apiFetch<BlockMutationResult>(
        `/api/context/${entryId}/blocks/${blockId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ patch }),
        },
      ),
    onSuccess: invalidate,
  });

  const moveBlock = useMutation<BlockMutationResult, Error, BlockOpMoveInput>({
    mutationFn: (input) =>
      apiFetch<BlockMutationResult>(`/api/context/${entryId}/blocks/move`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });

  const deleteBlock = useMutation<void, Error, { blockId: string }>({
    mutationFn: ({ blockId }) =>
      apiFetch<void>(`/api/context/${entryId}/blocks/${blockId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });

  return { addBlock, updateBlock, moveBlock, deleteBlock };
}

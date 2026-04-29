"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/queries/keys";
import {
  ALLOWED_MIME_TYPES,
  UPLOAD_MAX_BYTES,
} from "@/lib/validations";

// ---------------------------------------------------------------------------
// Response types (mirror the API route JSON shapes)
// ---------------------------------------------------------------------------

export interface FileApiResponse {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: "PENDING" | "UPLOADED" | "FAILED";
  extractionStatus: "PENDING" | "EXTRACTING" | "COMPLETE" | "FAILED";
  extractionError: string | null;
  pageCount: number | null;
  extractedAt: string | null;
  contextEntryId: string | null;
  createdAt: string;
}

export interface FileStatusResponse {
  id: string;
  status: "PENDING" | "UPLOADED" | "FAILED";
  extractionStatus: "PENDING" | "EXTRACTING" | "COMPLETE" | "FAILED";
  extractionError: string | null;
  pageCount: number | null;
  extractedAt: string | null;
}

export interface PresignResponse {
  fileId: string;
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
  contextEntryId: string | null;
}

export interface ConfirmResponse {
  file: FileApiResponse;
  extractionEnqueued: boolean;
  extractionReason?: string;
}

export interface UploadFileInput {
  file: globalThis.File;
  entryId?: string;
  createEntry?: boolean;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Poll the extraction status for a file.
 *
 * Auto-polls every 2 seconds while extraction is PENDING or EXTRACTING.
 * Polling stops automatically once status flips to COMPLETE or FAILED.
 *
 * Disabled when `id` is null/undefined.
 */
export function useFileStatus(
  id: string | null | undefined,
  opts?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: id
      ? queryKeys.files.status(id)
      : (["files", "status", "_disabled"] as const),
    enabled: Boolean(id) && (opts?.enabled !== false),
    queryFn: async () => {
      if (!id) throw new Error("fileId required");
      return apiFetch<FileStatusResponse>(`/api/files/${id}/status`);
    },
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.extractionStatus;
      if (status === "PENDING" || status === "EXTRACTING") {
        return 2000;
      }
      return false;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Orchestration hook for the full upload flow:
 *   1. POST /api/files/presign  (get presigned URL + create File row)
 *   2. PUT to presigned URL     (upload bytes to R2)
 *   3. POST /api/files/confirm  (mark as UPLOADED, enqueue extraction)
 *
 * Returns the confirm response containing the File record and extraction
 * status.
 *
 * The R2 PUT uses raw `fetch` (not `apiFetch`) because presigned URLs are
 * cross-origin and must not carry cookie auth or custom headers.
 */
export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation<ConfirmResponse, Error, UploadFileInput>({
    mutationFn: async (input) => {
      // Client-side validation before hitting the server
      if (!ALLOWED_MIME_TYPES.has(input.file.type)) {
        throw new Error(`File type "${input.file.type}" is not supported`);
      }
      if (input.file.size > UPLOAD_MAX_BYTES) {
        const maxMB = Math.round(UPLOAD_MAX_BYTES / (1024 * 1024));
        throw new Error(`File exceeds the ${maxMB} MiB size limit`);
      }

      // Step 1: Presign
      const presign = await apiFetch<PresignResponse>(
        "/api/files/presign",
        {
          method: "POST",
          body: JSON.stringify({
            filename: input.file.name,
            mimeType: input.file.type,
            sizeBytes: input.file.size,
            entryId: input.entryId,
            createEntry: input.createEntry,
          }),
        },
      );

      // Step 2: Upload to R2 via presigned URL.
      // Raw fetch (NOT apiFetch): presigned URLs are cross-origin, and R2
      // rejects requests with custom auth headers or cookies.
      const uploadResponse = await fetch(presign.uploadUrl, {
        method: "PUT",
        body: input.file,
        headers: {
          "Content-Type": input.file.type,
        },
      });
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => "Upload failed");
        throw new Error(`Upload to storage failed: ${errorText}`);
      }

      // Step 3: Confirm
      const confirm = await apiFetch<ConfirmResponse>(
        "/api/files/confirm",
        {
          method: "POST",
          body: JSON.stringify({
            fileId: presign.fileId,
          }),
        },
      );

      return confirm;
    },
    onSuccess: (data) => {
      // Invalidate file caches
      queryClient.invalidateQueries({ queryKey: queryKeys.files.all() });
      // Cross-domain: uploads with createEntry create a ContextEntry
      queryClient.invalidateQueries({ queryKey: queryKeys.context.all() });
      // If the file is linked to a specific entry, invalidate its detail
      if (data.file.contextEntryId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.context.detail(data.file.contextEntryId),
        });
      }
    },
  });
}

/**
 * Re-enqueue a file for extraction. Used when extraction previously failed
 * and the user wants to retry.
 */
export function useReExtract() {
  const queryClient = useQueryClient();

  return useMutation<
    { jobId: string; scheduledAt: string },
    Error,
    { fileId: string }
  >({
    mutationFn: ({ fileId }) =>
      apiFetch<{ jobId: string; scheduledAt: string }>(
        `/api/files/${fileId}/extract`,
        { method: "POST", body: JSON.stringify({}) },
      ),
    onSuccess: (_data, { fileId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.files.status(fileId),
      });
    },
  });
}

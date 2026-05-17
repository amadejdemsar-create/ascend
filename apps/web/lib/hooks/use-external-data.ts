"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";
import { fireDatabaseCreatedConfetti } from "@/lib/confetti";
import type {
  CreateExternalSourceInput,
  ExternalDataQueryInput,
  ExternalDataQueryResult,
  UpdateExternalSourceInput,
} from "@/lib/validations";
import { toast } from "sonner";

// ── Wire shapes ─────────────────────────────────────────────────────

export interface ExternalSource {
  id: string;
  userId: string;
  workspaceId: string;
  provider: "GITHUB";
  name: string;
  authType: "PAT";
  hasCredentials: boolean;
  config: unknown;
  enabled: boolean;
  lastRefreshedAt: string | null;
  lastRefreshError: string | null;
  createdAt: string;
  updatedAt: string;
  contextEntryId: string | null;
}

interface ListResponse {
  sources: ExternalSource[];
}
interface DetailResponse {
  source: ExternalSource;
}

// ── Queries ─────────────────────────────────────────────────────────

export function useExternalSources() {
  return useQuery({
    queryKey: queryKeys.externalData.sources(),
    queryFn: async () => {
      const res = await apiFetch<ListResponse>("/api/external-data/sources");
      return res.sources;
    },
    staleTime: 30 * 1000,
  });
}

export function useExternalSource(id: string | null) {
  return useQuery({
    queryKey: queryKeys.externalData.source(id ?? ""),
    queryFn: async () => {
      const res = await apiFetch<DetailResponse>(
        `/api/external-data/sources/${id}`,
      );
      return res.source;
    },
    enabled: !!id,
  });
}

export function useExternalDataRows(
  sourceId: string | null,
  input: ExternalDataQueryInput | null,
) {
  return useQuery({
    queryKey: queryKeys.externalData.rows(
      sourceId ?? "",
      input?.shape ?? "",
      input ?? {},
    ),
    queryFn: async () => {
      return apiFetch<ExternalDataQueryResult>(
        `/api/external-data/sources/${sourceId}/query`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
    },
    enabled: !!sourceId && !!input,
    // 5-min staleTime matches the server-side LRU TTL.
    staleTime: 5 * 60_000,
  });
}

// ── Mutations ───────────────────────────────────────────────────────

export function useCreateExternalSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExternalSourceInput) =>
      apiFetch<DetailResponse>("/api/external-data/sources", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.externalData.all() });
      // Creating an external source also creates a ContextEntry of type
      // EXTERNAL_DATABASE, so the /context list view needs to refresh.
      qc.invalidateQueries({ queryKey: queryKeys.context.all() });
      qc.invalidateQueries({ queryKey: queryKeys.activity.all() });
      fireDatabaseCreatedConfetti();
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateExternalSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateExternalSourceInput;
    }) =>
      apiFetch<DetailResponse>(`/api/external-data/sources/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.externalData.sources() });
      qc.invalidateQueries({ queryKey: queryKeys.externalData.source(id) });
      // Rows for this source are now stale (config + creds changes can
      // affect them).
      qc.invalidateQueries({ queryKey: queryKeys.externalData.all() });
      qc.invalidateQueries({ queryKey: queryKeys.context.all() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteExternalSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/external-data/sources/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.externalData.all() });
      qc.removeQueries({ queryKey: queryKeys.externalData.source(id) });
      // The paired ContextEntry was also deleted.
      qc.invalidateQueries({ queryKey: queryKeys.context.all() });
      qc.invalidateQueries({ queryKey: queryKeys.activity.all() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRefreshExternalSchema() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<DetailResponse>(
        `/api/external-data/sources/${id}/refresh-schema`,
        { method: "POST" },
      ),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.externalData.source(id) });
      qc.invalidateQueries({ queryKey: queryKeys.externalData.sources() });
      qc.invalidateQueries({ queryKey: queryKeys.externalData.all() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

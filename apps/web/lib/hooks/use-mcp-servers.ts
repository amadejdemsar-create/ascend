"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api-client";
import { fireDatabaseCreatedConfetti } from "@/lib/confetti";
import type {
  CreateMcpConnectionInput,
  UpdateMcpConnectionInput,
} from "@/lib/validations";
import { toast } from "sonner";

// ── Wire shapes (mirror the API route responses) ───────────────────

export interface McpConnection {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  slug: string;
  transport: "HTTP_STREAMABLE" | "SSE";
  endpoint: string;
  authType: "NONE" | "API_KEY" | "BEARER";
  hasCredentials: boolean;
  enabled: boolean;
  lastListedAt: string | null;
  lastListError: string | null;
  createdAt: string;
  updatedAt: string;
  toolCount?: number;
}

interface ListResponse {
  connections: McpConnection[];
}
interface DetailResponse {
  connection: McpConnection;
}
interface TestResponse {
  healthy: boolean;
  toolCount?: number;
  error?: string;
}

// ── Queries ─────────────────────────────────────────────────────────

/** List the user's MCP server connections. */
export function useMcpServers() {
  return useQuery({
    queryKey: queryKeys.mcpServers.list(),
    queryFn: async () => {
      const res = await apiFetch<ListResponse>("/api/mcp-servers");
      return res.connections;
    },
    staleTime: 30 * 1000,
  });
}

/** Single connection. */
export function useMcpServer(id: string | null) {
  return useQuery({
    queryKey: queryKeys.mcpServers.detail(id ?? ""),
    queryFn: async () => {
      const res = await apiFetch<DetailResponse>(`/api/mcp-servers/${id}`);
      return res.connection;
    },
    enabled: !!id,
  });
}

// ── Mutations ───────────────────────────────────────────────────────

export function useCreateMcpServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMcpConnectionInput) =>
      apiFetch<DetailResponse>("/api/mcp-servers", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers.all() });
      qc.invalidateQueries({ queryKey: queryKeys.activity.all() });
      fireDatabaseCreatedConfetti();
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateMcpServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateMcpConnectionInput;
    }) =>
      apiFetch<DetailResponse>(`/api/mcp-servers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers.list() });
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers.detail(id) });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteMcpServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/mcp-servers/${id}`, { method: "DELETE" }),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers.list() });
      qc.removeQueries({ queryKey: queryKeys.mcpServers.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.activity.all() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTestMcpServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<TestResponse>(`/api/mcp-servers/${id}/test`, {
        method: "POST",
      }),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.mcpServers.list() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Wave 10: MCP federation proxy.
 *
 * Given an upstream MCP server (HTTP_STREAMABLE or SSE transport) +
 * decrypted credentials, this module forwards two JSON-RPC operations:
 *
 *   - `listTools(connection, credentials)` — calls `initialize` then
 *     `tools/list` against the upstream, returns the parsed tool
 *     descriptors. Used by mcpFederationService.testConnection and
 *     refreshToolCache.
 *
 *   - `callTool(connection, credentials, toolName, args)` — forwards
 *     a `tools/call` request to the upstream and returns the raw
 *     result. Used by Ascend's /api/mcp route when a host like Claude
 *     invokes a federated tool name (e.g., "linear__create_issue").
 *
 * DZ-28 enforcement: this module is ONLY imported by /api/mcp and
 * mcp-federation-service.testConnection. Ascend's service layer must
 * never call into federated tools server-side. Grep at wave close.
 *
 * Timeouts: 30s per upstream request (AbortController).
 * Errors: never throws; returns `{ ok: false, error: string }` so
 * the caller can handle gracefully and surface a user-friendly message.
 * Sensitive data: never logs the decrypted credentials, the auth
 * header, or the upstream response body bytes (only status + length).
 */

import type { PublicMcpConnection } from "@/lib/services/mcp-federation-service";

const UPSTREAM_TIMEOUT_MS = 30_000;

/** Minimal MCP tool descriptor shape (the subset we cache + surface). */
export interface UpstreamMcpTool {
  name: string;
  description?: string;
  inputSchema: unknown;
}

/** JSON-RPC 2.0 request envelope. */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

/** JSON-RPC 2.0 response envelope. */
interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function buildAuthHeader(
  authType: "NONE" | "API_KEY" | "BEARER",
  credentials: string | null,
): Record<string, string> {
  if (!credentials || authType === "NONE") return {};
  switch (authType) {
    case "API_KEY":
      // The MCP spec doesn't standardize an API-key header. Most servers
      // expect `Authorization: Bearer <key>` even for API keys; we use
      // `x-api-key` and `Authorization: Bearer` BOTH for compatibility.
      return {
        "x-api-key": credentials,
        Authorization: `Bearer ${credentials}`,
      };
    case "BEARER":
      return { Authorization: `Bearer ${credentials}` };
  }
}

async function postJsonRpc(
  endpoint: string,
  headers: Record<string, string>,
  request: JsonRpcRequest,
  signal: AbortSignal,
): Promise<{ ok: true; response: JsonRpcResponse } | { ok: false; error: string }> {
  try {
    const res = await globalThis.fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...headers,
      },
      body: JSON.stringify(request),
      signal,
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Upstream returned HTTP ${res.status} ${res.statusText}`,
      };
    }
    const contentType = res.headers.get("content-type") ?? "";
    // Streamable HTTP MCP servers may respond with text/event-stream;
    // we read the first event's data payload.
    if (contentType.includes("text/event-stream")) {
      const text = await res.text();
      const eventLine = text
        .split("\n")
        .find((l) => l.startsWith("data: "));
      if (!eventLine) {
        return { ok: false, error: "Upstream SSE response had no data event" };
      }
      const dataStr = eventLine.slice("data: ".length).trim();
      try {
        const parsed = JSON.parse(dataStr) as JsonRpcResponse;
        return { ok: true, response: parsed };
      } catch {
        return { ok: false, error: "Upstream SSE data is not JSON" };
      }
    }
    const parsed = (await res.json()) as JsonRpcResponse;
    return { ok: true, response: parsed };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Upstream request timed out (30s)" };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Initialize handshake required before listTools / callTool on most MCP
 * servers. We don't bother negotiating capabilities here; we just send
 * a minimal hello so the upstream can prepare state for the next call.
 *
 * Many servers tolerate `tools/list` without initialize; this is a
 * defense for stricter implementations.
 */
async function initialize(
  connection: PublicMcpConnection,
  credentials: string | null,
  signal: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await postJsonRpc(
    connection.endpoint,
    buildAuthHeader(connection.authType, credentials),
    {
      jsonrpc: "2.0",
      id: "init",
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "ascend-federation", version: "1.0.0" },
      },
    },
    signal,
  );
  if (!result.ok) return result;
  if (result.response.error) {
    return {
      ok: false,
      error: `Upstream initialize rejected: ${result.response.error.message}`,
    };
  }
  return { ok: true };
}

export const federationProxy = {
  /**
   * Call `tools/list` against the upstream. Returns the parsed tool
   * descriptors on success. The caller is responsible for caching.
   */
  async listTools(
    connection: PublicMcpConnection,
    credentials: string | null,
  ): Promise<
    | { ok: true; tools: UpstreamMcpTool[] }
    | { ok: false; error: string }
  > {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      UPSTREAM_TIMEOUT_MS,
    );
    try {
      const init = await initialize(connection, credentials, controller.signal);
      if (!init.ok) return init;

      const result = await postJsonRpc(
        connection.endpoint,
        buildAuthHeader(connection.authType, credentials),
        {
          jsonrpc: "2.0",
          id: "tools-list",
          method: "tools/list",
        },
        controller.signal,
      );
      if (!result.ok) return result;
      if (result.response.error) {
        return {
          ok: false,
          error: `Upstream tools/list error: ${result.response.error.message}`,
        };
      }
      const tools = parseTools(result.response.result);
      if (!tools) {
        return {
          ok: false,
          error: "Upstream tools/list returned malformed result",
        };
      }
      return { ok: true, tools };
    } finally {
      clearTimeout(timeout);
    }
  },

  /**
   * Forward a tools/call to the upstream. Returns the raw MCP response
   * envelope so Ascend's /api/mcp can pass it through to its caller
   * verbatim.
   */
  async callTool(
    connection: PublicMcpConnection,
    credentials: string | null,
    toolName: string,
    args: unknown,
  ): Promise<
    | { ok: true; result: unknown }
    | { ok: false; error: string }
  > {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      UPSTREAM_TIMEOUT_MS,
    );
    try {
      // Initialize is optional for many servers; skip it on tools/call
      // to keep latency low. If the upstream requires it, the response
      // will surface a clear error and the user can re-test the
      // connection (which DOES run initialize).
      const result = await postJsonRpc(
        connection.endpoint,
        buildAuthHeader(connection.authType, credentials),
        {
          jsonrpc: "2.0",
          id: "tools-call",
          method: "tools/call",
          params: { name: toolName, arguments: args },
        },
        controller.signal,
      );
      if (!result.ok) return result;
      if (result.response.error) {
        return {
          ok: false,
          error: `Upstream tools/call error: ${result.response.error.message}`,
        };
      }
      return { ok: true, result: result.response.result };
    } finally {
      clearTimeout(timeout);
    }
  },
};

/** Defensive parsing of the upstream tools/list result. */
function parseTools(raw: unknown): UpstreamMcpTool[] | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as { tools?: unknown };
  if (!Array.isArray(obj.tools)) return null;
  const out: UpstreamMcpTool[] = [];
  for (const item of obj.tools) {
    if (typeof item !== "object" || item === null) continue;
    const t = item as {
      name?: unknown;
      description?: unknown;
      inputSchema?: unknown;
    };
    if (typeof t.name !== "string") continue;
    if (typeof t.inputSchema !== "object" || t.inputSchema === null) continue;
    out.push({
      name: t.name,
      description: typeof t.description === "string" ? t.description : undefined,
      inputSchema: t.inputSchema,
    });
  }
  return out;
}

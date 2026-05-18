/**
 * Shared MCP transport helper for the CLI.
 *
 * Ascend's MCP endpoint at `POST /api/mcp` speaks JSON-RPC 2.0 over a
 * Streamable HTTP transport. The server picks between `application/json`
 * and `text/event-stream` based on the `Accept` header; we ask for both
 * and unwrap whichever format comes back.
 *
 * This helper is intentionally minimal: no session, no notifications,
 * no SSE streaming. The CLI's two MCP commands (`mcp list-tools` and
 * `mcp call`) are one-shot request-response, so we issue a single
 * JSON-RPC request, parse the result, and return.
 */

import type { ResolvedAuth } from "../auth.js";
import { ApiCallError, NetworkError } from "../errors.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

interface JsonRpcError {
  jsonrpc: "2.0";
  id: number | null;
  error: { code: number; message: string; data?: unknown };
}

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcError;

let nextId = 1;

/**
 * Send one JSON-RPC request to /api/mcp and unwrap the result.
 *
 * Throws ApiCallError on a JSON-RPC error envelope or non-2xx HTTP.
 * Throws NetworkError on transport failure.
 */
export async function mcpRpc<T = unknown>(
  auth: ResolvedAuth,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const id = nextId++;
  const body: JsonRpcRequest = { jsonrpc: "2.0", id, method };
  if (params) body.params = params;

  const url = `${auth.baseUrl.replace(/\/+$/, "")}/api/mcp`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${auth.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new NetworkError(msg, err instanceof Error ? err : undefined);
  }

  const text = await res.text();

  if (!res.ok) {
    throw new ApiCallError({
      status: res.status,
      path: "/api/mcp",
      message: `MCP request failed: ${res.statusText || "non-2xx response"}`,
      body: text,
    });
  }

  const envelope = parseEnvelope<T>(text);
  if ("error" in envelope) {
    throw new ApiCallError({
      status: res.status,
      path: "/api/mcp",
      message: `MCP error ${envelope.error.code}: ${envelope.error.message}`,
      body: envelope.error,
    });
  }
  return envelope.result;
}

/**
 * Unwrap either a plain JSON-RPC envelope or an SSE event stream that
 * contains exactly one `data: { ... }` line. The Streamable HTTP
 * transport may pick either format.
 */
function parseEnvelope<T>(raw: string): JsonRpcResponse<T> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ApiCallError({
      status: 200,
      path: "/api/mcp",
      message: "MCP returned an empty response body",
    });
  }
  // SSE: lines look like "data: { ... }". Extract the JSON payload of
  // the first `data:` event we see.
  if (trimmed.startsWith("event:") || trimmed.startsWith("data:")) {
    for (const line of trimmed.split(/\r?\n/)) {
      if (line.startsWith("data:")) {
        return JSON.parse(line.slice(5).trim()) as JsonRpcResponse<T>;
      }
    }
    throw new ApiCallError({
      status: 200,
      path: "/api/mcp",
      message: "MCP SSE response contained no data line",
    });
  }
  // Plain JSON.
  return JSON.parse(trimmed) as JsonRpcResponse<T>;
}

/**
 * Federated tools have names like "github__create_issue". This helper
 * splits the name and returns the source slug + bare tool name, or null
 * for native tools.
 *
 * The double-underscore delimiter is documented in
 * apps/web/lib/mcp/federation-proxy.ts (e.g., "linear__create_issue").
 */
export function classifyToolName(name: string): {
  source: "native" | "federated";
  slug: string | null;
  bare: string;
} {
  const idx = name.indexOf("__");
  if (idx < 0) return { source: "native", slug: null, bare: name };
  return {
    source: "federated",
    slug: name.slice(0, idx),
    bare: name.slice(idx + 2),
  };
}

import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { validateApiKey } from "@/lib/auth";
import { createAscendMcpServer } from "@/lib/mcp/server";

// ── MCP CORS allowlist ──────────────────────────────────────────────
//
// MCP_ALLOWED_ORIGINS: comma-separated list of allowed origins.
// If unset, defaults to "*" for backward compatibility in dev.
// In production, set to the specific origins that should be allowed
// (e.g., "https://ascend.nativeai.agency,https://claude.ai").
//
// When the allowlist is configured, the server echoes back the
// request's Origin header if it matches; otherwise it omits the
// Access-Control-Allow-Origin header entirely (browser blocks the
// cross-origin request).

const MCP_ALLOWED_ORIGINS_RAW = process.env.MCP_ALLOWED_ORIGINS;
const MCP_ALLOWED_ORIGINS: Set<string> | null = MCP_ALLOWED_ORIGINS_RAW
  ? new Set(
      MCP_ALLOWED_ORIGINS_RAW.split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    )
  : null;

if (!MCP_ALLOWED_ORIGINS) {
  console.warn(
    "[MCP] MCP_ALLOWED_ORIGINS is not set. Defaulting to wildcard (*) CORS. " +
      "Set MCP_ALLOWED_ORIGINS in production to restrict cross-origin access.",
  );
}

/**
 * Build CORS headers for a given request. If the allowlist is configured,
 * echo the request Origin when it matches; otherwise use wildcard.
 */
function buildCorsHeaders(request: NextRequest): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  };

  if (!MCP_ALLOWED_ORIGINS) {
    // No allowlist configured: wildcard for dev backward compat
    base["Access-Control-Allow-Origin"] = "*";
    return base;
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && MCP_ALLOWED_ORIGINS.has(requestOrigin)) {
    base["Access-Control-Allow-Origin"] = requestOrigin;
    base["Vary"] = "Origin";
  }
  // If origin is not in the allowlist, omit Access-Control-Allow-Origin
  // entirely. The browser will block the cross-origin response.

  return base;
}

// Keep a static fallback for error responses where no request is available
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  ...(MCP_ALLOWED_ORIGINS ? {} : { "Access-Control-Allow-Origin": "*" }),
};

function jsonRpcError(
  code: number,
  message: string,
  status: number,
  id: string | number | null = null,
  request?: NextRequest,
): NextResponse {
  const headers = request ? buildCorsHeaders(request) : CORS_HEADERS;
  return NextResponse.json(
    { jsonrpc: "2.0", error: { code, message }, id },
    { status, headers },
  );
}

/**
 * Validate that a parsed JSON body looks like a valid JSON-RPC request.
 * Notifications (no id) are allowed for methods like notifications/initialized.
 */
function validateJsonRpcRequest(
  body: unknown,
): { valid: true } | { valid: false; response: NextResponse } {
  if (typeof body !== "object" || body === null) {
    return {
      valid: false,
      response: jsonRpcError(-32600, "Invalid Request: body must be a JSON object", 400),
    };
  }

  const obj = body as Record<string, unknown>;

  if (obj.jsonrpc !== "2.0") {
    return {
      valid: false,
      response: jsonRpcError(-32600, "Invalid Request: missing or incorrect jsonrpc version", 400),
    };
  }

  if (typeof obj.method !== "string") {
    return {
      valid: false,
      response: jsonRpcError(-32600, "Invalid Request: method must be a string", 400),
    };
  }

  return { valid: true };
}

/**
 * MCP endpoint using Streamable HTTP transport (stateless mode).
 *
 * Auth is checked BEFORE any MCP processing so unauthenticated
 * requests never reach the protocol layer.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // 1. Authenticate first
    const auth = await validateApiKey(request);
    if (!auth.success) {
      return jsonRpcError(-32000, "Unauthorized", 401, null, request);
    }

    // 2. Validate Content-Type
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return jsonRpcError(-32700, "Parse error: Content-Type must be application/json", 400, null, request);
    }

    // 3. Parse JSON body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonRpcError(-32700, "Parse error: malformed JSON", 400, null, request);
    }

    // 4. Handle batch requests (array of JSON-RPC messages)
    if (Array.isArray(body)) {
      const responses: Response[] = [];
      for (const message of body) {
        const validation = validateJsonRpcRequest(message);
        if (!validation.valid) {
          responses.push(validation.response);
          continue;
        }

        // Create a synthetic request for each batch message
        const singleRequest = new Request(request.url, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(message),
        });

        const server = createAscendMcpServer(auth.userId, auth.workspaceId);
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        await server.connect(transport);
        const response = await transport.handleRequest(
          singleRequest as unknown as Request,
        );
        await transport.close();
        await server.close();

        if (response) {
          responses.push(response);
        }
      }

      // Collect all batch results
      const results = await Promise.all(
        responses.map(async (r) => {
          try {
            return await r.json();
          } catch {
            return null;
          }
        }),
      );
      const filtered = results.filter((r) => r !== null);

      return NextResponse.json(filtered, { headers: buildCorsHeaders(request) });
    }

    // 5. Single request validation
    const validation = validateJsonRpcRequest(body);
    if (!validation.valid) {
      return validation.response;
    }

    // 6. Dev logging
    if (process.env.NODE_ENV !== "production") {
      const obj = body as Record<string, unknown>;
      const method = obj.method as string;
      const params = obj.params as Record<string, unknown> | undefined;
      const toolName = params?.name ?? "";
      console.log(`[MCP] ${method} ${toolName}`);
    }

    // 7. Create a per-request server scoped to this user
    const server = createAscendMcpServer(auth.userId, auth.workspaceId);

    // 8. Create a stateless Web Standard transport with JSON responses
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    // 9. Connect and handle the request
    await server.connect(transport);

    // Reconstruct the request since .json() already consumed the body
    const reconstructed = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(body),
    });

    const response = await transport.handleRequest(
      reconstructed as unknown as Request,
    );

    // 10. Clean up after the response is produced
    await transport.close();
    await server.close();

    // 11. Merge CORS headers into the response
    const corsHeaders = buildCorsHeaders(request);
    if (response) {
      const mergedHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders)) {
        mergedHeaders.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: mergedHeaders,
      });
    }

    // Notification with no response expected (204)
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    console.error("[MCP] Unhandled error:", error);
    return jsonRpcError(-32603, "Internal server error", 500, null, request);
  }
}

/**
 * GET is not supported in stateless mode (no SSE stream).
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for MCP requests." },
    { status: 405, headers: { ...buildCorsHeaders(request), Allow: "POST" } },
  );
}

/**
 * DELETE is not supported in stateless mode (no sessions to terminate).
 */
export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    { error: "Method not allowed. This is a stateless MCP server." },
    { status: 405, headers: { ...buildCorsHeaders(request), Allow: "POST" } },
  );
}

/**
 * OPTIONS preflight handler for CORS.
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: buildCorsHeaders(request) });
}

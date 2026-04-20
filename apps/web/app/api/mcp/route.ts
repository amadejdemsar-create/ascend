import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { validateApiKey } from "@/lib/auth";
import { createAscendMcpServer } from "@/lib/mcp/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
};

function jsonRpcError(
  code: number,
  message: string,
  status: number,
  id: string | number | null = null,
): NextResponse {
  return NextResponse.json(
    { jsonrpc: "2.0", error: { code, message }, id },
    { status, headers: CORS_HEADERS },
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
      return jsonRpcError(-32000, "Unauthorized", 401);
    }

    // 2. Validate Content-Type
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return jsonRpcError(-32700, "Parse error: Content-Type must be application/json", 400);
    }

    // 3. Parse JSON body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonRpcError(-32700, "Parse error: malformed JSON", 400);
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

        const server = createAscendMcpServer(auth.userId);
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

      return NextResponse.json(filtered, { headers: CORS_HEADERS });
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
    const server = createAscendMcpServer(auth.userId);

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
    if (response) {
      const mergedHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        mergedHeaders.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: mergedHeaders,
      });
    }

    // Notification with no response expected (204)
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  } catch (error) {
    console.error("[MCP] Unhandled error:", error);
    return jsonRpcError(-32603, "Internal server error", 500);
  }
}

/**
 * GET is not supported in stateless mode (no SSE stream).
 */
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for MCP requests." },
    { status: 405, headers: { ...CORS_HEADERS, Allow: "POST" } },
  );
}

/**
 * DELETE is not supported in stateless mode (no sessions to terminate).
 */
export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed. This is a stateless MCP server." },
    { status: 405, headers: { ...CORS_HEADERS, Allow: "POST" } },
  );
}

/**
 * OPTIONS preflight handler for CORS.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

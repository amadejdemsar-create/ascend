import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { validateApiKey } from "@/lib/auth";
import { createAscendMcpServer } from "@/lib/mcp/server";

/**
 * MCP endpoint using Streamable HTTP transport (stateless mode).
 *
 * Auth is checked BEFORE any MCP processing so unauthenticated
 * requests never reach the protocol layer.
 */
export async function POST(request: NextRequest): Promise<Response> {
  // 1. Authenticate first
  const auth = await validateApiKey(request);
  if (!auth.success) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32000, message: "Unauthorized" },
        id: null,
      },
      { status: 401 },
    );
  }

  try {
    // 2. Create a per-request server scoped to this user
    const server = createAscendMcpServer(auth.userId);

    // 3. Create a stateless Web Standard transport with JSON responses
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    // 4. Connect and handle the request
    await server.connect(transport);
    const response = await transport.handleRequest(request);

    // 5. Clean up after the response is produced
    await transport.close();
    await server.close();

    return response;
  } catch (error) {
    console.error("MCP request error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      },
      { status: 500 },
    );
  }
}

/**
 * GET is not supported in stateless mode (no SSE stream).
 */
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST for MCP requests." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

/**
 * DELETE is not supported in stateless mode (no sessions to terminate).
 */
export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed. This is a stateless MCP server." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

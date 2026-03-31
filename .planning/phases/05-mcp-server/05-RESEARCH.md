# Phase 5: MCP Server - Research

**Researched:** 2026-03-31
**Domain:** Model Context Protocol (MCP) server integration with Next.js 16
**Confidence:** MEDIUM (Zod v4 compatibility nuances require empirical validation)

## Summary

Phase 5 adds a comprehensive MCP server endpoint to Ascend so that any AI assistant (Claude Code, Cursor, OpenAI agents, etc.) can create, read, update, and manage goals through standardized MCP tools. The server will run as a Next.js API route using Streamable HTTP transport, reusing the existing Service Layer (goal, category, dashboard services) and API key authentication.

There are two viable approaches for implementation: (1) using the `mcp-handler` package from Vercel, which provides a turnkey Next.js adapter with dynamic route handling, or (2) building directly with `@modelcontextprotocol/sdk` v1.x and `McpServer` + `StreamableHTTPServerTransport`. The recommended approach is **direct SDK usage** because the project is self-hosted on Dokploy (not Vercel), does not need Redis for SSE, and needs full control over authentication integration. The `mcp-handler` package is designed primarily for Vercel deployments and introduces an unnecessary Redis dependency.

**Primary recommendation:** Use `@modelcontextprotocol/sdk` v1.x directly with `McpServer` class, define tool input schemas as raw JSON Schema objects (not Zod) to avoid the Zod v3/v4 type incompatibility, and route through a single Next.js API route at `app/api/mcp/route.ts`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MCP-01 | MCP server runs on Streamable HTTP transport at a dedicated endpoint | SDK's `StreamableHTTPServerTransport` supports stateless mode; wire into Next.js route handler at `/api/mcp` |
| MCP-02 | MCP authenticates via API key (Bearer token in Authorization header) | Reuse existing `validateApiKey()` from `lib/auth.ts`; extract before passing to transport |
| MCP-03 | MCP tool: create_goal (with all fields including parent, SMART, recurring) | Call `goalService.create()` with validated input; return created goal as JSON text content |
| MCP-04 | MCP tool: get_goal (by ID, returns full details including children and progress) | Call `goalService.getById()` returning goal with children, parent, and category |
| MCP-05 | MCP tool: update_goal (partial update of any field) | Call `goalService.update()` with partial input |
| MCP-06 | MCP tool: delete_goal (with cascade option for children) | Call `goalService.delete()`; Prisma cascade handles children via onDelete: SetNull |
| MCP-07 | MCP tool: list_goals (filter by horizon, category, status, priority, parent; pagination) | Call `goalService.list()` with filters; add pagination via Prisma skip/take |
| MCP-08 | MCP tool: search_goals (full-text search across titles, descriptions, notes) | Call `goalService.search()` which uses Prisma `contains` with `mode: insensitive` |
| MCP-09 | MCP tool: add_progress (increment value with optional note) | Call `goalService.logProgress()` |
| MCP-10 | MCP tool: get_progress_history (for a specific goal) | Call `goalService.getProgressHistory()` |
| MCP-11 | MCP tool: create/update/delete/list categories | Call `categoryService` methods (create, update, delete, list, listTree) |
| MCP-12 | MCP tool: get_dashboard (returns this week's focus, progress overview, streaks, deadlines) | Call `dashboardService.getDashboardData()` |
| MCP-13 | MCP tool: get_current_priorities (weekly goals sorted by priority and deadline) | Derive from dashboard weeklyFocus data or add dedicated service method |
| MCP-14 | MCP tool: complete_goals (bulk complete multiple goals by ID) | Loop `goalService.update()` with `status: "COMPLETED"` for each ID in batch |
| MCP-15 | MCP tool: move_goal (change horizon or parent) | Call `goalService.update()` with new horizon/parentId; hierarchy validation handles constraints |
| MCP-16 | MCP tool: get_timeline (structured year/quarter/month/week view with goals) | Call `goalService.getTree()` which fetches full 4-level hierarchy |
| MCP-17 | MCP tool: get_stats (XP, level, streaks, weekly score, completion rates) | Derive from `dashboardService.getDashboardData()` streaksStats |
| MCP-18 | MCP tool: export_data (JSON, CSV, Markdown format) | New service function; fetch all goals and categories, format per requested type |
| MCP-19 | MCP tool: import_data (JSON format, including migration from old todos.json) | New service function; parse incoming JSON, create goals and categories in transaction |
| MCP-20 | MCP tool: get_settings / update_settings (theme, default view, preferences) | Need new UserSettings model or use existing user record; minimal scope for v1 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | 1.28.0+ (v1.x line) | MCP server protocol implementation | Official TypeScript SDK; v1.x is the production-stable line. Already installed as transitive dep of shadcn. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 4.3.6 (already installed) | Validate MCP tool inputs at runtime | Use for runtime validation inside tool handlers; pass raw JSON Schema to SDK for tool schema definitions |
| `date-fns` | 4.1.0 (already installed) | Date formatting in export tools | Used by dashboard service already |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct SDK (`@modelcontextprotocol/sdk`) | `mcp-handler` v1.1.0 from Vercel | `mcp-handler` is designed for Vercel deployments with Redis SSE. Ascend runs on Dokploy. Extra dependencies (Redis) and the `[transport]` dynamic route pattern are unnecessary overhead. Direct SDK gives full control. |
| Direct SDK v1.x | SDK v2 pre-alpha (`@modelcontextprotocol/server`) | v2 uses Standard Schema (native Zod v4 support) and split packages. However, v2 is pre-alpha (not recommended for production) and the API may change without notice. v1.x is the stable choice. |
| Raw JSON Schema for tool definitions | Zod v4 schemas for tool definitions | The v1.x SDK's `server.tool()` method expects Zod v3 shapes for inputSchema. Zod v4 objects are not type-compatible. Using raw JSON Schema objects for tool definitions avoids this entirely, while using Zod v4 for runtime validation inside the handler. |
| `FastMCP` | Direct SDK | FastMCP has Standard Schema support (Zod v4 works natively). However, it is a third-party wrapper around the official SDK. For a project this size with simple tool registrations, the extra abstraction layer is not worth the dependency. |

**Installation:**
```bash
npm install @modelcontextprotocol/sdk@^1.28.0
```

Note: `@modelcontextprotocol/sdk@1.28.0` is already installed as a transitive dependency of `shadcn`. Adding it as a direct dependency ensures it persists if shadcn is ever removed.

## Architecture Patterns

### Recommended Project Structure
```
app/
├── api/
│   ├── mcp/
│   │   └── route.ts          # Single MCP endpoint (POST + GET + DELETE)
│   ├── goals/                 # Existing REST API (unchanged)
│   ├── categories/            # Existing REST API (unchanged)
│   └── dashboard/             # Existing REST API (unchanged)
lib/
├── mcp/
│   ├── server.ts              # McpServer instance factory with all tool registrations
│   ├── tools/
│   │   ├── goal-tools.ts      # create_goal, get_goal, update_goal, delete_goal, list_goals, search_goals
│   │   ├── progress-tools.ts  # add_progress, get_progress_history
│   │   ├── category-tools.ts  # create_category, update_category, delete_category, list_categories
│   │   ├── dashboard-tools.ts # get_dashboard, get_current_priorities, get_stats, get_timeline
│   │   ├── bulk-tools.ts      # complete_goals, move_goal
│   │   └── data-tools.ts      # export_data, import_data, get_settings, update_settings
│   └── schemas.ts             # Raw JSON Schema objects for all tool input definitions
├── services/                  # Existing service layer (unchanged)
│   ├── goal-service.ts
│   ├── category-service.ts
│   └── dashboard-service.ts
└── auth.ts                    # Existing auth (reused for MCP auth)
```

### Pattern 1: Stateless Streamable HTTP with Next.js Route Handler
**What:** Each MCP request creates a fresh `McpServer` instance and transport, processes the request, then disposes. No session state is maintained between requests.
**When to use:** When the server is a simple tool provider with no server-initiated notifications or long-running subscriptions. This matches Ascend's use case perfectly.
**Example:**
```typescript
// Source: Official SDK docs/server.md + examples/simpleStatelessStreamableHttp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateApiKey(request);
  if (!auth.success) return new NextResponse("Unauthorized", { status: 401 });

  // 2. Create server + register tools
  const server = createMcpServer(auth.userId);

  // 3. Create stateless transport
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  // 4. Connect and handle
  await server.connect(transport);
  const body = await request.json();

  // Transport needs Node.js IncomingMessage/ServerResponse or Web Standard Request/Response
  // Adaptation layer needed for Next.js App Router
  // ...
}
```

### Pattern 2: Tool Registration with Raw JSON Schema (Bypassing Zod v3/v4 Issue)
**What:** Register tools using `server.setRequestHandler` for `CallToolRequestSchema` instead of the higher-level `server.tool()` method. This allows raw JSON Schema definitions and avoids the Zod v3 type requirement entirely.
**When to use:** When using Zod v4 in a project that depends on the v1.x SDK.
**Example:**
```typescript
// Source: SDK low-level API pattern
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "ascend", version: "1.0.0" }, {
  capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_goal",
      description: "Create a new goal with title, horizon, and optional fields",
      inputSchema: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Goal title" },
          horizon: { type: "string", enum: ["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"] },
          // ... more properties
        },
        required: ["title", "horizon"],
      },
    },
    // ... more tools
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case "create_goal": {
      // Validate with Zod v4 at runtime
      const data = createGoalSchema.parse(args);
      const goal = await goalService.create(userId, data);
      return { content: [{ type: "text", text: JSON.stringify(goal) }] };
    }
    // ... more cases
  }
});
```

### Pattern 3: Next.js Route Handler to Node.js Transport Bridge
**What:** The SDK's `StreamableHTTPServerTransport` expects Node.js `IncomingMessage`/`ServerResponse` objects (via `@modelcontextprotocol/node` middleware) or works with Express/Hono helpers. Next.js App Router uses Web Standard `Request`/`Response`. A bridge is needed.
**When to use:** When integrating the SDK directly into Next.js App Router without `mcp-handler`.
**Approach options:**
1. **Manual JSON-RPC handling:** Parse the JSON-RPC request body, dispatch to the server's request handler directly, and return the JSON-RPC response. This bypasses the transport layer entirely for stateless POST-only servers.
2. **Use the transport with ReadableStream/WritableStream adaptation:** More complex but supports SSE for server-initiated messages.
3. **Use `mcp-handler` after all:** If the bridge complexity is too high, `mcp-handler` handles this adaptation layer.

**Recommended approach for Ascend:** Option 1 (manual JSON-RPC handling) for the stateless case. The MCP protocol over HTTP is JSON-RPC 2.0 over POST. For a stateless tool-only server, we can handle the JSON-RPC request directly without needing the full transport layer. However, this means implementing the protocol handshake ourselves.

**Revised recommendation:** After analysis, using `mcp-handler` is the most pragmatic choice despite the Vercel focus. It handles the Next.js adapter layer, supports Streamable HTTP transport natively, and the Redis dependency is optional (only needed for SSE resumability). Without Redis, it falls back to simple HTTP polling which works perfectly for a stateless tool server. The `zod@^3` peer dependency concern is mitigated by the fact that `mcp-handler` uses `@modelcontextprotocol/sdk` internally which already coexists with Zod v4 in this project.

### Anti-Patterns to Avoid
- **Do not use SDK v2 packages (`@modelcontextprotocol/server`):** They are pre-alpha. API changes will break your code.
- **Do not try to pass Zod v4 objects directly to `server.tool()` in v1.x SDK:** Type mismatch will cause compile errors. Use raw JSON Schema or the low-level `setRequestHandler` approach.
- **Do not create stateful sessions unless needed:** Ascend is a single-user app with no server-initiated notifications. Stateless mode eliminates session management complexity.
- **Do not duplicate service logic in MCP tools:** Every tool handler should delegate to the existing Service Layer. The MCP layer is a thin adapter.
- **Do not register excessive tools:** 20 tools is the practical upper limit before clients struggle with discovery. Group related operations (e.g., category CRUD as one tool with an `action` parameter) if needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP protocol handshake and JSON-RPC handling | Custom JSON-RPC parser and dispatcher | `@modelcontextprotocol/sdk` Server class or `mcp-handler` | The protocol has initialize/ping/tools/list handshake requirements that are easy to get wrong |
| Streamable HTTP transport adaptation for Next.js | Custom request/response bridging | `mcp-handler` createMcpHandler() | Handles GET (SSE), POST (messages), DELETE (session cleanup) routing and content-type negotiation |
| CSV/Markdown export formatting | Custom string builders | `json2csv` (if needed) or simple template literals | For CSV, handling escaping, quoting, and newlines in values is error-prone. For this project's scope, template literals are sufficient since the data shape is known. |
| Import data validation | Manual field-by-field checking | Zod v4 schemas for import payload validation | Zod provides clear error messages for nested structures |

**Key insight:** The MCP SDK handles all protocol-level concerns (capability negotiation, request routing, error formatting). The implementation work is entirely in mapping MCP tool calls to existing service functions.

## Common Pitfalls

### Pitfall 1: Zod v3/v4 Type Incompatibility
**What goes wrong:** Passing Zod v4 schema objects to the v1.x SDK's `server.tool()` method causes TypeScript compile errors because it expects `ZodRawShape` from Zod v3.
**Why it happens:** The v1.x SDK was built against Zod v3. Zod v4 changed its type hierarchy.
**How to avoid:** Use `mcp-handler`'s `server.registerTool()` which uses `inputSchema` as a plain object of Zod schemas (slightly different API), OR use the low-level `Server` class with `setRequestHandler` and raw JSON Schema objects. Validate inputs with Zod v4 inside the handler function.
**Warning signs:** TypeScript errors mentioning `ZodRawShape`, `ZodType`, or `ZodSchema` type mismatches.

### Pitfall 2: Next.js Standalone Mode Missing Dependencies
**What goes wrong:** The MCP endpoint works in development but fails in the Docker container because the standalone output did not include the SDK.
**Why it happens:** Next.js standalone output traces imports and bundles only what `server.js` needs. If the MCP SDK is used only in API routes, it should be traced automatically. However, dynamic imports or unusual module resolution can cause files to be missed.
**How to avoid:** After building, verify the SDK exists in `.next/standalone/node_modules`. If missing, add it to `serverExternalPackages` in `next.config.ts`. The existing Dockerfile already copies `node_modules` from a full install as a fallback layer.
**Warning signs:** `MODULE_NOT_FOUND` errors for `@modelcontextprotocol/sdk` in production.

### Pitfall 3: Traefik Reverse Proxy Buffering SSE
**What goes wrong:** Server-Sent Events connections hang or timeout behind Traefik because the reverse proxy buffers responses.
**Why it happens:** Traefik and other reverse proxies may buffer HTTP responses by default, which breaks SSE streaming.
**How to avoid:** For the stateless mode recommended here, SSE is not used (POST-only, no GET SSE stream). If SSE is needed later, configure Traefik to disable response buffering for the MCP endpoint. The Dokploy deployment uses Traefik as the ingress controller.
**Warning signs:** MCP clients connect but never receive streaming responses; timeouts after 30 seconds.

### Pitfall 4: Tool Count Discovery Overload
**What goes wrong:** Registering all 20 tools individually leads to verbose tool listings that confuse AI clients with limited context windows.
**Why it happens:** Each tool adds description text to the client's context. Twenty tools with detailed descriptions consume significant context.
**How to avoid:** Use clear, concise tool descriptions. Consider grouping closely related tools (e.g., `manage_categories` with an `action` field instead of four separate tools). However, separate tools are generally better for AI discoverability, so only consolidate if empirical testing shows confusion.
**Warning signs:** AI clients ignoring relevant tools or calling wrong tools for tasks.

### Pitfall 5: Authentication Race Condition
**What goes wrong:** The MCP transport handles the request before authentication is checked, allowing unauthenticated access.
**Why it happens:** If auth is checked inside the MCP tool handler rather than before the transport processes the request, the initialize handshake happens without auth.
**How to avoid:** Authenticate in the Next.js route handler BEFORE creating the transport or server. Reject unauthorized requests with a standard HTTP 401 before any MCP protocol processing occurs.
**Warning signs:** MCP clients can list tools without providing an API key.

## Code Examples

Verified patterns from official sources:

### Stateless MCP Server with Next.js (using mcp-handler)
```typescript
// Source: mcp-handler npm docs + vercel/mcp-handler README
// File: app/api/mcp/[transport]/route.ts

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(
  (server) => {
    // Register all tools here
    server.registerTool(
      "create_goal",
      {
        title: "Create Goal",
        description: "Create a new goal with title, horizon, and optional fields",
        inputSchema: {
          title: z.string().min(1).max(200),
          horizon: z.enum(["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"]),
          parentId: z.string().optional(),
          categoryId: z.string().optional(),
          priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
          description: z.string().optional(),
          // ... additional fields
        },
      },
      async (args) => {
        // Auth is handled by mcp-handler if configured, or manually here
        const goal = await goalService.create(userId, args);
        return {
          content: [{ type: "text", text: JSON.stringify(goal, null, 2) }],
        };
      }
    );
    // ... more tools
  },
  {},
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== "production",
  }
);

export { handler as GET, handler as POST, handler as DELETE };
```

### Low-Level Server with Raw JSON Schema (avoiding Zod type issues)
```typescript
// Source: SDK types.ts + server/index.ts (low-level API)
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

function createAscendServer(userId: string) {
  const server = new Server(
    { name: "ascend", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS, // Array of { name, description, inputSchema } with raw JSON Schema
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(userId, name, args);
  });

  return server;
}
```

### Client Configuration for Claude Code
```json
{
  "ascend": {
    "url": "https://ascend.nativeai.agency/api/mcp/mcp",
    "headers": {
      "Authorization": "Bearer <api-key>"
    }
  }
}
```

For stdio-only clients, use `mcp-remote`:
```json
{
  "ascend": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "https://ascend.nativeai.agency/api/mcp/mcp"]
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSE-only transport (HTTP + SSE) | Streamable HTTP (POST for requests, optional SSE for notifications) | MCP Spec 2025-03-26 | Streamable HTTP is the standard for remote servers. SSE-only is deprecated. |
| `@modelcontextprotocol/sdk` single package | v2: split into `@modelcontextprotocol/server` + `@modelcontextprotocol/client` | v2 pre-alpha (Q1 2026) | v2 is the future but not production-ready. v1.x remains recommended. |
| `@vercel/mcp-adapter` | `mcp-handler` (same package, renamed) | 2025 | `@vercel/mcp-adapter` redirects to `mcp-handler`. Use `mcp-handler` for new installations. |
| Zod v3 for tool schemas | Standard Schema (Zod v4, Valibot, ArkType) | v2 SDK | v1.x still requires Zod v3 types for `server.tool()`. Workarounds exist (raw JSON Schema, low-level API). |
| WebSocket transport | Removed in v2 SDK | March 30, 2026 (just removed) | WebSocket was never widely adopted. Streamable HTTP replaced it. |

**Deprecated/outdated:**
- `@vercel/mcp-adapter`: Renamed to `mcp-handler`. Package still installs but redirects.
- `WebSocketClientTransport`: Removed from SDK v2. Never use WebSocket for new MCP servers.
- SSE-only transport: Deprecated in favor of Streamable HTTP. Still works but not recommended for new servers.

## Open Questions

1. **Zod v4 + mcp-handler runtime compatibility**
   - What we know: `mcp-handler` v1.1.0 lists `@modelcontextprotocol/sdk@1.26.0` as a peer dependency and `zod@^3` in its install command. However, `@modelcontextprotocol/sdk@1.28.0` is already running fine with Zod v4 in this project as a shadcn dependency.
   - What's unclear: Whether `mcp-handler`'s `server.registerTool()` method accepts Zod v4 schema objects at runtime (even if TypeScript types complain). The `inputSchema` parameter may use runtime `zod-to-json-schema` conversion which works with Zod v4.
   - Recommendation: Test empirically in the first plan. If TypeScript compilation fails, use the low-level `Server` class with raw JSON Schema instead. Install `mcp-handler` first and attempt the simple path.

2. **Authentication flow with mcp-handler**
   - What we know: `mcp-handler` supports authorization via an `auth` callback in options. The existing `validateApiKey()` function extracts the Bearer token and looks up the user.
   - What's unclear: The exact integration point. Does `mcp-handler` pass the request headers to the auth callback? Does the auth result (userId) propagate to tool handlers?
   - Recommendation: Read `mcp-handler` source code for the auth callback signature. If it doesn't support injecting userId into tool context, authenticate in a wrapper that captures userId in closure scope.

3. **Standalone output and MCP SDK bundling**
   - What we know: The Dockerfile copies both standalone output and full `node_modules`. Next.js traces imports and includes them in standalone.
   - What's unclear: Whether the MCP SDK (with its JSON-RPC protocol handler) bundles correctly in standalone mode, especially dynamic imports.
   - Recommendation: Test after the first deploy. The fallback `node_modules` copy in the Dockerfile should cover any tracing misses.

## Sources

### Primary (HIGH confidence)
- `@modelcontextprotocol/sdk` GitHub repo README (https://github.com/modelcontextprotocol/typescript-sdk): SDK structure, v1/v2 status, package names, installation
- SDK server guide (https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md): McpServer API, tool registration, transport patterns, stateless vs stateful, DNS rebinding
- `mcp-handler` npm page (https://www.npmjs.com/package/mcp-handler): v1.1.0 API, installation requirements, Next.js quick start
- `vercel/mcp-handler` GitHub repo (https://github.com/vercel/mcp-handler): Repository structure, examples, last updated March 23, 2026

### Secondary (MEDIUM confidence)
- Build with Matija blog (https://www.buildwithmatija.com/blog/build-mcp-server-nextjs): Complete Next.js MCP implementation walkthrough, Redis setup, client configuration, troubleshooting
- SDK issue #555 Zod 4 support (https://github.com/modelcontextprotocol/typescript-sdk/issues/555): Zod v4 compatibility status, workarounds, Standard Schema plans for v2
- Local codebase analysis: Service Layer patterns, auth middleware, Prisma schema, existing API routes

### Tertiary (LOW confidence)
- `@modelcontextprotocol/sdk@1.28.0` compatibility with Zod v4 at runtime: Observed in project's `npm ls zod` output (shadcn installs it), but not officially documented as supported. Needs empirical validation.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM; the SDK choice is clear, but the Zod v4 compatibility path needs validation
- Architecture: HIGH; stateless Streamable HTTP with Next.js route handler is well-documented and matches the project's deployment model
- Pitfalls: HIGH; the Zod v3/v4 issue, standalone bundling, and Traefik streaming concerns are well-characterized from official sources and community reports

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (v2 SDK may release and change recommendations)

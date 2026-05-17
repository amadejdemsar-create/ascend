-- Wave 10 Phase 1.2: McpServerConnection + McpServerToolCache tables
--
-- Two new tables for the MCP federation feature. All FKs CASCADE on user
-- + workspace + parent-connection so cleanup is automatic when an owner
-- or workspace or connection is deleted.
--
-- DZ-2 SAFE: no ContextEntry changes.

CREATE TABLE "McpServerConnection" (
  "id"                   TEXT NOT NULL,
  "userId"               TEXT NOT NULL,
  "workspaceId"          TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "slug"                 TEXT NOT NULL,
  "transport"            "McpServerTransport" NOT NULL DEFAULT 'HTTP_STREAMABLE',
  "endpoint"             TEXT NOT NULL,
  "authType"             "McpServerAuthType" NOT NULL DEFAULT 'NONE',
  "encryptedCredentials" TEXT,
  "enabled"              BOOLEAN NOT NULL DEFAULT true,
  "lastListedAt"         TIMESTAMP(3),
  "lastListError"        TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "McpServerConnection_pkey" PRIMARY KEY ("id")
);

-- Defense-in-depth: encrypted credentials at most 4096 bytes. The
-- application-layer Zod schema enforces a tighter limit; this is the
-- backstop.
ALTER TABLE "McpServerConnection"
  ADD CONSTRAINT "McpServerConnection_encryptedCredentials_max"
  CHECK (
    "encryptedCredentials" IS NULL
    OR octet_length("encryptedCredentials") <= 4096
  );

CREATE UNIQUE INDEX "McpServerConnection_userId_slug_key"
  ON "McpServerConnection"("userId", "slug");

CREATE INDEX "McpServerConnection_userId_enabled_idx"
  ON "McpServerConnection"("userId", "enabled");

CREATE INDEX "McpServerConnection_workspaceId_idx"
  ON "McpServerConnection"("workspaceId");

ALTER TABLE "McpServerConnection"
  ADD CONSTRAINT "McpServerConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "McpServerConnection"
  ADD CONSTRAINT "McpServerConnection_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Cache of upstream tools/list responses. Pre-prefix (the slug prefix is
-- added at /api/mcp time). One row per (connection, toolName).

CREATE TABLE "McpServerToolCache" (
  "id"                    TEXT NOT NULL,
  "mcpServerConnectionId" TEXT NOT NULL,
  "userId"                TEXT NOT NULL,
  "workspaceId"           TEXT NOT NULL,
  "toolName"              TEXT NOT NULL,
  "description"           TEXT,
  "inputSchema"           JSONB NOT NULL,
  "cachedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "McpServerToolCache_pkey" PRIMARY KEY ("id")
);

-- Per-tool inputSchema capped at 32 KiB. Most JSON schemas are well under
-- 4 KiB; the cap protects against pathological upstream servers.
ALTER TABLE "McpServerToolCache"
  ADD CONSTRAINT "McpServerToolCache_inputSchema_max"
  CHECK (octet_length("inputSchema"::text) <= 32768);

CREATE UNIQUE INDEX "McpServerToolCache_mcpServerConnectionId_toolName_key"
  ON "McpServerToolCache"("mcpServerConnectionId", "toolName");

CREATE INDEX "McpServerToolCache_userId_idx"
  ON "McpServerToolCache"("userId");

CREATE INDEX "McpServerToolCache_workspaceId_idx"
  ON "McpServerToolCache"("workspaceId");

ALTER TABLE "McpServerToolCache"
  ADD CONSTRAINT "McpServerToolCache_mcpServerConnectionId_fkey"
  FOREIGN KEY ("mcpServerConnectionId") REFERENCES "McpServerConnection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "McpServerToolCache"
  ADD CONSTRAINT "McpServerToolCache_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "McpServerToolCache"
  ADD CONSTRAINT "McpServerToolCache_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

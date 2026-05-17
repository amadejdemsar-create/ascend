-- Wave 10 Phase 1.1: add enums + EXTERNAL_DATABASE ContextEntryType value
--
-- DZ-2 SAFE: does not touch search_vector, the ContextEntry GIN index, or
-- the trigger. Purely additive. All enum values are appended; no existing
-- value is renamed or removed.

-- New enum: MCP server transport (HTTP_STREAMABLE or SSE)
CREATE TYPE "McpServerTransport" AS ENUM ('HTTP_STREAMABLE', 'SSE');

-- New enum: MCP server auth type
CREATE TYPE "McpServerAuthType" AS ENUM ('NONE', 'API_KEY', 'BEARER');

-- New enum: external data provider (GitHub in Wave 10; Linear/Slack/Notion later)
CREATE TYPE "ExternalDataProvider" AS ENUM ('GITHUB');

-- New enum: external data auth type (PAT in Wave 10; OAuth later)
CREATE TYPE "ExternalDataAuthType" AS ENUM ('PAT');

-- Extend ContextEntryType with EXTERNAL_DATABASE for the read-only virtual
-- database surface backed by ExternalDataSource.
ALTER TYPE "ContextEntryType" ADD VALUE 'EXTERNAL_DATABASE';

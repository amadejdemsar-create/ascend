-- Wave 10 Phase 1.3: ExternalDataSource table
--
-- The connection record backing every EXTERNAL_DATABASE-typed
-- ContextEntry. PAT-encrypted credentials + per-provider config JSON.
-- The associated ContextEntry FK is added in the next migration.
--
-- DZ-2 SAFE: no ContextEntry changes in this migration.

CREATE TABLE "ExternalDataSource" (
  "id"                   TEXT NOT NULL,
  "userId"               TEXT NOT NULL,
  "workspaceId"          TEXT NOT NULL,
  "provider"             "ExternalDataProvider" NOT NULL,
  "name"                 TEXT NOT NULL,
  "authType"             "ExternalDataAuthType" NOT NULL DEFAULT 'PAT',
  "encryptedCredentials" TEXT NOT NULL,
  "config"               JSONB NOT NULL,
  "enabled"              BOOLEAN NOT NULL DEFAULT true,
  "lastRefreshedAt"      TIMESTAMP(3),
  "lastRefreshError"     TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExternalDataSource_pkey" PRIMARY KEY ("id")
);

-- AES-256-GCM ciphertext (iv.ct.tag base64-joined) at most 4096 bytes.
ALTER TABLE "ExternalDataSource"
  ADD CONSTRAINT "ExternalDataSource_encryptedCredentials_max"
  CHECK (octet_length("encryptedCredentials") <= 4096);

-- Per-provider config + cached shape schemas at most 16 KiB. Schemas
-- expand as the user enables more GitHub repos; 16 KiB is generous.
ALTER TABLE "ExternalDataSource"
  ADD CONSTRAINT "ExternalDataSource_config_max"
  CHECK (octet_length("config"::text) <= 16384);

CREATE INDEX "ExternalDataSource_userId_provider_idx"
  ON "ExternalDataSource"("userId", "provider");

CREATE INDEX "ExternalDataSource_workspaceId_idx"
  ON "ExternalDataSource"("workspaceId");

ALTER TABLE "ExternalDataSource"
  ADD CONSTRAINT "ExternalDataSource_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalDataSource"
  ADD CONSTRAINT "ExternalDataSource_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Wave 9 Phase 1 (migration 2 of 3): Add CanvasLayout table.
-- Hand-written migration (safety rule 6).
-- Additive only. Does NOT touch search_vector (DZ-2 safe).
--
-- A CanvasLayout is one named arrangement of context entries on the
-- spatial canvas, owned by a single user inside a single workspace.
-- The `canvas` field stores the full Excalidraw scene as JSONB
-- (elements + appState + files); the per-row 2 MiB cap is enforced
-- via a CHECK constraint (DZ-25 mitigation #1).
--
-- The `viewport` field stores cursor-resume state: { x, y, zoom,
-- showEdges, cardSize }. Capped at 8 KiB by a separate CHECK.

CREATE TABLE "CanvasLayout" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "isDefault"   BOOLEAN NOT NULL DEFAULT false,
  "viewport"    JSONB NOT NULL,
  "canvas"      JSONB NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CanvasLayout_pkey" PRIMARY KEY ("id")
);

-- Slug must be unique per user (slug is auto-derived from name).
CREATE UNIQUE INDEX "CanvasLayout_userId_slug_key"
  ON "CanvasLayout"("userId", "slug");

-- Optimize the layout list query (newest-updated first per user).
CREATE INDEX "CanvasLayout_userId_updatedAt_idx"
  ON "CanvasLayout"("userId", "updatedAt" DESC);

-- Workspace scoping for Wave 8 multi-tenant queries.
CREATE INDEX "CanvasLayout_workspaceId_idx"
  ON "CanvasLayout"("workspaceId");

-- DZ-25: cap the canvas scene at 2 MiB to prevent runaway storage.
ALTER TABLE "CanvasLayout"
  ADD CONSTRAINT "CanvasLayout_canvas_size_max"
  CHECK (octet_length("canvas"::text) <= 2097152);

-- DZ-25 secondary: cap the viewport metadata at 8 KiB.
ALTER TABLE "CanvasLayout"
  ADD CONSTRAINT "CanvasLayout_viewport_size_max"
  CHECK (octet_length("viewport"::text) <= 8192);

-- Foreign keys.
ALTER TABLE "CanvasLayout"
  ADD CONSTRAINT "CanvasLayout_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanvasLayout"
  ADD CONSTRAINT "CanvasLayout_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

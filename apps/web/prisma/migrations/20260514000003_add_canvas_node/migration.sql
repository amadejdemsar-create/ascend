-- Wave 9 Phase 1 (migration 3 of 3): Add CanvasNode table.
-- Hand-written migration (safety rule 6).
-- Additive only. Does NOT touch search_vector (DZ-2 safe).
--
-- A CanvasNode binds a ContextEntry to a position within one
-- CanvasLayout. (canvasLayoutId, contextEntryId) is unique so the
-- same entry can appear at most once per layout; (canvasLayoutId,
-- excalidrawElementId) is unique so each card maps 1:1 to one
-- Excalidraw rectangle in the layout's canvas scene.
--
-- Deleting a CanvasLayout CASCADEs to all its nodes. Deleting a
-- ContextEntry CASCADEs to all CanvasNode rows pointing at it
-- (Wave 9 documented behavior: removing the source entry removes
-- its cards from every canvas).

CREATE TABLE "CanvasNode" (
  "id"                   TEXT NOT NULL,
  "canvasLayoutId"       TEXT NOT NULL,
  "userId"               TEXT NOT NULL,
  "workspaceId"          TEXT NOT NULL,
  "contextEntryId"       TEXT NOT NULL,
  "x"                    DOUBLE PRECISION NOT NULL,
  "y"                    DOUBLE PRECISION NOT NULL,
  "w"                    DOUBLE PRECISION NOT NULL DEFAULT 240,
  "h"                    DOUBLE PRECISION NOT NULL DEFAULT 140,
  "excalidrawElementId"  TEXT NOT NULL,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CanvasNode_pkey" PRIMARY KEY ("id")
);

-- One row per (layout, entry) pair: an entry appears at most once
-- per layout. Re-dragging an existing card updates the same row.
CREATE UNIQUE INDEX "CanvasNode_canvasLayoutId_contextEntryId_key"
  ON "CanvasNode"("canvasLayoutId", "contextEntryId");

-- One Excalidraw rectangle id per layout. Enforces 1:1 binding so
-- the canvas-edge-sync helper can look up "which CanvasNode does
-- this rectangle belong to" in O(1).
CREATE UNIQUE INDEX "CanvasNode_canvasLayoutId_excalidrawElementId_key"
  ON "CanvasNode"("canvasLayoutId", "excalidrawElementId");

-- Multi-tenant scoping indexes.
CREATE INDEX "CanvasNode_userId_idx"
  ON "CanvasNode"("userId");

CREATE INDEX "CanvasNode_workspaceId_idx"
  ON "CanvasNode"("workspaceId");

-- Lookup all canvases an entry appears in (used by Wave 9 entry
-- detail "Appears in N canvases" affordance if added later).
CREATE INDEX "CanvasNode_contextEntryId_idx"
  ON "CanvasNode"("contextEntryId");

-- Foreign keys. CASCADE on parent deletes per Wave 9 design.
ALTER TABLE "CanvasNode"
  ADD CONSTRAINT "CanvasNode_canvasLayoutId_fkey"
  FOREIGN KEY ("canvasLayoutId") REFERENCES "CanvasLayout"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanvasNode"
  ADD CONSTRAINT "CanvasNode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanvasNode"
  ADD CONSTRAINT "CanvasNode_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanvasNode"
  ADD CONSTRAINT "CanvasNode_contextEntryId_fkey"
  FOREIGN KEY ("contextEntryId") REFERENCES "ContextEntry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

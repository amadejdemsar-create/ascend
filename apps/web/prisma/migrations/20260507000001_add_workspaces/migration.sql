-- Wave 8 Phase 1.1: Create Workspace, WorkspaceMembership, ActivityEvent tables
--
-- PURPOSE: Introduces workspace primitives for multi-tenant collaboration.
-- Workspace is the top-level container. WorkspaceMembership is the join table
-- between User and Workspace with role-based access. ActivityEvent is a
-- workspace-level event log for the activity feed.
--
-- Also adds User.defaultWorkspaceId nullable column with index and FK.
--
-- DZ-2 SAFE: Does NOT touch search_vector, the GIN index, or the trigger.
-- IDEMPOTENT: All CREATE TYPE/TABLE/INDEX use guards so re-running is safe.

-- Step 1: Create WorkspaceRole enum
DO $$ BEGIN
  CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Create MembershipStatus enum
DO $$ BEGIN
  CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'REMOVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 3: Create ActivityEventType enum
DO $$ BEGIN
  CREATE TYPE "ActivityEventType" AS ENUM (
    'WORKSPACE_CREATED',
    'MEMBER_ADDED',
    'MEMBER_REMOVED',
    'MEMBER_ROLE_CHANGED',
    'NODE_CREATED',
    'NODE_DELETED',
    'NODE_RESTORED',
    'NODE_BRANCHED',
    'LINK_CREATED',
    'LINK_REMOVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 4: Create Workspace table
CREATE TABLE IF NOT EXISTS "Workspace" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- Step 5: Workspace unique constraint on slug
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_slug_key" ON "Workspace"("slug");

-- Step 6: Workspace foreign key (owner -> User, RESTRICT delete)
DO $$ BEGIN
  ALTER TABLE "Workspace"
    ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 7: Workspace indexes
CREATE INDEX IF NOT EXISTS "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- Step 8: Create WorkspaceMembership table
CREATE TABLE IF NOT EXISTS "WorkspaceMembership" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "invitedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

-- Step 9: WorkspaceMembership unique constraint (one membership per user per workspace)
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceMembership_workspaceId_userId_key" ON "WorkspaceMembership"("workspaceId", "userId");

-- Step 10: WorkspaceMembership foreign keys
DO $$ BEGIN
  ALTER TABLE "WorkspaceMembership"
    ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkspaceMembership"
    ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 11: WorkspaceMembership indexes
CREATE INDEX IF NOT EXISTS "WorkspaceMembership_userId_status_idx" ON "WorkspaceMembership"("userId", "status");

-- Step 12: Create ActivityEvent table
CREATE TABLE IF NOT EXISTS "ActivityEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "eventType" "ActivityEventType" NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- Step 13: ActivityEvent foreign keys
DO $$ BEGIN
  ALTER TABLE "ActivityEvent"
    ADD CONSTRAINT "ActivityEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ActivityEvent"
    ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 14: ActivityEvent indexes
CREATE INDEX IF NOT EXISTS "ActivityEvent_workspaceId_createdAt_idx" ON "ActivityEvent"("workspaceId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ActivityEvent_workspaceId_eventType_createdAt_idx" ON "ActivityEvent"("workspaceId", "eventType", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ActivityEvent_userId_createdAt_idx" ON "ActivityEvent"("userId", "createdAt" DESC);

-- Step 15: Add User.defaultWorkspaceId column (nullable in Phase 1, backfilled in migration 2)
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "defaultWorkspaceId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Step 16: User.defaultWorkspaceId index
CREATE INDEX IF NOT EXISTS "User_defaultWorkspaceId_idx" ON "User"("defaultWorkspaceId");

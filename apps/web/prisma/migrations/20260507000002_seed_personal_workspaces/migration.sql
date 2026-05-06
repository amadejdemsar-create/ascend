-- Wave 8 Phase 1.2: Seed personal workspaces for all existing users
--
-- PURPOSE: For every User that does not already own a Workspace, creates a
-- personal Workspace (slug = 'personal-<last8chars>', name = 'Personal'),
-- inserts a WorkspaceMembership (role=OWNER, status=ACTIVE), and sets the
-- user's defaultWorkspaceId.
--
-- IDEMPOTENT: Re-running after a successful first run produces zero changes.
-- Each INSERT uses WHERE NOT EXISTS or ON CONFLICT DO NOTHING guards.
--
-- DZ-2 SAFE: Does NOT touch search_vector, the GIN index, or the trigger.

-- Step 1: Create a personal Workspace for each User without one.
-- Uses gen_random_uuid() to generate a cuid-like id (Postgres 13+).
-- Slug uses 'personal-' prefix plus the last 8 characters of the user id
-- for collision resistance in single-user systems.
INSERT INTO "Workspace" ("id", "slug", "name", "ownerId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'personal-' || substring(u."id" from length(u."id") - 7),
  'Personal',
  u."id",
  NOW(),
  NOW()
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "Workspace" w WHERE w."ownerId" = u."id"
);

-- Step 2: Create an OWNER WorkspaceMembership for each newly created workspace.
-- ON CONFLICT DO NOTHING ensures idempotency if the membership already exists.
INSERT INTO "WorkspaceMembership" ("id", "workspaceId", "userId", "role", "status", "acceptedAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  w."id",
  w."ownerId",
  'OWNER'::"WorkspaceRole",
  'ACTIVE'::"MembershipStatus",
  NOW(),
  NOW(),
  NOW()
FROM "Workspace" w
WHERE NOT EXISTS (
  SELECT 1 FROM "WorkspaceMembership" m
  WHERE m."workspaceId" = w."id" AND m."userId" = w."ownerId"
)
ON CONFLICT ("workspaceId", "userId") DO NOTHING;

-- Step 3: Set User.defaultWorkspaceId to the personal workspace where currently null.
UPDATE "User" u
SET "defaultWorkspaceId" = (
  SELECT w."id" FROM "Workspace" w WHERE w."ownerId" = u."id" LIMIT 1
)
WHERE u."defaultWorkspaceId" IS NULL
  AND EXISTS (SELECT 1 FROM "Workspace" w WHERE w."ownerId" = u."id");

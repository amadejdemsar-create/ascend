---
phase: 01-foundation
plan: 02
subsystem: database
tags: [prisma, postgresql, schema, migrations, seed, adapter-pg, docker]

# Dependency graph
requires:
  - phase: 01-foundation-01
    provides: "Next.js scaffold, Prisma 7 config, Dockerfile, Dokploy deployment"
provides:
  - "Complete Prisma schema with 6 models and 3 enums"
  - "Goal adjacency list hierarchy (parentId self-reference)"
  - "Category unlimited nesting (parentId self-reference)"
  - "Multi-user schema with userId FK on all data models"
  - "Prisma Client singleton with adapter-pg in lib/db.ts"
  - "Initial migration applied to production PostgreSQL"
  - "Seeded test user with known API key and UserStats"
  - "Health endpoint with database connectivity verification"
affects: [service-layer, api, mcp-server, gamification]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Prisma 7 adapter-pg singleton with global cache for Next.js HMR", "Adjacency list for hierarchical goals and categories", "Idempotent seed via upsert at container startup", "Migration SQL generated via prisma migrate diff without local database"]

key-files:
  created:
    - prisma/schema.prisma
    - lib/db.ts
    - prisma/seed.ts
    - prisma/migrations/20260330141200_init/migration.sql
    - prisma/migrations/migration_lock.toml
  modified:
    - Dockerfile
    - package.json
    - package-lock.json
    - app/api/health/route.ts

key-decisions:
  - "Generated migration SQL via prisma migrate diff (no local PostgreSQL available)"
  - "Moved prisma and tsx to production dependencies for runtime migration and seeding"
  - "Seed runs at container startup after migration (idempotent via upsert)"
  - "Health endpoint enhanced with database connectivity check"

patterns-established:
  - "Database singleton: import { prisma } from '@/lib/db' using PrismaPg adapter"
  - "Migration workflow: generate SQL with prisma migrate diff, deploy via prisma migrate deploy at startup"
  - "Seed pattern: standalone PrismaClient instance (not singleton) for script context"
  - "Docker CMD chain: migrate deploy then seed then node server.js"

requirements-completed: [INFRA-01, INFRA-02]

# Metrics
duration: 26min
completed: 2026-03-30
---

# Phase 1 Plan 02: Prisma Schema and Database Summary

**Complete Prisma 7 schema with 6 models, adjacency list goal hierarchy, multi-user support, and production migration with seeded test user**

## Performance

- **Duration:** 26 min
- **Started:** 2026-03-30T14:12:25Z
- **Completed:** 2026-03-30T14:38:42Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Complete database schema with User, Goal, Category, ProgressLog, UserStats, and XpEvent models
- Goal model supports full adjacency list hierarchy via self-referencing parentId (GoalHierarchy relation)
- Category model supports unlimited nesting depth via self-referencing parentId (CategoryHierarchy relation)
- All data models have userId FK for multi-user support from day one
- Migration applied successfully to production PostgreSQL on Dokploy
- Test user "Amadej" seeded with API key and initial UserStats (level 1, 0 XP)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define complete Prisma schema and create database singleton** - `977764a` (feat)
2. **Task 2: Seed test user and verify database integrity** - `db1b7c6` (feat)

Deviation fix commits:
- `88ed406` (fix): Include dotenv in Docker runner for prisma migrate deploy
- `57abe3f` (fix): Move prisma to production deps and restructure Docker for migration
- `b2abcf5` (fix): Add tsx to production deps and run seed at container startup
- `298e763` (feat): Enhance health endpoint with database connectivity check

## Files Created/Modified
- `prisma/schema.prisma` - Complete schema with 6 models, 3 enums, indexes, and self-referencing relations
- `lib/db.ts` - Prisma Client singleton using PrismaPg adapter for Next.js
- `prisma/seed.ts` - Idempotent seed script creating test user and UserStats
- `prisma/migrations/20260330141200_init/migration.sql` - Initial migration SQL (182 lines)
- `prisma/migrations/migration_lock.toml` - Prisma migration lock for PostgreSQL
- `Dockerfile` - Restructured with prod-deps stage for prisma CLI runtime deps
- `package.json` - Moved prisma and tsx to production dependencies
- `package-lock.json` - Updated lockfile
- `app/api/health/route.ts` - Enhanced with database user/stats count

## Decisions Made
- **Migration without local database:** Used `prisma migrate diff --from-empty --to-schema` to generate SQL without requiring a local PostgreSQL instance. The migration SQL was placed manually in the Prisma migrations directory structure and deployed to production via the Docker CMD pipeline.
- **prisma and tsx as production dependencies:** These are needed at container runtime for `prisma migrate deploy` and `tsx prisma/seed.ts`. Moving them from devDependencies to dependencies ensures they are available in the production Docker image.
- **Seed at every container startup:** The seed script is idempotent (uses upsert) and runs after every migration deploy. This ensures the test user always exists, even after database recreation.
- **Health endpoint with database check:** Added user and stats count to the health endpoint for quick verification of database state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing XpEvent relation back to User**
- **Found during:** Task 1 (schema creation)
- **Issue:** Prisma validation failed because the User model declared an `xpEvents` relation but XpEvent had no corresponding `user` field
- **Fix:** Added `user User @relation(fields: [userId], references: [id], onDelete: Cascade)` to XpEvent model
- **Files modified:** prisma/schema.prisma
- **Verification:** `npx prisma validate` passed
- **Committed in:** 977764a (part of Task 1 commit)

**2. [Rule 3 - Blocking] Prisma migrate deploy fails in Docker: missing jiti/c12 transitive dependencies**
- **Found during:** Deployment after Task 1
- **Issue:** The Docker runner stage only copied individual prisma node_modules packages (prisma, @prisma/*) but missed the full transitive dependency tree needed by the Prisma CLI's config loader (c12, jiti, confbox, defu, etc.)
- **Fix:** Restructured Dockerfile with a dedicated `prod-deps` stage that runs `npm ci --omit=dev` to install the complete production dependency tree; moved prisma from devDependencies to dependencies
- **Files modified:** Dockerfile, package.json, package-lock.json
- **Verification:** Container starts successfully, health endpoint returns 200
- **Committed in:** 88ed406, 57abe3f (iterative fixes)

**3. [Rule 3 - Blocking] Seed script cannot run in production: tsx not available**
- **Found during:** Task 2 (seed verification)
- **Issue:** The seed script is invoked via `tsx prisma/seed.ts` but tsx was a devDependency, unavailable in the production Docker image
- **Fix:** Moved tsx from devDependencies to dependencies, added seed to Docker CMD chain
- **Files modified:** Dockerfile, package.json, package-lock.json
- **Verification:** Container starts successfully, health endpoint shows 1 user and 1 stats record
- **Committed in:** b2abcf5

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All fixes were necessary for production deployment. The primary challenge was ensuring the Prisma CLI's full dependency tree is available in the minimal Docker runner stage. No scope creep.

## Issues Encountered
- No local PostgreSQL available for `prisma migrate dev`, so migration SQL was generated using `prisma migrate diff` and placed manually in the migrations directory structure. This is a valid Prisma workflow but differs from the typical `migrate dev` flow.
- The `prisma migrate diff` command in Prisma 7 uses `--to-schema` flag (not `--to-schema-datamodel` as in older versions).

## User Setup Required

None. All database operations run automatically at deployment.

## Next Phase Readiness
- Database schema is complete and applied to production PostgreSQL
- All 6 tables exist with proper indexes and relations
- Test user is seeded with known API key for MCP authentication in Plan 04
- Prisma Client singleton is ready for use in the Service Layer (Plan 03)
- Health endpoint provides database connectivity verification

## Self-Check: PASSED

All 9 created/modified files verified on disk. All 6 commit hashes (977764a, db1b7c6, 88ed406, 57abe3f, b2abcf5, 298e763) found in git log. SUMMARY.md exists at expected path.

---
*Phase: 01-foundation*
*Completed: 2026-03-30*

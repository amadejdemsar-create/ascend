# Phase 1: Foundation - Research

**Researched:** 2026-03-30
**Domain:** Next.js 16 project scaffolding, PostgreSQL + Prisma 7 database, Service Layer architecture, Dokploy deployment, API key authentication
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire technical foundation for Ascend: a Next.js 16 application deployed to Dokploy on the user's Hostinger VPS, a PostgreSQL database with Prisma 7 ORM, a Service Layer that will be consumed by both the web UI and MCP server, and API key authentication for the MCP endpoint. Every subsequent phase depends on these being correct, so getting the database schema (adjacency list hierarchy), Prisma 7 adapter pattern, and Service Layer structure right is essential.

The most important technical finding is that **Prisma 7 introduces breaking changes** from older versions. It uses a driver adapter architecture (`@prisma/adapter-pg` with the `pg` driver), moves the database URL from `schema.prisma` to `prisma.config.ts`, generates the client to a custom output directory (imported as `../generated/prisma/client` rather than `@prisma/client`), and requires ESM configuration. The singleton pattern for PrismaClient in Next.js must account for the adapter initialization. All code examples in this research reflect the Prisma 7 API, not older patterns.

The second key finding is that Next.js 16 renames `middleware.ts` to `proxy.ts` and runs it on Node.js runtime (not Edge). Since this phase only needs simple Bearer token validation on API routes, `proxy.ts` is not needed yet; authentication is handled directly in route handlers. The `create-next-app` scaffold now includes AGENTS.md by default and offers React Compiler as an opt-in during setup.

**Primary recommendation:** Use `create-next-app` with `--yes` for defaults (TypeScript, Tailwind, App Router, Turbopack, ESLint), then add Prisma 7 with the adapter-pg pattern, define the complete database schema upfront, build the Service Layer as plain TypeScript modules with `userId` as the first parameter on every function, and deploy via Dokploy with a Dockerfile before writing any business logic.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Multi-user database schema with user_id on all tables (even though v1 is single user) | Prisma 7 schema with `userId` field on Goal, Category, ProgressLog, UserStats, XpEvent models. User model with `apiKey` field for MCP auth. Seeded test user. See Database Schema section. |
| INFRA-02 | PostgreSQL database running as Dokploy container on Hostinger VPS | Dokploy managed PostgreSQL service on dokploy-network. Internal connection URL used by Next.js app. See Deployment Pipeline section. |
| INFRA-03 | Next.js 16 app deployed via Dokploy with auto-deploy from GitHub | create-next-app scaffold, Dockerfile for production build, Dokploy application service with GitHub webhook. See Project Scaffolding and Deployment sections. |
| INFRA-04 | Domain: ascend.nativeai.agency with SSL | Dokploy domain configuration with automatic SSL via Traefik. See Deployment Pipeline section. |
| INFRA-05 | API key authentication for MCP endpoints | Bearer token validation in API route handlers. User.apiKey field lookup. See Authentication section. |
</phase_requirements>

## Standard Stack

### Core (Phase 1 specific)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.x | Full-stack React framework | Current stable. Turbopack default, React 19.2, App Router. `create-next-app` scaffolds TypeScript + Tailwind + ESLint by default. |
| React | 19.2.x | UI library | Bundled with Next.js 16. Only a placeholder page needed in Phase 1. |
| TypeScript | 5.x | Type safety | Required by Next.js 16 (minimum 5.1.0). End-to-end types from Prisma schema to API. |
| Prisma ORM | 7.6.x | Database toolkit | Current stable (7.6.0). Uses driver adapter architecture with `@prisma/adapter-pg`. Auto-generated types from schema. Migration system for schema changes. |
| @prisma/adapter-pg | latest | PostgreSQL driver adapter | Required by Prisma 7. Connects via the `pg` driver for direct TCP connections. |
| pg | latest | PostgreSQL driver | Node.js PostgreSQL client. Used by the Prisma adapter. |
| PostgreSQL | 16.x | Primary database | Dokploy managed container. Handles hierarchical data with recursive CTEs. |
| Tailwind CSS | 4.x | Utility CSS | Included in create-next-app defaults. CSS-first config in v4. Needed for the placeholder page. |
| zod | 3.x | Schema validation | Input validation for API routes and Service Layer. Shared between web UI and MCP tool definitions. |
| dotenv | latest | Environment variables | Required by Prisma 7 for loading DATABASE_URL in prisma.config.ts. |
| tsx | latest | TypeScript execution | Dev dependency for running Prisma seed scripts. Recommended by Prisma docs. |

### Not Needed in Phase 1

These are in the overall stack but should NOT be installed until their respective phases:

| Library | Phase | Reason to Defer |
|---------|-------|-----------------|
| shadcn/ui | Phase 2 | No UI components needed beyond placeholder page |
| Zustand | Phase 2 | No client state management needed |
| React Query / TanStack Query | Phase 2 | No client-side data fetching needed |
| Motion | Phase 2+ | No animations needed |
| mcp-handler | Phase 5 | MCP server implementation is Phase 5 |
| @modelcontextprotocol/sdk | Phase 5 | MCP server implementation is Phase 5 |

### Installation

```bash
# Scaffold the project
npx create-next-app@latest ascend --yes
cd ascend

# Database (Prisma 7 with adapter-pg)
npm install @prisma/client @prisma/adapter-pg pg dotenv
npm install -D prisma tsx @types/pg

# Validation
npm install zod

# Initialize Prisma
npx prisma init --datasource-provider postgresql
```

## Architecture Patterns

### Recommended Project Structure (Phase 1)

```
ascend/
├── app/
│   ├── layout.tsx                    # Root layout (minimal, placeholder)
│   ├── page.tsx                      # Placeholder landing page
│   └── api/
│       ├── goals/
│       │   ├── route.ts              # GET list, POST create
│       │   └── [id]/
│       │       └── route.ts          # GET, PATCH, DELETE
│       ├── categories/
│       │   ├── route.ts              # GET list, POST create
│       │   └── [id]/
│       │       └── route.ts          # GET, PATCH, DELETE
│       └── health/
│           └── route.ts              # Health check endpoint
├── lib/
│   ├── services/                     # Service Layer (shared business logic)
│   │   ├── goal-service.ts
│   │   ├── category-service.ts
│   │   └── hierarchy-helpers.ts      # Hierarchy validation, tree utilities
│   ├── db.ts                         # Prisma Client singleton with adapter
│   ├── auth.ts                       # API key validation
│   ├── validations.ts                # Zod schemas for all inputs
│   ├── constants.ts                  # Horizon rules, hierarchy map
│   └── tree-queries.ts              # Raw SQL recursive CTE utilities
├── prisma/
│   ├── schema.prisma                 # Database schema (all models)
│   ├── migrations/                   # Prisma migrations
│   └── seed.ts                       # Seed test user + sample data
├── prisma.config.ts                  # Prisma 7 config (datasource URL)
├── generated/
│   └── prisma/                       # Prisma generated client (gitignored)
├── Dockerfile                        # Production build for Dokploy
├── .env.local                        # DATABASE_URL, API_KEY (gitignored)
├── next.config.ts
├── tsconfig.json
├── package.json
└── .gitignore
```

### Pattern 1: Prisma 7 Client Singleton with Adapter

**What:** Create one PrismaClient instance with the pg adapter and reuse it across requests. Next.js hot-reload in development creates multiple instances otherwise, exhausting connection pools.

**When:** Always. This is the single Prisma entry point for the entire application.

```typescript
// lib/db.ts
// Source: https://www.prisma.io/docs/ai/prompts/nextjs (Prisma 7 official)
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**CRITICAL:** In Prisma 7, the import path is `../generated/prisma/client` (or wherever the output is configured), NOT `@prisma/client`. Using the wrong import path will break the application silently.

### Pattern 2: Prisma 7 Configuration File

**What:** The `prisma.config.ts` file replaces the `url` field that was previously in `schema.prisma`. This is mandatory in Prisma 7.

```typescript
// prisma.config.ts
// Source: https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/postgresql
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

### Pattern 3: Service Layer as Plain TypeScript Modules

**What:** Business logic lives in plain TypeScript modules (not classes). Every function takes `userId` as the first parameter. Both web UI (API routes, Server Components) and the future MCP server call these identical functions.

**When:** All data operations. No business logic in route handlers.

```typescript
// lib/services/goal-service.ts
import { prisma } from "@/lib/db";
import { CreateGoalInput, UpdateGoalInput, GoalFilters } from "@/lib/validations";
import { validateHierarchy } from "@/lib/services/hierarchy-helpers";

export const goalService = {
  async list(userId: string, filters?: GoalFilters) {
    return prisma.goal.findMany({
      where: {
        userId,
        ...(filters?.horizon && { horizon: filters.horizon }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.categoryId && { categoryId: filters.categoryId }),
        ...(filters?.parentId !== undefined && { parentId: filters.parentId }),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { category: true },
    });
  },

  async create(userId: string, data: CreateGoalInput) {
    // Validate hierarchy rules before creation
    if (data.parentId) {
      await validateHierarchy(userId, data.parentId, data.horizon);
    }
    return prisma.goal.create({
      data: { ...data, userId },
    });
  },

  async getById(userId: string, id: string) {
    return prisma.goal.findFirst({
      where: { id, userId },
      include: {
        category: true,
        children: {
          orderBy: { sortOrder: "asc" },
        },
        parent: true,
      },
    });
  },

  async update(userId: string, id: string, data: UpdateGoalInput) {
    // If changing parent, validate hierarchy
    if (data.parentId !== undefined || data.horizon) {
      const existing = await prisma.goal.findFirst({ where: { id, userId } });
      if (!existing) throw new Error("Goal not found");
      const newParentId = data.parentId ?? existing.parentId;
      const newHorizon = data.horizon ?? existing.horizon;
      if (newParentId) {
        await validateHierarchy(userId, newParentId, newHorizon);
      }
    }
    return prisma.goal.update({
      where: { id },
      data,
    });
  },

  async delete(userId: string, id: string) {
    // Verify ownership
    const goal = await prisma.goal.findFirst({ where: { id, userId } });
    if (!goal) throw new Error("Goal not found");
    return prisma.goal.delete({ where: { id } });
  },
};
```

### Pattern 4: Hierarchy Validation

**What:** Enforce the strict parent-child relationship rules in the Service Layer. The database cannot express "a WEEKLY goal's parent must be MONTHLY" as a constraint.

```typescript
// lib/services/hierarchy-helpers.ts
import { prisma } from "@/lib/db";
import { Horizon } from "../../generated/prisma/client";

// Valid parent-child relationships
const VALID_PARENT_HORIZONS: Record<string, string | null> = {
  YEARLY: null,        // Yearly goals have no parent (top level)
  QUARTERLY: "YEARLY",
  MONTHLY: "QUARTERLY",
  WEEKLY: "MONTHLY",
};

export async function validateHierarchy(
  userId: string,
  parentId: string,
  childHorizon: string
): Promise<void> {
  const expectedParentHorizon = VALID_PARENT_HORIZONS[childHorizon];

  if (expectedParentHorizon === null) {
    throw new Error(`${childHorizon} goals cannot have a parent`);
  }

  const parent = await prisma.goal.findFirst({
    where: { id: parentId, userId },
  });

  if (!parent) {
    throw new Error("Parent goal not found");
  }

  if (parent.horizon !== expectedParentHorizon) {
    throw new Error(
      `A ${childHorizon} goal must have a ${expectedParentHorizon} parent, ` +
      `but the specified parent is ${parent.horizon}`
    );
  }
}
```

### Pattern 5: API Route Handler with Auth

**What:** Thin route handlers that validate the API key, parse input with Zod, call the Service Layer, and return JSON responses.

```typescript
// app/api/goals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { goalService } from "@/lib/services/goal-service";
import { createGoalSchema, goalFiltersSchema } from "@/lib/validations";
import { validateApiKey } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filters = goalFiltersSchema.parse({
    horizon: searchParams.get("horizon") || undefined,
    status: searchParams.get("status") || undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    parentId: searchParams.get("parentId") || undefined,
  });

  const goals = await goalService.list(authResult.userId, filters);
  return NextResponse.json(goals);
}

export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const data = createGoalSchema.parse(body);
  const goal = await goalService.create(authResult.userId, data);
  return NextResponse.json(goal, { status: 201 });
}
```

### Pattern 6: API Key Authentication

**What:** Simple Bearer token lookup against the User table. No sessions, no JWT, no external auth provider for v1.

```typescript
// lib/auth.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

type AuthResult =
  | { success: true; userId: string }
  | { success: false };

export async function validateApiKey(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { success: false };
  }

  const apiKey = authHeader.slice(7);
  const user = await prisma.user.findUnique({
    where: { apiKey },
  });

  if (!user) {
    return { success: false };
  }

  return { success: true, userId: user.id };
}
```

### Anti-Patterns to Avoid

- **Putting business logic in route handlers:** Route handlers should only parse input, call the Service Layer, and format the response. All validation, hierarchy checks, and data transformations belong in the Service Layer.
- **Using `@prisma/client` import in Prisma 7:** The import path must point to the generated output directory. Using the old import path fails silently or throws confusing errors.
- **Skipping the Prisma adapter:** Prisma 7 requires the driver adapter pattern. Trying to use PrismaClient without an adapter will fail.
- **Putting `url` in schema.prisma datasource block:** In Prisma 7, the URL is configured in `prisma.config.ts`, not in the schema file. The schema datasource block only specifies the provider.
- **Creating complex auth infrastructure for v1:** Hardcoded single user with API key is sufficient. No auth UI, no login page, no session management until multi-user SaaS conversion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database migrations | Manual SQL scripts | `prisma migrate dev` / `prisma migrate deploy` | Migration ordering, rollback tracking, schema drift detection |
| Database client types | Manual TypeScript interfaces | Prisma generated types | Auto-generated from schema, always in sync, includes relation types |
| Input validation | Custom validation functions | Zod schemas | Composable, type inference, error messages, reusable across API/MCP/forms |
| Connection pooling | Manual pg.Pool management | Prisma adapter-pg with singleton | Handles pool lifecycle, reconnection, cleanup automatically |
| SSL certificates | Manual certbot | Dokploy/Traefik auto-SSL | Automatic provisioning and renewal via Let's Encrypt |
| Dockerfile | Writing from scratch | Next.js official Dockerfile example | Optimized multi-stage build with standalone output |

**Key insight:** Phase 1 is scaffolding and data layer. Every tool here has a well-documented, standardized setup process. The risk is not in choosing tools but in configuring them incorrectly (especially Prisma 7's new adapter pattern).

## Common Pitfalls

### Pitfall 1: Wrong Prisma 7 Import Path

**What goes wrong:** Developer installs Prisma 7, writes `import { PrismaClient } from "@prisma/client"` as they would in older versions, and gets runtime errors or missing types.
**Why it happens:** Prisma 7 generates the client to a custom output directory specified in `schema.prisma`. The `@prisma/client` package no longer exports PrismaClient directly.
**How to avoid:** Configure `output` in the generator block and always import from that path. Example: `import { PrismaClient } from "../generated/prisma/client"`.
**Warning signs:** TypeScript cannot find `PrismaClient` type, or runtime error about missing constructor.

### Pitfall 2: Missing prisma.config.ts Database URL

**What goes wrong:** Developer puts the database URL in `schema.prisma` as `url = env("DATABASE_URL")` inside the datasource block (the Prisma 5/6 pattern), then gets errors when running migrations.
**Why it happens:** Prisma 7 moved the datasource URL to `prisma.config.ts`. The schema datasource block only declares the provider.
**How to avoid:** Use `prisma.config.ts` with `defineConfig()` to set the datasource URL. Only put `provider = "postgresql"` in the schema datasource block.
**Warning signs:** `prisma migrate dev` fails with "datasource URL not configured" or similar.

### Pitfall 3: Prisma Client Without Adapter

**What goes wrong:** Developer creates `new PrismaClient()` without passing an adapter, expecting it to work like Prisma 5/6.
**Why it happens:** Prisma 7 moved to a driver adapter architecture. The old built-in Rust engine is removed.
**How to avoid:** Always create the adapter first (`new PrismaPg({ connectionString })`) and pass it to `PrismaClient({ adapter })`.
**Warning signs:** Error about missing engine binary, or "adapter is required" error message.

### Pitfall 4: Multiple Prisma Client Instances in Development

**What goes wrong:** Every hot reload creates a new PrismaClient, each with its own connection pool. After several saves, the database runs out of connections.
**Why it happens:** Next.js development server hot-reloads modules, re-executing module-level code.
**How to avoid:** Attach the PrismaClient to `globalThis` so it persists across hot reloads. See the singleton pattern in Architecture Patterns above.
**Warning signs:** "Too many clients already" or connection pool exhaustion errors during development.

### Pitfall 5: Hierarchy Validation as Database Constraint

**What goes wrong:** Developer tries to enforce "WEEKLY goals can only parent under MONTHLY" using PostgreSQL CHECK constraints or triggers.
**Why it happens:** It seems cleaner to enforce at the database level.
**How to avoid:** Enforce hierarchy rules in the Service Layer. PostgreSQL CHECK constraints cannot reference other rows (you would need a trigger, which adds complexity and makes the logic invisible to the application layer). The Service Layer validation is transparent, testable, and gives clear error messages.
**Warning signs:** Complex trigger functions in migration files, or hierarchy violations slipping through because the trigger has edge cases.

### Pitfall 6: Deploying Without Testing Dokploy Setup First

**What goes wrong:** Developer writes all the code locally, then tries to deploy to Dokploy and discovers that the Dockerfile does not work, environment variables are not passed correctly, or the PostgreSQL internal networking is misconfigured.
**Why it happens:** Local development uses `next dev` with a local database. Dokploy uses Docker with an overlay network.
**How to avoid:** Deploy the bare scaffold (placeholder page) to Dokploy first, before writing any business logic. Verify the build, the domain, SSL, and database connectivity early. Add code on top of a working deployment.
**Warning signs:** "Connection refused" errors to PostgreSQL, Dockerfile build failures, domain not resolving.

## Code Examples

### Complete Prisma Schema (Phase 1)

```prisma
// prisma/schema.prisma
// Source: ARCHITECTURE.md research + Prisma 7 official docs

generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id        String     @id @default(cuid())
  email     String?    @unique
  name      String?
  apiKey    String     @unique @default(cuid())

  goals      Goal[]
  categories Category[]
  stats      UserStats?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Horizon {
  YEARLY
  QUARTERLY
  MONTHLY
  WEEKLY
}

enum GoalStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  ABANDONED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
}

model Goal {
  id          String     @id @default(cuid())
  userId      String
  title       String
  description String?
  horizon     Horizon
  status      GoalStatus @default(NOT_STARTED)
  priority    Priority   @default(MEDIUM)

  // Hierarchy (adjacency list)
  parentId    String?
  parent      Goal?      @relation("GoalHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children    Goal[]     @relation("GoalHierarchy")

  // Category
  categoryId  String?
  category    Category?  @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  // SMART fields (primarily for YEARLY and QUARTERLY)
  specific    String?
  measurable  String?
  attainable  String?
  relevant    String?
  timely      String?

  // Progress tracking
  progress     Int       @default(0)
  targetValue  Float?
  currentValue Float?
  unit         String?

  // Dates
  startDate   DateTime?
  deadline    DateTime?
  completedAt DateTime?

  // Ordering
  sortOrder   Int        @default(0)

  // Notes
  notes       String?

  // Relations
  progressLogs ProgressLog[]
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([userId])
  @@index([parentId])
  @@index([categoryId])
  @@index([horizon, userId])
  @@index([status, userId])
  @@index([deadline])
}

model Category {
  id        String     @id @default(cuid())
  userId    String
  name      String
  color     String     @default("#4F46E5")
  icon      String?

  // Hierarchy (unlimited nesting)
  parentId  String?
  parent    Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children  Category[] @relation("CategoryHierarchy")

  // Ordering
  sortOrder Int        @default(0)

  // Relations
  goals     Goal[]
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@unique([userId, name, parentId])
  @@index([userId])
  @@index([parentId])
}

model ProgressLog {
  id        String   @id @default(cuid())
  goalId    String
  goal      Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
  value     Float
  note      String?
  createdAt DateTime @default(now())

  @@index([goalId])
  @@index([createdAt])
}

model UserStats {
  id              String    @id @default(cuid())
  userId          String    @unique
  totalXp         Int       @default(0)
  level           Int       @default(1)
  currentStreak   Int       @default(0)
  longestStreak   Int       @default(0)
  lastActiveDate  DateTime?
  weeklyScore     Int       @default(0)
  weekStartDate   DateTime?
  goalsCompleted  Int       @default(0)

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  updatedAt       DateTime  @updatedAt
}

model XpEvent {
  id        String   @id @default(cuid())
  userId    String
  amount    Int
  source    String
  goalId    String?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
}
```

### Seed Script

```typescript
// prisma/seed.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Upsert test user (idempotent)
  const user = await prisma.user.upsert({
    where: { email: "amadej@ascend.local" },
    update: {},
    create: {
      email: "amadej@ascend.local",
      name: "Amadej",
      apiKey: process.env.API_KEY || "ascend-dev-key-change-me",
    },
  });

  console.log("Seeded user:", user.id, "apiKey:", user.apiKey);

  // Upsert initial stats
  await prisma.userStats.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  console.log("Seeded user stats");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Zod Validation Schemas

```typescript
// lib/validations.ts
import { z } from "zod";

export const horizonEnum = z.enum(["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"]);
export const statusEnum = z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"]);
export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  horizon: horizonEnum,
  parentId: z.string().optional(),
  categoryId: z.string().optional(),
  priority: priorityEnum.default("MEDIUM"),
  startDate: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
  specific: z.string().optional(),
  measurable: z.string().optional(),
  attainable: z.string().optional(),
  relevant: z.string().optional(),
  timely: z.string().optional(),
  targetValue: z.number().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

export const updateGoalSchema = createGoalSchema.partial().extend({
  status: statusEnum.optional(),
  progress: z.number().min(0).max(100).optional(),
  currentValue: z.number().optional(),
  sortOrder: z.number().optional(),
});

export const goalFiltersSchema = z.object({
  horizon: horizonEnum.optional(),
  status: statusEnum.optional(),
  categoryId: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#4F46E5"),
  icon: z.string().optional(),
  parentId: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  sortOrder: z.number().optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type GoalFilters = z.infer<typeof goalFiltersSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
```

### Raw SQL Tree Query Utility

```typescript
// lib/tree-queries.ts
import { prisma } from "@/lib/db";
import { Prisma } from "../../generated/prisma/client";

interface TreeNode {
  id: string;
  title: string;
  parentId: string | null;
  horizon: string;
  progress: number;
  depth: number;
}

/**
 * Get all descendants of a goal using a recursive CTE.
 * Used for progress rollup and cascade operations.
 */
export async function getDescendants(
  goalId: string,
  userId: string
): Promise<TreeNode[]> {
  return prisma.$queryRaw<TreeNode[]>`
    WITH RECURSIVE goal_tree AS (
      SELECT id, title, "parentId", horizon::text, progress, 0 as depth
      FROM "Goal"
      WHERE id = ${goalId} AND "userId" = ${userId}
      UNION ALL
      SELECT g.id, g.title, g."parentId", g.horizon::text, g.progress, gt.depth + 1
      FROM "Goal" g
      JOIN goal_tree gt ON g."parentId" = gt.id
    )
    SELECT * FROM goal_tree WHERE depth > 0
    ORDER BY depth, "parentId"
  `;
}

/**
 * Get all ancestors of a goal (for breadcrumb display).
 */
export async function getAncestors(
  goalId: string,
  userId: string
): Promise<TreeNode[]> {
  return prisma.$queryRaw<TreeNode[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, title, "parentId", horizon::text, progress, 0 as depth
      FROM "Goal"
      WHERE id = ${goalId} AND "userId" = ${userId}
      UNION ALL
      SELECT g.id, g.title, g."parentId", g.horizon::text, g.progress, a.depth + 1
      FROM "Goal" g
      JOIN ancestors a ON g.id = a."parentId"
    )
    SELECT * FROM ancestors WHERE depth > 0
    ORDER BY depth DESC
  `;
}
```

### Dockerfile for Dokploy

```dockerfile
# Dockerfile
# Source: Next.js official deployment docs
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma files for migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Note:** The `next.config.ts` must include `output: "standalone"` for the Dockerfile to work:

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16 (2026) | File rename; runs on Node.js not Edge. Phase 1 does not use it (auth in route handlers). |
| Prisma built-in Rust engine | Driver adapter (`@prisma/adapter-pg`) | Prisma 7.0 (Jan 2026) | Must install pg driver separately, create adapter, pass to PrismaClient. |
| `url` in schema.prisma datasource | `prisma.config.ts` with `defineConfig()` | Prisma 7.0 (Jan 2026) | Database URL moves to config file. Schema only declares provider. |
| `import { PrismaClient } from "@prisma/client"` | `import { PrismaClient } from "../generated/prisma/client"` | Prisma 7.0 (Jan 2026) | Client generated to custom output directory. Old import path breaks. |
| `next lint` built-in command | ESLint CLI directly (`eslint .`) | Next.js 16 (2026) | `next lint` removed. Use ESLint or Biome directly via npm scripts. |
| Turbopack opt-in (`--turbopack` flag) | Turbopack default | Next.js 16 (2026) | `next dev` uses Turbopack by default. Use `--webpack` flag if needed. |
| `generator client { provider = "prisma-client-js" }` | `generator client { provider = "prisma-client" }` | Prisma 7.0 (Jan 2026) | Provider name changed. Using old name may produce warnings or errors. |

**Deprecated/outdated:**
- `@prisma/client` direct import: Use the generated output path instead
- `middleware.ts`: Renamed to `proxy.ts` in Next.js 16
- `next lint`: Removed in Next.js 16; use ESLint CLI directly
- Prisma Rust engine: Replaced by driver adapters in Prisma 7

## Deployment Pipeline

### Dokploy Setup Steps

1. **Create PostgreSQL service** in Dokploy (dokploy-personal account):
   - Use Dokploy's managed PostgreSQL service
   - Note the internal connection URL (format: `postgresql://user:pass@internal-host:5432/dbname`)
   - The database is accessible only within the dokploy-network (overlay network)

2. **Create Application service** in Dokploy:
   - Source: GitHub repository (amadejdemsar-create account)
   - Build type: Dockerfile
   - Set environment variables:
     - `DATABASE_URL`: Internal PostgreSQL connection URL from step 1
     - `API_KEY`: A secure random string for MCP authentication
     - `NODE_ENV`: production

3. **Configure domain**:
   - Domain: `ascend.nativeai.agency`
   - Traefik auto-provisions SSL via Let's Encrypt
   - Container port: 3000

4. **Enable auto-deploy**:
   - Configure GitHub webhook for the repository
   - Pushes to main trigger automatic rebuilds and deployments

5. **Run migrations on deploy**:
   - Option A: Add to Dockerfile CMD: `npx prisma migrate deploy && node server.js`
   - Option B: Use Dokploy's pre-deploy command feature to run migrations before starting the app

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://ascend:password@postgres-internal:5432/ascend` |
| `API_KEY` | Bearer token for API authentication | `asc_live_xxxxxxxxxxxxx` (generate with `openssl rand -hex 32`) |
| `NODE_ENV` | Runtime environment | `production` |

## Open Questions

1. **Prisma 7 output directory with Next.js standalone build**
   - What we know: Prisma 7 generates the client to a custom directory (e.g., `generated/prisma`). The standalone build copies only required files.
   - What's unclear: Whether the Dockerfile correctly copies all Prisma artifacts needed at runtime (generated client, adapter binaries, node_modules dependencies).
   - Recommendation: Test the Docker build locally before deploying to Dokploy. Verify `prisma migrate deploy` works inside the container. Adjust COPY statements in the Dockerfile if files are missing.

2. **Prisma migrate deploy in Docker**
   - What we know: Migrations need to run before the app starts. Prisma 7 requires `prisma.config.ts` for the datasource URL.
   - What's unclear: Whether `npx prisma migrate deploy` works correctly in the production container with the adapter pattern, or if it needs the `dotenv/config` import that `prisma.config.ts` provides.
   - Recommendation: Test migration deployment as part of the first Dokploy deployment. If `prisma migrate deploy` fails, try wrapping it in a small script that loads env vars explicitly.

3. **Next.js 16 AGENTS.md in create-next-app**
   - What we know: `create-next-app --yes` now includes an AGENTS.md file that guides AI coding agents.
   - What's unclear: Whether this conflicts with or complements the project's own CLAUDE.md.
   - Recommendation: Keep the generated AGENTS.md as it contains Next.js 16 specific patterns. Add a project CLAUDE.md separately for Ascend-specific conventions.

## Sources

### Primary (HIGH confidence)
- [Next.js 16 Installation Guide](https://nextjs.org/docs/app/getting-started/installation) - create-next-app defaults, system requirements, project structure
- [Next.js 16 proxy.ts](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) - middleware rename confirmation
- [Prisma 7 Quickstart with PostgreSQL](https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/postgresql) - adapter-pg pattern, prisma.config.ts, client initialization
- [Prisma + Next.js Official Guide](https://www.prisma.io/docs/ai/prompts/nextjs) - singleton pattern with adapter, import path for generated client
- [Prisma Seeding Documentation](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding) - seed configuration in prisma.config.ts
- [Dokploy Next.js Deployment](https://docs.dokploy.com/docs/core/nextjs) - build types, domain configuration, auto-deploy
- [Dokploy Database Connection](https://docs.dokploy.com/docs/core/databases/connection) - internal networking, connection URLs
- [mcp-handler GitHub](https://github.com/vercel/mcp-handler) - version 1.0.7, Next.js route handler pattern, auth wrapper

### Secondary (MEDIUM confidence)
- [Prisma 7 + Next.js 16 Guide (Medium)](https://medium.com/@gauravkmaurya09/guide-to-prisma-7-with-next-js-16-javascript-edition-99c8c4ca10be) - confirmed singleton pattern with adapter
- [Dokploy VPS Setup Guide 2026](https://1vps.com/dokploy-vps-guide/) - Docker Swarm overlay networking, auto-SSL
- [Next.js Upgrading to v16](https://nextjs.org/docs/app/guides/upgrading/version-16) - proxy.ts rename, async APIs, linting changes

### Tertiary (LOW confidence)
- None. All findings verified against official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, all versions verified against npmjs.com and official docs on 2026-03-30
- Architecture: HIGH, Service Layer pattern from ARCHITECTURE.md research, Prisma 7 patterns verified against official docs
- Pitfalls: HIGH, Prisma 7 breaking changes verified against multiple official and community sources
- Deployment: MEDIUM-HIGH, Dokploy patterns verified against docs but exact Prisma 7 Docker behavior needs empirical testing

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable technologies, 30-day window)

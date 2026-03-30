# Architecture Patterns

**Domain:** Personal goal tracking web app with MCP server
**Researched:** 2026-03-30

## Recommended Architecture

Ascend is a Next.js 15 App Router application with an embedded MCP server, a PostgreSQL database accessed through Prisma ORM, and a client layer combining server components, React Query for server state, and Zustand for UI state. The system exposes two interfaces to the same data: a web UI (SSR pages with interactive client components) and an MCP endpoint (Streamable HTTP at `/api/mcp`).

```
┌──────────────────────────────────────────────────────┐
│                    CLIENTS                           │
│                                                      │
│  ┌─────────────┐    ┌──────────────────────────────┐ │
│  │  Browser     │    │  MCP Clients                 │ │
│  │  (Web UI)    │    │  (Claude, ChatGPT, Gemini,   │ │
│  │              │    │   Cursor, etc.)               │ │
│  └──────┬───────┘    └──────────────┬───────────────┘ │
└─────────┼───────────────────────────┼────────────────┘
          │                           │
          │ HTTP (pages + API)        │ HTTP POST + SSE
          │                           │ (JSON-RPC 2.0)
          ▼                           ▼
┌──────────────────────────────────────────────────────┐
│              NEXT.JS APP (App Router)                │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  Pages / Layouts  │  │  Route Handler            │  │
│  │  (RSC + Client)   │  │  /api/[transport]/route   │  │
│  │                    │  │  (MCP Server)             │  │
│  └────────┬───────────┘  └────────────┬─────────────┘  │
│           │                           │                │
│           ▼                           ▼                │
│  ┌───────────────────────────────────────────────────┐ │
│  │              SERVICE LAYER                        │ │
│  │  (Shared business logic: goals, categories,       │ │
│  │   gamification, progress, export)                 │ │
│  └────────────────────┬──────────────────────────────┘ │
│                       │                                │
│                       ▼                                │
│  ┌───────────────────────────────────────────────────┐ │
│  │              DATA ACCESS LAYER                    │ │
│  │  (Prisma Client, typed queries, transactions)     │ │
│  └────────────────────┬──────────────────────────────┘ │
└───────────────────────┼────────────────────────────────┘
                        │
                        ▼
               ┌─────────────────┐
               │   PostgreSQL    │
               │  (Dokploy VPS)  │
               └─────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Pages / Layouts (RSC)** | Server-side rendering, initial data loading, SEO, layout structure | Service Layer (direct import), Client Components (props) |
| **Client Components** | Interactive UI (drag-and-drop, command palette, timeline, animations, forms) | API Routes (via React Query), Zustand stores |
| **API Route Handlers** | REST-like endpoints for mutations and queries from client components | Service Layer (direct import) |
| **MCP Route Handler** | Streamable HTTP endpoint exposing tools for AI clients via JSON-RPC 2.0 | Service Layer (direct import) |
| **Service Layer** | Business logic: CRUD, hierarchy traversal, gamification calculations, export generation | Data Access Layer |
| **Data Access Layer** | Prisma Client wrapper with typed queries, transactions, connection pooling | PostgreSQL |
| **Zustand Stores** | Client-side UI state: sidebar collapse, active view, drag state, command palette open/close, theme | Client Components (hooks) |
| **React Query** | Server state cache: goal lists, category trees, dashboard stats, progress data | API Routes (fetch), Client Components (hooks) |

### Data Flow

**Web UI Read Flow:**
1. User navigates to a page (e.g., `/goals`)
2. Server Component fetches data via Service Layer (direct function call, no HTTP roundtrip)
3. Data passed as props to Client Components
4. Client Components hydrate; React Query takes over for subsequent fetches and cache management
5. User interactions (filtering, view switching) trigger React Query refetches to API routes

**Web UI Write Flow:**
1. User creates/updates a goal via form or drag-and-drop
2. Client Component calls API route via React Query mutation
3. API Route Handler calls Service Layer
4. Service Layer validates, computes gamification side effects (XP, streaks), runs Prisma transaction
5. Response returns; React Query invalidates relevant caches
6. UI updates optimistically (for drag-and-drop) or on cache invalidation

**MCP Flow:**
1. AI client POSTs to `/api/mcp` with `initialize` JSON-RPC request
2. Server responds with capabilities and session ID
3. AI client calls `tools/list` to discover available tools
4. AI client calls `tools/call` with tool name and arguments (e.g., `create_goal`, `list_goals`, `update_progress`)
5. MCP Route Handler calls the same Service Layer functions the web UI uses
6. Response returned as JSON-RPC result

This architecture ensures **zero code duplication** between web UI and MCP: both interfaces call identical Service Layer functions.

## Database Schema Design

### Goal Hierarchy (Self-Referencing One-to-Many)

The goal hierarchy uses Prisma's one-to-many self-relation pattern. Each goal has an optional `parentId` pointing to another goal, plus a `horizon` enum to enforce the four levels. **Confidence: HIGH** (verified against Prisma official docs on self-relations).

```prisma
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
  ARCHIVED
  CANCELLED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model Goal {
  id          String     @id @default(cuid())
  userId      String
  title       String
  description String?
  horizon     Horizon
  status      GoalStatus @default(NOT_STARTED)
  priority    Priority   @default(MEDIUM)

  // Hierarchy (self-referencing one-to-many)
  parentId    String?
  parent      Goal?      @relation("GoalHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children    Goal[]     @relation("GoalHierarchy")

  // Category
  categoryId  String?
  category    Category?  @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  // SMART fields (used for YEARLY and QUARTERLY)
  specific    String?
  measurable  String?
  attainable  String?
  relevant    String?
  timely      String?

  // Tracking
  progress    Int        @default(0)  // 0-100
  targetValue Float?                  // For measurable goals
  currentValue Float?

  // Dates
  startDate   DateTime?
  deadline    DateTime?
  completedAt DateTime?

  // Recurring
  isRecurring Boolean    @default(false)
  frequency   String?    // "daily", "weekly", "monthly"

  // Ordering
  sortOrder   Int        @default(0)

  // Notes
  notes       String?

  // Relations
  progressLogs ProgressLog[]

  // Timestamps
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  // Multi-user support
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([parentId])
  @@index([categoryId])
  @@index([horizon, userId])
  @@index([status, userId])
  @@index([deadline])
}
```

**Key design decisions for the hierarchy:**

1. **`parentId` as nullable FK** allows top-level goals (yearly goals have no parent) while enabling arbitrary parent-child linking. This follows the standard adjacency list pattern.

2. **`onDelete: SetNull`** on the parent relation means deleting a parent goal orphans its children rather than cascading deletion. This is safer; the user can reassign orphaned goals.

3. **Indexes on `parentId` and `horizon`** make hierarchy queries fast. Fetching "all quarterly goals under yearly goal X" is `WHERE parentId = X AND horizon = 'QUARTERLY'`.

4. **Hierarchy validation in the Service Layer, not the database.** PostgreSQL cannot enforce "a WEEKLY goal's parent must be MONTHLY" via constraints. The Service Layer validates this: `YEARLY -> QUARTERLY -> MONTHLY -> WEEKLY` is the only allowed parent chain. Skipping levels (e.g., YEARLY -> WEEKLY) should be rejected.

### Querying the Hierarchy Efficiently

Prisma does not natively support recursive CTEs, so full tree queries require one of two approaches:

**Approach A: Nested Prisma includes (recommended for v1).** For the four-level hierarchy, the maximum depth is 4, so a fixed-depth include works perfectly:

```typescript
const goalTree = await prisma.goal.findMany({
  where: { userId, horizon: 'YEARLY', parentId: null },
  include: {
    children: {
      include: {
        children: {
          include: {
            children: true  // weekly level
          }
        }
      }
    }
  }
});
```

This generates a single SQL query with JOINs. For a fixed 4-level hierarchy, this is efficient and type-safe.

**Approach B: Raw SQL recursive CTE (for advanced queries like "all descendants of goal X").** Use `prisma.$queryRaw` with a recursive CTE when you need to traverse an unknown depth or compute aggregate progress up the tree:

```sql
WITH RECURSIVE goal_tree AS (
  SELECT id, title, parent_id, progress, horizon, 0 as depth
  FROM "Goal"
  WHERE id = $1 AND user_id = $2
  UNION ALL
  SELECT g.id, g.title, g.parent_id, g.progress, g.horizon, gt.depth + 1
  FROM "Goal" g
  JOIN goal_tree gt ON g.parent_id = gt.id
)
SELECT * FROM goal_tree;
```

**Recommendation:** Use Approach A (nested includes) for all standard reads. Reserve Approach B for the progress rollup computation, where you need to calculate a parent's progress from all descendants.

### Category Tree (Self-Referencing with Unlimited Nesting)

Categories also use a self-referencing relation but with unlimited depth:

```prisma
model Category {
  id          String     @id @default(cuid())
  userId      String
  name        String
  color       String     @default("#4F46E5")  // hex color
  icon        String?                          // Lucide icon name

  // Hierarchy
  parentId    String?
  parent      Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children    Category[] @relation("CategoryHierarchy")

  // Ordering
  sortOrder   Int        @default(0)

  // Relations
  goals       Goal[]

  // Timestamps
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, name, parentId])
  @@index([userId])
  @@index([parentId])
}
```

**Key difference from goals:** Categories use `onDelete: Cascade` because deleting a parent category should remove its children. Goals within deleted categories get their `categoryId` set to null (handled by `onDelete: SetNull` on the Goal's category relation).

For the category tree, fetch all categories for a user (typically fewer than 50) in a single query and build the tree in memory on the server. No recursive queries needed.

### Progress and Gamification

```prisma
model ProgressLog {
  id        String   @id @default(cuid())
  goalId    String
  goal      Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
  value     Float    // increment value
  note      String?
  createdAt DateTime @default(now())

  @@index([goalId])
  @@index([createdAt])
}

model UserStats {
  id              String   @id @default(cuid())
  userId          String   @unique
  totalXp         Int      @default(0)
  level           Int      @default(1)
  currentStreak   Int      @default(0)
  longestStreak   Int      @default(0)
  lastActiveDate  DateTime?
  weeklyScore     Int      @default(0)
  weekStartDate   DateTime?
  goalsCompleted  Int      @default(0)

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  updatedAt       DateTime @updatedAt
}

model XpEvent {
  id        String   @id @default(cuid())
  userId    String
  amount    Int
  source    String   // "goal_completed", "streak_bonus", "progress_logged", "weekly_bonus"
  goalId    String?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
}
```

**Gamification computation approach:**
1. XP is calculated in the Service Layer on each action (goal completion, progress log, streak maintenance).
2. `UserStats` is a denormalized aggregate updated transactionally with each XP-granting action.
3. Level thresholds are defined as a constant array in code (e.g., `[0, 100, 300, 600, 1000, ...]`), not in the database.
4. Streak tracking: compare `lastActiveDate` with today. If consecutive, increment `currentStreak`. If gap, reset to 1. Run this check when any progress is logged.
5. Weekly score resets each Monday (compare `weekStartDate` with current week start).

### User Model

```prisma
model User {
  id        String   @id @default(cuid())
  email     String?  @unique
  name      String?
  apiKey    String   @unique @default(cuid())  // For MCP auth in v1

  goals       Goal[]
  categories  Category[]
  stats       UserStats?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

For v1 (single user), the user record is seeded during setup. The `apiKey` field enables MCP authentication via bearer token.

## MCP Server Integration with Next.js

### Architecture: `mcp-handler` in a Next.js Route Handler

**Confidence: HIGH** (verified against mcp-handler source and Vercel documentation).

The MCP server is embedded directly in the Next.js app using Vercel's `mcp-handler` package, which wraps the `@modelcontextprotocol/sdk` and handles Streamable HTTP transport within a Next.js App Router route handler.

**File:** `app/api/[transport]/route.ts`

```typescript
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { goalService } from "@/lib/services/goal-service";
import { categoryService } from "@/lib/services/category-service";
import { gamificationService } from "@/lib/services/gamification-service";
import { validateApiKey } from "@/lib/auth";

const handler = createMcpHandler(
  (server) => {
    // Goal tools
    server.tool(
      "list_goals",
      "List goals with optional filtering by horizon, status, category.",
      {
        horizon: z.enum(["YEARLY","QUARTERLY","MONTHLY","WEEKLY"]).optional(),
        status: z.enum(["NOT_STARTED","IN_PROGRESS","COMPLETED"]).optional(),
        categoryId: z.string().optional(),
        parentId: z.string().optional(),
      },
      async (params) => {
        const goals = await goalService.list(userId, params);
        return { content: [{ type: "text", text: JSON.stringify(goals, null, 2) }] };
      }
    );

    server.tool("create_goal", "Create a new goal.", { /* schema */ }, async (params) => {
      const goal = await goalService.create(userId, params);
      return { content: [{ type: "text", text: JSON.stringify(goal, null, 2) }] };
    });

    // ... more tools mirroring every web UI capability
  },
  {},
  { basePath: "/api", maxDuration: 60 }
);

export { handler as GET, handler as POST };
```

**Key architectural points:**

1. **The `[transport]` dynamic segment** allows `mcp-handler` to handle both the `/api/mcp` endpoint and SSE connections through the same route file.

2. **Authentication:** Validate the API key from the `Authorization: Bearer <key>` header before processing any tool call. The `mcp-handler` supports middleware patterns for this.

3. **Session management:** The MCP SDK handles session IDs automatically via `MCP-Session-Id` headers. For a single-user app on one server, in-memory sessions suffice. For multi-instance deployments, session state would need Redis (not needed for v1).

4. **Tool design:** Each MCP tool maps 1:1 to a Service Layer function. The MCP handler is a thin adapter that validates input (via Zod schemas), calls the service, and formats the response.

### MCP Tools to Implement

Every web UI capability must have a corresponding MCP tool:

| Tool | Description | Service Function |
|------|-------------|------------------|
| `list_goals` | Filter/sort goals | `goalService.list()` |
| `get_goal` | Get single goal with children | `goalService.getById()` |
| `create_goal` | Create goal (simple or SMART) | `goalService.create()` |
| `update_goal` | Update any goal field | `goalService.update()` |
| `delete_goal` | Delete goal | `goalService.delete()` |
| `move_goal` | Change parent/horizon | `goalService.move()` |
| `log_progress` | Add progress increment | `goalService.logProgress()` |
| `list_categories` | Get category tree | `categoryService.listTree()` |
| `create_category` | Create category | `categoryService.create()` |
| `update_category` | Update category | `categoryService.update()` |
| `delete_category` | Delete category | `categoryService.delete()` |
| `get_dashboard` | Get dashboard summary | `dashboardService.getSummary()` |
| `get_stats` | Get gamification stats | `gamificationService.getStats()` |
| `export_goals` | Export in format | `exportService.export()` |
| `search_goals` | Full-text search | `goalService.search()` |

## API Layer Design

### Dual Interface Pattern

The API layer serves two distinct consumers through a shared Service Layer:

**1. Internal API Routes (for web UI)**

Located at `app/api/goals/route.ts`, `app/api/categories/route.ts`, etc. These are standard Next.js Route Handlers using REST conventions:

```
GET    /api/goals              -> goalService.list()
POST   /api/goals              -> goalService.create()
GET    /api/goals/[id]         -> goalService.getById()
PATCH  /api/goals/[id]         -> goalService.update()
DELETE /api/goals/[id]         -> goalService.delete()
POST   /api/goals/[id]/progress -> goalService.logProgress()

GET    /api/categories         -> categoryService.listTree()
POST   /api/categories         -> categoryService.create()
...

GET    /api/dashboard          -> dashboardService.getSummary()
GET    /api/stats              -> gamificationService.getStats()
POST   /api/export             -> exportService.export()
```

**2. MCP Endpoint (for AI clients)**

Single endpoint at `/api/mcp` handling all operations through MCP tools (see above).

**3. Server Components (direct access)**

Server Components in the App Router can call Service Layer functions directly without HTTP roundtrips. This is the preferred path for initial page loads:

```typescript
// app/goals/page.tsx (Server Component)
import { goalService } from "@/lib/services/goal-service";

export default async function GoalsPage() {
  const goals = await goalService.list(userId, { horizon: "WEEKLY" });
  return <GoalListClient initialData={goals} />;
}
```

### Service Layer Structure

Each service is a plain TypeScript module exporting functions. No classes needed for a single-instance app.

```typescript
// lib/services/goal-service.ts
export const goalService = {
  list: async (userId: string, filters: GoalFilters) => { /* ... */ },
  getById: async (userId: string, id: string) => { /* ... */ },
  create: async (userId: string, data: CreateGoalInput) => { /* ... */ },
  update: async (userId: string, id: string, data: UpdateGoalInput) => { /* ... */ },
  delete: async (userId: string, id: string) => { /* ... */ },
  move: async (userId: string, id: string, newParentId: string | null, newHorizon: Horizon) => { /* ... */ },
  logProgress: async (userId: string, id: string, value: number, note?: string) => { /* ... */ },
  search: async (userId: string, query: string) => { /* ... */ },
  getTree: async (userId: string) => { /* ... */ },
};
```

Every function takes `userId` as the first parameter. This enforces multi-user data isolation even in v1.

## State Management

### Split Approach: React Query + Zustand

**React Query (TanStack Query)** handles all server state. This includes goals, categories, dashboard stats, gamification data. React Query provides caching, background refetching, optimistic updates, and cache invalidation, all of which are needed for a responsive goal-tracking UI.

**Zustand** handles client-only UI state that does not persist to the server:

```typescript
// lib/stores/ui-store.ts
interface UIStore {
  sidebarCollapsed: boolean;
  activeView: "list" | "board" | "tree" | "calendar" | "timeline";
  commandPaletteOpen: boolean;
  selectedGoalId: string | null;
  dragState: DragState | null;
  theme: "light" | "dark" | "system";
  // actions
  toggleSidebar: () => void;
  setActiveView: (view: string) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
}
```

**Why this split:** React Query eliminates the need for a complex state manager for server data (no Redux, no manual cache). Zustand is minimal (~1KB) and handles the remaining UI state without boilerplate. This combination is the dominant pattern in Next.js App Router projects as of 2025/2026.

### Optimistic Updates for Drag and Drop

When a user drags a goal to a new position or category, the UI updates immediately (optimistic update via React Query's `onMutate`), and the mutation runs in the background. If it fails, the UI reverts automatically via `onError` rollback.

## Component Architecture

### Page Structure

```
app/
├── layout.tsx                    # Root layout (fonts, theme, providers)
├── page.tsx                      # Dashboard (default landing)
├── goals/
│   ├── page.tsx                  # Goals view (list/board/tree/calendar/timeline)
│   └── [id]/
│       └── page.tsx              # Goal detail/edit page
├── timeline/
│   └── page.tsx                  # Full timeline visualization
├── archive/
│   └── page.tsx                  # Archived goals
├── settings/
│   └── page.tsx                  # User settings, export, API key
└── api/
    ├── [transport]/
    │   └── route.ts              # MCP server endpoint
    ├── goals/
    │   ├── route.ts              # GET list, POST create
    │   └── [id]/
    │       ├── route.ts          # GET, PATCH, DELETE
    │       └── progress/
    │           └── route.ts      # POST progress log
    ├── categories/
    │   ├── route.ts
    │   └── [id]/
    │       └── route.ts
    ├── dashboard/
    │   └── route.ts
    ├── stats/
    │   └── route.ts
    └── export/
        └── route.ts
```

### Component Breakdown

```
components/
├── layout/
│   ├── sidebar.tsx               # Desktop sidebar navigation
│   ├── bottom-tabs.tsx           # Mobile bottom tab bar
│   ├── header.tsx                # Page header with breadcrumbs
│   └── command-palette.tsx       # Cmd+K dialog (cmdk library)
├── goals/
│   ├── goal-card.tsx             # Goal card (used in list, board, tree)
│   ├── goal-form.tsx             # Create/edit form (modal for SMART, inline for simple)
│   ├── goal-detail.tsx           # Full goal detail view
│   ├── goal-progress-bar.tsx     # Animated progress bar
│   ├── quick-add.tsx             # Inline quick-add input
│   └── views/
│       ├── list-view.tsx         # Sortable/filterable list
│       ├── board-view.tsx        # Kanban board (by status or horizon)
│       ├── tree-view.tsx         # Hierarchical tree
│       ├── calendar-view.tsx     # Calendar with goal deadlines
│       └── timeline-view.tsx     # Horizontal timeline
├── categories/
│   ├── category-tree.tsx         # Nested category sidebar
│   ├── category-form.tsx         # Create/edit with color picker
│   └── category-badge.tsx        # Colored category pill
├── dashboard/
│   ├── weekly-focus.tsx          # This week's goals
│   ├── progress-overview.tsx     # Per-category progress
│   ├── streak-widget.tsx         # Current streak display
│   ├── xp-level-widget.tsx       # XP bar and level
│   └── upcoming-deadlines.tsx    # Deadline countdown
├── gamification/
│   ├── xp-bar.tsx                # Animated XP progress bar
│   ├── level-badge.tsx           # Level display
│   ├── streak-flame.tsx          # Streak fire icon with count
│   ├── completion-confetti.tsx   # Confetti animation on completion
│   └── weekly-score.tsx          # Weekly score tracker
├── filters/
│   ├── filter-bar.tsx            # Horizon/status/priority/category filters
│   └── view-switcher.tsx         # List/board/tree/calendar/timeline toggle
└── ui/
    └── (shadcn components)       # button, dialog, input, select, etc.
```

### Client vs Server Component Split

**Server Components (default):** Page layouts, initial data fetching, static content. The `page.tsx` files are Server Components that fetch data and pass it down.

**Client Components ("use client"):** Anything interactive. Goal cards (for drag-and-drop), forms, the command palette, view switchers, all dashboard widgets (for animations), the timeline visualization, and all Zustand/React Query consumers.

**Pattern:** Server Component fetches data, passes to Client Component as `initialData`, Client Component uses React Query to keep it fresh.

## File Structure

```
/Users/Shared/Domain/Code/Personal/goals/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                  # Dashboard
│   ├── goals/
│   ├── timeline/
│   ├── archive/
│   ├── settings/
│   └── api/
│       ├── [transport]/          # MCP endpoint
│       ├── goals/
│       ├── categories/
│       ├── dashboard/
│       ├── stats/
│       └── export/
├── components/                   # React components (see breakdown above)
│   ├── layout/
│   ├── goals/
│   ├── categories/
│   ├── dashboard/
│   ├── gamification/
│   ├── filters/
│   └── ui/                       # shadcn/ui components
├── lib/
│   ├── services/                 # Business logic (shared by web UI and MCP)
│   │   ├── goal-service.ts
│   │   ├── category-service.ts
│   │   ├── gamification-service.ts
│   │   ├── dashboard-service.ts
│   │   └── export-service.ts
│   ├── stores/                   # Zustand stores
│   │   └── ui-store.ts
│   ├── hooks/                    # React Query hooks
│   │   ├── use-goals.ts
│   │   ├── use-categories.ts
│   │   ├── use-dashboard.ts
│   │   └── use-stats.ts
│   ├── queries/                  # React Query key factories and query functions
│   │   └── keys.ts
│   ├── auth.ts                   # API key validation
│   ├── db.ts                     # Prisma client singleton
│   ├── constants.ts              # XP thresholds, level config, horizon rules
│   ├── validations.ts            # Zod schemas (shared between API and MCP)
│   └── utils.ts                  # Date helpers, formatting
├── prisma/
│   ├── schema.prisma             # Database schema
│   ├── migrations/               # Prisma migrations
│   └── seed.ts                   # Seed user + migrate from todos.json
├── public/
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service worker for offline read
│   └── icons/                    # PWA icons
├── .planning/                    # GSD planning files
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.local                    # DATABASE_URL, API_KEY
```

## Patterns to Follow

### Pattern 1: Shared Validation Schemas

**What:** Define Zod schemas once, use them in API routes, MCP tool definitions, and client-side forms.

**When:** Any data input from users or AI clients.

```typescript
// lib/validations.ts
import { z } from "zod";

export const createGoalSchema = z.object({
  title: z.string().min(1).max(200),
  horizon: z.enum(["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"]),
  parentId: z.string().optional(),
  categoryId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  deadline: z.string().datetime().optional(),
  // SMART fields (required for YEARLY/QUARTERLY, optional otherwise)
  specific: z.string().optional(),
  measurable: z.string().optional(),
  attainable: z.string().optional(),
  relevant: z.string().optional(),
  timely: z.string().optional(),
}).refine((data) => {
  if (data.horizon === "YEARLY" || data.horizon === "QUARTERLY") {
    return data.specific && data.measurable;
  }
  return true;
}, { message: "SMART fields required for yearly/quarterly goals" });
```

This single schema validates input in the API route, provides type inference for the Service Layer, and defines the parameter schema for the MCP tool.

### Pattern 2: Prisma Client Singleton

**What:** Create one Prisma Client instance and reuse it across requests.

**When:** Always. Next.js hot reload in development creates multiple Prisma instances otherwise.

```typescript
// lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### Pattern 3: Transactional Gamification Side Effects

**What:** When a goal is completed or progress is logged, update gamification stats (XP, streaks, level) within the same database transaction.

**When:** Any mutation that affects progress or completion status.

```typescript
// Inside goalService.logProgress()
await prisma.$transaction(async (tx) => {
  // 1. Create progress log
  await tx.progressLog.create({ data: { goalId, value, note } });

  // 2. Update goal progress
  const goal = await tx.goal.update({
    where: { id: goalId },
    data: { progress: newProgress, currentValue: newCurrentValue },
  });

  // 3. If goal just completed, award XP
  if (newProgress >= 100 && goal.status !== "COMPLETED") {
    await tx.goal.update({ where: { id: goalId }, data: { status: "COMPLETED", completedAt: new Date() } });
    await gamificationService.awardXp(tx, userId, "goal_completed", goalId);
  }

  // 4. Update streak
  await gamificationService.updateStreak(tx, userId);
});
```

### Pattern 4: React Query Key Factory

**What:** Centralize query keys for consistent cache invalidation.

```typescript
// lib/queries/keys.ts
export const queryKeys = {
  goals: {
    all: (userId: string) => ["goals", userId] as const,
    list: (userId: string, filters: GoalFilters) => ["goals", userId, "list", filters] as const,
    detail: (userId: string, id: string) => ["goals", userId, "detail", id] as const,
    tree: (userId: string) => ["goals", userId, "tree"] as const,
  },
  categories: {
    all: (userId: string) => ["categories", userId] as const,
    tree: (userId: string) => ["categories", userId, "tree"] as const,
  },
  dashboard: {
    summary: (userId: string) => ["dashboard", userId] as const,
  },
  stats: {
    user: (userId: string) => ["stats", userId] as const,
  },
};
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fetching Full Trees on Every Render

**What:** Recursively including all children of all goals on every page load.
**Why bad:** N+1 queries or extremely deep JOINs as the dataset grows. Causes slow page loads.
**Instead:** Fetch only the current view's data. For list view, fetch flat goal lists with filters. For tree view, fetch with a fixed depth include. Lazy-load deeper children on expand.

### Anti-Pattern 2: Duplicating Business Logic Between API Routes and MCP Tools

**What:** Writing validation and computation logic separately in each API route and each MCP tool handler.
**Why bad:** Logic drifts apart. A bug fix in one path does not apply to the other.
**Instead:** Use the Service Layer. Both API routes and MCP tools are thin wrappers that call the same service functions.

### Anti-Pattern 3: Storing Computed Gamification in the Client

**What:** Computing XP, level, or streak information in the browser based on raw data.
**Why bad:** AI clients via MCP would get different results. Computation is authoritative only on the server.
**Instead:** Compute all gamification values in the Service Layer and store them in `UserStats`. Both web UI and MCP read the same pre-computed values.

### Anti-Pattern 4: Using Server Actions for Everything

**What:** Replacing API routes entirely with Server Actions.
**Why bad:** Server Actions do not have a URL. The MCP server and any future external consumers need addressable endpoints. Server Actions are also harder to test independently.
**Instead:** Use API Route Handlers for mutations. Server Components can call Service Layer functions directly for reads. Reserve Server Actions for simple form submissions where a full API route is overkill (e.g., theme toggle, sidebar state).

## Scalability Considerations

| Concern | v1 (1 user) | Future SaaS (1K users) | Notes |
|---------|-------------|------------------------|-------|
| **Database connections** | Single Prisma Client, default pool | Prisma Accelerate or PgBouncer for connection pooling | Monitor connection count on VPS |
| **Goal count** | ~200 goals max | ~50K goals across users | Indexes on userId, horizon, status, parentId handle this |
| **MCP sessions** | In-memory, single instance | Redis-backed session store | Only needed if running multiple app instances |
| **Tree queries** | Nested includes (4 levels) | Materialized path or ltree extension | Only if unlimited goal nesting is added |
| **Full-text search** | Prisma `contains` | PostgreSQL tsvector or pg_trgm | Add when search performance degrades |
| **Export generation** | Synchronous in route handler | Background job queue (BullMQ) | Only if exports take > 10s |
| **Real-time updates** | React Query polling (30s) | WebSocket or SSE push from server | Only for multi-user collaboration |

## Suggested Build Order

Based on the component dependencies, here is the recommended build sequence:

**Phase 1: Foundation** (everything else depends on this)
1. Project setup (Next.js 15, Prisma, PostgreSQL, Tailwind, shadcn/ui)
2. Database schema and migrations (all models)
3. Prisma Client singleton and seed script
4. Service Layer core (goal CRUD, category CRUD)
5. Basic auth (API key validation)

**Phase 2: Core Web UI** (depends on Phase 1)
1. Root layout with sidebar and mobile navigation
2. Dashboard page (server component with initial data)
3. Goals list view (the simplest view)
4. Goal create/edit forms
5. Category CRUD UI
6. React Query hooks and cache management

**Phase 3: MCP Server** (depends on Phase 1, parallel with Phase 2)
1. MCP route handler setup with `mcp-handler`
2. Core tools (list, create, update, delete goals and categories)
3. Dashboard and stats tools
4. Authentication middleware
5. Integration testing with a real MCP client

**Phase 4: Advanced Views** (depends on Phase 2)
1. Board/Kanban view
2. Tree view (hierarchical)
3. Calendar view
4. Timeline visualization
5. Drag and drop across views

**Phase 5: Gamification** (depends on Phase 1 service layer)
1. XP/level system in Service Layer
2. Streak tracking logic
3. Weekly score computation
4. Dashboard widgets (XP bar, streak, level)
5. Completion animations (confetti)

**Phase 6: Power Features** (depends on Phases 2, 3)
1. Command palette (Cmd+K) with cmdk library
2. Keyboard shortcuts
3. Data export (JSON, CSV, Markdown, PDF, DOCX)
4. Data migration from todos.json
5. Archive view
6. Filtering and sorting across views

**Phase 7: PWA and Polish** (depends on Phase 2)
1. PWA manifest and service worker
2. Offline read support
3. Dark/light theme
4. Mobile responsive refinements
5. Micro-interactions and animations

**Dependency chain:** Phase 1 is the critical path. Phases 2 and 3 can run in parallel. Phase 4 depends on Phase 2. Phase 5 can start after Phase 1. Phase 6 depends on Phases 2 and 3. Phase 7 can start after Phase 2.

## Sources

- [Prisma Self-Relations Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/self-relations) (HIGH confidence, official docs)
- [MCP Specification: Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http) (HIGH confidence, official spec)
- [Building Custom MCP Servers with Next.js and mcp-handler](https://www.trevorlasn.com/blog/building-custom-mcp-servers-with-nextjs-and-mcp-handler) (HIGH confidence, verified against mcp-handler repo)
- [Implementing MCP with Streamable HTTP Transport in Production](https://ai.plainenglish.io/implementing-mcp-with-streamable-http-transport-in-prod-23ca9c6731ca) (MEDIUM confidence, community article, verified against spec)
- [Next.js MCP Server Guide](https://nextjs.org/docs/app/guides/mcp) (HIGH confidence, official Next.js docs, though focused on dev tooling MCP not custom MCP)
- [Next.js Building APIs Guide](https://nextjs.org/blog/building-apis-with-nextjs) (HIGH confidence, official Vercel blog)
- Prisma Tree Structures GitHub Issue #4562 (MEDIUM confidence, confirms adjacency list as supported pattern)

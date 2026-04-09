# Technology Stack: v2.0 Additions

**Project:** Ascend v2.0 (To-dos, Calendar, Context System, Timeline Redesign)
**Researched:** 2026-04-08
**Overall confidence:** HIGH

## Existing Stack (Not Re-Researched)

Already installed and validated from v1.0. These are the foundations the v2.0 additions build on:

| Technology | Version | Relevance to v2.0 |
|------------|---------|-------------------|
| Next.js | 16.2.1 | API routes for new context MCP tools, server components for calendar page |
| React | 19.2.4 | View Transitions for calendar/timeline view switching |
| Prisma | ^7.6.0 | New schema models for To-do and Context entities |
| PostgreSQL | 16.x | Full-text search (tsvector/tsquery) for context system, new tables |
| date-fns | ^4.1.0 | All date math for calendar, recurring to-dos, streak calculations |
| @tanstack/react-query | ^5.95.2 | Cache management for to-do lists, calendar data, context entries |
| @tanstack/react-table | ^8.21.3 | To-do list view with sorting/filtering |
| @dnd-kit/react | ^0.3.2 | Drag to-dos between days on calendar, reorder in lists |
| Zustand | ^5.0.12 | UI state for calendar selected date, active view, to-do modal state |
| @modelcontextprotocol/sdk | ^1.29.0 | New MCP tools for to-do and context CRUD |
| Motion | (not yet installed, was in v1 plan) | Calendar animations, to-do completion, view transitions |
| Recharts | (not yet installed, was in v1 plan) | Streak visualization, habit consistency charts on dashboard |
| shadcn/ui | code-copy pattern | Calendar component foundation, new to-do specific components |
| Zod | ^4.3.6 | Validation for to-do and context API inputs |
| cmdk | ^1.1.1 | Command palette extensions for to-do and context actions |
| Lucide React | ^1.7.0 | Icons for to-do states, calendar, context entries |

## New Dependencies for v2.0

### react-day-picker (Calendar View)

| | |
|---|---|
| **Package** | `react-day-picker` |
| **Version** | 9.14.0 |
| **Purpose** | Month grid calendar component with day selection |
| **Why** | shadcn/ui's Calendar component is built on react-day-picker. v9 is required for React 19 compatibility (v8 does not work with React 19). Provides accessible, headless month grid rendering with keyboard navigation, locale support, and customizable day content. The project already uses shadcn/ui, so this aligns with the existing component pattern. |
| **Integration** | `npx shadcn@latest add calendar` pulls in react-day-picker automatically. Wrap the month grid in a custom CalendarView component that renders to-do counts and priority indicators inside each day cell using DayPicker's `components` prop for custom day rendering. |
| **Confidence** | HIGH (verified: npm v9.14.0, peer dep React >=16.8.0, shadcn/ui Calendar docs confirm it wraps react-day-picker v9) |

### rrule (Advanced Recurring To-dos)

| | |
|---|---|
| **Package** | `rrule` |
| **Version** | 2.8.1 |
| **Purpose** | iCalendar RFC 5545 recurrence rule parsing, serialization, and expansion |
| **Why** | The existing recurring goal system uses a simple frequency enum (DAILY/WEEKLY/MONTHLY) with a numeric interval. This works for basic patterns but cannot express "every Tuesday and Thursday", "first Monday of each month", "every other Wednesday", or "weekdays only." rrule handles all of these via the iCalendar standard that every calendar app understands. It also provides natural language serialization (storing an rrule string in the DB, displaying "Every Tuesday and Thursday" to the user) and efficient date expansion (generate the next N occurrences without iterating). |
| **Why not keep the simple enum?** | The v1 recurring goals were outputs (habits). v2 to-dos as daily inputs need richer patterns. A user who wants "meditate every weekday" or "review finances on the 1st and 15th" cannot express this with DAILY/WEEKLY/MONTHLY + interval. The rrule string is a single database column that replaces the frequency + interval columns and covers every recurrence pattern. |
| **Integration** | Store rrule strings in a `recurrenceRule TEXT` column on the Todo model. On the backend, `RRule.fromString(rule).between(start, end)` generates occurrences for a date range (used by the calendar view to show which days have recurring to-dos). On the frontend, build a recurrence picker UI that constructs rrule objects. The rrule library is TypeScript-native (types built in, no @types needed). |
| **Alternative considered** | `simple-rrule` (1.8.1): lighter but feature-incomplete (no BYDAY, BYMONTHDAY expansion). The full rrule library is 45KB gzipped, which is acceptable. |
| **Maintenance note** | Last published 2 years ago (v2.8.1). This is not a concern because the library implements a stable RFC standard (RFC 5545). The iCalendar recurrence spec has not changed. The library has 498 dependents and remains the standard. If long-term maintenance becomes a concern, the rrule string format is portable to any implementation. |
| **Confidence** | HIGH (verified: npm v2.8.1, built-in TS types at dist/esm/index.d.ts, widely used, stable RFC implementation) |

## What NOT to Add

### Libraries That Are Unnecessary

| Library | Why Skip |
|---------|----------|
| **nuqs** (URL state) | Was in the v1 research but never installed. Calendar date selection and to-do filters work well as Zustand state. URL state makes sense for shareable links in multi-user apps, but Ascend v1/v2 is single-user. If needed later, add it then. |
| **@svar-ui/react-gantt** or any Gantt library | The timeline redesign calls for a Gantt with tree hierarchy. The existing custom timeline is already built with CSS Grid + date-fns. A Gantt library would impose its own visual language, conflicting with Ascend's design-first aesthetic. Extend the existing custom timeline with a left-side tree column (reusing the tree view logic) and horizontal bars instead of nodes. This is a layout change, not a new dependency. |
| **pgvector / vector embeddings** | The context system is a structured knowledge store (key-value pairs, tagged entries, hierarchical categories). This is relational data, not semantic search. PostgreSQL's built-in full-text search (tsvector/tsquery with GIN indexes) is more than sufficient for finding context entries by keyword. Adding vector embeddings would require an embedding API, increase complexity, and solve a problem that does not exist at this scale. |
| **Pinecone / Weaviate / ChromaDB** | Same reasoning as pgvector. External vector databases are for semantic search over thousands of documents. The context system will have dozens to low hundreds of structured entries. PostgreSQL handles this trivially. |
| **react-big-calendar** | Designed for event scheduling (multi-day events, time blocks, Calendly-style). Ascend's calendar is a month overview showing to-do counts per day with a day detail panel. react-day-picker with custom day content handles this without the overhead of a full scheduling calendar. |
| **fullcalendar** | Same reasoning as react-big-calendar. Overkill for a month grid with day selection. Heavyweight (100KB+), opinionated styling, designed for scheduling, not to-do tracking. |
| **cron / node-cron** | For generating recurring to-do instances, a cron job is unnecessary. Generate instances on demand when the user views the calendar or dashboard (same pattern as the existing recurring goal generation in `recurring-service.ts`). Lazy generation is simpler and more testable than a background scheduler. |
| **rSchedule** | Alternative to rrule with better timezone and duration support. But rrule is more mature, more widely used, and Ascend does not need timezone-aware recurrence (single user, single timezone). The extra features do not justify switching to a less proven library. |
| **Separate search library (Lunr, MiniSearch, Fuse.js)** | Client-side search libraries are unnecessary. The context system queries PostgreSQL via API routes. Server-side full-text search is more capable and keeps the bundle small. |

### Libraries Already Installed That Cover v2.0 Needs

| v2.0 Need | Already Covered By |
|-----------|-------------------|
| Calendar date arithmetic (add/subtract days, start of week, format) | `date-fns` ^4.1.0 |
| To-do streak calculations | `date-fns` (same pattern as existing `recurring-service.ts`) |
| To-do list rendering with sort/filter | `@tanstack/react-table` ^8.21.3 |
| To-do drag between calendar days | `@dnd-kit/react` ^0.3.2 |
| Calendar/to-do data fetching and cache | `@tanstack/react-query` ^5.95.2 |
| To-do form validation | `zod` ^4.3.6 |
| Context CRUD API validation | `zod` ^4.3.6 |
| Context MCP tools | `@modelcontextprotocol/sdk` ^1.29.0 |
| UI state (selected date, modal state) | `zustand` ^5.0.12 |
| Toast feedback on to-do actions | `sonner` ^2.0.7 |
| Schema migrations for new models | `prisma` ^7.6.0 |

## Dependencies to Verify Are Installed

These were in the v1 research STACK.md but are NOT in the current `package.json`. They may have been planned but not yet added. Verify at implementation time:

| Library | Needed For | Status in package.json |
|---------|-----------|----------------------|
| `motion` (Framer Motion successor) | Calendar view transitions, to-do completion animations, timeline Gantt bar animations | **NOT INSTALLED** (was in v1 plan). Add if animation work is in scope for v2.0. |
| `recharts` | Streak visualization on dashboard, habit consistency heat maps | **NOT INSTALLED** (was in v1 plan). Add if dashboard streak charts are in scope. |
| `canvas-confetti` | To-do streak milestone celebrations | **INSTALLED** (^1.9.4) |
| `@react-pdf/renderer` | Export to-do/context data as PDF | **NOT INSTALLED** (was in v1 plan). Defer unless export is in v2.0 scope. |

## PostgreSQL Features to Leverage (No New Dependencies)

### Full-Text Search for Context System

PostgreSQL's built-in full-text search covers the context system's query needs without any extensions:

```sql
-- Add a tsvector column to the context table
ALTER TABLE "Context" ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(tags_text, ''))
  ) STORED;

-- GIN index for fast lookups
CREATE INDEX idx_context_search ON "Context" USING GIN(search_vector);

-- Query with ranking
SELECT *, ts_rank(search_vector, plainto_tsquery('english', 'search term')) AS rank
FROM "Context"
WHERE search_vector @@ plainto_tsquery('english', 'search term')
ORDER BY rank DESC;
```

**In Prisma:** Use `$queryRaw` for full-text search queries. Prisma does not have native tsvector support, but raw SQL queries are type-safe with `Prisma.sql` template literals.

**Confidence:** HIGH (PostgreSQL full-text search is a stable, mature feature. No extension needed.)

### JSONB for Flexible Context Metadata

Context entries may have varying metadata structures (a "skill" entry has different fields than a "preference" entry). Use a `metadata JSONB` column for flexible key-value storage alongside the structured columns. PostgreSQL JSONB supports indexing, querying, and validation.

**In Prisma:** `metadata Json?` maps to PostgreSQL JSONB. Prisma 7 supports `Json` type natively.

## Installation Summary

```bash
# New dependencies for v2.0
npm install react-day-picker rrule

# Verify these are installed (should be from v1, but check)
# If missing, add them:
npm install motion recharts
```

Total new dependencies: **2** (react-day-picker, rrule).

## Schema Additions (Prisma)

The new models for v2.0 do not require new npm dependencies. They use Prisma's existing types:

### Todo Model (New)
```prisma
model Todo {
  id             String    @id @default(cuid())
  userId         String
  title          String
  description    String?
  completed      Boolean   @default(false)
  completedAt    DateTime?
  dueDate        DateTime?
  priority       Priority  @default(MEDIUM)
  sortOrder      Int       @default(0)

  // Link to goal (output)
  goalId         String?
  goal           Goal?     @relation(fields: [goalId], references: [id], onDelete: SetNull)

  // Category
  categoryId     String?
  category       Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  // Recurrence (rrule string, e.g., "FREQ=WEEKLY;BYDAY=TU,TH")
  recurrenceRule String?
  isRecurring    Boolean   @default(false)
  recurringSourceId String?

  // Streak tracking
  currentStreak  Int       @default(0)
  longestStreak  Int       @default(0)

  // Relations
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([userId])
  @@index([dueDate])
  @@index([goalId])
  @@index([categoryId])
  @@index([recurringSourceId])
}
```

### Context Model (New)
```prisma
model Context {
  id          String   @id @default(cuid())
  userId      String
  title       String
  content     String
  category    String   @default("general")
  tags        String[] @default([])
  metadata    Json?
  sortOrder   Int      @default(0)

  // Relations
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
  @@index([category])
  @@index([tags])
}
```

**Note:** The `search_vector` tsvector column for full-text search is added via raw SQL migration, not the Prisma schema (Prisma does not support tsvector as a native type).

## Architecture Notes for v2.0

1. **To-do service layer parallels goal service.** Create `todo-service.ts` following the same pattern as `goal-service.ts`. Both the web UI and MCP tools call into this service.

2. **Calendar view is a read-only aggregation.** The calendar page queries to-dos by date range (`WHERE dueDate BETWEEN start AND end`), groups them by day, and renders counts inside react-day-picker's day cells. Day selection opens a side panel with that day's to-dos. No new data fetching library needed; use the existing React Query pattern.

3. **rrule expansion happens server-side.** When rendering a calendar month, the API route uses rrule to expand recurring to-dos into their occurrence dates, then merges with one-off to-dos. This keeps the frontend simple (it receives a flat list of to-dos per day) and prevents rrule from bloating the client bundle.

4. **Context system is CRUD + search.** No fancy architecture needed. It is a database table with full-text search. The MCP server exposes `create_context`, `list_context`, `search_context`, `update_context`, `delete_context` tools. AI assistants write personal context through these tools; the web UI provides a management interface.

5. **Timeline redesign reuses existing code.** The Gantt-with-tree layout extends the current `goal-timeline-view.tsx` and `timeline-utils.ts`. Add a frozen left column with the tree hierarchy (reuse `goal-tree-node.tsx` rendering logic) and change the right side from nodes to horizontal bars. This is a component refactor, not a library addition.

## Sources

- react-day-picker: https://daypicker.dev/ and npm v9.14.0 (HIGH confidence)
- shadcn/ui Calendar docs: https://ui.shadcn.com/docs/components/radix/calendar (HIGH confidence)
- rrule: https://github.com/jkbrzt/rrule and npm v2.8.1 (HIGH confidence)
- rrule TypeScript types: verified built-in at dist/esm/index.d.ts (HIGH confidence)
- PostgreSQL full-text search: https://www.postgresql.org/docs/current/textsearch.html (HIGH confidence)
- Prisma Json type: https://www.prisma.io/docs/orm/prisma-schema/data-model/unsupported-database-features (HIGH confidence)
- SVAR React Gantt: https://svar.dev/react/gantt/ (evaluated, rejected for design control reasons)
- All npm versions verified via `npm view` on 2026-04-08

# Roadmap: Ascend

## Milestones

- v1.0 MVP (Phases 1 through 11): shipped 2026-04-09. All 110 v1 requirements complete (except DATA-07 automated backups, deferred).
- v2.0 Inputs & Outputs (Phases 12 through 18): in progress.

<details>
<summary>v1.0 MVP (Phases 1 through 11), SHIPPED 2026-04-09</summary>

Phases 1 through 11 delivered the full goal tracking system: database + infrastructure, app shell + goal CRUD, categories + list view, dashboard + progress tracking, MCP server (20 tools), board + tree views, timeline view, drag and drop, gamification + recurring goals, command palette + data management, onboarding + PWA + polish. All 110 v1 requirements complete.

</details>

## Overview

v2.0 transforms Ascend from a goal tracker (outputs only) into a personal operating system built on the inputs/outputs framework. To-dos are inputs (daily controllable actions), Goals are outputs (results to achieve). A calendar view becomes the primary daily experience. A context system provides structured personal knowledge queryable by AI. The timeline gets a Gantt redesign and the navigation is restructured around the Inputs/Outputs mental model.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (12.1, 12.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 12: Todo Data Layer** - Prisma model, service layer, API routes, hooks for to-do CRUD, goal linking, recurrence, streaks, and Daily Big 3 (completed 2026-04-09)
- [x] **Phase 13: Todo UI** - List view with sorting/filtering, bulk operations, overdue handling (completed 2026-04-09)
- [x] **Phase 14: Calendar View** - Month grid, day detail panel, Big 3 display, goal deadlines, morning planning prompt (completed 2026-04-09)
- [x] **Phase 15: Dashboard Transformation** - Input-centric dashboard with Big 3 widget and linked output context (completed 2026-04-09)
- [ ] **Phase 16: Context System** - Context documents with categories, tags, backlinks, full-text search, MCP tools, and MCP Resources
- [ ] **Phase 17: Todo MCP Tools** - Ten MCP tools for AI-driven to-do management
- [ ] **Phase 18: Timeline, Navigation, and Polish** - Gantt tree redesign, view cleanup, nav restructure, command palette extension

## Phase Details

### Phase 12: Todo Data Layer
**Goal**: A complete to-do data layer exists so that to-dos can be created, completed, linked to goals, recurred with streaks, and prioritized as Daily Big 3 through API routes and React hooks
**Depends on**: v1.0 complete (builds on existing Prisma schema, service pattern, and API route structure)
**Requirements**: TODO-01, TODO-02, TODO-03, TODO-04, TODO-05, TODO-06, TODO-07, TODO-08, TODO-09
**Success Criteria** (what must be TRUE):
  1. User can create a to-do with title, description, due date, priority, and category through the API, and retrieve it
  2. User can complete a to-do and see the linked parent goal's progress auto-increment
  3. User can create a recurring to-do (daily, weekly, or custom rrule pattern) and see it generate instances for the correct dates
  4. Recurring to-dos track streak count and 30-day consistency score that update on completion
  5. User can designate up to 3 to-dos as Daily Big 3 for a given date, with enforcement that rejects a 4th
**Plans**: 2 plans

Plans:
- [x] 12-01-PLAN.md — Prisma Todo model, Zod schemas, core service (CRUD + complete + skip + goal linking), API routes
- [ ] 12-02-PLAN.md — rrule recurrence, streak tracking, Daily Big 3 enforcement, date queries, React hooks

### Phase 13: Todo UI
**Goal**: Users can manage their to-dos through a full-featured list interface with sorting, filtering, bulk actions, and visual overdue indicators
**Depends on**: Phase 12
**Requirements**: TODO-10, TODO-11, TODO-12, TODO-13
**Success Criteria** (what must be TRUE):
  1. User can view all to-dos in a sortable list (by due date, priority, completion status)
  2. User can filter the to-do list by category, priority, status, and linked goal simultaneously
  3. User can select multiple to-dos and bulk-complete or bulk-delete them in one action
  4. Overdue to-dos are visually highlighted in red/orange and offer reschedule or complete actions
**Plans**: 2 plans

Plans:
- [ ] 13-01-PLAN.md — Todo list page with sortable columns, filter bar, quick-add, and navigation
- [ ] 13-02-PLAN.md — Bulk actions, overdue visual indicators, and detail side panel

### Phase 14: Calendar View
**Goal**: Users have a calendar as their primary daily planning surface, showing to-dos per day, goal deadlines, Big 3 priorities, and a morning planning prompt
**Depends on**: Phase 13
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05, CAL-06, CAL-07, CAL-08
**Success Criteria** (what must be TRUE):
  1. User sees a navigable month grid with dot indicators on days that have to-dos, and can click any day to see its to-dos in a detail panel
  2. Goal deadlines appear on the calendar with a distinct visual style (icon or color) that differentiates them from to-dos
  3. Daily Big 3 priorities appear prominently above other to-dos in the day detail, and recurring daily to-dos are visually distinguished from one-off to-dos
  4. When the user opens the app without Big 3 selected for today, a morning planning prompt guides them to set priorities
  5. Overdue to-dos from previous days surface at the top of today's view so nothing slips through the cracks
**Plans**: 2 plans

Plans:
- [ ] 14-01-PLAN.md — Calendar month grid, day detail panel, goal deadline markers, Big 3 prominence, and navigation entry
- [ ] 14-02-PLAN.md — Morning planning prompt for Daily Big 3 selection

### Phase 15: Dashboard Transformation
**Goal**: The dashboard becomes input-centric, centering on "what are my inputs today?" with clear connections to outputs (goals)
**Depends on**: Phase 14
**Requirements**: VS-03, VS-04
**Success Criteria** (what must be TRUE):
  1. Dashboard prominently displays Today's Big 3 widget as the first and largest element the user sees
  2. Each Big 3 to-do shows its linked goal (output), making visible why this input matters
  3. Existing dashboard widgets (streaks, deadlines, progress) remain functional alongside the new input-centric layout
**Plans**: 1 plan

Plans:
- [ ] 15-01-PLAN.md — Today's Big 3 widget with linked goal display, input-centric dashboard layout restructure

### Phase 16: Context System
**Goal**: Users can store and organize structured personal knowledge as context documents that any AI assistant can query, with categories, tags, backlinks, and full-text search
**Depends on**: v1.0 complete (independent of Phases 12 through 15; can be parallelized if needed)
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05, CTX-06, CTX-07, CTX-08, CTX-09, CTX-10, CTX-11, CTX-12, CTX-13
**Success Criteria** (what must be TRUE):
  1. User can create, edit, and delete context documents with markdown content, organized into a category tree with tags
  2. User can search across all context documents using full-text search and see results ranked by relevance
  3. User can create [[backlinks]] between context documents and navigate bidirectional links in the UI
  4. A "Current Priorities" context document auto-updates based on active goals and today's Big 3
  5. AI assistants can create, read, search, and delete context through MCP tools, and can browse context categories as MCP Resources
**Plans**: TBD

Plans:
- [ ] 16-01: TBD
- [ ] 16-02: TBD
- [ ] 16-03: TBD

### Phase 17: Todo MCP Tools
**Goal**: AI assistants can fully manage to-dos through MCP, enabling workflows like "Claude, add a to-do for tomorrow" or "what are my Big 3 today?"
**Depends on**: Phase 12
**Requirements**: TMCP-01, TMCP-02, TMCP-03, TMCP-04, TMCP-05, TMCP-06, TMCP-07, TMCP-08, TMCP-09, TMCP-10
**Success Criteria** (what must be TRUE):
  1. AI assistant can create, read, update, and delete to-dos through MCP tools, including setting recurrence and goal links
  2. AI assistant can complete a to-do via MCP and the system auto-updates streaks and linked goal progress
  3. AI assistant can query today's Big 3 and set Big 3 priorities for a given day through dedicated MCP tools
  4. AI assistant can list and search to-dos with filters (date range, category, priority, status, linked goal) and full-text search
**Plans**: TBD

Plans:
- [ ] 17-01: TBD

### Phase 18: Timeline, Navigation, and Polish
**Goal**: The timeline becomes a proper Gantt view with tree hierarchy, obsolete views are removed, navigation reflects the Inputs/Outputs model, and the command palette covers all entity types
**Depends on**: Phase 15, Phase 16
**Requirements**: TL-01, TL-02, TL-03, TL-04, TL-05, TL-06, VS-01, VS-02, VS-05
**Success Criteria** (what must be TRUE):
  1. Timeline displays goals as horizontal Gantt bars nested in a collapsible tree hierarchy with indentation, replacing the old swim-lane approach
  2. Timeline supports Year/Quarter/Month zoom levels with a visible today marker, and the layout (timeline + detail panel) fits within the viewport without horizontal overflow
  3. Cards view and board view are removed; the app offers list, tree, timeline, and calendar as the four goal views
  4. Sidebar navigation is restructured to show Inputs (to-dos), Outputs (goals), Calendar, and Context as primary sections
  5. Command palette (Cmd+K) searches across to-dos and context documents in addition to goals
**Plans**: TBD

Plans:
- [ ] 18-01: TBD
- [ ] 18-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 12 > 13 > 14 > 15 > 16 > 17 > 18
Note: Phase 16 (Context) and Phase 17 (Todo MCP) can be parallelized since they have independent dependency chains.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 12. Todo Data Layer | 2/2 | Complete    | 2026-04-09 | - |
| 13. Todo UI | 2/2 | Complete    | 2026-04-09 | - |
| 14. Calendar View | 2/2 | Complete    | 2026-04-09 | - |
| 15. Dashboard Transformation | 1/1 | Complete   | 2026-04-09 | - |
| 16. Context System | v2.0 | 0/3 | Not started | - |
| 17. Todo MCP Tools | v2.0 | 0/1 | Not started | - |
| 18. Timeline, Navigation, and Polish | v2.0 | 0/2 | Not started | - |

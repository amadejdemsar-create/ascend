# Roadmap: Ascend

## Overview

Ascend delivers a personal goal tracking web app that connects yearly ambitions to weekly actions through a cascading hierarchy, progress rollup, gamification, and a comprehensive MCP server for AI integration. The roadmap moves from database foundation through core UI, then layers on the dashboard, MCP server, advanced views (board, tree, timeline), drag and drop, gamification, power features, and finally PWA polish. Each phase delivers a coherent, testable capability that builds on what came before.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Database schema, Service Layer, project scaffolding, infrastructure setup (completed 2026-03-30)
- [ ] **Phase 2: App Shell and Goal Management** - Layout, navigation, theming, goal CRUD with hierarchy and forms
- [ ] **Phase 3: Categories, List View, and Filtering** - Category system, list view, filtering/sorting, view persistence
- [ ] **Phase 4: Dashboard and Progress Tracking** - Landing page widgets, progress increment/history, rollup
- [ ] **Phase 5: MCP Server** - Streamable HTTP endpoint with all tools, API key auth, transport validation
- [ ] **Phase 6: Board and Tree Views** - Kanban board view and hierarchical tree view
- [ ] **Phase 7: Timeline View** - Custom horizontal timeline visualization with expandable goal nodes
- [ ] **Phase 8: Drag and Drop** - Cross-view reordering, horizon changes, category moves with visual feedback
- [ ] **Phase 9: Gamification and Recurring Goals** - XP/levels, streaks, weekly score, celebrations, recurring goal instances
- [ ] **Phase 10: Command Palette and Data Management** - Cmd+K palette, keyboard shortcuts, import/export (JSON, CSV, MD, PDF, DOCX), backups
- [ ] **Phase 11: Onboarding, PWA, and Polish** - First-run experience, installable PWA, offline support, rich animations

## Phase Details

### Phase 1: Foundation
**Goal**: The database, Service Layer, and deployment pipeline are operational so all subsequent phases build on a stable, tested data layer
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. Next.js 16 app deploys to ascend.nativeai.agency via Dokploy and serves a placeholder page over HTTPS
  2. PostgreSQL database is running with all Prisma migrations applied, including multi-user schema (user_id on every table) and a seeded test user
  3. Service Layer functions for goal CRUD, category CRUD, and hierarchy validation return correct results when called programmatically (verified by seed scripts or test calls)
  4. Adjacency list hierarchy enforces valid parent-child relationships (quarterly can only parent under yearly, monthly under quarterly, weekly under monthly)
  5. API key authentication middleware rejects unauthenticated requests and accepts valid Bearer tokens
**Plans:** 4/4 plans complete

Plans:
- [x] 01-01-PLAN.md — Scaffold Next.js 16 project, Dockerfile, Prisma config, deploy to Dokploy
- [ ] 01-02-PLAN.md — Complete Prisma schema (6 models), migrations, Prisma Client singleton, seed test user
- [ ] 01-03-PLAN.md — Service Layer (goal CRUD, category CRUD, hierarchy validation, Zod schemas, tree queries)
- [ ] 01-04-PLAN.md — API key authentication and REST API route handlers for goals and categories

### Phase 2: App Shell and Goal Management
**Goal**: Users can see and interact with their goals through a functional app layout with navigation, theming, and full goal CRUD including hierarchy
**Depends on**: Phase 1
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, THEME-01, THEME-02, THEME-03, THEME-04, GOAL-01, GOAL-02, GOAL-03, GOAL-04, GOAL-05, GOAL-06, GOAL-07, GOAL-08, GOAL-09, GOAL-11, GOAL-12, GOAL-13, GOAL-14
**Success Criteria** (what must be TRUE):
  1. User sees a collapsible sidebar on desktop and a bottom tab bar on mobile with working navigation between sections
  2. User can toggle between dark and light themes manually, and the app follows system preference by default
  3. User can create a yearly goal with full SMART fields via a modal dialog and create a weekly goal via inline quick-add
  4. User can link a goal to a parent at the appropriate horizon level and view a goal's children (sub-goals)
  5. User can edit any goal field, change status/priority, set measurable targets, and delete goals with confirmation when children exist
**Plans**: TBD

Plans:
- [ ] 02-01: App shell layout (sidebar, bottom tab bar, responsive breakpoints)
- [ ] 02-02: Theme system (dark/light, system preference, manual override, NativeAI palette)
- [ ] 02-03: Goal creation forms (SMART modal for yearly/quarterly, inline add for monthly/weekly)
- [ ] 02-04: Goal editing, status/priority management, deletion with children handling
- [ ] 02-05: Hierarchy UI (parent linking, children display, progress rollup suggestion)

### Phase 3: Categories, List View, and Filtering
**Goal**: Users can organize goals into color-coded categories and browse them in a sortable, filterable list view that persists preferences across sessions
**Depends on**: Phase 2
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, VIEW-01, VIEW-02, VIEW-08, VIEW-09, VIEW-10
**Success Criteria** (what must be TRUE):
  1. User can create, edit, delete, and reorder categories with custom names, colors, and Lucide icons, including nested subcategories
  2. App ships with default suggested categories (Business, Personal, Health, Finance, Learning) that the user can modify or remove
  3. User can view all goals in a flat sortable table with columns for title, status, progress, priority, deadline, category, and horizon
  4. User can filter goals by category, horizon, status, and priority, and sort by priority, deadline, creation date, or title
  5. User's selected view and active filters persist across browser sessions
**Plans**: TBD

Plans:
- [ ] 03-01: Category CRUD UI with nesting, colors, and icons
- [ ] 03-02: Default categories and sidebar category tree
- [ ] 03-03: List view with sortable table columns
- [ ] 03-04: Filtering and sorting system across views
- [ ] 03-05: View and filter preference persistence

### Phase 4: Dashboard and Progress Tracking
**Goal**: Users land on a dashboard that answers "what should I focus on right now?" with progress tracking that connects daily actions to measurable outcomes
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, PROG-01, PROG-02, PROG-03, PROG-04, PROG-05
**Success Criteria** (what must be TRUE):
  1. Dashboard loads as the default landing page showing this week's top priority goals, completion percentage per category, streaks/stats, and upcoming deadlines
  2. User can increment progress on a measurable goal with a quick +1 button or custom amount, optionally adding a note
  3. User can view the full progress history (timestamped entries with notes) for any goal
  4. Progress percentage calculates automatically from current value vs target value, and parent goal progress aggregates from children
  5. Dashboard widgets update in real time when goals are modified elsewhere in the app
**Plans**: TBD

Plans:
- [ ] 04-01: Dashboard page layout and widget framework
- [ ] 04-02: Weekly Focus and Upcoming Deadlines widgets
- [ ] 04-03: Progress Overview and Streaks/Stats widgets
- [ ] 04-04: Progress tracking UI (increment button, notes, history view)
- [ ] 04-05: Real-time widget updates and progress rollup

### Phase 5: MCP Server
**Goal**: Any AI assistant can read and write goals through a comprehensive MCP endpoint, making Ascend the single source of truth for goal management across all AI tools
**Depends on**: Phase 1 (Service Layer); can run in parallel with Phases 2-4
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07, MCP-08, MCP-09, MCP-10, MCP-11, MCP-12, MCP-13, MCP-14, MCP-15, MCP-16, MCP-17, MCP-18, MCP-19, MCP-20
**Success Criteria** (what must be TRUE):
  1. MCP endpoint responds on Streamable HTTP transport and completes the protocol handshake with Claude Code and at least one other MCP client
  2. API key authentication rejects invalid tokens and accepts valid Bearer tokens for all MCP operations
  3. An AI assistant can create a yearly goal, break it into quarterly and monthly sub-goals, add progress, and retrieve the full hierarchy through MCP tools
  4. An AI assistant can search goals by text, filter by any dimension (horizon, category, status, priority), bulk-complete goals, and retrieve dashboard/priority/stats data
  5. Import and export tools work correctly (JSON import from old todos.json format, JSON/CSV/Markdown export of goal data)
**Plans**: TBD

Plans:
- [ ] 05-01: MCP transport setup and protocol handshake validation
- [ ] 05-02: Goal CRUD tools (create, get, update, delete, list, search)
- [ ] 05-03: Progress, hierarchy, and bulk operation tools
- [ ] 05-04: Dashboard, stats, priorities, and timeline tools
- [ ] 05-05: Category, settings, import, and export tools
- [ ] 05-06: End-to-end validation with Claude Code and other MCP clients

### Phase 6: Board and Tree Views
**Goal**: Users can visualize goals as kanban cards grouped by status or horizon and as an expandable hierarchical tree showing the full yearly-to-weekly cascade
**Depends on**: Phase 3
**Requirements**: VIEW-03, VIEW-04
**Success Criteria** (what must be TRUE):
  1. User can switch to Board view and see goals as cards organized into columns, with selectable grouping by status or horizon
  2. User can switch to Tree view and see the full goal hierarchy (yearly > quarterly > monthly > weekly) as an expandable and collapsible tree
  3. Both views respect active filters (category, horizon, status, priority) and sort settings
**Plans**: TBD

Plans:
- [ ] 06-01: Board/Kanban view with configurable column grouping
- [ ] 06-02: Tree view with hierarchical expand/collapse

### Phase 7: Timeline View
**Goal**: Users can visualize their entire year on a horizontal timeline with goals positioned at their horizon level, providing a planning perspective that no other personal goal app offers
**Depends on**: Phase 3
**Requirements**: VIEW-05, VIEW-06, VIEW-07
**Success Criteria** (what must be TRUE):
  1. User sees a horizontal year line with quarter markers that can expand to show months and weeks
  2. Goals appear as interactive nodes on the timeline positioned at their correct horizon level
  3. Clicking a goal node on the timeline expands its details inline, showing children, progress, and notes
  4. Timeline performs smoothly with 100+ goal nodes and handles viewport-based rendering to avoid DOM overload
**Plans**: TBD

Plans:
- [ ] 07-01: Timeline layout engine (year line, quarter/month/week expansion)
- [ ] 07-02: Goal nodes positioning and interaction
- [ ] 07-03: Inline detail expansion and performance optimization

### Phase 8: Drag and Drop
**Goal**: Users can reorganize their goals spatially by dragging to reorder, move between horizons, and change categories across List, Board, and Tree views
**Depends on**: Phase 6 (Board and Tree views must exist for cross-view DnD)
**Requirements**: DND-01, DND-02, DND-03, DND-04, DND-05
**Success Criteria** (what must be TRUE):
  1. User can drag goals to reorder them within any list or view
  2. User can drag a goal between horizons (e.g., promote a weekly goal to monthly) and between categories
  3. Drag and drop works consistently across List, Board, and Tree views
  4. Visual feedback during drag shows a ghost element and highlights valid drop targets
**Plans**: TBD

Plans:
- [ ] 08-01: Drag and drop foundation with dnd-kit
- [ ] 08-02: Cross-view drag operations (reorder, horizon change, category change)
- [ ] 08-03: Visual feedback (ghost elements, drop target highlighting)

### Phase 9: Gamification and Recurring Goals
**Goal**: Users feel motivated by visible progress through XP, levels, streaks, and celebrations, with recurring goals that build habits through streak tracking
**Depends on**: Phase 4 (progress tracking and dashboard must exist)
**Requirements**: GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GOAL-10
**Success Criteria** (what must be TRUE):
  1. Completing a goal awards XP proportional to its horizon level and priority, and accumulated XP drives a level system with a celebration animation on level-up
  2. User can create recurring goals (daily, weekly, monthly) that auto-generate instances, and consecutive completions build streaks
  3. Dashboard displays current level, XP progress to next level, active streaks, and weekly score
  4. A satisfying animation plays when a goal is completed (confetti for milestones, checkmark for tasks), and progress bars animate smoothly
**Plans**: TBD

Plans:
- [ ] 09-01: XP and level system (calculation, persistence, level-up logic)
- [ ] 09-02: Recurring goals (templates, instance generation, streak tracking)
- [ ] 09-03: Weekly score computation and dashboard gamification widgets
- [ ] 09-04: Completion animations and progress bar transitions

### Phase 10: Command Palette and Data Management
**Goal**: Power users can navigate and act on goals instantly through keyboard shortcuts and a search-driven command palette, with full data portability through import and export
**Depends on**: Phase 4 (dashboard and core features must exist for navigation targets)
**Requirements**: CMD-01, CMD-02, CMD-03, CMD-04, CMD-05, CMD-06, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08
**Success Criteria** (what must be TRUE):
  1. Cmd+K opens a command palette that searches all goals by title/description and offers quick actions (new goal, switch view, toggle theme, navigate to category)
  2. Keyboard shortcuts work for navigating between views, creating goals, marking complete, toggling sidebar, toggling theme, and pressing ? shows a shortcut reference
  3. User can import existing todos.json data with categories and tasks mapped to appropriate goal hierarchy levels
  4. User can export goals as JSON, CSV, Markdown, formatted PDF report with charts, and DOCX from the settings page
  5. Automated database backups run via cron pg_dump, and a manual export button is accessible from settings
**Plans**: TBD

Plans:
- [ ] 10-01: Command palette (Cmd+K search, quick actions, category navigation)
- [ ] 10-02: Keyboard shortcuts system and reference overlay
- [ ] 10-03: Data migration from todos.json
- [ ] 10-04: Export formats (JSON, CSV, Markdown, PDF, DOCX)
- [ ] 10-05: Automated backups and manual export button

### Phase 11: Onboarding, PWA, and Polish
**Goal**: New users get a guided first experience, the app installs as a PWA on any device, and rich animations make every interaction feel premium
**Depends on**: Phase 5 (MCP needed for AI-guided onboarding), Phase 9 (animations enhance gamification)
**Requirements**: ONBD-01, ONBD-02, ONBD-03, ONBD-04, PWA-01, PWA-02, PWA-03, PWA-04, THEME-05
**Success Criteria** (what must be TRUE):
  1. First-time user sees a choice between guided wizard, AI-guided setup (via MCP), or skip, and each path leads to a functional starting state
  2. App is installable from the browser and opens in standalone mode without browser chrome
  3. Installed PWA provides offline read access to the dashboard and recently viewed goals, and queues writes for sync when connectivity returns
  4. Rich animations are present throughout: page transitions, hover effects, animated counters, parallax timeline scrolling, and view transitions use React 19 View Transitions API
  5. Animations respect the user's prefers-reduced-motion system setting
**Plans**: TBD

Plans:
- [ ] 11-01: Onboarding flow (wizard, AI-guided, skip paths)
- [ ] 11-02: PWA manifest, service worker, and installability
- [ ] 11-03: Offline read cache and write queue with sync
- [ ] 11-04: Rich animations and view transitions
- [ ] 11-05: Reduced motion support and final polish

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 4 > 5 > 6 > 7 > 8 > 9 > 10 > 11
Note: Phase 5 (MCP Server) can execute in parallel with Phases 2-4 since both depend only on Phase 1's Service Layer.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/4 | Complete    | 2026-03-30 |
| 2. App Shell and Goal Management | 1/4 | In Progress | - |
| 3. Categories, List View, and Filtering | 0/5 | Not started | - |
| 4. Dashboard and Progress Tracking | 0/5 | Not started | - |
| 5. MCP Server | 0/6 | Not started | - |
| 6. Board and Tree Views | 0/2 | Not started | - |
| 7. Timeline View | 0/3 | Not started | - |
| 8. Drag and Drop | 0/3 | Not started | - |
| 9. Gamification and Recurring Goals | 0/4 | Not started | - |
| 10. Command Palette and Data Management | 0/5 | Not started | - |
| 11. Onboarding, PWA, and Polish | 0/5 | Not started | - |

# Project Research Summary

**Project:** Ascend (Personal Goals & Priorities Web App)
**Domain:** Personal goal tracking, OKR management, priorities dashboard with MCP server
**Researched:** 2026-03-30
**Confidence:** HIGH

## Executive Summary

Ascend is a personal goal tracking web app that differentiates itself through cascading goal hierarchies (yearly to weekly with automatic progress rollup), an MCP server for AI integration, and gamification with a premium aesthetic. Research across 9+ competitors reveals that no personal tool does cascading hierarchies natively; OKR tools serve teams, while task managers (Todoist, Things 3) stay flat. This gap is the core value proposition. The recommended approach is a Next.js 16 App Router application with PostgreSQL on Dokploy VPS, Prisma 7 ORM, and a shared Service Layer that powers both the web UI and the MCP endpoint identically.

The most critical architectural decision is the MCP server deployment topology. ARCHITECTURE.md recommends embedding the MCP server in Next.js via Vercel's `mcp-handler` package for simplicity, while PITFALLS.md documents that Next.js API routes buffer SSE/streaming responses (verified via GitHub issue vercel/next.js#48427), which would break Streamable HTTP transport. The resolved recommendation is to **start with `mcp-handler` inside Next.js for development and initial deployment, but architect the Service Layer so the MCP server can be extracted to a standalone process if buffering issues surface on Dokploy**. Since Ascend runs on a VPS (not Vercel serverless), the buffering behavior may differ from the documented serverless case. Test early behind Traefik with `flushInterval` set to `-1` on the MCP route, and if streaming breaks, extract the MCP server to a separate Express process on its own port. The Service Layer abstraction makes this extraction trivial because no business logic lives in the route handler.

The key risks are: (1) choosing the wrong hierarchical data model for PostgreSQL (use adjacency list with `parent_id`, not materialized paths), (2) Prisma's lack of recursive CTE support (plan raw SQL utilities upfront), (3) the timeline visualization being entirely custom with no suitable library (allocate dedicated time and plan for virtualization from the start), and (4) premature SaaS infrastructure distracting from the core goal tracking experience (hardcoded single user for v1, schema ready for multi-user).

## Key Findings

### Recommended Stack

The project should use **Next.js 16** (not 15 as originally specified in PROJECT.md) because it is the current stable release, offers React 19.2 View Transitions (ideal for animated view switching between goal views), the stable React Compiler for automatic memoization, and Turbopack as the default bundler. Starting on Next.js 15 would require migration within months.

**Core technologies:**
- **Next.js 16.2.x + React 19.2**: Full-stack framework with View Transitions for animated navigation between views, App Router for hybrid SSR/client rendering
- **PostgreSQL 16.x + Prisma 7.6.x**: Proven relational DB for hierarchical data with recursive CTEs; Prisma provides type-safe ORM with mature migrations (Prisma Next rewrite is not production-ready, stick with Prisma 7)
- **shadcn/ui + Tailwind CSS 4.x**: Code-owned component library on Radix primitives; includes Command component (cmdk wrapper) out of the box
- **Zustand 5.x + React Query (TanStack Query)**: Zustand for client UI state (sidebar, view, drag), React Query for server state cache with optimistic updates
- **@dnd-kit/react**: Best balance of customizability and React integration for drag and drop across lists, boards, and tree views
- **Motion 12.x (formerly Framer Motion)**: Standard for React animations, layout transitions, gesture support, AnimatePresence for exit animations
- **Recharts 3.8.x**: React-first SVG charting for progress dashboards, weekly scores, category breakdowns
- **@modelcontextprotocol/sdk 1.28.x**: Official MCP TypeScript SDK for Streamable HTTP transport
- **Serwist 9.5.x**: PWA service worker toolkit (successor to next-pwa, compatible with Turbopack)
- **@react-pdf/renderer 4.3.x + docx 9.6.x**: PDF and DOCX report generation for goal exports

**Critical version note:** Next.js 16 renames `middleware.ts` to `proxy.ts`, removes sync Request APIs (async only), and removes `next lint` (use ESLint directly). These are not migration concerns since this is a greenfield project.

### Expected Features

**Must have (table stakes):**
- Goal CRUD with due dates, priorities (3-4 levels), and status tracking
- Categories/labels/tags for cross-cutting organization
- Search (full-text expected, fuzzy matching a differentiator)
- Multiple views (list required day one, board/kanban expected shortly after)
- Subtasks/goal nesting (the foundation for the hierarchy differentiator)
- Dark/light theme following system preference
- Mobile responsive PWA for multi-device access
- Keyboard shortcuts for power user interaction
- Drag and drop for reordering within and between categories/horizons
- Filtering and sorting (compound filters: priority + category + date range)
- Data export (JSON/CSV minimum)
- Undo/mistake recovery (undo toast pattern)

**Should have (differentiators):**
- **Goal hierarchy (yearly > quarterly > monthly > weekly)** with automatic progress rollup: the core differentiator, no personal tool does this
- **Timeline visualization**: unique horizontal year timeline with expandable quarters/months/weeks
- **MCP server**: no goal app offers AI integration through MCP; bridges the AI-native workflow gap
- **Cmd+K command palette**: proven power-user pattern from Linear, absent in goal tracking space
- **SMART goal enforcement**: structured fields for yearly/quarterly goals, lightweight for weekly
- **Gamification (XP, levels, streaks, weekly scores)**: clean, premium aesthetic instead of Habitica's pixel art
- **Tree view**: hierarchical visualization unique to this product
- **Multi-format export (PDF report with charts, DOCX, Markdown)**: beyond the typical JSON/CSV

**Defer to v2+:**
- Push notifications and email digests (plan schema, do not build)
- OAuth for MCP (API keys sufficient for single user)
- Built-in AI chat (MCP is the AI integration layer)
- Team collaboration and multi-user UI (schema supports from day one, UI deferred)
- Calendar sync and time blocking (separate domain, handled by dedicated tools)
- Native mobile/desktop apps (PWA covers v1)
- Full offline-first architecture (offline-read with queued writes is sufficient)

### Architecture Approach

The architecture follows a dual-interface pattern where a shared Service Layer is the single source of truth for all business logic, consumed by both the web UI (Server Components + Client Components + API Routes) and the MCP endpoint (JSON-RPC 2.0 over Streamable HTTP). Server Components fetch data directly from the Service Layer for initial page loads (no HTTP roundtrip). Client Components use React Query for subsequent fetches and mutations, with optimistic updates for drag and drop. Zustand handles ephemeral UI state (sidebar, active view, command palette). The database schema uses `parent_id` adjacency list for both the four-level goal hierarchy and the unlimited-depth category tree.

**Major components:**
1. **Service Layer** (`lib/services/`): All business logic (goal CRUD, hierarchy traversal, progress rollup, gamification calculations, export generation). Both web UI and MCP call these identical functions. Every function takes `userId` as first parameter for multi-user readiness.
2. **Data Access Layer** (`lib/db.ts` + Prisma): Prisma Client singleton with typed queries, transactions for gamification side effects, and raw SQL utilities for recursive CTEs (progress rollup, category tree traversal).
3. **Web UI Layer** (App Router pages + Client Components): Server Components for SSR/initial data, Client Components for interactivity. React Query manages server state cache, Zustand manages UI state.
4. **MCP Route Handler** (`app/api/[transport]/route.ts`): Thin adapter wrapping `mcp-handler` or standalone SDK. Validates API key, delegates all logic to the Service Layer.
5. **Shared Validation** (`lib/validations.ts`): Zod schemas used by API routes, MCP tool definitions, and client forms. Single source of truth for input validation.

**Resolved MCP deployment conflict:** ARCHITECTURE.md recommends embedding MCP in Next.js via `mcp-handler` for colocation simplicity. PITFALLS.md warns that Next.js API routes buffer streaming responses, breaking Streamable HTTP transport. The resolution: **start embedded, test behind Traefik early, extract if needed.** The Service Layer abstraction means the MCP server can move to a standalone Express process without changing any business logic. Configure Traefik with `flushInterval: -1` for the `/api/mcp` path. On a VPS with a custom Node.js server (not Vercel serverless), buffering behavior may be different than what the GitHub issue documents. Validate within the first sprint of MCP implementation.

### Critical Pitfalls

1. **Wrong hierarchical data model**: Using materialized paths or closure tables causes write-heavy transaction locks during drag and drop. Use `parent_id` adjacency list; moving a subtree requires updating exactly one row. The four-level goal hierarchy means recursive CTEs are trivially fast (max 4 levels). Reserve more complex models for a future where unlimited goal nesting is needed.

2. **Prisma cannot do recursive queries**: Prisma issue #4562 (open since 2020, 143+ upvotes) confirms no recursive CTE support. For the fixed four-level goal hierarchy, hardcoded nested `include` chains work fine and are type-safe. For the unlimited-depth category tree and progress rollup aggregations, create a dedicated `tree-queries.ts` module with typed `$queryRaw` wrappers from day one.

3. **Next.js API route SSE buffering**: Documented in vercel/next.js#48427. Start with `mcp-handler` embedded in Next.js, configure Traefik to disable buffering on the MCP route, and validate streaming works end-to-end early. If buffering persists, extract to a standalone Node.js HTTP server on a separate port. The Service Layer abstraction makes extraction trivial.

4. **Progress rollup cascade performance**: Naive recursive recalculation on every status change causes 17+ sequential queries and UI lag. Use a single recursive CTE for rollup computation in one database round-trip. Debounce rapid changes (500ms window). Consider denormalized progress columns updated asynchronously.

5. **Premature SaaS infrastructure**: Building auth flows, RBAC, and tenant isolation before the core goal tracking works is the classic indie developer trap. Add `userId` to every table (correct) but hardcode a single user record and a simple API key for v1. No auth UI, no login page, no session management until the goal tracking experience is validated.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation
**Rationale:** Every other phase depends on the database schema, Service Layer, and project scaffolding being correct. Getting the hierarchical data model right here prevents a schema rewrite later. This phase also resolves the MCP deployment topology question early.
**Delivers:** Working database with all models, seeded test user, core Service Layer (goal CRUD, category CRUD, hierarchy validation), basic API routes, project setup with Next.js 16 + Prisma + Tailwind + shadcn/ui.
**Addresses:** Core data model, multi-user schema preparation, API key auth for MCP
**Avoids:** Wrong tree model (Pitfall 1), premature SaaS infrastructure (Pitfall 5)

### Phase 2: Core Web UI
**Rationale:** The web UI is the primary interface and needs to work before anything else. Start with list view (simplest), then dashboard (the landing page), then goal creation/editing forms. React Query hooks and cache management are established here, which all subsequent views depend on.
**Delivers:** Functional goal tracking with list view, dashboard with weekly focus, goal create/edit forms, category management UI, filtering and sorting, dark/light theme, keyboard shortcuts.
**Addresses:** Table stakes features (CRUD, views, filters, theme, shortcuts), dashboard differentiation (weekly focus)
**Avoids:** Cross-view state inconsistency (Pitfall 9, by establishing the React Query cache pattern early)

### Phase 3: MCP Server
**Rationale:** Can run in parallel with Phase 2 since it depends only on Phase 1's Service Layer. Early MCP implementation validates the streaming transport on Dokploy VPS and resolves the buffering conflict before more features are built on top. Also enables AI-assisted testing of the goal tracking system.
**Delivers:** Working MCP endpoint with intent-based tools (4-6 tools, not 20+ CRUD operations), API key authentication, validated streaming through Traefik.
**Addresses:** MCP server (key differentiator), AI integration capability
**Avoids:** MCP tool explosion (Pitfall 10), SSE buffering (Pitfall 3), CORS/proxy misconfiguration (Pitfall 11)

### Phase 4: Advanced Views and Drag-and-Drop
**Rationale:** Depends on Phase 2's React Query cache management and the established component patterns. Views should be built in order of complexity: board (kanban), tree (key differentiator), calendar, timeline (most complex, highest risk). Drag and drop spans all views and must use a single state mutation pipeline.
**Delivers:** Board/kanban view, tree view (hierarchical, key differentiator), calendar view, timeline visualization, cross-view drag and drop with optimistic updates.
**Addresses:** Tree view (differentiator), timeline (differentiator), multiple views (table stakes progression)
**Avoids:** Timeline DOM overload (Pitfall 8, use virtualization), cross-view drag-and-drop state inconsistency (Pitfall 9)

### Phase 5: Gamification and Progress
**Rationale:** Progress rollup through the hierarchy is complex and should only be built after the hierarchy itself is stable and tested through Phases 1-4. Gamification adds motivational layer on top of a working core.
**Delivers:** Progress rollup (weekly aggregates into monthly into quarterly into yearly), XP/level system, streak tracking with heat map visualization, weekly score computation, completion celebrations (proportional to goal importance), dashboard gamification widgets.
**Addresses:** Progress rollup (differentiator), gamification (differentiator), completion celebrations
**Avoids:** Gimmicky gamification (Pitfall 6, design proportional celebrations), progress rollup performance (Pitfall 4, use single recursive CTE)

### Phase 6: Power Features and Data
**Rationale:** These features enhance the experience but do not define it. Command palette, data migration, and export depend on the core being stable. Onboarding depends on MCP being functional (for the AI-guided option).
**Delivers:** Cmd+K command palette, data migration from todos.json, multi-format export (JSON, CSV, Markdown, PDF, DOCX), archive view, onboarding wizard with optional AI-guided setup.
**Addresses:** Command palette (differentiator), data migration (personal requirement), multi-format export (differentiator)
**Avoids:** Category mapping errors during migration (Pitfall 12), Cmd+K browser shortcut conflicts (Pitfall 14)

### Phase 7: PWA and Polish
**Rationale:** PWA features and animation polish come last because they are enhancement layers, not core functionality. Building the web app as a regular web app first, then adding PWA, avoids the trap of premature offline complexity. Animations are the final layer after all functionality works.
**Delivers:** PWA manifest, service worker (offline-read + queued writes), installable app, micro-interactions and view transition animations, motion preference respect, mobile-responsive refinements.
**Addresses:** PWA support (table stakes for multi-device), completion animations, view transitions
**Avoids:** iOS PWA data loss (Pitfall 7, offline-read only, sync on visibility), animation performance issues (Pitfall 13, respect prefers-reduced-motion)

### Phase Ordering Rationale

- **Phase 1 is the critical path.** Schema errors cascade into every subsequent phase. The adjacency list decision and Prisma raw query utilities must exist before any feature development.
- **Phases 2 and 3 can run in parallel** since the web UI and MCP server both depend only on the Service Layer from Phase 1. Early MCP validation resolves the streaming transport question.
- **Phase 4 depends on Phase 2** because advanced views build on the React Query cache patterns and component conventions established in the core UI phase.
- **Phase 5 (gamification) depends on Phase 1 but not Phase 2**, so its Service Layer logic could technically start in parallel with Phase 2. However, the UI widgets and celebrations depend on the dashboard from Phase 2, so practical sequencing places it after Phase 4.
- **Phase 6 depends on Phases 2 and 3** because the command palette needs the navigation structure, data migration needs the schema to be stable, and onboarding needs MCP.
- **Phase 7 is independent of everything except Phase 2** and should come last to avoid optimizing animations and PWA behavior before the features they enhance are finalized.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (MCP Server):** The embedded-vs-standalone decision needs hands-on validation behind Traefik on the Dokploy VPS. Test `mcp-handler` streaming behavior in the first implementation sprint. Also verify `mcp-handler` compatibility with Next.js 16 (the blog post references it with Next.js generally, but version-specific quirks may exist).
- **Phase 4 (Timeline):** The timeline visualization is entirely custom with no suitable library. Research virtualization strategies (`@tanstack/react-virtual` vs IntersectionObserver) and consider canvas rendering for connector lines during phase planning.
- **Phase 5 (Progress Rollup):** The recursive CTE approach for progress aggregation needs benchmarking with realistic data volumes (200+ goals across 4 levels) to validate single-digit millisecond performance claims.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Next.js 16 project setup, Prisma schema definition, and adjacency list patterns are well-documented with official guides.
- **Phase 2 (Core Web UI):** List views, forms, filters, React Query hooks, Zustand stores are standard Next.js App Router patterns with extensive documentation.
- **Phase 6 (Power Features):** cmdk/command palette, PDF generation with @react-pdf/renderer, and CSV/JSON export are all well-documented libraries with clear APIs.
- **Phase 7 (PWA):** Serwist integration with Next.js is documented, and the offline-read strategy is intentionally simple.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npmjs.com and official docs on 2026-03-30. Next.js 16 upgrade guide confirmed. Prisma 7 vs Prisma Next distinction verified via Prisma blog. |
| Features | HIGH | Based on detailed competitor analysis of 9+ products with official sources, app store reviews, and user sentiment from Reddit/Capterra/G2. Feature dependency graph is well-reasoned. |
| Architecture | HIGH | Prisma self-relations verified against official docs. MCP Streamable HTTP verified against protocol specification. Service Layer pattern is established best practice. |
| Pitfalls | HIGH | Critical pitfalls verified with production case studies (leonardqmarcq.com tree models), official GitHub issues (Prisma #4562, Next.js #48427), and academic research (gamification backfire). |

**Overall confidence:** HIGH

### Gaps to Address

- **MCP `mcp-handler` + Next.js 16 compatibility:** The `mcp-handler` package was verified against Next.js generally, but not specifically tested with Next.js 16's renamed `proxy.ts` middleware and async-only Request APIs. Validate during Phase 3 implementation.
- **Traefik streaming on Dokploy VPS:** The SSE buffering issue is documented for Vercel serverless. Behavior on a VPS with Dokploy/Traefik may differ. Needs empirical testing early in Phase 3.
- **Timeline visualization performance on mobile:** The timeline is the highest-risk custom component. No library comparison was possible because no library fits the requirements. Performance benchmarks with 100+ goal nodes on mobile PWA need validation during Phase 4.
- **dnd-kit React API stability:** The new `@dnd-kit/react` package is pre-1.0 (0.x). If it proves unstable during implementation, fall back to the classic `@dnd-kit/core` + `@dnd-kit/sortable` combo, which is battle-tested. Evaluate during Phase 4.
- **Recurring goal template system:** PITFALLS.md recommends template-based recurring goals with lazy instance generation, but the exact schema for `recurrence_rule` (cron vs iCal RRULE) needs research during Phase 2 or 5 implementation.

## Sources

### Primary (HIGH confidence)
- Next.js 16 upgrade guide: https://nextjs.org/docs/app/guides/upgrading/version-16
- Next.js PWA guide: https://nextjs.org/docs/app/guides/progressive-web-apps
- Prisma self-relations docs: https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/self-relations
- MCP Streamable HTTP specification: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http
- Prisma blog (Prisma 7 vs Prisma Next): https://www.prisma.io/blog/the-next-evolution-of-prisma-orm
- leonardqmarcq.com: PostgreSQL tree model production experience (millions of nodes)
- Prisma GitHub Issue #4562: Tree structures support (open since 2020)
- Next.js GitHub Discussion #48427: SSE buffering in API routes
- MCP handler blog: https://www.trevorlasn.com/blog/building-custom-mcp-servers-with-nextjs-and-mcp-handler
- Motion docs: https://motion.dev/docs/react
- Todoist official features: https://todoist.com/features

### Secondary (MEDIUM confidence)
- Nearform: MCP implementation tips, tricks, and pitfalls (Dec 2025)
- auth0.com: MCP Streamable HTTP transport security analysis
- Puck editor: DnD library comparison (Jan 2026)
- MagicBell: PWA iOS limitations and Safari support (2026)
- Sunsama, Reclaim, Strides reviews from competitor review sites
- Journal of Consumer Psychology: gamification backfire effects
- Capterra/G2 review aggregations for productivity tools

### Tertiary (LOW confidence)
- Reddit community discussions on gamification fatigue (r/adhdwomen)
- StackOverflow dnd-kit cross-container drag issues
- Traefik community forums on SSE/CORS configuration

---
*Research completed: 2026-03-30*
*Ready for roadmap: yes*

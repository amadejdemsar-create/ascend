# Domain Pitfalls

**Domain:** Goal tracking / OKR / priorities web app with MCP server
**Researched:** 2026-03-30
**Overall confidence:** HIGH (verified across multiple sources, official docs, and production case studies)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Choosing the Wrong Hierarchical Data Model in PostgreSQL

**What goes wrong:** Developers choose materialized paths or closure tables for hierarchical goal data because "reads are faster," then discover that move operations, reparenting, and concurrent edits require complex multi-row transactions that lock large portions of the tree, fill connection pools, and create inconsistency windows.

**Why it happens:** Materialized paths look attractive because you can query descendants without recursion (`WHERE path LIKE 'yearly.q1.%'`). Closure tables seem elegant for ancestor/descendant queries. But both require updating every descendant row when a parent moves, all within a transaction. For a goal app where users reorganize frequently (drag and drop, reprioritize), this becomes the dominant source of performance problems.

**Consequences:** Long-running transactions during drag-and-drop reordering. Connection pool exhaustion under concurrent use. Inconsistent paths if transactions fail mid-update. Complex migration logic when the tree structure changes. The developer from leonardqmarcq.com who operates millions of tree nodes in PostgreSQL explicitly warns: "materialized paths are not great for write performance" because "every move operation requires being done in a transaction and involves updating every node in the subtree."

**Warning signs:**
- Move operations taking >100ms on trees with 50+ nodes
- Deadlocks appearing when two goals are moved simultaneously
- Need for a "rebuild path" maintenance script
- Prisma `$transaction` calls wrapping every drag-and-drop action

**Prevention:** Use `parent_id` adjacency list as the primary model. This is the recommendation from production experience at scale. Moving a subtree requires updating exactly one row (the moved node's `parent_id`). For ancestor/descendant queries (progress rollup, breadcrumbs), use PostgreSQL recursive CTEs (`WITH RECURSIVE`). Cache computed paths in application memory or Redis if needed for display, but never as the source of truth for hierarchy. For Ascend specifically, the four-level hierarchy (yearly, quarterly, monthly, weekly) has a maximum depth of 4, which means recursive CTEs will always be fast (at most 4 levels of recursion). Categories with unlimited nesting are the only unbounded depth, and even there, practical depth rarely exceeds 5-6 levels.

**Phase:** Foundation/Database Schema (Phase 1). Getting this right before any other code prevents a schema rewrite later.

**Confidence:** HIGH (verified via leonardqmarcq.com production experience, Reddit SQL discussions, ackee.agency PostgreSQL comparison)

---

### Pitfall 2: Prisma Cannot Do Recursive Queries Natively

**What goes wrong:** Developer models the self-referencing `parent_id` relationship in Prisma, then discovers Prisma has no `includeRecursive` or recursive CTE support. Fetching an entire goal tree requires either (a) hardcoding nested `include` depth (`include: { children: { include: { children: { include: { children: true } } } } }`) or (b) falling back to raw SQL with `prisma.$queryRaw`. Neither option is clean.

**Why it happens:** Prisma issue #4562 (opened December 2020, still open with 143+ upvotes as of 2026) requests tree structure support. Prisma supports self-relations for schema definition but provides no recursive query API. The workaround of nested includes only works when you know the maximum depth at compile time and produces deeply nested TypeScript types.

**Consequences:** Ugly, brittle code for tree traversal. Loss of Prisma's type safety when using raw SQL. Progress rollup calculations (aggregating child completion percentages up to parents) require raw queries that bypass Prisma's query builder entirely. Every new tree-related feature needs a raw SQL escape hatch.

**Warning signs:**
- Finding yourself writing `include: { children: { include: { children: ...` chains
- Using `$queryRaw` for more than 20% of your database queries
- Type assertions (`as unknown as GoalTree`) to work around Prisma's typed results
- Category tree operations feeling awkward compared to goal CRUD

**Prevention:** Accept this limitation upfront and plan for it. Create a dedicated `tree-queries.ts` module that wraps all recursive CTEs behind typed functions. Use `prisma.$queryRaw` with explicit TypeScript interfaces for the results. For the fixed four-level goal hierarchy, hardcoded nested includes actually work fine (the depth is always 4, so `include` chains are predictable). Reserve raw CTEs for the unlimited-depth category tree and for progress rollup aggregations. Consider writing a reusable `getDescendants(nodeId)` and `getAncestors(nodeId)` utility using raw SQL once, tested thoroughly, and used everywhere.

**Phase:** Foundation/Database Layer (Phase 1). Create the raw query utilities alongside the Prisma schema.

**Confidence:** HIGH (verified via Prisma GitHub issue #4562, prisma.io official docs on relation queries)

---

### Pitfall 3: Next.js API Routes Buffer SSE/Streaming Responses

**What goes wrong:** Developer builds the MCP server as Next.js API routes (the obvious choice since the web app is already Next.js), then discovers that Next.js API routes buffer `res.write()` calls and do not flush them until `res.end()`. This breaks Server-Sent Events and the Streamable HTTP transport that MCP requires.

**Why it happens:** Next.js's internal architecture (especially in serverless/edge deployments) buffers response bodies. The GitHub discussion vercel/next.js#48427 documents this extensively. When MCP clients connect via Streamable HTTP, they expect to receive streamed responses (progress updates, partial results). If the entire response is buffered, the MCP client times out waiting for the first chunk, or receives everything at once after the tool finishes, defeating the purpose of streaming.

**Consequences:** MCP tools that take more than a few seconds appear to hang. Clients (Claude, ChatGPT, etc.) may time out and retry, causing duplicate operations. Long-running operations (bulk goal updates, export generation) fail silently. The MCP server appears broken even though the underlying logic works correctly.

**Warning signs:**
- MCP inspector shows tool calls hanging with no progress
- All MCP responses arrive as a single burst after a delay
- Works fine with STDIO transport during development, breaks when deployed as HTTP
- Reverse proxy (Traefik on Dokploy) adding additional buffering

**Prevention:** Do NOT host the MCP server inside Next.js API routes. Run it as a separate process or a standalone Node.js HTTP server. Options: (1) A separate Express/Fastify server on its own port, proxied through Traefik alongside the Next.js app. (2) Use the official TypeScript MCP SDK (`@modelcontextprotocol/sdk`) with its built-in Streamable HTTP transport server, running as a standalone process. (3) If colocation is important, use a custom Node.js server that serves both Next.js and the MCP endpoint, but ensure the MCP route bypasses Next.js's response handling. Also configure Traefik/reverse proxy to disable response buffering for the MCP endpoint (`X-Accel-Buffering: no` header, or Traefik's `flushInterval` setting).

**Phase:** Architecture/Infrastructure (Phase 1). Decide on MCP server deployment topology before writing any MCP code.

**Confidence:** HIGH (verified via vercel/next.js#48427, nearform.com MCP pitfalls guide, auth0.com MCP transport analysis)

---

### Pitfall 4: Progress Rollup Calculations That Don't Scale

**What goes wrong:** Developer implements progress rollup (weekly goals aggregate into monthly progress, monthly into quarterly, quarterly into yearly) as synchronous, recursive calculations triggered on every status change. With 50+ active goals, a single checkbox toggle triggers a cascade of recalculations that causes noticeable UI lag and database load.

**Why it happens:** The naive approach is intuitive: when a weekly goal is completed, recalculate its monthly parent's progress, then its quarterly grandparent, then its yearly great-grandparent. Each recalculation queries all siblings at that level. For a yearly goal with 4 quarterly children, each with 3 monthly children, each with 4 weekly goals, that is 1 + 4 + 12 = 17 database queries on every status update, executed sequentially.

**Consequences:** UI feels sluggish when checking off goals. Multiple rapid updates (checking off several weekly goals in a row) cause race conditions where rollup calculations overlap and produce incorrect percentages. MCP bulk operations (updating many goals at once) become extremely slow.

**Warning signs:**
- Dashboard progress bars flickering or showing stale percentages
- "Completed 3/4" showing after marking the 4th item complete (stale cache)
- API response times increasing linearly with goal tree depth
- Database query count per page load exceeding 30-40

**Prevention:** Use a single recursive CTE query for rollup calculation instead of sequential per-level queries. Compute all ancestor progress in one database round-trip. Debounce rollup recalculation (batch multiple changes within a 500ms window before recalculating). Consider storing computed progress as a denormalized column on each goal, updated asynchronously via a background job or database trigger. For the dashboard, calculate rollup on read (query time) rather than maintaining it eagerly on write. With PostgreSQL, a well-indexed recursive CTE across a 4-level hierarchy with hundreds of goals will execute in single-digit milliseconds.

**Phase:** Core Features (Phase 2, when implementing progress tracking). Design the rollup strategy before building the progress UI.

**Confidence:** MEDIUM-HIGH (synthesized from PowerBI community forums on parent-child aggregation, Microsoft Dynamics goal rollup patterns, general database performance principles)

---

### Pitfall 5: Building Multi-User SaaS Infrastructure Before Validating Single-User Value

**What goes wrong:** Developer spends weeks building auth flows, team management, role-based access control, subscription billing schema, tenant isolation, and invitation systems before the core goal tracking experience works. The product never launches because the infrastructure keeps growing.

**Why it happens:** The PROJECT.md explicitly calls for "multi-user database schema from day one" and lists future SaaS features. This creates a mindset where every feature gets evaluated through the lens of "but what about when we have multiple users?" The `user_id` foreign key on every table is cheap and correct. But extending that to full multi-tenant behavior (auth middleware on every route, row-level security, API key management per user, rate limiting) before having a working product is premature optimization of the business model.

**Consequences:** Months of development before the first usable version. Decision paralysis on auth providers. Complex data access patterns where simple queries would suffice. The goal tracking UX (the actual value proposition) gets less attention than infrastructure. When the app finally launches, the goal tracking itself is mediocre because most energy went into scaffolding.

**Warning signs:**
- More code in `middleware.ts` than in any feature component
- Auth and permissions logic in every API route
- Choosing between Clerk/Auth0/NextAuth before the dashboard exists
- Database queries wrapped in tenant-isolation helpers when only one user exists

**Prevention:** The PROJECT.md already has the right instinct: `user_id` on all tables. Do exactly that and nothing more for v1. Use a hardcoded user record (seeded in the database) with a simple API key for MCP access. No auth UI, no login page, no session management. The schema is multi-user ready (every query includes `WHERE user_id = ?`), but the application code treats the single user as a given. When converting to SaaS later, add auth middleware that resolves the user from the session and passes `user_id` to queries. The database schema does not change.

**Phase:** Foundation (Phase 1). Set up the single hardcoded user and API key. Defer all auth infrastructure to the SaaS conversion phase.

**Confidence:** HIGH (this is a well-documented pattern in the indie hacker / solo developer community, supported by training data and general software engineering wisdom)

## Moderate Pitfalls

### Pitfall 6: Gamification That Feels Gimmicky Instead of Meaningful

**What goes wrong:** Developer adds XP, levels, badges, confetti explosions, streak counters, and leaderboards, then discovers that the gamification feels childish and actually demotivates the user when streaks break or arbitrary badges are awarded for trivial actions.

**Why it happens:** Gamification is easy to implement (a counter, a modal with confetti) but hard to design well. Research from the Journal of Consumer Psychology (2025) documents that digital tracking and gamification can backfire: streak pressure creates anxiety, missed days feel like failure, and extrinsic rewards (points, badges) can undermine intrinsic motivation for the goals themselves. The Reddit ADHD community documents this phenomenon clearly: "gamified apps either get me fixated on keeping my streak to the exclusion of doing the thing properly or send me into a rage from prodding."

**Warning signs:**
- Spending more time on confetti particle systems than on goal creation UX
- Awarding badges for actions that are not achievements (e.g., "Created your first goal!")
- Streak counter becoming a source of stress rather than motivation
- User avoiding marking goals as failed/abandoned because it hurts their "score"

**Prevention:** Design gamification around intrinsic value, not dopamine tricks. (1) Progress bars and completion percentages are inherently motivating because they show real progress toward real goals; implement these first. (2) Streak tracking should show positive patterns without punishing breaks; use a "heat map" visualization (like GitHub contributions) rather than a streak counter that resets to zero. (3) XP/levels should correlate with meaningful milestones: completing a quarterly goal is worth more than 13 weekly tasks, because it represents sustained effort. (4) Keep celebrations proportional: a subtle checkmark animation for a weekly task, a more visible animation for a monthly goal, confetti only for quarterly/yearly completions. (5) Never gate functionality behind gamification (no "unlock views by earning XP"). (6) Make all gamification optional/toggleable.

**Phase:** Polish/Gamification (Phase 3 or later). Build the core goal tracking UX first. Add gamification only after the basic experience feels solid.

**Confidence:** MEDIUM-HIGH (synthesized from academic research on gamification backfire effects, fitness app comparison studies from getfitcraft.com, Reddit community discussions)

---

### Pitfall 7: PWA Offline Mode That Silently Loses Data on iOS

**What goes wrong:** Developer implements PWA offline support expecting it to work like a native app, then discovers that iOS Safari deletes all cached data after 7 days of inactivity, has no Background Sync API support, and offers only ~50MB of storage. User opens the PWA after a week away and all offline data is gone.

**Why it happens:** PWA capabilities differ dramatically between platforms. Android Chrome is generous with storage, supports background sync, and retains cached data. iOS Safari imposes strict limits: 7-day cache expiry for inactive PWAs, no background sync at all, 50MB storage cap, and aggressive cleanup when the device is low on space. The EU situation is even worse: iOS 17.4+ in EU countries removed standalone PWA mode entirely (PWAs open as Safari tabs).

**Consequences:** User makes offline changes to goals (marks tasks complete, adds new goals), puts down the phone, and those changes never sync because the service worker cannot run in the background. Worse: if they do not open the app for 7 days, the entire service worker cache is purged, and the app must re-download everything. Any pending offline changes stored in IndexedDB may also be lost during iOS's aggressive storage cleanup.

**Warning signs:**
- Offline changes "disappearing" after the app is reopened
- PWA requiring full re-download after a week of inactivity
- Conflict resolution logic never being triggered (because offline changes are lost before sync)
- iOS testers reporting a fundamentally different experience than Android testers

**Prevention:** (1) Do not promise offline-first for v1. Instead, implement offline-read (cached dashboard data for viewing) and queue offline-writes in IndexedDB, but display a clear "pending sync" indicator. (2) Re-cache critical assets on every app launch, not just on service worker install. (3) Sync pending changes immediately when the app becomes visible (`visibilitychange` event) and when the device comes online (`online` event), because Background Sync is unavailable on iOS. (4) Keep cached data well under 50MB (goal data is text, so this should be easy). (5) Display a "last synced: X minutes ago" indicator so the user knows their data state. (6) Accept that PWA offline on iOS is "read cached data + queue writes" rather than "full offline mode."

**Phase:** PWA Implementation (Phase 3 or later). Build the web app as a regular web app first. Add PWA features after the online experience is solid.

**Confidence:** HIGH (verified via magicbell.com 2026 iOS PWA guide, brainhub.eu PWA iOS analysis, webkit.org feature status)

---

### Pitfall 8: Timeline Visualization Rendering All Nodes at Once

**What goes wrong:** Developer builds a timeline view showing all goals as nodes on a horizontal year line, with expandable quarters/months/weeks. With 100+ goals, the browser grinds to a halt because every goal node is rendered as a React component in the DOM simultaneously.

**Why it happens:** The natural approach is to map over all goals and render them. For a list view, React handles hundreds of items fine. But a timeline view is different: each goal is a positioned element with connectors, hover states, expand/collapse animations, and potentially drag handles. The layout calculation itself becomes expensive, and the DOM node count grows multiplicatively (goal node + label + connector line + status indicator + expand button = 5+ elements per goal).

**Consequences:** Timeline view loads slowly and scrolls with visible jank. Animations stutter. Memory usage grows linearly with goal count. On mobile (the PWA), the timeline becomes unusable.

**Warning signs:**
- Timeline taking >500ms to render on initial load
- Scroll jank visible on a MacBook Pro (let alone mobile)
- React DevTools showing hundreds of simultaneous re-renders when expanding a quarter
- Memory usage increasing as the user scrolls through the timeline

**Prevention:** (1) Implement virtualization for the timeline: only render goal nodes that are currently visible in the viewport, plus a small buffer. Libraries like `@tanstack/react-virtual` or a custom IntersectionObserver approach work well. (2) Use CSS transforms for positioning instead of top/left (enables GPU compositing). (3) Collapse distant time periods by default (only the current quarter is expanded, others show summary counts). (4) Consider canvas rendering for the connector lines while keeping goal nodes as DOM elements (hybrid approach). (5) Debounce expand/collapse animations so expanding a quarter does not trigger a full re-render. (6) For mobile, consider a simplified vertical timeline instead of the horizontal one.

**Phase:** Views Implementation (Phase 2-3). Timeline is the most complex view; build list and board views first, then tackle timeline with performance in mind from the start.

**Confidence:** MEDIUM-HIGH (verified via React performance articles from syncfusion.com and growin.com, TanStack Virtual documentation patterns)

---

### Pitfall 9: Drag and Drop Across Different View Types Breaking State

**What goes wrong:** Developer implements drag-and-drop in the list view, then in the board/kanban view, then in the tree view, each with its own state management. Moving a goal in one view does not update the others, or worse, causes the state to become inconsistent because each view maintains its own representation of the goal hierarchy.

**Why it happens:** `dnd-kit`'s `SortableContext` is designed for items within a single list. Moving items between containers (different kanban columns, different tree branches, or between horizons) requires manual state management in `onDragOver` and `onDragEnd`. The official examples show this for a simple kanban, but do not cover the case where multiple view types share the same underlying data with different visual representations.

**Consequences:** A goal moved from "In Progress" to "Done" in the kanban view does not reflect in the tree view until a page refresh. Dragging a weekly goal under a different monthly parent in the tree view updates `parent_id` but does not move the kanban card. Optimistic updates in one view conflict with server state fetched by another view.

**Warning signs:**
- Views showing different data after a drag-and-drop operation
- Need for "Refresh" buttons on each view
- Race conditions between optimistic updates and server responses
- Separate `useState` or `useReducer` calls managing goal order per view

**Prevention:** (1) Use a single source of truth for goal state (server state via React Query / TanStack Query with optimistic mutations). All views read from the same cached query. (2) Drag-and-drop operations mutate the server (API call), and the optimistic update modifies the shared cache, so all views update simultaneously. (3) Use `dnd-kit` only for the visual drag interaction; the actual state change flows through the normal mutation pipeline. (4) For cross-container drag (moving between horizons or categories), update both `parent_id` and any sort-order field in a single API call. (5) Test drag-and-drop with two views open side by side to catch synchronization issues early.

**Phase:** Views Implementation (Phase 2). Design the shared state management pattern before implementing drag-and-drop in any view.

**Confidence:** MEDIUM (synthesized from dnd-kit GitHub discussions, Reddit reactjs community, StackOverflow dnd-kit cross-container issues)

---

### Pitfall 10: MCP Tool Explosion and Confused LLM Tool Selection

**What goes wrong:** Developer creates one MCP tool per UI action (create_goal, update_goal, delete_goal, get_goal, list_goals, move_goal, complete_goal, archive_goal, set_priority, add_progress, create_category, update_category, delete_category, get_categories, reorder_goals...) resulting in 20+ tools. LLMs start calling the wrong tools because descriptions overlap. "Should I use `update_goal` or `move_goal` to change a goal's parent?"

**Why it happens:** The instinct is to mirror the REST API 1:1 as MCP tools. But MCP tools are consumed by language models, not by frontend code. Models work better with fewer, well-differentiated tools with clear descriptions than with a large surface area of similar-sounding operations. The Nearform MCP guide explicitly warns: "defining two tools that are very similar or too many tools will cause the model to call the wrong one or with wrong inputs."

**Consequences:** LLMs call `update_goal` when they should call `complete_goal`. The model generates incorrect parameters because it confuses which tool expects which schema. Users chatting with AI assistants experience inconsistent behavior. Debugging is difficult because the problem is in tool selection, not in tool implementation.

**Warning signs:**
- LLM calling the wrong tool more than 10% of the time
- Tool descriptions containing phrases like "use this instead of X"
- Multiple tools accepting the same parameters but doing different things
- Need for elaborate system prompt instructions just to explain which tool to use when

**Prevention:** (1) Design tools around user intents, not CRUD operations. Example: `manage_goals` (create, update, delete, move via an `action` parameter) + `query_goals` (list, filter, search, get tree) + `track_progress` (add progress entry, complete, archive) + `manage_categories` (CRUD for categories). Four tools instead of twenty. (2) Use enums for the `action` parameter so the model sees all options. (3) Write tool descriptions from the LLM's perspective: "Use this tool when the user wants to create, edit, move, or delete a goal" rather than "Creates a goal in the system." (4) Test with actual LLMs (Claude, ChatGPT) during development, not just with the MCP inspector. (5) Set a maximum tool call limit to prevent infinite loops.

**Phase:** MCP Server Implementation (Phase 2). Design the tool surface area before implementing individual tools.

**Confidence:** HIGH (verified via nearform.com MCP pitfalls guide, MCP specification best practices)

## Minor Pitfalls

### Pitfall 11: CORS and Reverse Proxy Misconfiguration for MCP Endpoint

**What goes wrong:** MCP server works locally but breaks when deployed behind Traefik on Dokploy. Streamable HTTP connections are dropped, CORS preflight fails, or SSE streams are prematurely closed.

**Prevention:** (1) Configure Traefik to disable response buffering for the MCP endpoint path (set `flushInterval` to `-1`). (2) Add explicit CORS headers on the MCP server (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers` including `Authorization`). (3) Ensure Traefik does not time out long-lived connections (increase `IdleConnTimeout`). (4) Test the MCP endpoint through the full proxy chain during development, not just directly.

**Phase:** Deployment (Phase 1, infrastructure setup).

---

### Pitfall 12: Data Migration from JSON Treating Categories as an Afterthought

**What goes wrong:** Developer imports tasks from `todos.json` into the new database but does not map the existing categories (NativeAI, Nevron, Personal, Finance, Things to Buy) to the new category tree, or creates flat categories when the user expects nested subcategories, or loses the project groupings within categories.

**Prevention:** (1) Write a migration script that reads `todos.json`, creates categories from the existing groupings, and maps each task to its correct category and time horizon. (2) Review the existing JSON structure with the user before migrating. (3) Run the migration against a staging database first. (4) Preserve the original JSON as a backup in the database (a `migration_source` JSONB column or a separate table).

**Phase:** Data Migration (Phase 2, after the schema and basic CRUD are working).

---

### Pitfall 13: Animated Counters and Confetti on Every Interaction

**What goes wrong:** Rich animations (animated progress counters, parallax timeline scrolling, completion celebrations) cause performance issues on lower-end devices and create motion sickness for users sensitive to animation. Confetti on every task completion becomes annoying within the first day.

**Prevention:** (1) Respect `prefers-reduced-motion` media query for all animations. (2) Throttle animation frame rate on low-end devices (check `navigator.hardwareConcurrency`). (3) Scale celebration intensity to goal importance: no animation for weekly tasks, subtle for monthly, confetti only for quarterly/yearly. (4) Use CSS animations/transitions instead of JavaScript animation libraries where possible (better performance, composited on GPU). (5) Make all celebratory animations optional in settings.

**Phase:** Polish/Gamification (final phase). Animations come last, after functionality is complete.

---

### Pitfall 14: Cmd+K Command Palette Conflicting with Browser and OS Shortcuts

**What goes wrong:** `Cmd+K` is already used by many browsers (Safari: address bar, Chrome: search bar) and by macOS itself. The PWA's command palette intercepts the shortcut in standalone mode but not in browser tabs, creating inconsistent behavior.

**Prevention:** (1) In standalone PWA mode, `Cmd+K` works as expected. In browser tabs, detect the context and either use an alternative shortcut or let the browser handle it with a fallback button. (2) Provide a visible trigger button (search icon in the nav bar) as the primary access point, with `Cmd+K` as the power-user shortcut. (3) Test keyboard shortcuts in both standalone PWA mode and regular browser mode.

**Phase:** Navigation/UX (Phase 2-3).

---

### Pitfall 15: Recurring Goals Creating Orphan Instances

**What goes wrong:** A daily recurring goal creates a new instance every day. After a month, there are 30 completed instances cluttering the archive. If the recurrence schedule changes, old instances may reference a parent template that no longer matches their frequency.

**Prevention:** (1) Store recurring goals as a template with a `recurrence_rule` (cron-like or iCal RRULE). (2) Generate instances lazily (only create the current period's instance, not all future ones). (3) Link instances to the template via `template_id`, separate from the goal hierarchy's `parent_id`. (4) When archiving, aggregate recurring instances into a summary (e.g., "Completed 22/30 days in March") rather than showing 30 individual entries.

**Phase:** Core Features (Phase 2, recurring goals implementation).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Database Schema | Wrong tree model (materialized path) | Use `parent_id` adjacency list, recursive CTEs for traversal |
| Database Schema | Prisma recursive query gap | Create raw SQL utility module from day one |
| Infrastructure | MCP inside Next.js API routes | Separate process, standalone HTTP server |
| Infrastructure | Traefik buffering MCP streams | Configure `flushInterval`, disable buffering |
| Core Features | Progress rollup cascade | Single recursive CTE, debounce recalculation |
| Core Features | Recurring goal proliferation | Template-based with lazy instance generation |
| Views/Timeline | DOM overload on timeline | Virtualization, collapse distant periods, hybrid canvas |
| Drag and Drop | Cross-view state inconsistency | Single query cache (TanStack Query), optimistic mutations |
| MCP Server | Too many overlapping tools | Intent-based tool design, 4-6 tools max |
| Gamification | Gimmicky rewards, streak anxiety | Proportional celebrations, heat map over streak counter |
| PWA | iOS data loss after 7 days | Re-cache on launch, sync on visibility, no offline promises |
| Migration | Category mapping from JSON | Pre-migration review, staging database test |
| Auth/Multi-user | Premature SaaS infrastructure | Hardcoded user + API key for v1, schema-only multi-tenancy |
| Animations | Performance and motion sickness | `prefers-reduced-motion`, scale to goal importance |

## Sources

- [leonardqmarcq.com: Do's and Don'ts of Storing Large Trees in PostgreSQL](https://leonardqmarcq.com/posts/dos-and-donts-of-modeling-hierarchical-trees-in-postgres) (2024, production experience with millions of tree nodes)
- [Reddit r/SQL: Materialized Path or Closure Table discussion](https://www.reddit.com/r/SQL/comments/1puo2x6/materialized_path_or_closure_table_for/) (2024)
- [Ackee Blog: Hierarchical models in PostgreSQL](https://www.ackee.agency/blog/hierarchical-models-in-postgresql) (comparison of all approaches)
- [Prisma GitHub Issue #4562: Tree structures support](https://github.com/prisma/prisma/issues/4562) (open since 2020, 143+ upvotes)
- [Nearform: Implementing MCP Tips, Tricks and Pitfalls](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/) (Dec 2025)
- [MagicBell: PWA iOS Limitations and Safari Support 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) (2026)
- [Next.js GitHub Discussion #48427: SSE don't work in API routes](https://github.com/vercel/next.js/discussions/48427) (buffering issue)
- [auth0.com: Why MCP's Move Away from SSE Simplifies Security](https://auth0.com/blog/mcp-streamable-http/) (Streamable HTTP analysis)
- [TheNewStack: MCP roadmap 2026 growing pains](https://thenewstack.io/model-context-protocol-roadmap-2026/) (MCP production challenges)
- [getfitcraft.com: Gamified vs Non-Gamified Apps research](https://getfitcraft.com/compare/gamified-vs-non-gamified-apps) (gamification backfire data)
- [Journal of Consumer Psychology: Digital Tracking, Gamification, and AI](https://myscp.onlinelibrary.wiley.com/doi/10.1002/arcp.70004) (academic research on gamification effects)
- [Reddit r/adhdwomen: Gamifying does nothing for me](https://www.reddit.com/r/adhdwomen/comments/1qwxhq2/gamifying_does_nothing_for_me/) (user perspective on gamification fatigue)
- [dnd-kit GitHub: Cross-container drag issues](https://stackoverflow.com/questions/74764468/dnd-kit-incorrect-behavior-while-trying-to-move-item-to-another-container-in-rea)
- [Traefik Community: CORS and SSE configuration issues](https://community.traefik.io/t/server-sent-event-cors-issue-with-simple-traefik-configuration/11195)

---
*Confidence levels: HIGH = verified with official docs/production case studies. MEDIUM-HIGH = verified with multiple community sources. MEDIUM = synthesized from community patterns and training data.*

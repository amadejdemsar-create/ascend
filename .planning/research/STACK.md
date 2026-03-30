# Technology Stack

**Project:** Ascend (Personal Goals & Priorities Web App)
**Researched:** 2026-03-30
**Overall confidence:** HIGH

## Critical Stack Update: Next.js 15 vs 16

The PROJECT.md specifies Next.js 15, but **Next.js 16 (16.2.1)** is the current stable release as of March 2026. Key differences that matter for Ascend:

| Factor | Next.js 15 | Next.js 16 |
|--------|-----------|-----------|
| Turbopack | Opt-in flag | Default (stable) |
| React version | 19.x | 19.2 (View Transitions, Activity, useEffectEvent) |
| React Compiler | Experimental | Stable (opt-in) |
| Async Request APIs | Sync still works (deprecated) | Sync fully removed, async only |
| Middleware | `middleware.ts` | Renamed to `proxy.ts` |
| Routing | Standard | Overhauled (layout deduplication, incremental prefetching) |
| PPR | `experimental.ppr` | `cacheComponents` (new system) |
| ESLint | `next lint` command | Removed, use ESLint/Biome directly |
| Support window | Security patches until October 2026 | Active development |

**Recommendation: Use Next.js 16.** This is a greenfield project, so there is no migration cost. React 19.2 View Transitions are valuable for Ascend's animated view switching. The React Compiler provides free performance wins. Turbopack as default means faster dev/build cycles. Starting on 15 means an inevitable migration within months.

**Confidence:** HIGH (verified via official Next.js upgrade docs at nextjs.org/docs/app/guides/upgrading/version-16)

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.2.x | Full-stack React framework | Current stable. Turbopack default, React 19.2 with View Transitions (perfect for animated view switching), stable React Compiler, overhauled routing with layout deduplication. App Router provides API routes for MCP server endpoint. |
| React | 19.2.x | UI library | Bundled with Next.js 16. View Transitions enable native animated navigation between goal views. Activity component useful for keeping background views warm. useEffectEvent simplifies effect logic. |
| TypeScript | 5.x | Type safety | Required by Next.js 16 (minimum 5.1.0). End-to-end type safety from Prisma schema to API to UI. |

### Database & ORM

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16.x | Primary database | Proven relational DB. Handles hierarchical goal data well with recursive CTEs. JSON columns for flexible metadata. Runs as container on Dokploy VPS. |
| Prisma ORM | 7.6.x | Database toolkit | Current stable (7.6.0). Best TypeScript integration with auto-generated types from schema. Mature migration system. Excellent Next.js integration. "Prisma Next" (full TS rewrite) is in development but not production-ready; stick with Prisma 7 for now. |

**Note on Prisma Next:** Prisma is developing a complete TypeScript rewrite called "Prisma Next" (separate from the current Prisma ORM). It is not yet ready for production. The official Prisma blog states: "We are fully committed to Prisma 7. It remains the recommended version for production applications." Use Prisma 7.6.x.

**Confidence:** HIGH (versions verified via npmjs.com, Prisma blog)

### UI Framework & Design

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| shadcn/ui | latest | Component library | Not a dependency but a code-copy pattern. Components are owned by the project. Built on Radix UI primitives. Includes a Command component (wraps cmdk) out of the box. Consistent with NativeAI website stack. |
| Tailwind CSS | 4.x | Utility CSS | Integrated with Next.js 16 and shadcn/ui. v4 uses a CSS-first config approach. Design token system maps well to Ascend's NativeAI palette. |
| Lucide React | latest | Icons | Tree-shakable, consistent with shadcn/ui ecosystem. Lightweight SVG icons. |
| Inter | (Google Fonts) | Body/UI typography | Specified in PROJECT.md. Excellent readability at all sizes. |
| Playfair Display | (Google Fonts) | Headline typography | Specified in PROJECT.md. Elegant serif for dashboard headers and goal titles. |
| JetBrains Mono | (Google Fonts) | Code/data typography | Specified in PROJECT.md. Monospace for numeric data, progress percentages, XP values. |

**Confidence:** HIGH

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.0.x | Client state | Minimal, performant, no boilerplate. Perfect for UI state (sidebar collapse, active view, drag state, theme). v5 is current stable (5.0.12). Does not need providers/context wrapping. Works seamlessly with React Server Components. |
| nuqs | 2.8.x | URL state | Type-safe search params management for filter/view state. Keeps filters bookmarkable and shareable. Works with Next.js App Router. Current version 2.8.9. |

**Not using Redux/Jotai/Recoil:** Zustand covers all client-state needs with far less complexity. Server state lives in the database via Prisma; React Server Components handle data fetching. No need for a heavy state management solution.

**Confidence:** HIGH (versions verified via npmjs.com)

### Drag and Drop

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @dnd-kit/react | 0.x (new API) | Drag and drop interactions | Best balance of customizability, performance, and React integration. Supports sortable lists (goal reordering), cross-container moves (horizon changes), and custom collision detection. Actively maintained with millions of npm downloads. The new `@dnd-kit/react` package provides a more ergonomic API. |

**Alternatives considered:**

| Library | Why Not |
|---------|---------|
| @atlaskit/pragmatic-drag-and-drop (1.7.9) | Built on HTML5 DnD API. Lighter weight but limited visual feedback (no live preview placeholder, no snapping animations). For a goal app with polished micro-interactions, this matters. Also has Apache 2.0 license and opaque development process. |
| @hello-pangea/dnd | Community fork of react-beautiful-dnd. Lists only, no grid support. Heavier bundle. Limited customization. |
| formkit/drag-and-drop | Still pre-1.0 (experimental). Small community. Limited accessibility. |

**Key consideration:** dnd-kit is the established choice for React drag and drop that needs custom behavior. The experimental `@dnd-kit/react` package is the new recommended API. If it feels too unstable at implementation time, fall back to the classic `@dnd-kit/core` + `@dnd-kit/sortable` combo, which is battle-tested.

**Confidence:** HIGH (verified via Puck's 2026 comparison article, npm registry, GitHub issues)

### Animations & Micro-interactions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Motion (prev. Framer Motion) | 12.x | UI animations | Renamed from "framer-motion" to "motion" (npm: `motion`). Current version 12.37.0+. The standard for React animation. Declarative API, layout animations, gesture support, AnimatePresence for exit animations. Powers progress bar animations, completion celebrations, view transitions, parallax effects. |
| canvas-confetti | 1.9.x | Completion celebrations | Lightweight (no React dependency), performant confetti animation on HTML canvas. Perfect for goal completion celebrations. 1.9.4 is current. |

**Not using:** React Spring (less ergonomic API, smaller community), GSAP (overkill for UI animations, licensing concerns), CSS-only animations (insufficient for complex orchestrated sequences and layout animations).

**Confidence:** HIGH (versions verified via motion.dev and npmjs.com)

### Command Palette

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| cmdk | 1.1.1 | Command menu | The standard. Used by Vercel, Linear, Raycast. Composable API, accessible, unstyled (fits any design). shadcn/ui wraps it as its Command component, so it integrates seamlessly. Supports pages/nesting for sub-commands, async results, keyboard navigation. |

**Note:** shadcn/ui already ships a Command component built on cmdk. Use that as the foundation and extend it with Ascend-specific actions (search goals, navigate categories, quick-add goal, theme switch).

**Confidence:** HIGH (verified via npmjs.com, shadcn/ui docs)

### Charts & Progress Visualization

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Recharts | 3.8.x | Charts and data viz | React-first library built on D3 submodules. SVG rendering. Composable chart components (BarChart, LineChart, RadialBarChart, PieChart). v3 added TypeScript generics for type-safe data. Perfect for progress dashboards, weekly scores, streak visualizations, category breakdowns. Current version 3.8.1. |

**Alternatives considered:**

| Library | Why Not |
|---------|---------|
| Nivo | More chart types but larger bundle. Server-side rendering support is overkill for a PWA dashboard. Less React-idiomatic API. |
| Victory | Cross-platform focus (React Native). Smaller ecosystem for web-only use. |
| Tremor | Higher-level (pre-styled dashboard components). Less customizable for Ascend's unique design language. |
| Chart.js / react-chartjs-2 | Canvas-based (harder to style consistently with Tailwind). Less composable than Recharts. |

**Confidence:** HIGH (verified via npmjs.com, multiple comparison articles from 2026)

### Timeline Visualization

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom implementation | N/A | Horizontal year timeline | No existing library matches the specific requirements (horizontal year line with expandable quarters/months/weeks, goals as nodes, inline expand). Build with Recharts for the data layer + Motion for animations + Tailwind for layout. |

**Why custom:** The timeline visualization in Ascend is highly specific: a horizontal year line with quarters, expandable to months/weeks, goals as interactive nodes, inline expand on click. Existing timeline libraries (vis-timeline, react-chrono, react-calendar-timeline) are either Gantt-focused, vertical-only, or too opinionated in design. Building custom gives full control over the interaction model and visual design, which is critical for Ascend's "productivity meets beauty" aesthetic.

**Implementation approach:** Use a horizontal scrollable container with CSS Grid for the time axis. Recharts CustomizedXAxis for optional data overlays. Motion for expand/collapse animations and parallax scrolling. This is achievable with the existing stack without adding another dependency.

**Confidence:** MEDIUM (custom build carries more implementation risk than using a library, but no suitable library exists for this specific UX pattern)

### PDF & Document Export

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @react-pdf/renderer | 4.3.x | PDF generation | Declarative React-based PDF creation. Define PDF layout with React components. Runs server-side in Next.js API routes. Perfect for generating formatted goal reports. Current version 4.3.2. |
| docx | 9.6.x | DOCX generation | Declarative TypeScript API for creating Word documents. No template files needed, pure code generation. Works in Node.js (API routes). Current version 9.6.1. |

**CSV and JSON export:** No library needed. Implement with built-in Node.js APIs. JSON is `JSON.stringify`, CSV is trivial string concatenation or use `json2csv` if edge cases arise.

**Markdown export:** No library needed. Template literal string construction from goal data.

**Confidence:** HIGH (versions verified via npmjs.com)

### MCP Server

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @modelcontextprotocol/sdk | 1.28.x | MCP TypeScript SDK | Official SDK for building MCP servers. Current version 1.28.0. Supports Streamable HTTP transport (the modern MCP standard). Single endpoint, works with Claude, ChatGPT, Gemini, Perplexity. Integrates into Next.js API route handler. |

**Implementation approach:** The MCP server runs as a Next.js API route (`/api/mcp`). The SDK's `McpServer` class with `StreamableHTTPServerTransport` handles the protocol. Each MCP tool maps to the same service layer the web UI uses, ensuring feature parity. API key authentication via Bearer token in headers.

**Confidence:** HIGH (version verified via npmjs.com)

### PWA Support

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Serwist | 9.5.x | Service worker toolkit | The successor to `next-pwa`. Current version 9.5.7. `@serwist/next` integrates directly with Next.js. Handles service worker registration, caching strategies, offline fallback. Works with Next.js 16 and Turbopack (next-pwa does NOT work with Turbopack). |

**Why not next-pwa:** `next-pwa` is incompatible with Turbopack, which is the default bundler in Next.js 16. Serwist is the official spiritual successor, actively maintained, and recommended by the community.

**Why not manual service worker:** Next.js official docs show a manual approach, but Serwist provides better caching strategies, precaching of build assets, and background sync out of the box. Worth the dependency for a proper PWA.

**Confidence:** HIGH (verified via npmjs.com, Next.js community recommendations, and a 2025 article confirming Serwist works with Next.js 16)

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.x | Date manipulation | All date operations: goal deadlines, horizon calculations, streak tracking, timeline rendering. Tree-shakable (import only what you use). |
| zod | 3.x | Schema validation | API input validation, form validation, MCP tool parameter validation. Works with Prisma for schema consistency. Already a shadcn/ui dependency. |
| sonner | latest | Toast notifications | Lightweight toast library. Already integrated with shadcn/ui. Used for success/error feedback on goal actions. |
| next-themes | latest | Theme switching | Dark/light theme with system preference detection. Standard for Next.js apps. |
| @tanstack/react-table | 5.x | Table/list views | Headless table library for the sortable/filterable list view of goals. Type-safe, performant with large datasets. |

### Dev Dependencies

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| ESLint | 9.x | Linting | Flat config (Next.js 16 removes `next lint`, use ESLint directly with `@next/eslint-plugin-next`) |
| Prettier | 3.x | Formatting | Code style consistency |
| prettier-plugin-tailwindcss | latest | Tailwind class sorting | Auto-sort Tailwind classes |

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| Next.js 15 | Current but superseded. Next.js 16 is stable and offers View Transitions, React Compiler, Turbopack default. No reason to start a greenfield project on 15. |
| Drizzle ORM | Good alternative to Prisma but less mature migration tooling, smaller ecosystem. Prisma 7 is proven and recommended. |
| Prisma Next (TS rewrite) | Not production-ready. Still in development. Stick with Prisma 7. |
| next-pwa | Incompatible with Turbopack (Next.js 16 default bundler). Use Serwist instead. |
| react-beautiful-dnd | Abandoned by Atlassian. Use dnd-kit or pragmatic-drag-and-drop. |
| Redux / Redux Toolkit | Massive overkill for a personal app. Zustand handles all client state needs with a fraction of the boilerplate. |
| Framer Motion (old package name) | The package is now called `motion` (npm: `motion`). The `framer-motion` npm package still works but redirects to the same code. Use `motion` directly for clarity. |
| tRPC | Adds complexity without proportional benefit for a single-developer project where the API consumer is the same codebase. Server Actions + API routes are sufficient. |
| Supabase / Firebase | PROJECT.md specifies PostgreSQL on Dokploy VPS. Adding a BaaS layer would introduce unnecessary complexity and vendor lock-in. |
| vis-timeline / react-chrono | Gantt-chart focused or vertical timelines. Neither matches Ascend's horizontal expandable timeline UX. |

## Installation

```bash
# Core framework
npx create-next-app@latest ascend --typescript --tailwind --eslint --app --src-dir

# Database
npm install prisma @prisma/client

# UI
npx shadcn@latest init
npm install motion cmdk recharts lucide-react

# State
npm install zustand nuqs

# Drag and drop
npm install @dnd-kit/react

# PWA
npm install serwist @serwist/next

# MCP
npm install @modelcontextprotocol/sdk

# Export
npm install @react-pdf/renderer docx

# Utilities
npm install date-fns zod sonner next-themes canvas-confetti
npm install @tanstack/react-table

# Dev
npm install -D prisma prettier prettier-plugin-tailwindcss @types/canvas-confetti
```

## Architecture Notes for Roadmap

1. **MCP and Web UI share a service layer.** Define all business logic in a `services/` directory. API routes (for MCP) and Server Actions (for web UI) both call into services. This guarantees feature parity.

2. **Multi-user schema from day one.** Every Prisma model gets a `userId` field. v1 hardcodes a single user, v2 adds auth.

3. **Timeline is custom, plan accordingly.** This is the highest-risk UI component. Allocate a dedicated phase for it. Start with a simpler horizontal bar chart view and iterate toward the full interactive timeline.

4. **PWA offline strategy.** Use Serwist's `StaleWhileRevalidate` for API data and `CacheFirst` for static assets. Offline mode is read-only in v1 (show cached goals, queue writes for sync).

5. **React 19.2 View Transitions.** Use `<ViewTransition>` for animating between goal views (list, board, tree, calendar, timeline). This is a native React feature in Next.js 16, no library needed.

## Sources

- Next.js 16 upgrade guide: https://nextjs.org/docs/app/guides/upgrading/version-16 (HIGH confidence)
- Next.js PWA guide: https://nextjs.org/docs/app/guides/progressive-web-apps (HIGH confidence)
- Prisma blog on Prisma Next vs Prisma 7: https://www.prisma.io/blog/the-next-evolution-of-prisma-orm (HIGH confidence)
- Puck's DnD comparison (Jan 2026): https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react (HIGH confidence)
- Motion (Framer Motion) docs: https://motion.dev/docs/react (HIGH confidence)
- MCP TypeScript SDK: https://www.npmjs.com/package/@modelcontextprotocol/sdk (HIGH confidence)
- Serwist (next-pwa successor): https://www.npmjs.com/package/@serwist/next (HIGH confidence)
- Recharts: https://recharts.org/ and https://www.npmjs.com/package/recharts (HIGH confidence)
- cmdk: https://www.npmjs.com/package/cmdk (HIGH confidence)
- @react-pdf/renderer: https://www.npmjs.com/package/@react-pdf/renderer (HIGH confidence)
- docx: https://www.npmjs.com/package/docx (HIGH confidence)
- nuqs: https://nuqs.dev/ (HIGH confidence)
- Zustand: https://www.npmjs.com/package/zustand (HIGH confidence)
- All version numbers verified against npmjs.com on 2026-03-30

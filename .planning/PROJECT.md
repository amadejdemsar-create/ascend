# Ascend

## What This Is

Ascend is a personal operating system built on the inputs/outputs framework: Goals are outputs (results you want to achieve), To-dos are inputs (actions you control daily). Context is structured personal knowledge that any AI service can query via MCP. The daily experience is input-centric: "what are my inputs today?" with outputs providing the why. Includes a comprehensive MCP server so any AI assistant can read/write goals, to-dos, and context. Built for personal use first, architected for multi-tenant SaaS.

## Core Value

Focus on inputs and the outputs will come. Give the user instant clarity on today's actions (inputs) and how they connect to bigger ambitions (outputs), with structured context that makes every AI interaction smarter.

## Current Milestone: v2.0 Inputs & Outputs

**Goal:** Transform Ascend from a goal tracker into a personal operating system with to-dos (inputs), calendar view, context system, and redesigned timeline.

**Target features:**
- To-dos as inputs linked to goals (outputs), with recurring to-dos as habits (streaks, consistency)
- Calendar view as the primary daily experience (month grid, day to-dos, top 3 priorities)
- Context system (structured personal knowledge queryable by AI via MCP)
- Timeline redesign (gantt with tree hierarchy, fix width issues)
- View simplification (list, tree, timeline, calendar only)

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Goal hierarchy with four horizons (yearly, quarterly, monthly, weekly) where each goal links to a parent
- [ ] SMART goal enforcement for yearly and quarterly goals (Specific, Measurable, Attainable, Relevant, Timely fields)
- [ ] Simple goal format for monthly/weekly (title, status, priority, deadline, notes)
- [ ] Categories with unlimited nesting depth (top-level like Business, Personal, Finance with subcategories)
- [ ] Category CRUD (create, edit, delete, recolor) via web UI and MCP
- [ ] Dashboard as default landing page with: this week's focus, progress overview per category, streaks and stats, upcoming deadlines
- [ ] Timeline visualization: horizontal year line with quarters, expandable to months/weeks, goals as nodes, inline expand on click
- [ ] Progress tracking with quick increment (+1 button) and optional log entry with notes
- [ ] Gamification: progress bars, streak tracking, weekly score, XP/levels system, completion animations
- [ ] Recurring goals with frequency (daily/weekly/monthly) and streak tracking
- [ ] Multiple goal views: list (sortable/filterable), board/kanban, tree (hierarchical), calendar, timeline
- [ ] Goal creation: modal dialog for SMART goals, inline add for simple tasks
- [ ] Drag and drop: reorder goals within lists, move between horizons and categories
- [ ] Filtering by category, horizon, status, priority across all views
- [ ] Completed goals auto-archive to separate Archive view
- [ ] Cmd+K command palette: search goals, commands/quick actions, category navigation
- [ ] Keyboard shortcuts for power-user navigation
- [ ] Full MCP server (Streamable HTTP transport) mirroring every web UI capability
- [ ] MCP authentication: API keys for v1, OAuth planned for v2
- [ ] Multi-user database schema from day one (user_id on all tables) even though v1 is single-user
- [ ] Data migration from existing todos.json (NativeAI, Nevron, Personal, Finance, Things to Buy tasks)
- [ ] Data export: JSON, CSV, Markdown, PDF report, DOCX
- [ ] Automated DB backups (cron pg_dump) + manual export button in UI
- [ ] PWA support (installable from browser, works offline for read, syncs when online)
- [ ] Mobile responsive with bottom tab bar + hamburger for secondary nav
- [ ] Desktop: collapsible sidebar navigation
- [ ] Dark/light theme following system preference
- [ ] Onboarding: user chooses between guided wizard, AI-guided setup (via MCP), or skip (fill manually)
- [ ] Rich animations: micro-interactions, animated counters, progress bar animations, completion celebrations (confetti), parallax timeline scrolling

### Out of Scope

- Push notifications and email digests — v2 feature, plan schema but don't build
- Built-in AI chat (paid feature) — v2, AI interaction is via MCP for v1
- Native mobile/desktop apps — v2, PWA covers v1
- Google Calendar sync — achievable through MCP + /calendar skill
- Todoist import — achievable through MCP
- Webhooks on events — v2
- OAuth for MCP — v2, API keys for v1
- Payment/subscription system — v2

## Context

**Replaces:** Local JSON file (`todos.json`) + static HTML dashboard managed via Claude Code `/todo` command. Current system has ~50 tasks across NativeAI, Nevron, Personal, Finance, Things to Buy categories with nested projects. No goal hierarchy, no progress tracking, no timeline, no multi-device access.

**User profile:** Single power user (developer) who manages two businesses (NativeAI agency, Nevron hotel tech) plus personal goals. Interacts with goals through multiple AI tools throughout the day. Needs mobile access for quick progress updates and desktop for planning sessions.

**Design DNA:** Inherits from NativeAI brand guide. Indigo (#4F46E5) / violet (#8B5CF6) palette. Inter for body/UI, Playfair Display for headlines. Dark-first with light mode. Glassmorphism, subtle grid backgrounds, ambient orbs. "A NativeAI product" subtle branding in footer only. Ascend has its own identity but shares the design language.

**Aesthetic goal:** Productivity meets beauty. Clean and minimal like Linear/Notion but with the premium feel of Vercel/Stripe. Rich micro-interactions and animations that make tracking progress feel satisfying, not tedious. Must look and feel distinctly different from existing goal apps.

**Future path:** Built as a personal tool first, then evolved into a SaaS product. Multi-user schema from day one. Future additions: built-in AI assistant (paid), native apps (Capacitor/Expo), push notifications, OAuth, webhooks, team features.

## Constraints

- **Tech stack**: Next.js 15 (App Router), PostgreSQL, Prisma ORM, shadcn/ui + Tailwind CSS + Lucide icons
- **Hosting**: Dokploy on Hostinger VPS (dokploy-personal account), Postgres container on same VPS
- **Domain**: ascend.nativeai.agency
- **Auth (v1)**: Simple API key bearer token for MCP, no user auth needed (single user)
- **MCP**: Streamable HTTP transport, must support every action the web UI supports
- **Typography**: Inter (body/UI), Playfair Display (headlines), JetBrains Mono (code/data)
- **Colors**: NativeAI palette (indigo #4F46E5, violet #8B5CF6, dark bg #0F0F14, surfaces #16161D/#1C1C26/#22222E)
- **Mobile**: PWA-first, bottom tab bar + hamburger navigation
- **Desktop**: Collapsible sidebar, keyboard-driven with Cmd+K
- **Architecture**: Multi-user schema even for single-user v1 (user_id on all tables)
- **GitHub**: Repository under amadejdemsar-create organization
- **Local path**: /Users/Shared/Domain/Code/Personal/ascend/

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js App Router | Consistent with existing NativeAI website stack, SSR for performance, API routes for MCP | — Pending |
| Prisma ORM | Best TypeScript integration, mature migrations, wide community support | — Pending |
| Multi-user schema from day one | Avoids painful migration when converting to SaaS. user_id FK on all tables costs nothing now | — Pending |
| PWA before native apps | Ship to all devices immediately. Native apps via Capacitor/Expo later | — Pending |
| SMART only for yearly/quarterly | Monthly/weekly goals need to be fast to create. Full SMART on small tasks creates friction | — Pending |
| API keys before OAuth | Single user doesn't need OAuth complexity. Schema supports it for v2 | — Pending |
| NativeAI design DNA | Product cohesion. Ascend is a NativeAI product. Shares palette, fonts, visual language | — Pending |
| Streamable HTTP for MCP | Modern MCP standard, single endpoint, works with all major AI tools | — Pending |
| Unlimited category nesting | Maximum flexibility. UI guides users toward clean structure without enforcing depth limits | — Pending |
| Dashboard as default view | Immediate focus: "what should I work on right now?" Timeline is for planning sessions | — Pending |

---
*Last updated: 2026-03-30 after initialization*

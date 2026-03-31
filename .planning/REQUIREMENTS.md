# Requirements: Ascend

**Defined:** 2026-03-30
**Core Value:** Give the user instant clarity on what to focus on right now by connecting daily actions to yearly ambitions, with measurable progress tracking that makes consistency visible and rewarding.

## v1 Requirements

### Goal Management

- [x] **GOAL-01**: User can create a goal with a title, selecting one of four horizons (yearly, quarterly, monthly, weekly)
- [x] **GOAL-02**: User can link a goal to a parent goal (quarterly to yearly, monthly to quarterly, weekly to monthly)
- [x] **GOAL-03**: User can set SMART fields (Specific, Measurable, Attainable, Relevant, Timely) on yearly and quarterly goals
- [x] **GOAL-04**: User can set simple fields (title, status, priority, deadline, notes) on monthly and weekly goals
- [x] **GOAL-05**: User can edit any field on an existing goal
- [x] **GOAL-06**: User can delete a goal (with confirmation if it has children)
- [x] **GOAL-07**: User can set a goal's status (not started, in progress, completed, abandoned)
- [x] **GOAL-08**: User can set a goal's priority (high, medium, low)
- [x] **GOAL-09**: User can set a measurable target on a goal (target value, current value, unit)
- [x] **GOAL-10**: User can create a recurring goal with frequency (daily, weekly, monthly) that auto-generates instances
- [x] **GOAL-11**: User can view a goal's children (sub-goals at the next horizon level)
- [x] **GOAL-12**: Completing all children of a goal suggests completing the parent (progress rollup)
- [x] **GOAL-13**: User can create a goal via inline add (quick, minimal fields) for simple tasks
- [x] **GOAL-14**: User can create a goal via modal dialog (full fields) for SMART goals

### Progress Tracking

- [x] **PROG-01**: User can increment progress on a measurable goal with a quick +1 button (or custom amount)
- [x] **PROG-02**: User can add a progress entry with an optional note (e.g., "+1 client: Signed Hotel Marko")
- [x] **PROG-03**: User can view progress history (all entries with timestamps and notes) for any goal
- [x] **PROG-04**: Progress percentage is calculated automatically from current value vs target value
- [x] **PROG-05**: Parent goal progress aggregates from children's completion status

### Categories

- [x] **CAT-01**: User can create a category with name, color, and icon (Lucide icon)
- [x] **CAT-02**: User can nest categories to unlimited depth (e.g., Business > NativeAI > Content)
- [x] **CAT-03**: User can edit a category's name, color, and icon
- [x] **CAT-04**: User can delete a category (with option to reassign or delete contained goals)
- [x] **CAT-05**: User can reorder categories via drag and drop
- [x] **CAT-06**: App ships with suggested default categories (Business, Personal, Health, Finance, Learning) that user can modify or delete

### Dashboard

- [x] **DASH-01**: Dashboard is the default landing page when opening the app
- [x] **DASH-02**: Dashboard shows "This Week's Focus" widget with top priority weekly goals
- [x] **DASH-03**: Dashboard shows "Progress Overview" widget with completion % per category as visual bars
- [x] **DASH-04**: Dashboard shows "Streaks & Stats" widget with active streaks, goals completed this month, completion rate, current XP/level
- [x] **DASH-05**: Dashboard shows "Upcoming Deadlines" widget with goals due in the next 7 and 14 days
- [x] **DASH-06**: Dashboard widgets update in real time when goals are modified

### Views

- [x] **VIEW-01**: User can switch between List, Board, Tree, and Timeline views
- [x] **VIEW-02**: List view shows goals in a flat sortable table with columns (title, status, progress, priority, deadline, category, horizon)
- [x] **VIEW-03**: Board/Kanban view shows goals as cards grouped by status or horizon (user-selectable grouping)
- [x] **VIEW-04**: Tree view shows the full goal hierarchy (yearly > quarterly > monthly > weekly) as an expandable/collapsible tree
- [x] **VIEW-05**: Timeline view shows a horizontal year line with quarter markers, expandable to months and weeks
- [x] **VIEW-06**: Timeline goals appear as interactive nodes on the line at their horizon level
- [x] **VIEW-07**: Clicking a goal node on the timeline expands details inline (children, progress, notes)
- [x] **VIEW-08**: All views support filtering by category, horizon, status, and priority
- [x] **VIEW-09**: All views support sorting by priority, deadline, creation date, and title
- [x] **VIEW-10**: User's last selected view and filters persist across sessions

### Drag and Drop

- [x] **DND-01**: User can reorder goals within a list by dragging
- [x] **DND-02**: User can move a goal between horizons by dragging (e.g., promote weekly to monthly)
- [x] **DND-03**: User can move a goal between categories by dragging
- [x] **DND-04**: Drag and drop works across List, Board, and Tree views
- [x] **DND-05**: Visual feedback during drag (ghost element, drop targets highlighted)

### Gamification

- [x] **GAME-01**: Each goal completion awards XP based on horizon level (yearly > quarterly > monthly > weekly) and priority
- [x] **GAME-02**: User has a level that increases as XP accumulates, with a level-up celebration animation
- [x] **GAME-03**: Recurring goals track streaks (consecutive completions without missing)
- [x] **GAME-04**: Weekly score aggregates completed goals, streaks maintained, and progress made
- [x] **GAME-05**: Satisfying completion animation plays when a goal is marked complete (confetti for milestones, checkmark for tasks)
- [x] **GAME-06**: Progress bars animate smoothly when progress is added
- [x] **GAME-07**: Dashboard displays current level, XP progress to next level, active streaks, and weekly score

### Command Palette and Keyboard

- [x] **CMD-01**: Cmd+K opens a command palette overlay
- [x] **CMD-02**: Command palette searches across all goals by title and description
- [x] **CMD-03**: Command palette offers quick actions (new goal, switch view, toggle theme, navigate to category)
- [x] **CMD-04**: Command palette navigates to specific categories and subcategories
- [x] **CMD-05**: Keyboard shortcuts for: navigation between views, create new goal, mark goal complete, open/close sidebar, toggle theme
- [x] **CMD-06**: Keyboard shortcut reference accessible via `?` key

### MCP Server

- [x] **MCP-01**: MCP server runs on Streamable HTTP transport at a dedicated endpoint
- [x] **MCP-02**: MCP authenticates via API key (Bearer token in Authorization header)
- [x] **MCP-03**: MCP tool: create_goal (with all fields including parent, SMART, recurring)
- [x] **MCP-04**: MCP tool: get_goal (by ID, returns full details including children and progress)
- [x] **MCP-05**: MCP tool: update_goal (partial update of any field)
- [x] **MCP-06**: MCP tool: delete_goal (with cascade option for children)
- [x] **MCP-07**: MCP tool: list_goals (filter by horizon, category, status, priority, parent; pagination)
- [x] **MCP-08**: MCP tool: search_goals (full-text search across titles, descriptions, notes)
- [x] **MCP-09**: MCP tool: add_progress (increment value with optional note)
- [x] **MCP-10**: MCP tool: get_progress_history (for a specific goal)
- [x] **MCP-11**: MCP tool: create_category / update_category / delete_category / list_categories
- [x] **MCP-12**: MCP tool: get_dashboard (returns this week's focus, progress overview, streaks, deadlines)
- [x] **MCP-13**: MCP tool: get_current_priorities (weekly goals sorted by priority and deadline)
- [x] **MCP-14**: MCP tool: complete_goals (bulk complete multiple goals by ID)
- [x] **MCP-15**: MCP tool: move_goal (change horizon or parent)
- [x] **MCP-16**: MCP tool: get_timeline (structured year/quarter/month/week view with goals)
- [x] **MCP-17**: MCP tool: get_stats (XP, level, streaks, weekly score, completion rates)
- [x] **MCP-18**: MCP tool: export_data (JSON, CSV, Markdown format)
- [x] **MCP-19**: MCP tool: import_data (JSON format, including migration from old todos.json)
- [x] **MCP-20**: MCP tool: get_settings / update_settings (theme, default view, preferences)

### Layout and Navigation

- [x] **NAV-01**: Desktop layout has a collapsible sidebar (full sidebar or icons-only)
- [x] **NAV-02**: Sidebar shows: navigation (Dashboard, views), categories tree, settings link
- [x] **NAV-03**: Mobile layout has a bottom tab bar with main views (Dashboard, Goals, Timeline, Settings)
- [x] **NAV-04**: Mobile has a hamburger menu for secondary navigation (categories, archive, export)
- [x] **NAV-05**: Responsive breakpoints: mobile (<768px), tablet (768-1024px), desktop (>1024px)

### Theme and Design

- [x] **THEME-01**: Dark and light themes available, following system preference by default
- [x] **THEME-02**: User can manually override theme preference (persisted)
- [x] **THEME-03**: Design uses NativeAI color palette (indigo #4F46E5, violet #8B5CF6, dark bg #0F0F14)
- [x] **THEME-04**: Typography: Inter for body/UI, Playfair Display for headlines, JetBrains Mono for data
- [ ] **THEME-05**: Rich animations throughout: page transitions, hover effects, animated counters, parallax timeline, view transitions (React 19 View Transitions API)

### Data Management

- [x] **DATA-01**: Import existing todos.json into the goal hierarchy (map categories, projects, tasks to appropriate levels)
- [x] **DATA-02**: Export goals as JSON (full structured backup)
- [x] **DATA-03**: Export goals as CSV (spreadsheet-friendly flat export)
- [x] **DATA-04**: Export goals as Markdown (human-readable summary)
- [x] **DATA-05**: Export goals as PDF report (formatted progress report with visual charts)
- [x] **DATA-06**: Export goals as DOCX (formatted document)
- [ ] **DATA-07**: Automated database backups via cron pg_dump
- [x] **DATA-08**: Manual export button accessible from settings

### Onboarding

- [ ] **ONBD-01**: First-time user sees a choice: guided wizard, AI-guided setup (via MCP), or skip
- [ ] **ONBD-02**: Guided wizard walks through: create categories, set a yearly goal, break it into quarterly
- [ ] **ONBD-03**: AI-guided setup works via MCP (external AI asks questions, creates structure through MCP tools)
- [ ] **ONBD-04**: Skip option drops user into empty dashboard with contextual hints

### PWA

- [ ] **PWA-01**: App is installable from browser (manifest.json, service worker, icons)
- [ ] **PWA-02**: Installed PWA opens in standalone mode (no browser chrome)
- [ ] **PWA-03**: Offline read: cached dashboard and recently viewed goals available without network
- [ ] **PWA-04**: Offline writes queue and sync when connectivity returns

### Infrastructure

- [x] **INFRA-01**: Multi-user database schema with user_id on all tables (even though v1 is single-user)
- [x] **INFRA-02**: PostgreSQL database running as Dokploy container on Hostinger VPS
- [x] **INFRA-03**: Next.js 16 app deployed via Dokploy with auto-deploy from GitHub
- [x] **INFRA-04**: Domain: ascend.nativeai.agency with SSL
- [x] **INFRA-05**: API key authentication for MCP endpoints

## v2 Requirements

### Notifications
- **NOTF-01**: User receives push notifications for approaching deadlines
- **NOTF-02**: User receives weekly email digest with progress summary
- **NOTF-03**: User can configure notification preferences

### Multi-user
- **MULTI-01**: User can create an account with email/password
- **MULTI-02**: OAuth authentication (Google, GitHub)
- **MULTI-03**: Each user has isolated data

### Advanced Integrations
- **INTG-01**: Google Calendar sync (weekly goals auto-create as calendar events)
- **INTG-02**: Todoist import (one-time migration)
- **INTG-03**: Webhook on goal events (completion, progress, creation)
- **INTG-04**: OAuth for MCP authentication

### Native Apps
- **NATIVE-01**: iOS app via Capacitor/Expo
- **NATIVE-02**: Android app via Capacitor/Expo
- **NATIVE-03**: macOS/Windows desktop app

### AI Features (Paid)
- **AI-01**: Built-in AI chat for goal-setting assistance
- **AI-02**: AI-suggested goal breakdowns (yearly to quarterly to monthly)
- **AI-03**: Smart scheduling suggestions based on patterns

### Calendar View
- **CAL-01**: Goals/tasks plotted on a calendar by deadline
- **CAL-02**: Calendar syncs with external calendars

## Out of Scope

| Feature | Reason |
|---------|--------|
| Social features / leaderboards | Personal goal tracking is private. Social pressure creates anxiety. Gamification is self-referential. |
| Team collaboration / shared goals | Massive complexity (permissions, roles, conflicts). Multi-user schema ready but UI is single-user v1. |
| Complex project management (Gantt, dependencies) | Ascend is a goal tracker, not a PM tool. Goal hierarchy is simple parent-child. |
| Calendar sync in v1 | Calendar is a different domain. Achievable through MCP + /calendar skill. |
| Offline-first architecture | Full offline with conflict resolution is extreme complexity. Offline-read + queued writes is sufficient. |
| Note-taking / knowledge management | Notion/Obsidian are better. Goal notes field is sufficient. |
| Built-in AI chat in v1 | Expensive, competing with tools users already have. MCP server is the AI integration layer. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GOAL-01 | Phase 2 | Complete |
| GOAL-02 | Phase 2 | Complete |
| GOAL-03 | Phase 2 | Complete |
| GOAL-04 | Phase 2 | Complete |
| GOAL-05 | Phase 2 | Complete |
| GOAL-06 | Phase 2 | Complete |
| GOAL-07 | Phase 2 | Complete |
| GOAL-08 | Phase 2 | Complete |
| GOAL-09 | Phase 2 | Complete |
| GOAL-10 | Phase 9 | Complete |
| GOAL-11 | Phase 2 | Complete |
| GOAL-12 | Phase 2 | Complete |
| GOAL-13 | Phase 2 | Complete |
| GOAL-14 | Phase 2 | Complete |
| PROG-01 | Phase 4 | Complete |
| PROG-02 | Phase 4 | Complete |
| PROG-03 | Phase 4 | Complete |
| PROG-04 | Phase 4 | Complete |
| PROG-05 | Phase 4 | Complete |
| CAT-01 | Phase 3 | Complete |
| CAT-02 | Phase 3 | Complete |
| CAT-03 | Phase 3 | Complete |
| CAT-04 | Phase 3 | Complete |
| CAT-05 | Phase 3 | Complete |
| CAT-06 | Phase 3 | Complete |
| DASH-01 | Phase 4 | Complete |
| DASH-02 | Phase 4 | Complete |
| DASH-03 | Phase 4 | Complete |
| DASH-04 | Phase 4 | Complete |
| DASH-05 | Phase 4 | Complete |
| DASH-06 | Phase 4 | Complete |
| VIEW-01 | Phase 3 | Complete |
| VIEW-02 | Phase 3 | Complete |
| VIEW-03 | Phase 6 | Complete |
| VIEW-04 | Phase 6 | Complete |
| VIEW-05 | Phase 7 | Complete |
| VIEW-06 | Phase 7 | Complete |
| VIEW-07 | Phase 7 | Complete |
| VIEW-08 | Phase 3 | Complete |
| VIEW-09 | Phase 3 | Complete |
| VIEW-10 | Phase 3 | Complete |
| DND-01 | Phase 8 | Complete |
| DND-02 | Phase 8 | Complete |
| DND-03 | Phase 8 | Complete |
| DND-04 | Phase 8 | Complete |
| DND-05 | Phase 8 | Complete |
| GAME-01 | Phase 9 | Complete |
| GAME-02 | Phase 9 | Complete |
| GAME-03 | Phase 9 | Complete |
| GAME-04 | Phase 9 | Complete |
| GAME-05 | Phase 9 | Complete |
| GAME-06 | Phase 9 | Complete |
| GAME-07 | Phase 9 | Complete |
| CMD-01 | Phase 10 | Complete |
| CMD-02 | Phase 10 | Complete |
| CMD-03 | Phase 10 | Complete |
| CMD-04 | Phase 10 | Complete |
| CMD-05 | Phase 10 | Complete |
| CMD-06 | Phase 10 | Complete |
| MCP-01 | Phase 5 | Complete |
| MCP-02 | Phase 5 | Complete |
| MCP-03 | Phase 5 | Complete |
| MCP-04 | Phase 5 | Complete |
| MCP-05 | Phase 5 | Complete |
| MCP-06 | Phase 5 | Complete |
| MCP-07 | Phase 5 | Complete |
| MCP-08 | Phase 5 | Complete |
| MCP-09 | Phase 5 | Complete |
| MCP-10 | Phase 5 | Complete |
| MCP-11 | Phase 5 | Complete |
| MCP-12 | Phase 5 | Complete |
| MCP-13 | Phase 5 | Complete |
| MCP-14 | Phase 5 | Complete |
| MCP-15 | Phase 5 | Complete |
| MCP-16 | Phase 5 | Complete |
| MCP-17 | Phase 5 | Complete |
| MCP-18 | Phase 5 | Complete |
| MCP-19 | Phase 5 | Complete |
| MCP-20 | Phase 5 | Complete |
| NAV-01 | Phase 2 | Complete |
| NAV-02 | Phase 2 | Complete |
| NAV-03 | Phase 2 | Complete |
| NAV-04 | Phase 2 | Complete |
| NAV-05 | Phase 2 | Complete |
| THEME-01 | Phase 2 | Complete |
| THEME-02 | Phase 2 | Complete |
| THEME-03 | Phase 2 | Complete |
| THEME-04 | Phase 2 | Complete |
| THEME-05 | Phase 11 | Pending |
| DATA-01 | Phase 10 | Complete |
| DATA-02 | Phase 10 | Complete |
| DATA-03 | Phase 10 | Complete |
| DATA-04 | Phase 10 | Complete |
| DATA-05 | Phase 10 | Complete |
| DATA-06 | Phase 10 | Complete |
| DATA-07 | Phase 10 | Pending |
| DATA-08 | Phase 10 | Complete |
| ONBD-01 | Phase 11 | Pending |
| ONBD-02 | Phase 11 | Pending |
| ONBD-03 | Phase 11 | Pending |
| ONBD-04 | Phase 11 | Pending |
| PWA-01 | Phase 11 | Pending |
| PWA-02 | Phase 11 | Pending |
| PWA-03 | Phase 11 | Pending |
| PWA-04 | Phase 11 | Pending |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete (01-01) |
| INFRA-03 | Phase 1 | Complete (01-01) |
| INFRA-04 | Phase 1 | Complete (01-01) |
| INFRA-05 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 110 total (corrected from initial count of 93)
- Mapped to phases: 110
- Unmapped: 0

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after roadmap creation*

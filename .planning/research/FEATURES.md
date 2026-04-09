# Feature Landscape: v2.0 Inputs & Outputs

**Domain:** To-do systems, calendar/daily planning, structured context/knowledge for AI
**Researched:** 2026-04-08
**Overall confidence:** HIGH (competitor analysis of 15+ products, MCP specification review, existing codebase audit)

**Scope:** This document covers ONLY the new v2.0 capabilities. For existing feature research (goals, hierarchy, gamification, views), see git history of this file.

## Existing System (Already Built)

For dependency analysis, here is what the codebase already has:

| Capability | Status | Schema |
|------------|--------|--------|
| Goal CRUD with 4-horizon hierarchy | Built | `Goal` model with self-referencing `parentId` |
| Categories with unlimited nesting | Built | `Category` model with self-referencing `parentId` |
| SMART goal fields (yearly/quarterly) | Built | `specific`, `measurable`, `attainable`, `relevant`, `timely` on Goal |
| Progress tracking with logs | Built | `ProgressLog` model, `progress`/`targetValue`/`currentValue` on Goal |
| Recurring goals with streaks | Built | `isRecurring`, `recurringFrequency`, `currentStreak`, `longestStreak` on Goal |
| Gamification (XP, levels, streaks) | Built | `UserStats` model, `XpEvent` model |
| Dashboard with weekly focus | Built | API route + component |
| List, tree, timeline views | Built | App routes under `(app)/goals/` |
| Drag and drop | Built | Reordering within views |
| Command palette (Cmd+K) | Built | `command-palette` component |
| Keyboard shortcuts | Built | Throughout app |
| MCP server (22 tools) | Built | Streamable HTTP at `/api/mcp/` |
| PWA support | Built | Manifest + offline read |
| Data export/import | Built | JSON, CSV, Markdown, PDF, DOCX |

---

## NEW CAPABILITY 1: To-Dos (Inputs)

The core thesis: Goals are outputs (results). To-dos are inputs (daily controllable actions). The user's daily question shifts from "how are my goals progressing?" to "what are my inputs today?"

### Table Stakes

Features every to-do system has. Missing any of these makes the system feel broken.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| To-do CRUD | Fundamental. Every task app has create, read, update, delete. | Low | New `Todo` model in schema | Separate model from Goal, not a Goal subtype. To-dos are lightweight, fast to create. |
| Title + optional description | Todoist, Things 3, TickTick all have this minimal structure. | Low | `Todo` model | Title is required, description is optional rich text. |
| Due date | Universal across all task apps. | Low | `Todo.dueDate` field | Single date, not a date range. To-dos happen on a specific day. |
| Priority (high/medium/low) | Users distinguish urgency. Todoist P1-P4, TickTick Eisenhower. | Low | Reuse existing `Priority` enum | 3 levels matches existing Goal priority system. |
| Completion toggle | One-click/tap to mark done. This is THE primary interaction. | Low | `Todo.completedAt` timestamp | Toggle, not a status workflow. To-dos are binary: done or not done. |
| Category assignment | Users organize by life area. Existing category system applies directly. | Low | FK to existing `Category` model | Reuse the category tree already built for goals. |
| Inline quick-add | Fast capture without leaving current view. Todoist's quick add is the gold standard. | Med | UI component, keyboard shortcut | Press a key, type title, press Enter. No modal for simple to-dos. |
| Sorting and filtering | By due date, priority, category, completion status. | Med | Query layer on `Todo` model | Reuse existing filter patterns from goals. |
| Bulk actions | Complete multiple, reschedule multiple, delete multiple. | Med | Multi-select UI pattern | Select mode with checkboxes, action bar appears at bottom. |
| Overdue handling | Tasks past due date must surface prominently, not silently disappear. | Low | Query for `dueDate < today AND completedAt IS NULL` | Red highlight or "overdue" badge. Auto-rollover option. |

### Differentiators

Features that make Ascend's to-do system uniquely valuable within the inputs/outputs framework.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Link to-do to parent goal** | THE differentiator. Every to-do (input) connects to a goal (output). Users see WHY they're doing each task. No personal to-do app connects daily actions to long-term ambitions this cleanly. | Med | FK `Todo.goalId` referencing `Goal` model | Optional link. Some to-dos are standalone (groceries). But the power is in linked inputs. |
| **Top 3 daily priorities** | The "Daily Big 3" method is proven and well-researched. Each day, the user picks their 3 most important inputs. Calendar view highlights these. Sunsama does daily planning but without explicit top-3 enforcement. | Med | `Todo.isDailyPriority` boolean + max 3 constraint per day | Enforce max 3 per day. User picks from their to-do list during morning planning. If they already have 3, they must demote one to promote another. |
| **Recurring to-dos as habits** | Existing recurring goals handle this partially, but to-dos need their own recurrence. "Meditate daily" is a recurring input, not a recurring goal. Streak tracking on recurring to-dos provides the habit tracking that TickTick and Streaks offer. | Med | `Todo.isRecurring`, `recurringFrequency`, streak fields (mirror Goal's pattern) | Reuse the recurrence logic from goals. Habits are just recurring to-dos with streak tracking. No separate "habits" entity needed. |
| **Consistency score (beyond streaks)** | Streaks are all-or-nothing and discouraging when broken. A consistency score (completion rate over 30 days) is more forgiving and motivating. Loop and Habitify both use this pattern. | Med | Computed field: completions / expected completions over rolling window | Display as percentage. "85% consistent this month" is more motivating than "streak: 0 (broke yesterday)." |
| **To-do completion contributes to goal progress** | When linked to-dos complete, the parent goal's progress auto-increments. This is the inputs-drive-outputs loop made tangible. ClickUp does this for team OKRs but no personal tool does it. | Med | Trigger on `Todo` completion that updates `Goal.currentValue` | Only for linked to-dos. The increment amount should be configurable (completing 1 to-do = 1 unit of progress, or percentage-based). |
| **Unlinked to-do suggestions** | After creating a standalone to-do, suggest linking it to an existing goal. "This looks related to your 'Improve Fitness' goal. Link it?" | Low | Keyword matching against goal titles | Nice-to-have. Can be simple string matching initially, AI-powered later via MCP. |
| **Morning planning prompt** | When opening the app, if the user has not picked their Daily Big 3, prompt them. Sunsama's daily planning ritual is its most loved feature. | Med | Check `dailyPriority` count for today, show prompt if < 3 | Non-blocking prompt. "Pick your top 3 for today" with drag-to-select from to-do list. |

### Anti-Features (To-Dos)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Subtasks on to-dos** | To-dos are inputs, meant to be atomic. If a to-do needs subtasks, it should be a goal with child to-dos. Adding subtask nesting to to-dos creates a second hierarchy system that competes with the goal hierarchy. | Keep to-dos flat. If it is complex enough to need subtasks, model it as a weekly/monthly goal with linked to-dos. |
| **Time estimates on to-dos** | Time estimation is notoriously inaccurate and adds friction. Sunsama's time estimates are ignored by most users. The daily planning ritual and top-3 constraint naturally limit overcommitment without requiring time math. | Top 3 priorities handle capacity planning implicitly. If you can only have 3 priorities, you will not overcommit. |
| **Eisenhower matrix view** | TickTick has this but it is rarely used. The inputs/outputs framework already provides the "important" axis (linked to high-priority goal) and the top-3 provides urgency. Adding a 2x2 matrix is redundant. | Priority field + goal linkage + Daily Big 3 covers the same ground more naturally. |
| **Natural language date parsing** | Todoist's "every Monday at 9am" parsing is beloved but complex to build. For a single power user, explicit date pickers are fine. | Standard date picker. Natural language parsing is a v3 nice-to-have. Can be done via MCP tool ("create a to-do for tomorrow"). |
| **Reminders / notifications (v2)** | Already scoped as out of scope for v2. To-dos do not change this. | The calendar view is the reminder. Opening the app shows today's inputs. Push notifications are v3. |

---

## NEW CAPABILITY 2: Calendar View

The calendar is the primary daily experience. The user opens Ascend and sees: what are my inputs today?

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Month grid | Standard calendar layout. Every calendar and planner app has this. Google Calendar, Apple Calendar, TickTick. | Med | New page/view component | Grid of days, current day highlighted, dots/counts for days with to-dos. |
| Day view with to-do list | Click a day, see that day's to-dos. This is the primary interaction. | Med | Query to-dos by `dueDate` | Todoist's "Today" view is the benchmark. List of to-dos for the selected day. |
| Today quick access | One-click to jump to today from anywhere in the calendar. | Low | Button/shortcut | "Today" button always visible in calendar header. Keyboard shortcut (T). |
| Navigate months (prev/next) | Arrow buttons to move between months. | Low | State management | Standard calendar navigation. |
| Visual indicators for task density | Dots, counts, or heat map showing which days have tasks. | Low | Count query per day | Google Calendar uses dots, Sunsama uses task counts, TickTick uses colored dots by priority. |
| Overdue tasks surfaced | Past days with incomplete to-dos must be visually distinct. | Low | Query + styling | Red indicator on past days with incomplete to-dos. |
| Week numbers | European users expect ISO week numbers on the calendar. | Low | Calculation utility | Display week numbers in left margin of month grid. Week starts Monday per user locale. |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Daily Big 3 prominently displayed** | The top 3 priorities for the selected day appear above the regular to-do list, visually distinct. This is the "what matters today" answer at a glance. No calendar app does this. | Med | `isDailyPriority` query for selected date | Large cards or highlighted items at the top of the day view. Visually separated from the full to-do list below. |
| **Goal context on to-dos** | Each to-do in the day view shows its linked goal (output) as a subtle label. "Write blog post" shows "Content Marketing Q2" as parent context. Users always see the WHY. | Low | Join `Todo` with `Goal` on render | Small chip/badge showing parent goal name and category color. |
| **Week view (7-day strip)** | In addition to month grid, a horizontal 7-day view showing each day's to-dos side by side. Sunsama's weekly view is its strongest feature. | High | New layout component | Optional view toggle: month grid vs. week strip. Week strip is better for planning, month grid for overview. |
| **Drag to-dos between days** | Drag a to-do from one day to another to reschedule. Sunsama and TickTick both support this. | Med | DnD library integration with date update | Reuse existing drag-and-drop patterns from goal reordering. |
| **Goal deadlines on calendar** | Show goal deadlines as distinct markers on the calendar (different from to-dos). Users see both their inputs for the day AND approaching output deadlines. | Low | Query goals with `deadline` in visible date range | Different visual treatment from to-dos: outline badge vs. filled badge, or a separate row. |
| **Completion stats per day** | After a day passes, show "5/8 completed" with a small completion bar. Creates a satisfying visual history. | Low | Computed from to-do completion data | Green fill for high completion, amber for partial, red for poor days. |
| **Morning planning mode** | When opening today's view with no Daily Big 3 selected, the calendar enters "planning mode" with a guided prompt to pick priorities. Sunsama's morning ritual adapted for Ascend. | Med | Conditional UI based on `dailyPriority` state | Overlay or inline prompt. Shows all to-dos due today, lets user drag to "priority" slots. Dismissible. |
| **Habit streaks on calendar** | For recurring to-dos (habits), show streak indicators directly on the calendar. Completed days get a check, missed days get an X, building a visual chain. Streaks app does this beautifully. | Med | Render recurring to-do completion history per day | Jerry Seinfeld's "don't break the chain" visualization. Powerful motivator. |

### Anti-Features (Calendar)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Time-slot based scheduling** | Ascend is not Google Calendar. Time-blocking (8:00-9:00 Write, 9:00-10:00 Exercise) adds complexity and competes with the user's actual calendar. Sunsama and Motion own this space. | To-dos have dates, not times. The Daily Big 3 handles prioritization without requiring time slots. |
| **External calendar sync (v2)** | Google Calendar / Outlook sync is achievable through MCP + the user's /calendar skill. Building native sync adds OAuth complexity, polling infrastructure, and conflict resolution. | MCP tools can read/write to-dos. An AI assistant can bridge Ascend to-dos and Google Calendar events. |
| **Agenda/schedule view** | A minute-by-minute schedule view duplicates the user's real calendar. The day view is a to-do list, not a schedule. | Day view shows to-dos as a prioritized list, not a time-bound schedule. |
| **Multi-day to-dos (spanning)** | To-dos that span multiple days are goals, not to-dos. Inputs are daily actions. If something takes 3 days, it should be a goal with 3 daily to-dos. | Keep to-dos as single-day items. Goals handle multi-day/multi-week scope. |
| **Recurring calendar events** | Events (meetings, appointments) belong in a calendar app. Ascend's calendar shows inputs (to-dos) and output deadlines (goals), not events. | No event creation. Only to-dos and goal deadlines appear on the calendar. |

---

## NEW CAPABILITY 3: Context System

Structured personal knowledge that any AI service can query via MCP. This transforms Ascend from a productivity app into a personal operating system.

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Context entry CRUD | Create, read, update, delete context items. Basic data management. | Low | New `Context` model in schema | Each entry has a key (identifier), value (content), and category. |
| Categories / namespaces | Organize context by domain: "personal", "work/nevron", "work/nativeai", "finance", "health". | Low | `Context.category` field, or namespace in key like `personal.preferences` | Flat categories are sufficient. No need for nested category hierarchy here (goals already have that). |
| Key-value structure | Each context entry is a named piece of knowledge. "timezone" = "Europe/Ljubljana", "dietary_restrictions" = "none", "current_employer" = "Nevron". | Low | `Context.key` + `Context.value` (text) | Key is the identifier, value holds the content. Simple and queryable. |
| Tags / labels | Cross-cutting organization. A context entry about "fitness goals" might be tagged both "health" and "personal". | Low | `Context.tags` array field | Multi-select tags for filtering. Simpler than categories for cross-cutting concerns. |
| Search across context | Find context entries by keyword, category, or tag. | Med | Full-text search on key + value + tags | Essential for both UI browsing and MCP tool queries. |
| MCP tools for context | AI assistants must be able to read, write, search, and list context entries. This is the entire point of the context system. | Med | New MCP tools: `get_context`, `set_context`, `search_context`, `list_context`, `delete_context` | Extends the existing 22-tool MCP server. These tools are arguably more important than the web UI. |
| Markdown support in values | Context values should support rich text (Markdown). "About me" entries, project descriptions, and preferences benefit from formatting. | Low | Render Markdown in UI, store as plain text | Store as Markdown string, render in UI. MCP returns raw Markdown for AI consumption. |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **MCP Resources (not just tools)** | Beyond CRUD tools, expose context as MCP Resources. Resources are the MCP primitive for "data the AI should know about" vs. tools which are "actions the AI can take." An AI connecting to Ascend automatically receives the user's context as resources. | Med | MCP Resources implementation in server | Resource URIs like `context://personal/preferences`, `context://work/nevron/role`. The AI client can list and read resources without explicit tool calls. |
| **MCP Prompts for context** | Pre-built prompt templates that incorporate context. Example: "daily_planning" prompt that includes today's to-dos, top 3 priorities, and relevant context about current projects. The AI gets a fully contextualized prompt. | Med | MCP Prompts implementation in server | Prompts are the third MCP primitive. "Plan my day" prompt auto-includes to-dos + goals + context. |
| **Automatic context from goals/to-dos** | The context system can auto-generate context entries from the user's goals and to-dos. "Current quarterly goals" becomes a context entry that stays in sync. AI always knows what the user is working toward. | Med | Derived context computed from Goal/Todo queries | Read-only derived entries. Updated on goal/to-do changes. Marked as "auto-generated" vs. user-created. |
| **Context versioning** | Track changes to context entries over time. "Current role" was "Junior Developer" in January, "Senior Developer" in March. Useful for AI to understand trajectory. | Low | `Context.updatedAt` + optional `ContextHistory` model | Simple: store updatedAt and let history accumulate. Advanced: full version history table. Start simple. |
| **Bulk context import** | Import existing context from a structured file (JSON, YAML, or Markdown with frontmatter). The user already has context scattered across CLAUDE.md files and personal docs. | Med | Parser for JSON/YAML/MD import | One-time migration tool. Parse structured files into context entries. |
| **Context templates** | Pre-built templates for common context categories: "Personal Profile", "Work Context", "Health & Fitness", "Financial Overview". Reduces blank-page syndrome. | Low | Template definitions with placeholder values | Onboarding can suggest templates. User fills in values. |

### Anti-Features (Context)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full knowledge graph** | Knowledge graphs with entity relationships, semantic links, and graph queries are complex to build and maintain. Notion, Obsidian, and Capacities handle this better. Ascend's context is structured data, not a knowledge graph. | Flat key-value entries with categories and tags. If relationships between entries are needed, use tags or reference keys in values. |
| **AI-powered auto-tagging** | Automatic categorization sounds appealing but requires ML infrastructure and produces errors that erode trust. Manual tagging is fine for a personal system with dozens to low hundreds of entries. | User assigns categories and tags manually. Templates pre-fill common tags. |
| **Document storage / file attachments** | Storing files turns Ascend into a document management system. Google Drive, Notion, and Obsidian handle files. Ascend's context is text-based structured knowledge. | Text values only (Markdown supported). Reference external files by URL or path if needed. |
| **Real-time collaboration on context** | Context is personal. There is no collaboration use case for v2. | Single-user context. Multi-user context sharing is a v3+ SaaS feature. |
| **RAG / vector embeddings** | Retrieval-augmented generation requires embedding infrastructure, vector databases, and chunking strategies. Overkill for structured key-value context that is directly queryable. | Direct key-value lookup and full-text search. The MCP tools return exact context entries. AI does not need RAG when it can query structured data directly. |
| **Bi-directional sync with external PKM** | Syncing with Obsidian, Notion, or other knowledge bases creates conflict resolution nightmares and maintenance burden. | One-way import (bring data into Ascend). MCP allows AI to bridge systems without native sync. |

---

## NEW CAPABILITY 4: Timeline Redesign

Not a new feature but a significant redesign of the existing timeline view.

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Gantt-style bars | Goals displayed as horizontal bars spanning their start-to-deadline date range. Standard in any timeline view. | Med | Existing timeline component, needs redesign | Replace the current node-based timeline with proper Gantt bars. |
| Tree hierarchy in left panel | Goals shown in their parent-child hierarchy on the left, with bars extending to the right. Linear's project timeline does this well. | Med | Existing goal hierarchy data | Left panel shows the tree, right panel shows the timeline bars. Split panel layout. |
| Horizontal scrolling | Timeline extends beyond viewport. Scroll to see past and future. | Med | Scroll container with date axis | Smooth horizontal scroll with date headers (months, weeks). |
| Zoom levels | Switch between year, quarter, month views. | Med | Date axis recalculation | At minimum: quarter view (default), month view (detailed), year view (overview). |
| Today marker | Vertical line showing "today" on the timeline. | Low | Positioned element at today's date | Red or accent-colored vertical line. |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **To-dos as dots on goal bars** | When to-dos are linked to goals, show them as small dots/ticks on the goal's timeline bar. Visualizes the inputs (to-dos) contributing to outputs (goals) over time. | Med | Requires to-do data with dates | Completed to-dos as filled dots, upcoming as outline dots. |
| **Progress fill on bars** | Goal bars fill with color from left based on progress percentage. A 50% complete goal shows the left half filled. | Low | Goal progress data (already exists) | Simple CSS width percentage on an inner div. |
| **Collapsible hierarchy** | Expand/collapse goal branches in the tree panel. Large hierarchies need this to stay navigable. | Med | Tree state management | Default: collapsed to top 2 levels. Click to expand branches. |

### Anti-Features (Timeline)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Task dependencies (arrows between bars)** | Dependencies turn a goal tracker into a project management tool. Ascend's hierarchy already shows relationships. | Parent-child hierarchy provides structure. No dependency arrows. |
| **Resource allocation / workload view** | Enterprise PM feature. Single personal user does not need resource leveling. | The Daily Big 3 is the capacity constraint mechanism. |
| **Drag to resize bars (change dates)** | Tempting but complex (collision detection, validation, undo). Date editing is better done in the goal detail panel. | Click a bar to open goal details, edit dates there. |

---

## NEW CAPABILITY 5: View Simplification

Reducing the number of views from the current set to a focused four.

### The Four Views

| View | Purpose | Status | Notes |
|------|---------|--------|-------|
| **List** | Default browsable view. Sortable, filterable, quick scanning. | Already built | Stays as-is. May need to add to-do listing alongside goals. |
| **Tree** | Hierarchical visualization. See the full goal structure with to-dos as leaves. | Already built | Extend to show to-dos linked to goals as child nodes. |
| **Timeline** | Gantt-style temporal view. Planning and progress over time. | Needs redesign | See Timeline Redesign section above. |
| **Calendar** | Daily planning view. Primary daily experience. | New (v2) | See Calendar View section above. |

### What Gets Removed

| Removed View | Why | Migration Path |
|--------------|-----|----------------|
| Board/Kanban | Duplicates list view's filtering. Kanban columns (Not Started / In Progress / Completed) are just status filters on list view. | Filter list by status to get the same effect. |

---

## Feature Dependencies (v2.0)

```
New Todo model → To-do CRUD
  ├── Todo.goalId FK → Link to-dos to goals → Completion drives goal progress
  ├── Todo.dueDate → Calendar day view (query by date)
  ├── Todo.isDailyPriority → Daily Big 3 feature → Morning planning prompt
  ├── Todo.isRecurring → Recurring to-dos (habits) → Streak tracking → Consistency score
  ├── Todo + Category FK → Reuse existing category system
  └── Bulk actions → Multi-select UI

Calendar View (depends on Todo model)
  ├── Month grid → Day view → To-do list per day
  ├── Daily Big 3 display (depends on isDailyPriority)
  ├── Goal deadlines on calendar (depends on existing Goal.deadline)
  ├── Drag between days (depends on DnD, already built)
  ├── Week view (optional, higher complexity)
  └── Habit streak visualization (depends on recurring to-dos)

Context System (independent of Todo/Calendar)
  ├── Context model → Context CRUD (web UI)
  ├── MCP context tools → extends existing MCP server
  ├── MCP Resources → exposes context as passive data
  ├── MCP Prompts → templated prompts with context injection
  ├── Auto-derived context from goals/to-dos
  └── Bulk context import

Timeline Redesign (depends on existing Goal data, enhanced by Todo data)
  ├── Gantt bars with tree panel
  ├── To-do dots on bars (depends on Todo.goalId)
  └── Progress fill (depends on existing Goal.progress)

View Simplification (independent, can happen anytime)
  └── Remove board view, update navigation
```

### Build Order (dependency-driven)

1. **Todo model + CRUD** (everything else depends on this)
2. **Link to-dos to goals** (enables the inputs/outputs loop)
3. **Calendar view (month grid + day view)** (primary daily experience)
4. **Daily Big 3** (requires to-dos + calendar)
5. **Recurring to-dos + streaks** (habit tracking)
6. **Context model + CRUD + MCP tools** (independent track, can parallel with 3-5)
7. **Timeline redesign** (enhanced by to-do data but not blocked by it)
8. **MCP Resources + Prompts** (after context tools work)
9. **Morning planning, consistency score, auto-derived context** (polish features)

## MVP Recommendation (v2.0)

### Must Ship (the milestone is incomplete without these)

1. **To-do model and CRUD** with goal linking, due dates, priorities, completion
2. **Calendar view** with month grid, day view, to-do list per day
3. **Daily Big 3** priorities with morning planning prompt
4. **Recurring to-dos** with streak tracking (habits)
5. **Context model and CRUD** with basic web UI
6. **MCP tools for to-dos and context** (5-6 new tools minimum)
7. **Timeline redesign** with Gantt bars and tree hierarchy
8. **View simplification** to list, tree, timeline, calendar

### Should Ship (high value, moderate effort)

9. **To-do completion drives goal progress** (the inputs/outputs loop made tangible)
10. **Goal deadlines on calendar** (see approaching outputs alongside daily inputs)
11. **MCP Resources** for context (passive data exposure to AI)
12. **Drag to-dos between days** on calendar
13. **Habit streak visualization** on calendar
14. **Consistency score** for recurring to-dos

### Defer to v2.1+

- **MCP Prompts** for templated interactions (valuable but not launch-critical)
- **Week view** on calendar (month grid + day view is sufficient for launch)
- **Auto-derived context** from goals/to-dos (nice automation, not essential)
- **Context versioning** (useful later, not needed at launch)
- **Bulk context import** (user can add entries manually first)
- **Unlinked to-do suggestions** (AI-powered suggestions, polish feature)

## Sources

- Todoist Features and Comparisons (todoist.com, zapier.com/blog) [HIGH confidence, official + verified review]
- Sunsama Daily Planning and Timeboxing (help.sunsama.com) [HIGH confidence, official docs]
- Structured App Daily Planner (structured.app) [MEDIUM confidence, official site]
- TickTick Calendar and Habit Features (ticktick.com) [MEDIUM confidence, official site]
- Things 3 vs Todoist Comparison (medium.com, nerdynav.com, blog.rivva.app) [MEDIUM confidence, detailed user comparisons]
- Daily Big 3 Productivity Method (allthewayleadership.com, smartsolvetips.com, megansumrell.com) [MEDIUM confidence, multiple independent sources agree]
- Habit Tracking Streak Algorithms (mytimecalculator.com, habitify help center) [MEDIUM confidence, app documentation]
- MCP Architecture and Primitives (modelcontextprotocol.io, getknit.dev) [HIGH confidence, official specification]
- Calendar UI Design Patterns (eleken.co/blog-posts/calendar-ui) [MEDIUM confidence, design research]
- Recurring Events Database Design (medium.com/@aureliadotlim, red-gate.com) [MEDIUM confidence, technical deep dives]
- Personal Knowledge Management with AI 2026 (remlabs.ai, glean.com, desktopcommander.app) [MEDIUM confidence, industry analysis]
- Linear UX Patterns (linear.app/docs, eleken.co case study) [HIGH confidence, official docs + verified analysis]
- Goal Hierarchy and Task Breakdown (focusbox.io, spearity.com) [MEDIUM confidence, methodology references]
- Notion Database Properties and AI (developers.notion.com, notion.com/help) [HIGH confidence, official docs]

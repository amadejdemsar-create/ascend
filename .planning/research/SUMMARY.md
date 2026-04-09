# Project Research Summary

**Project:** Ascend v2.0 (To-dos, Calendar, Context System, Timeline Redesign)
**Domain:** Extending a personal goal tracker with daily inputs, calendar planning, AI context, and timeline Gantt redesign
**Researched:** 9. 4. 2026
**Confidence:** HIGH

## Executive Summary

Ascend v2.0 transforms the app from a goal tracking tool (outputs only) into a complete personal productivity system built on the Hormozi inputs/outputs framework. The core addition is a separate Todo entity representing daily controllable actions (inputs) that optionally link to Goals (outputs). No personal tool connects daily tasks to long-term hierarchical goals this cleanly.

**Key decision: Separate Todo model (not a flag on Goal).** Goals carry 25+ fields (SMART, hierarchy, progress tracking). To-dos are lightweight, flat, binary (done/not done). Cramming both into one model means every to-do query filters around 15+ irrelevant nullable fields and blurs the mental model.

**Key decision: Separate ContextEntry model (not a field on Goal).** Context entries like "timezone: Europe/Ljubljana" are user-level facts for AI, not subordinate to any goal.

Only 2 new npm dependencies needed: react-day-picker 9.14.0 (calendar grid) and rrule 2.8.1 (recurring patterns).

## Stack Additions

| Package | Version | Purpose |
|---------|---------|---------|
| react-day-picker | 9.14.0 | Month grid calendar, React 19 compatible, shadcn/ui foundation |
| rrule | 2.8.1 | iCalendar RFC 5545 recurrence rules, richer than DAILY/WEEKLY/MONTHLY enum |

Everything else covered by existing stack.

## Feature Priorities

**Differentiators:**
- Link to-do to parent goal (input-to-output connection)
- Daily Big 3 priorities (enforced max 3 per day)
- Recurring to-dos as habits with streak + consistency scores
- To-do completion auto-progresses linked goals
- Morning planning prompt

**Table stakes:**
- To-do CRUD, calendar month grid, day detail, quick-add, context CRUD, MCP tools

## Critical Pitfalls

1. Calendar rendering: fetch only visible month range, dot indicators in cells, not full items
2. View removal breaking Zustand: bump persist version with migration
3. Context scope creep: enforce namespace/key/value simplicity
4. Timezone errors: use date-fns local functions consistently
5. Timeline detail panel overflow: ResizeObserver + min-width: 0

## Suggested Phase Structure (7 phases)

1. **Todo Data Layer**: Prisma model, service, API routes, hooks (critical path)
2. **Todo UI**: List + detail + forms, Zustand migration for view cleanup
3. **Calendar View**: Month grid, day detail, Big 3, goal deadlines
4. **Dashboard Integration**: Input-centric transformation
5. **Context System**: Model, service, MCP tools, full-text search
6. **Todo MCP Tools**: 10 tools for AI integration
7. **Timeline Redesign + Polish**: Gantt with tree hierarchy, nav cleanup

## Key Disagreement Resolutions

### Todo: Separate Model vs. Flag on Goal
Architecture + Features recommend separate. Pitfalls argues for `isQuickTask` flag. **Resolution: Separate model.** Goals and to-dos are semantically different (outcomes vs actions), structurally different (hierarchical vs flat, progress vs binary), and operationally different (slow thoughtful creation vs instant capture). The `goalId` FK bridges them cleanly.

### Context: Separate Model vs. Text Field
Architecture recommends separate namespace/key/value model. Pitfalls recommends text field on Goal. **Resolution: Separate model.** Context is user-level knowledge for AI, not goal-specific notes. "Timezone", "dietary restrictions", "employer" belong to the user, not to any goal.

## Research Flags

**Needs phase-level research:** Phase 3 (calendar mobile UX, Big 3 enforcement), Phase 5 (MCP Resources API), Phase 7 (Gantt layout proof-of-concept)

**Standard patterns (skip research):** Phase 1, Phase 2, Phase 4, Phase 6

## Gaps to Address

- rrule vs existing RecurringFrequency enum coexistence (document as tech debt)
- MCP tool count at 38 (monitor LLM selection accuracy)
- Daily Big 3 enforcement UX (what happens on 4th attempt?)
- To-do completion to goal progress increment logic (1 todo = how much progress?)
- Calendar mobile layout (small cells may be hard to tap)

---
*Research completed: 9. 4. 2026*
*Ready for requirements: yes*

# Ascend v2 Feature Roadmap

Created: 13. 4. 2026

## Execution order (dependency-aware, highest impact first)

### Wave 1: Core loop (make inputs → outputs visible)

**F1. Goal → Todo linked visibility**
Show linked todos in the goal detail panel. Completing a todo visually shows "this moved Goal X forward." Adds a "Linked Todos" section to goal-detail.tsx using the existing goalId FK on todos.
- Touches: `components/goals/goal-detail.tsx`, `lib/hooks/use-todos.ts` (new `useTodosByGoal` hook or filter), toast feedback on completion
- Size: Small

**F2. Goal progress auto-calculation from children**
When a child goal is completed, auto-recalculate the parent's progress percentage based on children completion ratios. Currently progress is manual-only.
- Touches: `lib/services/goal-service.ts` (completion side-effect), `lib/services/hierarchy-helpers.ts`
- Size: Small-Medium
- Danger zone: touches the completion flow, needs careful testing

### Wave 2: Reflection and streaks

**F3. Weekly Review flow**
A guided weekly review: what got done, what carried over, goal progress delta this week, Big 3 hit rate, XP earned, and a prompt to set next week's focus. Auto-generates a context document as the review artifact. Accessible from dashboard or calendar.
- Touches: new page or modal, new service method for aggregation, context-service for saving review, dashboard hook
- Size: Medium-Large

**F4. Streak / consistency heatmap**
GitHub-style contribution heatmap for recurring todos. Green squares for completed days, empty for missed. Shows on todo detail for recurring items and on a new "Habits" tab or section.
- Touches: new `components/todos/streak-heatmap.tsx`, `todo-detail.tsx`, possibly new API endpoint for historical streak data
- Size: Medium

### Wave 3: Insights and templates

**F5. Analytics / trend charts**
Weekly completion rate trend, XP curve, goal progress velocity. New dashboard widget or dedicated analytics page. Use recharts or similar lightweight library.
- Touches: new `components/dashboard/analytics-widget.tsx` or `app/(app)/analytics/page.tsx`, new service methods for time-series aggregation
- Size: Medium-Large

**F6. Templates**
Goal templates (SMART pre-fills for common scenarios like "Launch a product", "Learn a skill"), todo templates ("Morning routine" checklist), weekly review templates. Template picker in the create modals.
- Touches: new `lib/templates/` with template definitions, goal-form.tsx, todo-quick-add.tsx
- Size: Medium

### Wave 4: Power features

**F7. Natural language quick-add**
Smart input that parses "Buy groceries tomorrow high priority for meal prep goal" into structured todo/goal data. Uses a lightweight NLP approach or Claude API for parsing.
- Touches: new `lib/natural-language.ts` parser, enhanced quick-add components
- Size: Medium
- Decision needed: client-side heuristics vs Claude API call

**F8. Focus timer (Pomodoro)**
Select a todo, start a timer (25/5 Pomodoro or custom), mark done when session ends. Tracks cumulative focus time per todo/goal. Timer persists across page navigation.
- Touches: new `components/focus/focus-timer.tsx`, `lib/stores/focus-store.ts`, possibly new `focusSession` Prisma model
- Size: Medium-Large

**F9. Multi-device sync status UI**
Visible sync indicator ("Last synced: 2 min ago"), offline queue count, conflict resolution for stale data. Builds trust in PWA usage.
- Touches: `lib/offline/`, new `components/layout/sync-indicator.tsx`, service worker enhancements
- Size: Medium

### Wave 5: Polish

**F10. Drag and drop Big 3 selection**
Pick today's Big 3 by dragging todos into 3 slots. Visual, tactile, satisfying.
- Touches: `components/calendar/morning-planning-prompt.tsx`, `@dnd-kit` (already a dep)
- Size: Small-Medium

**F11. Keyboard-first navigation**
j/k to move through lists, Enter to open detail, x to complete, Escape to close. Vim-style navigation for power users.
- Touches: `lib/hooks/use-keyboard-shortcuts.ts`, list view components
- Size: Medium

## Total: 11 features across 5 waves

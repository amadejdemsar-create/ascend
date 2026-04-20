---
name: ax:critique
description: Launch the ascend-critic agent against the current app state with a focused brief. Use this on demand to get a product quality critique for a wave, feature, or single screen. Compares against Notion, Obsidian, Linear, Things, Raycast, and Arc. Surfaces a must-fix shortlist.
user_invocable: true
---

# ax:critique

Invokes the `ascend-critic` agent to produce a structured product quality critique. The critic evaluates UX friction, interaction coherence, empty/error states, keyboard navigation, performance feel, copy quality, and competitive parity. It answers: "Would a world-class operator choose this?"

## Execution Quality Bar (read first)

This skill enforces the Ascend quality bar from `/Users/Shared/Domain/Code/Personal/ascend/CLAUDE.md` and the global rule in `~/.claude/CLAUDE.md`.

**Forbidden phrases when the critic returns NEEDS WORK or NOT READY:**
- "Feature is done" / "Ready to ship" / "Good enough" / "Looking great"
- Never soften the critic's verdict. Relay it exactly as received.

## When to Use

- At wave close (called automatically by `ax:wave-close`)
- After completing a major user-facing feature
- After `ax:verify-ui` returns PASS (behavioral works; now check product quality)
- When something "feels off" but you cannot pinpoint it
- Before a demo or user testing session
- When the user asks "is this good enough?"

## When NOT to use

- For code quality (use `ax:review`)
- For behavioral testing (use `ax:verify-ui`)
- For visual layout debugging (use `ascend-ux` agent directly)
- For security auditing (use `ascend-security` agent)

## Usage

- `ax:critique` — critique all pages in the current app state
- `ax:critique wave <N>` — critique Wave N scope against its success criteria
- `ax:critique <page>` — critique a specific page (e.g., `ax:critique goals`, `ax:critique calendar`)
- `ax:critique <component>` — critique a specific component (e.g., `ax:critique goal-detail`)

## Workflow

### Step 1: Determine the scope

Based on user input, determine what to critique:

**Wave scope:** read the wave's PRD success criteria and "Delivered product" statement. The critique covers everything that wave promised.

**Page scope:** identify the page and all components rendered on it. Read the page component and its major child components.

**Component scope:** read the component file and understand its purpose, interactions, and states (loading, empty, populated, error).

**Full app scope:** critique each authenticated page: `/dashboard`, `/goals`, `/todos`, `/calendar`, `/context`, `/settings`.

### Step 2: Gather context

Run these in parallel:

```bash
# Recent verification reports
ls -t /Users/Shared/Domain/Code/Personal/ascend/.ascendflow/verification/ 2>/dev/null | head -3

# Recent review reports
ls -t /Users/Shared/Domain/Code/Personal/ascend/.ascendflow/reviews/ 2>/dev/null | head -3

# Current git state
cd /Users/Shared/Domain/Code/Personal/ascend && git log --oneline -5

# Component catalog for inventory context
wc -l /Users/Shared/Domain/Code/Personal/ascend/.claude/COMPONENT_CATALOG.md 2>/dev/null
```

Read the latest verification report (if any) to incorporate behavioral findings. The critic should not duplicate what the verifier already caught, but should build on it: "The verifier confirmed the filter bar persists across navigation. The product question is: does the filter bar surface the right filter options for this view?"

### Step 3: Read the relevant component source

Based on scope, read the components that render the UI being critiqued:

**For goals page:**
```bash
ls /Users/Shared/Domain/Code/Personal/ascend/apps/web/components/goals/
```
Read `goal-list-view.tsx`, `goal-detail.tsx`, `goal-filter-bar.tsx`, `quick-add.tsx`, `goal-view-switcher.tsx`.

**For todos page:**
```bash
ls /Users/Shared/Domain/Code/Personal/ascend/apps/web/components/todos/
```
Read `todo-list-view.tsx` (or equivalent), `todo-detail.tsx`, `todo-quick-add.tsx`, `todo-filter-bar.tsx`.

**For calendar:**
```bash
ls /Users/Shared/Domain/Code/Personal/ascend/apps/web/components/calendar/
```
Read `calendar-month-grid.tsx`, `calendar-day-detail.tsx`.

**For context:**
```bash
ls /Users/Shared/Domain/Code/Personal/ascend/apps/web/components/context/
```
Read `context-entry-detail.tsx`, `context-entry-editor.tsx`, and any graph/map view components.

**For dashboard:**
```bash
ls /Users/Shared/Domain/Code/Personal/ascend/apps/web/components/dashboard/
```
Read `dashboard-page.tsx` and widget components.

### Step 4: Identify the competitor reference set

Based on the scope, select the most relevant competitors:

| Scope | Primary competitors |
|-------|-------------------|
| Goals | Linear (projects, milestones), Notion (databases, views) |
| Todos | Things 3 (quick entry, areas, projects), Todoist (natural language, filters) |
| Calendar | Apple Calendar, Notion Calendar, Fantastical (natural language, design) |
| Context / Knowledge | Notion (blocks, databases), Obsidian (graph, canvas), Roam (backlinks) |
| Dashboard | Linear (project overview), Notion (dashboard widgets) |
| Full app | All of the above + Raycast (keyboard UX) + Arc (delight, polish) + Sunsama (daily planning) |

### Step 5: Launch the ascend-critic agent

Use the Task tool with `subagent_type: "ascend-critic"`. Pass it:

- **Scope:** wave number, page name, or component name
- **Files to read:** the specific component files identified in Step 3
- **Competitor set:** the relevant competitors from Step 4
- **Context:** the latest verification report findings (if any)
- **Wave success criteria:** (if wave scope) the criteria from VISION.md and the PRD
- **Specific concerns:** any concerns the user mentioned (e.g., "the empty state feels wrong", "keyboard navigation seems incomplete")

The agent will run all 13 product quality checks (PQ1 through PQ13) and produce a structured report.

### Step 6: Relay the result

Present the critic's report to the user with a summary header:

```
ASCEND PRODUCT CRITIQUE
=======================

Scope: <wave N / page / component>
Verdict: <WORLD-CLASS / GOOD / NEEDS WORK / NOT READY>

Quality checks: N PASS, M WARN, K FAIL of 13 total

Must-fix items:
1. <issue> (PQ<N>)
   Impact: <why this matters>
   Competitor reference: <how competitors handle this>

2. ...

Should-fix items:
- <issue>
- <issue>

Bright spots:
- <what is genuinely good>

Full critique available in the agent's response above.
```

### Step 7: Offer next steps

Based on the verdict:

**WORLD-CLASS:** "The critique found no must-fix items. This is ready."

**GOOD:** "1 to 2 must-fix items identified. Want me to launch `ascend-dev` to address them?"

**NEEDS WORK:** "3+ must-fix items identified. Recommend addressing these before closing the wave or shipping the feature. Want me to create tasks for each?"

**NOT READY:** "The critic recommends blocking this. Core issues: [list]. This needs significant work before it meets the quality bar. Want to discuss priorities?"

## Rules

- **ALWAYS read component source before launching the critic.** The critic needs to know what it is evaluating. Passing it a vague "critique the goals page" without file context produces generic feedback.
- **ALWAYS include the competitor reference set.** The critic's value is in comparison. Without competitors, it can only evaluate against abstract standards.
- **ALWAYS relay the verdict honestly.** Do not upgrade NEEDS WORK to GOOD because the team worked hard. Do not downgrade WORLD-CLASS to GOOD out of false humility.
- **NEVER launch the critic without reading the latest verification report.** The critic and verifier are complementary: the verifier checks "does it work?" and the critic checks "is it good?" Running the critic without verifier context means it may flag behavioral bugs that were already found.
- **NEVER use the critic as a code reviewer.** "This function is too long" is not a product critique. "The user has to scroll through 15 fields to find the delete button" is.

## Forbidden Phrases When the Critic Returns NEEDS WORK or NOT READY

If the critic's verdict is NEEDS WORK or NOT READY, you may NOT say:
- "Feature is done" / "Ready to ship" / "Complete"
- "The critique is subjective" / "These are nice-to-haves" / "We can address this later"

You MUST say:
- "Product critique verdict: <NEEDS WORK / NOT READY>. <N> must-fix items. Recommend addressing before shipping."

The quality bar is "world-class." NEEDS WORK means it is not world-class yet. NOT READY means it is not ready for any user. Both are valid signals, not opinions to override.

## Integration with Wave Workflow

The critique is a mandatory step in the wave close ritual (`ax:wave-close`). The wave close skill:

1. Runs `ax:test` (type check + build)
2. Runs `ax:review` (safety + patterns)
3. Runs `ax:verify-ui` (behavioral correctness)
4. Runs `ax:critique` (product quality)
5. Compiles all results into CLOSE-OUT.md

The critic's verdict is recorded in the CLOSE-OUT.md alongside the other verification results. A WORLD-CLASS or GOOD verdict is expected for wave closure. NEEDS WORK means the wave has should-fix items that are recorded as deferred. NOT READY means the wave should not close until the must-fix items are addressed.

## Related Skills and Agents

- `ascend-critic` agent: the actual critic that runs the 13 product quality checks
- `ascend-ux` agent: for visual layout and design pattern audits (complementary, not overlapping)
- `ascend-ui-verifier` agent: for behavioral correctness via Playwright (complementary)
- `ax:wave-close`: calls this skill as part of the wave close ritual
- `ax:verify-ui`: should be run before `ax:critique` so the critic has behavioral data

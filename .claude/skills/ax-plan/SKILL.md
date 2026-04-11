---
name: ax:plan
description: Planning pipeline for a new Ascend feature. Runs discovery questions, writes a PRD to .ascendflow/features/<slug>/PRD.md, and breaks the feature into implementation tasks with references to the actual files you will need to touch (service, route, hook, component, MCP tool). Use this before starting any non-trivial feature so the whole plan exists on disk before code is written.
user_invocable: true
---

# ax:plan

Plans a new Ascend feature from a prompt. Produces a Product Requirements Document (PRD) and an implementation task list in `.ascendflow/features/<slug>/`.

## Execution Quality Bar (read first)

This skill enforces the Ascend quality bar. The global `Execution Quality Bar (Mandatory)` rule in `~/.claude/CLAUDE.md` and the Ascend-specific quality checks in `/Users/Shared/Domain/Code/Personal/ascend/CLAUDE.md` apply in full.

**Mandatory before writing a single line of code:**

1. **Generate an explicit deliverables checklist.** Every feature plan MUST produce a `TASKS.md` with every deliverable listed as a checkbox. This checklist is what "done" means.
2. **Read quality reference PRDs before writing a new one.** Before generating the PRD, list and read at least one existing feature in `.ascendflow/features/` so the new plan matches the established quality bar. Run `ls /Users/Shared/Domain/Code/Personal/ascend/.ascendflow/features/ 2>/dev/null` and pick the most recent example. Read its `PRD.md` and `TASKS.md` end to end. If the directory is empty, this is the first plan and you set the bar.
3. **Every task must reference actual file paths from the codebase.** Never write "add the service method". Write "add `archiveGoal(userId, id)` to `lib/services/goal-service.ts` using the existing `deleteGoal` method as a template".
4. **Present the checklist to the user BEFORE starting implementation.** The user must explicitly approve the plan (say "start phase 1", "start coding", or equivalent) before any code is written. No implementation runs inside this skill.

## When to Use

- Starting a new feature that touches more than one file.
- User describes a vague idea ("archive goals", "notifications for deadlines") and you need to clarify scope before coding.
- You are about to start implementation but want the plan committed to disk so the next session can resume.

Do not use for trivial one-line edits or pure bugfixes with a known cause.

## Workflow

### Step 1: Parse the feature request

Extract the feature name from the user's prompt. If ambiguous, ask:
1. What is the one-sentence description of the feature?
2. Who triggers it? (user action, MCP client, automation)
3. What is the success criterion?

Turn the feature name into a kebab-case slug (e.g., "Archive goals" -> `archive-goals`).

### Step 2: Run discovery questions

Ask these in sequence. Stop asking when you have enough to write the PRD.

1. **Problem**: What problem does this feature solve? Is there an existing workaround?
2. **User story**: "As a user, I want to ___ so that ___."
3. **Affected entities**: Which models does this touch? (Goal, Todo, ContextEntry, Category, ProgressLog, UserStats, XpEvent)
4. **Data changes**: Does this require a Prisma schema change? A new field? A new model? A new migration?
5. **API surface**: Which API routes? (new, modified) Which MCP tools? (new, modified)
6. **UI surface**: Which pages? Which components? Does it need a new view mode, filter, detail panel section, or widget?
7. **Cache invalidation**: After a mutation, which query keys need invalidation? Cross-domain? (goals, todos, dashboard, gamification, categories, context)
8. **Danger zones**: Does this touch any known danger zone from CLAUDE.md? (todo completion transactionality, context search_vector, two recurring systems, visit-triggered todo recurrence, duplicated fetchJson, board view dead code)
9. **Out of scope**: What is explicitly NOT part of this feature?

### Step 3: Create the feature directory

```bash
mkdir -p /Users/Shared/Domain/Code/Personal/ascend/.ascendflow/features/<slug>
```

### Step 4: Write the PRD

Create `PRD.md` with this structure:

```markdown
# <Feature Name>

**Slug**: <slug>
**Created**: <YYYY-MM-DD> (European format in body: D. M. YYYY)
**Status**: planning | in-progress | done

## Problem

<One paragraph>

## User Story

As a user, I want to ___ so that ___.

## Success Criteria

- [ ] <Specific measurable criterion>
- [ ] ...

## Affected Layers

- **Prisma schema**: <changes or none>
- **Service layer**: <files to touch>
- **API routes**: <new routes + modified routes>
- **React Query hooks**: <hook file + new query keys>
- **UI components**: <new + modified>
- **MCP tools**: <new tool names or none>
- **Zustand store**: <state additions or none>

## Data Model Changes

<Prisma schema diffs if any. If there are schema changes, include the migration name.>

## API Contract

<Route-by-route: method, path, request shape, response shape, status codes>

## UI Flows

<Page-by-page: where the entry point is, what the user sees, what happens on each action>

## Cache Invalidation

<After each mutation, list the invalidated query keys. Include cross-domain invalidations.>

## Danger Zones Touched

<Any from CLAUDE.md Danger Zones section. For each, note how the implementation handles the risk.>

## Out of Scope

- <Explicit non-goals>

## Open Questions

- <Anything the user did not answer during discovery>
```

### Step 5: Write the task list

Create `TASKS.md` with dependency-ordered tasks. Each task must reference actual files.

```markdown
# Implementation Tasks: <Feature Name>

Order matters. Each task includes the files it touches and the layer it implements.

## Phase 1: Schema and validation

- [ ] Update `prisma/schema.prisma`: add <field/model>. Run `npx prisma migrate dev --name <migration-name>`.
- [ ] Add Zod schemas to `lib/validations.ts`: `create<Entity>Schema`, `update<Entity>Schema`, `<entity>FiltersSchema`, and exported `Input` types.

## Phase 2: Service layer

- [ ] Add method(s) to `lib/services/<domain>-service.ts`. Follow the const object pattern, userId first parameter, existence check before update or delete.
- [ ] If hierarchy involved: call `validateHierarchy()` from `lib/services/hierarchy-helpers.ts`.
- [ ] If gamification involved: call `gamificationService` methods.

## Phase 3: API route

- [ ] Create or modify route at `app/api/<path>/route.ts`. Follow the auth-parse-service-respond pattern.
- [ ] For parameterized routes, use `{ params }: { params: Promise<{ id: string }> }`.

## Phase 4: React Query hook

- [ ] Add query keys to `lib/queries/keys.ts`.
- [ ] Add hook(s) to `lib/hooks/use-<domain>.ts`. For mutations, include cache invalidation with all affected domains.

## Phase 5: UI components

- [ ] Check `.claude/COMPONENT_CATALOG.md` before creating new components.
- [ ] Add or modify components in `components/<domain>/`.
- [ ] Use shadcn primitives from `components/ui/`.
- [ ] Click-to-edit pattern for detail panel fields.
- [ ] Filter bar wired to `lib/stores/ui-store.ts`.

## Phase 6: MCP tool (if applicable)

- [ ] Add JSON Schema to `lib/mcp/schemas.ts` (`TOOL_DEFINITIONS` array).
- [ ] Add handler to `lib/mcp/tools/<domain>-tools.ts`. Use Zod validation inside the handler.
- [ ] Add tool name to the appropriate Set in `lib/mcp/server.ts` and add a routing branch.

## Phase 7: Verification

- [ ] Run `npx tsc --noEmit`. Must pass.
- [ ] Run `npm run build`. Must pass.
- [ ] Run `ax:review` skill to audit against safety rules.
- [ ] Manually test happy path and at least one error case.
```

### Step 6: Iteration loop (mandatory)

Before handing off:

1. Re-read the PRD and TASKS.md end to end.
2. Verify every task references a specific file path (not a generic description).
3. Verify every affected layer from discovery is represented in at least one task.
4. Verify the final task is "Run `ax:review` and then `ax:deploy-check`".
5. If any of those checks fail, revise the files until they pass. Do NOT hand off a plan with generic tasks.

### Step 7: Confirm and hand off

Print the PRD path and task list path to the user, then present the deliverables checklist (the list of TASKS.md items as checkboxes) directly in the chat. Ask the user to review and approve:

```
Deliverables checklist for <feature>:
[ ] Phase 1: <task 1>
[ ] Phase 2: <task 2>
...
[ ] Phase N: Run ax:review, then ax:deploy-check

Approve this plan? Reply "start phase 1" to begin implementation.
```

Do not start coding until the user confirms. No implementation runs inside this skill.

## Output Example

```
Feature planned: Archive goals
PRD: .ascendflow/features/archive-goals/PRD.md
Tasks: .ascendflow/features/archive-goals/TASKS.md

Next step: Phase 1 (Prisma schema + Zod). Say "start phase 1" or "start coding" to begin.
```

## Rules

- **Always ground tasks in actual files.** Never write "add the service method" without the specific file path.
- **Always mark danger zones.** If the feature touches a known risk, call it out in the PRD so the implementer handles it consciously.
- **Always end with verification phase.** `npx tsc --noEmit` + `npm run build` + `ax:review`.
- **Never start implementation inside this skill.** Planning and coding are separate.

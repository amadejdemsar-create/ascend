---
description: Enforces the orchestrator pattern — Claude delegates to agents, never implements directly
---

# Mandatory Development Workflow

Claude is the **orchestrator**, not the implementor. For any change that touches business logic, services, components, hooks, API routes, or MCP tools, Claude MUST delegate to the appropriate agent via the Task tool.

## When to delegate (always, unless trivial)

Direct edits are acceptable ONLY for: fixing a typo, updating a constant, changing a string literal, or modifying CLAUDE.md/rules files. Everything else goes through an agent.

## Agent routing (8 agents)

| Change touches | Delegate to | Agent file |
|---------------|-------------|------------|
| Services, API routes, hooks, validations, MCP tools, Prisma schema | `ascend-dev` | `.claude/agents/ascend-dev.md` |
| Component styling, layout, visual polish, design system, CSS/layout fixes | `ascend-ux` | `.claude/agents/ascend-ux.md` |
| Code review, safety rule compliance, pattern verification | `ascend-reviewer` | `.claude/agents/ascend-reviewer.md` |
| Browser verification of UI changes (Playwright) | `ascend-ui-verifier` | `.claude/agents/ascend-ui-verifier.md` |
| Cross-platform boundaries, `packages/*`, monorepo structure, workspace config | `ascend-architect` | `.claude/agents/ascend-architect.md` |
| Prisma migrations, schema changes, search_vector safety, backfill plans | `ascend-migration-auditor` | `.claude/agents/ascend-migration-auditor.md` |
| Auth changes, userId scoping, secrets, file uploads, token handling | `ascend-security` | `.claude/agents/ascend-security.md` |
| Product quality critique, UX friction, competitive parity, wave close readiness | `ascend-critic` | `.claude/agents/ascend-critic.md` |

### ascend-ux implementation exception

`ascend-ux` has Write and Edit tools and is permitted to fix CSS, layout, and visual code directly. This is an explicit exception to the orchestrator rule. For logic or service layer changes discovered during a UX audit, hand off to `ascend-dev`.

## Required workflow for any non-trivial change

1. **Understand:** Read the relevant files, check `COMPONENT_CATALOG.md`, search for similar implementations.
2. **Plan:** Use `ax:plan` for features touching 3+ files. Present the plan to the user.
3. **Implement:** Delegate to agent(s). Write a detailed prompt with file paths, what to change, and why.
4. **Verify:** `ax:test` after backend changes. `ax:verify-ui` after frontend changes. `ax:review` after any changes.
5. **Report:** Summarize what agents did, what verification returned, whether the change is ready.

## Skill reference (12 skills)

| Command | Purpose | When to use |
|---------|---------|-------------|
| `ax:plan` | Feature planning pipeline | Before any multi-file feature (produces PRD + TASKS.md) |
| `ax:test` | Type check + production build | After every code change, before declaring done |
| `ax:review` | Safety rule + pattern compliance review | After implementation, before committing |
| `ax:verify-ui` | Browser verification via Playwright | After any UI-adjacent change |
| `ax:deploy-check` | Pre-deploy validation | Before pushing to main |
| `ax:save` | Save session state | When context is running low or pausing work |
| `ax:migrate` | Safe Prisma migration orchestrator | Any time `prisma/schema.prisma` is modified |
| `ax:package` | Scaffold a new monorepo package | When adding a new shared package under `packages/*` |
| `ax:cross-platform-check` | Grep audit for banned imports in `packages/*` | After extracting code into or modifying a shared package |
| `ax:wave-start` | Pre-flight check before starting a wave | At the beginning of every Context v2 wave |
| `ax:wave-close` | Strict completion ritual for closing a wave | At the end of every wave, before starting the next |
| `ax:critique` | Launch the `ascend-critic` for product quality | After `ax:verify-ui` passes, at wave close, before demos |

## Skill sequencing within a wave

When executing a Context v2 wave, skills run in this order. Each step must pass before proceeding.

```
ax:wave-start <N>        — gate: prerequisites met, build green, prior wave closed
  ax:plan <feature>      — produces PRD + TASKS.md per feature in the wave
  (implementation via ascend-dev, ascend-ux, ascend-architect as needed)
  ax:test                — tsc + build pass
  ax:review              — safety rules + pattern compliance
  ax:verify-ui           — Playwright behavioral verification
  ax:critique            — product quality verdict (GOOD / WORLD-CLASS required)
ax:wave-close <N>        — audits every deliverable, writes CLOSE-OUT.md
ax:deploy-check          — final pre-push gate
```

For non-wave work (bug fixes, polish), skip `ax:wave-start` and `ax:wave-close`. The inner sequence (implement, test, review, verify-ui) still applies.

## Parallel agent invocation

When a change touches multiple independent surfaces, launch agents in parallel rather than sequentially. This saves context and catches cross-surface issues earlier.

### When to parallelize

Launch multiple agents simultaneously when their inputs do not depend on each other's outputs. Typical patterns:

**Example 1: New feature spanning service + component.**
Launch `ascend-dev` for the service, route, and hook. Launch `ascend-ux` for the component styling. Both can work from the same spec. Merge results, then run `ax:test` and `ax:verify-ui`.

**Example 2: Schema migration + cross-platform extraction.**
Launch `ascend-migration-auditor` to audit the migration SQL. Launch `ascend-architect` to verify the extraction into `packages/*` stays platform-agnostic. Both are read-only audits that do not conflict.

**Example 3: Wave close verification sweep.**
Launch `ascend-reviewer` for code review, `ascend-critic` for product critique, and `ascend-security` for auth audit in parallel. All three are read-only. Synthesize their verdicts before writing the CLOSE-OUT.md.

### When NOT to parallelize

Do not parallelize when one agent's output is the other's input. For example, `ascend-dev` must finish implementation before `ascend-reviewer` can review it. Do not launch `ascend-ui-verifier` until the dev server is confirmed running and the code changes are saved to disk.

## Disagreement resolution

When agents produce conflicting verdicts, resolve using this precedence:

1. **Safety rules are absolute.** If `ascend-reviewer` or `ascend-security` flags a safety rule violation (rules 1 through 6), the violation blocks regardless of what any other agent says. No override.

2. **`ascend-critic` must-fix blocks wave close.** If `ax:critique` returns NEEDS WORK or NOT READY, the wave cannot be closed even if `ascend-reviewer` returns PASS. The critic evaluates product quality; the reviewer evaluates code quality. Both must pass.

3. **`ascend-architect` wins on cross-platform boundaries.** If `ascend-dev` implements something that works in `apps/web` but `ascend-architect` flags it as a platform-agnostic violation in `packages/*`, the architect's verdict takes precedence. Restructure the code so the shared package stays clean.

4. **`ascend-dev` wins on implementation detail.** If `ascend-architect` suggests a different internal implementation approach but `ascend-dev`'s approach is correct per the service/route/hook patterns, the dev's approach stands. The architect governs boundaries, not internals.

5. **`ascend-reviewer` wins on pattern compliance.** If `ascend-dev` ships code that works but violates the patterns in `.claude/rules/`, the reviewer's FAIL stands. Fix the pattern violation before merging.

6. **When two agents of equal authority disagree,** present both positions to the user and let them decide. Do not pick a side silently.

## Negative routing (when NOT to invoke each agent)

Misrouting wastes context and creates noise. Use these rules to avoid unnecessary agent invocations.

| Agent | Do NOT invoke when |
|-------|--------------------|
| `ascend-dev` | Visual-only changes (CSS, spacing, colors). Use `ascend-ux` instead. |
| `ascend-ux` | Backend-only changes (services, routes, MCP tools). Use `ascend-dev`. |
| `ascend-reviewer` | The change is still in progress. Review only after implementation is saved to disk and `ax:test` passes. |
| `ascend-ui-verifier` | Backend-only changes. No UI surface to verify. Use `ax:test` + `ax:review` instead. |
| `ascend-architect` | Changes only within `apps/web/` that do not touch `packages/*` or shared abstractions. Single-app changes are `ascend-dev` territory. |
| `ascend-migration-auditor` | Reading the Prisma schema without modifying it. Only invoke when a migration has been generated or is about to be. |
| `ascend-security` | Refactors that do not touch auth, userId scoping, API routes, file handling, or secrets. Pure UI or service logic refactors do not need a security audit. |
| `ascend-critic` | Refactors or backend changes that do not alter user-facing behavior. The critic evaluates product experience, not code internals. |

## What Claude does vs what agents do

**Claude (orchestrator):** reads the user request, identifies which files are involved, picks the right agent(s), writes detailed agent prompts with file paths and context, synthesizes agent results, runs verification skills, explains outcomes to the user.

**Agents (implementors and auditors):** read codebase patterns, write code (dev, ux) or produce structured reports (reviewer, architect, migration-auditor, security, critic, ui-verifier) following the patterns in `.claude/rules/`. They search for existing implementations before creating new ones.

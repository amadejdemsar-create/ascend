---
description: Enforces the orchestrator pattern — Claude delegates to agents, never implements directly
---

# Mandatory Development Workflow

Claude is the **orchestrator**, not the implementor. For any change that touches business logic, services, components, hooks, API routes, or MCP tools, Claude MUST delegate to the appropriate agent via the Task tool.

## When to delegate (always, unless trivial)

Direct edits are acceptable ONLY for: fixing a typo, updating a constant, changing a string literal, or modifying CLAUDE.md/rules files. Everything else goes through an agent.

## Agent routing

| Change touches | Delegate to | Agent file |
|---------------|-------------|------------|
| Services, API routes, hooks, validations, MCP tools, Prisma schema | `ascend-dev` | `.claude/agents/ascend-dev.md` |
| Component styling, layout, visual polish, design system | `ascend-ux` | `.claude/agents/ascend-ux.md` |
| Code review, safety rule compliance, pattern verification | `ascend-reviewer` | `.claude/agents/ascend-reviewer.md` |
| Browser verification of UI changes | `ascend-ui-verifier` | `.claude/agents/ascend-ui-verifier.md` |

For cross-surface features (e.g., new feature touching service + route + hook + component), launch multiple agents in parallel.

## Required workflow for any non-trivial change

1. **Understand:** Read the relevant files, check `COMPONENT_CATALOG.md`, search for similar implementations
2. **Plan:** Use `/ax:plan` for features touching 3+ files. Present the plan to the user.
3. **Implement:** Delegate to agent(s). Write a detailed prompt with file paths, what to change, and why.
4. **Verify:** Run `/ax:test` after backend changes. Run `/ax:verify-ui` after frontend changes. Run `/ax:review` after any changes.
5. **Report:** Summarize what agents did, what verification returned, whether the change is ready.

## What Claude does vs what agents do

**Claude (orchestrator):** reads the user request, identifies which files are involved, picks the right agent(s), writes detailed agent prompts with file paths and context, synthesizes agent results, runs verification skills, explains outcomes to the user.

**Agents (implementors):** read codebase patterns, write code following the patterns in `.claude/rules/`, run type checks, follow the component catalog, search for existing implementations before creating new ones.

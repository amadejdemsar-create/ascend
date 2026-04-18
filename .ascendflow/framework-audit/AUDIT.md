# Ascend Framework Audit

**Date**: 18. 4. 2026
**Auditor**: claude-code-advisor (Opus 4.6)
**Scope**: 4 agents, 6 skills, 5 rules, CLAUDE.md, COMPONENT_CATALOG.md
**Quality reference**: `/devtakeover` SKILL.md (930 lines, 13 critical rules, 5-phase spec with iteration loops)
**Context**: Ascend is scaling from single-user todo app to universal AI-first context layer (10-wave roadmap, cross-platform)

---

## 1. Executive Summary

### Overall Health: B+ (Strong Foundation, Not Yet World-Class)

The Ascend framework is the most detailed single-project Claude Code ecosystem I have seen. It has real depth: the `ascend-dev` agent alone is 220 lines with 48+ file path references, the `ascend-ui-verifier` is 383 lines with a 7-phase verification protocol, and every safety rule is grounded in an actual incident (the tsvector column, the non-transactional todo completion). The framework works well for what Ascend IS today: a single-user, single-codebase, web-only Next.js app.

It is not yet scaled for what Ascend WILL BE: a multi-platform (web, iOS, Android, macOS, Windows), multi-package monorepo with shared business logic, platform-specific UI layers, a migration-heavy database evolution, and security concerns that go well beyond single-user API key auth.

### Top 3 Strengths

1. **Incident-driven safety rules.** Every danger zone is documented with the specific failure mode it prevents, not generic advice. DZ-1 through DZ-7 each point to real files and real risk scenarios. The `ascend-reviewer` agent checks each one by name. This is the gold standard for safety documentation.

2. **End-to-end verification pipeline.** The `ax:plan` -> `ax:test` -> `ax:review` -> `ax:verify-ui` -> `ax:deploy-check` chain covers planning, type safety, pattern compliance, runtime behavior, and deploy readiness. Very few projects have this complete a lifecycle.

3. **Deep agent specialization with overlapping verification.** Four agents, each with a distinct role (implement, audit code, audit visuals, verify in browser), and the skills layer orchestrates them. The `ascend-ux` agent uses Chrome DevTools in Dia; the `ascend-ui-verifier` uses Playwright. They are complementary and the CLAUDE.md explicitly says so.

### Top 3 Gaps

1. **No cross-platform or monorepo awareness.** Every agent, skill, and rule assumes a single Next.js codebase at `/Users/Shared/Domain/Code/Personal/ascend`. There is no concept of shared packages, platform-specific builds, or coordinated releases. The forthcoming `ascend-architect` agent should address this, but the existing artifacts will also need updates (every file path reference assumes the current flat structure).

2. **No performance, accessibility, or security agents/rules.** The framework catches type errors, pattern violations, and visual regressions. It does not catch performance regressions (no bundle size tracking, no Lighthouse, no query performance monitoring), accessibility violations (no axe-core integration, no WCAG checks), or security issues beyond the userId scoping rule. For a product targeting world-class bar, all three are mandatory.

3. **No automated test suite, and `ax:test` knows it.** The skill explicitly says "Ascend has no Jest or Vitest test suite (yet)" and substitutes tsc + build. This works for catching compile errors but misses logic regressions, edge cases in service methods, and race conditions in cache invalidation. The framework acknowledges this gap (the "Known False Negatives" section in `ax:test`) but offers no plan to close it.

---

## 2. Per-Artifact Grades

### 2.1 Agents

#### `ascend-dev.md` — Grade: A-

**Observations:**
- 220 lines. Extremely dense with project-specific content. References 48+ actual file paths. Includes the full service layer contract, API route contract, React Query hook contract, Zustand UI store contract, and MCP tool contract, each with code examples from the actual codebase.
- The "Before creating anything new, search the codebase for similar implementations first" directive is prominently placed and backed by concrete search examples (Grep for `useMutation`, Glob for `app/api/**/route.ts`).
- All 6 safety rules reproduced verbatim. All 7 danger zones documented with specific file references and remediation guidance.
- "Communication Style" section at the end is concise and actionable: state what you understood, which files you plan to touch, risks identified.
- The "Workflow for a New Feature" section mirrors the dependency order from `ax:plan` (schema -> migration -> validation -> service -> route -> hook -> component -> MCP), providing consistency.

**Upgrade recommendations:**
- The `description` frontmatter is excellent but could include a negative example ("Do NOT use for visual polish or design audits; use ascend-ux instead") to prevent misrouting.
- `cache-config.ts` path listed as `lib/queries/cache-config.ts` with a "(may not exist yet; check before importing)" caveat. The actual path per CLAUDE.md is `lib/offline/cache-config.ts`. This is a factual inconsistency (cross-reference integrity issue). Fix the path.
- No mention of the forthcoming monorepo structure. When the codebase splits into packages, every file path in this agent becomes stale. Consider adding a "Codebase scope" header that states the current structure and can be updated.

---

#### `ascend-reviewer.md` — Grade: A-

**Observations:**
- 299 lines. The most structured output format of any agent: mandatory verdict template with 6 rule checks, 7 danger zone checks, 4 pattern checks, each with explicit PASS/FAIL/NEEDS_REVIEW. This is load-bearing structure that prevents soft reviews.
- "Iteration Loop (Mandatory)" section makes review a loop, not a one-shot. This is critical and explicitly addresses the failure mode of "LGTM" reviews.
- Grep patterns for finding violations are provided (e.g., `prisma\.(goal|todo|...)\.(...)`), making the review reproducible.
- "Forbidden Phrases When Any FAIL Exists" section mirrors the global Execution Quality Bar, reinforcing the no-softening rule.
- Pattern checks reference all four `.claude/rules/` files by name.

**Upgrade recommendations:**
- The output format appears twice: once under "Mandatory Output Format" (lines 30-73) and once under "Verdict Format" (lines 267-292). They are slightly different (the first has `Rule checks:` with indented sub-items; the second has a flatter `Issues:` list). This is a contradiction. Pick one canonical format and remove the duplicate.
- No check for accessibility patterns (aria-labels, focus management, color contrast). When the project targets world-class bar, this is a gap. Consider adding a "Pattern checks: Accessibility" item, or defer to the proposed `ascend-security` agent.
- No check for test coverage. When a test suite exists, the reviewer should verify new code has tests. Add a "Phase: future" note.

---

#### `ascend-ui-verifier.md` — Grade: A

**Observations:**
- 383 lines. The most detailed agent in the ecosystem. 7-phase protocol (evaluate change -> scenario plan -> environment check -> open app -> navigate via clicks -> execute scenarios -> regression sweep -> write report -> return summary). This is genuine QA engineering, not a hand-wave.
- The "click through the app like a human" rule (Rule 3) is brilliantly specific: "You may type a URL ONCE at session bootstrap, and only `/dashboard` or `/goals`, not an arbitrary deep link." This prevents the agent from bypassing navigation bugs.
- Phase 0.5 (explicit scenario plan BEFORE touching the browser) with a worked example of 9 scenarios for an enum consolidation change is world-class. Most verification agents skip planning entirely.
- "Ascend-specific signals worth looking for" section (lines 329-342) documents 14 runtime gotchas that compile-time checks miss. This is the kind of knowledge that normally lives only in a senior engineer's head.
- The Turbopack warm-up protocol (Phase 1) with curl-warming each route before Playwright touches the browser was born from the 11. 4. 2026 false failure and is documented as such. Incident-driven engineering at its best.
- The "Todo row checkbox is bulk selection, not completion" clarification (lines 341) prevents a specific misinterpretation that wasted time in a previous run. This level of institutional memory is rare.

**Upgrade recommendations:**
- The mandatory `browser_resize` to 1728x1013 (Rule 2) references the global Playwright MCP config in `~/.claude.json`. If the viewport ceiling changes, both this agent and the config must be updated. Consider referencing the config rather than hardcoding the dimensions.
- No mobile viewport testing. Rule 2 explicitly says "Do not resize again during the session." For a cross-platform product, the verifier needs a mobile-viewport mode. This could be a separate invocation flag (`ax:verify-ui --mobile`) rather than changing the existing behavior.

---

#### `ascend-ux.md` — Grade: A-

**Observations:**
- 343 lines. Clearly distinct from `ascend-ui-verifier`: this agent uses Chrome DevTools MCP in Dia for visual audits; the verifier uses Playwright for behavioral verification. The CLAUDE.md explicitly calls them complementary.
- "Reference Quality Files (mandatory reading)" section lists 7 canonical components with exact file paths and what makes each the gold standard. This is calibration, not just instruction.
- "Iteration Loop (Mandatory for Visual Work)" is a 10-step loop: read reference -> make change -> open in Dia -> screenshot -> compare -> identify issues -> fix -> reload -> screenshot -> repeat. This prevents code-only guessing.
- The "Visual Debugging Protocol" at line 304 mirrors the global CLAUDE.md rule: "Never guess fixes from source code. Measure first." Consistency.
- Rule checks cover 7 dimensions: click-to-edit, two-panel layout, reversible done states, filter bar wiring, loading/empty states, keyboard/accessibility, spacing/polish.

**Upgrade recommendations:**
- The agent has Write and Edit tools (line 6), meaning it can fix code. But the CLAUDE.md "Mandatory Development Workflow" says "Claude is the orchestrator, not the implementor. Never implement code changes directly." This creates an ambiguity: is `ascend-ux` allowed to fix CSS/layout code directly, or should it report issues and hand off to `ascend-dev`? The agent body says "Make the code change (or audit the developer's change)" in the iteration loop (step 2), suggesting it can fix. This should be made explicit.
- "Danger Zones (UI-specific)" at line 296 lists 4 items (no error boundaries, board view dead code, offline sync incomplete, mobile detail views cramped). These overlap with but are not identical to the 7 danger zones in `ascend-dev`. Consider numbering them consistently (DZ-UI-1 through DZ-UI-4) to avoid confusion with the service-layer DZ-1 through DZ-7.
- No mention of dark mode testing. The app uses `next-themes` (ThemeProvider in the component catalog). Every visual audit should verify both light and dark themes.

---

### 2.2 Skills

#### `ax:plan` — Grade: A-

**Observations:**
- 218 lines. Clean 7-step workflow: parse -> discovery -> create directory -> write PRD -> write TASKS.md -> iteration loop -> confirm and hand off.
- The discovery questions (Step 2) are comprehensive: 9 categories from problem statement through danger zones to out-of-scope exclusions.
- The PRD template is well-structured with all layers represented (Prisma schema, service, route, hook, component, MCP, Zustand).
- TASKS.md template follows dependency order (schema -> validation -> service -> route -> hook -> component -> MCP -> verification).
- Step 6 "Iteration loop (mandatory)" verifies every task references a specific file path, every layer is represented, and the final task is verification. This catches generic plans.
- "No implementation runs inside this skill" is stated three times (steps 4, 7, and rules). Clear boundary.

**Upgrade recommendations:**
- No concept of waves or roadmap phases. For a 10-wave product, `ax:plan` should be able to reference which wave a feature belongs to and what prior waves it depends on. This is what the forthcoming `ax-wave-start` skill should provide, but `ax:plan` should at least link to it.
- No concept of cross-platform impact. A feature plan for "offline sync" affects web, iOS, and Android differently. The PRD template should include a "Platform impact" section.
- The PRD template uses ISO date format for `Created` (YYYY-MM-DD) then says "(European format in body: D. M. YYYY)" in a comment. Pick one and enforce it.

---

#### `ax:test` — Grade: B+

**Observations:**
- 180 lines. Clear two-step workflow: tsc then build. The skill knows what it is and what it is not: "Ascend has no Jest or Vitest test suite (yet). This skill is the practical substitute."
- The "Known False Negatives" section (lines 109-114) is honest about what tsc + build cannot catch: Prisma schema drift, missing env vars, React Query race conditions, MCP runtime errors. This sets correct expectations.
- The "Known False Positives" section (lines 118-122) lists ESLint warnings, Next.js deprecation warnings, and Prisma generator notices as non-blocking. This prevents false alarms.
- Pass/fail criteria are explicit and binary: "No partial credit. No 'mostly passing'. No 'should be fine.'"
- The "Future" section (lines 173-179) documents the intended evolution (add `npm test`, report coverage). This is roadmap awareness.

**Upgrade recommendations:**
- The `ax:test dev` mode (Step 4) starts the dev server in background, watches for 15 seconds, then kills it. This is fragile: 15 seconds may not be enough for Turbopack cold compilation (the verifier agent documents 60-120 second compile times). Either increase the window or document this limitation.
- No bundle size check. For a product scaling to cross-platform, bundle size is a performance gate. Consider adding a `ax:test bundle` mode that runs `next build` with `--analyze` or checks the `.next/` output for size regressions.
- The skill does not run lint (`npm run lint`). The project has ESLint configured. Consider adding it as an optional step.

---

#### `ax:review` — Grade: A-

**Observations:**
- 158 lines. Clean 5-step workflow: gather diff -> launch reviewer agent -> save review file -> iteration loop -> print verdict.
- Step 2 correctly delegates to the `ascend-reviewer` agent via Task tool, not duplicating the review logic.
- Step 4 "Iteration loop (mandatory)" implements the fix-and-re-review cycle: if FAIL, offer to launch `ascend-dev`, then re-run the full review. "Never downgrade a FAIL to a PASS to close the loop."
- Edge cases are handled: clean working tree (exit early), huge diff (warn, offer scoping), build fails for unrelated reasons (ask whether to continue), reviewer disagrees with user (save reasoning as addendum).
- "Forbidden phrases when any issue exists" mirrors the pattern from the reviewer agent and the global quality bar. Triple reinforcement.

**Upgrade recommendations:**
- Step 3 saves the review to `.ascendflow/reviews/` with a specific filename format. But the filename example (line 83) uses `<YYYY-MM-DD-HHMM>-review.md`, which does not include a slug. Other skills (ax:save, ax:verify-ui) include a descriptive slug. Add a slug derived from the most-changed file or the git branch.
- The skill says "Reference agent: The actual safety rule checks... are performed by the ascend-reviewer agent" but does not specify whether to pass `model: "opus"` to the Task tool. The global CLAUDE.md says "ALWAYS use Opus 4.6 for everything: main session, Task tool subagents." The skill should echo this.

---

#### `ax:verify-ui` — Grade: A-

**Observations:**
- 163 lines. Clean 5-step workflow: determine targets -> confirm dev server -> launch verifier agent -> relay result -> iteration loop.
- Step 1 auto-detection logic maps changed files to pages intelligently (e.g., `lib/hooks/use-goals.ts` maps to `/goals` + `/dashboard`; `lib/stores/ui-store.ts` maps to every filter bar + view switcher).
- "When NOT to use" section is valuable: "For backend-only changes (use ax:review + ax:test instead)" and "For design/visual polish audits (use the ascend-ux agent directly)."
- Step 5 iteration loop mirrors `ax:review`: offer to fix via `ascend-dev`, then re-verify.
- Edge case: "Playwright MCP not available" gives the exact config check and fix.

**Upgrade recommendations:**
- No mobile verification mode. The file-to-page mapping assumes desktop. For cross-platform, add `ax:verify-ui --mobile` that passes a mobile viewport to the verifier.
- The skill detects the dev server port by curling 3000, 3001, 3100. If Ascend moves to a monorepo with multiple dev servers (web on 3000, docs on 3001), this logic breaks. Make the port list configurable.

---

#### `ax:deploy-check` — Grade: A

**Observations:**
- 223 lines. 10 sequential checks, each with explicit pass/fail criteria: clean tree, correct branch, up to date with remote, build passes, tsc passes, Prisma migrations in sync, no forbidden commands, reviewer on diff, danger zones, env vars documented.
- Check 6 (Prisma migrations) specifically looks for the `search_vector` migration. This is the only skill that proactively verifies DZ-2 is not regressed.
- Check 7 (no forbidden Prisma commands) greps `package.json`, `Dockerfile`, and `scripts/`. This catches the danger zone at the deploy gate, not just in code review.
- Check 10 (env vars documented) is a nice touch: it greps for `process.env.` usage and checks `.env.example`. Most deploy checks stop at "does it build."
- The "Mandatory Completion Checklist" section at the end with explicit "ASCEND DEPLOY CHECK RESULT" format mirrors the reviewer's output format. Consistent.
- "Deployment Facts" section (lines 176-184) is a compact reference for the deploy target, trigger, build process, and env var location. Useful during deploy debugging.

**Upgrade recommendations:**
- No database migration dry-run. Check 6 verifies migrations are in sync but does not run them against a test database. For a production-grade deploy check, consider `npx prisma migrate deploy --dry-run` (or equivalent) to catch migration failures before they hit production.
- No check for Docker build success. The Dokploy deploy uses a Dockerfile. Running `docker build .` locally would catch Dockerfile issues before they fail remotely. This is expensive (30-60s) but worth it as an optional check.
- No rollback plan. The skill says "if any check fails, stop." But it does not say what to do if the deploy itself fails after push. Consider adding a "Rollback" section referencing `git revert` or Dokploy rollback.

---

#### `ax:save` — Grade: B+

**Observations:**
- 190 lines. Clean 5-step workflow: gather git context -> ask user for summary -> generate filename -> write session file -> confirm.
- The session file template is comprehensive: what was worked on, files being worked on, git state, changes in progress, current state (done/in-progress/next), open questions, context for next session, commands to run when resuming, how to resume.
- "Mandatory State Capture Format" at the top enforces 4 pieces: what was worked on, what is DONE, what is LEFT, blockers. If a blocker exists, state must be `blocked`.
- "How to Resume" instructions in the template are explicit: read this file, read Files Being Worked On, check git status, then continue based on state.

**Upgrade recommendations:**
- No automatic snapshot of verification results. If `ax:verify-ui` or `ax:review` was run in the session, their report paths should be captured automatically (not just if the user mentions them). The session file references `.ascendflow/reviews/` and `.ascendflow/verification/` conceptually but does not automatically find and link the latest ones.
- No git stash integration. If the user wants to save mid-work with uncommitted changes and switch branches, `ax:save` should offer to `git stash` and record the stash ref. Currently it just records the dirty state.
- Step 2 asks the user 4 questions ("What were you working on?", "What is the current state?", "What is the next concrete step?", "Any open questions?"). For a quick save, this is friction. Consider deriving all 4 from git state + recent tool history when the user says "just save" or passes no answers.

---

### 2.3 Rules

#### `ascend-workflow.md` — Grade: B

**Observations:**
- 58 lines. The shortest rule file. Functions as the orchestrator mandate: "Claude is the orchestrator, not the implementor."
- Agent routing table maps change types to agents with clear "When to delegate" criteria.
- Required workflow steps: understand -> plan -> implement (delegate) -> verify -> report.
- "What Claude does vs what agents do" section provides the responsibility split.

**Upgrade recommendations:**
- Too thin. This is the most important rule in the framework (it determines whether agents are used at all), but it is the shortest rule file. Compare to `service-patterns.md` (92 lines with code examples) or `component-patterns.md` (107 lines with tables and code). This rule should be at least as deep.
- Missing: when to use multiple agents in parallel. The text says "For cross-surface features, launch multiple agents in parallel" but gives no example of what a cross-surface feature looks like or how to structure parallel agent prompts.
- Missing: how to handle agent disagreements. What if `ascend-dev` makes a change that `ascend-reviewer` rejects? The workflow should specify the resolution path.
- Missing: how to handle the case where the orchestrator's understanding of the task is wrong. What if the user asks for a "backend change" but it actually requires UI changes too? The workflow should specify how to re-route.
- No frontmatter. Unlike agent files (which have `name`, `description`, `model`, `color`, `tools`), rule files in this project have no YAML frontmatter. This is fine per Claude Code conventions (rules/*.md files do not require frontmatter unless using path-scoped globs), but it means there is no `description` field for discoverability.

---

#### `service-patterns.md` — Grade: A-

**Observations:**
- 92 lines. The canonical reference for the service layer contract. Code example shows the exact const object pattern with async methods, userId first parameter, existence check before update/delete, plain Error throws.
- 7 rules, each grounded in the actual codebase pattern: userId in every query, validate before mutating, type inputs from validations, keep Prisma imports in services only, date conversion, hierarchy validation, error pattern.
- "Existing Services" table lists all 9 services with their file paths and domains. This is the lookup table agents use.

**Upgrade recommendations:**
- No example of `prisma.$transaction()`. Given DZ-1 (todo completion is not transactional), the service patterns rule should include guidance on when and how to use transactions. Currently it is silent on this.
- No guidance on pagination. The `list` method example uses `findMany` with no take/skip. As data grows, unbounded queries become a performance issue.
- No guidance on soft delete vs hard delete. The example shows `prisma.example.delete({ where: { id } })` (hard delete). If the product adds archiving (a common feature request), the pattern needs updating.

---

#### `api-route-patterns.md` — Grade: A-

**Observations:**
- 95 lines. Clean 4-step pattern: authenticate -> parse -> service -> respond. Code examples show both GET (with filters from search params) and POST (with Zod body parsing).
- Parameterized route pattern with `{ params }: { params: Promise<{ id: string }> }` and `const { id } = await params` is Next.js 16 specific and correctly documented.
- 6 rules covering auth, validation, no Prisma imports, error handling, 201 for creation, 404 for not found.
- Auth imports section lists exactly what comes from `lib/auth.ts` and what each function does.
- Validation schema naming convention documented: `create<Entity>Schema`, `update<Entity>Schema`, `<entity>FiltersSchema`.

**Upgrade recommendations:**
- No rate limiting guidance. For a deployed product, API routes need rate limiting. This could be a note for now, a full pattern later.
- No CORS or security headers guidance. The auth is API key based; there is no mention of how CORS is configured or whether security headers are set.
- No guidance on streaming responses. If the product adds long-running operations (e.g., AI-powered context analysis), the route pattern needs SSE or WebSocket guidance.

---

#### `component-patterns.md` — Grade: B+

**Observations:**
- 107 lines. Covers 6 patterns: two-panel layout, page structure, quick-add, filter bar, detail panel, view switcher.
- Code example for quick-add pattern (lines 28-41) is a complete, copy-paste-ready snippet with useState, mutateAsync, toast, and input clear.
- "Data Fetching" section lists every hook and explicitly says "Never call fetch() directly in components."
- "State Management Split" section draws the line: server data in React Query, UI state in Zustand. "Never store server data in Zustand. Never use React Query for ephemeral UI state."

**Upgrade recommendations:**
- No error boundary pattern. DZ-7 across multiple agents says "no error boundaries" but the component patterns rule does not show how to create one. When the project adds them, this rule needs a section.
- No responsive/mobile pattern. The detail panel becomes a Sheet on mobile, but the code example does not show this. Add a responsive pattern section.
- No form validation display pattern. How should Zod validation errors render in the UI? Toast only? Inline field errors? This is undocumented.
- No optimistic update pattern. React Query supports optimistic mutations; when/if Ascend adopts them, this rule needs updating.
- Missing: animation/transition patterns. The CLAUDE.md mentions `canvas-confetti` and "subtle hover states" but the component patterns rule does not specify the animation conventions.

---

#### `mcp-tool-patterns.md` — Grade: A-

**Observations:**
- 121 lines. Covers the full 3-file change workflow: schemas.ts -> handler -> server.ts routing.
- Code examples are complete: JSON Schema definition in `TOOL_DEFINITIONS`, handler with ZodError catch and `McpContent` return type, Set-based routing in server.ts.
- 6 rules: call service layer, McpContent return type, validate with Zod at runtime, userId from server factory, error handling, snake_case naming.
- "Existing Tool Groups" table maps Set constants to handler files to tool names. This is the routing reference.

**Upgrade recommendations:**
- No guidance on tool versioning. When MCP tool schemas change, existing clients may break. How should backward compatibility be handled?
- No guidance on tool documentation strings. The `description` field in TOOL_DEFINITIONS is mentioned but no examples of good vs bad descriptions are shown.
- The `McpContent` type is defined inline in the handler example (lines 12-15). If this type is shared across all handlers, it should be extracted to a shared module. The rule should mention this.

---

### 2.4 Root Framework Documents

#### `CLAUDE.md` (Project Root) — Grade: A-

**Observations:**
- Approximately 200 lines (with @imports). Well-structured: Tech Stack, Commands, Safety Rules, Execution Quality Bar (Ascend), Mandatory Development Workflow, Architecture, Entity Model, Views, Key File Lookup, Danger Zones, Deployment.
- 6 safety rules, each actionable and specific. Safety rule 6 (never run `prisma db push` or `prisma migrate reset`) includes the specific reason (search_vector column) and the consequence (breaks full-text search).
- "Mandatory Development Workflow" section enforces the orchestrator pattern with agent reference table, required workflow steps, and skill reference table. This is the `/devtakeover` pattern executed well.
- "Danger Zones" section documents 6 risks with file paths and impact descriptions.
- @import references to all 5 rule files at the bottom.
- "Execution Quality Bar (Ascend)" extends the global bar with project-specific checks: tsc, build, userId in queries, Zod parsing, cache invalidation, no direct Prisma imports, verify-ui for UI changes, all rules followed. Each is a checkbox.

**Upgrade recommendations:**
- The "Architecture" section describes the current single-codebase structure. When the monorepo split happens, this section needs a complete rewrite. Consider adding a "Current Architecture Scope" header to signal this is a point-in-time description.
- The "Entity Model" table is useful but does not show field-level detail. For a product scaling to 6 months of schema evolution, consider linking to the Prisma schema directly rather than maintaining a duplicate table.
- "Two-Panel Layout" description in the Architecture section overlaps with the `component-patterns.md` rule. This is not a contradiction (they say the same thing), but it is duplication. Consider @importing the component patterns section for the layout description.
- The `fetchJson` duplication is mentioned in Danger Zones but has been there since the initial framework. At some point, documenting a known debt is insufficient; it should be scheduled for resolution.
- No mention of the 10-wave roadmap. The CLAUDE.md should reference the roadmap context so agents understand the product direction.

---

#### `COMPONENT_CATALOG.md` — Grade: A

**Observations:**
- 267 lines. 86 components across 13 directories. Every component has: file path, one-line purpose, "Used by" column, key props.
- Table of Contents with counts per section.
- Dead code explicitly called out: board view components marked "(DEAD)" and listed separately in a "Dead Code" section.
- "Incomplete / Do Not Promote" section flags the offline sync provider as not wired.
- "Known Duplication Risks" section proactively identifies the 4 most likely duplication traps: detail panels, quick-add inputs, filter bars, sortable headers.
- "How to Use This Catalog" section gives 4 concrete steps.

**Upgrade recommendations:**
- No screenshot or visual reference. For a UX-focused product, a visual catalog (even thumbnail-level) would be more useful than text descriptions. This is a "nice to have" for now, a "must have" when the product has multiple platforms with shared design language.
- No version or last-updated timestamp. As the catalog grows, knowing when a component entry was last verified matters.

---

## 3. Cross-Cutting Observations

### Vocabulary Consistency

**Strong.** The following terms are used consistently across all artifacts:
- "safety rule" always means one of the 6 numbered rules from CLAUDE.md
- "danger zone" always means one of the DZ-1 through DZ-7 items
- "service layer" always means const-object services in `lib/services/`
- "click-to-edit" always means the inline editing pattern in detail panels
- "two-panel layout" always means sidebar + main content area
- "cache invalidation" always includes "cross-domain" as a qualifier

**Minor inconsistencies:**
- The reviewer agent uses "DZ-1" through "DZ-7" numbering. The dev agent lists the same items but without numbering. The CLAUDE.md danger zones are also unnumbered. Standardizing on the DZ-N convention everywhere would help.
- `ascend-ux` introduces "DZ-UI-1" through "DZ-UI-4" for UI-specific danger zones without using that label. The zones (no error boundaries, board view dead code, offline sync incomplete, mobile cramped) overlap partially with the dev agent's DZ-6 and DZ-7.

### Agent Description Quality for Auto-Invocation

**Strong.** All four agents have quoted `description` fields with 3 example trigger patterns in the `<example>` format. The descriptions clearly state WHEN to use each agent, which is what the orchestrator needs to route correctly.

**One gap:** No negative routing examples. The descriptions say when TO use each agent but not when NOT to. For example, `ascend-dev`'s description does not say "do NOT use for visual audits." Adding negative examples would reduce misrouting, especially when the forthcoming agents (architect, migration-auditor, security, critic) create more routing decisions.

### Skill Lifecycle Coverage

The current skills cover: planning (`ax:plan`), building (`ax:test`), reviewing (`ax:review`), verifying UI (`ax:verify-ui`), deploying (`ax:deploy-check`), and saving state (`ax:save`).

**Gap: No `ax:continue` skill.** The global CLAUDE.md has a "Continue / Resume" section that reads from `~/.claude/continue-prompts/`. The `ax:save` skill writes to `.ascendflow/sessions/`. These are two different systems. When the user says "continue" at session start, the global system looks in `~/.claude/continue-prompts/`, not `.ascendflow/sessions/`. Either `ax:save` should also write a continue prompt to the global location, or there should be an `ax:continue` skill that reads from `.ascendflow/sessions/`.

**Gap: No `ax:refactor` or `ax:cleanup` skill.** The danger zones document several known debts (fetchJson duplication, no error boundaries, non-transactional todo completion). A dedicated cleanup skill would help schedule and track their resolution.

### Risks Not Currently Covered

| Risk | Severity | Currently Covered? | Suggested Artifact |
|------|----------|--------------------|--------------------|
| Performance regression (bundle size, query perf) | High | No | Rule: `performance-budget.md` + ax:test mode |
| Accessibility violations (WCAG 2.1 AA) | High | Partially (ascend-ux mentions aria-labels) | Agent: `ascend-a11y` or rule: `accessibility.md` |
| Cross-platform UI drift (web vs iOS vs Android) | Critical (post-split) | No | Agent: `ascend-architect` (forthcoming) |
| Migration backfill verification | Medium | No | Agent: `ascend-migration-auditor` (forthcoming) |
| Security beyond userId scoping | High | No | Agent: `ascend-security` (forthcoming) |
| API versioning / backward compatibility | Medium | No | Rule: `api-versioning.md` |
| State management drift (Zustand store growth) | Medium | No | Rule addition to `component-patterns.md` |
| Dependency vulnerability scanning | Medium | No | ax:deploy-check step or hook |
| Log/telemetry standards | Low | No | Rule: `observability.md` |
| i18n/l10n readiness | Medium (for global product) | No | Rule: `i18n.md` |

### Comparison to `/devtakeover`-Level Output

The `/devtakeover` skill produces: 3 audit documents (10KB+ each), 2 synthesis documents, an ecosystem design, CLAUDE.md, 4+ rules files (50+ lines each), 3+ agents (150+ lines each), 5+ skills, COMPONENT_CATALOG.md, working directory, 3 HTML guides (100KB+ each), and a config repo with setup script.

The Ascend framework has: CLAUDE.md (strong), 5 rules (meets the bar), 4 agents (all exceed the 150-line minimum; `ascend-ui-verifier` is 383 lines), 6 skills (all have complete workflows), COMPONENT_CATALOG.md (strong), and `.ascendflow/` working directory with features/sessions/reviews/verification subdirs.

**What is missing vs devtakeover:**
- No HTML visual guides. These are not essential for a solo developer, but for a product targeting "world-class so even Elon Musk and Jensen Huang would want to use it," visual documentation of the architecture and ecosystem would elevate the presentation.
- No config repo / setup script. Ascend's framework lives in the repo itself, not in a portable package. If another developer joins, there is no `setup.sh` to install the Claude Code ecosystem. Low priority for solo work, high priority for team scaling.
- No audit documents. The CLAUDE.md serves as the architecture reference, but the deep ARCHITECTURE.md / PATTERNS.md / DOMAIN_AND_RISKS.md documents that devtakeover produces do not exist. The agents embed this knowledge in their prompts, which works but means there is no single reference document for human onboarding.

### Framework Contradictions

**Explicit contradiction found:**
- `ascend-reviewer.md` has TWO output format templates (lines 30-73 and lines 267-292) that differ in structure. The first uses indented `Rule checks:` / `Danger zone touches:` / `Pattern checks:` subsections; the second uses a flat `Issues:` list. An agent following this file will not know which format to produce.

**Implicit contradiction:**
- `ascend-ux.md` has Write and Edit tools, suggesting it implements code fixes. But `ascend-workflow.md` says "Claude is the orchestrator, not the implementor" and the agent routing table sends implementation to `ascend-dev`. The body text of `ascend-ux` says "Make the code change (or audit the developer's change)" in step 2 of the iteration loop. The intended behavior (ux agent can fix CSS/layout directly) should be explicitly documented in the workflow rule as an exception.

**No contradictions found between:**
- Safety rules (consistent across CLAUDE.md, all agents, and all skills)
- Danger zone definitions (same 7 items in CLAUDE.md, dev, and reviewer)
- Tech stack facts (same versions cited everywhere)

### Does the Framework Scale to 10-Wave Cross-Platform?

**No, in its current form.** The framework is deeply optimized for a single Next.js codebase. Every file path reference, every Grep pattern in the reviewer, every page-to-route mapping in the verifier assumes the current flat structure. When the codebase splits into:

```
packages/
  core/          # Shared business logic, services, validations
  web/           # Next.js web app
  mobile/        # React Native
  desktop/       # Electron or Tauri
  mcp-server/    # MCP tools
```

...approximately 80% of the file path references in agents and rules will break. The forthcoming `ascend-architect` agent can help, but the existing artifacts also need a migration plan.

**Scaling recommendations:**
1. Add a `ARCHITECTURE_SCOPE.md` or section to CLAUDE.md that describes the current structure and the target monorepo structure, so agents can understand both.
2. Use path variables in agents instead of hardcoded paths (e.g., `${SERVICE_DIR}` instead of `lib/services/`). Not literally templated, but add a "Path conventions" section that agents reference.
3. The verifier's file-to-page mapping (Step 1 of `ax:verify-ui`) is hardcoded. Extract it to a config file that can be updated when the structure changes.
4. Rules should be platform-scoped using YAML frontmatter globs. `service-patterns.md` should match `packages/core/**` once the split happens.

---

## 4. Style Patterns Extracted (for New-Artifacts Agent)

### Agent Frontmatter Pattern

```yaml
---
name: ascend-{role}
description: "{one-sentence role}. Use this agent when {trigger conditions}. {tool differentiation from siblings}.\n\n<example>\nuser: \"{request}\"\nassistant: \"{why this agent}\"\n</example>\n\n<example>\nuser: \"{request 2}\"\nassistant: \"{why this agent}\"\n</example>\n\n<example>\nuser: \"{request 3}\"\nassistant: \"{why this agent}\"\n</example>"
model: opus
color: {unique color per agent: indigo, orange, red, cyan; available: green, blue, yellow, magenta}
tools: {read-only: Read, Glob, Grep, Bash | full: Read, Write, Edit, Glob, Grep, Bash, WebFetch | browser: + mcp__playwright__* or mcp__chrome-devtools__*}
---
```

Key: `description` is a QUOTED string with `\n` for newlines and `\"` for inner quotes. Three `<example>` blocks, each with a user request and an assistant explanation of why this agent is the right choice.

### Agent Body Sections (in order)

1. **Identity sentence**: "You are the Ascend {role}." One line.
2. **Quality Bar (Mandatory)**: References both global and project quality bars. Always present.
3. **"Before creating anything new, search the codebase"**: Search-first directive with specific Grep/Glob examples. Always present.
4. **Domain knowledge sections** (varies by agent): Service layer contract, API route contract, React Query contract, etc. Each with code examples from the actual codebase and exact file paths.
5. **Safety Rules**: All 6, reproduced verbatim or referenced by number.
6. **Danger Zones**: All 7 (or relevant subset), with file paths and remediation.
7. **Workflow**: Numbered steps for the agent's primary task (e.g., "Workflow for a New Feature" in dev, "Review Workflow" in reviewer).
8. **Key File Lookup**: Quick-reference table mapping needs to file paths.
9. **Verdict Format** (reviewer/ux only): Exact output template with PASS/FAIL fields.
10. **Communication Style**: 2-3 sentences on tone and what to include in status updates. Always last.

### Skill Frontmatter Pattern

```yaml
---
name: ax:{verb}
description: {one-sentence purpose}. {what it runs}. {when to use it}.
user_invocable: true
---
```

Key: `name` uses `ax:` prefix (2-letter project abbreviation + colon). `description` is an unquoted string (unlike agents). `user_invocable: true` always present.

### Skill Body Sections (in order)

1. **Title**: `# ax:{verb}` matching the frontmatter name.
2. **One-paragraph purpose**: What this skill does and why it exists. If it replaces something missing (like a test suite), say so explicitly.
3. **Execution Quality Bar (read first)**: Present in planning and gating skills (ax:plan, ax:review, ax:deploy-check). References the global and project bars. Includes "Forbidden phrases" list.
4. **When to Use**: Bulleted list of trigger conditions.
5. **When NOT to use** (optional but good): Bulleted list of non-triggers with redirects to the correct skill/agent.
6. **Workflow**: Numbered steps, each with a `### Step N: {name}` header. Bash commands in code blocks. Each step has clear pass/fail criteria.
7. **Output Format**: Exact template showing what the skill produces (report file, verdict, summary).
8. **Rules**: 4-6 bullet rules specific to this skill, starting with the most important.
9. **Edge Cases**: How to handle unusual situations (clean tree, huge diff, server not running).
10. **Related Skills** (optional): Cross-references to skills that pair with this one.
11. **Future** (optional): What the skill should evolve into (e.g., ax:test adding npm test when a suite exists).

### Tone and Density

- **Imperative mood throughout.** "Run tsc. Check the output. If it fails, stop." Not "You should consider running tsc."
- **Dense, no filler.** Average sentence length is short. Every sentence carries information. No "it is important to note that" or "as we discussed earlier."
- **Incident citations.** When a rule exists because of a specific failure, cite the date and what happened: "the 11. 4. 2026 enum-consolidation run" or "the search_vector column was added via raw SQL migration." This grounds rules in reality.
- **Explicit forbidden phrases.** Every gating artifact (reviewer, deploy-check, test, verify-ui) has a "Forbidden phrases" section listing exact words you may not say when conditions are not met, paired with the exact words you must say instead.
- **Code examples are from the actual codebase**, not generic. File paths, function names, type signatures are all real.

### Rule File Pattern

Rules files in this project do NOT use YAML frontmatter (no globs, no description). They are plain Markdown starting with a `#` title. Sections:

1. **Title**: `# {Pattern Name}`
2. **Overview** (optional): One paragraph on what this pattern covers.
3. **Structure/Pattern**: Code example from the actual codebase showing the canonical implementation.
4. **Rules**: Numbered list of constraints, each grounded in why (e.g., "userId in every query. This is the multi-tenant boundary.").
5. **Existing {Entities}**: Table listing all current instances of this pattern with file paths.
6. **Danger Zones / Gotchas** (if applicable): Pattern-specific risks.

---

## 5. Risk Matrix

| Risk | Severity | Current Coverage | Suggested Action |
|------|----------|-----------------|------------------|
| Cross-platform drift after monorepo split | Critical | None | P0: `ascend-architect` agent + update all file paths in existing agents |
| Performance regression (bundle, query, render) | High | None | P1: `performance-budget.md` rule + ax:test bundle mode |
| Accessibility (WCAG 2.1 AA) | High | Minimal (ux agent mentions aria-labels) | P1: `accessibility.md` rule OR extend `ascend-ux` with axe-core checks |
| Security (auth, secrets, CSRF, XSS) | High | userId scoping only | P1: `ascend-security` agent (forthcoming) |
| Migration safety (data backfill, rollback) | Medium | Partial (deploy-check verifies sync) | P1: `ascend-migration-auditor` agent (forthcoming) |
| No test suite (logic regressions) | High | Acknowledged in ax:test | P1: Add Vitest setup + update ax:test |
| Duplicate reviewer output formats | Low | Self-contradicting | P0: Fix `ascend-reviewer.md` to have one format |
| ascend-ux role ambiguity (implement vs audit) | Low | Implicit | P0: Clarify in `ascend-workflow.md` |
| No continue/resume integration between ax:save and global continue system | Medium | Gap | P2: `ax:continue` skill or bridge in `ax:save` |
| API versioning / backward compatibility | Medium | None | P2: `api-versioning.md` rule |
| Dependency vulnerability scanning | Medium | None | P2: npm audit step in ax:deploy-check |
| i18n readiness | Medium (long term) | None | P2: `i18n.md` rule when relevant |
| Observability / logging standards | Low | None | P2: `observability.md` rule |

---

## 6. Recommended Upgrades to Existing Artifacts (Prioritized)

### P0 (Fix before starting wave 2)

1. **`ascend-reviewer.md`: Remove duplicate output format.** Lines 30-73 and lines 267-292 define two different verdict structures. Keep the first (more detailed, with explicit Rule checks / Danger zone touches / Pattern checks subsections). Delete the second. This is a direct contradiction that confuses the reviewer agent.

2. **`ascend-workflow.md`: Expand from 58 lines to 120+.** Add: (a) when `ascend-ux` is permitted to implement code vs when it should hand off to `ascend-dev`, (b) example of a cross-surface feature and how to parallelize agents, (c) how to handle agent disagreements, (d) when to re-route if initial routing was wrong, (e) negative routing examples for each agent.

3. **`ascend-dev.md`: Fix `cache-config.ts` path.** Line 200 says `lib/queries/cache-config.ts (may not exist yet; check before importing)`. The CLAUDE.md says `lib/offline/cache-config.ts`. Verify the actual path and fix.

4. **Standardize danger zone numbering.** Use DZ-1 through DZ-7 consistently in CLAUDE.md, `ascend-dev.md`, and `ascend-reviewer.md`. Use DZ-UI-1 through DZ-UI-4 in `ascend-ux.md` for UI-specific zones.

### P1 (Complete during wave 2)

5. **`ax:test`: Add lint step and bundle size check.** Add `npm run lint` as a default step (after tsc, before build). Add `ax:test bundle` mode that reports `.next/` output sizes and flags regressions above a threshold.

6. **`component-patterns.md`: Add error boundary pattern, responsive/mobile pattern, form validation display pattern.** These are the three biggest gaps in component guidance. Each needs a code example from the codebase or a to-be-created reference implementation.

7. **`service-patterns.md`: Add transaction pattern and pagination pattern.** DZ-1 is about non-transactional operations; the service patterns rule should show how to use `prisma.$transaction()`. Pagination is needed for scaling.

8. **`ax:save`: Auto-capture recent verification and review results.** In Step 1 (gather context), add: `ls .ascendflow/verification/*.md | tail -1` and `ls .ascendflow/reviews/*.md | tail -1`. Include the most recent report path in the session file automatically.

9. **`api-route-patterns.md`: Add rate limiting note and streaming response pattern.** Even as TODO items, these signal to the dev agent that they need attention.

10. **All agents: Add "Codebase scope" header.** One sentence: "This agent's file paths reference the current single-codebase structure at /Users/Shared/Domain/Code/Personal/ascend. If the codebase has been split into a monorepo, update the paths below." This makes the transition point explicit.

### P2 (During waves 3-5)

11. **Create `accessibility.md` rule** with WCAG 2.1 AA requirements scoped to `components/**/*.tsx`.

12. **Create `performance-budget.md` rule** with bundle size limits, query count limits per page load, and render time targets.

13. **Create `ax:continue` skill** that reads from `.ascendflow/sessions/`, or update `ax:save` to also write a continue prompt to `~/.claude/continue-prompts/`.

14. **`ax:plan` PRD template: Add "Platform impact" and "Wave/roadmap context" sections.**

15. **`ascend-ui-verifier.md`: Add `--mobile` flag** for mobile viewport verification (375x812).

---

## 7. Final Recommendation

### Do the 4 proposed agents + 6 proposed skills cover the gaps?

**Largely yes, with caveats.**

| Proposed Artifact | Gap It Addresses | Sufficient? |
|-------------------|-----------------|-------------|
| `ascend-architect` | Cross-platform, monorepo, package coordination | Yes, if it also updates existing agent file paths |
| `ascend-migration-auditor` | Prisma migration safety, backfill verification | Yes |
| `ascend-security` | Auth, multi-tenancy, secrets, XSS/CSRF | Yes |
| `ascend-critic` | Product strategy, world-class bar enforcement | Unique value; no existing artifact covers this |
| `ax-migrate` | Migration workflow (create, test, deploy) | Yes |
| `ax-package` | Package management in monorepo | Yes, fills a gap ax:test/ax:deploy-check cannot |
| `ax-cross-platform-check` | UI/logic consistency across platforms | Yes, critical for post-split |
| `ax-wave-start` | Roadmap phase kickoff, dependency checking | Yes, fills the roadmap gap in ax:plan |
| `ax-wave-close` | Roadmap phase completion, readiness audit | Yes, mirrors ax:deploy-check at wave level |
| `ax-critique` | Challenge assumptions, prevent mediocrity | Pairs with ascend-critic; both are valuable |

### What else would I add?

1. **`ascend-a11y` agent or `accessibility.md` rule (P1).** The proposed agents do not include an accessibility specialist. For a product targeting Jensen Huang's bar, WCAG 2.1 AA compliance is not optional.

2. **`ax:test` evolution to include Vitest (P1).** The proposed additions do not replace the need for an actual test suite. `ax:test` should evolve from "tsc + build" to "test + tsc + build."

3. **`observability.md` rule (P2).** As the product scales across platforms, structured logging and error reporting standards become essential. No proposed artifact covers this.

4. **Update plan for existing artifacts (P0).** The 4 new agents and 6 new skills will increase routing complexity. The existing `ascend-workflow.md` (currently 58 lines) must be expanded to include routing decisions for 8 agents and 12 skills. This update should happen simultaneously with the new artifact creation, not after.

### Bottom Line

The framework is a B+ today, which is excellent for a 3-month-old single-user web app. It is not yet at the SpaceX bar for a 10-wave, cross-platform, AI-native product. The gaps are clear, the fixes are concrete, and the proposed additions (4 agents + 6 skills) are well-targeted. Execute the P0 fixes first (especially the reviewer duplicate format and workflow rule expansion), then bring the new artifacts online, and the framework will be ready to support the scale the roadmap demands.

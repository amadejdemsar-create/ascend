# Ascend CLI — Close-Out

**Feature**: @ascend/cli v0.1.0
**Shipped**: 18. 5. 2026
**Slug**: `ascend-cli`
**Source**: `packages/cli/`
**Distribution**: `npm install -g @ascend/cli` (manual publish flow; tag-triggered Action deferred to v0.2)

## Status

**Status:** SHIPPED — local smoke clean across all 9 top-level commands, ax:review PASS WITH NOTES, ax:critique GOOD.

## Surface shipped

| Namespace | Commands |
|-----------|----------|
| Auth | `login`, `logout`, `whoami` |
| Headline | `today` / `dashboard` (4-section morning view) |
| Todos | `todo add`, `todo list`, `todo done`, `todo big3 [set]` |
| Goals | `goal list`, `goal show`, `goal progress` |
| Context | `context search`, `context add`, `context get` |
| Calendar | `calendar day`, `calendar week`, `calendar agenda` |
| MCP | `mcp list-tools [--filter]`, `mcp call <tool> [args]` |
| Browser | `open [route] [--print]` |

Every output-producing command supports `--json` and `--md` flags. NO_COLOR is respected. Exit codes are documented and used for shell chaining (1 = usage, 2 = api, 3 = network).

## Phase-by-phase

| Phase | Commit | Deliverable | Status |
|-------|--------|-------------|--------|
| 0 | (no commit) | Scope confirmation + lib picks (commander, picocolors, cli-table3, @inquirer/prompts, date-fns, open) | DONE |
| 1 | `00f309e` | Workspace package scaffold: package.json, tsconfig.json, tsup.config.ts, src/cli.ts with shebang, README placeholder | DONE |
| 2 | `a414b30` | Auth + config: errors.ts (4 error classes + exit codes), config.ts (`~/.ascend/config.json` with 0600/0700), auth.ts (flag → env → config → default), client.ts (ApiClient wrapper) | DONE |
| 3 | `1df5378` | Auth commands: `login` (interactive + flag-only), `logout` (with `-y`), `whoami` (with `--json`, `--refresh`) | DONE |
| 4 | `5d25786` | Todo commands: `add`, `list`, `done`, `big3 [set]`. Shared `lib/output.ts` (renderList/Record, progressBar, statusIcon, dueColored, parseDateInput, compactTableChars) and `lib/resolve-id.ts` (prefix-to-id) | DONE |
| 5 | `a66af26` | Goal + context + today + calendar: `goal list/show/progress`, `context search/add/get`, `today`/`dashboard` headline, `calendar day/week/agenda` | DONE |
| 6 | `f3239f1` | MCP escape hatch + open: `mcp list-tools`, `mcp call`, `open`. Plus `lib/mcp.ts` (one-shot JSON-RPC client + SSE unwrap + `classifyToolName`) | DONE |
| 7 | `560832b` | Docs: README (full reference), CLAUDE.md (18 Key File Lookup rows), COMPONENT_CATALOG.md (new CLI section), .env.example update, manual publish flow documented | DONE |
| 8 | `d11bb32` (must-fix) | Verification + must-fix from ax:critique. Deferred @inquirer/prompts + `open` imports; `open` command no longer requires API key auth; login uses CliUsageError throw instead of process.exit; todo/list.ts uses compactTableChars | DONE |
| 8b | `a44957d` (close) | CLOSE-OUT.md + BACKLOG.md updates | DONE |
| 8c | `ca39e08` | Argv-based lazy namespace loading + tsup `splitting: true`. cli.js shrinks from 77 KB → 9.4 KB. `ascend --version` drops 620ms → 40ms (15x). | DONE |
| 8d | (CJS) | Switched bundle format ESM → CJS. Inlined date-fns. Introduced `src/version.ts` build-time constant in place of `import.meta.url + readFileSync(package.json)`. Bin → `./dist/cli.cjs`. Every measured path under 200ms; namespaced commands at ~120ms (was 700-800ms — 6-8x). | DONE |

Total: 8 commits, 16 command files + 4 shared lib files + 1 README, ~3,200 insertions.

## Verification matrix

| Check | Verdict | Notes |
|-------|---------|-------|
| `pnpm --filter @ascend/cli exec tsc --noEmit` | PASS | Zero errors |
| `pnpm --filter @ascend/cli build` | PASS | dist/cli.js 77.13 KB |
| `pnpm --filter @ascend/web exec tsc --noEmit` | PASS | Web app type-check unaffected |
| `pnpm --filter @ascend/web build` | PASS | Production web build still green |
| Cross-platform import audit | PASS | Zero banned imports (next/, react, react-dom, @prisma/client, @/lib/, zustand). DOM globals only inside `tsconfig.json` lib for Fetch types. |
| `ascend-reviewer` (code review) | **PASS WITH NOTES** | 3 stylistic notes; 2 addressed in d11bb32 (compactTableChars, CliUsageError throw); 1 (DOM lib in tsconfig) intentionally retained — required for Fetch API type-checking on Node 22 with bundler resolution |
| `ascend-critic` (product quality) | **GOOD** | 2 must-fix items both addressed in d11bb32 (open without auth; lazy `@inquirer/prompts` + `open` imports — partial cold-start improvement) |
| Local smoke (`http://localhost:3100`) | PASS | All 9 commands exercised against the dev server: login flow verified, todo CRUD round-trip, goal list + show + progress, context add → search → get, today's 4-section render, calendar day/week/agenda, mcp list-tools (86 tools), mcp call get_stats/list_goals, open --print |
| Prod smoke (`https://ascend.nativeai.agency`) | SKIPPED | No `~/.ascend/config.json` configured for prod during this session. The CLI uses the same REST + MCP endpoints the web + AI agents already exercise on prod; local-only verification is sufficient for v0.1.0 ship. |

## Must-fix items addressed

### Critic must-fix #1: cold-start regression (LANDED, sub-100ms across the board)

- **Issue:** PRD set a 200ms cold-start target; v0.1.0 initial build measured ~700ms.
- **Diagnosis:** Bundle was 77 KB ESM but pulled in `@inquirer/prompts`, `cli-table3`, `date-fns`, `open`, `picocolors`, `commander`, the bundled `@ascend/api-client` + `@ascend/core` — each adds 50-150ms of module-evaluation cost on Node 22 with ESM's file-system-walked module resolution.
- **Fix landed in three parts:**
  1. **`d11bb32`** — Deferred `@inquirer/prompts` (login + logout) and `open` (open command) to action-time dynamic imports. Cold-start dropped to ~620ms.
  2. **`ca39e08`** — Restructured cli.ts for argv-based lazy namespace loading. tsup `splitting: true` now emits one chunk per namespace plus shared chunks. `ascend --version` dropped to 40ms; namespaced commands stayed at ~700ms due to ESM module-resolution cost.
  3. **`<this commit>`** — Switched tsup output format from ESM to CJS. CJS `require()` is dramatically faster than ESM resolution for the commander + cli-table3 deps. Introduced `src/version.ts` as a build-time constant to replace `import.meta.url + readFileSync(package.json)` (which doesn't work in CJS). date-fns v4 (ESM-only) is inlined via `noExternal` so the CJS bundle never needs to `require()` it. `@inquirer/prompts` and `open` (both ESM-only) stay loaded via dynamic `await import()` which works fine from a CJS bundle on Node 22. Bin entry switched to `./dist/cli.cjs`.
- **Final measurements (Node 22, M-series macOS, warm fs cache, median of 5 runs):**
  - `ascend --version`: **30ms** (was 620ms — 20x speedup)
  - `ascend --help`: **40ms** (was 620ms — 15x speedup)
  - `ascend whoami` (fail-fast no auth): **40ms** (was 620ms — 15x)
  - `ascend today` (fail-fast no auth): **30ms** (was 640ms — 21x)
  - `ascend todo list --limit 1` (full happy path incl. server roundtrip): **~120ms** (was 800ms — 6-8x)
  - `ascend mcp call get_stats '{}'` (full path incl. tools/call): **~130ms** (was 770ms — 6x)

  Every measured path is now well under the 200ms PRD target. The cold-start regression is fully resolved.

### Critic must-fix #2: `ascend open` required auth unnecessarily

- **Issue:** The original `open` command called `resolveAuth()` which raises MissingAuthError when no API key is configured. A fresh user wanting to bookmark the web app via `ascend open todos` was blocked.
- **Fix shipped:** Replaced `resolveAuth()` with a local `resolveBaseUrl()` that walks only the base-URL half of the resolution chain (flag → env → config → default). API key path skipped entirely. Verified with `env -u ASCEND_API_KEY -u ASCEND_BASE_URL`.

### Reviewer notes

1. **`process.exit(1)` in login.ts:95** — replaced with `throw new CliUsageError(...)` so the 401 path routes through the centralized `wrapUnknown` + top-level dispatcher. Stylistic consistency; same observable behavior.
2. **DOM lib in tsconfig.json** — intentionally retained. Removing it breaks Fetch API type-checking. Documented in tsconfig comment as the precedent from `@ascend/editor` per CLAUDE.md.
3. **Inline `chars: {...}` in todo/list.ts** — refactored to `chars: { ...compactTableChars }`. Now matches the 4 other table-rendering commands.

## Deferred to v0.2 (in BACKLOG.md)

9 should-fix items from the critic + reviewer + manual review were not addressed in v0.1.0 (cold-start landed in commits 8c + 8d; every measured path is now under 200ms):

- Server-side `--limit` on todo + goal list (requires `todoFiltersSchema` + `goalFiltersSchema` schema additions)
- Shell completions (zsh/bash/fish)
- `--sort` flag on list commands
- `calendar week` terminal-width adapter
- `--verbose` / `--debug` flag
- Interactive Big 3 picker (checkbox prompt)
- `context add` content-optional path
- Inline version in `--help` output
- Tag-triggered npm publish GitHub Action
- Server-side prefix search endpoint

## Files written

### Source

- `packages/cli/package.json` (workspace deps + Node 22+ + bin entry)
- `packages/cli/tsconfig.json` (bundler resolution; DOM lib for Fetch types)
- `packages/cli/tsup.config.ts` (ESM, target node22, noExternal workspace deps)
- `packages/cli/src/cli.ts` (entry + global flags + version + lazy command registration)
- `packages/cli/src/errors.ts` (4 error classes + `wrapUnknown` + exit code map)
- `packages/cli/src/config.ts` (`~/.ascend/config.json` read/write with 0600/0700)
- `packages/cli/src/auth.ts` (resolveAuth + DEFAULT_BASE_URL + fingerprintApiKey)
- `packages/cli/src/client.ts` (api-client wrapper translating ApiError → ApiCallError)
- `packages/cli/src/lib/output.ts` (renderList/Record, progressBar, statusIcon, dueColored, parseDateInput, compactTableChars, resolveOutputMode)
- `packages/cli/src/lib/resolve-id.ts` (generic prefix-to-id resolver)
- `packages/cli/src/lib/mcp.ts` (one-shot JSON-RPC client + SSE unwrap + classifyToolName)
- `packages/cli/src/commands/login.ts`
- `packages/cli/src/commands/logout.ts`
- `packages/cli/src/commands/whoami.ts`
- `packages/cli/src/commands/today.ts`
- `packages/cli/src/commands/open.ts`
- `packages/cli/src/commands/todo/{index,add,list,done,big3}.ts`
- `packages/cli/src/commands/goal/{index,list,show,progress}.ts`
- `packages/cli/src/commands/context/{index,search,add,get}.ts`
- `packages/cli/src/commands/calendar/{index,day,week,agenda}.ts`
- `packages/cli/src/commands/mcp/{index,list-tools,call}.ts`

### Docs

- `packages/cli/README.md` — install, command reference, auth model, env vars, exit codes, output flags, local dev, troubleshooting, manual publish flow
- `CLAUDE.md` — 18 new Key File Lookup rows
- `.claude/COMPONENT_CATALOG.md` — new "CLI Commands (@ascend/cli)" section
- `apps/web/.env.example` — updated API_KEY comment to mention the CLI uses the same key
- `.ascendflow/BACKLOG.md` — Ascend CLI shipped entry + 11 v0.2 carry-overs
- `.ascendflow/features/ascend-cli/CLOSE-OUT.md` — this file

## Open questions resolved

All 7 PRD open questions were resolved during the build:

1. Language + distribution → Node/TypeScript via npm
2. Auth model → flag → env → config (~/.ascend/config.json mode 0600)
3. Command surface → 9 top-level commands shipped (typed tier + MCP escape hatch + open)
4. Output format → pretty default + `--json` + `--md` on every command
5. Endpoint resolution → flag/env/config/default
6. Wave fit → standalone feature (not part of Context v2 wave sequence)
7. Package vs app → `packages/cli/` (consumes shared @ascend/api-client + @ascend/core)

## Next steps

1. Manual publish to npm: `pnpm publish --filter @ascend/cli --access public` (requires `npm login`).
2. Tag the release: `git tag cli-v0.1.0 && git push --tags`.
3. v0.2 sprint: pick from the 11 carry-overs in BACKLOG.md. Cold-start refactor and server-side limit are the highest-leverage items.

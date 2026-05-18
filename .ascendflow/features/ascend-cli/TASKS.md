# Implementation Tasks: Ascend CLI (`@ascend/cli`)

Order matters. Each task references actual files. 4-5 working day target.

---

## Phase 0: Scope confirmation + lib picks (Day 1, AM)

- [ ] Re-read PRD.md end to end. Resolve the 7 Open Questions (or accept defaults).
- [ ] Confirm CLI lib choices: `commander` + `picocolors` + `cli-table3` + `@inquirer/prompts` + `date-fns` (already in monorepo) + `open` (cross-platform launcher).
- [ ] Decide on cold-start budget verification approach (manual `time ascend --help` is enough for v1; defer benchmark suite to v2).

## Phase 1: Workspace package scaffold (Day 1, PM)

- [ ] Run `ax:package cli` skill (or manually scaffold). Creates `packages/cli/` with:
  - `package.json` (name `@ascend/cli`, version `0.1.0`, `bin: { ascend: "./dist/cli.js" }`, `type: module`, `engines: { node: ">=22" }`, dependencies on the 5 libs above + `@ascend/api-client` + `@ascend/core` via workspace protocol).
  - `tsconfig.json` extends `../../tsconfig.base.json`, `outDir: ./dist`, `rootDir: ./src`, target ES2022, module NodeNext.
  - `src/cli.ts` shebang `#!/usr/bin/env node` + minimal commander setup with `--version`.
  - `README.md` placeholder.
- [ ] Add `@ascend/cli` to `pnpm-workspace.yaml` if not auto-included via `packages/*`.
- [ ] Run `pnpm install` from repo root to wire workspace links.
- [ ] Verify scaffold: `pnpm --filter @ascend/cli build` produces `dist/cli.js` with executable bit; `node packages/cli/dist/cli.js --version` prints `0.1.0`.
- [ ] Delegate to `ascend-architect` agent: confirm `packages/cli/` has zero banned imports (no `next/*`, no `react`, no `@prisma/client`, no `@/lib/*`).

## Phase 2: Auth + config (Day 1, late PM)

- [ ] Create `packages/cli/src/config.ts` exporting `loadConfig`, `saveConfig`, `clearConfig`:
  - `loadConfig()` reads `~/.ascend/config.json`, returns `{ apiKey, baseUrl, workspaceId? } | null`.
  - `saveConfig(cfg)` writes with `0600` permission, creates `~/.ascend/` with `0700` if missing.
  - `clearConfig()` deletes the file.
- [ ] Create `packages/cli/src/auth.ts` exporting `resolveAuth({ flagApiKey?, flagBaseUrl? })`:
  - Returns `{ apiKey, baseUrl }`.
  - apiKey resolution: flag → `ASCEND_API_KEY` env → config file → null. Null path throws a friendly `MissingAuthError`.
  - baseUrl resolution: flag → `ASCEND_BASE_URL` env → config file → hardcoded default.
- [ ] Create `packages/cli/src/client.ts` exporting `makeClient(authResolved)`:
  - Wraps `createApiClient({ baseUrl, getAuthHeaders })` from `@ascend/api-client`. `getAuthHeaders` returns `{ Authorization: \`Bearer ${apiKey}\` }`.
  - Returns the typed client.
- [ ] Create `packages/cli/src/errors.ts` with `MissingAuthError`, `ApiCallError`, etc. Each maps to an exit code (1, 2, 3 per PRD).

## Phase 3: Auth commands (Day 2, AM)

- [ ] Create `packages/cli/src/commands/login.ts`:
  - Prompts for API key via `@inquirer/prompts` `password` type (input hidden).
  - Optionally prompts for base URL with the default pre-filled.
  - Calls `GET /api/auth/me` with the entered key to validate.
  - On success: writes `~/.ascend/config.json` and prints "Logged in as <email> on <baseUrl>."
  - On 401: prints "Invalid API key" and exits 1.
- [ ] Create `packages/cli/src/commands/logout.ts`:
  - Confirmation prompt ("This will delete ~/.ascend/config.json. Continue?").
  - Calls `clearConfig()`. Prints "Logged out."
- [ ] Create `packages/cli/src/commands/whoami.ts`:
  - Calls `GET /api/auth/me` + `GET /api/workspaces`.
  - Pretty output: user email, default workspace name, endpoint, api-key fingerprint (first 8 + last 4 chars, never the full key).
- [ ] Register all 3 commands in `src/cli.ts` via `commander`.

## Phase 4: Todo commands (Day 2, PM)

- [ ] Create `packages/cli/src/commands/todo/add.ts`:
  - Args: `<title>`. Flags: `--due <date>` (parsed via `date-fns` parseISO or natural-language patterns like "tomorrow"), `--horizon <h>`, `--big3`, `--category <id>`, `--json`, `--md`.
  - Calls `POST /api/todos` with `createTodoSchema`-shaped body. Imports the schema type from `@ascend/core`.
  - Pretty output: `✓ Created todo "<title>" · due in 2 days · #weekly`. JSON: returns the API response verbatim.
- [ ] Create `packages/cli/src/commands/todo/list.ts`:
  - Flags: `--status pending|done|skipped`, `--horizon <h>`, `--limit <n>`, `--json`, `--md`.
  - Calls `GET /api/todos` with query params.
  - Pretty: `cli-table3` with columns: status icon, title (truncated to 60 chars), due (relative), horizon, category badge.
- [ ] Create `packages/cli/src/commands/todo/done.ts`:
  - Args: `<id-or-prefix>`. Calls `POST /api/todos/<id>/complete` after resolving the prefix via a list query if needed.
  - Pretty output: `🎉 Done: "<title>"`. Respects `NO_COLOR`.
- [ ] Create `packages/cli/src/commands/todo/big3.ts`:
  - Calls `GET /api/todos/big3`. Renders 3 todos with status icons + titles.
- [ ] Create `packages/cli/src/commands/todo/index.ts` aggregating all 4 subcommands and exporting `registerTodoCommands(program)`.
- [ ] Wire `registerTodoCommands` into `src/cli.ts`.

## Phase 5: Goal + Context + Today + Calendar commands (Day 3)

- [ ] Create `packages/cli/src/commands/goal/{list,show,progress,index}.ts`:
  - `list`: `GET /api/goals` + filter flags. Pretty output: table with 8-char progress bar (`█████░░░ 60%`).
  - `show`: `GET /api/goals/<id>`. Section layout: title, description, SMART fields, progress bar, deadline, children count.
  - `progress`: `POST /api/goals/<id>/progress` with `{ value: <number> }`. Pretty output: "Progress updated: 45 → 60 (60%)".
- [ ] Create `packages/cli/src/commands/context/{search,add,get,index}.ts`:
  - `search`: `GET /api/context/search?q=...&mode=hybrid`. Pretty output: per-row title + 2-line snippet + match-via badge (text/semantic/both) + score.
  - `add`: `POST /api/context` with `createContextSchema`-shaped body. Returns short id prefix for piping.
  - `get`: `GET /api/context/<id>`. Pretty output: title + tags + type badge + body (extractedText preferred, falling back to legacy markdown).
- [ ] Create `packages/cli/src/commands/today.ts` (aliased as `dashboard`):
  - Calls `GET /api/dashboard` + `GET /api/calendar/agenda?day=today` in parallel.
  - Renders 4 sections in a compact 1-screen layout:
    - **Big 3** with status icons
    - **Today's agenda** (todos due + goals deadlining today)
    - **Current priorities** (next 5 from dashboard)
    - **Streaks + XP** (current streak, weekly XP, level)
- [ ] Create `packages/cli/src/commands/calendar/{day,week,agenda,index}.ts`:
  - `day --date YYYY-MM-DD`: hourly timeline.
  - `week --start YYYY-MM-DD`: 7-column Monday-first grid (per global locale rules).
  - `agenda --days N`: flat list of upcoming todos + goal deadlines.

## Phase 6: MCP escape hatch + open + output formatting (Day 4, AM)

- [ ] Create `packages/cli/src/commands/mcp/list-tools.ts`:
  - Calls `POST /api/mcp` with `{ jsonrpc: "2.0", id: 1, method: "tools/list" }`. `Accept: application/json, text/event-stream`.
  - Pretty output: 3-column table (name, description trimmed to 60 chars, source: native or federated:<slug>).
  - `--filter <substring>` for grep-like filtering.
- [ ] Create `packages/cli/src/commands/mcp/call.ts`:
  - Args: `<tool-name> [<args-json>]`. Default args = `{}`.
  - Calls `POST /api/mcp` with `tools/call` envelope.
  - Pretty output: prints the result.content[0].text (the MCP convention). `--json` for the raw envelope.
  - Exit 2 if `result.isError === true`.
- [ ] Create `packages/cli/src/commands/open.ts`:
  - Args: optional `<route>`. Resolves to `${baseUrl}/${route}` or just `baseUrl`.
  - Uses the `open` package (npm).
  - Pretty output: "Opening https://...".
- [ ] Create `packages/cli/src/lib/output.ts` exporting `renderTable`, `renderJson`, `renderMarkdown`, `formatDate` helpers. Single source of truth for output format flags.
- [ ] Audit all commands to use the output lib. No ad-hoc `console.log` in command files.

## Phase 7: Documentation + dist polish (Day 4, PM)

- [ ] Write `packages/cli/README.md`:
  - Install: `npm install -g @ascend/cli`.
  - Quick start: `ascend login`, `ascend today`.
  - Command reference: every subcommand with example invocations.
  - Auth model: env var vs config file. Discourage the inline-env-var-in-shell-history pattern. Recommend `ascend login`.
  - Environment variables table: `ASCEND_API_KEY`, `ASCEND_BASE_URL`, `NO_COLOR`.
  - Exit codes table.
  - Output flags table (`--json`, `--md`, `--pretty` (default)).
  - Local dev: `ASCEND_BASE_URL=http://localhost:3100 ascend today`.
  - Troubleshooting: common errors + fixes.
- [ ] Add a `Key File Lookup` row to the project CLAUDE.md pointing at the CLI for future-developer discoverability.
- [ ] Update `.claude/COMPONENT_CATALOG.md` with a new "CLI commands (Wave 11)" section listing every command file.
- [ ] Add `apps/web/.env.example` row documenting that `ASCEND_API_KEY` is the same key as the web's `User.apiKey`.
- [ ] Decide npm publish workflow: tag-triggered GitHub Action (recommended) vs manual `pnpm publish --filter @ascend/cli`. If GitHub Action: write `.github/workflows/cli-publish.yml`. Else: document the manual flow in README.

## Phase 8: Verification (Day 5)

- [ ] Run `pnpm --filter @ascend/cli exec tsc --noEmit` — zero errors.
- [ ] Run `pnpm --filter @ascend/cli build` — emits `dist/cli.js` with shebang and executable bit.
- [ ] Run `pnpm --filter @ascend/web exec tsc --noEmit` — sanity check that adding `packages/cli` did not break the web app type-check.
- [ ] Run `pnpm --filter @ascend/web build` — production build still passes.
- [ ] Run `ax:review` — safety rules + pattern compliance.
- [ ] Run `ax:cross-platform-check` to verify `packages/cli/` has zero banned imports.
- [ ] Smoke test against local dev (with `ASCEND_BASE_URL=http://localhost:3100`):
  - `ascend login` writes config.
  - `ascend whoami` shows correct user.
  - `ascend today` renders the 4-section dashboard.
  - `ascend todo add "test"` then `ascend todo list` shows the new todo.
  - `ascend todo done <id>` completes it.
  - `ascend context search "test"` returns matches.
  - `ascend mcp list-tools` shows 86+ tools.
  - `ascend mcp call get_dashboard '{}'` returns a result.
  - `ascend open todos` launches the web app at /todos.
  - `ASCEND_API_KEY=...` env override works.
  - `--api-key ...` flag override works.
  - `--json` flag pipes valid JSON into `jq`.
  - `--md` flag produces clean markdown.
  - `NO_COLOR=1 ascend today` outputs without ANSI escapes.
- [ ] Smoke test against prod (`https://ascend.nativeai.agency`):
  - Same `ascend today`, `ascend todo list`, `ascend mcp list-tools` sanity checks.
- [ ] Run `ax:critique` — target verdict GOOD or WORLD-CLASS.
- [ ] Update `.ascendflow/BACKLOG.md` — mark Ascend CLI as SHIPPED.
- [ ] Write `.ascendflow/features/ascend-cli/CLOSE-OUT.md` per the Wave 9 / Wave 10 close-out structure.
- [ ] Run `ax:deploy-check`. Push to main; no Dokploy redeploy needed (no `apps/web` change). Optionally publish to npm via `pnpm publish --filter @ascend/cli` (or trigger the GitHub Action).
- [ ] Verify `npm install -g @ascend/cli@0.1.0` works from a clean shell on macOS.

---

## Notes

- **Reuse, don't re-implement.** Every HTTP call MUST go through `@ascend/api-client`. Every input MUST validate via a `@ascend/core` Zod schema. The CLI is a thin presentation layer; business logic stays on the server.
- **Cold start matters.** Lazy-import command modules in `cli.ts` (dynamic `import("./commands/todo")`) so `ascend --help` doesn't pay the cost of loading every domain. The 200ms cold-start target requires this discipline.
- **TTY detection.** `process.stdout.isTTY` controls color + interactive prompts. Piped runs (`ascend todo list | wc -l`) get plain output even without `NO_COLOR`.
- **No telemetry.** v1 ships zero analytics / phone-home. Add explicitly opt-in telemetry in v2 if needed.
- **`@ascend/cli` is the npm name. The binary is `ascend`.** Standard separation.
- **Don't ship a `Dockerfile`.** The CLI is a user tool, not a service. If we want a docker image later, add `Dockerfile.cli` separately.
- **Future commands to defer to v2** (out of scope for this PRD): focus session control, category management, settings (AI provider switch, daily cost cap), workspace switching, calendar full grid with all-day events, version history listing, branch / restore. All available via `ascend mcp call ...` until then.

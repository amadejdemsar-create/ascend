# Ascend CLI (`@ascend/cli`)

**Slug:** `ascend-cli`
**Created:** 18. 5. 2026
**Status:** planning
**Sizing:** 4-5 working days (v1 covers a full typed-command surface plus a generic MCP escape hatch).
**Wave fit:** standalone polish feature, not part of the Context v2 wave sequence. Sits alongside Wave 10's federation work as the third surface (web UI + MCP server + CLI).

## Problem

Ascend has two surfaces today: a Next.js web app for humans and an MCP server for AI agents. Daily friction shows up when the user wants quick reads or writes from the terminal: "add a todo," "what's on the agenda today," "search context for X," "show me my Big 3." Opening the browser breaks the flow; invoking the MCP endpoint manually via `curl` requires building JSON-RPC envelopes by hand. There is no scriptable, ergonomic terminal interface despite the fact that every domain (goals, todos, context, dashboard, calendar, MCP) is already exposed via stable HTTP routes.

This wave introduces `@ascend/cli`, a Node/TypeScript CLI shipped on npm as `@ascend/cli` and runnable as `ascend`. It wraps the existing REST + MCP surfaces, ships typed commands for the high-value workflows (todo, goal, context, dashboard, calendar), and surfaces all 86 native + N federated MCP tools through a generic `ascend mcp call` escape hatch. Output defaults to pretty terminal tables with colored badges + relative dates; `--json` and `--md` switch to scriptable formats.

The CLI also lets Amadej drive Ascend from inside other CLIs (Claude Code, Cursor, scripts, cron) without opening a browser, and makes hybrid flows like "log a todo, open the goal it belongs to in the web" trivial via `ascend open`.

## User Story

As an Ascend user at the terminal, I want to:
- Capture a todo or context entry without opening the browser (`ascend todo add "..."`, `ascend context add "..." --tags work`).
- See my Big 3 + today's agenda in one terminal view (`ascend today`).
- Search my knowledge base from the terminal (`ascend context search "..."`).
- Pipe Ascend data into other tools (`ascend todo list --json | jq '.[].title'`).
- Paste a markdown digest into notes (`ascend goal list --horizon weekly --md`).
- Invoke any MCP tool when typed commands don't cover the case yet (`ascend mcp call create_typed_link '{"from":"...","to":"...","type":"REFERENCES"}'`).
- Jump from terminal to web view of a specific entity (`ascend open /goals/<id>`).

## Success Criteria

### Functional

- [ ] **New workspace package `packages/cli/`.** TypeScript, ESM, ships as `@ascend/cli` on npm. Entry point `dist/cli.js` with shebang. `bin` field in package.json maps `ascend` → `dist/cli.js`. Build via `tsc` (matches other shared packages); no bundler.
- [ ] **Reuses `@ascend/api-client` and `@ascend/core`.** The CLI never re-implements HTTP plumbing or Zod schemas; it imports from the existing shared packages so a Wave 11 schema change automatically flows through. `createApiClient({ baseUrl, getAuthHeaders })` from `packages/api-client/src/client.ts` is the canonical HTTP entry.
- [ ] **Auth resolution order.** Resolve API key from (1) `--api-key <key>` flag, (2) `ASCEND_API_KEY` env var, (3) `~/.ascend/config.json`. First match wins. If none, print a friendly error pointing to `ascend login`.
- [ ] **Endpoint resolution order.** Resolve base URL from (1) `--base-url <url>` flag, (2) `ASCEND_BASE_URL` env, (3) `~/.ascend/config.json` `.baseUrl`, (4) hard-coded default `https://ascend.nativeai.agency`. Localhost development uses `ASCEND_BASE_URL=http://localhost:3100`.
- [ ] **Auth commands (3):** `ascend login`, `ascend logout`, `ascend whoami`.
  - `ascend login` prompts for API key (paste from clipboard supported via stdin), validates by calling `GET /api/auth/me`, writes `~/.ascend/config.json` with `{ apiKey, baseUrl, savedAt }`. Permission set to `0600`.
  - `ascend logout` deletes `~/.ascend/config.json` after confirm.
  - `ascend whoami` calls `GET /api/auth/me` + `GET /api/workspaces` and prints user email, workspace name, endpoint, key fingerprint.
- [ ] **Todo commands (4):** `ascend todo add`, `list`, `done`, `big3`.
  - `ascend todo add "<title>" [--due <date>] [--horizon WEEKLY|...] [--big3] [--category <id>]`. Calls `POST /api/todos`. Pretty output: green checkmark + title + relative due.
  - `ascend todo list [--status pending|done|skipped] [--horizon ...] [--limit N]`. Calls `GET /api/todos`. Pretty output: table with status icon + title + due + horizon + category badge.
  - `ascend todo done <id-or-prefix>`. Calls `POST /api/todos/<id>/complete`. Confetti emoji on success.
  - `ascend todo big3` (no args). Calls `GET /api/todos/big3` for today. Shows the 3 prioritized todos with status icons.
- [ ] **Goal commands (3):** `ascend goal list`, `show`, `progress`.
  - `ascend goal list [--horizon ...] [--status ...]`. Calls `GET /api/goals`. Pretty output: table with horizon, status, progress bar (8-char bar), title.
  - `ascend goal show <id-or-prefix>`. Calls `GET /api/goals/<id>`. Shows full goal: title, description, SMART fields, progress, deadline, children list.
  - `ascend goal progress <id-or-prefix> <value>`. Calls `POST /api/goals/<id>/progress` with `{ value }`.
- [ ] **Context commands (3):** `ascend context search`, `add`, `get`.
  - `ascend context search "<query>" [--mode hybrid|text|semantic] [--limit N]`. Calls `GET /api/context/search`. Pretty output: per-row title + 2-line snippet + matched-via badge + score.
  - `ascend context add "<title>" [--type NOTE|...] [--tags tag1,tag2] [--content "..."]`. Calls `POST /api/context`. Returns the new entry id (short prefix for piping).
  - `ascend context get <id-or-prefix>`. Calls `GET /api/context/<id>`. Pretty output: title + tags + type badge + content (rendered from BlockDocument plain text, falling back to legacy markdown).
- [ ] **Dashboard command (alias):** `ascend today` (alias `ascend dashboard`).
  - No args. Calls `GET /api/dashboard` + `GET /api/calendar/agenda?day=today`. Renders 4 sections: Big 3, Today's agenda, Current priorities, Streaks + XP. Compact 1-screen view designed for the morning terminal check.
- [ ] **Calendar commands (3):** `ascend calendar day`, `week`, `agenda`.
  - `ascend calendar day [--date YYYY-MM-DD]`. Calls `GET /api/calendar/agenda?day=<date>`. Hourly timeline of todos with due times.
  - `ascend calendar week [--start YYYY-MM-DD]`. Calls `GET /api/calendar/agenda?week=<start>`. 7-column compact grid Monday-first (per locale rules).
  - `ascend calendar agenda [--days N]`. Calls `GET /api/calendar/agenda?days=N` (default 7). Flat list of upcoming todos + goal deadlines.
- [ ] **MCP escape hatch (2):** `ascend mcp list-tools`, `mcp call`.
  - `ascend mcp list-tools [--filter <substring>] [--json]`. Calls `POST /api/mcp` with `{ jsonrpc: "2.0", id: 1, method: "tools/list" }`. Pretty output: 3-column table (name, description trimmed to 60 chars, source: "ascend" / "federated:<slug>").
  - `ascend mcp call <tool-name> [<args-json>] [--json]`. Calls `POST /api/mcp` with `tools/call` envelope. Args-json defaults to `{}`. Pretty output: the tool result. Errors map to non-zero exit codes.
- [ ] **Web jump command:** `ascend open <route>`.
  - `ascend open` opens the base URL. `ascend open todos`, `ascend open /goals/<id>` open the specific route. Resolves base URL via the standard chain. Uses Node's `open` package or shells to `open` (macOS) / `xdg-open` (Linux) / `start` (Windows).
- [ ] **Output flags (global):** `--json`, `--md`. Every typed command supports them. `--json` outputs raw JSON; `--md` outputs markdown formatted for paste into Ascend itself or external notes. Pretty default otherwise.
- [ ] **Color + TTY detection.** Pretty output uses colors when stdout is a TTY; auto-disables when piped (or when `NO_COLOR` env is set, per the convention).
- [ ] **Help + version.** `ascend --help`, `ascend <subcmd> --help`, `ascend --version` (reads version from package.json).
- [ ] **Exit codes.** 0 on success, 1 on user error (bad arguments, missing auth), 2 on server error (4xx/5xx), 3 on network error.
- [ ] **macOS first.** Tested on macOS 14+. Linux + Windows nice-to-have; tested only if zero extra cost.
- [ ] **README.** `packages/cli/README.md` with install, quick start (`ascend login`, `ascend today`), command reference, and the npm publish flow.

### Quality

- [ ] **Cold start <200ms** for `ascend --help`, `ascend whoami`, and `ascend today` (after warmed Node startup). Lazy-load command modules so the dispatcher loads quickly.
- [ ] **`tsc --noEmit` and `pnpm --filter @ascend/cli build` pass at every commit.**
- [ ] **Smoke tests** via a small Vitest setup OR a shell-based test script. Cover: `ascend whoami` against a mock server, `ascend todo add/list/done` round-trip, `ascend mcp list-tools` parses correctly. Optional in v1; required for v2.
- [ ] **`ascend-architect` PASS.** `packages/cli/` MUST NOT import from `next/*`, `react`, `react-dom`, `@prisma/client`, or `@/lib/*` (those are app-level). Imports from `@ascend/api-client` and `@ascend/core` only.
- [ ] **`ascend-security` PASS** on the config-file path. `~/.ascend/config.json` is created with `0600` permission. The API key is never logged or echoed in error output. The shell-history pattern (`ASCEND_API_KEY=... ascend ...`) is documented as discouraged in favor of `ascend login`.

### Cross-platform readiness

- [ ] **No browser-only imports.** The CLI is Node-only by design. `@ascend/api-client` already uses `globalThis.fetch` and is platform-agnostic.
- [ ] **No Prisma in the CLI.** All data access goes through the HTTP API.
- [ ] **No shared CLI code leaked into `apps/web` or `apps/crdt`.** Those apps continue to consume `@ascend/api-client` directly; the CLI is the only consumer of `@ascend/cli`.

## Affected Layers

- **Prisma schema:** none. CLI does not read or write the DB directly; all access via HTTP API.
- **Service layer:** none. No new server code.
- **API routes:** none new. Possibly tighten error envelopes on a few existing routes to be CLI-friendly (e.g., always return `{ error: "...", code?: "..." }` so the CLI can render concisely); audit during Phase 6.
- **React Query hooks:** none. The CLI is independent.
- **UI components:** none.
- **MCP tools:** none new. The CLI invokes existing `/api/mcp` JSON-RPC; no new tool definitions.
- **Zustand store:** none.
- **New workspace package:** `packages/cli/` — fresh, no precedent in this repo.
- **Distribution:** new npm package `@ascend/cli`. Requires npm publish flow (likely a GitHub Action triggered by tag).

## Data Model Changes

None.

## API Contract

The CLI consumes existing routes only. Confirmed contracts (verified during Wave 8 and Wave 10):

| CLI command | API call |
|---|---|
| `ascend login` (validate) | `GET /api/auth/me` |
| `ascend whoami` | `GET /api/auth/me` + `GET /api/workspaces` |
| `ascend todo add` | `POST /api/todos` |
| `ascend todo list` | `GET /api/todos` with query params |
| `ascend todo done` | `POST /api/todos/:id/complete` |
| `ascend todo big3` | `GET /api/todos/big3` |
| `ascend goal list` | `GET /api/goals` |
| `ascend goal show` | `GET /api/goals/:id` |
| `ascend goal progress` | `POST /api/goals/:id/progress` |
| `ascend context search` | `GET /api/context/search` |
| `ascend context add` | `POST /api/context` |
| `ascend context get` | `GET /api/context/:id` |
| `ascend today` | `GET /api/dashboard` + `GET /api/calendar/agenda?day=today` |
| `ascend calendar day/week/agenda` | `GET /api/calendar/agenda` (Wave 0 endpoint) |
| `ascend mcp list-tools` | `POST /api/mcp` with `tools/list` JSON-RPC |
| `ascend mcp call` | `POST /api/mcp` with `tools/call` JSON-RPC |

**Auth header on all calls:** `Authorization: Bearer <api-key>`. `apiFetch` from `@ascend/api-client` already handles this when given a `getAuthHeaders` factory.

**MCP Accept header:** must include both `application/json` and `text/event-stream` (the SDK requires it). The CLI sends `Accept: application/json, text/event-stream` on all `/api/mcp` calls.

## UI Flows

### First-run

1. User installs: `npm install -g @ascend/cli`.
2. User runs `ascend today` → fails with "Not logged in. Run `ascend login` to set your API key (or export `ASCEND_API_KEY`)."
3. User runs `ascend login` → prompted for API key (input hidden) → `GET /api/auth/me` validates → config file written → prints "Logged in as you@example.com on https://ascend.nativeai.agency."
4. User runs `ascend today` → 4-section terminal view of Big 3, agenda, priorities, streaks.

### Daily morning

1. `ascend today` (cold start <200ms) shows the morning summary.
2. `ascend todo big3` confirms today's 3 priorities.
3. `ascend todo add "..."` captures a thought.
4. `ascend open /context` jumps to web for a deeper read.

### Piping into scripts

1. `ascend todo list --status pending --json | jq '. | length'` returns the count.
2. `ascend context search "react" --json | jq '.[0].id'` returns the first match id.
3. `ascend goal list --horizon weekly --md > today-goals.md` writes a markdown digest.

### MCP escape hatch

1. `ascend mcp list-tools` shows all 86+ tools.
2. `ascend mcp list-tools --filter context` filters to context-domain tools.
3. `ascend mcp call get_context_graph '{}' --json | jq '.nodes | length'` queries the graph from the terminal.

## Cache Invalidation

N/A — the CLI is a single-shot process. No React Query cache.

## Danger Zones Touched

None of the existing CLAUDE.md danger zones apply directly. One new CLI-specific danger zone worth documenting in the wave close:

**DZ-CLI-1: API key in shell history.** `ASCEND_API_KEY=ghp_... ascend whoami` puts the secret in shell history. Mitigation: `ascend login` is the recommended path (input is hidden + written to a `0600` config file, never echoed). The README explicitly discourages the env-var-inline pattern in favor of either `ascend login` OR exporting the env var via a shell rc file with appropriate permissions.

**DZ-CLI-2: Config file at `~/.ascend/config.json`.** Plaintext API key on disk. Mitigation: `0600` permission set at write time + `0700` on the directory; documented in README as "treat as you would `~/.aws/credentials`." Future enhancement (deferred): integrate with macOS Keychain via `keytar` when running on macOS.

## Out of Scope

- **Interactive TUI / dashboard** (use `ascend today` instead; no full-screen ncurses).
- **Real-time updates** (no streaming, no WebSocket, no SSE in v1).
- **Local SQLite cache** (every command does a fresh HTTP call; no offline mode).
- **Goal create / update / delete via CLI.** Read + progress only in v1; defer write operations beyond progress to v2.
- **Context update / delete / link operations.** Read + add only in v1.
- **Database (Wave 5) typed commands.** Use `ascend mcp call create_row` etc. as the escape hatch in v1.
- **Canvas (Wave 9) typed commands.** Same.
- **Versioning (Wave 7) typed commands.** Same.
- **Workspace switching from CLI.** Single-workspace assumption; switch via web settings in v1.
- **Plugin / extension surface** (no `ascend plugin install`).
- **macOS Keychain integration** (config file is plaintext; deferred enhancement).
- **Auto-update.** User runs `npm update -g @ascend/cli` manually.
- **Windows + Linux first-class testing.** Best-effort; tested only on macOS.
- **Shell completions** (zsh/bash/fish). Generated via `commander`'s completion in v2 if asked.

## Open Questions

1. **CLI library:** `commander` (most popular, minimal), `cac` (smaller bundle), or `oclif` (Salesforce, plugin-friendly, larger)? Default position: `commander`. Single dependency, simple subcommand API, well-typed.
2. **Color library:** `chalk` (5.x ESM-only, popular) vs `picocolors` (tinier, also ESM). Default position: `picocolors` for cold-start budget.
3. **Table library:** `cli-table3` vs hand-rolled with padded strings. Default position: `cli-table3` for the time saved on column alignment.
4. **Prompt library:** `@inquirer/prompts` (modern, ESM, modular) vs `prompts` (smaller, less actively maintained). Default position: `@inquirer/prompts` for the password input + nice UX.
5. **Distribution channel:** npm only in v1, OR also publish standalone binaries via `pkg`. Default position: npm only; revisit if first-run friction becomes a complaint.
6. **Cache the workspace id?** `whoami` resolves it on every command. Default position: cache `workspaceId` in `~/.ascend/config.json` after `login`/`whoami`, refresh on demand via `ascend whoami --refresh`.
7. **Confetti / delight in CLI?** A flashing emoji on `ascend todo done`? Default position: yes, single 🎉 emoji + the toggle disable via `NO_COLOR` env (which the CLI already respects).

## Sized

4-5 working days. Phasing in TASKS.md.

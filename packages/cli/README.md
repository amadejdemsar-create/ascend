# @ascend/cli

Ascend command-line interface. Manage goals, todos, context, the daily dashboard, the calendar, and all 86+ native + federated MCP tools from your terminal.

```bash
ascend today                                 # morning dashboard
ascend todo add "Ship the CLI" --due tomorrow --priority HIGH
ascend goal list --horizon WEEKLY --limit 5
ascend context search "auth migration"
ascend calendar week
ascend mcp call get_dashboard '{}'
```

Requires Node 22+.

## Install

```bash
npm install -g @ascend/cli
```

Verify the install:

```bash
ascend --version    # 0.1.0
ascend --help
```

If you cloned the monorepo and want to run the source build locally:

```bash
pnpm --filter @ascend/cli build
node packages/cli/dist/cli.cjs --version
```

The bundle is CJS for cold-start reasons: `--version` and `--help` return in ~30-40ms, and a full round trip (`ascend todo list --limit 5`) is ~120ms on a warm cache.

## Quick start

1. Generate or copy your API key from the Ascend web app (Settings → API key, or `User.apiKey` in the database).
2. Run `ascend login`. Paste the key when prompted. The CLI writes `~/.ascend/config.json` with mode `0600`.
3. `ascend whoami` to confirm.
4. `ascend today` for the morning dashboard.

```bash
$ ascend login
? Endpoint (https://ascend.nativeai.agency):
? API key: ************
✓ Logged in as amadej@nativeai.agency on https://ascend.nativeai.agency

$ ascend whoami
user        amadej@nativeai.agency
workspace   Personal
endpoint    https://ascend.nativeai.agency
api key     ascend-d…wxyz
sources     api-key=config, base-url=config
```

## Command reference

Every command supports the global flags `--api-key <key>` and `--base-url <url>` to override the resolved auth chain.

Every output-producing command supports `--json` and `--md` to switch the format. Without either, output is human-pretty with ANSI colors (auto-disabled when stdout is not a TTY or `NO_COLOR=1` is set).

### Auth

```bash
ascend login                      # prompt for endpoint + key, validate, persist
ascend login --api-key <key> --endpoint <url>   # non-interactive
ascend logout                     # delete ~/.ascend/config.json
ascend logout -y                  # skip confirmation
ascend whoami                     # show resolved user + workspace + endpoint
ascend whoami --json              # same data as JSON
ascend whoami --refresh           # refetch workspaceId, write back to config
```

### Today (morning dashboard)

```bash
ascend today                      # Big 3 + today's agenda + weekly focus + streaks/XP
ascend today --json               # raw payload for scripting
ascend today --md                 # paste into notes
```

Aliased as `ascend dashboard`.

### Todos

```bash
ascend todo add "Buy milk" --due tomorrow --priority HIGH
ascend todo list --status PENDING --limit 10
ascend todo list --big3
ascend todo list --priority HIGH --json | jq '.[].title'
ascend todo done <id-or-prefix>          # prefix-match against PENDING
ascend todo big3                          # show today's Big 3
ascend todo big3 set <id1> [<id2>] [<id3>]
```

The `--due` value accepts `today`, `tomorrow`, `YYYY-MM-DD`, or any ISO 8601 datetime. The CLI normalizes natural-language input to a 17:00 local-time anchor for date-only inputs.

### Goals

```bash
ascend goal list                          # all active goals with progress bars
ascend goal list --horizon WEEKLY --priority HIGH
ascend goal show <id-or-prefix>           # SMART fields, deadline, children
ascend goal show <id> --include-done      # prefix-match against archived goals too
ascend goal progress <id> 5               # add 5 units of progress
ascend goal progress <id> 5 --note "completed module 3"
```

### Context

```bash
ascend context search "auth"              # hybrid text + semantic search
ascend context search "auth" --mode text  # text-only (no LLM cost)
ascend context add "Meeting notes 17 May" --content "..."
echo "$(pbpaste)" | ascend context add "Pasted from clipboard" --stdin
ascend context get <id-or-prefix>         # full body + typed link list
ascend context get <id> --full            # show whole body (default truncates at 4000 chars)
```

### Calendar

```bash
ascend calendar day                       # today
ascend calendar day --date 2026-05-20
ascend calendar week                      # current week, Monday-first
ascend calendar week --start 2026-05-25
ascend calendar agenda --days 14          # next 14 days, sorted flat list
```

### MCP escape hatch

When the typed commands above don't cover what you need (federated tools, advanced filters, less-common operations), drop down to MCP:

```bash
ascend mcp list-tools                     # all 86+ native + federated tools
ascend mcp list-tools --filter goal       # substring filter
ascend mcp call get_dashboard '{}'        # native tool
ascend mcp call get_dashboard --json '{}' # raw JSON-RPC envelope for piping
echo '{"q":"hello"}' | ascend mcp call search_context --stdin
ascend mcp call --args-file payload.json create_goal
```

Federated tool names use the `slug__tool` form (e.g., `github__create_issue`). `mcp list-tools` shows the source column so you can tell native from federated at a glance.

### Open in browser

```bash
ascend open                               # opens the web app home page
ascend open todos                         # opens /todos
ascend open goals/cmpb...                 # deep link
ascend open /goals/abc --print            # print the URL instead of launching
```

## Auth model

The CLI resolves the API key and endpoint from three sources, in priority order:

| Priority | Source |
|----------|--------|
| 1 | `--api-key` / `--base-url` flags |
| 2 | `ASCEND_API_KEY` / `ASCEND_BASE_URL` env vars |
| 3 | `~/.ascend/config.json` (written by `ascend login`) |
| 4 | Hardcoded default base URL: `https://ascend.nativeai.agency` |

`ascend whoami` shows which source each value came from.

The recommended flow is `ascend login` once per machine — never paste your API key inline in shell history. The config file is written with mode `0600` and lives in a `0700` directory.

For shared scripts or CI, prefer env vars:

```bash
ASCEND_API_KEY=ascend-... ASCEND_BASE_URL=https://ascend.nativeai.agency ascend today
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ASCEND_API_KEY` | API key. Same value as `User.apiKey` in the database, identical to what MCP clients use. |
| `ASCEND_BASE_URL` | Override the default endpoint. Useful for local dev (`http://localhost:3100`). |
| `NO_COLOR` | Any non-empty value disables ANSI colors. Honored by all subcommands. |

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | CLI usage error (missing flag, invalid argument, missing auth) |
| 2 | API call error (non-2xx response, MCP tool returned `isError: true`) |
| 3 | Network error (connection refused, DNS failure, timeout) |
| 4+ | Unexpected runtime error |

Use exit codes for shell chaining:

```bash
ascend todo done <id> && ascend today
ascend mcp call refresh_context_map '{}' || echo "refresh failed"
```

## Output flags

| Flag | Behavior |
|------|----------|
| (default) | Human-pretty: tables, colors, relative dates |
| `--json` | Machine-readable JSON (one object or array, suitable for `jq`) |
| `--md` | Markdown for pasting into notes or documents |

Passing both `--json` and `--md` prints a warning to stderr and uses `--json`.

## Local development

If you're running the Ascend web app locally:

```bash
ASCEND_BASE_URL=http://localhost:3100 ASCEND_API_KEY=<your-dev-key> ascend today
```

Or persist the local config alongside production by storing the dev key under a different env var pattern and using a shell alias.

## Troubleshooting

**"No API key found in flag, env, or config file."** → Run `ascend login`, or pass `--api-key <key>`, or export `ASCEND_API_KEY=...`.

**"401 Unauthorized"** → Your API key was rejected. Generate a new one from the web app and re-run `ascend login`.

**"MCP error -32601: Method not found"** → The MCP tool name is wrong. Run `ascend mcp list-tools | grep <substring>` to find the correct name.

**"Network error: ECONNREFUSED"** → The endpoint is not reachable. If you set `ASCEND_BASE_URL=http://localhost:3100`, make sure the dev server is running.

**Output renders with `[?25l` etc. inside a pipe** → The CLI auto-disables colors when stdout is not a TTY. If you're still seeing escape sequences, set `NO_COLOR=1` explicitly.

## Publishing (maintainers only)

Manual release flow:

```bash
# 1. bump the version in packages/cli/package.json
# 2. typecheck + build
pnpm --filter @ascend/cli exec tsc --noEmit
pnpm --filter @ascend/cli build
# 3. dry-run pack to inspect the tarball
pnpm --filter @ascend/cli pack --pack-destination /tmp
# 4. publish (requires `npm login` first)
pnpm publish --filter @ascend/cli --access public
# 5. tag the release
git tag cli-v$(node -p "require('./packages/cli/package.json').version")
git push --tags
```

A tag-triggered GitHub Action is on the backlog (`.ascendflow/BACKLOG.md`). Until then, releases are manual.

## License

Internal. Not licensed for public redistribution.

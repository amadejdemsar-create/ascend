# @ascend/cli

Ascend command-line interface.

> **Phase 1 status:** scaffold only. Auth + commands land in Phases 2-7.

## Install (eventual)

```bash
npm install -g @ascend/cli
```

Requires Node 22+.

## Quick start (eventual)

```bash
ascend login                  # prompts for API key, writes ~/.ascend/config.json
ascend today                  # morning dashboard: Big 3 + agenda + priorities
ascend todo add "Buy milk"    # quick capture
ascend mcp list-tools         # all 86+ native + federated tools
```

## Verifying the scaffold (Phase 1)

```bash
pnpm --filter @ascend/cli build
node packages/cli/dist/cli.js --version
# -> 0.1.0
node packages/cli/dist/cli.js --help
```

## Plan

See `.ascendflow/features/ascend-cli/` for the PRD + TASKS.md.

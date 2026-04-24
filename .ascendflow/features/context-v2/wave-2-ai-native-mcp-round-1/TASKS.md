# Implementation Tasks: Wave 2 — AI-native via MCP, Round 1

**Parent:** [PRD.md](./PRD.md) · [VISION.md](../VISION.md)
**Sizing:** 15-18 working days solo. Prerequisite: Wave 1 closed (`a7fc386`) + user has completed items under "User-side prerequisites" below.
**All implementation delegated to `ascend-dev` with per-phase audits by `ascend-security`, `ascend-architect`, `ascend-migration-auditor`, `ascend-reviewer`.**

## User-side prerequisites (BLOCKERS for Phase 1)

Before any code lands:

1. **Provision `GEMINI_API_KEY`** at aistudio.google.com/apikey. Add to Dokploy env. Required (embeddings have no alternative; also powers default chat). Set a monthly hard cap in Google Cloud billing as a backstop.
2. **Provision `OPENAI_API_KEY`**. Add to Dokploy env. Required only if user wants to select OpenAI as chat provider. Set monthly cap in OpenAI dashboard.
3. **Provision `ANTHROPIC_API_KEY`**. Add to Dokploy env. Required only if user wants to select Anthropic. Set monthly cap in Anthropic console.
4. **Verify pgvector on both dev and prod**: `SELECT * FROM pg_available_extensions WHERE name = 'vector';` If missing, swap Dokploy Postgres image to `pgvector/pgvector:pg16` first.
5. **Confirm cost caps** (defaults: $2 soft / $10 hard daily). Adjust in `packages/llm/src/pricing.ts` before Phase 2 if different.
6. **Pick cron path** (Dokploy scheduled tasks or GitHub Actions) and add `CRON_SECRET` env to Dokploy (`openssl rand -hex 32`).

Items 2-3 are soft: deferring them still ships the wave with Gemini-only chat. UI surfaces provider availability with green/amber dots.

---

## Phase 1: Web-check model IDs + pgvector migration + schema (Days 1-2)

### 1.1 Web-check Gemini model IDs + pricing

Per the Fast-Moving Identifiers rule, model IDs do not come from training data. Run `firecrawl_scrape` against:

- https://ai.google.dev/gemini-api/docs/models — all current chat + embedding model IDs
- https://ai.google.dev/gemini-api/docs/pricing — per-1M-token pricing for each model (paid tier + batch tier)
- https://ai.google.dev/gemini-api/docs/embeddings — confirm `gemini-embedding-2` is GA, dimensions, token limits

**Pin Cheap / Balanced / Best tier model IDs for Gemini.** As of 24. 4. 2026 the likely line-up is:
- Cheap: `gemini-2.5-flash-lite` (stable)
- Balanced: `gemini-2.5-flash` (stable)
- Best: `gemini-3.1-pro-preview` (Preview; Preview label + deprecation notice in UI)

Verify before pinning. If a newer stable graduation happened since 22. 4. 2026, pick it.

### 1.2 Web-check OpenAI model IDs + pricing

Scrape:
- https://platform.openai.com/docs/models — current API-available chat model IDs
- https://openai.com/pricing — per-1M-token pricing

Pin Cheap / Balanced / Best tier for OpenAI. Do NOT assume `gpt-4o`-era names are current; per the global rule, do not reflex-default to `gpt-4.x`. Pin whatever the docs show today.

### 1.3 Web-check Anthropic model IDs + pricing

Scrape:
- https://docs.anthropic.com/en/docs/about-claude/models — current API-available model IDs (Opus, Sonnet, Haiku)
- https://www.anthropic.com/pricing#api — per-1M-token pricing

Pin Cheap / Balanced / Best tier for Anthropic.

### 1.4 Output: `MODEL-DECISION.md`

Write `.ascendflow/features/context-v2/wave-2-ai-native-mcp-round-1/MODEL-DECISION.md` with:
- Chosen tier model IDs per provider (Cheap / Balanced / Best)
- Per-model pricing (input + output per 1M tokens)
- Status (Stable / Preview / Experimental)
- Context window size
- Structured-output / JSON-mode support per model
- Source URL + verification date

### 1.5 Enable pgvector extension

Hand-write migration `20260425XXXXXX_enable_pgvector/migration.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Review with `ascend-migration-auditor`. Apply via `prisma migrate deploy` on dev first, verify with `SELECT * FROM pg_extension WHERE extname = 'vector';`.

### 1.6 Schema changes

Update `apps/web/prisma/schema.prisma`:

```prisma
enum ChatProviderKind {
  GEMINI
  OPENAI
  ANTHROPIC
}

model ContextEntry {
  // existing fields preserved
  embedding  Unsupported("vector(1536)")?
}

model ContextMap {
  id           String @id @default(cuid())
  userId       String @unique
  user         User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  content      Json
  provider     ChatProviderKind
  model        String
  inputTokens  Int
  outputTokens Int
  costCents    Int
  generatedAt  DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model LlmUsage {
  id                 String @id @default(cuid())
  userId             String
  user               User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider           ChatProviderKind
  model              String
  purpose            String
  promptTokens       Int
  completionTokens   Int
  estimatedCostCents Int
  createdAt          DateTime @default(now())

  @@index([userId, createdAt])
}

model UserSettings {
  // existing fields preserved
  chatProvider  ChatProviderKind @default(GEMINI)
  chatModel     String?
}
```

Run `prisma migrate dev --create-only`, inspect SQL, **strip any DROP of `search_vector`** (DZ-2 trap from Waves 1 + 0 Phase 6). Apply via `prisma migrate deploy`.

Verify `search_vector` + GIN index + trigger intact post-apply: `\d "ContextEntry"` in psql.

### 1.7 Zod schemas

Add to `packages/core/src/schemas/` (re-exported from `apps/web/lib/validations.ts`):
- `chatProviderKindSchema` (z.enum)
- `contextMapContentSchema` (nested schema for themes/principles/projects/tensions/orphans)
- `contextMapSchema` (row shape)
- `llmUsageSchema`
- `updateAiSettingsSchema` (for PATCH /api/settings)

### 1.8 Delegate to `ascend-migration-auditor` for migration review, `ascend-architect` for schema boundary review.

### 1.9 Commit: `feat(db): Wave 2 Phase 1 — pgvector + ChatProviderKind + ContextMap + LlmUsage`

---

## Phase 2: `packages/llm` — 4 provider implementations (Days 3-5)

### 2.1 Scaffold `packages/llm`

Run `/ax:package llm`. The scaffold creates `packages/llm/src/{index,types,pricing,cost,retry}.ts` and wires the package into `pnpm-workspace.yaml` + `tsconfig.base.json`.

Verify with `/ax:cross-platform-check` (no next/react/prisma imports).

### 2.2 Define interfaces

`packages/llm/src/types.ts`:

```ts
export type ChatProviderKind = "GEMINI" | "OPENAI" | "ANTHROPIC";

export interface EmbeddingProvider {
  kind: "GEMINI";
  embed(input: EmbeddingInput): Promise<EmbeddingResult>;
}

export interface ChatProvider {
  kind: ChatProviderKind;
  chat(input: ChatInput): Promise<ChatResult>;
}

export interface ChatInput {
  model: string;
  system?: string;
  messages: ChatMessage[];
  jsonSchema?: unknown; // for structured output
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  finishReason: "stop" | "length" | "content_filter" | "error";
}

export interface ModelDescriptor {
  id: string;
  tier: "cheap" | "balanced" | "best";
  provider: ChatProviderKind;
  status: "stable" | "preview" | "experimental";
  contextTokens: number;
  costPer1Min: number;  // USD cents
  costPer1Mout: number; // USD cents
  supportsJsonMode: boolean;
}
```

### 2.3 `GeminiEmbeddingProvider`

`packages/llm/src/providers/gemini-embedding.ts`. Uses `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent`. Request with `output_dimensionality: 1536`. Handles rate limiting, retries via `retry.ts`. Returns `{ embedding: number[], promptTokens: number }`.

### 2.4 `GeminiChatProvider`

`packages/llm/src/providers/gemini-chat.ts`. Uses `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`. Supports Gemini's `response_mime_type: "application/json"` for JSON mode when `jsonSchema` provided. Parses usage metadata from response.

### 2.5 `OpenAIChatProvider`

`packages/llm/src/providers/openai-chat.ts`. Uses `https://api.openai.com/v1/chat/completions`. Supports OpenAI's `response_format: { type: "json_schema", json_schema: {...} }` for structured output. Parses `usage.prompt_tokens` / `usage.completion_tokens`.

### 2.6 `AnthropicChatProvider`

`packages/llm/src/providers/anthropic-chat.ts`. Uses `https://api.anthropic.com/v1/messages`. Header `anthropic-version: 2023-06-01` (or newest at web-check time). Tool-use-based structured output for `jsonSchema` (Anthropic does not have a native JSON mode; use tool definition with the target schema).

### 2.7 Pricing table

`packages/llm/src/pricing.ts` — const object keyed by `${provider}:${model}` with input + output cents per 1M tokens, timestamped with `// last verified 2026-04-XX` comments matching MODEL-DECISION.md from Phase 1.4.

### 2.8 Cost estimator + retry

`cost.ts`: `estimateCostCents({provider, model, promptTokens, completionTokens})`.
`retry.ts`: exponential backoff, max 3 retries, only on 5xx + 429. Never retries on 4xx client errors.

### 2.9 Model catalog

`listModels(provider): ModelDescriptor[]` returning the known-good list per provider. Single source of truth for both settings UI and runtime validation.

### 2.10 Delegate to `ascend-architect` for platform-agnostic audit. Must PASS.

### 2.11 Commit: `feat(llm): Wave 2 Phase 2 — packages/llm with Gemini/OpenAI/Anthropic providers`

---

## Phase 3: `llmService` + `embeddingService` + cost cap (Day 6)

### 3.1 `apps/web/lib/services/llm-service.ts`

Methods:
- `resolveProvider(userId: string): Promise<{ provider: ChatProvider, model: string }>` — reads `UserSettings.chatProvider`, `UserSettings.chatModel`, checks env for the corresponding key, throws 400-mapped error if missing.
- `requestBudget(userId: string, estimatedCostCents: number): Promise<void>` — reads today's `LlmUsage` rollup, throws 429 if adding would exceed hard cap.
- `chat(userId: string, input: ChatInput, purpose: string): Promise<ChatResult>` — full flow: resolve provider → estimate cost → request budget → call provider → log `LlmUsage` → return.
- `usageForUser(userId: string, window: "day" | "week"): Promise<UsageSummary>`.

### 3.2 `apps/web/lib/services/embedding-service.ts`

- `embed(userId: string, content: string | MultimodalInput): Promise<number[]>` — wraps `GeminiEmbeddingProvider`, enforces cost cap via `llmService.requestBudget`, logs usage.
- `upsertEmbeddingForEntry(userId: string, entryId: string): Promise<void>` — reads the entry, embeds, writes to `ContextEntry.embedding` via raw SQL (`UPDATE "ContextEntry" SET embedding = $1::vector WHERE id = $2 AND "userId" = $3`).
- `searchSemantic(userId: string, query: string, limit: number): Promise<ContextEntry[]>` — embeds query, runs `ORDER BY embedding <=> $1::vector LIMIT N` with userId filter.

### 3.3 Hook `embedding-service` into `context-service`

- `contextService.create` → after insert, enqueue/await `embeddingService.upsertEmbeddingForEntry`.
- `contextService.update` → if content changed, re-embed.
- Treat embedding failures as non-blocking warnings for CRUD (log + 202 Accepted if async), blocking if sync.

### 3.4 Delegate to `ascend-security` for cost-cap audit. Must PASS with zero blocking issues. Specifically verify:
- Cost cap called BEFORE every provider invocation
- No path around `requestBudget`
- Retry policy never retries 4xx
- `LlmUsage` write is transactionally consistent with provider call (or at least reconciled)

### 3.5 Commit: `feat(services): Wave 2 Phase 3 — llmService + embeddingService + cost cap`

---

## Phase 4: Embedding backfill (Day 7)

### 4.1 Write `apps/web/scripts/backfill-embeddings.ts`

CLI script. For each user:
- `SELECT id FROM "ContextEntry" WHERE "userId" = $1 AND embedding IS NULL`
- For each entry in batches of 10: `embeddingService.upsertEmbeddingForEntry`
- Log progress, handle rate limits with backoff, idempotent on re-run

### 4.2 Run on dev DB

Record row count + duration. If any entry fails, script continues and reports failures at the end.

### 4.3 Add HNSW index

Once backfill complete, add `20260425XXXXXX_embedding_hnsw_index/migration.sql`:

```sql
CREATE INDEX IF NOT EXISTS "ContextEntry_embedding_hnsw_idx"
  ON "ContextEntry" USING hnsw (embedding vector_cosine_ops);
```

Index creation on a populated column is faster than on an empty one.

### 4.4 Delegate to `ascend-migration-auditor` for index migration review.

### 4.5 Commit: `feat(db): Wave 2 Phase 4 — embedding backfill + HNSW index`

---

## Phase 5: Hybrid search (Day 8)

### 5.1 Extend `contextService.search`

Accept `mode: "text" | "semantic" | "hybrid"` (default hybrid).
- `text`: existing tsvector path unchanged
- `semantic`: `embeddingService.searchSemantic`
- `hybrid`: run both, combine scores via weighted sum (`0.6 * tsvector_rank + 0.4 * (1 - cosine_distance)` — tune in VERIFY step), dedupe by entry id

### 5.2 Extend `/api/context/search` route

Parse `mode` query param via Zod. Call `contextService.search` with mode.

### 5.3 Extend `useContextSearch` hook

Accept `mode` argument, wire through to API call.

### 5.4 Add `semantic-search-toggle.tsx`

Optional segmented control on the search bar: `Text | Semantic | Hybrid`. Default Hybrid. Stored in `uiStore.contextSearchMode`.

### 5.5 VERIFY

Manually test with 3-5 paraphrase queries. Confirm Hybrid results are meaningfully different + better than Text for at least 2 queries. Tune weights if needed.

### 5.6 Delegate to `ascend-ui-verifier` for `/ax:verify-ui` run.

### 5.7 Commit: `feat(search): Wave 2 Phase 5 — hybrid search (tsvector + pgvector)`

---

## Phase 6: Context Map synthesizer + cron (Days 9-11)

### 6.1 `apps/web/lib/services/context-map-service.ts`

Methods:
- `getCurrent(userId: string): Promise<ContextMap | null>`
- `refresh(userId: string): Promise<ContextMap>` — full synthesis flow
- `canRefresh(userId: string): { ok: boolean; reason?: string; retryAfterSec?: number }` — cooldown check (default 30 min since last `generatedAt`)

### 6.2 Synthesis prompt

Write the prompt template in `apps/web/lib/services/context-map-prompt.ts`. The prompt receives:
- All `ContextEntry` titles + first 500 chars of content + type
- All `ContextLink` edges (fromId, toId, type)
- Output: JSON matching `contextMapContentSchema` with `{themes, principles, projects, tensions, orphans}`

For 200+ node graphs, chunk the input into up to 3 passes and merge (Phase 6.3).

### 6.3 Chunked synthesis for large graphs

If graph > 200 nodes:
- Pass 1: synthesize themes + principles from first 100 nodes
- Pass 2: synthesize projects + tensions from all nodes (compressed summaries from Pass 1)
- Pass 3: identify orphans from adjacency matrix

### 6.4 `GET /api/context/map/route.ts`

Authenticate → call `getCurrent` → return row or 404.

### 6.5 `POST /api/context/map/refresh/route.ts`

Dual auth:
- User JWT (existing `authenticate()` path)
- OR `x-cron-secret` header matching `CRON_SECRET` env

Both paths call `canRefresh` first, then `refresh`. User path is also rate-limited (1 per 30 min). Cron path is not rate-limited but respects the cost cap.

### 6.6 `/api/llm/usage/route.ts`

GET only. Returns rollup + soft/hard cap + per-provider/per-purpose breakdown.

### 6.7 `/api/llm/providers/route.ts`

GET only. Returns `[{kind, available, models: ModelDescriptor[]}]` where `available` reflects env key presence.

### 6.8 React Query hooks

`lib/hooks/use-context-map.ts`:
- `useContextMap()` — GET /api/context/map
- `useRefreshContextMap()` — POST /api/context/map/refresh; on success invalidate `queryKeys.context.map()` + `queryKeys.llm.usage()`

`lib/hooks/use-llm.ts`:
- `useLlmUsage(window)`
- `useLlmProviders()`

### 6.9 Cron wiring

Based on user's Phase 0 decision:
- **Dokploy scheduled tasks:** add a scheduled task that does `curl -X POST -H "x-cron-secret: $CRON_SECRET" https://ascend.nativeai.agency/api/context/map/refresh` at 03:00 UTC daily
- **GitHub Actions:** add `.github/workflows/nightly-map-refresh.yml` with the same curl call, secrets via repo settings

### 6.10 Delegate to `ascend-security` for cron auth audit. Must PASS.

### 6.11 Commit: `feat(context-map): Wave 2 Phase 6 — synthesizer + cron + usage endpoint`

---

## Phase 7: 5 MCP tools + UI surfaces (Days 12-14)

### 7.1 MCP tool schemas

Add to `apps/web/lib/mcp/schemas.ts` `TOOL_DEFINITIONS`:
- `get_context_map` — no input, returns current map
- `refresh_context_map` — no input, triggers refresh (respects cooldown + cost cap)
- `suggest_connections` — input `{ entryId: string }`, returns up to 5 suggested typed edges using semantic similarity + LLM rerank
- `detect_contradictions` — input `{ entryId?: string }`, scans for tensions (if entryId: only involving that entry; else: across entire graph)
- `summarize_subgraph` — input `{ rootEntryId: string, depth: 1 | 2 }`, returns LLM-generated summary of the 1- or 2-hop neighborhood

### 7.2 MCP tool handler

New `apps/web/lib/mcp/tools/llm-tools.ts`:
- Zod runtime validation
- Delegates to `contextMapService`, `embeddingService`, `llmService`
- Returns `McpContent` shape

Add `LLM_TOOL_NAMES` Set + routing branch in `apps/web/lib/mcp/server.ts`. New tool count: **52**.

### 7.3 Context Map card

`apps/web/components/context/context-map-card.tsx`:
- 5 sections (themes, principles, projects, tensions, orphans)
- Each section shows up to 5 items with a "more" button
- Clicking an item dispatches a filter action via `uiStore.setContextFilter({ entryIds: [...] })`
- Refresh button with cooldown countdown + model badge
- Empty state: "Generate your first map" CTA

Mount at the top of `/context` list view and `/context` graph view.

### 7.4 LLM usage panel

`apps/web/components/settings/llm-usage-panel.tsx`:
- Today's spend + soft/hard cap progress bars
- Per-provider + per-purpose breakdown
- Auto-refreshes every 30s

### 7.5 Provider picker

`apps/web/components/settings/llm-provider-picker.tsx`:
- Provider dropdown with green/amber dot per provider
- Model tier dropdown (Cheap / Balanced / Best) filtered by selected provider
- Shows model ID + price + preview badge
- Preview badge includes warning tooltip about 2-week deprecation window

Wire via `PATCH /api/settings` extending existing settings route. Add `updateAiSettingsSchema` Zod.

### 7.6 Delegate to `ascend-ui-verifier` for `/ax:verify-ui` run. Full scenario plan:
- Open /context, see empty Map card, click "Generate your first map"
- Wait for synthesis, see 5 sections populate
- Click a theme item, list filters
- Open /settings, switch provider to OpenAI, switch tier to Best
- Return to /context, hit Refresh, confirm new map uses OpenAI
- Verify usage panel reflects both calls

### 7.7 Commit: `feat(ui+mcp): Wave 2 Phase 7 — Context Map card + settings + 5 MCP tools`

---

## Phase 8: Wave close (Days 15-17)

### 8.1 `/ax:test`

`npx tsc --noEmit` + `pnpm --filter @ascend/web build` must PASS.

### 8.2 `/ax:review`

Safety rule + pattern compliance. Fix any flagged issues.

### 8.3 `/ax:verify-ui`

Full UI regression pass including all Wave 1 scenarios (graph view, detail panel, typed wikilinks). Must PASS.

### 8.4 `/ax:critique`

`ascend-critic` verdict required at GOOD or WORLD-CLASS. NEEDS WORK or NOT READY blocks close.

### 8.5 Production smoke test

Curl `/api/mcp` tools/list, confirm 52 tools. Curl `/api/context/map` after refresh, confirm structured payload. Inspect `/settings` in browser, confirm provider picker + usage panel render.

### 8.6 Update CLAUDE.md

- MCP tool count: 47 → 52
- Entity Model: add ContextMap, LlmUsage
- Views table: Context Map card is not a separate view; note on context page
- Key File Lookup: llm package, embedding-service, context-map-service, map card, provider picker
- Danger Zones: add DZ-9 (LLM cost runaway) with the 4 mitigations
- Wave 2 continue prompt path update

### 8.7 Update BACKLOG.md

Wave 2 shipped. Carry-overs:
- Streaming responses for refresh.
- Per-purpose / per-tool cost caps.
- Provider-specific JSON-mode tuning (vs prompt-contract).
- Context Map versioning (Wave 8).
- HNSW index tuning (m, ef_construction) if graph grows.

### 8.8 Write `CLOSE-OUT.md`

Criterion-by-criterion status matching Wave 1's pattern. 17+ DONE / 0 SKIPPED (or explicit SKIPPED + reason).

### 8.9 `/ax:deploy-check`

Must PASS.

### 8.10 Commit: `chore(wave-2): close Wave 2 — AI-native MCP round 1 shipped`

### 8.11 Present deliverables checklist.

---

## Handoff to Wave 3

Wave 3 (Block editor) assumes:
- `@ascend/llm` is live; Wave 3 AIBlock calls `llmService.chat` with user's selected provider.
- Every `ContextEntry` has an embedding; Wave 3 can use semantic search in the block editor for wikilink autocomplete + "similar entries" suggestions.
- 52 MCP tools live in prod.
- Cost tracking visible in settings.
- Context Map card provides a pattern for other LLM-powered UI surfaces (Wave 3 weekly review, Wave 8 insights).

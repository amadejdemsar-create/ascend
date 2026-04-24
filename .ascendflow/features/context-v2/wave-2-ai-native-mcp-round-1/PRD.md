# Wave 2: AI-native via MCP, Round 1

**Slug:** `context-v2` / `wave-2-ai-native-mcp-round-1`
**Created:** 24. 4. 2026
**Status:** planning (Wave 1 closed at `a7fc386`)
**Parent vision:** [.ascendflow/features/context-v2/VISION.md](../VISION.md) (W2 section starts ~line 277)
**Wave sizing:** ~3-3.5 weeks solo (target: 15-18 working days)

## Problem

Wave 1 made the context section a typed graph, but the graph is static from the user's side, they hand-curate edges via wikilinks or the Quick Link dialog. The user cannot ask "what am I implicitly thinking across these 200 notes?" without reading every one. Connected AI agents have the 7 graph tools from Wave 1 but cannot synthesize, they can only query.

Wave 2 introduces:

1. A provider abstraction that splits into two interfaces, `EmbeddingProvider` and `ChatProvider`, so embedding work (Gemini-only) stays isolated from chat work (user-selectable across three providers).
2. A multimodal embedding pipeline powered by Gemini Embedding 2 (GA 22. 4. 2026), storing vectors in a new pgvector column on `ContextEntry`.
3. A Context Map synthesizer that reads the entire user graph and produces a structured `{themes, principles, projects, tensions, orphans}` payload via the user's selected chat provider.
4. 5 new MCP tools so connected agents can reason over the graph instead of only traversing it.
5. A settings UI where the user picks their preferred chat provider (Gemini, OpenAI, Anthropic) and model tier (Cheap / Balanced / Best), with cost tracking visible in settings.

## User Story

As a thinker, I want the system to read my entire multimodal context graph (text today, attachments in Wave 4) and give me a synthesized map of what I am thinking (themes, principles, tensions, orphans), so that I can see patterns I could not see by scrolling a flat list. Separately, I want semantic search that surfaces entries by meaning, not just keyword match. And I want to choose which AI provider synthesizes my map, because I may want Google's speed for daily regens, Claude's writing quality for weekly deep passes, and GPT for everything in between.

## Success Criteria

### Functional

- [ ] New `packages/llm` workspace package exports two interfaces: `EmbeddingProvider` and `ChatProvider`. One embedding implementation (`GeminiEmbeddingProvider` using `gemini-embedding-2`), three chat implementations (`GeminiChatProvider`, `OpenAIChatProvider`, `AnthropicChatProvider`).
- [ ] Pricing tables for all 4 implementations live in `packages/llm/src/pricing.ts`, pinned with `// last verified YYYY-MM-DD` comments against the official docs. Model IDs are pinned per the Fast-Moving Identifiers rule after a Phase 1 web-check (no IDs assumed from training data).
- [ ] Embedding pipeline: on every `ContextEntry` create or content update, an embedding is generated via `GeminiEmbeddingProvider` and stored in a new pgvector column `ContextEntry.embedding` (dimension **1536**, matryoshka-truncated from Gemini's native 3072 dims). Deleted entries drop their embedding via cascade.
- [ ] Backfill job populates embeddings for all existing `ContextEntry` rows. Idempotent, re-runnable, logs row count.
- [ ] `/api/context/search` accepts `mode=text|semantic|hybrid` (default `hybrid`). Hybrid returns a unified ranked list blending tsvector match score and pgvector cosine similarity.
- [ ] `/api/context/map` GET returns the current user's Context Map (or 404 if none exists yet).
- [ ] `/api/context/map/refresh` POST regenerates the Context Map on demand. Two auth paths: user JWT (rate-limited per user) OR `x-cron-secret` header (nightly job). Both enforce the cost cap.
- [ ] Context Map is structured as `{ themes, principles, projects, tensions, orphans }`, each a list of items linking back to source `ContextEntry` ids. Stored in a new `ContextMap` table (one row per user) with `content jsonb`, `generatedAt`, `model`, `provider`, `inputTokens`, `outputTokens`, `costCents`.
- [ ] Nightly cron regenerates the map. Cron invocation path (Dokploy scheduled tasks vs GitHub Actions) decided in Phase 6.
- [ ] Manual refresh button in the Context Map UI with a visible cooldown (default: 1 regeneration per 30 minutes).
- [ ] User-selectable chat provider + model: `UserSettings.chatProvider` (enum `GEMINI | OPENAI | ANTHROPIC`, default `GEMINI`) and `UserSettings.chatModel` (string, validated against the known-good list per provider at call time). Settings page renders a provider dropdown, then a model dropdown filtered by the chosen provider, with a Cheap / Balanced / Best tier preset.
- [ ] **Latest-generation model defaults.** Each provider exposes 3 tiers (Cheap / Balanced / Best) using the latest models available at Phase 1 web-check time. For Gemini, the "Best" tier uses a Preview-labeled model if stable hasn't graduated yet. Preview status is surfaced in the picker with a badge.
- [ ] Missing API key for a selected provider returns a clear 400 with a "Provision the key in Dokploy env" error, NOT a silent failure. The settings UI also surfaces provider availability (key present vs missing) with a green/amber dot per provider.
- [ ] 5 new MCP tools: `get_context_map`, `refresh_context_map`, `suggest_connections`, `detect_contradictions`, `summarize_subgraph`. All route through the user's selected chat provider.
- [ ] Context Map UI card at the top of `/context` (both list and graph views). Renders each of the 5 sections with clickable items that filter the underlying graph/list to those entries.
- [ ] Cost tracking: every LLM call records `userId, timestamp, provider, model, purpose, promptTokens, completionTokens, estimatedCostCents` to a new `LlmUsage` table. Daily rollup visible in `/settings`. Soft cap at **$2/day** surfaces a warning toast; hard cap at **$10/day** refuses new LLM calls with a clear error.

### Quality

- [ ] Semantic search returns meaningfully different results than tsvector for appropriate queries (e.g., a query for "making decisions under uncertainty" surfaces relevant entries that do not contain those exact words).
- [ ] Embedding backfill runs to 100% completion on existing entries. Report row count after backfill.
- [ ] Context Map regeneration budget: complete within 45 seconds for a graph of up to 200 nodes using the Balanced tier. Larger graphs may require chunked synthesis.
- [ ] All round-2 MCP tools callable via the existing `/api/mcp` endpoint with the API key. MCP tool count rises from 47 → 52.
- [ ] `npx tsc --noEmit` and `pnpm --filter @ascend/web build` pass.
- [ ] `ascend-security` audit PASS on LLM provider + cost tracking + cron auth with zero blocking issues.
- [ ] `ascend-architect` audit PASS on `packages/llm` platform-agnostic boundary (no Next/React/Prisma imports).
- [ ] `ascend-migration-auditor` PASS on the pgvector migration + new tables.

### Cross-platform readiness

- [ ] `packages/llm` is platform-agnostic (pure TS, no `next/*`, no React, no Node-only IO outside the provider's HTTP client, which uses the universal `fetch`). Mobile (Wave 6) and desktop (Wave 9) apps can import it directly.
- [ ] The embedding column is a schema detail; clients talk to the unified search endpoint. No client-side vector math.

## Affected Layers

- **Prisma schema:**
  - `ContextEntry.embedding` — new column, type `vector(1536)` via raw SQL migration (pgvector).
  - New `ContextMap` model (per-user, `content jsonb`, `generatedAt`, `provider`, `model`, `inputTokens`, `outputTokens`, `costCents`, userId-scoped).
  - New `LlmUsage` table (userId, createdAt, provider, model, purpose, promptTokens, completionTokens, estimatedCostCents).
  - New enum `ChatProviderKind` = `GEMINI | OPENAI | ANTHROPIC`.
  - `UserSettings` gets `chatProvider ChatProviderKind @default(GEMINI)` and `chatModel String?`.
  - Enable pgvector extension via hand-written SQL migration.
- **Packages:** new `packages/llm/` exporting:
  - `EmbeddingProvider` interface + `GeminiEmbeddingProvider` impl.
  - `ChatProvider` interface + `GeminiChatProvider`, `OpenAIChatProvider`, `AnthropicChatProvider` impls.
  - `pricing.ts` with per-provider per-model tables, web-check-verified.
  - `cost.ts` with `estimateCostCents(provider, model, promptTokens, completionTokens)`.
  - `retry.ts` with exponential backoff helpers.
  - Model catalog helper: `listModels(provider): ModelDescriptor[]` returning tier/status/context/price metadata. Used by the settings UI.
- **Service layer (`apps/web/lib/services/`):**
  - `llmService` — owns provider selection (reads `UserSettings`), enforces cost cap BEFORE calling provider, logs `LlmUsage` AFTER call.
  - `embeddingService` — generate + upsert + semantic search. Hook into `contextService.create` and `contextService.update` when content changes.
  - `contextMapService` — build the synthesis prompt, call `llmService`, parse + validate the JSON response, upsert to `ContextMap`, handle partial failures.
- **API routes:**
  - `/api/context/search` extended with `mode=text|semantic|hybrid` query param.
  - `/api/context/map` GET.
  - `/api/context/map/refresh` POST (dual auth: user JWT or `x-cron-secret`).
  - `/api/llm/usage` GET for the settings panel.
  - `/api/llm/providers` GET returning `[{kind, available, models: [{id, tier, preview, contextTokens, costPer1Min, costPer1Mout}]}]` for the settings UI.
- **React Query hooks:** `useContextMap()`, `useRefreshContextMap()`, `useLlmUsage()`, `useLlmProviders()`, extend `useContextSearch` with mode param.
- **UI components:**
  - `context-map-card.tsx` — top-of-page synthesis card with 5 sections + refresh button + last-regen timestamp + model badge.
  - `llm-usage-panel.tsx` — settings panel showing today's spend with soft/hard cap progress bars.
  - `llm-provider-picker.tsx` — provider dropdown + model tier dropdown in settings, with availability dots and preview badges.
  - `semantic-search-toggle.tsx` — optional mode switch on the context search bar.
- **MCP tools:** 5 new tools in a new `lib/mcp/tools/llm-tools.ts` handler. New Set `LLM_TOOL_NAMES` in `lib/mcp/server.ts` dispatch.
- **Zustand:** extend `uiStore` with Context Map display state (which section is expanded, which filter-from-map is active).

## Data Model Changes

```prisma
enum ChatProviderKind {
  GEMINI
  OPENAI
  ANTHROPIC
}

model ContextEntry {
  // existing fields
  embedding  Unsupported("vector(1536)")?
}

model ContextMap {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  content        Json     // { themes, principles, projects, tensions, orphans }
  provider       ChatProviderKind
  model          String
  inputTokens    Int
  outputTokens   Int
  costCents      Int
  generatedAt    DateTime @default(now())
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model LlmUsage {
  id                 String           @id @default(cuid())
  userId             String
  user               User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider           ChatProviderKind
  model              String
  purpose            String           // "map_refresh", "ask_context", "suggest_connections", etc.
  promptTokens       Int
  completionTokens   Int
  estimatedCostCents Int
  createdAt          DateTime         @default(now())

  @@index([userId, createdAt])
}

model UserSettings {
  // existing fields
  chatProvider  ChatProviderKind @default(GEMINI)
  chatModel     String?
}
```

**Migrations:**

1. `enable_pgvector` — raw SQL `CREATE EXTENSION IF NOT EXISTS vector;`
2. `add_embedding_column` — `ALTER TABLE "ContextEntry" ADD COLUMN "embedding" vector(1536);` plus optional HNSW index at the end of backfill.
3. `add_context_map_and_usage` — new tables + enum + UserSettings extension.

Each migration is hand-written and applied via `prisma migrate deploy` to avoid the DZ-2 `search_vector` drop trap.

## API Contract

### `GET /api/context/search?q=...&mode=text|semantic|hybrid&limit=N`

Returns a ranked list. `hybrid` (default) blends tsvector match rank and 1 minus cosine distance with a weighted sum (weights tuned in Phase 5).

### `GET /api/context/map`

Returns the current user's `ContextMap` row or 404.

### `POST /api/context/map/refresh`

Dual auth. Body ignored. Response: the regenerated `ContextMap` row. 429 if cooldown active. 429 if hard cost cap hit. 400 if provider key missing.

### `GET /api/llm/usage?window=day|week`

Returns `{ totalCostCents, softCapCents, hardCapCents, perProvider: [{provider, costCents}], perPurpose: [{purpose, costCents}] }`.

### `GET /api/llm/providers`

Returns the provider availability + model catalog. Drives the settings picker.

## UI Flows

### `/context` top-of-page

Context Map card sits above the view switcher. Each section shows up to 5 items with a "more" link. Clicking an item filters the underlying list or graph. Refresh button shows last-regen time + model used. Disabled during cooldown.

### `/settings` → AI panel

- **Provider** dropdown (Gemini / OpenAI / Anthropic) with green/amber dots.
- **Model tier** dropdown (Cheap / Balanced / Best) filtered by the chosen provider, showing model ID + price + preview status.
- **Usage panel** below: today's spend, soft/hard cap progress bars, per-provider breakdown.

### First-run

If the user opens `/context` before the first map is generated, the card shows an empty state with "Generate your first map" CTA, which calls `/api/context/map/refresh`.

## Cache Invalidation

- `POST /api/context/map/refresh` → invalidate `queryKeys.context.map()`, `queryKeys.llm.usage()`.
- `POST/PUT /api/context` (entry create/update) → also trigger background embedding regen; no cache invalidation needed for Map (daily cron handles that).
- Settings mutation (`PATCH /api/settings`) changing provider/model → invalidate `queryKeys.settings()`, `queryKeys.llm.providers()`.

## Danger Zones Touched

- **DZ-2 (search_vector):** the new `embedding vector(1536)` column is additive and separate from `search_vector`. Still: every migration in this wave is hand-written and applied via `migrate deploy`. No `prisma migrate dev` apply at any point.
- **DZ-8 (ContextLink.userId):** the Context Map synthesis reads the entire user graph. The map service queries MUST filter by userId on every Prisma call (including the graph traversal inside the synthesis).
- **NEW: DZ-9 (LLM cost runaway).** A bug in the cost-cap check, a retry storm on a 500 response, or an infinite-loop in the cron could produce a billing event. Mitigations:
  1. Cost cap check is in exactly ONE place (`llmService.requestBudget(userId, estimatedCostCents)`) and is called synchronously BEFORE every provider invocation. No bypass path.
  2. Retry helper uses capped exponential backoff with a max of 3 retries and never retries on 4xx.
  3. Cron route requires `x-cron-secret` header OR user JWT; no unauthenticated path.
  4. Provider-side monthly hard limits (set by the user in each provider's billing dashboard) are the backstop.

## Out of Scope (deferred)

- **File attachments in context entries** → Wave 4. Embedding pipeline is designed to accept multimodal inputs (PDF, image, audio, video up to Gemini Embedding 2's per-modality caps) so Wave 4 plugs in without schema changes.
- **Streaming responses for map refresh** → Wave 3+. First version returns the full JSON blob.
- **Per-purpose or per-tool cost caps** → Wave 8. Today the cap is global per user per day.
- **Provider-specific structured output modes** → Wave 2 uses a prompt-level JSON contract; provider-native JSON mode is a nice-to-have.
- **Map versioning / history** → Wave 8. Today we overwrite the map on refresh.
- **Multi-user map sharing** → never in scope for a single-user app.

## User-Side Prerequisites (BLOCK Phase 1)

Wave 2 has real runtime cost risk. These 6 items must be done by the user before Phase 1 code lands (~15-20 minutes):

1. **Provision `GEMINI_API_KEY`** (aistudio.google.com/apikey) and add to Dokploy env. Required for embeddings (no alternative); also powers the default chat provider. Set a monthly hard cap in the Google Cloud billing console as a backstop.
2. **Provision `OPENAI_API_KEY`** and add to Dokploy env. Required only if the user wants to select OpenAI as their chat provider. Set a monthly hard cap in the OpenAI dashboard.
3. **Provision `ANTHROPIC_API_KEY`** and add to Dokploy env. Required only if the user wants to select Anthropic. Set a monthly hard cap in the Anthropic console.
4. **Verify pgvector availability** on dev and prod Postgres: `SELECT * FROM pg_available_extensions WHERE name = 'vector';` If not available, Dokploy Postgres image must be swapped to `pgvector/pgvector:pg16` (or matching version) before Phase 1.
5. **Confirm cost caps.** Defaults: $2/day soft warning, $10/day hard refuse. Adjust in `packages/llm/src/pricing.ts` constants if desired before Phase 2.
6. **Decide cron invocation path** (Dokploy scheduled tasks vs GitHub Actions) and **add `CRON_SECRET`** env to Dokploy (`openssl rand -hex 32`).

If items 2 or 3 are deferred, the app runs with just Gemini and the settings picker shows OpenAI/Anthropic as "add API key to enable" — safe degradation, not a blocker.

## Open Questions

- Gemini 3.x Preview models charge preview-tier pricing; will check at Phase 1 against https://ai.google.dev/gemini-api/docs/pricing. Preview models can be deprecated with 2 weeks notice, so the model catalog will include a `previewDeprecatesAt` field if surfaced by the docs.
- HNSW vs IVFFlat index on the embedding column: decision at Phase 4 after measuring backfill time. Likely HNSW given graph sizes are small.
- Structured output: use each provider's JSON mode or prompt-level contract? Phase 2.3 decision.

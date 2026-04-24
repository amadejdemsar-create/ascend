-- Wave 2, Phase 1.6: AI-native schema changes
--
-- PURPOSE: Adds the ChatProviderKind enum, ContextEntry.embedding column,
-- UserSettings table, ContextMap table, and LlmUsage table.
--
-- DEPENDENCIES: Migration 20260425000001_enable_pgvector must be applied first
-- (provides the vector data type).
--
-- DZ-2 SAFETY: This migration does NOT touch search_vector, its GIN index
-- (ContextEntry_search_vector_idx), or the context_entry_search_vector_update
-- trigger/function. Those are invisible to Prisma and must be preserved.
--
-- ROLLBACK (reverse order):
--   DROP TABLE IF EXISTS "LlmUsage";
--   DROP TABLE IF EXISTS "ContextMap";
--   DROP TABLE IF EXISTS "UserSettings";
--   ALTER TABLE "ContextEntry" DROP COLUMN IF EXISTS "embedding";
--   DROP TYPE IF EXISTS "ChatProviderKind";

-- CreateEnum
CREATE TYPE "ChatProviderKind" AS ENUM ('GEMINI', 'OPENAI', 'ANTHROPIC');

-- AlterTable: add embedding column to ContextEntry
-- Nullable; populated asynchronously by the embedding service after entry
-- creation or content update. Dimension 1536 (matryoshka-truncated from
-- Gemini Embedding 2's native 3072).
ALTER TABLE "ContextEntry" ADD COLUMN "embedding" vector(1536);

-- CreateTable: UserSettings (one row per user, stores AI preferences)
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatProvider" "ChatProviderKind" NOT NULL DEFAULT 'GEMINI',
    "chatModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ContextMap (one row per user, stores the synthesized map)
CREATE TABLE "ContextMap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "provider" "ChatProviderKind" NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContextMap_userId_key" ON "ContextMap"("userId");

-- AddForeignKey
ALTER TABLE "ContextMap" ADD CONSTRAINT "ContextMap_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: LlmUsage (one row per LLM call, for cost tracking)
CREATE TABLE "LlmUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ChatProviderKind" NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "estimatedCostCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: composite for daily rollup queries
CREATE INDEX "LlmUsage_userId_createdAt_idx" ON "LlmUsage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "LlmUsage" ADD CONSTRAINT "LlmUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

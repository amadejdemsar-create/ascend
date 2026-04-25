/**
 * Embedding Service.
 *
 * Manages vector embeddings for context entries using Gemini Embedding 2
 * (1536 dimensions). All embedding operations go through llmService.requestBudget
 * to enforce cost caps (DZ-9).
 *
 * Vector reads and writes use Prisma raw SQL ($queryRaw / $executeRaw)
 * because the embedding column is Unsupported("vector(1536)") in the
 * Prisma schema and cannot be accessed through the typed client.
 *
 * Follows the const-object service pattern (see goal-service.ts).
 * userId is always the first parameter. Every raw SQL query includes
 * userId in the WHERE clause (safety rule 1).
 *
 * Provider API keys are read at runtime (inside method calls), NOT at
 * module-init time, so a missing key during build does not crash the app.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "../../generated/prisma/client";
import {
  GeminiEmbeddingProvider,
  estimateEmbeddingCostCents,
  withRetry,
  MissingApiKeyError,
} from "@ascend/llm";
import { llmService } from "./llm-service";

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Build a GeminiEmbeddingProvider by reading the API key from env at call time.
 * Throws MissingApiKeyError if GEMINI_API_KEY is not set.
 */
function buildEmbeddingProvider(): GeminiEmbeddingProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError("GEMINI_API_KEY");
  }
  return new GeminiEmbeddingProvider(apiKey);
}

/**
 * Rough token estimate for embedding input.
 * Uses 1 token per 4 characters, Math.ceil to never underestimate.
 */
function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}

/**
 * Convert a number[] embedding vector to the pgvector text literal format.
 * Example output: '[0.123,0.456,...,0.789]'
 */
function vectorToLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

// ── Service ─────────────────────────────────────────────────────

export const embeddingService = {
  /**
   * Generate an embedding for arbitrary text.
   *
   * Used by upsertEmbeddingForEntry (for context entry content) and by
   * searchSemantic (for the query vector). Every call goes through the
   * budget gate to enforce DZ-9 cost caps.
   *
   * Flow:
   * 1. Estimate cost from character count
   * 2. requestBudget (throws on hard cap)
   * 3. Call Gemini Embedding 2 with retry
   * 4. Log LlmUsage with purpose="embedding"
   * 5. Return the embedding vector
   */
  async embed(userId: string, text: string): Promise<number[]> {
    const provider = buildEmbeddingProvider();

    // 1. Estimate cost
    const estimatedTokens = estimateTokensFromChars(text.length);
    const estimatedCost = estimateEmbeddingCostCents(estimatedTokens);

    // 2. Budget gate (DZ-9). Must happen before provider call.
    await llmService.requestBudget(userId, estimatedCost);

    // 3. Call provider with retry
    const result = await withRetry(() =>
      provider.embed({
        model: "gemini-embedding-2",
        text,
        outputDimensionality: 1536,
      }),
    );

    // 4. Log usage with real token count
    const realCost = estimateEmbeddingCostCents(result.promptTokens);

    await prisma.llmUsage.create({
      data: {
        userId,
        provider: "GEMINI",
        model: "gemini-embedding-2",
        purpose: "embedding",
        promptTokens: result.promptTokens,
        completionTokens: 0, // embeddings have no completion tokens
        estimatedCostCents: realCost,
      },
    });

    // 5. Return embedding vector
    return result.embedding;
  },

  /**
   * Read a context entry's content, generate its embedding, and write it
   * to ContextEntry.embedding via raw SQL.
   *
   * userId-scoped on both reads and writes (safety rule 1).
   * Idempotent: safe to call repeatedly; overwrites any existing embedding.
   */
  async upsertEmbeddingForEntry(
    userId: string,
    entryId: string,
  ): Promise<void> {
    // Read entry with ownership check
    const entry = await prisma.contextEntry.findFirst({
      where: { id: entryId, userId },
      select: { id: true, title: true, content: true },
    });

    if (!entry) {
      throw new Error("Context entry not found");
    }

    // Concatenate title + content for embedding input
    const textToEmbed = `${entry.title}\n\n${entry.content ?? ""}`.trim();

    if (textToEmbed.length === 0) {
      // Nothing to embed; skip silently
      return;
    }

    // Generate embedding (budget gate is inside embed())
    const embedding = await embeddingService.embed(userId, textToEmbed);

    // Write via raw SQL because Prisma cannot handle Unsupported("vector(1536)")
    // Safety rule 1: userId is in the WHERE clause
    const vectorLiteral = vectorToLiteral(embedding);
    await prisma.$executeRaw`
      UPDATE "ContextEntry"
      SET embedding = ${vectorLiteral}::vector
      WHERE id = ${entryId} AND "userId" = ${userId}
    `;
  },

  /**
   * Semantic search across context entries using cosine distance.
   *
   * Generates a query embedding, then queries ContextEntry rows
   * ordered by cosine similarity (1 - cosine_distance). Rows with
   * NULL embedding are excluded automatically by the <=> operator.
   *
   * userId-scoped (safety rule 1). Uses raw SQL because Prisma
   * does not support pgvector operators.
   *
   * Returns top N entries sorted by similarity (higher is better).
   */
  async searchSemantic(
    userId: string,
    query: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      title: string;
      content: string | null;
      type: string;
      similarity: number;
    }>
  > {
    // Generate query embedding (budget gate is inside embed())
    const queryEmbedding = await embeddingService.embed(userId, query);

    const vectorLiteral = vectorToLiteral(queryEmbedding);

    // cosine distance operator <=> returns distance in [0, 2].
    // similarity = 1 - distance, so higher is better.
    // Safety rule 1: userId is in the WHERE clause.
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        content: string | null;
        type: string;
        similarity: number;
      }>
    >(
      Prisma.sql`
        SELECT
          id,
          title,
          content,
          type::text,
          1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
        FROM "ContextEntry"
        WHERE "userId" = ${userId}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorLiteral}::vector ASC
        LIMIT ${limit}
      `,
    );

    return results;
  },
};

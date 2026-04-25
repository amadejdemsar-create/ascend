/**
 * Cost estimation helpers.
 *
 * All calculations use integer cents per 1M tokens from the pricing table,
 * and Math.ceil to ensure we never underestimate. Budget gates should always
 * round up so the hard cap is never accidentally exceeded.
 */

import type { ChatProviderKind } from "./types";
import { PRICING_TABLE, EMBEDDING_PRICING } from "./pricing";

/**
 * Estimate the cost of a chat completion in integer cents.
 *
 * Returns Math.ceil of the actual cost so budget gates never underestimate.
 * Throws if the provider:model combination is not in the pricing table.
 */
export function estimateCostCents(args: {
  provider: ChatProviderKind;
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const key = `${args.provider}:${args.model}`;
  const pricing = PRICING_TABLE[key];
  if (!pricing) {
    throw new Error(
      `No pricing data for ${key}. Check that the model is registered in the pricing table.`,
    );
  }

  const inputCost =
    (args.promptTokens * pricing.inputCentsPerMillion) / 1_000_000;
  const outputCost =
    (args.completionTokens * pricing.outputCentsPerMillion) / 1_000_000;

  return Math.ceil(inputCost + outputCost);
}

/**
 * Estimate the cost of an embedding request in integer cents.
 *
 * Uses the fixed gemini-embedding-2 pricing. Math.ceil so budget gates
 * never underestimate.
 */
export function estimateEmbeddingCostCents(promptTokens: number): number {
  const cost =
    (promptTokens * EMBEDDING_PRICING.inputCentsPerMillion) / 1_000_000;
  return Math.ceil(cost);
}

import { z, ZodError } from "zod";
import { blockDocumentService } from "@/lib/services/block-document-service";
import { blockOpAddSchema, blockOpUpdateSchema, blockOpMoveSchema } from "@ascend/core";

type McpContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(result: unknown): McpContent {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

function fail(message: string): McpContent {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

// ── Zod schemas for MCP arg validation ──────────────────────────────
//
// Compose the existing @ascend/core block operation schemas with an
// entryId field. The JSON Schema in schemas.ts tells MCP clients what
// to send; these Zod schemas catch malformed input at runtime.

const getBlocksSchema = z.object({
  entryId: z.string().min(1),
});

const addBlockSchema = blockOpAddSchema.extend({
  entryId: z.string().min(1),
});

const updateBlockSchema = blockOpUpdateSchema.extend({
  entryId: z.string().min(1),
  blockId: z.string().min(1),
});

const moveBlockSchema = blockOpMoveSchema.extend({
  entryId: z.string().min(1),
});

const deleteBlockSchema = z.object({
  entryId: z.string().min(1),
  blockId: z.string().min(1),
});

/**
 * Handle block-level MCP tool calls.
 *
 * Five tools: get_blocks, add_block, update_block, move_block, delete_block.
 *
 * All operations delegate to blockDocumentService which enforces
 * userId-scoping (safety rule 1). No LLM calls involved.
 */
export async function handleBlockTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  try {
    switch (name) {
      case "get_blocks": {
        const { entryId } = getBlocksSchema.parse(args);
        const result = await blockDocumentService.getByEntryId(userId, entryId);
        if (!result) {
          return ok({ snapshot: null, version: 0 });
        }
        return ok(result);
      }

      case "add_block": {
        const { entryId, ...op } = addBlockSchema.parse(args);
        const result = await blockDocumentService.addBlock(userId, entryId, op);
        return ok(result);
      }

      case "update_block": {
        const { entryId, blockId, patch } = updateBlockSchema.parse(args);
        const result = await blockDocumentService.updateBlock(
          userId,
          entryId,
          blockId,
          patch,
        );
        return ok(result);
      }

      case "move_block": {
        const { entryId, ...op } = moveBlockSchema.parse(args);
        const result = await blockDocumentService.moveBlock(userId, entryId, op);
        return ok(result);
      }

      case "delete_block": {
        const { entryId, blockId } = deleteBlockSchema.parse(args);
        const result = await blockDocumentService.deleteBlock(
          userId,
          entryId,
          blockId,
        );
        return ok(result);
      }

      default:
        return fail(`Unknown block tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(`Validation error: ${JSON.stringify(error.issues)}`);
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

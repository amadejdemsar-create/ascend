import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { blockDocumentService } from "@/lib/services/block-document-service";
import { blockOpMoveSchema } from "@/lib/validations";

/**
 * POST /api/context/[id]/blocks/move
 *
 * Reorder a block within the document. The block is identified by
 * blockId (its Lexical key) and repositioned relative to a target
 * specified via beforeId, afterId, or parentId.
 *
 * Body validated via blockOpMoveSchema (requires at least one of
 * beforeId, afterId, parentId via Zod refine).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const op = blockOpMoveSchema.parse(body);
    const result = await blockDocumentService.moveBlock(auth.userId, id, op);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { blockDocumentService } from "@/lib/services/block-document-service";
import { blockOpUpdateSchema } from "@/lib/validations";

type Params = Promise<{ id: string; blockId: string }>;

/**
 * PATCH /api/context/[id]/blocks/[blockId]
 *
 * Update a single block's properties via shallow merge. The patch
 * object is merged into the block identified by blockId (its Lexical
 * key). Structural fields (key, type, children) are protected from
 * accidental overwrite.
 *
 * Body validated via blockOpUpdateSchema.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id, blockId } = await params;
    const body = await request.json();
    const data = blockOpUpdateSchema.parse(body);
    const result = await blockDocumentService.updateBlock(
      auth.userId,
      id,
      blockId,
      data.patch,
    );
    return NextResponse.json(result);
  } catch (error) {
    // Surface "Block <id> not found" as 404
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return handleApiError(error);
  }
}

/**
 * DELETE /api/context/[id]/blocks/[blockId]
 *
 * Remove a single block from the document. If removing the last block,
 * an empty paragraph is inserted to maintain Lexical's non-empty root
 * invariant.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id, blockId } = await params;
    await blockDocumentService.deleteBlock(auth.userId, id, blockId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Surface "Block <id> not found" as 404
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return handleApiError(error);
  }
}

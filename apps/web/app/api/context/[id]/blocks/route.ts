import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { blockDocumentService } from "@/lib/services/block-document-service";
import { blockOpAddSchema } from "@/lib/validations";

/**
 * GET /api/context/[id]/blocks
 *
 * Return the current block document snapshot for a context entry,
 * or 404 if the entry has no block document yet.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const doc = await blockDocumentService.getByEntryId(auth.userId, id);
    if (!doc) {
      return NextResponse.json(
        { error: "No block document for this entry" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      snapshot: doc.snapshot,
      version: doc.version,
      extractedText: doc.extractedText,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/context/[id]/blocks
 *
 * LLM-friendly endpoint: add a new block at a specified position.
 * Body validated via blockOpAddSchema.
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
    const op = blockOpAddSchema.parse(body);
    const result = await blockDocumentService.addBlock(auth.userId, id, op);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

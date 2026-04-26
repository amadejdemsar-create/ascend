import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import {
  blockDocumentService,
  BlockDocumentSizeError,
  BlockDocumentDecodeError,
} from "@/lib/services/block-document-service";
import { syncBlockUpdateSchema } from "@/lib/validations";

/**
 * POST /api/context/[id]/blocks/sync
 *
 * Apply a Yjs update with a client-supplied snapshot. Handles version
 * conflicts gracefully: returns conflict=true with the latest snapshot
 * so the client can merge via Yjs CRDT semantics and retry.
 *
 * The 256 KiB decoded update cap is enforced by the service layer.
 * An additional pre-parse Content-Length check short-circuits before
 * reading the body for clearly oversized payloads (base64 encodes
 * 3 bytes as 4 chars, so 256 KiB decoded is ~341 KiB encoded; we use
 * a generous 512 KiB raw body limit to account for the snapshot field).
 */

const MAX_RAW_BODY_BYTES = 512 * 1024; // 512 KiB pre-parse limit

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    // Pre-parse size check via Content-Length header
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RAW_BODY_BYTES) {
      return NextResponse.json(
        { error: "Payload too large", limit: MAX_RAW_BODY_BYTES },
        { status: 413 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const data = syncBlockUpdateSchema.parse(body);

    const result = await blockDocumentService.applySync(
      auth.userId,
      id,
      data.update,
      data.expectedVersion,
      data.snapshot,
    );

    // Both conflict and success return 200. The client reads the
    // `conflict` flag to decide whether to merge and retry.
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BlockDocumentSizeError) {
      return NextResponse.json(
        {
          error: "Payload too large",
          actual: error.actual,
          limit: error.limit,
        },
        { status: 413 },
      );
    }
    if (error instanceof BlockDocumentDecodeError) {
      return NextResponse.json(
        { error: "Invalid base64 in update field" },
        { status: 400 },
      );
    }
    return handleApiError(error);
  }
}

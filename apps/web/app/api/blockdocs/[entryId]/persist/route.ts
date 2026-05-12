import { NextRequest, NextResponse } from "next/server";
import { verifyCrdtPersistSecret, handleApiError } from "@/lib/auth";
import { crdtPersistBodySchema } from "@/lib/validations";
import { blockDocumentService } from "@/lib/services/block-document-service";

export const maxDuration = 30;

/**
 * POST /api/blockdocs/[entryId]/persist
 *
 * INTERNAL endpoint called exclusively by the Hocuspocus CRDT server
 * to persist Yjs document state. Authenticated via x-crdt-secret header
 * (timing-safe compare against CRDT_PERSIST_SECRET), NOT via user JWT
 * or API key. This is a server-to-server trust boundary.
 *
 * Body: { state: base64, snapshot?: unknown, version?: number }
 *
 * The service method (persistFromCrdt) intentionally bypasses userId
 * scoping because the auth boundary is the shared secret. See DZ-23
 * and DZ-24 in CLAUDE.md for the full security rationale.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  // Auth: verify CRDT persist secret (server-to-server only)
  if (!verifyCrdtPersistSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { entryId } = await params;
    const body = await request.json();
    const data = crdtPersistBodySchema.parse(body);

    const result = await blockDocumentService.persistFromCrdt(
      entryId,
      data.state,
      data.snapshot,
    );

    return NextResponse.json({ ok: true, version: result.version });
  } catch (error) {
    return handleApiError(error);
  }
}

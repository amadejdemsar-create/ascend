import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { blockMigrationService } from "@/lib/services/block-migration-service";

/**
 * POST /api/context/[id]/blocks/migrate
 *
 * One-shot conversion of an entry's existing markdown content to a
 * BlockDocument. Idempotent: re-calling on an already-migrated entry
 * returns the existing block document metadata without modification.
 *
 * No request body needed. The entry's current `content` field is the
 * migration source.
 *
 * Returns 201 on first migration, 200 on idempotent re-call. The caller
 * can distinguish by checking the status code if needed, but both
 * responses carry the same shape: { blockDocumentId, version }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;

    // Check if already migrated to determine the correct status code.
    // migrateEntryToBlocks is idempotent: returns existing if present.
    // We peek at the entry's blockDocumentId beforehand to know if this
    // is a first-time migration (201) or idempotent re-call (200).
    const existing = await blockDocumentService_getExisting(auth.userId, id);

    const result = await blockMigrationService.migrateEntryToBlocks(
      auth.userId,
      id,
    );

    const status = existing ? 200 : 201;
    return NextResponse.json(result, { status });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Lightweight check for existing block document. Used only to determine
 * the correct status code (201 vs 200). Imported from
 * blockDocumentService to stay within the service layer.
 */
async function blockDocumentService_getExisting(
  userId: string,
  entryId: string,
): Promise<boolean> {
  // Import here to avoid circular dependency concerns at the module level.
  // blockDocumentService.getByEntryId does a full ownership-scoped read.
  const { blockDocumentService } = await import(
    "@/lib/services/block-document-service"
  );
  const doc = await blockDocumentService.getByEntryId(userId, entryId);
  return doc !== null;
}

import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { presignUploadSchema } from "@/lib/validations";
import { fileService } from "@/lib/services/file-service";
import { contextService } from "@/lib/services/context-service";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const input = presignUploadSchema.parse(body);

    let contextEntryId: string | undefined;

    if (input.createEntry) {
      // Auto-create a ContextEntry of type SOURCE for this file.
      // contextService.create requires content with min(1), so we use a
      // minimal placeholder. The extraction pipeline will populate the
      // entry's extractedText once processing completes.
      const entry = await contextService.create(auth.userId, auth.workspaceId, {
        title: input.filename,
        content: `(file: ${input.filename})`,
      });
      // Set the type to SOURCE (createContextSchema does not include type;
      // the entry defaults to NOTE, so we update immediately).
      await contextService.updateType(auth.userId, auth.workspaceId, entry.id, "SOURCE");
      contextEntryId = entry.id;
    } else if (input.entryId) {
      // Verify the entry exists and belongs to this user.
      const entry = await contextService.getById(auth.userId, auth.workspaceId, input.entryId);
      if (!entry) {
        return NextResponse.json(
          { error: "Context entry not found" },
          { status: 404 },
        );
      }
      contextEntryId = entry.id;
    }

    const result = await fileService.createPresignedUpload(
      auth.userId,
      auth.workspaceId,
      input,
      contextEntryId,
    );

    return NextResponse.json(
      { ...result, contextEntryId: contextEntryId ?? null },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

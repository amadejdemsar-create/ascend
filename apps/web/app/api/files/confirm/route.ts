import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { confirmUploadSchema } from "@/lib/validations";
import { fileService } from "@/lib/services/file-service";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const input = confirmUploadSchema.parse(body);
    const file = await fileService.confirmUpload(
      auth.userId,
      input.fileId,
      input.sha256,
    );
    return NextResponse.json({ file: fileService.serializeFile(file) });
  } catch (error) {
    return handleApiError(error);
  }
}

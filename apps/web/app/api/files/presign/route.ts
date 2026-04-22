import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { presignUploadSchema } from "@/lib/validations";
import { fileService } from "@/lib/services/file-service";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const input = presignUploadSchema.parse(body);
    const result = await fileService.createPresignedUpload(auth.userId, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

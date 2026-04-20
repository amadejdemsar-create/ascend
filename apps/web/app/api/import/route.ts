import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { runImport } from "@/lib/services/import-helpers";
import { importDataSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = importDataSchema.parse(body);
    const summary = await runImport(auth.userId, data);
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

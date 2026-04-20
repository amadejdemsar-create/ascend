import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { goalService } from "@/lib/services/goal-service";
import { addProgressSchema } from "@/lib/validations";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const data = addProgressSchema.parse(body);
    const log = await goalService.logProgress(auth.userId, id, data);
    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const history = await goalService.getProgressHistory(auth.userId, id);
    return NextResponse.json(history);
  } catch (error) {
    return handleApiError(error);
  }
}

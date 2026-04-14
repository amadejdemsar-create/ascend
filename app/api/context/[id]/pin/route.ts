import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { contextService } from "@/lib/services/context-service";
import { z } from "zod";

const togglePinSchema = z.object({ isPinned: z.boolean().optional() });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();
  try {
    const { id } = await params;
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const data = togglePinSchema.parse(body);
    const entry = await contextService.togglePin(auth.userId, id, data.isPinned);
    return NextResponse.json(entry);
  } catch (error) {
    return handleApiError(error);
  }
}

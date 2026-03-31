import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { goalService } from "@/lib/services/goal-service";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const tree = await goalService.getTree(auth.userId);
    return NextResponse.json(tree);
  } catch (error) {
    return handleApiError(error);
  }
}

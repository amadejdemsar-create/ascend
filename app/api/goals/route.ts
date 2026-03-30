import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { goalService } from "@/lib/services/goal-service";
import { createGoalSchema, goalFiltersSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const rawFilters: Record<string, string | null> = {};
    if (searchParams.has("horizon")) rawFilters.horizon = searchParams.get("horizon");
    if (searchParams.has("status")) rawFilters.status = searchParams.get("status");
    if (searchParams.has("categoryId")) rawFilters.categoryId = searchParams.get("categoryId");
    if (searchParams.has("parentId")) rawFilters.parentId = searchParams.get("parentId");

    const filters = goalFiltersSchema.parse(rawFilters);
    const goals = await goalService.list(auth.userId, filters);
    return NextResponse.json(goals);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createGoalSchema.parse(body);
    const goal = await goalService.create(auth.userId, data);
    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

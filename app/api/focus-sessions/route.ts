import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { focusService } from "@/lib/services/focus-service";
import {
  createFocusSessionSchema,
  focusSessionFiltersSchema,
} from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const rawFilters: Record<string, string | null> = {};
    if (searchParams.has("todoId")) rawFilters.todoId = searchParams.get("todoId");
    if (searchParams.has("goalId")) rawFilters.goalId = searchParams.get("goalId");
    if (searchParams.has("dateFrom")) rawFilters.dateFrom = searchParams.get("dateFrom");
    if (searchParams.has("dateTo")) rawFilters.dateTo = searchParams.get("dateTo");

    const filters = focusSessionFiltersSchema.parse(rawFilters);
    const sessions = await focusService.list(auth.userId, filters);
    return NextResponse.json(sessions);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createFocusSessionSchema.parse(body);
    const session = await focusService.create(auth.userId, data);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

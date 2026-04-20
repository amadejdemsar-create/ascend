import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoService } from "@/lib/services/todo-service";
import { createTodoSchema, todoFiltersSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const rawFilters: Record<string, string | null> = {};
    if (searchParams.has("status")) rawFilters.status = searchParams.get("status");
    if (searchParams.has("priority")) rawFilters.priority = searchParams.get("priority");
    if (searchParams.has("categoryId")) rawFilters.categoryId = searchParams.get("categoryId");
    if (searchParams.has("goalId")) rawFilters.goalId = searchParams.get("goalId");
    if (searchParams.has("dateFrom")) rawFilters.dateFrom = searchParams.get("dateFrom");
    if (searchParams.has("dateTo")) rawFilters.dateTo = searchParams.get("dateTo");
    if (searchParams.has("isBig3")) rawFilters.isBig3 = searchParams.get("isBig3");

    const filters = todoFiltersSchema.parse(rawFilters);
    const todos = await todoService.list(auth.userId, filters);
    return NextResponse.json(todos);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createTodoSchema.parse(body);
    const todo = await todoService.create(auth.userId, data);
    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

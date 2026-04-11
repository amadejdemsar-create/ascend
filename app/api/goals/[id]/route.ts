import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { goalService } from "@/lib/services/goal-service";
import { updateGoalSchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const goal = await goalService.getById(auth.userId, id);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    return NextResponse.json(goal);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateGoalSchema.parse(body);

    // A genuine NOT_COMPLETED -> COMPLETED transition runs through the
    // atomic completeWithSideEffects path so update, XP, and recurring
    // streak all roll back together on failure. Other updates (title
    // rename, priority change, re-completion that was already DONE) go
    // through plain update() — no side effects, no transaction needed.
    if (data.status === "COMPLETED") {
      const existing = await goalService.getById(auth.userId, id);
      if (!existing) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      if (existing.status !== "COMPLETED") {
        const result = await goalService.completeWithSideEffects(
          auth.userId,
          id,
          data,
        );
        return NextResponse.json(result);
      }
    }

    const goal = await goalService.update(auth.userId, id, data);
    return NextResponse.json(goal);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id } = await params;
    const goal = await goalService.delete(auth.userId, id);
    return NextResponse.json(goal);
  } catch (error) {
    return handleApiError(error);
  }
}

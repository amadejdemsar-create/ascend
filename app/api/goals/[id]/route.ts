import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { goalService } from "@/lib/services/goal-service";
import { gamificationService } from "@/lib/services/gamification-service";
import { recurringService } from "@/lib/services/recurring-service";
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

    // Check previous status before updating (for XP award on completion)
    const existing = data.status === "COMPLETED"
      ? await goalService.getById(auth.userId, id)
      : null;

    const goal = await goalService.update(auth.userId, id, data);

    // Award XP only on genuine transition to COMPLETED (not re-completion)
    if (
      data.status === "COMPLETED" &&
      existing &&
      existing.status !== "COMPLETED"
    ) {
      const xpResult = await gamificationService.awardXp(
        auth.userId,
        id,
        existing.horizon,
        existing.priority,
      );

      // Update recurring template streak if this is a recurring instance
      let streakResult = null;
      if (existing.recurringSourceId) {
        streakResult = await recurringService.completeRecurringInstance(
          auth.userId,
          id,
        );
      }

      return NextResponse.json({
        ...goal,
        _xp: xpResult,
        ...(streakResult && { _streak: streakResult }),
      });
    }

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

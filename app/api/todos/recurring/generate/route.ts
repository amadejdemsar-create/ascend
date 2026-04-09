import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { todoRecurringService } from "@/lib/services/todo-recurring-service";

/**
 * Generate recurring to-do instances.
 *
 * Without query params: generates the next due instance for each template (today only).
 * With ?start=YYYY-MM-DD&end=YYYY-MM-DD: generates instances for the entire date range.
 * The calendar uses the range variant to populate the visible month.
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    let instances;
    if (start && end) {
      instances = await todoRecurringService.generateInstancesForRange(
        auth.userId,
        new Date(start),
        new Date(end),
      );
    } else {
      instances = await todoRecurringService.generateDueInstances(auth.userId);
    }

    return NextResponse.json(instances);
  } catch (error) {
    return handleApiError(error);
  }
}

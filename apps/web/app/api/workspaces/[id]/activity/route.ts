import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { activityEventService } from "@/lib/services/activity-event-service";
import { activityFeedQuerySchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { id: workspaceId } = await params;

    // Extra defense: verify the route param matches the auth context workspace.
    // In Wave 8 single-user, every user has exactly one workspace.
    if (workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawQuery: Record<string, unknown> = {};

    // Support repeated eventType params (e.g. ?eventType=NODE_CREATED&eventType=NODE_DELETED)
    const eventTypes = searchParams.getAll("eventType");
    if (eventTypes.length > 0) {
      rawQuery.eventType = eventTypes.length === 1 ? eventTypes[0] : eventTypes;
    }
    if (searchParams.has("since")) rawQuery.since = searchParams.get("since");
    if (searchParams.has("cursor")) rawQuery.cursor = searchParams.get("cursor");
    if (searchParams.has("limit")) rawQuery.limit = searchParams.get("limit");

    const query = activityFeedQuerySchema.parse(rawQuery);

    const result = await activityEventService.list(auth.userId, workspaceId, {
      eventTypes: query.eventType,
      since: query.since,
      cursor: query.cursor,
      limit: query.limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

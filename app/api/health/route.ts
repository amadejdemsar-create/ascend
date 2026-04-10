import { NextResponse } from "next/server";
import { userService } from "@/lib/services/user-service";

export async function GET() {
  try {
    const [userCount, statsCount] = await Promise.all([
      userService.countUsers(),
      userService.countUserStats(),
    ]);

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: {
        users: userCount,
        stats: statsCount,
      },
    });
  } catch {
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: "unavailable",
    });
  }
}

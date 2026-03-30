import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const statsCount = await prisma.userStats.count();

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: {
        users: userCount,
        stats: statsCount,
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: "unavailable",
    });
  }
}

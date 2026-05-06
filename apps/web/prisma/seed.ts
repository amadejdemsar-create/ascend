import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { DEFAULT_CATEGORIES } from "../lib/constants";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Upsert test user (idempotent)
  const user = await prisma.user.upsert({
    where: { email: "amadej@ascend.local" },
    update: {},
    create: {
      email: "amadej@ascend.local",
      name: "Amadej",
      apiKey: process.env.API_KEY || "ascend-dev-key-change-me",
    },
  });

  console.log("Seeded user:", user.id, "apiKey:", user.apiKey);

  // Upsert initial stats
  await prisma.userStats.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  console.log("Seeded user stats for:", user.id);

  // Resolve the user's default workspace (created by Phase 1 seed migration).
  // Fall back to the first ACTIVE membership if defaultWorkspaceId is not set.
  let workspaceId = user.defaultWorkspaceId as string | null;
  if (!workspaceId) {
    const membership = await prisma.workspaceMembership.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      select: { workspaceId: true },
      orderBy: { createdAt: "asc" },
    });
    workspaceId = membership?.workspaceId ?? null;
  }

  if (!workspaceId) {
    console.warn("No workspace found for user; skipping category seeding.");
  }

  // Seed default categories (idempotent)
  // Using findFirst + create pattern because the composite unique includes
  // nullable parentId, and SQL NULL != NULL prevents standard upsert matching.
  let categoriesSeeded = 0;
  if (workspaceId) {
    for (const cat of DEFAULT_CATEGORIES) {
      const existing = await prisma.category.findFirst({
        where: {
          userId: user.id,
          workspaceId,
          name: cat.name,
          parentId: null,
        },
      });

      if (!existing) {
        await prisma.category.create({
          data: {
            userId: user.id,
            workspaceId,
            name: cat.name,
            color: cat.color,
            icon: cat.icon,
            sortOrder: cat.sortOrder,
          },
        });
        categoriesSeeded++;
      }
    }
  }

  console.log(
    `Seeded ${categoriesSeeded} new default categories (${DEFAULT_CATEGORIES.length} total expected) for:`,
    user.id,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

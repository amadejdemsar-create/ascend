import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

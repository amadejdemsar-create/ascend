import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // Service-layer tests hit the real Prisma client + a local Postgres
    // database. Run them serially so concurrent tests don't race for
    // the same rows. Each test uses a unique userId to isolate state.
    fileParallelism: false,
    include: ["test/**/*.test.ts"],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

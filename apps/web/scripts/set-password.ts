#!/usr/bin/env node
/**
 * Set or reset the password for an Ascend user.
 *
 * Usage:
 *   ASCEND_EMAIL=you@example.com \
 *   ASCEND_PASSWORD='<your password>' \
 *   pnpm --filter @ascend/web auth:set-password
 *
 * Constraints:
 *   - ASCEND_PASSWORD must be at least 12 characters.
 *   - ASCEND_EMAIL must match an existing User row (case-insensitive, normalized).
 *   - Exits 0 on success with a clear confirmation line.
 *   - Exits 1 on any validation error or lookup miss, with a clear message.
 *
 * This script is NOT exposed as an HTTP route. Self-serve password setting
 * would allow takeover of any user whose passwordHash is NULL (which is
 * every user before Phase 6 lands). The CLI is the only path.
 *
 * This script NEVER logs the password, the hash, or any derived material.
 */

import { authService } from "@/lib/services/auth-service";
import { userService } from "@/lib/services/user-service";

const MIN_PASSWORD_LENGTH = 12;

async function main() {
  const email = process.env.ASCEND_EMAIL?.toLowerCase().trim();
  const password = process.env.ASCEND_PASSWORD;

  if (!email) {
    console.error("ASCEND_EMAIL env var is required.");
    process.exit(1);
  }

  if (!password) {
    console.error("ASCEND_PASSWORD env var is required.");
    process.exit(1);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `ASCEND_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
    process.exit(1);
  }

  const user = await userService.findByEmail(email);
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const hash = await authService.hashPassword(password);
  await userService.setPassword(user.id, hash);

  // Intentionally DO NOT log the password or the hash.
  console.log(
    `Password set for user ${user.id} (${user.email}) at ${new Date().toISOString()}.`,
  );
  process.exit(0);
}

main().catch((err) => {
  // Do NOT include password or hash in error output. The error object might
  // reference argument values in some runtimes; strip any env-derived field.
  console.error(
    "Failed to set password:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});

/**
 * Formats an unknown error into a user-friendly toast message.
 *
 * Sanitizes raw error strings (Zod stack dumps, network failures, JSON parse
 * errors) into concise, actionable messages. Used by mutation `onError`
 * callbacks across all database view components.
 */
export function formatErrorMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  if (err instanceof Error) {
    const msg = err.message;

    // Zod validation errors (can be multi-line stack dumps).
    if (msg.startsWith("ZodError") || msg.includes("Expected ")) {
      return "Invalid input. Please check the values.";
    }

    // Network / fetch errors.
    if (msg.includes("Unexpected token") || msg.includes("Failed to fetch")) {
      return "Network error. Check your connection and try again.";
    }

    // Trim excessively long messages.
    return msg.length > 120 ? msg.slice(0, 117) + "..." : msg;
  }

  return fallback;
}

/**
 * Typed error thrown by the API client on non-2xx responses.
 *
 * Extends Error so all existing `catch (error) { if (error instanceof Error) ... }`
 * patterns continue to work without changes. Consumers that need HTTP-level
 * detail can narrow to `error instanceof ApiError` to access `status`, `body`,
 * and `statusText`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly statusText: string;

  constructor(status: number, body: unknown, statusText: string) {
    const bodyMessage =
      typeof body === "object" &&
      body !== null &&
      "message" in (body as Record<string, unknown>)
        ? String((body as Record<string, unknown>).message)
        : typeof body === "object" &&
            body !== null &&
            "error" in (body as Record<string, unknown>)
          ? String((body as Record<string, unknown>).error)
          : statusText;

    super(`API ${status} ${statusText}: ${bodyMessage}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.statusText = statusText;
  }
}

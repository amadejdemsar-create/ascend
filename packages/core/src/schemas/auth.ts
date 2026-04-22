import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(12).max(256),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = loginSchema.extend({
  name: z.string().min(1).max(100).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// Refresh takes its token from the httpOnly cookie, so body is empty.
// The empty object schema keeps a Zod parse in the route handler symmetric
// with other routes.
export const refreshSchema = z.object({}).strict();
export type RefreshInput = z.infer<typeof refreshSchema>;

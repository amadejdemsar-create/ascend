import type { ReactNode } from "react";

/**
 * Auth layout: minimal centered container with no sidebar, no header.
 *
 * The root layout (`app/layout.tsx`) already provides ThemeProvider,
 * QueryProvider, and Toaster. This layout only adds the centering
 * wrapper for auth pages (login, future registration, password reset).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}

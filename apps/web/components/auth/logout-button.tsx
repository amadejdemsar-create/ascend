"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

/**
 * Ghost button that signs the user out and redirects to /login.
 *
 * Calls POST /api/auth/logout (clears cookies server-side), then:
 *   1. Clears the React Query cache so stale user data does not persist.
 *   2. Navigates to /login.
 *   3. Forces a router refresh so middleware re-evaluates the cookie state.
 *
 * Logout is idempotent on the server, so even on a network error we
 * push the user to /login to avoid a stuck authenticated-looking state.
 */
export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleLogout() {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Idempotent: even on network failure, clear local state and redirect.
    }
    queryClient.clear();
    router.push("/login");
    router.refresh();
    toast.success("Signed out");
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className={className}
      aria-label="Sign out"
    >
      <LogOut className="mr-2 size-4" aria-hidden="true" />
      Sign out
    </Button>
  );
}

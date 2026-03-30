"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;

const headers: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.tree(),
    queryFn: async () => {
      const res = await fetch("/api/categories", { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      return res.json();
    },
  });
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { mainNavItems, secondaryNavItems } from "@/components/layout/nav-config";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { cn } from "@/lib/utils";

export function BottomTabBar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allItems = [...mainNavItems, ...secondaryNavItems];

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden">
        <div className="flex h-16 items-center justify-around">
          {allItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="size-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-colors"
          >
            <Menu className="size-5" />
            <span>Menu</span>
          </button>
        </div>
      </nav>
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}

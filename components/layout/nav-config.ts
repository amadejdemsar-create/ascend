import { LayoutDashboard, Target, CheckSquare, Settings, type LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Todos", href: "/todos", icon: CheckSquare },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const secondaryNavItems: NavItem[] = [];

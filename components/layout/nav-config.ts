import {
  LayoutDashboard,
  Target,
  CheckSquare,
  CalendarDays,
  ClipboardCheck,
  Brain,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Grouped navigation for sidebar
export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Calendar", href: "/calendar", icon: CalendarDays },
      { label: "Review", href: "/review", icon: ClipboardCheck },
    ],
  },
  {
    label: "Inputs",
    items: [
      { label: "Todos", href: "/todos", icon: CheckSquare },
    ],
  },
  {
    label: "Outputs",
    items: [
      { label: "Goals", href: "/goals", icon: Target },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { label: "Context", href: "/context", icon: Brain },
    ],
  },
];

// Flat list for mobile tab bar (most important items only, max 4 plus menu)
export const mobileNavItems: NavItem[] = [
  { label: "Todos", href: "/todos", icon: CheckSquare },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Context", href: "/context", icon: Brain },
];

// Keep mainNavItems as a flat derived list for backward compatibility
export const mainNavItems: NavItem[] = navGroups.flatMap((g) => g.items);

export const secondaryNavItems: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

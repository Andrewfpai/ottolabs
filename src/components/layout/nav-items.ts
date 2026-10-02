import {
  CalendarDays,
  ChartNoAxesColumn,
  History,
  LayoutDashboard,
  Layers,
  ListTodo,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Primary navigation. `/focus` is deliberately absent — it is a mode you
 *  enter from a running timer, not a place you browse to. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tracks", label: "Tracks", icon: Layers },
  { href: "/sessions", label: "Sessions", icon: History },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesColumn },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

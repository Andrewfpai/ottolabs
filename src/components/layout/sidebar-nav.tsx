"use client";

import { ArrowUpRight, Languages } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  NAV_ITEMS,
  SECONDARY_NAV_ITEMS,
  isActivePath,
  type NavItem,
} from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/** The HSK 5 prep app, a separate site. Unset hides the link. */
const OTTOHSK_URL = process.env.NEXT_PUBLIC_OTTOHSK_URL ?? "";

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        // min-h-11 keeps every row at a comfortable touch target on mobile.
        "group focus-visible:ring-ring relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="bg-primary absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full"
        />
      ) : null}
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-primary" : "text-muted-foreground/70",
        )}
      />
      {item.label}
    </Link>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isActivePath(pathname, item.href)}
          onNavigate={onNavigate}
        />
      ))}

      <div className="flex-1" />

      {OTTOHSK_URL ? (
        <a
          href={OTTOHSK_URL}
          className="group focus-visible:ring-ring text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Languages aria-hidden className="text-muted-foreground/70 size-4 shrink-0" />
          <span className="flex-1">OttoHSK</span>
          <ArrowUpRight aria-hidden className="size-3.5 opacity-60" />
        </a>
      ) : null}

      {SECONDARY_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isActivePath(pathname, item.href)}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

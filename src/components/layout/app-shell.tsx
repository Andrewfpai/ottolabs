"use client";

import { Menu, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { CommandPalette, openCommandPalette } from "@/features/command-palette/components/command-palette";
import { TimerBar } from "@/features/sessions/components/timer-bar";
import type { SessionWithTrack } from "@/features/sessions/server/queries";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AuthedUser } from "@/lib/auth-guard";

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="focus-visible:ring-ring flex items-center gap-2.5 rounded-lg px-1 py-1 focus-visible:ring-2 focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="bg-primary/10 ring-primary/20 text-primary font-numeric flex size-8 items-center justify-center rounded-lg text-xs font-semibold ring-1"
      >
        OL
      </span>
      <span className="text-sm font-semibold tracking-tight">OttoLabs</span>
    </Link>
  );
}

export function AppShell({
  user,
  signOutAction,
  activeSession,
  children,
}: {
  user: AuthedUser;
  signOutAction: () => Promise<void>;
  activeSession: SessionWithTrack | null;
  children: React.ReactNode;
}) {
  // The drawer is modal, so the only way out of it is a nav link, the close
  // button, Esc, or the overlay. Each nav link closes it via `onNavigate`,
  // which is why there is no effect watching the pathname here.
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      {/*
        Pinned to the viewport: exactly one screen tall and sticky, so Settings
        and the account menu sit at the bottom of the window on every page
        instead of the bottom of a long page. On a very short window only the
        nav list scrolls; the brand and the footer stay put.
      */}
      <aside className="bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r p-3 lg:flex">
        <div className="px-2 pt-2">
          <Brand />
        </div>
        <button
          type="button"
          onClick={openCommandPalette}
          className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border-sidebar-border -my-2 flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border px-1.5 text-[10px]">Ctrl K</kbd>
        </button>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="border-sidebar-border flex items-center gap-1 border-t pt-2">
          <div className="min-w-0 flex-1">
            <UserMenu user={user} signOutAction={signOutAction} />
          </div>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        {/* Grows by the notch when installed on iOS, where the page runs under the status bar. */}
        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 border-b px-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 cursor-pointer"
                aria-label="Open navigation"
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="bg-sidebar flex w-64 flex-col gap-6 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
            >
              <SheetHeader className="p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="px-2 pt-2">
                  <Brand />
                </div>
              </SheetHeader>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
              <div className="border-sidebar-border border-t pt-2">
                <UserMenu user={user} signOutAction={signOutAction} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex-1">
            <Brand />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-9 cursor-pointer"
            aria-label="Search commands"
            onClick={openCommandPalette}
          >
            <Search className="size-5" aria-hidden />
          </Button>
          <ThemeToggle />
        </header>

        <main className="min-w-0 flex-1">
          {children}
          <TimerBar initial={activeSession} />
        </main>
        <CommandPalette />
      </div>
    </div>
  );
}

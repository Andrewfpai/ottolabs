"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";

import { AnimalAvatar } from "@/components/animal-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AuthedUser } from "@/lib/auth-guard";
import { animalFromPicture } from "@/lib/avatars";

function initials(user: AuthedUser): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

export function UserMenu({
  user,
  signOutAction,
}: {
  user: AuthedUser;
  signOutAction: () => Promise<void>;
}) {
  const animal = animalFromPicture(user.image);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="hover:bg-sidebar-accent h-auto w-full cursor-pointer justify-start gap-3 px-2 py-2"
        >
          {animal ? (
            <span className="inline-flex size-8 shrink-0 overflow-hidden rounded-full">
              <AnimalAvatar id={animal} />
            </span>
          ) : (
            <Avatar className="size-8">
              {user.image ? <AvatarImage src={user.image} alt="" /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials(user)}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium">
              {user.name ?? "Signed in"}
            </span>
            <span className="text-muted-foreground block truncate text-xs font-normal">
              {user.email}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuItem asChild className="cursor-pointer gap-2">
          <Link href="/settings">
            <Settings className="size-4" aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <button
            type="submit"
            className="hover:bg-accent focus-visible:bg-accent flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

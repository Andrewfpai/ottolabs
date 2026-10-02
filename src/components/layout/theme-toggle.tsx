"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsHydrated } from "@/hooks/use-is-hydrated";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // The server cannot know the resolved theme, so the icon is only correct
  // after hydration. The placeholder occupies the same box, so swapping it in
  // costs a repaint but never a layout shift.
  const hydrated = useIsHydrated();
  const Icon = !hydrated ? Monitor : resolvedTheme === "light" ? Sun : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 cursor-pointer"
          aria-label="Change theme"
        >
          <Icon className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {OPTIONS.map((option) => {
          const OptionIcon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              className="cursor-pointer gap-2"
            >
              <OptionIcon className="size-4" aria-hidden />
              {option.label}
              {hydrated && theme === option.value ? (
                <span className="bg-primary ml-auto size-1.5 rounded-full" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

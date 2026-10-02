"use client";

import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, Search } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { NAV_ITEMS, SECONDARY_NAV_ITEMS } from "@/components/layout/nav-items";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { type Command, groupCommands } from "@/features/command-palette/lib/rank";
import {
  useActiveSession,
  usePauseSession,
  useResumeSession,
  useStartSession,
} from "@/features/sessions/hooks/use-active-session";
import { createTask } from "@/features/tasks/server/actions";
import { listTracksForPalette } from "@/features/tracks/server/actions";
import { cn } from "@/lib/utils";

/** Any button in the app can open the palette by dispatching this. */
export const OPEN_PALETTE_EVENT = "ottolabs:open-command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

/**
 * Ctrl+K (⌘K on a Mac): start a timer, jump to a page, add a task, without
 * the mouse. Mounted once in the app shell.
 *
 * The listbox follows the ARIA combobox pattern: focus stays in the input and
 * `aria-activedescendant` names the highlighted option, so screen readers
 * announce it as the arrow keys move.
 */
export function CommandPalette() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  // Reset on every close, however it closes, so it always opens clean.
  const setOpenAndReset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActive(0);
    }
  };

  const { data: session } = useActiveSession();
  const start = useStartSession();
  const pause = usePauseSession();
  const resume = useResumeSession();

  // Fetched when the palette first opens, then kept for a minute.
  const { data: tracks = [] } = useQuery({
    queryKey: ["palette", "tracks"],
    queryFn: () => listTracksForPalette(),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setActive(0);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  const close = () => setOpenAndReset(false);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];

    if (session) {
      list.push(
        session.pausedAt
          ? {
              id: "resume",
              group: "Timer",
              label: `Resume: ${session.track.title}`,
              keywords: ["timer", "continue"],
              run: () => resume.mutate({ id: session.id }),
            }
          : {
              id: "pause",
              group: "Timer",
              label: `Pause: ${session.track.title}`,
              keywords: ["timer", "stop"],
              run: () => pause.mutate({ id: session.id }),
            },
        {
          id: "focus",
          group: "Timer",
          label: "Open focus mode",
          keywords: ["fullscreen", "timer"],
          run: () => router.push("/focus"),
        },
      );
    } else {
      for (const track of tracks.filter((t) => t.status === "active")) {
        list.push(
          {
            id: `start-${track.id}`,
            group: "Start",
            label: `Start: ${track.title}`,
            keywords: ["timer", "focus", "stopwatch"],
            run: () => start.mutate({ trackId: track.id, mode: "stopwatch" }),
          },
          {
            id: `pomodoro-${track.id}`,
            group: "Start",
            label: `Start Pomodoro: ${track.title}`,
            keywords: ["timer", "focus"],
            run: () => start.mutate({ trackId: track.id, mode: "pomodoro" }),
          },
        );
      }
    }

    const title = query.trim();
    if (title) {
      list.push({
        id: "add-task",
        group: "Tasks",
        label: `Add task “${title}”`,
        keywords: ["todo", "new"],
        run: () =>
          void createTask({ title }).then((result) =>
            result.ok ? toast.success("Task added.") : toast.error(result.error),
          ),
      });
    }

    for (const item of [...NAV_ITEMS, ...SECONDARY_NAV_ITEMS]) {
      list.push({
        id: `go-${item.href}`,
        group: "Go to",
        label: item.label,
        keywords: ["page", "open"],
        run: () => router.push(item.href),
      });
    }
    for (const track of tracks) {
      list.push({
        id: `track-${track.id}`,
        group: "Go to",
        label: `Track: ${track.title}`,
        keywords: ["track"],
        run: () => router.push(`/tracks/${track.id}`),
      });
    }

    list.push({
      id: "theme",
      group: "Preferences",
      label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      keywords: ["theme", "dark", "light", "mode"],
      run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    });

    return list;
  }, [session, tracks, query, resolvedTheme, router, start, pause, resume, setTheme]);

  // Shown grouped; the arrow keys walk exactly the shown order.
  const { groups: grouped, ordered: results } = useMemo(
    () => groupCommands(commands, query),
    [commands, query],
  );

  const activeIndex = Math.min(active, Math.max(0, results.length - 1));
  const activeId = results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined;

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function runCommand(command: Command | undefined) {
    if (!command) return;
    close();
    command.run();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpenAndReset}
    >
      <DialogContent showCloseButton={false} className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Type to search commands. Use the arrow keys to choose and Enter to run.
        </DialogDescription>

        <div className="flex items-center gap-2 border-b px-3">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <input
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Search commands"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runCommand(results[activeIndex]);
              }
            }}
            placeholder="Start a timer, go to a page, add a task…"
            className="placeholder:text-muted-foreground h-12 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="text-muted-foreground hidden rounded border px-1.5 py-0.5 text-[10px] sm:inline">Esc</kbd>
        </div>

        <ul id={listId} role="listbox" aria-label="Commands" className="max-h-80 overflow-y-auto p-1.5">
          {grouped.map(({ group, items }) => (
            <li key={group} role="presentation">
              <div className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium">{group}</div>
              <ul role="presentation">
                {items.map((command) => {
                  const index = results.indexOf(command);
                  const selected = index === activeIndex;
                  return (
                    <li
                      key={command.id}
                      id={`${listId}-${command.id}`}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => setActive(index)}
                      onClick={() => runCommand(command)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm",
                        selected && "bg-muted",
                      )}
                    >
                      <span className="truncate">{command.label}</span>
                      {selected ? (
                        <CornerDownLeft className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {results.length === 0 ? (
            <li role="presentation" className="text-muted-foreground px-2 py-6 text-center text-sm">
              Nothing matches.
            </li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

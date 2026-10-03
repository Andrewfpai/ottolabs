"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  Archive,
  ArchiveRestore,
  ChartNoAxesColumn,
  ChevronDown,
  Circle,
  CircleDot,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  Timer,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { TrackIcon } from "@/components/track-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStartSession } from "@/features/sessions/hooks/use-active-session";
import type { TrackTask } from "@/features/tasks/server/queries";
import type { TrackWithStats } from "@/features/tracks/server/queries";
import {
  archiveTrack,
  deleteTrack,
  unarchiveTrack,
} from "@/features/tracks/server/actions";
import { formatCompact } from "@/lib/time/elapsed";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

function relativeDay(date: Date | null): string {
  if (!date) return "Never";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** How many open tasks a card lists before linking to the rest. */
const TASKS_SHOWN = 4;

export function TrackCard({
  track,
  tasks,
  onEdit,
  hasActiveSession,
}: {
  track: TrackWithStats;
  /** Open tasks filed under the track, in the order to pick from. */
  tasks: TrackTask[];
  onEdit: (track: TrackWithStats) => void;
  hasActiveSession: boolean;
}) {
  const start = useStartSession();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The task the next Start records to. Looked up, not stored, so a task
  // finished elsewhere simply stops being selected.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tasks.find((task) => task.id === selectedId) ?? null;
  const reduceMotion = useReducedMotion();

  const colors = trackColorClasses(track.color);
  const isArchived = track.status === "archived";
  const startDisabled = start.isPending || pending || hasActiveSession;

  function startOn(mode: "stopwatch" | "pomodoro") {
    start.mutate(
      { trackId: track.id, mode, taskId: selected?.id },
      {
        onSuccess: () => {
          setSelectedId(null);
          // Straight into focus mode, over your scene.
          router.push("/focus");
        },
      },
    );
  }

  function runAction(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "That did not work.");
    });
  }

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group bg-card relative flex flex-col rounded-xl border p-4 transition-shadow duration-200 hover:shadow-md",
        isArchived && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            colors.surface,
            colors.text,
          )}
        >
          <TrackIcon name={track.icon} className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">
            <Link
              href={isArchived ? `/tracks/${track.id}` : `/focus?track=${track.id}`}
              className="hover:underline underline-offset-4"
            >
              {track.title}
            </Link>
          </h3>
          {track.description ? (
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">
              {track.description}
            </p>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground -mt-1 -mr-1 size-8 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Actions for ${track.title}`}
            >
              <MoreVertical className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild className="cursor-pointer gap-2">
              <Link href={`/tracks/${track.id}`}>
                <ChartNoAxesColumn className="size-4" aria-hidden />
                Stats and notes
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={() => onEdit(track)}
            >
              <Pencil className="size-4" aria-hidden />
              Edit
            </DropdownMenuItem>

            {isArchived ? (
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={() =>
                  runAction(() => unarchiveTrack({ id: track.id }), "Track restored.")
                }
              >
                <ArchiveRestore className="size-4" aria-hidden />
                Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={() =>
                  runAction(() => archiveTrack({ id: track.id }), "Track archived.")
                }
              >
                <Archive className="size-4" aria-hidden />
                Archive
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer gap-2"
              onSelect={(event) => {
                // Deleting is refused server-side when sessions exist, so this
                // second click is only ever guarding a genuinely empty track.
                event.preventDefault();
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  setTimeout(() => setConfirmingDelete(false), 4000);
                  return;
                }
                runAction(() => deleteTrack({ id: track.id }), "Track deleted.");
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              {confirmingDelete ? "Click again to confirm" : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!isArchived && tasks.length > 0 ? (
        <TaskPicker
          trackId={track.id}
          tasks={tasks}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          selectedClass={cn(colors.surface, colors.text)}
        />
      ) : null}

      {/* mt-auto keeps Start on the same line across cards of different heights. */}
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div>
          <p className="font-numeric text-2xl leading-none font-medium">
            {formatCompact(track.totalMs)}
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {track.sessionCount} {track.sessionCount === 1 ? "session" : "sessions"}
            {" · "}
            {relativeDay(track.lastActiveAt)}
          </p>
        </div>

        {!isArchived ? (
          // Split control: the common case is one click, and the pomodoro
          // variant is one more. Both start the same kind of session — the
          // mode only decides whether breaks are scheduled for you.
          <div className="flex items-stretch">
            <Button
              variant="cta"
              size="lg"
              className="cursor-pointer gap-1.5 rounded-r-none"
              disabled={startDisabled}
              aria-busy={start.isPending}
              title={
                hasActiveSession
                  ? "Finish the running timer first"
                  : `Start a session on ${selected ? selected.title : track.title}`
              }
              onClick={() => startOn("stopwatch")}
            >
              {start.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Play className="size-3.5 fill-current" aria-hidden />
              )}
              Start
              {selected ? <span className="sr-only"> on {selected.title}</span> : null}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="cta"
                  size="lg"
                  className="border-cta-foreground/20 cursor-pointer rounded-l-none border-l px-1.5"
                  disabled={startDisabled}
                  aria-label={`Start options for ${track.title}`}
                >
                  <ChevronDown className="size-3.5" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onSelect={() =>
                    startOn("stopwatch")
                  }
                >
                  <Play className="size-4" aria-hidden />
                  Stopwatch
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onSelect={() =>
                    startOn("pomodoro")
                  }
                >
                  <Timer className="size-4" aria-hidden />
                  Pomodoro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

/**
 * The track's open tasks, as a pick-one list: choosing one makes Start record
 * to it. Choosing it again goes back to the track as a whole.
 */
function TaskPicker({
  trackId,
  tasks,
  selectedId,
  onSelect,
  selectedClass,
}: {
  trackId: string;
  tasks: TrackTask[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  selectedClass: string;
}) {
  const shown = tasks.slice(0, TASKS_SHOWN);
  const more = tasks.length - shown.length;

  return (
    <div className="mt-3 border-t pt-3">
      <p className="text-muted-foreground mb-1 text-xs">
        {selectedId ? "Start records to the picked task" : "Pick a task to record to"}
      </p>
      <ul className="-mx-2 space-y-0.5">
        {shown.map((task) => {
          const picked = task.id === selectedId;
          const Icon = picked ? CircleDot : Circle;
          return (
            <li key={task.id}>
              <button
                type="button"
                aria-pressed={picked}
                onClick={() => onSelect(picked ? null : task.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors",
                  picked ? selectedClass : "hover:bg-muted/60",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                {task.status === "in_progress" ? (
                  <span className="sr-only">, in progress</span>
                ) : null}
                {task.focusMs > 0 ? (
                  <span className="text-muted-foreground tabular shrink-0 text-xs">
                    {formatCompact(task.focusMs)}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {more > 0 ? (
        <Link
          href={`/tasks?track=${trackId}`}
          className="text-muted-foreground mt-1 inline-block text-xs underline-offset-4 hover:underline"
        >
          {more} more {more === 1 ? "task" : "tasks"}
        </Link>
      ) : null}
    </div>
  );
}

"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  Timer,
  Trash2,
} from "lucide-react";
import Link from "next/link";
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
import type { TrackWithStats } from "@/features/tracks/server/queries";
import {
  archiveTrack,
  deleteTrack,
  unarchiveTrack,
} from "@/features/tracks/server/actions";
import { type PlanProgress, progressLabel } from "@/features/study-plan/lib/plan";
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

export function TrackCard({
  track,
  plan,
  onEdit,
  hasActiveSession,
}: {
  track: TrackWithStats;
  /** Study plan progress, when the track has a plan. */
  plan?: PlanProgress;
  onEdit: (track: TrackWithStats) => void;
  hasActiveSession: boolean;
}) {
  const start = useStartSession();
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const reduceMotion = useReducedMotion();

  const colors = trackColorClasses(track.color);
  const isArchived = track.status === "archived";
  const startDisabled = start.isPending || pending || hasActiveSession;

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
            <Link href={`/tracks/${track.id}`} className="hover:underline underline-offset-4">
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

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-numeric text-2xl leading-none font-medium">
            {formatCompact(track.totalMs)}
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {track.sessionCount} {track.sessionCount === 1 ? "session" : "sessions"}
            {" · "}
            {relativeDay(track.lastActiveAt)}
          </p>
          {plan && plan.total > 0 ? (
            <div className="mt-2.5 w-36 max-w-full">
              <p className="text-xs font-medium">{progressLabel(track.unitLabel, plan)}</p>
              <div className={cn("mt-1 h-1 overflow-hidden rounded-full", colors.surface)} aria-hidden>
                <div className={cn("h-full rounded-full", colors.bg)} style={{ width: `${(plan.done / plan.total) * 100}%` }} />
              </div>
            </div>
          ) : null}
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
                  : `Start a session on ${track.title}`
              }
              onClick={() => start.mutate({ trackId: track.id, mode: "stopwatch" })}
            >
              {start.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Play className="size-3.5 fill-current" aria-hidden />
              )}
              Start
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
                    start.mutate({ trackId: track.id, mode: "stopwatch" })
                  }
                >
                  <Play className="size-4" aria-hidden />
                  Stopwatch
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onSelect={() =>
                    start.mutate({ trackId: track.id, mode: "pomodoro" })
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

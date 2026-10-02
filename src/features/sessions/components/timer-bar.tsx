"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Coffee, Maximize2, Pause, Play, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { TrackIcon } from "@/components/track-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FinishSessionDialog } from "@/features/sessions/components/finish-session-dialog";
import { IdleReturnDialog } from "@/features/sessions/components/idle-return-dialog";
import {
  useActiveSession,
  useDiscardSession,
  useHeartbeat,
  usePauseSession,
  useResumeSession,
} from "@/features/sessions/hooks/use-active-session";
import { useElapsed } from "@/features/sessions/hooks/use-elapsed";
import { useIdleReturn } from "@/features/sessions/hooks/use-idle-return";
import { usePomodoroEngine } from "@/features/sessions/hooks/use-pomodoro";
import { usePomodoroAlerts } from "@/features/sessions/hooks/use-pomodoro-alerts";
import {
  formatCountdown,
  phaseLabel,
  type PomodoroPhase,
} from "@/features/sessions/lib/pomodoro";
import { TIMER_LAYOUT_ID } from "@/features/sessions/lib/timer-layout";
import type { SessionWithTrack } from "@/features/sessions/server/queries";
import { formatDuration, timerState } from "@/lib/time/elapsed";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

function TimerBarInner({
  session,
  phase,
}: {
  session: SessionWithTrack;
  phase: PomodoroPhase | null;
}) {
  const [finishOpen, setFinishOpen] = useState(false);
  const [frozenMs, setFrozenMs] = useState(0);
  const elapsed = useElapsed(session);
  const state = timerState(session);
  const colors = trackColorClasses(session.track.color);
  const reduceMotion = useReducedMotion();

  const pause = usePauseSession();
  const resume = useResumeSession();
  const discard = useDiscardSession();

  const isPaused = state === "paused";
  const onBreak = phase != null && phase.kind !== "work";
  const busy = pause.isPending || resume.isPending;

  // The headline number is whatever is counting: the phase countdown during a
  // pomodoro, the running total otherwise. Same element in both cases, so it
  // morphs into the fullscreen timer rather than being replaced by it.
  const readout = phase
    ? formatCountdown(phase.remainingMs)
    : formatDuration(elapsed);
  const morph = reduceMotion
    ? { badge: undefined, readout: undefined }
    : TIMER_LAYOUT_ID;

  return (
    <>
      <div
        className={cn(
          "bg-card/95 supports-[backdrop-filter]:bg-card/80 flex items-center gap-3 rounded-2xl border p-2 pl-3 shadow-lg backdrop-blur",
          isPaused && "border-dashed",
        )}
      >
        <motion.span
          layoutId={morph.badge}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            colors.surface,
            colors.text,
          )}
        >
          <TrackIcon name={session.track.icon} />
        </motion.span>

        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-xs font-medium">
            <span className="truncate">
              {session.track.title}
              {session.task ? (
                <span className="text-muted-foreground font-normal"> · {session.task.title}</span>
              ) : null}
            </span>
            {phase ? (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 font-normal",
                  onBreak ? "text-muted-foreground" : "text-cta",
                )}
              >
                {onBreak ? <Coffee className="size-3" aria-hidden /> : null}
                {phaseLabel(phase)}
              </span>
            ) : null}
          </p>
          <motion.p
            layoutId={morph.readout}
            className={cn(
              "font-numeric text-xl leading-tight font-medium tabular-nums",
              isPaused && !onBreak && "text-muted-foreground",
            )}
            // Announce the running total sparingly rather than four times a
            // second, which would make a screen reader unusable.
            aria-live="off"
          >
            {readout}
          </motion.p>
        </div>

        <div className="ml-2 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 cursor-pointer"
                disabled={busy}
                aria-label={
                  isPaused
                    ? onBreak
                      ? "Skip the break"
                      : "Resume timer"
                    : "Pause timer"
                }
                onClick={() =>
                  isPaused
                    ? resume.mutate({ id: session.id })
                    : pause.mutate({ id: session.id })
                }
              >
                {isPaused ? (
                  <Play className="size-4" aria-hidden />
                ) : (
                  <Pause className="size-4" aria-hidden />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isPaused ? (onBreak ? "Skip break" : "Resume") : "Pause"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="size-9 cursor-pointer"
              >
                <Link href="/focus" aria-label="Enter focus mode">
                  <Maximize2 className="size-4" aria-hidden />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Focus mode</TooltipContent>
          </Tooltip>

          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-9 cursor-pointer"
                    aria-label="Discard session"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Discard</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard this session?</AlertDialogTitle>
                <AlertDialogDescription>
                  {formatDuration(elapsed)} on {session.track.title} will be
                  thrown away and not logged. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">
                  Keep timing
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer"
                  onClick={() => discard.mutate({ id: session.id })}
                >
                  Discard
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            className="cursor-pointer gap-2"
            onClick={() => {
              // Capture the elapsed time at the click, before the note dialog
              // opens — see FinishSessionDialog.
              setFrozenMs(elapsed);
              setFinishOpen(true);
            }}
          >
            <Square className="size-3.5 fill-current" aria-hidden />
            Finish
          </Button>
        </div>
      </div>

      <FinishSessionDialog
        session={session}
        frozenMs={frozenMs}
        open={finishOpen}
        onOpenChange={setFinishOpen}
      />
    </>
  );
}

/**
 * Floating bar showing the one live session, on every page.
 *
 * Absent entirely when nothing is running — a control bar that is permanently
 * present but usually empty is just furniture.
 *
 * This component is also where the three things that must exist exactly once
 * per client live: the heartbeat, the pomodoro engine, and idle detection. It
 * is mounted by the app shell on every authenticated route, so they keep
 * running even on `/focus`, where only the *visible* bar stands down in favour
 * of the fullscreen timer.
 */
export function TimerBar({ initial }: { initial: SessionWithTrack | null }) {
  const { data: session } = useActiveSession(initial);
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();

  useHeartbeat(session);
  const phase = usePomodoroEngine(session);
  usePomodoroAlerts(session, phase);
  const { awayMs, dismiss } = useIdleReturn(session?.id);

  const inFocusMode = pathname === "/focus";
  const showBar = session != null && !inFocusMode;

  return (
    <>
      {/* Keeps the last of the page's content clear of the floating bar. */}
      {showBar ? <div aria-hidden className="h-[calc(6rem+env(safe-area-inset-bottom))]" /> : null}

      {/* Unmounted outright on `/focus` rather than exit-animated. An exit
          animation would keep this bar on screen while the fullscreen timer
          mounts, and two live elements sharing a `layoutId` have nothing to
          morph between — the handoff has to happen in one commit. */}
      {inFocusMode ? null : (
        <AnimatePresence>
          {session ? (
            <motion.div
              key="timer-bar"
              initial={reduceMotion ? false : { y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto w-fit max-w-[calc(100vw-2rem)] px-4"
            >
              <TimerBarInner session={session} phase={phase} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      )}

      {session && awayMs != null ? (
        <IdleReturnDialog
          session={session}
          awayMs={awayMs}
          onResolved={dismiss}
        />
      ) : null}
    </>
  );
}

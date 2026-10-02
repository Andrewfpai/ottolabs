"use client";

import { motion, useReducedMotion } from "motion/react";
import { Coffee, Minimize2, Pause, Play, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
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
import { FinishSessionDialog } from "@/features/sessions/components/finish-session-dialog";
import { PhaseRing } from "@/features/sessions/components/phase-ring";
import {
  useActiveSession,
  useDiscardSession,
  usePauseSession,
  useResumeSession,
} from "@/features/sessions/hooks/use-active-session";
import { useElapsed } from "@/features/sessions/hooks/use-elapsed";
import { usePomodoroPhase } from "@/features/sessions/hooks/use-pomodoro";
import { formatCountdown, phaseLabel } from "@/features/sessions/lib/pomodoro";
import type { SessionWithTrack } from "@/features/sessions/server/queries";
import { formatCompact, formatDuration, timerState } from "@/lib/time/elapsed";
import { TIMER_LAYOUT_ID } from "@/features/sessions/lib/timer-layout";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

/**
 * Fullscreen focus mode.
 *
 * Covers the whole viewport, chrome included — the point of the mode is that
 * there is nothing else on screen to look at. The timer itself is the same
 * live session the mini bar shows, morphed into place with a shared `layoutId`
 * so it reads as the same object moving rather than one thing being replaced
 * by another.
 *
 * Note this does NOT run the pomodoro engine or the heartbeat. Those live in
 * the timer bar, which stays mounted underneath; running a second copy here
 * would mean two clients racing to make the same cycle transition.
 */
export function FocusScreen({ initial }: { initial: SessionWithTrack | null }) {
  const { data: session } = useActiveSession(initial);
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [finishOpen, setFinishOpen] = useState(false);
  const [frozenMs, setFrozenMs] = useState(0);

  const elapsed = useElapsed(session);
  const phase = usePomodoroPhase(session);

  // Omitting the id is how the morph is opted out of: with no pairing, both
  // sides simply render in place. `useReducedMotion` is not advice.
  const morph = reduceMotion
    ? { badge: undefined, readout: undefined }
    : TIMER_LAYOUT_ID;

  const pause = usePauseSession();
  const resume = useResumeSession();
  const discard = useDiscardSession();

  const state = session ? timerState(session) : "ended";
  const isPaused = state === "paused";
  const onBreak = phase != null && phase.kind !== "work";
  const busy = pause.isPending || resume.isPending;

  const exit = useCallback(() => {
    // Typing /focus straight into the address bar leaves nothing to go back
    // to, and "exit" must never mean "leave the app".
    if (window.history.length > 1) router.back();
    else router.push("/dashboard");
  }, [router]);

  const toggle = useCallback(() => {
    if (!session || busy) return;
    if (isPaused) resume.mutate({ id: session.id });
    else pause.mutate({ id: session.id });
  }, [session, busy, isPaused, pause, resume]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // A dialog is open, or something is being typed into: leave it alone.
      if (finishOpen) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable], [role=dialog]")) return;

      if (event.key === "Escape") {
        event.preventDefault();
        exit();
      }

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        toggle();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exit, toggle, finishOpen]);

  if (!session) {
    return (
      <div className="bg-background fixed inset-0 z-50 flex flex-col items-center justify-center p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <EmptyState
          icon={Play}
          title="Nothing is running"
          description="Focus mode is a place to be while a timer runs. Start one on a track and it opens here."
          action={
            <Button asChild variant="cta" className="cursor-pointer">
              <Link href="/tracks">Pick a track</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const colors = trackColorClasses(session.track.color);

  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between p-4">
        <span className="text-muted-foreground text-sm font-medium">
          Focus mode
        </span>
        <Button
          variant="ghost"
          size="icon-lg"
          className="cursor-pointer"
          aria-label="Exit focus mode"
          onClick={exit}
        >
          <Minimize2 className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 p-6">
        <motion.div
          layoutId={morph.badge}
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl",
            colors.surface,
            colors.text,
          )}
        >
          <TrackIcon name={session.track.icon} className="size-7" />
        </motion.div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-medium tracking-tight text-balance">
            {session.track.title}
          </h1>
          {session.task ? (
            <p className="text-muted-foreground -mt-1 text-sm text-balance">{session.task.title}</p>
          ) : null}
          {phase ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                onBreak
                  ? "bg-muted text-muted-foreground"
                  : "bg-cta/10 text-cta",
              )}
            >
              {onBreak ? <Coffee className="size-3.5" aria-hidden /> : null}
              {phaseLabel(phase)}
              {phase.completedCycles > 0 ? (
                <span className="text-muted-foreground font-normal">
                  · {phase.completedCycles} done
                </span>
              ) : null}
            </span>
          ) : null}
        </div>

        {/* The pomodoro headline is the countdown; the stopwatch headline is
            the total. Both morph from the same element in the mini bar. */}
        {phase ? (
          <PhaseRing
            progress={phase.progress}
            strokeWidth={2.5}
            tone={onBreak ? "muted" : "accent"}
            className="size-64 sm:size-80"
          >
            <div className="flex flex-col items-center gap-1">
              <motion.p
                layoutId={morph.readout}
                className={cn(
                  "font-numeric text-6xl leading-none font-medium tabular-nums sm:text-7xl",
                  isPaused && !onBreak && "text-muted-foreground",
                )}
              >
                {formatCountdown(phase.remainingMs)}
              </motion.p>
              <p className="text-muted-foreground font-numeric text-sm">
                {formatDuration(elapsed)} focused
              </p>
            </div>
          </PhaseRing>
        ) : (
          <motion.p
            layoutId={morph.readout}
            className={cn(
              "font-numeric text-7xl leading-none font-medium tabular-nums sm:text-8xl",
              isPaused && "text-muted-foreground",
            )}
          >
            {formatDuration(elapsed)}
          </motion.p>
        )}

        {phase?.isOver ? (
          <p className="text-muted-foreground max-w-[40ch] text-center text-sm">
            {phase.kind === "work"
              ? "This interval ran over while the tab was away — the extra time still counts."
              : "Break is over."}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="lg"
            className="cursor-pointer gap-2"
            disabled={busy}
            onClick={toggle}
          >
            {isPaused ? (
              <>
                <Play className="size-4" aria-hidden />
                {onBreak ? "Skip break" : "Resume"}
              </>
            ) : (
              <>
                <Pause className="size-4" aria-hidden />
                Pause
              </>
            )}
          </Button>

          <Button
            size="lg"
            className="cursor-pointer gap-2"
            onClick={() => {
              setFrozenMs(elapsed);
              setFinishOpen(true);
            }}
          >
            <Square className="size-3.5 fill-current" aria-hidden />
            Finish
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                className="text-muted-foreground hover:text-destructive cursor-pointer"
                aria-label="Discard session"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard this session?</AlertDialogTitle>
                <AlertDialogDescription>
                  {formatCompact(elapsed)} on {session.track.title} will be thrown
                  away and not logged. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">
                  Keep timing
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive cursor-pointer text-white hover:bg-destructive/90"
                  onClick={() => {
                    discard.mutate({ id: session.id });
                    exit();
                  }}
                >
                  Discard
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <p className="text-muted-foreground/70 pb-6 text-center text-xs">
        <kbd className="font-numeric">Space</kbd> pause ·{" "}
        <kbd className="font-numeric">Esc</kbd> exit
      </p>

      <FinishSessionDialog
        session={session}
        frozenMs={frozenMs}
        open={finishOpen}
        // Not wired to `exit`: the dialog closes both on save and on cancel,
        // and cancelling must not throw you out of focus mode. After a save
        // the session is null and this screen offers to start another.
        onOpenChange={setFinishOpen}
      />
    </div>
  );
}

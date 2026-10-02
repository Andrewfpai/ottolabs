"use client";

import { useEffect, useRef, useState } from "react";

import {
  useResumeSession,
  useStartBreak,
} from "@/features/sessions/hooks/use-active-session";
import {
  isOnBreak,
  pomodoroPhase,
  type PomodoroPhase,
  type PomodoroSnapshot,
} from "@/features/sessions/lib/pomodoro";
import { now as clockNow } from "@/lib/time/clock";

/** True while the tab is in the foreground. */
export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const read = () => setVisible(document.visibilityState === "visible");
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);

  return visible;
}

/**
 * The current pomodoro phase, repainted as it counts down.
 *
 * As with the main timer, the interval drives repainting only — the phase is
 * recomputed from stored timestamps every time, so a throttled tab shows the
 * right number the instant it returns. Null for stopwatch sessions.
 */
export function usePomodoroPhase(
  session: PomodoroSnapshot | null | undefined,
): PomodoroPhase | null {
  const isPomodoro = session != null && session.mode === "pomodoro";
  const isLive = isPomodoro && session.endedAt == null;
  // Two things can be counting: work (which advances with focus time) and a
  // break (which advances with the wall clock). A manual pause advances
  // neither, so there is nothing to repaint.
  const isTicking =
    isLive && (session.pausedAt == null || isOnBreak(session));

  const [tick, setTick] = useState(() => clockNow());

  useEffect(() => {
    if (!isTicking) return;
    const id = setInterval(() => setTick(clockNow()), 250);
    return () => clearInterval(id);
  }, [isTicking]);

  if (!isPomodoro) return null;

  return pomodoroPhase(session, isTicking ? tick : clockNow());
}

/**
 * Advances the pomodoro through its cycles.
 *
 * WHY ONLY WHILE THE TAB IS VISIBLE. Both transitions are wrong to make in the
 * background, in opposite directions. Auto-starting a break in a hidden tab
 * would pause the timer while you are very possibly still working — reading a
 * PDF in another window is not a break — and silently delete real focus time.
 * Auto-resuming work in a hidden tab would do the reverse and credit you for
 * time you spent away from the desk. So a hidden tab simply lets the phase run
 * over, which `pomodoroPhase` reports honestly, and the transition happens the
 * moment you are back to see it.
 *
 * Mount this exactly once, alongside the heartbeat. Two copies would race to
 * make the same transition.
 */
export function usePomodoroEngine(
  session: PomodoroSnapshot & { id: string } | null | undefined,
): PomodoroPhase | null {
  const phase = usePomodoroPhase(session);
  const visible = useDocumentVisible();
  const startBreak = useStartBreak();
  const resume = useResumeSession();

  // One transition per phase. Between firing and the refetch landing, the
  // session still reads as "over", and without this the next tick would fire
  // the same transition again.
  const firedFor = useRef<string | null>(null);

  const sessionId = session?.id ?? null;
  const isOver = phase?.isOver ?? false;
  const kind = phase?.kind ?? null;
  const completedCycles = phase?.completedCycles ?? 0;
  const busy = startBreak.isPending || resume.isPending;

  useEffect(() => {
    if (!sessionId || !isOver || !visible || busy || !kind) return;

    const key = `${sessionId}:${kind}:${completedCycles}`;
    if (firedFor.current === key) return;
    firedFor.current = key;

    // The bell is not rung here: usePomodoroAlerts rings when the phase ends,
    // even in a background tab, and this switch may come much later.
    if (kind === "work") {
      startBreak.mutate({ id: sessionId });
    } else {
      resume.mutate({ id: sessionId });
    }
  }, [sessionId, isOver, visible, busy, kind, completedCycles, startBreak, resume]);

  return phase;
}

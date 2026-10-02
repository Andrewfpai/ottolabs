"use client";

import { useEffect, useSyncExternalStore } from "react";

import { useDocumentVisible } from "@/features/sessions/hooks/use-pomodoro";
import {
  type AlertPrefs,
  claimAlert,
  DEFAULT_ALERT_PREFS,
  phaseEndMessage,
  phaseKey,
  readAlertPrefs,
  showNotification,
  subscribeAlertPrefs,
} from "@/features/sessions/lib/alerts";
import { playChime, unlockAudioOnFirstGesture } from "@/features/sessions/lib/chime";
import {
  isOnBreak,
  type PomodoroPhase,
  type PomodoroSnapshot,
  pomodoroPhase,
  sanitizeConfig,
} from "@/features/sessions/lib/pomodoro";
import { now as clockNow } from "@/lib/time/clock";

export function useAlertPrefs(): AlertPrefs {
  return useSyncExternalStore(subscribeAlertPrefs, readAlertPrefs, () => DEFAULT_ALERT_PREFS);
}

/**
 * Rings (and notifies) when the current Pomodoro phase ends — in a background
 * tab too, which is the point. Transitions are not made here; the engine
 * still waits for the tab to be visible (AGENTS rule 12).
 *
 * One precise timeout per phase rather than watching the 250ms tick: browsers
 * slow repeating timers in hidden tabs to once a minute, which would make a
 * 25-minute timer ring up to a minute late. A single timeout is held to about
 * a second.
 *
 * Mount once, in TimerBar, beside the engine (AGENTS rule 13).
 */
export function usePomodoroAlerts(
  session: (PomodoroSnapshot & { id: string; track: { title: string } }) | null | undefined,
  phase: PomodoroPhase | null,
): void {
  const prefs = useAlertPrefs();
  const visible = useDocumentVisible();

  useEffect(() => unlockAudioOnFirstGesture(), []);

  const isPomodoro = session?.mode === "pomodoro" && session.endedAt == null;
  const sessionId = session?.id ?? null;
  const kind = phase?.kind ?? null;
  const completedCycles = phase?.completedCycles ?? 0;
  // Work counts down only while running; a break only while on the break.
  // A manual pause freezes both, so nothing is scheduled.
  const counting = Boolean(isPomodoro && session && (session.pausedAt == null || isOnBreak(session)));

  useEffect(() => {
    if (!session || !sessionId || !kind || !counting) return;

    const current = pomodoroPhase(session, clockNow());
    // Already over before we started watching: the fallback below handles it.
    if (current.remainingMs <= 0) return;

    const key = phaseKey(sessionId, current.kind, current.completedCycles);
    const timeout = setTimeout(() => {
      if (!claimAlert(key)) return;
      const latest = readAlertPrefs();
      if (latest.sound) playChime(current.kind === "work" ? "break" : "work");
      // Only when you are not looking; on screen, the bell and the timer say it.
      if (latest.notify && document.visibilityState !== "visible") {
        void showNotification(
          phaseEndMessage({
            ended: current.kind,
            nextBreakIsLong: current.nextBreakIsLong,
            config: sanitizeConfig(session.pomodoroConfig),
            trackTitle: session.track.title,
          }),
          key,
        );
      }
    }, current.remainingMs + 250);

    return () => clearTimeout(timeout);
    // `session` keeps its identity between polls unless it actually changed
    // (TanStack Query's structural sharing), so this re-schedules exactly when
    // a pause, resume or break moves the end time.
  }, [session, sessionId, kind, completedCycles, counting]);

  // Fallback: the phase ended while the page was throttled or frozen (a phone
  // in a pocket), so the timeout never rang. Ring once when you are back.
  useEffect(() => {
    if (!sessionId || !phase?.isOver || !visible || !prefs.sound) return;
    const key = phaseKey(sessionId, phase.kind, phase.completedCycles);
    if (claimAlert(key)) playChime(phase.kind === "work" ? "break" : "work");
  }, [sessionId, phase?.isOver, phase?.kind, phase?.completedCycles, visible, prefs.sound]);
}

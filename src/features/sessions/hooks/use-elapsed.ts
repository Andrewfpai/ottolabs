"use client";

import { useEffect, useState } from "react";

import { elapsedMs, type TimerSnapshot } from "@/lib/time/elapsed";
import { now as clockNow } from "@/lib/time/clock";

/**
 * Live elapsed time for a session, in milliseconds.
 *
 * The interval only drives *repainting*. The value itself is always recomputed
 * from the session's stored timestamps, so it cannot drift no matter how often
 * — or how rarely — the tick actually fires. A background tab that gets
 * throttled to one tick a minute still shows the right number the instant it
 * comes back to the foreground.
 *
 * `clockNow()` rather than `Date.now()`: it carries the measured offset against
 * the server clock that stamped `startedAt`.
 */
export function useElapsed(session: TimerSnapshot | null | undefined): number {
  const isRunning =
    session != null && session.endedAt == null && session.pausedAt == null;

  const [tick, setTick] = useState(() => clockNow());

  useEffect(() => {
    if (!isRunning) return;

    // 250ms rather than 1000ms so the seconds digit turns over promptly
    // instead of lagging by up to a full second after a pause or resume.
    const id = setInterval(() => setTick(clockNow()), 250);
    return () => clearInterval(id);
  }, [isRunning]);

  if (!session) return 0;

  // While paused or finished, `elapsedMs` ignores `tick` entirely, so a stale
  // value here cannot leak into the displayed number.
  return elapsedMs(session, isRunning ? tick : clockNow());
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { now as clockNow } from "@/lib/time/clock";

/**
 * Long absences are only worth asking about; a glance at another window is not.
 * An hour: studying often means time in other tabs and apps (notes, papers,
 * videos), and asking after every half hour of that was nagging.
 */
export const IDLE_THRESHOLD_MS = 60 * 60_000;

/**
 * Notices that you left the tab for a long time while a timer was running.
 *
 * The heartbeat and reaper handle the case where you never come back. This
 * handles the more common one: you *do* come back, forty minutes later, to a
 * timer that has been counting the whole time you were at lunch. Nothing about
 * that session looks wrong afterwards — it is simply forty minutes too long,
 * and it drags the average, the best day and the hour-of-day peak with it.
 *
 * Measured with the server-corrected clock, and only counted while the tab is
 * genuinely hidden. A machine that slept is indistinguishable from a tab in
 * the background, which is exactly right — both mean you were not there.
 */
export function useIdleReturn(sessionId: string | null | undefined): {
  /** How long the tab was hidden, once that exceeds the threshold. */
  awayMs: number | null;
  dismiss: () => void;
} {
  // Tagged with the session it belongs to rather than cleared when the session
  // changes: an answer to "were you focusing?" is only meaningful about the
  // session it was asked for, and finishing one timer must not carry the
  // question over to the next.
  const [pending, setPending] = useState<{ sessionId: string; awayMs: number } | null>(
    null,
  );
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = clockNow();
        return;
      }

      const left = hiddenAt.current;
      hiddenAt.current = null;
      if (left == null) return;

      const away = clockNow() - left;
      if (away >= IDLE_THRESHOLD_MS) setPending({ sessionId, awayMs: away });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      hiddenAt.current = null;
    };
  }, [sessionId]);

  const dismiss = useCallback(() => setPending(null), []);

  return {
    awayMs: pending && pending.sessionId === sessionId ? pending.awayMs : null,
    dismiss,
  };
}

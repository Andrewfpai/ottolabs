/**
 * Cutting sessions into hour-sized slices on the user's wall clock.
 *
 * "When do I focus best?" is the headline question, and bucketing a session by
 * its start time answers it wrongly: a 21:30–23:00 session is 30 minutes of
 * the 21:00 hour and a full hour of the 22:00 hour, not 90 minutes at 21:00.
 * Every hour- and day-level metric is built from these slices.
 *
 * HOW PAUSES ARE SPREAD
 * A session records how long it was paused in total, not when. Each slice
 * therefore gets the session's focus ratio (focus ÷ wall-clock span) applied
 * evenly. Totals stay exact — slices always sum to `elapsedMs` — and only the
 * hour-by-hour shape of a heavily paused session is approximate.
 */
import { addDays, type DayKey, wallClock, zonedInstant } from "@/lib/time/calendar-day";
import { elapsedMs, HOUR_MS, type TimerSnapshot } from "@/lib/time/elapsed";

export type SplittableSession = TimerSnapshot & {
  startedAt: Date;
  endedAt: Date | null;
  trackId: string;
};

export type FocusSlice = {
  /** Focus day, honouring `dayStartHour`: 01:00 work belongs to the night before. */
  day: DayKey;
  /** Wall-clock hour of day, 0–23, in the user's zone. */
  hour: number;
  trackId: string;
  /** Focus time in this slice. Fractional; round only for display. */
  ms: number;
};

/** The next instant at which the wall-clock hour changes. */
function nextHourBoundary(cursor: number, timeZone: string): number {
  const { day, hour } = wallClock(cursor, timeZone);
  const next =
    hour < 23
      ? zonedInstant(day, `${String(hour + 1).padStart(2, "0")}:00`, timeZone).getTime()
      : zonedInstant(addDays(day, 1), null, timeZone).getTime();
  // Defensive: a zone with an unusual transition must never stall the loop.
  return next > cursor ? next : cursor + HOUR_MS;
}

/**
 * @param now Only used for a live session, which is measured up to it.
 */
export function splitSession(
  session: SplittableSession,
  timeZone: string,
  dayStartHour: number,
  now: number = Date.now(),
): FocusSlice[] {
  const start = session.startedAt.getTime();
  const end = session.endedAt?.getTime() ?? now;
  const span = end - start;
  if (span <= 0) return [];

  const focus = elapsedMs(session, now);
  if (focus <= 0) return [];
  const ratio = focus / span;

  const slices: FocusSlice[] = [];
  for (let cursor = start; cursor < end; ) {
    const boundary = Math.min(nextHourBoundary(cursor, timeZone), end);
    const { day, hour } = wallClock(cursor, timeZone);
    slices.push({
      // dayStartHour is a whole hour, so a slice never straddles it.
      day: hour < dayStartHour ? addDays(day, -1) : day,
      hour,
      trackId: session.trackId,
      ms: (boundary - cursor) * ratio,
    });
    cursor = boundary;
  }
  return slices;
}

export function splitSessions(
  sessions: readonly SplittableSession[],
  timeZone: string,
  dayStartHour: number,
  now: number = Date.now(),
): FocusSlice[] {
  return sessions.flatMap((s) => splitSession(s, timeZone, dayStartHour, now));
}

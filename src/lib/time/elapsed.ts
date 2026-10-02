/**
 * The one place elapsed focus time is computed.
 *
 * Both the ticking client display and every server-side aggregation call these
 * functions. There must never be a second implementation — two subtly
 * different formulas is exactly how a tracker ends up disagreeing with itself.
 *
 * WHY TIMESTAMPS, NOT A COUNTER
 * A naive timer increments a number once a second. That breaks in three ways:
 * a page refresh wipes it, browsers throttle timers in background tabs so it
 * silently falls behind real time, and it only exists in one browser tab.
 * Instead we persist *when things happened* and subtract. The display can be
 * repainted at any rate, or not at all, and the answer stays correct.
 *
 * INVARIANT: `breakMs` is a subset of `pausedMs`. A pomodoro break is recorded
 * as a pause (so it is excluded from focus time) *and* tallied in `breakMs`
 * (so we can report "you took 40m of breaks"). Never subtract both.
 */

export type TimerSnapshot = {
  startedAt: Date | string | number;
  /** Null while the session is live. */
  endedAt?: Date | string | number | null;
  /** Accumulated *completed* pauses, in ms. */
  pausedMs: number;
  /** Non-null while currently paused. This pause is not yet in `pausedMs`. */
  pausedAt?: Date | string | number | null;
};

function toMs(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

/**
 * Focus time accrued, in milliseconds. Excludes all paused time.
 *
 * @param now Current time in epoch ms. Callers on the client must pass a
 *   server-corrected clock (see `clock.ts`) rather than raw `Date.now()`.
 */
export function elapsedMs(session: TimerSnapshot, now: number = Date.now()): number {
  const startedAt = toMs(session.startedAt);
  const endedAt = session.endedAt != null ? toMs(session.endedAt) : null;
  const pausedAt = session.pausedAt != null ? toMs(session.pausedAt) : null;

  // A finished session is measured to its end; a live one, to `now`.
  const end = endedAt ?? now;

  // If the session ended while paused, the open pause runs only until the end.
  const openPauseMs = pausedAt != null ? Math.max(0, end - pausedAt) : 0;

  const gross = end - startedAt;
  const net = gross - session.pausedMs - openPauseMs;

  // Clamp: a skewed clock or a bad manual edit must never produce negative time.
  return Math.max(0, net);
}

/** Total wall-clock time the session spanned, paused time included. */
export function spanMs(session: TimerSnapshot, now: number = Date.now()): number {
  const end = session.endedAt != null ? toMs(session.endedAt) : now;
  return Math.max(0, end - toMs(session.startedAt));
}

/** Total paused time so far, including a pause that is still open. */
export function pausedTotalMs(
  session: TimerSnapshot,
  now: number = Date.now(),
): number {
  const end = session.endedAt != null ? toMs(session.endedAt) : now;
  const pausedAt = session.pausedAt != null ? toMs(session.pausedAt) : null;
  const open = pausedAt != null ? Math.max(0, end - pausedAt) : 0;
  return session.pausedMs + open;
}

export function isLive(session: TimerSnapshot): boolean {
  return session.endedAt == null;
}

export function isPaused(session: TimerSnapshot): boolean {
  return isLive(session) && session.pausedAt != null;
}

export type TimerState = "running" | "paused" | "ended";

export function timerState(session: TimerSnapshot): TimerState {
  if (!isLive(session)) return "ended";
  return session.pausedAt != null ? "paused" : "running";
}

/** `HH:MM:SS`, hours uncapped. Pair with `font-variant-numeric: tabular-nums`. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** Human-scale summary: "2h 15m", "45m", "0m". For totals, not live timers. */
export function formatCompact(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;

export function msToMinutes(ms: number): number {
  return ms / MINUTE_MS;
}

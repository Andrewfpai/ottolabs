/**
 * Folding tasks and sessions onto calendar days.
 */
import type { Task } from "@/db/schema";
import { type DayKey, dayKey, focusDayKey } from "@/lib/time/calendar-day";
import { elapsedMs, type TimerSnapshot } from "@/lib/time/elapsed";

type DatedTask = Pick<Task, "dueAt" | "isAllDay" | "priority" | "createdAt">;

/**
 * Tasks keyed by the calendar day they are due, all-day ones first, then by
 * time, then priority. Undated tasks have no place on a calendar and are
 * dropped.
 */
export function tasksByDay<T extends DatedTask>(
  tasks: readonly T[],
  timeZone: string,
): Record<DayKey, T[]> {
  const byDay: Record<DayKey, T[]> = {};
  for (const task of tasks) {
    if (!task.dueAt) continue;
    (byDay[dayKey(task.dueAt, timeZone)] ??= []).push(task);
  }

  for (const list of Object.values(byDay)) {
    list.sort((a, b) => {
      if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
      const byTime = a.dueAt!.getTime() - b.dueAt!.getTime();
      if (byTime !== 0) return byTime;
      if (a.priority !== b.priority) return a.priority < b.priority ? -1 : 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }
  return byDay;
}

/**
 * Focus time per day, by the day each session *started* on, honouring
 * `dayStartHour` so a 01:00 session lands on the night before — the same rule
 * streaks use.
 *
 * A session that runs past the boundary is credited whole to its start day.
 * Splitting it at the boundary is the analytics phase's job (`split.ts`); a
 * calendar cell reading "2h" where the precise answer is "1h 50m + 10m
 * tomorrow" is the right trade for a glanceable overlay.
 *
 * Durations come from `elapsedMs`, never recomputed here.
 */
export function focusByDay(
  sessions: readonly (TimerSnapshot & { startedAt: Date })[],
  timeZone: string,
  dayStartHour: number,
): Record<DayKey, number> {
  const byDay: Record<DayKey, number> = {};
  for (const session of sessions) {
    const key = focusDayKey(session.startedAt, timeZone, dayStartHour);
    byDay[key] = (byDay[key] ?? 0) + elapsedMs(session);
  }
  return byDay;
}

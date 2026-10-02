/**
 * Every number on the analytics page, as pure functions of hour slices.
 *
 * Inputs are `FocusSlice`s from `split.ts` (already cut at hour and day
 * boundaries, already honouring `dayStartHour`) plus the raw sessions where a
 * per-session view is needed. Ranges are inclusive focus-day keys.
 */
import type { FocusSlice, SplittableSession } from "@/features/analytics/lib/split";
import {
  addDays,
  type DayKey,
  dayKey,
  daysBetween,
  focusDayKey,
  weekdayOf,
} from "@/lib/time/calendar-day";
import { elapsedMs, MINUTE_MS } from "@/lib/time/elapsed";

export type DayRange = { start: DayKey; end: DayKey };

/** A day counts as active — for streaks and consistency — from one minute up. */
export const ACTIVE_DAY_MIN_MS = MINUTE_MS;

function inRange(day: DayKey, range: DayRange): boolean {
  return day >= range.start && day <= range.end;
}

export function enumerateDays(range: DayRange): DayKey[] {
  const days: DayKey[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function dayCount(range: DayRange): number {
  return daysBetween(range.start, range.end) + 1;
}

/** Focus per day over every slice given, in or out of any range. */
export function totalsByDay(slices: readonly FocusSlice[]): Map<DayKey, number> {
  const byDay = new Map<DayKey, number>();
  for (const s of slices) byDay.set(s.day, (byDay.get(s.day) ?? 0) + s.ms);
  return byDay;
}

export type DayPoint = { day: DayKey; ms: number; averageMs: number };

/**
 * One point per day with a trailing average. The average looks back past the
 * start of the range when it can, so the first week of the chart is not a ramp
 * up from zero — callers should pass slices covering `window - 1` extra days.
 */
export function dailyTrend(
  byDay: ReadonlyMap<DayKey, number>,
  range: DayRange,
  window = 7,
): DayPoint[] {
  return enumerateDays(range).map((day) => {
    let sum = 0;
    for (let i = 0; i < window; i++) sum += byDay.get(addDays(day, -i)) ?? 0;
    return { day, ms: byDay.get(day) ?? 0, averageMs: sum / window };
  });
}

export type WeekPoint = { weekStart: DayKey; ms: number };

/** For long ranges, where 365 daily bars are unreadable. */
export function weeklyTotals(
  byDay: ReadonlyMap<DayKey, number>,
  range: DayRange,
  weekStartsOn: number,
): WeekPoint[] {
  const weeks = new Map<DayKey, number>();
  for (const day of enumerateDays(range)) {
    const weekStart = addDays(day, -((weekdayOf(day) - weekStartsOn + 7) % 7));
    weeks.set(weekStart, (weeks.get(weekStart) ?? 0) + (byDay.get(day) ?? 0));
  }
  return [...weeks].map(([weekStart, ms]) => ({ weekStart, ms }));
}

/** Total focus in each wall-clock hour, 0–23, across the range. */
export function hourProfile(slices: readonly FocusSlice[], range: DayRange): number[] {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const s of slices) if (inRange(s.day, range)) hours[s.hour] += s.ms;
  return hours;
}

export type PeakWindow = { startHour: number; endHour: number; ms: number; share: number };

/**
 * The `width`-hour stretch with the most focus. Wraps around midnight, so a
 * night owl's 23:00–01:00 is found as one window rather than split in two.
 */
export function peakWindow(profile: readonly number[], width = 2): PeakWindow | null {
  const total = profile.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  let best = { start: 0, ms: -1 };
  for (let start = 0; start < 24; start++) {
    let ms = 0;
    for (let i = 0; i < width; i++) ms += profile[(start + i) % 24];
    if (ms > best.ms) best = { start, ms };
  }
  return {
    startHour: best.start,
    endHour: (best.start + width) % 24,
    ms: best.ms,
    share: best.ms / total,
  };
}

export type TrackShare = { trackId: string; ms: number; share: number };

export function trackShares(slices: readonly FocusSlice[], range: DayRange): TrackShare[] {
  const byTrack = new Map<string, number>();
  let total = 0;
  for (const s of slices) {
    if (!inRange(s.day, range)) continue;
    byTrack.set(s.trackId, (byTrack.get(s.trackId) ?? 0) + s.ms);
    total += s.ms;
  }
  return [...byTrack]
    .map(([trackId, ms]) => ({ trackId, ms, share: total > 0 ? ms / total : 0 }))
    .sort((a, b) => b.ms - a.ms);
}

/** Sessions that *started* on a focus day inside the range. */
export function sessionsStartedIn<T extends SplittableSession>(
  sessions: readonly T[],
  range: DayRange,
  timeZone: string,
  dayStartHour: number,
): T[] {
  return sessions.filter((s) => inRange(focusDayKey(s.startedAt, timeZone, dayStartHour), range));
}

export const LENGTH_BUCKETS = [
  { label: "<15m", maxMinutes: 15 },
  { label: "15–30m", maxMinutes: 30 },
  { label: "30–45m", maxMinutes: 45 },
  { label: "45–60m", maxMinutes: 60 },
  { label: "1–1.5h", maxMinutes: 90 },
  { label: "1.5–2h", maxMinutes: 120 },
  { label: "2h+", maxMinutes: Infinity },
] as const;

export type LengthBucket = { label: string; count: number };

/** How many sessions fell into each length band — many short or few long. */
export function lengthHistogram(
  sessions: readonly SplittableSession[],
  now: number = Date.now(),
): LengthBucket[] {
  const counts = LENGTH_BUCKETS.map(() => 0);
  for (const s of sessions) {
    const minutes = elapsedMs(s, now) / MINUTE_MS;
    if (minutes <= 0) continue;
    const index = LENGTH_BUCKETS.findIndex((b) => minutes < b.maxMinutes);
    counts[index] += 1;
  }
  return LENGTH_BUCKETS.map((b, i) => ({ label: b.label, count: counts[i] }));
}

export function medianSessionMs(
  sessions: readonly SplittableSession[],
  now: number = Date.now(),
): number | null {
  const lengths = sessions
    .map((s) => elapsedMs(s, now))
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b);
  if (lengths.length === 0) return null;
  const mid = Math.floor(lengths.length / 2);
  return lengths.length % 2 ? lengths[mid] : (lengths[mid - 1] + lengths[mid]) / 2;
}

export type Kpis = {
  totalMs: number;
  sessionCount: number;
  averageSessionMs: number;
  activeDays: number;
  days: number;
  bestDay: { day: DayKey; ms: number } | null;
};

export function kpis(
  byDay: ReadonlyMap<DayKey, number>,
  sessionsInRange: readonly SplittableSession[],
  range: DayRange,
  now: number = Date.now(),
): Kpis {
  let totalMs = 0;
  let activeDays = 0;
  let bestDay: Kpis["bestDay"] = null;

  for (const day of enumerateDays(range)) {
    const ms = byDay.get(day) ?? 0;
    totalMs += ms;
    if (ms >= ACTIVE_DAY_MIN_MS) activeDays += 1;
    if (ms > 0 && (!bestDay || ms > bestDay.ms)) bestDay = { day, ms };
  }

  const sessionTotal = sessionsInRange.reduce((sum, s) => sum + elapsedMs(s, now), 0);
  return {
    totalMs,
    sessionCount: sessionsInRange.length,
    averageSessionMs: sessionsInRange.length ? sessionTotal / sessionsInRange.length : 0,
    activeDays,
    days: dayCount(range),
    bestDay,
  };
}

export type Streaks = { current: number; longest: number };

/**
 * Consecutive active days. Today not having any focus *yet* does not break the
 * current streak — at 09:00 nobody has failed today — so counting starts from
 * yesterday when today is still empty.
 */
export function streaks(byDay: ReadonlyMap<DayKey, number>, todayKey: DayKey): Streaks {
  const active = (day: DayKey) => (byDay.get(day) ?? 0) >= ACTIVE_DAY_MIN_MS;

  let current = 0;
  for (let d = active(todayKey) ? todayKey : addDays(todayKey, -1); active(d); d = addDays(d, -1)) {
    current += 1;
  }

  const days = [...byDay.keys()].filter((d) => d <= todayKey && active(d)).sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  return { current, longest: Math.max(longest, current) };
}

/** Average focus per weekday (0 = Sunday), over the occurrences in the range. */
export function weekdayAverages(byDay: ReadonlyMap<DayKey, number>, range: DayRange): number[] {
  const sums = Array.from({ length: 7 }, () => 0);
  const counts = Array.from({ length: 7 }, () => 0);
  for (const day of enumerateDays(range)) {
    const weekday = weekdayOf(day);
    sums[weekday] += byDay.get(day) ?? 0;
    counts[weekday] += 1;
  }
  return sums.map((sum, i) => (counts[i] ? sum / counts[i] : 0));
}

/** Morning / afternoon / evening / night totals, by wall-clock hour. */
export const DAY_PARTS = [
  { key: "morning", label: "morning", hours: [5, 6, 7, 8, 9, 10, 11] },
  { key: "afternoon", label: "afternoon", hours: [12, 13, 14, 15, 16] },
  { key: "evening", label: "evening", hours: [17, 18, 19, 20, 21, 22] },
  { key: "night", label: "late night", hours: [23, 0, 1, 2, 3, 4] },
] as const;

export type DayPart = (typeof DAY_PARTS)[number]["key"];

export function dayPartTotals(profile: readonly number[]): Record<DayPart, number> {
  const totals = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const part of DAY_PARTS) {
    for (const hour of part.hours) totals[part.key] += profile[hour];
  }
  return totals;
}

export type TaskLike = {
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "p1" | "p2" | "p3";
  dueAt: Date | null;
  isAllDay: boolean;
  completedAt: Date | null;
  createdAt: Date;
};

export type TaskStats = {
  created: number;
  completed: number;
  onTime: number;
  late: number;
  openByPriority: Record<TaskLike["priority"], number>;
};

/**
 * Created and completed within the range; on-time versus late for completed
 * tasks that had a deadline. An all-day deadline is met by finishing any time
 * that calendar day.
 */
export function taskStats(tasks: readonly TaskLike[], range: DayRange, timeZone: string): TaskStats {
  const stats: TaskStats = {
    created: 0,
    completed: 0,
    onTime: 0,
    late: 0,
    openByPriority: { p1: 0, p2: 0, p3: 0 },
  };

  for (const task of tasks) {
    // Deadlines and completions are calendar events: no day-start offset.
    if (inRange(dayKey(task.createdAt, timeZone), range)) stats.created += 1;

    if (task.status === "todo" || task.status === "in_progress") {
      stats.openByPriority[task.priority] += 1;
    }

    if (task.status !== "done" || !task.completedAt) continue;
    if (!inRange(dayKey(task.completedAt, timeZone), range)) continue;

    stats.completed += 1;
    if (!task.dueAt) continue;
    const met = task.isAllDay
      ? dayKey(task.completedAt, timeZone) <= dayKey(task.dueAt, timeZone)
      : task.completedAt.getTime() <= task.dueAt.getTime();
    if (met) stats.onTime += 1;
    else stats.late += 1;
  }
  return stats;
}

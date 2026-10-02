/**
 * The whole analytics page as one pure function of rows and settings, so it
 * can be tested and previewed without a database or a signed-in user.
 */
import { buildInsights, type Insight } from "@/features/analytics/lib/insights";
import {
  type DayPoint,
  type DayRange,
  dailyTrend,
  hourProfile,
  type Kpis,
  kpis,
  type LengthBucket,
  lengthHistogram,
  medianSessionMs,
  type PeakWindow,
  peakWindow,
  sessionsStartedIn,
  type Streaks,
  streaks,
  type TaskLike,
  type TaskStats,
  taskStats,
  totalsByDay,
  trackShares,
  weekdayAverages,
  type WeekPoint,
  weeklyTotals,
} from "@/features/analytics/lib/metrics";
import { type SplittableSession, splitSessions } from "@/features/analytics/lib/split";
import { addDays, type DayKey, focusDayKey, weekdayOf } from "@/lib/time/calendar-day";

export const ANALYTICS_RANGES = {
  "7d": { days: 7, label: "7 days" },
  "30d": { days: 30, label: "30 days" },
  "90d": { days: 90, label: "90 days" },
  "1y": { days: 365, label: "12 months" },
} as const;

export type AnalyticsRangeKey = keyof typeof ANALYTICS_RANGES;

export function parseRangeKey(value: unknown): AnalyticsRangeKey {
  return typeof value === "string" && value in ANALYTICS_RANGES
    ? (value as AnalyticsRangeKey)
    : "30d";
}

/** The heatmap always shows a year, whatever the range filter says. */
const HEATMAP_WEEKS = 53;
/** Trailing-average window for the trend line. */
const TREND_WINDOW = 7;

export type TrackFocus = { trackId: string; title: string; color: string; ms: number; share: number };

export type AnalyticsData = {
  rangeKey: AnalyticsRangeKey;
  range: DayRange;
  todayKey: DayKey;
  timeZone: string;
  dayStartHour: number;
  kpis: Kpis;
  streaks: Streaks;
  insights: Insight[];
  /** Daily for ranges up to 90 days; weekly for a year, where 365 bars are mush. */
  trend: { kind: "daily"; points: DayPoint[] } | { kind: "weekly"; points: WeekPoint[] };
  /** Focus per wall-clock hour, 0–23. */
  hours: number[];
  peak: PeakWindow | null;
  tracks: TrackFocus[];
  heatmap: { start: DayKey; end: DayKey; byDay: Record<DayKey, number> };
  lengths: LengthBucket[];
  medianSessionMs: number | null;
  tasks: TaskStats;
};


export type AnalyticsSettings = {
  timeZone: string;
  dayStartHour: number;
  weekStartsOn: number;
};

/**
 * The first focus day whose sessions the computation needs: whichever reaches
 * back further, the heatmap or the range plus the trailing-average lead-in.
 */
export function analyticsWindow(
  rangeKey: AnalyticsRangeKey,
  settings: AnalyticsSettings,
  now: number,
): { todayKey: DayKey; range: DayRange; heatmapStart: DayKey; earliest: DayKey } {
  const todayKey = focusDayKey(now, settings.timeZone, settings.dayStartHour);
  const range: DayRange = {
    start: addDays(todayKey, -(ANALYTICS_RANGES[rangeKey].days - 1)),
    end: todayKey,
  };
  // The heatmap runs whole weeks back from this week's start.
  const thisWeek = addDays(todayKey, -((weekdayOf(todayKey) - settings.weekStartsOn + 7) % 7));
  const heatmapStart = addDays(thisWeek, -(HEATMAP_WEEKS - 1) * 7);
  const earliest = [heatmapStart, addDays(range.start, -TREND_WINDOW)].sort()[0];
  return { todayKey, range, heatmapStart, earliest };
}

export function computeAnalytics(input: {
  rangeKey: AnalyticsRangeKey;
  settings: AnalyticsSettings;
  now: number;
  sessions: readonly SplittableSession[];
  tracks: readonly { id: string; title: string; color: string }[];
  tasks: readonly TaskLike[];
}): AnalyticsData {
  const { rangeKey, settings, now, sessions } = input;
  const { timeZone, dayStartHour, weekStartsOn } = settings;
  const { todayKey, range, heatmapStart } = analyticsWindow(rangeKey, settings, now);

  const slices = splitSessions(sessions, timeZone, dayStartHour, now);
  const byDay = totalsByDay(slices);
  const inRange = sessionsStartedIn(sessions, range, timeZone, dayStartHour);

  const rangeKpis = kpis(byDay, inRange, range, now);
  const hours = hourProfile(slices, range);
  const peak = peakWindow(hours);
  const streakCounts = streaks(byDay, todayKey);
  const median = medianSessionMs(inRange, now);

  const trackById = new Map(input.tracks.map((t) => [t.id, t]));
  const tracks: TrackFocus[] = trackShares(slices, range).map((share) => {
    const track = trackById.get(share.trackId);
    return {
      ...share,
      title: track?.title ?? "Deleted track",
      color: track?.color ?? "teal",
    };
  });

  const heatmapByDay: Record<DayKey, number> = {};
  for (const [day, ms] of byDay) if (day >= heatmapStart && day <= todayKey) heatmapByDay[day] = ms;

  return {
    rangeKey,
    range,
    todayKey,
    timeZone,
    dayStartHour,
    kpis: rangeKpis,
    streaks: streakCounts,
    insights: buildInsights({
      kpis: rangeKpis,
      profile: hours,
      peak,
      weekdayAverages: weekdayAverages(byDay, range),
      medianSessionMs: median,
      topTracks: tracks,
      streaks: streakCounts,
    }),
    trend:
      rangeKey === "1y"
        ? { kind: "weekly", points: weeklyTotals(byDay, range, weekStartsOn) }
        : { kind: "daily", points: dailyTrend(byDay, range, TREND_WINDOW) },
    hours,
    peak,
    tracks,
    heatmap: { start: heatmapStart, end: todayKey, byDay: heatmapByDay },
    lengths: lengthHistogram(inRange, now),
    medianSessionMs: median,
    tasks: taskStats(input.tasks, range, timeZone),
  };
}

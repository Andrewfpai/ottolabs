import {
  type AnalyticsData,
  type AnalyticsRangeKey,
  type AnalyticsSettings,
  analyticsWindow,
  computeAnalytics,
  computeFocusSummary,
  type FocusSummary,
} from "@/features/analytics/lib/compute";
import { getSessionsInRange } from "@/features/sessions/server/queries";
import { getTasksForStats } from "@/features/tasks/server/queries";
import { getTrackOptions } from "@/features/tracks/server/queries";
import { requireSettings } from "@/lib/auth-guard";
import { addDays, zonedInstant } from "@/lib/time/calendar-day";

async function analyticsSettings(): Promise<AnalyticsSettings> {
  const stored = await requireSettings();
  return {
    timeZone: stored.timezone,
    dayStartHour: stored.dayStartHour,
    weekStartsOn: stored.weekStartsOn,
  };
}

export async function getAnalytics(rangeKey: AnalyticsRangeKey): Promise<AnalyticsData> {
  const settings = await analyticsSettings();

  const now = Date.now();
  // One extra day back, for sessions that began the evening before the window
  // and ran into it.
  const { earliest } = analyticsWindow(rangeKey, settings, now);
  const from = zonedInstant(addDays(earliest, -1), null, settings.timeZone);

  const [sessions, tracks, tasks] = await Promise.all([
    getSessionsInRange(from, new Date(now)),
    getTrackOptions(),
    getTasksForStats(),
  ]);

  return computeAnalytics({ rangeKey, settings, now, sessions, tracks, tasks });
}

export async function getFocusSummary(): Promise<FocusSummary & { settings: AnalyticsSettings }> {
  const settings = await analyticsSettings();

  const now = Date.now();
  // A year back: the recent strip needs 17 weeks, but a streak can run longer.
  const { earliest } = analyticsWindow("1y", settings, now);
  const from = zonedInstant(addDays(earliest, -1), null, settings.timeZone);
  const sessions = await getSessionsInRange(from, new Date(now));

  return { ...computeFocusSummary({ settings, now, sessions }), settings };
}

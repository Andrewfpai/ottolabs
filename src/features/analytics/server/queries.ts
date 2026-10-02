import {
  type AnalyticsData,
  type AnalyticsRangeKey,
  analyticsWindow,
  computeAnalytics,
} from "@/features/analytics/lib/compute";
import { getSessionsInRange } from "@/features/sessions/server/queries";
import { getTasksForStats } from "@/features/tasks/server/queries";
import { getTrackOptions } from "@/features/tracks/server/queries";
import { requireSettings } from "@/lib/auth-guard";
import { addDays, zonedInstant } from "@/lib/time/calendar-day";

export async function getAnalytics(rangeKey: AnalyticsRangeKey): Promise<AnalyticsData> {
  const stored = await requireSettings();
  const settings = {
    timeZone: stored.timezone,
    dayStartHour: stored.dayStartHour,
    weekStartsOn: stored.weekStartsOn,
  };

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

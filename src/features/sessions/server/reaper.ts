import { and, eq, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { focusSessions } from "@/db/schema";

/** How long a timer may go without a heartbeat before it counts as abandoned. */
export const STALE_AFTER_MINUTES = 30;

/**
 * Closes sessions whose owner walked away without pressing Finish.
 *
 * Closed laptops, browser crashes, and "I'll stop it in a minute" are all
 * normal. What is not normal is the fourteen-hour session that results, which
 * inflates the total, wrecks the average session length, invents a best-ever
 * focus day and puts a phantom peak in the hour-of-day chart. Nothing looks
 * broken afterwards: the numbers render perfectly and are simply wrong.
 *
 * The session is closed at its LAST HEARTBEAT, not at the moment this job
 * noticed, so the recorded end lands within a minute of when the person
 * actually stopped.
 *
 * Called two ways. Lazily, for one user, every time their running session is
 * read (`getActiveSession`), so opening the app the morning after shows
 * yesterday's session closed rather than a fourteen-hour timer. And from the
 * daily cron, for everyone, as a backstop for people who never come back.
 * The lazy path is what makes a once-a-day cron (Vercel Hobby's limit) enough.
 * Either way it scans a partial index over live rows, so it stays cheap.
 */
export async function reapStaleSessions(userId?: string): Promise<string[]> {
  const reaped = await db
    .update(focusSessions)
    .set({
      endedAt: sql`${focusSessions.lastHeartbeatAt}`,
      // A session abandoned mid-pause must still bank that pause, measured to
      // the heartbeat rather than to now.
      pausedMs: sql`${focusSessions.pausedMs} + case
        when ${focusSessions.pausedAt} is not null
        then greatest(0, (extract(epoch from (${focusSessions.lastHeartbeatAt} - ${focusSessions.pausedAt})) * 1000)::int)
        else 0
      end`,
      // Abandoned during a pomodoro break: the same stretch is banked into
      // breakMs as well, because breakMs is a subset of pausedMs rather than a
      // second deduction. Walking away on a break must not turn that break
      // into untracked pause time.
      breakMs: sql`${focusSessions.breakMs} + case
        when ${focusSessions.breakStartedAt} is not null
        then greatest(0, (extract(epoch from (${focusSessions.lastHeartbeatAt} - ${focusSessions.breakStartedAt})) * 1000)::int)
        else 0
      end`,
      pausedAt: null,
      breakStartedAt: null,
      endReason: "auto_closed",
    })
    .where(
      and(
        isNull(focusSessions.endedAt),
        userId ? eq(focusSessions.userId, userId) : undefined,
        sql`${focusSessions.lastHeartbeatAt} is not null`,
        lt(
          focusSessions.lastHeartbeatAt,
          sql`now() - interval '${sql.raw(String(STALE_AFTER_MINUTES))} minutes'`,
        ),
      ),
    )
    .returning({ id: focusSessions.id });

  return reaped.map((s) => s.id);
}

import { and, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { focusSessions } from "@/db/schema";

export const dynamic = "force-dynamic";

/** How long a timer may go without a heartbeat before it counts as abandoned. */
const STALE_AFTER_MINUTES = 30;

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
 * Runs every 15 minutes via Vercel Cron. Scans a partial index over live rows,
 * so it stays cheap regardless of how much history has accumulated.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Refuse to run
  // unguarded — an open endpoint here could stop somebody's running timer.
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 });
  }

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
        sql`${focusSessions.lastHeartbeatAt} is not null`,
        lt(
          focusSessions.lastHeartbeatAt,
          sql`now() - interval '${sql.raw(String(STALE_AFTER_MINUTES))} minutes'`,
        ),
      ),
    )
    .returning({
      id: focusSessions.id,
      endedAt: focusSessions.endedAt,
    });

  return Response.json({
    reaped: reaped.length,
    sessions: reaped.map((s) => s.id),
    staleAfterMinutes: STALE_AFTER_MINUTES,
  });
}

import { and, count, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { focusSessions, tracks } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";

export type DataSummary = {
  sessions: number;
  tracks: number;
  focusHours: number;
  firstSessionAt: Date | null;
  lastSessionAt: Date | null;
};

/**
 * A cheap "is there anything in here?" summary.
 *
 * Focus time is summed in SQL rather than by loading rows, but note it uses the
 * same formula as `lib/time/elapsed.ts` — span minus paused. Once the real
 * analytics land in Phase 4, aggregation moves into TypeScript so that hour and
 * day bucketing can share one implementation with the client.
 */
export async function getDataSummary(): Promise<DataSummary> {
  const user = await requireUser();

  const [sessionStats] = await db
    .select({
      sessions: count(),
      focusMs: sql<string>`coalesce(sum(
        extract(epoch from (${focusSessions.endedAt} - ${focusSessions.startedAt})) * 1000
        - ${focusSessions.pausedMs}
      ), 0)`,
      // See the note in features/tracks/server/queries.ts: a bare
      // `sql<Date>` on an aggregate yields a string at runtime.
      firstSessionAt: sql`min(${focusSessions.startedAt})`.mapWith(
        focusSessions.startedAt,
      ),
      lastSessionAt: sql`max(${focusSessions.startedAt})`.mapWith(
        focusSessions.startedAt,
      ),
    })
    .from(focusSessions)
    .where(
      and(eq(focusSessions.userId, user.id), isNotNull(focusSessions.endedAt)),
    );

  const [trackStats] = await db
    .select({ tracks: count() })
    .from(tracks)
    .where(eq(tracks.userId, user.id));

  return {
    sessions: sessionStats?.sessions ?? 0,
    tracks: trackStats?.tracks ?? 0,
    focusHours: Math.round(Number(sessionStats?.focusMs ?? 0) / 3_600_000),
    firstSessionAt: sessionStats?.firstSessionAt ?? null,
    lastSessionAt: sessionStats?.lastSessionAt ?? null,
  };
}

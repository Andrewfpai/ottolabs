import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { focusSessions, type Track, tracks } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";

export type TrackWithStats = Track & {
  totalMs: number;
  sessionCount: number;
  lastActiveAt: Date | null;
};

/**
 * Focus time accrued against a track.
 *
 * Mirrors `elapsedMs` from `lib/time/elapsed.ts`: span minus paused time, with
 * an open pause measured to the session's end. Live sessions are excluded —
 * a running timer's contribution changes every second, so including it here
 * would make a server-rendered total wrong the moment it reached the browser.
 * The timer bar shows the live portion separately.
 */
const FOCUS_MS = sql<string>`coalesce(sum(
  extract(epoch from (${focusSessions.endedAt} - ${focusSessions.startedAt})) * 1000
  - ${focusSessions.pausedMs}
  - case
      when ${focusSessions.pausedAt} is not null
      then extract(epoch from (${focusSessions.endedAt} - ${focusSessions.pausedAt})) * 1000
      else 0
    end
), 0)`;

export async function getTracksWithStats(options?: {
  includeArchived?: boolean;
}): Promise<TrackWithStats[]> {
  const user = await requireUser();

  const rows = await db
    .select({
      track: tracks,
      totalMs: FOCUS_MS,
      sessionCount: sql<number>`count(${focusSessions.id})::int`,
      // `.mapWith()` is doing real work here. `sql<Date>` is only a
      // compile-time cast — the driver hands back a raw string for a computed
      // column like max(), and calling .getTime() on it throws at runtime.
      // Borrowing the column's own decoder is what turns it into a Date.
      lastActiveAt: sql`max(${focusSessions.startedAt})`.mapWith(
        focusSessions.startedAt,
      ),
    })
    .from(tracks)
    .leftJoin(
      focusSessions,
      and(
        eq(focusSessions.trackId, tracks.id),
        sql`${focusSessions.endedAt} is not null`,
      ),
    )
    .where(
      options?.includeArchived
        ? eq(tracks.userId, user.id)
        : and(eq(tracks.userId, user.id), sql`${tracks.status} <> 'archived'`),
    )
    .groupBy(tracks.id)
    .orderBy(asc(tracks.sortOrder), asc(tracks.createdAt));

  return rows.map((row) => ({
    ...row.track,
    // Postgres returns numeric aggregates as strings to avoid precision loss.
    totalMs: Math.max(0, Math.round(Number(row.totalMs))),
    sessionCount: row.sessionCount,
    lastActiveAt: row.lastActiveAt,
  }));
}

export async function getTrackById(id: string): Promise<Track | null> {
  const user = await requireUser();

  const track = await db.query.tracks.findFirst({
    where: and(eq(tracks.id, id), eq(tracks.userId, user.id)),
  });

  return track ?? null;
}

export type TrackOption = Pick<
  Track,
  "id" | "title" | "color" | "icon" | "status" | "targetMinutesPerWeek"
>;

/**
 * Every track, archived included, for pickers and filters. Callers decide
 * whether to offer archived ones — a task already linked to an archived track
 * still needs to show it.
 */
export async function getTrackOptions(): Promise<TrackOption[]> {
  const user = await requireUser();

  return db
    .select({
      id: tracks.id,
      title: tracks.title,
      color: tracks.color,
      icon: tracks.icon,
      status: tracks.status,
      targetMinutesPerWeek: tracks.targetMinutesPerWeek,
    })
    .from(tracks)
    .where(eq(tracks.userId, user.id))
    .orderBy(asc(tracks.sortOrder), asc(tracks.createdAt));
}

/** Tracks eligible to start a timer against, most recently used first. */
export async function getStartableTracks(): Promise<Track[]> {
  const user = await requireUser();

  return db
    .select({ track: tracks })
    .from(tracks)
    .where(and(eq(tracks.userId, user.id), eq(tracks.status, "active")))
    .orderBy(asc(tracks.sortOrder), desc(tracks.createdAt))
    .then((rows) => rows.map((r) => r.track));
}

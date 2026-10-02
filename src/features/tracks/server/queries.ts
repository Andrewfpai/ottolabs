import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { type FocusSession, focusSessions, type Track, tasks, tracks } from "@/db/schema";
import {
  type AnalyticsData,
  type AnalyticsRangeKey,
  analyticsWindow,
  computeAnalytics,
  computeFocusSummary,
} from "@/features/analytics/lib/compute";
import { getSessionsInRange } from "@/features/sessions/server/queries";
import { requireSettings, requireUser } from "@/lib/auth-guard";
import { addDays, zonedInstant } from "@/lib/time/calendar-day";

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
 * The timer bar shows the live portion separately. Only valid over a join
 * that admits finished sessions alone.
 */
export const FOCUS_MS = sql<string>`coalesce(sum(
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

export type TrackNote = Pick<
  FocusSession,
  "id" | "startedAt" | "endedAt" | "pausedMs" | "pausedAt" | "note" | "tags"
>;

/** How many notes the track page shows at a time. */
export const NOTES_PAGE_SIZE = 20;

export type TrackDetail = {
  track: TrackWithStats;
  analytics: AnalyticsData;
  /** Finished focus on this track since the start of this week. */
  weekMs: number;
  notes: TrackNote[];
  notesTotal: number;
  openTasks: number;
};

/**
 * Everything the track page shows. Null unless the track is the caller's:
 * someone else's id and a made-up one both 404.
 */
export async function getTrackDetail(
  trackId: string,
  rangeKey: AnalyticsRangeKey,
  notesPage: number,
): Promise<TrackDetail | null> {
  if (!z.uuid().safeParse(trackId).success) return null;

  const user = await requireUser();
  const all = await getTracksWithStats({ includeArchived: true });
  const track = all.find((t) => t.id === trackId);
  if (!track) return null;

  const stored = await requireSettings();
  const settings = {
    timeZone: stored.timezone,
    dayStartHour: stored.dayStartHour,
    weekStartsOn: stored.weekStartsOn,
  };
  const now = Date.now();
  const { earliest } = analyticsWindow(rangeKey, settings, now);
  const from = zonedInstant(addDays(earliest, -1), null, settings.timeZone);

  const withNotes = and(
    eq(focusSessions.userId, user.id),
    eq(focusSessions.trackId, trackId),
    sql`${focusSessions.endedAt} is not null`,
    sql`(${focusSessions.note} is not null or cardinality(${focusSessions.tags}) > 0)`,
  );
  const page = Math.max(1, notesPage);

  const [sessions, notes, [{ notesTotal }], [{ openTasks }]] = await Promise.all([
    getSessionsInRange(from, new Date(now)),
    db
      .select({
        id: focusSessions.id,
        startedAt: focusSessions.startedAt,
        endedAt: focusSessions.endedAt,
        pausedMs: focusSessions.pausedMs,
        pausedAt: focusSessions.pausedAt,
        note: focusSessions.note,
        tags: focusSessions.tags,
      })
      .from(focusSessions)
      .where(withNotes)
      .orderBy(desc(focusSessions.startedAt))
      .limit(NOTES_PAGE_SIZE)
      .offset((page - 1) * NOTES_PAGE_SIZE),
    db.select({ notesTotal: sql<number>`count(*)::int` }).from(focusSessions).where(withNotes),
    db
      .select({ openTasks: sql<number>`count(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, user.id),
          eq(tasks.trackId, trackId),
          sql`${tasks.status} in ('todo', 'in_progress')`,
        ),
      ),
  ]);

  const mine = sessions.filter((s) => s.trackId === trackId);

  return {
    track,
    analytics: computeAnalytics({ rangeKey, settings, now, sessions: mine, tracks: [track], tasks: [] }),
    weekMs: computeFocusSummary({ settings, now, sessions: mine }).weekMs,
    notes,
    notesTotal,
    openTasks,
  };
}

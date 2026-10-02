import { and, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { type FocusSession, focusSessions, tracks } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";

export type SessionWithTrack = FocusSession & {
  track: { id: string; title: string; color: string; icon: string };
};

const trackShape = {
  id: tracks.id,
  title: tracks.title,
  color: tracks.color,
  icon: tracks.icon,
};

/**
 * The one session currently running, if any.
 *
 * A partial unique index guarantees there is at most one, so this returning a
 * single row is a database guarantee rather than an assumption.
 */
export async function getActiveSession(): Promise<SessionWithTrack | null> {
  const user = await requireUser();

  const [row] = await db
    .select({ session: focusSessions, track: trackShape })
    .from(focusSessions)
    .innerJoin(tracks, eq(tracks.id, focusSessions.trackId))
    .where(
      and(eq(focusSessions.userId, user.id), isNull(focusSessions.endedAt)),
    )
    .limit(1);

  return row ? { ...row.session, track: row.track } : null;
}

export type SessionPage = {
  sessions: SessionWithTrack[];
  total: number;
  page: number;
  pageCount: number;
};

export async function getSessions(options?: {
  page?: number;
  pageSize?: number;
  trackId?: string;
}): Promise<SessionPage> {
  const user = await requireUser();

  const pageSize = Math.min(Math.max(options?.pageSize ?? 25, 1), 100);
  const page = Math.max(options?.page ?? 1, 1);

  const where = and(
    eq(focusSessions.userId, user.id),
    sql`${focusSessions.endedAt} is not null`,
    options?.trackId ? eq(focusSessions.trackId, options.trackId) : undefined,
  );

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(focusSessions)
    .where(where);

  const rows = await db
    .select({ session: focusSessions, track: trackShape })
    .from(focusSessions)
    .innerJoin(tracks, eq(tracks.id, focusSessions.trackId))
    .where(where)
    .orderBy(desc(focusSessions.startedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    sessions: rows.map((r) => ({ ...r.session, track: r.track })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Any finished session whose span intersects the given window.
 *
 * Used to keep manual entries from landing on top of time already logged.
 * Two ranges overlap when each starts before the other ends — the comparison
 * has to be that way round; checking only whether one start falls inside the
 * other misses the case where the new entry fully contains an existing one.
 */
export async function findOverlappingSessions(
  startedAt: Date,
  endedAt: Date,
  excludeId?: string,
): Promise<SessionWithTrack[]> {
  const user = await requireUser();

  const rows = await db
    .select({ session: focusSessions, track: trackShape })
    .from(focusSessions)
    .innerJoin(tracks, eq(tracks.id, focusSessions.trackId))
    .where(
      and(
        eq(focusSessions.userId, user.id),
        sql`${focusSessions.endedAt} is not null`,
        lt(focusSessions.startedAt, endedAt),
        gte(focusSessions.endedAt, startedAt),
        excludeId ? sql`${focusSessions.id} <> ${excludeId}` : undefined,
      ),
    )
    .limit(3);

  return rows.map((r) => ({ ...r.session, track: r.track }));
}

export async function getSessionById(
  id: string,
): Promise<SessionWithTrack | null> {
  const user = await requireUser();

  const [row] = await db
    .select({ session: focusSessions, track: trackShape })
    .from(focusSessions)
    .innerJoin(tracks, eq(tracks.id, focusSessions.trackId))
    .where(and(eq(focusSessions.id, id), eq(focusSessions.userId, user.id)))
    .limit(1);

  return row ? { ...row.session, track: row.track } : null;
}

/** Finished sessions that started within the window, oldest first. */
export async function getSessionsInRange(
  from: Date,
  to: Date,
): Promise<SessionWithTrack[]> {
  const user = await requireUser();

  const rows = await db
    .select({ session: focusSessions, track: trackShape })
    .from(focusSessions)
    .innerJoin(tracks, eq(tracks.id, focusSessions.trackId))
    .where(
      and(
        eq(focusSessions.userId, user.id),
        sql`${focusSessions.endedAt} is not null`,
        gte(focusSessions.startedAt, from),
        lte(focusSessions.startedAt, to),
      ),
    )
    .orderBy(focusSessions.startedAt);

  return rows.map((r) => ({ ...r.session, track: r.track }));
}

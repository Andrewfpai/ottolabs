import { and, eq, gte, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { achievements, focusSessions, tasks, tracks, users } from "@/db/schema";
import { longestStreak, milestoneById, SITTING_MS } from "@/features/achievements/lib/milestones";
import { totalsByDay } from "@/features/analytics/lib/metrics";
import { splitSessions } from "@/features/analytics/lib/split";
import { displayName } from "@/features/friends/lib/sharing";
import { userPicture } from "@/features/friends/server/picture";
import { FOCUS_MS } from "@/features/tracks/server/queries";
import { isMonthKey, monthBounds, shiftMonth, type WrappedData } from "@/features/wrapped/lib/wrapped";
import { requireSettings, requireUser } from "@/lib/auth-guard";
import { currentAnimal, normalizeAccessories } from "@/lib/avatars";
import { dayKey, focusDayKey, formatDayKey, zonedInstant } from "@/lib/time/calendar-day";
import { elapsedMs, MINUTE_MS } from "@/lib/time/elapsed";

export type WrappedMonth = { month: string; monthName: string; year: number; focusMs: number; current: boolean };

/** The months you studied in, newest first, with a rough total for the list. */
export async function getWrappedMonths(): Promise<WrappedMonth[]> {
  const user = await requireUser();
  const { timezone } = await requireSettings();
  const month = sql<string>`to_char(${focusSessions.startedAt} at time zone ${timezone}, 'YYYY-MM')`;
  const rows = await db
    .select({ month, focusMs: FOCUS_MS })
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, user.id), isNotNull(focusSessions.endedAt)))
    // By position: the expression carries a bound parameter, and Postgres
    // would see a second copy of it in GROUP BY as a different expression.
    .groupBy(sql`1`)
    .orderBy(sql`1 desc`);

  const thisMonth = dayKey(Date.now(), timezone).slice(0, 7);
  return rows
    .map((r) => ({ month: r.month, focusMs: Math.max(0, Math.round(Number(r.focusMs))) }))
    .filter((r) => r.focusMs >= MINUTE_MS && isMonthKey(r.month))
    .map((r) => ({
      ...r,
      monthName: formatDayKey(`${r.month}-01`, { month: "long" }),
      year: Number(r.month.slice(0, 4)),
      current: r.month === thisMonth,
    }));
}

/**
 * Everything one month's Wrapped shows, in your own time zone and day
 * boundaries. Finished sessions only: a running timer joins once it ends.
 * Null for a malformed month or one with nothing in it.
 */
export async function getWrapped(month: string): Promise<WrappedData | null> {
  if (!isMonthKey(month)) return null;
  const user = await requireUser();
  const settings = await requireSettings();
  const tz = settings.timezone;
  const { first, next, days } = monthBounds(month);
  const previous = shiftMonth(month, -1);
  const from = zonedInstant(`${previous}-01`, null, tz);
  const to = zonedInstant(next, null, tz);
  // A day of slack each side: a session can belong to a focus day that
  // starts before midnight (dayStartHour) or run across it.
  const loadFrom = new Date(from.getTime() - 86_400_000);
  const loadTo = new Date(to.getTime() + 86_400_000);
  const now = Date.now();

  const [sessions, trackRows, [profile], doneTasks, unlocked] = await Promise.all([
    db
      .select({
        id: focusSessions.id,
        trackId: focusSessions.trackId,
        roomId: focusSessions.roomId,
        startedAt: focusSessions.startedAt,
        endedAt: focusSessions.endedAt,
        pausedMs: focusSessions.pausedMs,
        pausedAt: focusSessions.pausedAt,
        completedCycles: focusSessions.completedCycles,
      })
      .from(focusSessions)
      .where(
        and(
          eq(focusSessions.userId, user.id),
          isNotNull(focusSessions.endedAt),
          gte(focusSessions.startedAt, loadFrom),
          lt(focusSessions.startedAt, loadTo),
        ),
      ),
    db.select({ id: tracks.id, title: tracks.title, color: tracks.color }).from(tracks).where(eq(tracks.userId, user.id)),
    db
      .select({ name: users.name, email: users.email, image: users.image, avatar: users.avatar, accessories: users.accessories })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, user.id),
          eq(tasks.status, "done"),
          gte(tasks.completedAt, zonedInstant(first, null, tz)),
          lt(tasks.completedAt, to),
        ),
      ),
    db
      .select({ key: achievements.key })
      .from(achievements)
      .where(
        and(
          eq(achievements.userId, user.id),
          gte(achievements.unlockedAt, zonedInstant(first, null, tz)),
          lt(achievements.unlockedAt, to),
        ),
      ),
  ]);

  const inMonth = (day: string) => day.startsWith(month);
  const slices = splitSessions(sessions, tz, settings.dayStartHour, now);
  const monthSlices = slices.filter((s) => inMonth(s.day));
  const focusMs = monthSlices.reduce((sum, s) => sum + s.ms, 0);
  if (focusMs < MINUTE_MS) return null;
  const previousMs = slices.filter((s) => s.day.startsWith(previous)).reduce((sum, s) => sum + s.ms, 0);

  const byDay = totalsByDay(monthSlices);
  let bestDay: WrappedData["bestDay"] = null;
  for (const [day, ms] of byDay) {
    if (!bestDay || ms > bestDay.ms) bestDay = { label: formatDayKey(day, { month: "short", day: "numeric" }), ms };
  }

  const hours = Array.from({ length: 24 }, () => 0);
  const byTrack = new Map<string, number>();
  for (const s of monthSlices) {
    hours[s.hour] += s.ms;
    byTrack.set(s.trackId, (byTrack.get(s.trackId) ?? 0) + s.ms);
  }
  const trackInfo = new Map(trackRows.map((t) => [t.id, t]));
  const topTracks = [...byTrack]
    .sort((a, b) => b[1] - a[1])
    .map(([id, ms]) => ({ title: trackInfo.get(id)?.title ?? "A track", color: trackInfo.get(id)?.color ?? "teal", ms }));

  // Sessions belong to the month their focus day falls in.
  const monthSessions = sessions.filter((s) => inMonth(focusDayKey(s.startedAt, tz, settings.dayStartHour)));
  const roomSessions = sessions.filter((s) => s.roomId);
  const roomMs = splitSessions(roomSessions, tz, settings.dayStartHour, now)
    .filter((s) => inMonth(s.day))
    .reduce((sum, s) => sum + s.ms, 0);

  // Study buddy: whoever else put the most time into the rooms you used.
  let topBuddy: WrappedData["topBuddy"] = null;
  const rooms = [...new Set(monthSessions.map((s) => s.roomId).filter((r): r is string => Boolean(r)))];
  if (rooms.length > 0) {
    const others = await db
      .select({
        userId: focusSessions.userId,
        name: users.name,
        email: users.email,
        image: userPicture,
        startedAt: focusSessions.startedAt,
        endedAt: focusSessions.endedAt,
        pausedMs: focusSessions.pausedMs,
        pausedAt: focusSessions.pausedAt,
      })
      .from(focusSessions)
      .innerJoin(users, eq(users.id, focusSessions.userId))
      .where(
        and(
          inArray(focusSessions.roomId, rooms),
          ne(focusSessions.userId, user.id),
          isNotNull(focusSessions.endedAt),
          gte(focusSessions.startedAt, zonedInstant(first, null, tz)),
          lt(focusSessions.startedAt, to),
        ),
      );
    const totals = new Map<string, { ms: number; name: string; image: string | null }>();
    for (const s of others) {
      const entry = totals.get(s.userId) ?? { ms: 0, name: displayName({ name: s.name, email: s.email }), image: s.image };
      entry.ms += elapsedMs(s, now);
      totals.set(s.userId, entry);
    }
    const best = [...totals.values()].sort((a, b) => b.ms - a.ms)[0];
    if (best && best.ms >= MINUTE_MS) topBuddy = { name: best.name, image: best.image };
  }

  const current = dayKey(now, tz).slice(0, 7) === month;
  const daysSoFar = current ? Number(dayKey(now, tz).slice(8, 10)) : days;

  return {
    month,
    monthName: formatDayKey(first, { month: "long" }),
    year: Number(month.slice(0, 4)),
    person: {
      name: profile ? displayName(profile) : "You",
      image: profile?.image ?? null,
      animal: currentAnimal(profile?.avatar),
      accessories: normalizeAccessories(profile?.accessories ?? []),
    },
    focusMs,
    previousFocusMs: previousMs >= MINUTE_MS ? previousMs : null,
    activeDays: [...byDay.values()].filter((ms) => ms >= MINUTE_MS).length,
    daysInMonth: daysSoFar,
    tracks: topTracks,
    hours,
    bestDay,
    longestStreak: longestStreak(byDay, SITTING_MS),
    sessions: monthSessions.length,
    pomodoros: monthSessions.reduce((sum, s) => sum + s.completedCycles, 0),
    longestSessionMs: Math.max(0, ...monthSessions.map((s) => elapsedMs(s, now))),
    tasksDone: doneTasks[0]?.count ?? 0,
    // Reviews are counted per task, not dated, so a month cannot claim them.
    reviewsDone: 0,
    roomMs,
    topBuddy,
    milestones: unlocked.flatMap((row) => {
      const m = milestoneById(row.key);
      return m ? [{ title: m.title, reward: m.reward }] : [];
    }),
  };
}

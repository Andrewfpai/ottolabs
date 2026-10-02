/**
 * Measuring progress and recording unlocks. Not a "use server" file: called
 * from other features' Server Actions (after a session or task changes) and
 * from the Milestones page, always with an explicit user id.
 */
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { achievements, focusSessions, tasks, userSettings } from "@/db/schema";
import { type AchievementStats, measureStats, metMilestones } from "@/features/achievements/lib/milestones";

/** Everything the milestones measure, for one person, right now. */
export async function loadStats(userId: string, now: number = Date.now()): Promise<AchievementStats> {
  const [settings] = await db
    .select({
      timeZone: userSettings.timezone,
      dayStartHour: userSettings.dayStartHour,
      dailyGoalMinutes: userSettings.dailyGoalMinutes,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const [sessions, [taskCounts]] = await Promise.all([
    db
      .select({
        trackId: focusSessions.trackId,
        startedAt: focusSessions.startedAt,
        endedAt: focusSessions.endedAt,
        pausedMs: focusSessions.pausedMs,
        pausedAt: focusSessions.pausedAt,
        completedCycles: focusSessions.completedCycles,
        roomId: focusSessions.roomId,
      })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, userId), sql`${focusSessions.endedAt} is not null`)),
    db
      .select({
        // `sum()` and `count()` arrive as strings unless cast (AGENTS rule 8).
        done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
        reviews: sql<number>`coalesce(sum(${tasks.reviewsDone}), 0)::int`,
      })
      .from(tasks)
      .where(eq(tasks.userId, userId)),
  ]);

  return measureStats({
    sessions,
    tasksDone: taskCounts?.done ?? 0,
    reviewsDone: taskCounts?.reviews ?? 0,
    settings: {
      timeZone: settings?.timeZone ?? "UTC",
      dayStartHour: settings?.dayStartHour ?? 0,
      dailyGoalMinutes: settings?.dailyGoalMinutes ?? 0,
    },
    now,
  });
}

/** Record every milestone met and not yet recorded. Returns the new ones, and the stats. */
export async function syncAchievements(userId: string): Promise<{ fresh: string[]; stats: AchievementStats }> {
  const stats = await loadStats(userId);
  const met = metMilestones(stats);
  if (met.length === 0) return { fresh: [], stats };
  const inserted = await db
    .insert(achievements)
    .values(met.map((m) => ({ userId, key: m.id })))
    .onConflictDoNothing()
    .returning({ key: achievements.key });
  return { fresh: inserted.map((row) => row.key), stats };
}

/**
 * Check for new milestones after something that can earn one. Never lets a
 * failure here break the action that called it: an unlock can wait for the
 * next check, a lost session cannot.
 */
export async function checkMilestones(userId: string): Promise<void> {
  try {
    const { fresh } = await syncAchievements(userId);
    // The celebration lives in the app shell, on every page.
    if (fresh.length > 0) revalidatePath("/", "layout");
  } catch (error) {
    console.error("[achievements] check failed", error);
  }
}

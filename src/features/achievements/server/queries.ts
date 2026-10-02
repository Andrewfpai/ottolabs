import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { achievements, users } from "@/db/schema";
import { type AchievementStats, milestoneById } from "@/features/achievements/lib/milestones";
import { syncAchievements } from "@/features/achievements/server/sync";
import { requireUser } from "@/lib/auth-guard";
import { type AccessoryId, normalizeAccessories } from "@/lib/avatars";

export type MilestonesPage = {
  stats: AchievementStats;
  /** Milestone id → when it was unlocked. */
  unlocked: Record<string, Date>;
  wearing: AccessoryId[];
  /** The chosen animal, or null if they use a photo. */
  avatar: string | null;
  photo: string | null;
};

/**
 * Progress on every milestone. Catches up on unlocks first, so history from
 * before milestones existed counts the first time you look.
 */
export async function getMilestonesPage(): Promise<MilestonesPage> {
  const user = await requireUser();
  const { stats } = await syncAchievements(user.id);

  const [rows, [profile]] = await Promise.all([
    db
      .select({ key: achievements.key, unlockedAt: achievements.unlockedAt })
      .from(achievements)
      .where(eq(achievements.userId, user.id)),
    db
      .select({ avatar: users.avatar, photo: users.image, accessories: users.accessories })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1),
  ]);

  return {
    stats,
    unlocked: Object.fromEntries(rows.map((r) => [r.key, r.unlockedAt])),
    wearing: normalizeAccessories(profile?.accessories ?? []),
    avatar: profile?.avatar ?? null,
    photo: profile?.photo ?? null,
  };
}

export type Celebration = { id: string; title: string; reward: AccessoryId };

/** Unlocks not yet celebrated, for the app shell. */
export async function getUncelebrated(): Promise<Celebration[]> {
  const user = await requireUser();
  const rows = await db
    .select({ key: achievements.key })
    .from(achievements)
    .where(and(eq(achievements.userId, user.id), isNull(achievements.seenAt)));
  return rows.flatMap((row) => {
    const milestone = milestoneById(row.key);
    return milestone ? [{ id: milestone.id, title: milestone.title, reward: milestone.reward }] : [];
  });
}

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { type TrackUnit, trackUnits } from "@/db/schema";
import { type PlanProgress, planProgress } from "@/features/study-plan/lib/plan";
import { requireUser } from "@/lib/auth-guard";

/** One track's plan, in order. Only the caller's own units are ever read. */
export async function getStudyPlan(trackId: string): Promise<TrackUnit[]> {
  const user = await requireUser();
  return db
    .select()
    .from(trackUnits)
    .where(and(eq(trackUnits.userId, user.id), eq(trackUnits.trackId, trackId)))
    .orderBy(asc(trackUnits.position), asc(trackUnits.createdAt));
}

/**
 * Progress for every track that has a plan, for the track cards. Loads just
 * the order and done-state of each unit — a couple of hundred rows at most —
 * and reuses `planProgress`, so a card and the track page always agree.
 */
export async function getPlanSummaries(): Promise<Map<string, PlanProgress>> {
  const user = await requireUser();
  const rows = await db
    .select({ trackId: trackUnits.trackId, completedAt: trackUnits.completedAt })
    .from(trackUnits)
    .where(eq(trackUnits.userId, user.id))
    .orderBy(asc(trackUnits.trackId), asc(trackUnits.position), asc(trackUnits.createdAt));

  const byTrack = new Map<string, { completedAt: Date | null }[]>();
  for (const row of rows) byTrack.set(row.trackId, [...(byTrack.get(row.trackId) ?? []), row]);
  return new Map([...byTrack].map(([trackId, units]) => [trackId, planProgress(units)]));
}

"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { achievements, users } from "@/db/schema";
import { MILESTONES } from "@/features/achievements/lib/milestones";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireUser } from "@/lib/auth-guard";
import { normalizeAccessories } from "@/lib/avatars";

/** Choose what your animal wears. Only accessories you have unlocked. */
export async function setAccessories(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.object({ accessories: z.array(z.string().max(40)).max(10) }).safeParse(input);
  if (!parsed.success) return fail("Those accessories do not look right.");
  const wanted = normalizeAccessories(parsed.data.accessories);

  const unlocked = new Set(
    (
      await db
        .select({ key: achievements.key })
        .from(achievements)
        .where(eq(achievements.userId, user.id))
    ).map((row) => row.key),
  );
  const earned = new Set(MILESTONES.filter((m) => unlocked.has(m.id)).map((m) => m.reward));
  const locked = wanted.find((id) => !earned.has(id));
  if (locked) return fail("Unlock that one first.", "LOCKED");

  await db.update(users).set({ accessories: wanted }).where(eq(users.id, user.id));
  // Worn everywhere your avatar shows.
  revalidatePath("/", "layout");
  return ok(undefined);
}

/** The celebration was shown. */
export async function markCelebrated(): Promise<ActionResult> {
  const user = await requireUser();
  await db
    .update(achievements)
    .set({ seenAt: new Date() })
    .where(and(eq(achievements.userId, user.id), isNull(achievements.seenAt)));
  return ok(undefined);
}

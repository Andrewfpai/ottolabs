"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireUser } from "@/lib/auth-guard";

/**
 * Rejects anything the runtime does not recognise as an IANA zone. The value
 * reaches us from the browser and is fed straight into date bucketing, so a
 * junk string would poison every analytic that depends on it.
 */
const timezoneSchema = z.string().refine(
  (value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Not a recognised IANA time zone" },
);

/**
 * Adopt the browser's time zone, but only while the stored value is still the
 * untouched default. Once someone picks a zone in Settings deliberately, a
 * laptop opened in another country must not silently overwrite it.
 */
export async function adoptBrowserTimezone(candidate: string): Promise<void> {
  const user = await requireUser();

  const parsed = timezoneSchema.safeParse(candidate);
  if (!parsed.success) return;

  const current = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, user.id),
    columns: { timezone: true },
  });

  if (!current || current.timezone !== "UTC" || parsed.data === "UTC") return;

  await db
    .update(userSettings)
    .set({ timezone: parsed.data })
    .where(eq(userSettings.userId, user.id));
}

export async function setTimezone(candidate: string): Promise<void> {
  const user = await requireUser();

  const parsed = timezoneSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(`Unrecognised time zone: ${candidate}`);
  }

  await db
    .update(userSettings)
    .set({ timezone: parsed.data })
    .where(eq(userSettings.userId, user.id));
}

/** Fifteen minutes to a full day; a goal outside that is a typo. */
const dailyGoalSchema = z.object({
  minutes: z
    .number()
    .int()
    .min(15, "Set at least 15 minutes")
    .max(24 * 60, "A day only has 24 hours"),
});

export async function setDailyGoal(input: unknown): Promise<ActionResult<number>> {
  const user = await requireUser();

  const parsed = dailyGoalSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That goal does not look right.");
  }

  await db
    .update(userSettings)
    .set({ dailyGoalMinutes: parsed.data.minutes })
    .where(eq(userSettings.userId, user.id));

  revalidatePath("/dashboard");
  return ok(parsed.data.minutes);
}

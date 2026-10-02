"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  allowedEmails,
  focusSessions,
  tasks,
  tracks,
  type UserSettings,
  userSettings,
  users,
} from "@/db/schema";
import { settingsSchema, timezoneSchema } from "@/features/settings/schema";
import { type ActionResult, fail, isInvalidParameterValue, ok } from "@/lib/action-result";
import { isOwnerEmail, normalizeEmail } from "@/lib/access";
import { requireUser } from "@/lib/auth-guard";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Keep all-day deadlines on the same calendar date when the zone changes.
 *
 * An all-day task is stored as midnight in the zone that was current when it
 * was saved. Leave it alone and switching from Jakarta to London moves a
 * "Friday" deadline to Thursday evening. Postgres re-reads the stored instant
 * as a wall-clock time in the old zone, then places that wall-clock time in
 * the new one. Timed deadlines are left as they are: 14:30 in Jakarta is a
 * fixed moment, and it should stay that moment wherever you travel.
 */
async function reanchorAllDayTasks(tx: Tx, userId: string, from: string, to: string) {
  if (from === to) return;
  await tx
    .update(tasks)
    .set({ dueAt: sql`(${tasks.dueAt} at time zone ${from}) at time zone ${to}` })
    .where(and(eq(tasks.userId, userId), eq(tasks.isAllDay, true), isNotNull(tasks.dueAt)));
}

/** Every page reads settings through the shared layout, so refresh them all. */
function revalidateEverything() {
  revalidatePath("/", "layout");
}

/**
 * Adopt the browser's time zone, but only while the stored value is still the
 * untouched default. Once someone picks a zone in Settings deliberately, a
 * laptop opened in another country must not silently overwrite it.
 */
export async function adoptBrowserTimezone(candidate: string): Promise<void> {
  const user = await requireUser();

  const parsed = timezoneSchema.safeParse(candidate);
  if (!parsed.success || parsed.data === "UTC") return;

  const changed = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ timezone: userSettings.timezone })
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .for("update");

    if (!current || current.timezone !== "UTC") return false;

    await reanchorAllDayTasks(tx, user.id, "UTC", parsed.data);
    await tx
      .update(userSettings)
      .set({ timezone: parsed.data })
      .where(eq(userSettings.userId, user.id));
    return true;
  });

  if (changed) revalidateEverything();
}

export async function updateSettings(input: unknown): Promise<ActionResult<UserSettings>> {
  const user = await requireUser();

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Those settings do not look right.");
  }

  const { pomodoro, ...values } = parsed.data;

  try {
    const updated = await db.transaction(async (tx) => {
      // Locked so two tabs saving at once cannot both re-anchor from the
      // same old zone and shift the deadlines twice.
      const [current] = await tx
        .select({ timezone: userSettings.timezone })
        .from(userSettings)
        .where(eq(userSettings.userId, user.id))
        .for("update");

      if (current) await reanchorAllDayTasks(tx, user.id, current.timezone, values.timezone);

      const [row] = await tx
        .update(userSettings)
        .set({ ...values, defaultPomodoro: pomodoro })
        .where(eq(userSettings.userId, user.id))
        .returning();
      return row;
    });

    if (!updated) return fail("Your settings could not be found. Sign out and back in.");

    revalidateEverything();
    return ok(updated);
  } catch (error) {
    // Node and Postgres ship separate zone databases; a name one knows and
    // the other does not fails here rather than half-applying.
    if (isInvalidParameterValue(error)) {
      return fail("The database does not recognise that time zone. Pick a nearby city instead.");
    }
    throw error;
  }
}

/** Fifteen minutes to a full day; a goal outside that is a typo. */
const dailyGoalSchema = z.object({
  minutes: settingsSchema.shape.dailyGoalMinutes,
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
  revalidatePath("/settings");
  return ok(parsed.data.minutes);
}

const deleteAccountSchema = z.object({ confirmEmail: z.string().max(320) });

/**
 * Delete your account and everything in it, permanently.
 *
 * Typing your email is the confirmation. Sessions go first: they block their
 * track's deletion on purpose (history must not vanish with a track), so the
 * order is sessions, then tasks and tracks, then the user row, whose cascade
 * takes logins, settings, friendships, room memberships and rooms you own.
 * Your invitation goes too, so leaving means leaving. An owner listed in
 * ALLOWED_EMAILS can still sign in again, which starts a fresh, empty account.
 */
export async function deleteMyAccount(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success || normalizeEmail(parsed.data.confirmEmail) !== normalizeEmail(user.email)) {
    return fail("Type your email address exactly to confirm.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(focusSessions).where(eq(focusSessions.userId, user.id));
    await tx.delete(tasks).where(eq(tasks.userId, user.id));
    await tx.delete(tracks).where(eq(tracks.userId, user.id));
    if (!isOwnerEmail(user.email)) {
      await tx.delete(allowedEmails).where(eq(allowedEmails.email, normalizeEmail(user.email)));
    }
    await tx.delete(users).where(eq(users.id, user.id));
  });

  return ok(undefined);
}

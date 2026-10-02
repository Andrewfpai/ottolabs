"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { pushSubscriptions, userSettings } from "@/db/schema";
import { deviceLabel } from "@/features/reminders/lib/reminders";
import { pushConfigured, sendToUser } from "@/features/reminders/server/push";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireUser } from "@/lib/auth-guard";

// Push endpoints are https URLs on the browser vendor's push service; the
// keys are base64url. Bounded so nothing unreasonable is ever stored.
const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  p256dh: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).max(200),
  auth: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).max(100),
});

const prefsSchema = z.object({
  remindDeadlines: z.boolean(),
  remindDailyGoal: z.boolean(),
  notifyRoomActivity: z.boolean(),
});

/**
 * Remember this device for push. One row per device: if it was registered
 * under another account (a shared computer), it now belongs to whoever is
 * signed in, so the previous person stops receiving pushes there.
 */
export async function saveSubscription(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return fail("This browser returned a subscription that does not look right.");

  const label = deviceLabel((await headers()).get("user-agent") ?? "");
  await db
    .insert(pushSubscriptions)
    .values({ ...parsed.data, userId: user.id, label })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: parsed.data.p256dh, auth: parsed.data.auth, label },
    });

  revalidatePath("/settings");
  return ok(undefined);
}

/** Stop pushing to one of your devices. */
export async function removeSubscription(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Unknown device.");

  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.id, parsed.data.id), eq(pushSubscriptions.userId, user.id)));

  revalidatePath("/settings");
  return ok(undefined);
}

export async function updateReminderPrefs(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return fail("Those reminder settings do not look right.");

  await db.update(userSettings).set(parsed.data).where(eq(userSettings.userId, user.id));
  revalidatePath("/settings");
  return ok(undefined);
}

/** A test push to every device you enabled, so you can see it arrive. */
export async function sendTestPush(): Promise<ActionResult<number>> {
  const user = await requireUser();
  if (!pushConfigured()) return fail("Push is not set up on the server yet (VAPID keys are missing).");

  const delivered = await sendToUser(user.id, {
    title: "OttoLabs reminders are on",
    body: "This is what a reminder looks like on this device.",
    url: "/settings",
    tag: "test",
  });
  if (delivered === 0) return fail("No device accepted it. Turn notifications on for this device first.");
  return ok(delivered);
}

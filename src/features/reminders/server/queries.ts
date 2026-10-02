import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { pushConfigured } from "@/features/reminders/server/push";
import { requireSettings, requireUser } from "@/lib/auth-guard";

export type ReminderSettings = {
  configured: boolean;
  prefs: {
    remindDeadlines: boolean;
    remindDailyGoal: boolean;
    notifyRoomActivity: boolean;
    notifyCheers: boolean;
    remindReviews: boolean;
  };
  devices: { id: string; label: string; createdAt: Date }[];
};

export async function getReminderSettings(): Promise<ReminderSettings> {
  const user = await requireUser();
  const settings = await requireSettings();
  const devices = await db
    .select({ id: pushSubscriptions.id, label: pushSubscriptions.label, createdAt: pushSubscriptions.createdAt })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id))
    .orderBy(asc(pushSubscriptions.createdAt));

  return {
    configured: pushConfigured(),
    prefs: {
      remindDeadlines: settings.remindDeadlines,
      remindDailyGoal: settings.remindDailyGoal,
      notifyRoomActivity: settings.notifyRoomActivity,
      notifyCheers: settings.notifyCheers,
      remindReviews: settings.remindReviews,
    },
    devices: devices.map((d) => ({ ...d, label: d.label ?? "A device" })),
  };
}

/**
 * Sending Web Push, and everything that decides who gets what.
 *
 * Not a "use server" file: these run from the cron route and from `after()`
 * in startSession, with an explicit user id, never from the browser.
 */
import { and, eq, gte, inArray, ne, or, sql } from "drizzle-orm";
import webpush from "web-push";

import { db } from "@/db";
import {
  focusSessions,
  pushSubscriptions,
  reminderLog,
  roomMembers,
  studyRooms,
  tasks,
  userSettings,
  users,
} from "@/db/schema";
import { computeFocusSummary } from "@/features/analytics/lib/compute";
import { displayName } from "@/features/friends/lib/sharing";
import {
  deadlineMessage,
  eveningKey,
  goalGapMessage,
  type PushMessage,
  roomAlertKey,
  roomStartMessage,
  tasksDueTomorrow,
} from "@/features/reminders/lib/reminders";
import { isHeartbeatFresh } from "@/features/sessions/lib/staleness";
import { dayKey, wallClock } from "@/lib/time/calendar-day";

let configured: boolean | null = null;

/** True once the VAPID keys are present; without them nothing is sent. */
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", publicKey, privateKey);
  configured = true;
  return true;
}

/** Push to every device the user enabled. Returns how many accepted it. */
export async function sendToUser(userId: string, message: PushMessage): Promise<number> {
  if (!pushConfigured()) return 0;
  const devices = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));

  const results = await Promise.all(
    devices.map(async (device) => {
      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          JSON.stringify(message),
          // A reminder that arrives a day late is worse than none.
          { TTL: 6 * 3600, urgency: "normal" },
        );
        return true;
      } catch (error) {
        // 404/410: the device unsubscribed or the app was removed. Forget it.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, device.id));
        }
        return false;
      }
    }),
  );
  return results.filter(Boolean).length;
}

/**
 * Record that a reminder is being sent; false if it already was. Claimed
 * before sending, so a retry or a second cron run can never send it twice —
 * at the cost of not retrying a send that failed.
 */
export async function claimReminder(userId: string, key: string): Promise<boolean> {
  const inserted = await db
    .insert(reminderLog)
    .values({ userId, key })
    .onConflictDoNothing()
    .returning({ key: reminderLog.key });
  return inserted.length > 0;
}

/** Local evening, when "tomorrow" and "today's goal" are worth hearing about. */
const EVENING_FROM_HOUR = 17;

export type EveningRun = { checked: number; sent: number; skippedNotEvening: number };

/**
 * The daily evening check: tasks due tomorrow, and how far you are from
 * today's goal. Each person only on their own local evening (17:00–23:59);
 * the cron runs once a day, so people in other zones are skipped rather than
 * woken at 6am.
 */
export async function runEveningReminders(now: number = Date.now()): Promise<EveningRun> {
  const run: EveningRun = { checked: 0, sent: 0, skippedNotEvening: 0 };
  if (!pushConfigured()) return run;

  const people = await db
    .selectDistinct({
      userId: userSettings.userId,
      timeZone: userSettings.timezone,
      dayStartHour: userSettings.dayStartHour,
      weekStartsOn: userSettings.weekStartsOn,
      dailyGoalMinutes: userSettings.dailyGoalMinutes,
      remindDeadlines: userSettings.remindDeadlines,
      remindDailyGoal: userSettings.remindDailyGoal,
    })
    .from(userSettings)
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, userSettings.userId))
    .where(or(eq(userSettings.remindDeadlines, true), eq(userSettings.remindDailyGoal, true)));

  for (const person of people) {
    run.checked += 1;
    if (wallClock(now, person.timeZone).hour < EVENING_FROM_HOUR) {
      run.skippedNotEvening += 1;
      continue;
    }
    const today = dayKey(now, person.timeZone);

    if (person.remindDeadlines) {
      const open = await db
        .select({ title: tasks.title, dueAt: tasks.dueAt, status: tasks.status })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, person.userId),
            inArray(tasks.status, ["todo", "in_progress"]),
            // Generous window; the exact local "tomorrow" is decided in code.
            gte(tasks.dueAt, new Date(now)),
            sql`${tasks.dueAt} < ${new Date(now + 3 * 86_400_000)}`,
          ),
        );
      const message = deadlineMessage(tasksDueTomorrow(open, now, person.timeZone));
      if (message && (await claimReminder(person.userId, eveningKey("deadlines", today)))) {
        run.sent += (await sendToUser(person.userId, message)) > 0 ? 1 : 0;
      }
    }

    if (person.remindDailyGoal) {
      const sessions = await db
        .select({
          trackId: focusSessions.trackId,
          startedAt: focusSessions.startedAt,
          endedAt: focusSessions.endedAt,
          pausedMs: focusSessions.pausedMs,
          pausedAt: focusSessions.pausedAt,
          lastHeartbeatAt: focusSessions.lastHeartbeatAt,
        })
        .from(focusSessions)
        .where(and(eq(focusSessions.userId, person.userId), gte(focusSessions.startedAt, new Date(now - 2 * 86_400_000))));
      // A running timer counts up to now, unless it was abandoned.
      const counted = sessions.filter((s) => s.endedAt !== null || isHeartbeatFresh(s.lastHeartbeatAt, now));
      const { todayMs } = computeFocusSummary({
        settings: { timeZone: person.timeZone, dayStartHour: person.dayStartHour, weekStartsOn: person.weekStartsOn },
        now,
        sessions: counted,
      });
      const message = goalGapMessage(todayMs, person.dailyGoalMinutes);
      if (message && (await claimReminder(person.userId, eveningKey("goal", today)))) {
        run.sent += (await sendToUser(person.userId, message)) > 0 ? 1 : 0;
      }
    }
  }
  return run;
}

/**
 * "Sam started focusing in Finals grind", to the room's other joined members
 * who asked for room alerts. Called via after(), so it never slows the start.
 */
export async function notifyRoomStart(roomId: string, starterId: string, now: number = Date.now()): Promise<void> {
  if (!pushConfigured()) return;

  const [room] = await db.select({ name: studyRooms.name }).from(studyRooms).where(eq(studyRooms.id, roomId)).limit(1);
  const [starter] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, starterId))
    .limit(1);
  if (!room || !starter) return;

  const recipients = await db
    .selectDistinct({ userId: roomMembers.userId })
    .from(roomMembers)
    .innerJoin(userSettings, eq(userSettings.userId, roomMembers.userId))
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, roomMembers.userId))
    .where(
      and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.status, "joined"),
        ne(roomMembers.userId, starterId),
        eq(userSettings.notifyRoomActivity, true),
      ),
    );

  const message = roomStartMessage({ name: displayName(starter), roomName: room.name, roomId });
  await Promise.all(
    recipients.map(async ({ userId }) => {
      if (await claimReminder(userId, roomAlertKey(roomId, starterId, now))) {
        await sendToUser(userId, message);
      }
    }),
  );
}

/** Housekeeping: the log only needs to remember about a week. */
export async function pruneReminderLog(now: number = Date.now()): Promise<void> {
  await db.delete(reminderLog).where(sql`${reminderLog.sentAt} < ${new Date(now - 8 * 86_400_000)}`);
}


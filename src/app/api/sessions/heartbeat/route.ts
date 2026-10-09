import { and, eq, isNull } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/db";
import { focusSessions } from "@/db/schema";
import { maybeRunDueTaskReminders } from "@/features/tasks/server/reminders";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * "Still here." Sent roughly once a minute while a timer runs.
 *
 * This is what lets the reaper tell a session you are still in from one you
 * walked away from. Without it, closing the laptop mid-session leaves a row
 * that keeps accruing until you next open the app, and a single fourteen-hour
 * phantom session poisons every average, streak and best-day downstream.
 *
 * A route handler rather than a Server Action deliberately: Server Actions
 * carry re-render and revalidation machinery, and this must be as close to a
 * no-op as possible when it fires every 60 seconds.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });

  const updated = await db
    .update(focusSessions)
    .set({ lastHeartbeatAt: new Date() })
    .where(
      and(
        eq(focusSessions.userId, session.user.id),
        isNull(focusSessions.endedAt),
      ),
    )
    .returning({ id: focusSessions.id });

  // While anyone is focusing, reminders ring close to on time without waiting
  // for the scheduler. After the response, so the heartbeat stays instant.
  after(() => maybeRunDueTaskReminders());

  // 409 tells the client its session is gone — stopped elsewhere, or reaped —
  // so it can stop ticking rather than displaying a timer that no longer exists.
  return new Response(null, { status: updated.length > 0 ? 204 : 409 });
}

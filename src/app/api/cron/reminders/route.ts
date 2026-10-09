import { pruneReminderLog, runEveningReminders } from "@/features/reminders/server/push";
import { runDueTaskReminders } from "@/features/tasks/server/reminders";

export const dynamic = "force-dynamic";

/**
 * The daily evening check (vercel.json, 12:00 UTC — evening across East and
 * South-East Asia): tasks due tomorrow, and the gap to today's goal, for
 * people who switched those on. Each person only on their local evening.
 * Refuses to run without CRON_SECRET, like the reaper.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 });
  }

  const result = await runEveningReminders();
  await pruneReminderLog();
  // A daily sweep too, in case no scheduler is set up.
  const tasks = await runDueTaskReminders();
  return Response.json({ ...result, tasks });
}

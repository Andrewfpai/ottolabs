import { runDueTaskReminders } from "@/features/tasks/server/reminders";

export const dynamic = "force-dynamic";

/**
 * Rings task reminders that are due ("2 hours before" and the like). Meant
 * to be called every few minutes by an external scheduler such as
 * cron-job.org, since Vercel's free plan only runs its own crons daily.
 * Same CRON_SECRET bearer as the other cron routes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 });
  }
  return Response.json(await runDueTaskReminders());
}

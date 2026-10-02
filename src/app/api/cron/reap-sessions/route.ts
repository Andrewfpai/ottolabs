import { reapStaleSessions, STALE_AFTER_MINUTES } from "@/features/sessions/server/reaper";

export const dynamic = "force-dynamic";

/**
 * The daily backstop for abandoned timers; see `reapStaleSessions`. Scheduled
 * in vercel.json. Most sessions are closed sooner, the next time their owner
 * opens the app.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Refuse to run
  // unguarded — an open endpoint here could stop somebody's running timer.
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 });
  }

  const sessions = await reapStaleSessions();

  return Response.json({
    reaped: sessions.length,
    sessions,
    staleAfterMinutes: STALE_AFTER_MINUTES,
  });
}

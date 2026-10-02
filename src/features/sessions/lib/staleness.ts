/**
 * When a running timer stops counting as running.
 *
 * Shared by the reaper, which closes such sessions, and by anything that shows
 * a session as live to someone else: a friend's abandoned timer stays open
 * until they return or the daily cron runs, and must not read as "studying
 * now" in the meantime.
 */
export const STALE_AFTER_MINUTES = 30;

export function isHeartbeatFresh(lastHeartbeatAt: Date | null, now: number): boolean {
  return (
    lastHeartbeatAt !== null && now - lastHeartbeatAt.getTime() < STALE_AFTER_MINUTES * 60_000
  );
}

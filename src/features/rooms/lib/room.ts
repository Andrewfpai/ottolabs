/**
 * What a room shows, as pure functions of sessions and the clock.
 */
import { computeFocusSummary, type AnalyticsSettings } from "@/features/analytics/lib/compute";
import type { SplittableSession } from "@/features/analytics/lib/split";
import { isHeartbeatFresh } from "@/features/sessions/lib/staleness";

/** Small enough that polling every member every few seconds stays cheap. */
export const MAX_ROOM_MEMBERS = 12;

/** How often an open room page asks for updates. */
export const ROOM_POLL_MS = 10_000;

export type MemberState = "focusing" | "break" | "paused" | "away";

type LiveRow = {
  endedAt: Date | null;
  pausedAt: Date | null;
  breakStartedAt: Date | null;
  lastHeartbeatAt: Date | null;
};

/**
 * A member's state from their open session, if any. A timer whose heartbeat
 * went quiet counts as away — the reaper has not closed it yet, but nobody is
 * there.
 */
export function memberState(session: LiveRow | null, now: number): MemberState {
  if (!session || session.endedAt || !isHeartbeatFresh(session.lastHeartbeatAt, now)) return "away";
  if (session.pausedAt) return session.breakStartedAt ? "break" : "paused";
  return "focusing";
}

export type RoomTotals = {
  todayMs: number;
  weekMs: number;
  /** This week's focus in the room, per member id. */
  weekByMember: Record<string, number>;
};

/**
 * Time focused together: sessions started in this room, bucketed by the
 * viewer's own days and week. A live session counts up to now while its
 * heartbeat is fresh; an abandoned one does not inflate the room.
 */
export function roomTotals(
  sessions: readonly (SplittableSession & { userId: string; lastHeartbeatAt?: Date | null })[],
  settings: AnalyticsSettings,
  now: number,
): RoomTotals {
  const counted = sessions.filter(
    (s) => s.endedAt !== null || isHeartbeatFresh(s.lastHeartbeatAt ?? null, now),
  );

  const all = computeFocusSummary({ settings, now, sessions: counted });

  const byUser = new Map<string, typeof counted>();
  for (const s of counted) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);

  const weekByMember: Record<string, number> = {};
  for (const [userId, list] of byUser) {
    weekByMember[userId] = computeFocusSummary({ settings, now, sessions: list }).weekMs;
  }

  return { todayMs: all.todayMs, weekMs: all.weekMs, weekByMember };
}

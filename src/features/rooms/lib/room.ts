/**
 * What a room shows, as pure functions of sessions and the clock.
 */
import { computeFocusSummary, type AnalyticsSettings } from "@/features/analytics/lib/compute";
import type { SplittableSession } from "@/features/analytics/lib/split";
import { isHeartbeatFresh } from "@/features/sessions/lib/staleness";

/** Small enough that polling every member every few seconds stays cheap. */
export const MAX_ROOM_MEMBERS = 12;

/** How often an open room page asks for updates. */
export const ROOM_POLL_MS = 5_000;

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
  /** This week's focus, per member id. */
  weekByMember: Record<string, number>;
  /** Today's focus, per member id. */
  todayByMember: Record<string, number>;
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
  const todayByMember: Record<string, number> = {};
  for (const [userId, list] of byUser) {
    const summary = computeFocusSummary({ settings, now, sessions: list });
    weekByMember[userId] = summary.weekMs;
    todayByMember[userId] = summary.todayMs;
  }

  return { todayMs: all.todayMs, weekMs: all.weekMs, weekByMember, todayByMember };
}

// ── Reactions ──────────────────────────────────────────────────────────────

/** What a room can send each other: a quick nudge, never a chat. */
export const ROOM_REACTIONS = ["clap", "fire", "muscle", "coffee"] as const;
export type RoomReaction = (typeof ROOM_REACTIONS)[number];
export const REACTION_EMOJI: Record<RoomReaction, string> = { clap: "👏", fire: "🔥", muscle: "💪", coffee: "☕" };
/** One reaction per person every few seconds: enough to cheer, not to spam. */
export const REACTION_COOLDOWN_MS = 3_000;
/** How long a reaction stays visible to people polling the room. */
export const REACTION_WINDOW_MS = 60_000;

// ── Activity ───────────────────────────────────────────────────────────────

export type ActivityEvent =
  | { kind: "start"; at: number; userId: string; trackLabel: string; trackColor: string }
  | { kind: "finish"; at: number; userId: string; focusMs: number };

/** How far back the activity feed looks. */
export const ACTIVITY_WINDOW_MS = 12 * 3_600_000;

/**
 * What happened in the room lately: who started on what, who finished and
 * how long they focused. Newest first. `focusMsOf` is how a session's focus
 * is measured (elapsed.ts), passed in to keep this file free of it.
 */
export function roomActivity<S extends { userId: string; trackId: string; startedAt: Date; endedAt: Date | null }>(
  sessions: readonly S[],
  label: (trackId: string) => { title: string; color: string },
  focusMsOf: (session: S) => number,
  now: number,
  limit = 10,
): ActivityEvent[] {
  const since = now - ACTIVITY_WINDOW_MS;
  const events: ActivityEvent[] = [];
  for (const s of sessions) {
    if (s.startedAt.getTime() >= since) {
      const track = label(s.trackId);
      events.push({ kind: "start", at: s.startedAt.getTime(), userId: s.userId, trackLabel: track.title, trackColor: track.color });
    }
    if (s.endedAt && s.endedAt.getTime() >= since) {
      events.push({ kind: "finish", at: s.endedAt.getTime(), userId: s.userId, focusMs: focusMsOf(s) });
    }
  }
  return events.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** "just now", "3m ago", "2h ago". */
export function agoLabel(at: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

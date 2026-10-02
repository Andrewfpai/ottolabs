/**
 * What each reminder says and when it counts as already sent — pure, so the
 * wording and the edge cases are tested rather than discovered on a phone.
 */
import { addDays, type DayKey, dayKey } from "@/lib/time/calendar-day";
import { formatCompact, MINUTE_MS } from "@/lib/time/elapsed";

export type PushMessage = {
  title: string;
  body: string;
  /** Opened when the notification is clicked. Always an in-app path. */
  url: string;
  /** Replaces an earlier notification with the same tag instead of stacking. */
  tag: string;
};

type DueTask = {
  title: string;
  dueAt: Date | null;
  status: "todo" | "in_progress" | "done" | "cancelled";
};

/** Open tasks whose deadline falls on tomorrow's calendar date in `timeZone`. */
export function tasksDueTomorrow<T extends DueTask>(tasks: readonly T[], now: number, timeZone: string): T[] {
  const tomorrow = addDays(dayKey(now, timeZone), 1);
  return tasks.filter(
    (t) =>
      (t.status === "todo" || t.status === "in_progress") &&
      t.dueAt !== null &&
      dayKey(t.dueAt, timeZone) === tomorrow,
  );
}

export function deadlineMessage(tasks: readonly { title: string }[]): PushMessage | null {
  if (tasks.length === 0) return null;
  if (tasks.length === 1) {
    return { title: "Due tomorrow", body: tasks[0].title, url: "/tasks", tag: "deadlines" };
  }
  const shown = tasks.slice(0, 2).map((t) => t.title);
  const rest = tasks.length - shown.length;
  return {
    title: `${tasks.length} tasks due tomorrow`,
    body: rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(" and "),
    url: "/tasks",
    tag: "deadlines",
  };
}

/** Null once the goal is met: a reminder you have already earned is noise. */
export function goalGapMessage(todayMs: number, goalMinutes: number): PushMessage | null {
  const goalMs = goalMinutes * MINUTE_MS;
  const gapMs = goalMs - todayMs;
  // Under a minute short is "reached" for anyone reading a notification.
  if (gapMs < MINUTE_MS) return null;
  return {
    title: `${formatCompact(gapMs)} to today's goal`,
    body:
      todayMs > 0
        ? `You have focused ${formatCompact(todayMs)} of ${formatCompact(goalMs)} today.`
        : `Nothing logged yet today. Your goal is ${formatCompact(goalMs)}.`,
    url: "/dashboard",
    tag: "daily-goal",
  };
}

export function roomStartMessage(input: {
  name: string;
  roomName: string;
  roomId: string;
}): PushMessage {
  return {
    title: `${input.name} started focusing`,
    body: `In ${input.roomName}. Join them?`,
    url: `/rooms/${input.roomId}`,
    tag: `room-${input.roomId}`,
  };
}

// ── Keys for the "already sent" log ─────────────────────────────────────────

/** One evening reminder of each kind per local day. */
export function eveningKey(kind: "deadlines" | "goal" | "reviews", today: DayKey): string {
  return `${kind}:${today}`;
}

/** Room alerts about the same person in the same room: at most one per 30 min. */
export const ROOM_ALERT_WINDOW_MS = 30 * MINUTE_MS;

export function roomAlertKey(roomId: string, starterId: string, now: number): string {
  return `room:${roomId}:${starterId}:${Math.floor(now / ROOM_ALERT_WINDOW_MS)}`;
}

/** "Chrome on Windows", "Safari on iPhone" — enough to tell your devices apart. */
export function deviceLabel(userAgent: string): string {
  const ua = userAgent;
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "this device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  return `${browser} on ${os}`;
}

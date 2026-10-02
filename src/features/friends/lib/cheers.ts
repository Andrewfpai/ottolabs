/**
 * Cheers: a 👏 or 🔥 for a friend. Pure rules, so the cooldown and wording
 * are tested.
 */
import { formatCompact, MINUTE_MS } from "@/lib/time/elapsed";

export const CHEER_KINDS = ["clap", "fire"] as const;
export type CheerKind = (typeof CHEER_KINDS)[number];

export const CHEER_EMOJI: Record<CheerKind, string> = { clap: "👏", fire: "🔥" };

/**
 * One cheer per friend per three hours. Often enough to answer a long
 * session, rare enough that a cheer still means something.
 */
export const CHEER_COOLDOWN_MS = 3 * 3_600_000;

/** How long until you may cheer this friend again; 0 means now. */
export function cheerWaitMs(lastCheerAt: Date | null, now: number): number {
  if (!lastCheerAt) return 0;
  return Math.max(0, lastCheerAt.getTime() + CHEER_COOLDOWN_MS - now);
}

/** "about 2 hours", "a few minutes" — for the cooldown message. */
export function describeWait(ms: number): string {
  const minutes = Math.ceil(ms / MINUTE_MS);
  if (minutes <= 5) return "a few minutes";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "about an hour" : `about ${hours} hours`;
}

/** The push a friend receives: who, which cheer, and their own day so far. */
export function cheerMessage(input: { fromId: string; name: string; kind: CheerKind; todayMs: number }) {
  return {
    title: `${CHEER_EMOJI[input.kind]} ${input.name} cheered you on`,
    body:
      input.todayMs >= MINUTE_MS
        ? `${formatCompact(input.todayMs)} focused today. Keep it going!`
        : "Nothing logged yet today. A good moment to start one.",
    url: "/friends",
    tag: `cheer-${input.fromId}`,
  };
}

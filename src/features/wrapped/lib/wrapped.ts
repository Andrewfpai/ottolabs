/**
 * Monthly Wrapped: what a month of studying adds up to, told as a story.
 * The data shape and the bits of wording derived from it, pure so they are
 * tested. Gathering the numbers is the server's job (`server/`).
 */
import type { AccessoryId, AnimalAvatarId } from "@/lib/avatars";
import { addDays, type DayKey } from "@/lib/time/calendar-day";

export type WrappedTrack = { title: string; color: string; ms: number };

export type WrappedData = {
  /** "2026-09". */
  month: string;
  /** "September". */
  monthName: string;
  year: number;
  person: { name: string; image: string | null; animal: AnimalAvatarId | null; accessories: AccessoryId[] };
  focusMs: number;
  /** Last month's focus, for the comparison; null when there was none. */
  previousFocusMs: number | null;
  activeDays: number;
  daysInMonth: number;
  tracks: WrappedTrack[];
  /** Focus by hour of day, 0–23. */
  hours: number[];
  bestDay: { label: string; ms: number } | null;
  longestStreak: number;
  sessions: number;
  pomodoros: number;
  longestSessionMs: number;
  tasksDone: number;
  reviewsDone: number;
  roomMs: number;
  topBuddy: { name: string; image: string | null } | null;
  milestones: { title: string; reward: AccessoryId }[];
};

const HOUR = 3_600_000;

/** "+18%", "−5%", or null when there is nothing to compare with. */
export function changeVsLastMonth(focusMs: number, previous: number | null): string | null {
  if (!previous || previous < HOUR / 2) return null;
  const pct = Math.round(((focusMs - previous) / previous) * 100);
  if (pct === 0) return "Same as last month";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% vs last month`;
}

/**
 * One of several, chosen by the month: the same Wrapped always reads the
 * same, but next month says it differently. `slot` keeps slides on the same
 * month from all landing on the same index.
 */
export function pick<T>(month: string, slot: string, options: readonly T[]): T {
  let hash = 2166136261;
  for (const ch of `${month}:${slot}`) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return options[Math.abs(hash) % options.length];
}

export function introLine(month: string): string {
  return pick(month, "intro", [
    "A month of showing up. Let's see what it added up to.",
    "Every session counted. Here's the whole picture.",
    "You put in the hours. Time to take a look.",
    "Grab a drink. This is your month in focus.",
    "Small sessions, big month. Let's rewind.",
  ]);
}

/**
 * The total, made tangible: films, matches, flights. Only comparisons that
 * come out to at least one are offered, so a light month never reads
 * "0 flights".
 */
export function totalLine(month: string, focusMs: number): string {
  const n = (hours: number) => Math.floor(focusMs / (hours * HOUR));
  const options = [
    { at: 2, text: (k: number) => `That's ${k} full movies back to back, except you were the one doing the work.` },
    { at: 1.5, text: (k: number) => `That's ${k} football matches, and you played every minute.` },
    { at: 7, text: (k: number) => `That's ${k} flights from Jakarta to Tokyo, spent learning instead of in the air.` },
    { at: 0.75, text: (k: number) => `That's ${k} episodes of a 45-minute show. You picked the better plot.` },
    { at: 24, text: (k: number) => `That's ${k} whole day${k === 1 ? "" : "s"}, if you'd done it all in one go.` },
    { at: 3, text: (k: number) => `That's ${k} long exams' worth of focus, minus the stress.` },
  ].filter((o) => n(o.at) >= 1);
  if (options.length === 0) return "Every minute of it is a start. Next month, more.";
  const chosen = pick(month, "total", options);
  return chosen.text(n(chosen.at));
}

export function topTrackLine(month: string, sharePct: number): string {
  return pick(month, "top-track", [
    `${sharePct}% of your whole month went here.`,
    `It took ${sharePct}% of your focus. Clear favourite.`,
    `${sharePct}% of every hour you studied. No contest.`,
    `Nearly ${sharePct}% of your month, all in one place.`,
  ]);
}

export function bestDayLine(month: string, time: string): string {
  return pick(month, "best-day", [
    `${time} in one day.`,
    `${time}. What a day.`,
    `${time} of pure focus, in a single day.`,
    `${time}. You were unstoppable.`,
  ]);
}

export function streakLine(month: string): string {
  return pick(month, "streak", [
    "in a row, 25 minutes or more each day.",
    "without missing one. 25 minutes or more, every day.",
    "back to back. Habits are built like this.",
  ]);
}

export function reviewsLine(month: string, reviews: number): string {
  return pick(month, "reviews", [
    `and ${reviews} reviews to make them stick.`,
    `plus ${reviews} reviews, so none of it fades.`,
    `and came back ${reviews} times to review. Smart.`,
  ]);
}

export function friendsLine(month: string): string {
  return pick(month, "friends", [
    "studied side by side in rooms.",
    "with friends right there, focusing too.",
    "in good company. Studying together counts double.",
    "shoulder to shoulder in your study rooms.",
  ]);
}

/** The hour you focused most, or null with no focus at all. */
export function peakHour(hours: readonly number[]): number | null {
  let best = -1;
  let at: number | null = null;
  hours.forEach((ms, hour) => {
    if (ms > best && ms > 0) {
      best = ms;
      at = hour;
    }
  });
  return at;
}

export type Persona = { title: string; line: string; emoji: string };

/**
 * A study persona from when and how you work: the time of day you peak, and
 * whether you study in long sittings or many short ones.
 */
export function persona(
  data: Pick<WrappedData, "month" | "hours" | "focusMs" | "sessions" | "activeDays" | "daysInMonth">,
): Persona {
  const peak = peakHour(data.hours);
  const avgSessionMin = data.sessions > 0 ? data.focusMs / data.sessions / 60_000 : 0;
  const steady = data.activeDays / Math.max(1, data.daysInMonth) >= 0.6;

  const when =
    peak === null
      ? { word: "Quiet", emoji: "🌱" }
      : peak >= 21 || peak < 4
        ? { word: "Night Owl", emoji: "🦉" }
        : peak < 10
          ? { word: "Early Bird", emoji: "🐦" }
          : peak < 17
            ? { word: "Daylight", emoji: "☀️" }
            : { word: "Golden Hour", emoji: "🌇" };

  const how = avgSessionMin >= 60 ? "Marathoner" : steady ? "Scholar" : "Sprinter";
  const lines: Record<string, string[]> = {
    Marathoner: [
      "You settle in and go deep. Long sittings are your thing.",
      "When you sit down, you stay down. Deep work suits you.",
      "Others take breaks. You take chapters.",
    ],
    Scholar: [
      "You showed up day after day. Consistency is your superpower.",
      "Steady, reliable, always there. That's how mastery happens.",
      "Not every day was big, but almost every day counted.",
    ],
    Sprinter: [
      "Short, sharp bursts. You make every session count.",
      "Quick in, quick out, and it all adds up.",
      "You don't need hours to make progress. Proven.",
    ],
  };
  return { title: `The ${when.word} ${how}`, line: pick(data.month, "persona", lines[how]), emoji: when.emoji };
}

/** "9 PM" style, for the rhythm slide. */
export function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "AM" : "PM"}`;
}

// ── Months ─────────────────────────────────────────────────────────────────

/** "2026-09". */
export function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** The month a day belongs to: "2026-09-14" → "2026-09". */
export function monthOf(day: DayKey): string {
  return day.slice(0, 7);
}

/** The month after or before, by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** The month's first day, the next month's first day, and how many days it has. */
export function monthBounds(month: string): { first: DayKey; next: DayKey; days: number } {
  const first = `${month}-01` as DayKey;
  const next = `${shiftMonth(month, 1)}-01` as DayKey;
  let days = 0;
  for (let d = first; d !== next; d = addDays(d, 1)) days += 1;
  return { first, next, days };
}

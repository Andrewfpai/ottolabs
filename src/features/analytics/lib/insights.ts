/**
 * Plain-language callouts. Charts make you do the reading; these say what the
 * charts mean. Each one only appears when the data is strong enough to back
 * it, so a quiet week produces fewer lines rather than confident nonsense.
 */
import {
  DAY_PARTS,
  dayPartTotals,
  type Kpis,
  type PeakWindow,
  type Streaks,
} from "@/features/analytics/lib/metrics";
import { formatCompact } from "@/lib/time/elapsed";

export type Insight = { id: string; text: string };

/** Below this many sessions every pattern is noise. */
export const MIN_SESSIONS_FOR_INSIGHTS = 5;

const WEEKDAY_PLURALS = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function buildInsights(input: {
  kpis: Kpis;
  profile: readonly number[];
  peak: PeakWindow | null;
  weekdayAverages: readonly number[];
  medianSessionMs: number | null;
  /** Titles and shares, largest first. */
  topTracks: readonly { title: string; share: number }[];
  streaks: Streaks;
}): Insight[] {
  const { kpis } = input;
  if (kpis.sessionCount < MIN_SESSIONS_FOR_INSIGHTS) return [];

  const insights: Insight[] = [];

  if (input.peak) {
    insights.push({
      id: "peak",
      text: `Your peak focus window is ${formatHour(input.peak.startHour)}–${formatHour(input.peak.endHour)}, with ${Math.round(input.peak.share * 100)}% of your focus.`,
    });
  }

  const parts = dayPartTotals(input.profile);
  const ranked = DAY_PARTS.map((p) => ({ label: p.label, ms: parts[p.key] })).sort(
    (a, b) => b.ms - a.ms,
  );
  const [top, second] = ranked;
  if (top.ms > 0 && second.ms === 0) {
    insights.push({ id: "day-part", text: `Practically all of your focus happens in the ${top.label}.` });
  } else if (top.ms > 0 && top.ms / second.ms >= 1.5) {
    insights.push({
      id: "day-part",
      text: `You focus ${(top.ms / second.ms).toFixed(1)}× more in the ${top.label} than in the ${second.label}.`,
    });
  }

  // A weekday pattern needs each weekday to have come round at least twice.
  if (kpis.days >= 14) {
    const best = input.weekdayAverages.reduce(
      (acc, ms, weekday) => (ms > acc.ms ? { weekday, ms } : acc),
      { weekday: -1, ms: 0 },
    );
    if (best.weekday >= 0) {
      insights.push({
        id: "weekday",
        text: `${WEEKDAY_PLURALS[best.weekday]} are your strongest day, averaging ${formatCompact(best.ms)}.`,
      });
    }
  }

  if (input.medianSessionMs) {
    insights.push({
      id: "session-length",
      text: `Your typical session runs ${formatCompact(input.medianSessionMs)}.`,
    });
  }

  insights.push({
    id: "consistency",
    text: `You focused on ${kpis.activeDays} of the last ${kpis.days} days.`,
  });

  if (input.topTracks.length >= 2) {
    const [lead] = input.topTracks;
    insights.push({
      id: "top-track",
      text: `${lead.title} took ${Math.round(lead.share * 100)}% of your focus.`,
    });
  }

  if (input.streaks.current >= 3) {
    insights.push({
      id: "streak",
      text:
        input.streaks.current >= input.streaks.longest
          ? `You are on a ${input.streaks.current}-day streak, your longest yet.`
          : `You are on a ${input.streaks.current}-day streak. Your record is ${input.streaks.longest}.`,
    });
  }

  return insights;
}

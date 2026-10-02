/**
 * Milestones and what they unlock. Pure, so every threshold is tested.
 *
 * Tuned for someone studying an hour or two most days: the first few land in
 * the first week or two, the middle ones take a term of steady work, and the
 * last ones are genuinely rare. Streaks and the time-of-day badges need a
 * real sitting (25 minutes, one Pomodoro), so a one-minute session cannot
 * farm them.
 */
import type { SplittableSession } from "@/features/analytics/lib/split";
import { splitSessions } from "@/features/analytics/lib/split";
import { totalsByDay } from "@/features/analytics/lib/metrics";
import type { AccessoryId } from "@/lib/avatars";
import { addDays, type DayKey, wallClock } from "@/lib/time/calendar-day";
import { elapsedMs, HOUR_MS, MINUTE_MS } from "@/lib/time/elapsed";

/** What counts as a real sitting, for streaks and the time-of-day badges. */
export const SITTING_MS = 25 * MINUTE_MS;

export type AchievementStats = {
  focusMs: number;
  longestStreakDays: number;
  longestSessionMs: number;
  pomodoroCycles: number;
  goalDays: number;
  tasksDone: number;
  reviewsDone: number;
  roomFocusMs: number;
  nightOwlSessions: number;
  earlyBirdSessions: number;
};

export type Milestone = {
  id: string;
  title: string;
  description: string;
  reward: AccessoryId;
  target: number;
  /** How progress reads: "37 / 50 h". */
  unit: string;
  measure: (stats: AchievementStats) => number;
};

const hours = (ms: number) => ms / HOUR_MS;

export const MILESTONES: Milestone[] = [
  {
    id: "hours-10",
    title: "Warm-up",
    description: "Focus for 10 hours in total.",
    reward: "headphones",
    target: 10,
    unit: "h",
    measure: (s) => hours(s.focusMs),
  },
  {
    id: "hours-50",
    title: "Bookworm",
    description: "Focus for 50 hours in total.",
    reward: "glasses",
    target: 50,
    unit: "h",
    measure: (s) => hours(s.focusMs),
  },
  {
    id: "hours-150",
    title: "Scholar",
    description: "Focus for 150 hours in total.",
    reward: "gradcap",
    target: 150,
    unit: "h",
    measure: (s) => hours(s.focusMs),
  },
  {
    id: "hours-400",
    title: "Grandmaster",
    description: "Focus for 400 hours in total.",
    reward: "crown",
    target: 400,
    unit: "h",
    measure: (s) => hours(s.focusMs),
  },
  {
    id: "streak-7",
    title: "On a roll",
    description: "Focus at least 25 minutes a day, 7 days in a row.",
    reward: "scarf",
    target: 7,
    unit: "days",
    measure: (s) => s.longestStreakDays,
  },
  {
    id: "streak-30",
    title: "Habit formed",
    description: "Keep a 25-minute-a-day streak for 30 days.",
    reward: "sunglasses",
    target: 30,
    unit: "days",
    measure: (s) => s.longestStreakDays,
  },
  {
    id: "streak-100",
    title: "Unstoppable",
    description: "Keep a 25-minute-a-day streak for 100 days.",
    reward: "halo",
    target: 100,
    unit: "days",
    measure: (s) => s.longestStreakDays,
  },
  {
    id: "deep-2h",
    title: "Deep diver",
    description: "Log one session with 2 hours of focus.",
    reward: "mug",
    target: 120,
    unit: "min",
    measure: (s) => s.longestSessionMs / MINUTE_MS,
  },
  {
    id: "pomodoro-100",
    title: "Tomato tamer",
    description: "Complete 100 Pomodoro focus intervals.",
    reward: "beanie",
    target: 100,
    unit: "cycles",
    measure: (s) => s.pomodoroCycles,
  },
  {
    id: "goal-20",
    title: "Goal getter",
    description: "Reach your daily goal on 20 different days.",
    reward: "medal",
    target: 20,
    unit: "days",
    measure: (s) => s.goalDays,
  },
  {
    id: "tasks-50",
    title: "Closer",
    description: "Finish 50 tasks.",
    reward: "bowtie",
    target: 50,
    unit: "tasks",
    measure: (s) => s.tasksDone,
  },
  {
    id: "reviews-15",
    title: "Memory keeper",
    description: "Complete 15 task reviews.",
    reward: "sparkles",
    target: 15,
    unit: "reviews",
    measure: (s) => s.reviewsDone,
  },
  {
    id: "rooms-10h",
    title: "Better together",
    description: "Focus for 10 hours inside study rooms.",
    reward: "flowers",
    target: 10,
    unit: "h",
    measure: (s) => hours(s.roomFocusMs),
  },
  {
    id: "night-owl",
    title: "Night owl",
    description: "Start 10 sessions of 25+ minutes between 22:00 and 04:00.",
    reward: "nightcap",
    target: 10,
    unit: "sessions",
    measure: (s) => s.nightOwlSessions,
  },
  {
    id: "early-bird",
    title: "Early bird",
    description: "Start 10 sessions of 25+ minutes between 05:00 and 08:00.",
    reward: "bird",
    target: 10,
    unit: "sessions",
    measure: (s) => s.earlyBirdSessions,
  },
];

export function milestoneById(id: string): Milestone | undefined {
  return MILESTONES.find((m) => m.id === id);
}

export type Progress = { value: number; target: number; ratio: number; done: boolean };

export function progressOf(milestone: Milestone, stats: AchievementStats): Progress {
  const value = milestone.measure(stats);
  return {
    value,
    target: milestone.target,
    ratio: Math.min(1, Math.max(0, value / milestone.target)),
    done: value >= milestone.target,
  };
}

/** "37 / 50 h", with whole numbers below the target. */
export function progressText(milestone: Milestone, progress: Progress): string {
  const shown = Math.min(Math.floor(progress.value), milestone.target);
  return `${shown} / ${milestone.target} ${milestone.unit}`;
}

/** The longest run of consecutive days with at least `minMs` of focus. */
export function longestStreak(byDay: ReadonlyMap<DayKey, number>, minMs: number): number {
  const days = [...byDay].filter(([, ms]) => ms >= minMs).map(([day]) => day).sort();
  let best = 0;
  let run = 0;
  let previous: DayKey | null = null;
  for (const day of days) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

export type StatSession = SplittableSession & {
  completedCycles: number;
  roomId: string | null;
};

/** Everything the milestones measure, from your finished sessions and tasks. */
export function measureStats(input: {
  sessions: readonly StatSession[];
  tasksDone: number;
  reviewsDone: number;
  settings: { timeZone: string; dayStartHour: number; dailyGoalMinutes: number };
  now: number;
}): AchievementStats {
  const { sessions, settings, now } = input;
  const byDay = totalsByDay(splitSessions(sessions, settings.timeZone, settings.dayStartHour, now));
  const goalMs = settings.dailyGoalMinutes * MINUTE_MS;

  let focusMs = 0;
  let longestSessionMs = 0;
  let pomodoroCycles = 0;
  let roomFocusMs = 0;
  let nightOwlSessions = 0;
  let earlyBirdSessions = 0;

  for (const session of sessions) {
    // elapsed.ts is the only place focus time is computed.
    const ms = elapsedMs(session, now);
    focusMs += ms;
    longestSessionMs = Math.max(longestSessionMs, ms);
    pomodoroCycles += session.completedCycles;
    if (session.roomId) roomFocusMs += ms;
    if (ms >= SITTING_MS) {
      const { hour } = wallClock(session.startedAt, settings.timeZone);
      if (hour >= 22 || hour < 4) nightOwlSessions += 1;
      if (hour >= 5 && hour < 8) earlyBirdSessions += 1;
    }
  }

  return {
    focusMs,
    longestStreakDays: longestStreak(byDay, SITTING_MS),
    longestSessionMs,
    pomodoroCycles,
    goalDays: goalMs > 0 ? [...byDay.values()].filter((ms) => ms >= goalMs).length : 0,
    tasksDone: input.tasksDone,
    reviewsDone: input.reviewsDone,
    roomFocusMs,
    nightOwlSessions,
    earlyBirdSessions,
  };
}

/** Milestones met by these stats. */
export function metMilestones(stats: AchievementStats): Milestone[] {
  return MILESTONES.filter((m) => progressOf(m, stats).done);
}

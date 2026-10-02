/**
 * Seeds ~90 days of realistic synthetic focus data.
 *
 * This exists in Phase 0, not Phase 4, on purpose. Building an analytics page
 * against three hand-made sessions produces charts that look fine and are
 * wrong: you cannot see a broken hour-of-day bucket, a streak that miscounts
 * across the day boundary, or a heatmap with the week misaligned until there is
 * enough data for the shape to be recognisable.
 *
 * The generator is deliberately lumpy — evenings heavier than mornings, gaps of
 * a few days, a couple of abandoned sessions — because uniformly random data
 * hides exactly the bugs this is meant to expose.
 *
 *   npm run db:seed            add seed data alongside anything already there
 *   npm run db:seed -- --reset delete this user's tracks/sessions/tasks first
 *
 * Requires that you have signed in at least once, so a user row exists.
 */
import { TZDate } from "@date-fns/tz";
import { eq } from "drizzle-orm";

import { refuseProductionUnlessForced } from "./guard";
import { db } from "./index";
import {
  DEFAULT_POMODORO,
  focusSessions,
  type NewFocusSession,
  type NewTask,
  tasks,
  tracks,
  userSettings,
  users,
} from "./schema";

const DAYS = 90;
const RESET = process.argv.includes("--reset");

// ── Deterministic PRNG ──────────────────────────────────────────────────────
// mulberry32. A fixed seed means re-running produces the same dataset, so a
// chart that looks wrong stays wrong long enough to debug.
function makeRng(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260821);

const pick = <T,>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const between = (min: number, max: number) => min + rng() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));
const chance = (p: number) => rng() < p;

/** Weighted pick over [value, weight] pairs. */
function weighted<T>(entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

// ── Shape of a believable study week ────────────────────────────────────────

const SEED_TRACKS = [
  { title: "Databases", color: "teal", icon: "database", weight: 30, targetMinutesPerWeek: 360 },
  { title: "Cybersecurity", color: "violet", icon: "shield", weight: 24, targetMinutesPerWeek: 300 },
  { title: "System Design", color: "amber", icon: "network", weight: 18, targetMinutesPerWeek: 240 },
  { title: "Algorithms", color: "sky", icon: "binary", weight: 16, targetMinutesPerWeek: null },
  { title: "Japanese", color: "rose", icon: "languages", weight: 12, targetMinutesPerWeek: 120 },
] as const;

/**
 * Hour-of-day weights. A pronounced evening peak with a smaller mid-morning
 * bump — if the analytics page cannot recover this shape from the data, its
 * bucketing is broken.
 */
const START_HOUR_WEIGHTS = [
  [6, 1], [7, 2], [8, 4], [9, 7], [10, 8], [11, 5],
  [12, 2], [13, 3], [14, 6], [15, 6], [16, 5], [17, 3],
  [18, 4], [19, 9], [20, 16], [21, 20], [22, 14], [23, 7],
  [0, 3], [1, 1],
] as const;

const NOTES = [
  "Worked through the indexing chapter. B-trees finally clicked.",
  "Query planner deep dive. Still fuzzy on when it picks a seq scan.",
  "Practice problems. Got stuck on the sliding window one for ages.",
  "Watched two lectures, took notes. Passive but useful.",
  "Set up the lab environment. Mostly yak shaving, little learning.",
  "Read the spec properly for once instead of skimming it.",
  "Reviewed old notes before moving on. Retention is better than I feared.",
  "Paired through a tutorial. Faster than going solo.",
  "Wrote a small implementation from scratch to check I understood it.",
  "Low energy session, reread yesterday's material.",
  "Finally finished the exercises I abandoned last week.",
  "Went down a rabbit hole on normalization. Worth it.",
];

const TASK_TITLES = [
  "Finish indexing exercises",
  "Write up notes on query planning",
  "Review transaction isolation levels",
  "Set up the pentest lab VM",
  "Read chapter 7",
  "Do the sliding-window problem set",
  "Build a toy key-value store",
  "Watch the sharding lecture",
  "Practice kanji for 20 minutes",
  "Summarise the CAP theorem in my own words",
  "Redo the failed exercises from last week",
  "Draft the study plan for next month",
  "Refactor the notes into flashcards",
  "Compare B-tree and LSM-tree tradeoffs",
  "Work through the auth chapter",
  "Set up spaced repetition deck",
  "Read the Raft paper",
  "Finish the networking module",
];

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  refuseProductionUnlessForced("db:seed");

  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const user = allowed.length
    ? await db.query.users.findFirst({ where: eq(users.email, allowed[0]) })
    : await db.query.users.findFirst();

  if (!user) {
    console.error(
      "\nNo user row found. Start the app, sign in with Google once, then run this again.\n" +
        "The seeder attaches data to an existing account rather than inventing one, so that\n" +
        "what you see after signing in is your own data.\n",
    );
    process.exit(1);
  }

  console.log(`Seeding for ${user.email}`);

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, user.id),
  });
  const timeZone = settings?.timezone ?? "UTC";
  console.log(`Timezone: ${timeZone}`);

  if (RESET) {
    // Order matters: focus_sessions references tracks with ON DELETE RESTRICT.
    await db.delete(focusSessions).where(eq(focusSessions.userId, user.id));
    await db.delete(tasks).where(eq(tasks.userId, user.id));
    await db.delete(tracks).where(eq(tracks.userId, user.id));
    console.log("Cleared existing tracks, sessions and tasks.");
  }

  const insertedTracks = await db
    .insert(tracks)
    .values(
      SEED_TRACKS.map((t, index) => ({
        userId: user.id,
        title: t.title,
        color: t.color,
        icon: t.icon,
        targetMinutesPerWeek: t.targetMinutesPerWeek,
        sortOrder: index,
        description: null,
      })),
    )
    .onConflictDoNothing()
    .returning();

  const trackRows = insertedTracks.length
    ? insertedTracks
    : await db.query.tracks.findMany({ where: eq(tracks.userId, user.id) });

  if (trackRows.length === 0) {
    console.error("No tracks available after insert. Aborting.");
    process.exit(1);
  }

  const trackWeights = trackRows.map(
    (row) =>
      [
        row,
        SEED_TRACKS.find((t) => t.title === row.title)?.weight ?? 10,
      ] as const,
  );

  console.log(`Tracks: ${trackRows.map((t) => t.title).join(", ")}`);

  // ── Sessions ──────────────────────────────────────────────────────────────
  const rows: NewFocusSession[] = [];
  const today = new TZDate(Date.now(), timeZone);

  for (let dayOffset = DAYS; dayOffset >= 0; dayOffset--) {
    const day = new TZDate(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - dayOffset,
      12,
      0,
      0,
      timeZone,
    );

    const weekday = day.getDay();
    const isWeekend = weekday === 0 || weekday === 6;

    // Deliberate dead patches: a holiday, a bad week, life happening.
    const inSlump = dayOffset > 34 && dayOffset < 41;
    const studyProbability = inSlump ? 0.12 : isWeekend ? 0.58 : 0.78;
    if (!chance(studyProbability)) continue;

    const sessionCount = weighted([
      [1, 50],
      [2, 34],
      [3, 13],
      [4, 3],
    ] as const);

    // Draw all of the day's start times up front and place them in order.
    //
    // An earlier version pushed a colliding session later instead of dropping
    // it. Late-evening collisions then cascaded past midnight and piled up on
    // hour 0, producing a spike roughly five times what the weights call for.
    // Fake data with a fake spike in it is worse than no fake data: it looks
    // exactly like an analytics bug. Skipping the collision instead leaves the
    // hour distribution exactly as weighted, just with slightly fewer rows.
    const startTimes = Array.from({ length: sessionCount }, () => {
      const hour = weighted(START_HOUR_WEIGHTS);
      return {
        hour,
        minute: intBetween(0, 59),
        // Hours 0-3 belong to the small hours of the *next* calendar day,
        // which is precisely the case the day-start boundary has to handle.
        dayShift: hour < 4 ? 1 : 0,
      };
    }).sort((a, b) => a.dayShift - b.dayShift || a.hour - b.hour || a.minute - b.minute);

    let lastEndMs = 0;

    for (const slot of startTimes) {
      const start = new TZDate(
        day.getFullYear(),
        day.getMonth(),
        day.getDate() + slot.dayShift,
        slot.hour,
        slot.minute,
        0,
        timeZone,
      );

      const startMs = start.getTime();
      if (startMs > Date.now()) continue;
      // The one-live-session index means real data can never contain two
      // overlapping sessions, so neither may the fake data.
      if (lastEndMs && startMs < lastEndMs + 10 * 60_000) continue;

      const focusMinutes = Math.round(
        weighted([
          [between(15, 30), 18],
          [between(30, 55), 38],
          [between(55, 85), 30],
          [between(85, 130), 14],
        ] as const),
      );

      const pausedMs = chance(0.42) ? Math.round(between(1, 14) * 60_000) : 0;
      const isPomodoro = chance(0.28);
      // A pomodoro break is recorded as a pause AND tallied in breakMs. The two
      // are not additive — breakMs is the labelled subset of pausedMs.
      const cycles = isPomodoro ? Math.max(1, Math.round(focusMinutes / 25)) : 0;
      const breakMs = isPomodoro
        ? Math.min(pausedMs, cycles * DEFAULT_POMODORO.breakMinutes * 60_000)
        : 0;

      const focusMs = focusMinutes * 60_000;
      const abandoned = chance(0.035);

      // An abandoned session is closed by the reaper at its last heartbeat, so
      // its end time is a round-ish minute before where it would otherwise be.
      const endMs = startMs + focusMs + pausedMs;

      rows.push({
        userId: user.id,
        trackId: weighted(trackWeights).id,
        startedAt: new Date(startMs),
        endedAt: new Date(endMs),
        pausedMs,
        breakMs,
        mode: isPomodoro ? "pomodoro" : "stopwatch",
        pomodoroConfig: isPomodoro ? DEFAULT_POMODORO : null,
        completedCycles: cycles,
        note: chance(0.4) ? pick(NOTES) : null,
        tags: [],
        lastHeartbeatAt: new Date(endMs),
        endReason: abandoned ? "auto_closed" : "manual",
      });

      lastEndMs = endMs;
    }
  }

  // Insert in chunks; a single 400-row insert is fine, but this keeps the
  // statement well under any parameter limit as the day count grows.
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(focusSessions).values(rows.slice(i, i + 100));
  }

  const totalMinutes = rows.reduce((sum, r) => {
    const ms = (r.endedAt as Date).getTime() - (r.startedAt as Date).getTime();
    return sum + (ms - (r.pausedMs ?? 0)) / 60_000;
  }, 0);

  console.log(
    `Sessions: ${rows.length} across ${DAYS} days ` +
      `(${(totalMinutes / 60).toFixed(1)}h of focus)`,
  );

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const taskRows: NewTask[] = [];

  for (let i = 0; i < 26; i++) {
    // Spread from three weeks ago to two weeks out, so both the overdue and
    // upcoming states are represented on the calendar.
    const dayShift = intBetween(-21, 14);
    const hasDue = chance(0.8);
    const isAllDay = hasDue && chance(0.45);

    const due = hasDue
      ? new TZDate(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + dayShift,
          isAllDay ? 0 : intBetween(9, 21),
          isAllDay ? 0 : pick([0, 15, 30, 45]),
          0,
          timeZone,
        )
      : null;

    const isPast = due != null && due.getTime() < Date.now();
    const status = isPast
      ? weighted([
          ["done", 62],
          ["todo", 22],
          ["cancelled", 8],
          ["in_progress", 8],
        ] as const)
      : weighted([
          ["todo", 68],
          ["in_progress", 22],
          ["done", 10],
        ] as const);

    taskRows.push({
      userId: user.id,
      trackId: chance(0.65) ? weighted(trackWeights).id : null,
      title: TASK_TITLES[i % TASK_TITLES.length],
      notes: chance(0.25) ? "Carried over from last week." : null,
      dueAt: due ? new Date(due.getTime()) : null,
      isAllDay,
      status,
      priority: weighted([
        ["p3", 52],
        ["p2", 33],
        ["p1", 15],
      ] as const),
      completedAt:
        status === "done" && due ? new Date(due.getTime() - intBetween(0, 40) * 60_000) : null,
      sortOrder: i,
    });
  }

  await db.insert(tasks).values(taskRows);
  console.log(`Tasks: ${taskRows.length}`);

  console.log("\nDone. Start the dev server and open /analytics.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

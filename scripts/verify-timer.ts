/**
 * End-to-end check of the timer state machine against the real database.
 *
 * Exercises the transitions in `features/sessions/server/timer-core.ts` plus
 * the reaper endpoint, then cleans up after itself. Run with the dev server
 * up so the reaper route is reachable:
 *
 *   npx tsx --env-file=.env.local scripts/verify-timer.mts
 */
import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "../src/db/index";
import { DEFAULT_POMODORO, focusSessions, tracks } from "../src/db/schema";
import {
  bankIdleTime,
  deleteLiveSession,
  finishLiveSession,
  insertLiveSession,
  pauseLiveSession,
  resumeLiveSession,
  startBreakOnSession,
} from "../src/features/sessions/server/timer-core";
import { elapsedMs, formatDuration } from "../src/lib/time/elapsed";
import { isUniqueViolation, violatedConstraint } from "../src/lib/action-result";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const user = await db.query.users.findFirst();
  if (!user) throw new Error("No user row. Sign in once first.");

  const live = await db.query.focusSessions.findFirst({
    where: and(eq(focusSessions.userId, user.id), isNull(focusSessions.endedAt)),
  });
  if (live) {
    console.error(
      "\nA timer is already running. Finish it before running this, or the " +
        "one-live-session index will (correctly) block the test.\n",
    );
    process.exit(1);
  }

  const [track] = await db
    .insert(tracks)
    .values({
      userId: user.id,
      title: `__verify__${Date.now()}`,
      color: "teal",
      icon: "book-open",
    })
    .returning();

  try {
    console.log("\nstart / one-live-session");
    const session = await insertLiveSession({
      userId: user.id,
      trackId: track.id,
      mode: "stopwatch",
      pomodoroConfig: null,
    });
    check("start creates a live session", session.endedAt === null);
    check("heartbeat is stamped on start", session.lastHeartbeatAt !== null);

    let blocked = false;
    let constraint: string | null = null;
    try {
      await insertLiveSession({
        userId: user.id,
        trackId: track.id,
        mode: "stopwatch",
        pomodoroConfig: null,
      });
    } catch (error) {
      blocked = isUniqueViolation(error);
      constraint = violatedConstraint(error);
    }
    check("a second concurrent timer is refused", blocked);
    check(
      "refused by the partial unique index, not something else",
      constraint === "focus_sessions_one_live_per_user",
      constraint ?? "no constraint reported",
    );

    console.log("\npause / resume");
    await sleep(1100);
    check("pause succeeds", await pauseLiveSession(user.id, session.id));
    check("pausing twice is refused", !(await pauseLiveSession(user.id, session.id)));

    const paused = await db.query.focusSessions.findFirst({
      where: eq(focusSessions.id, session.id),
    });
    const frozenA = elapsedMs(paused!);
    await sleep(1200);
    const frozenB = elapsedMs(paused!);
    check(
      "elapsed does not advance while paused",
      frozenA === frozenB,
      `${formatDuration(frozenA)} both times`,
    );

    check("resume succeeds", await resumeLiveSession(user.id, session.id));
    check("resuming twice is refused", !(await resumeLiveSession(user.id, session.id)));

    const resumed = await db.query.focusSessions.findFirst({
      where: eq(focusSessions.id, session.id),
    });
    check(
      "the pause was banked into pausedMs",
      resumed!.pausedMs >= 1000 && resumed!.pausedMs < 4000,
      `${resumed!.pausedMs}ms banked for a ~1.2s pause`,
    );
    check("pausedAt cleared on resume", resumed!.pausedAt === null);

    console.log("\nfinish");
    await sleep(600);
    await pauseLiveSession(user.id, session.id);
    await sleep(800);
    const finished = await finishLiveSession(user.id, session.id, "verify run");

    check("finish returns the row", finished !== null);
    check("endedAt is set", finished!.endedAt !== null);
    check("the note is saved", finished!.note === "verify run");
    check(
      "finishing while paused banks that pause too",
      finished!.pausedMs >= 1800,
      `${finished!.pausedMs}ms total paused`,
    );
    check("pausedAt cleared on finish", finished!.pausedAt === null);

    const focus = elapsedMs(finished!);
    const span = finished!.endedAt!.getTime() - finished!.startedAt.getTime();
    check(
      "focus time excludes all paused time",
      Math.abs(span - finished!.pausedMs - focus) < 5,
      `span ${span}ms − paused ${finished!.pausedMs}ms = focus ${focus}ms`,
    );
    // Not pinned to the deliberate sleeps: each round trip to Neon happens
    // while the timer is running and legitimately counts as focus, so the wall
    // clock always exceeds the sleeps by the network latency. What must hold is
    // that focus covers the running sleeps and stays strictly inside the span.
    check(
      "focus covers the running time and is strictly less than the span",
      focus >= 1600 && focus < span,
      `${formatDuration(focus)} of a ${formatDuration(span)} span`,
    );

    check(
      "finishing an already-finished session is refused",
      (await finishLiveSession(user.id, session.id, null)) === null,
    );

    console.log("\npomodoro breaks");
    const stopwatch = await insertLiveSession({
      userId: user.id,
      trackId: track.id,
      mode: "stopwatch",
      pomodoroConfig: null,
    });
    check(
      "a break is refused on a stopwatch session",
      !(await startBreakOnSession(user.id, stopwatch.id)),
    );
    await deleteLiveSession(user.id, stopwatch.id);

    const pom = await insertLiveSession({
      userId: user.id,
      trackId: track.id,
      mode: "pomodoro",
      pomodoroConfig: DEFAULT_POMODORO,
    });
    check("a pomodoro session stores its config", pom.pomodoroConfig !== null);

    await sleep(1100);
    check("starting a break succeeds", await startBreakOnSession(user.id, pom.id));
    check(
      "a second break is refused while one is open",
      !(await startBreakOnSession(user.id, pom.id)),
    );

    const onBreak = await db.query.focusSessions.findFirst({
      where: eq(focusSessions.id, pom.id),
    });
    check("the work interval is counted", onBreak!.completedCycles === 1);
    check("a break is stored as a pause", onBreak!.pausedAt !== null);
    check("and flagged as a break", onBreak!.breakStartedAt !== null);

    const beforeBreak = elapsedMs(onBreak!);
    await sleep(1200);
    check(
      "focus time does not accrue during a break",
      elapsedMs(onBreak!) === beforeBreak,
      `${formatDuration(beforeBreak)} both times`,
    );

    check("resuming ends the break", await resumeLiveSession(user.id, pom.id));

    const afterBreak = await db.query.focusSessions.findFirst({
      where: eq(focusSessions.id, pom.id),
    });
    check("the break flag is cleared", afterBreak!.breakStartedAt === null);
    check(
      "the break was tallied",
      afterBreak!.breakMs >= 1000 && afterBreak!.breakMs < 4000,
      `${afterBreak!.breakMs}ms for a ~1.2s break`,
    );
    // The invariant from AGENTS.md, asserted against the real database rather
    // than trusted: breakMs is a *subset* of pausedMs. If a break were ever
    // banked into only one of the two, focus time would be double-counted or
    // double-deducted, and nothing in the UI would look wrong.
    check(
      "breakMs is a subset of pausedMs, not a second deduction",
      afterBreak!.breakMs <= afterBreak!.pausedMs,
      `break ${afterBreak!.breakMs}ms of ${afterBreak!.pausedMs}ms paused`,
    );

    await sleep(600);
    await startBreakOnSession(user.id, pom.id);
    await sleep(700);
    const finishedOnBreak = await finishLiveSession(user.id, pom.id, null);

    check(
      "finishing mid-break clears the flag",
      finishedOnBreak!.breakStartedAt === null,
    );
    check(
      "finishing mid-break banks the open break",
      finishedOnBreak!.breakMs > afterBreak!.breakMs,
      `${afterBreak!.breakMs}ms -> ${finishedOnBreak!.breakMs}ms`,
    );
    check(
      "and banks it into pausedMs by the same amount",
      finishedOnBreak!.breakMs - afterBreak!.breakMs ===
        finishedOnBreak!.pausedMs - afterBreak!.pausedMs,
    );
    check("two intervals were completed", finishedOnBreak!.completedCycles === 2);

    const pomSpan =
      finishedOnBreak!.endedAt!.getTime() - finishedOnBreak!.startedAt.getTime();
    check(
      "focus excludes break time exactly once",
      Math.abs(pomSpan - finishedOnBreak!.pausedMs - elapsedMs(finishedOnBreak!)) < 5,
      `span ${pomSpan}ms minus paused ${finishedOnBreak!.pausedMs}ms`,
    );

    // A tab buried through several intervals must not queue up several
    // breaks. The break that follows settles the whole backlog at once.
    const backlog = await insertLiveSession({
      userId: user.id,
      trackId: track.id,
      mode: "pomodoro",
      pomodoroConfig: DEFAULT_POMODORO,
    });
    await db
      .update(focusSessions)
      .set({ startedAt: sql`now() - interval '65 minutes'` })
      .where(eq(focusSessions.id, backlog.id));

    await startBreakOnSession(user.id, backlog.id);
    const settled = await db.query.focusSessions.findFirst({
      where: eq(focusSessions.id, backlog.id),
    });
    check(
      "65 unbroken minutes credit two intervals, not one",
      settled!.completedCycles === 2,
      `${settled!.completedCycles} cycles`,
    );
    check(
      "so the next interval is not already over",
      elapsedMs(settled!) - settled!.completedCycles * 25 * 60_000 < 25 * 60_000,
    );
    await db.delete(focusSessions).where(eq(focusSessions.id, backlog.id));

    console.log("\nidle trim");
    const idle = await insertLiveSession({
      userId: user.id,
      trackId: track.id,
      mode: "stopwatch",
      pomodoroConfig: null,
    });
    await db
      .update(focusSessions)
      .set({ startedAt: sql`now() - interval '30 minutes'` })
      .where(eq(focusSessions.id, idle.id));

    check(
      "trimming a stretch you were away for succeeds",
      await bankIdleTime(user.id, idle.id, 20 * 60_000),
    );

    const trimmed = await db.query.focusSessions.findFirst({
      where: eq(focusSessions.id, idle.id),
    });
    check(
      "the away time is banked as paused time",
      trimmed!.pausedMs === 20 * 60_000,
      `${Math.round(trimmed!.pausedMs / 60_000)}m banked`,
    );
    check(
      "so a 30m session with 20m away logs ~10m of focus",
      elapsedMs(trimmed!) > 9.5 * 60_000 && elapsedMs(trimmed!) < 10.5 * 60_000,
      formatDuration(elapsedMs(trimmed!)),
    );

    // The browser reports how long it was hidden, and a machine that slept can
    // get that badly wrong, so the number is clamped server-side. Worst case
    // you lose focus time you did not earn; it can never be inflated.
    await bankIdleTime(user.id, idle.id, 99 * 3_600_000);
    const clamped = await db.query.focusSessions.findFirst({
      where: eq(focusSessions.id, idle.id),
    });
    check(
      "an absurd away time is clamped to the session's own span",
      clamped!.pausedMs <= Date.now() - clamped!.startedAt.getTime(),
      `${Math.round(clamped!.pausedMs / 60_000)}m paused of a ~30m span`,
    );
    check("and cannot drive focus time negative", elapsedMs(clamped!) === 0);

    await pauseLiveSession(user.id, idle.id);
    check(
      "trimming is refused while paused, which would deduct the same time twice",
      !(await bankIdleTime(user.id, idle.id, 60_000)),
    );
    await deleteLiveSession(user.id, idle.id);

    console.log("\nreaper");
    const stale = await insertLiveSession({
      userId: user.id,
      trackId: track.id,
      mode: "stopwatch",
      pomodoroConfig: null,
    });
    // Backdate: started 3h ago, last seen 2h ago. This is the closed-laptop case.
    await db
      .update(focusSessions)
      .set({
        startedAt: sql`now() - interval '3 hours'`,
        lastHeartbeatAt: sql`now() - interval '2 hours'`,
      })
      .where(eq(focusSessions.id, stale.id));

    const res = await fetch("http://localhost:3000/api/cron/reap-sessions", {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    check("reaper endpoint authorises with CRON_SECRET", res.ok, `HTTP ${res.status}`);

    const unauth = await fetch("http://localhost:3000/api/cron/reap-sessions");
    check("reaper rejects an unauthenticated call", unauth.status === 401);

    const reaped = await db.query.focusSessions.findFirst({
      where: eq(focusSessions.id, stale.id),
    });
    check("the abandoned session was closed", reaped!.endedAt !== null);
    check("closed with end_reason auto_closed", reaped!.endReason === "auto_closed");
    check(
      "closed AT the last heartbeat, not at now()",
      reaped!.endedAt !== null &&
        Math.abs(reaped!.endedAt.getTime() - reaped!.lastHeartbeatAt!.getTime()) < 1000,
    );

    const reapedFocus = elapsedMs(reaped!);
    check(
      "so it logs ~1h, not the ~3h it was nominally open",
      reapedFocus > 55 * 60_000 && reapedFocus < 65 * 60_000,
      formatDuration(reapedFocus),
    );

    const staleBreak = await insertLiveSession({
      userId: user.id,
      trackId: track.id,
      mode: "pomodoro",
      pomodoroConfig: DEFAULT_POMODORO,
    });
    // Walked away mid-break: started 3h ago, went on break 2h30 ago, last seen
    // 2h ago. The break was real and has to survive as break time.
    await db
      .update(focusSessions)
      .set({
        startedAt: sql`now() - interval '3 hours'`,
        pausedAt: sql`now() - interval '2 hours 30 minutes'`,
        breakStartedAt: sql`now() - interval '2 hours 30 minutes'`,
        lastHeartbeatAt: sql`now() - interval '2 hours'`,
      })
      .where(eq(focusSessions.id, staleBreak.id));

    await fetch("http://localhost:3000/api/cron/reap-sessions", {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });

    const reapedBreak = await db.query.focusSessions.findFirst({
      where: eq(focusSessions.id, staleBreak.id),
    });
    check(
      "a session abandoned mid-break is closed too",
      reapedBreak!.endedAt !== null && reapedBreak!.breakStartedAt === null,
    );
    check(
      "the open break is banked to the heartbeat, not to now()",
      Math.abs(reapedBreak!.breakMs - 30 * 60_000) < 1000,
      `${Math.round(reapedBreak!.breakMs / 60_000)}m of break`,
    );
    check(
      "and stays a subset of pausedMs",
      reapedBreak!.breakMs <= reapedBreak!.pausedMs,
    );
    check(
      "so it logs the 30m worked, not the 3h it was open",
      Math.abs(elapsedMs(reapedBreak!) - 30 * 60_000) < 2000,
      formatDuration(elapsedMs(reapedBreak!)),
    );

    console.log("\nquery result types");
    // Guards a whole class of bug: `sql<Date>` is only a compile-time cast, so
    // an aggregate over a timestamp arrives as a string and every `.getTime()`
    // downstream throws. These assert what the driver actually hands back,
    // which TypeScript cannot check.
    await db.insert(focusSessions).values({
      userId: user.id,
      trackId: track.id,
      startedAt: sql`now() - interval '2 hours'`,
      endedAt: sql`now() - interval '1 hour'`,
      endReason: "manual",
    });

    const [stats] = await db
      .select({
        totalMs: sql`coalesce(sum(
          extract(epoch from (${focusSessions.endedAt} - ${focusSessions.startedAt})) * 1000
          - ${focusSessions.pausedMs}
        ), 0)`,
        sessionCount: sql<number>`count(${focusSessions.id})::int`,
        lastActiveAt: sql`max(${focusSessions.startedAt})`.mapWith(
          focusSessions.startedAt,
        ),
      })
      .from(focusSessions)
      .where(eq(focusSessions.trackId, track.id));

    check(
      "aggregate timestamp comes back as a real Date",
      stats.lastActiveAt instanceof Date,
      `got ${typeof stats.lastActiveAt}`,
    );
    check(
      "count(*)::int comes back as a number",
      typeof stats.sessionCount === "number",
      `got ${typeof stats.sessionCount}`,
    );
    check(
      "sum()/extract() comes back as a string, so callers must wrap in Number()",
      typeof stats.totalMs === "string",
      `got ${typeof stats.totalMs}`,
    );
    // The single most valuable assertion in this file. Focus time is computed
    // twice — once in SQL for aggregates, once in `lib/time/elapsed.ts` for
    // everything else — and if those two ever drift apart the app quietly
    // disagrees with itself: a track's total would not equal the sum of the
    // sessions listed under it, with nothing to indicate which is wrong.
    const onTrack = await db.query.focusSessions.findMany({
      where: eq(focusSessions.trackId, track.id),
    });
    const viaTypeScript = onTrack.reduce((sum, s) => sum + elapsedMs(s), 0);
    const viaSql = Number(stats.totalMs);

    check(
      "the SQL aggregate agrees with lib/time/elapsed.ts",
      Math.abs(viaSql - viaTypeScript) < 5,
      `SQL ${Math.round(viaSql / 60000)}m vs TS ${Math.round(viaTypeScript / 60000)}m across ${onTrack.length} sessions`,
    );

    console.log("\ndiscard");
    const throwaway = await insertLiveSession({
      userId: user.id,
      trackId: track.id,
      mode: "stopwatch",
      pomodoroConfig: null,
    });
    check("discard removes the row", await deleteLiveSession(user.id, throwaway.id));
    check(
      "nothing is left running afterwards",
      (await db.query.focusSessions.findFirst({
        where: and(eq(focusSessions.userId, user.id), isNull(focusSessions.endedAt)),
      })) === undefined,
    );
  } finally {
    await db.delete(focusSessions).where(eq(focusSessions.trackId, track.id));
    await db.delete(tracks).where(eq(tracks.id, track.id));
    console.log("\nCleaned up the temporary track and its sessions.");
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

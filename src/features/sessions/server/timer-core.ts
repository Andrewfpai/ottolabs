/**
 * The timer state machine, separated from authorisation.
 *
 * These take a `userId` rather than deriving it, so they can be exercised
 * directly by tests. `actions.ts` is the only production caller and does the
 * `requireUser()` check first — nothing here authorises anything, and nothing
 * here may be exported from a `"use server"` module, or every function would
 * become a public endpoint.
 *
 * Every transition is one conditional UPDATE. Read-modify-write in JavaScript
 * would leave a window in which a second tab performs the same transition and
 * one of the two writes is silently lost: a pause that never registered, or
 * paused time banked twice. Putting the precondition in the WHERE clause makes
 * the database the arbiter, and a row count of zero is an unambiguous "that
 * transition was not legal".
 */
import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { type FocusSession, focusSessions } from "@/db/schema";
import type { PomodoroConfig } from "@/db/schema";

/** Milliseconds since `paused_at`, for banking an open pause. */
const OPEN_PAUSE_MS = sql`(extract(epoch from (now() - ${focusSessions.pausedAt})) * 1000)::int`;

export async function insertLiveSession(params: {
  userId: string;
  trackId: string;
  mode: "stopwatch" | "pomodoro";
  pomodoroConfig: PomodoroConfig | null;
}): Promise<FocusSession> {
  const [created] = await db
    .insert(focusSessions)
    .values({
      userId: params.userId,
      trackId: params.trackId,
      startedAt: sql`now()`,
      lastHeartbeatAt: sql`now()`,
      mode: params.mode,
      pomodoroConfig: params.pomodoroConfig,
    })
    .returning();

  return created;
}

/** Returns false when the session was not running, or was already paused. */
export async function pauseLiveSession(
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .update(focusSessions)
    .set({ pausedAt: sql`now()` })
    .where(
      and(
        eq(focusSessions.id, id),
        eq(focusSessions.userId, userId),
        isNull(focusSessions.endedAt),
        isNull(focusSessions.pausedAt),
      ),
    )
    .returning({ id: focusSessions.id });

  return rows.length > 0;
}

/**
 * Begin a pomodoro break.
 *
 * A break *is* a pause — that is what keeps it out of focus time — plus a flag
 * saying which kind of pause it is, so that when it is closed the same stretch
 * can also be tallied into `breakMs`. The work interval is counted as complete
 * here rather than when the break ends, so walking away during a break still
 * leaves the correct number of finished intervals behind.
 *
 * WHY THE CYCLE COUNT IS NOT SIMPLY `+ 1`. Breaks are only ever started while
 * the tab is in front, so an interval that elapsed behind a buried tab runs
 * long — sometimes by several intervals' worth. Since the time left in an
 * interval is derived as `(cycles + 1) × workMinutes − focusSoFar`, adding one
 * after 90 minutes of unbroken focus would leave the next interval already
 * over, and the one after that, marching the user through consecutive breaks
 * with no work between them. Taking the count the focus time actually
 * justifies settles the backlog in a single break.
 *
 * Returns false when the session was not running, or was already paused.
 */
export async function startBreakOnSession(
  userId: string,
  id: string,
): Promise<boolean> {
  const focusSoFarMs = sql`(extract(epoch from (now() - ${focusSessions.startedAt})) * 1000 - ${focusSessions.pausedMs})`;
  // `greatest(…, 1)` guards the division: a hand-edited config could store a
  // zero-minute interval, and no cycle length makes that a real division.
  const workIntervalMs = sql`(greatest(coalesce((${focusSessions.pomodoroConfig}->>'workMinutes')::numeric, 25), 1) * 60000)`;

  const rows = await db
    .update(focusSessions)
    .set({
      pausedAt: sql`now()`,
      breakStartedAt: sql`now()`,
      completedCycles: sql`greatest(
        ${focusSessions.completedCycles} + 1,
        floor(${focusSoFarMs} / ${workIntervalMs})::int
      )`,
    })
    .where(
      and(
        eq(focusSessions.id, id),
        eq(focusSessions.userId, userId),
        isNull(focusSessions.endedAt),
        isNull(focusSessions.pausedAt),
        eq(focusSessions.mode, "pomodoro"),
      ),
    )
    .returning({ id: focusSessions.id });

  return rows.length > 0;
}

/**
 * Returns false when the session was not paused.
 *
 * Also ends a break, if the open pause was one: the same stretch of time is
 * banked into `pausedMs` and into `breakMs`. `breakMs` is a *subset* of
 * `pausedMs`, never a second deduction — see `lib/time/elapsed.ts`. Keeping
 * both in one statement is what stops the two from ever drifting apart, and
 * means "skip the break" and "the break finished" need no separate transition.
 */
export async function resumeLiveSession(
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .update(focusSessions)
    .set({
      pausedMs: sql`${focusSessions.pausedMs} + ${OPEN_PAUSE_MS}`,
      breakMs: sql`${focusSessions.breakMs} + case when ${focusSessions.breakStartedAt} is not null then ${OPEN_PAUSE_MS} else 0 end`,
      pausedAt: null,
      breakStartedAt: null,
      lastHeartbeatAt: sql`now()`,
    })
    .where(
      and(
        eq(focusSessions.id, id),
        eq(focusSessions.userId, userId),
        isNull(focusSessions.endedAt),
        sql`${focusSessions.pausedAt} is not null`,
      ),
    )
    .returning({ id: focusSessions.id });

  return rows.length > 0;
}

/** Returns null when there was nothing running to finish. */
export async function finishLiveSession(
  userId: string,
  id: string,
  note: string | null,
): Promise<FocusSession | null> {
  const [finished] = await db
    .update(focusSessions)
    .set({
      endedAt: sql`now()`,
      // Finishing while paused must bank the open pause too, or that stretch
      // would silently be counted as focus. Finishing mid-break banks it in
      // both places, for the same reason resuming does.
      pausedMs: sql`${focusSessions.pausedMs} + case when ${focusSessions.pausedAt} is not null then ${OPEN_PAUSE_MS} else 0 end`,
      breakMs: sql`${focusSessions.breakMs} + case when ${focusSessions.breakStartedAt} is not null then ${OPEN_PAUSE_MS} else 0 end`,
      pausedAt: null,
      breakStartedAt: null,
      endReason: "manual",
      note,
      lastHeartbeatAt: sql`now()`,
    })
    .where(
      and(
        eq(focusSessions.id, id),
        eq(focusSessions.userId, userId),
        isNull(focusSessions.endedAt),
      ),
    )
    .returning();

  return finished ?? null;
}

/**
 * Retroactively bank a stretch of time you were away for as paused time.
 *
 * The idle-return prompt offers this when the tab was hidden for a long while:
 * the timer kept running, but you were not there. Banking the away time as a
 * pause trims it out of focus time while leaving the session running, so you
 * can carry on from where you actually are.
 *
 * The amount is clamped in SQL against the session's own span rather than
 * trusted from the client — the browser reports how long it was hidden, and a
 * suspended machine's idea of that can be wildly wrong. Worst case you lose
 * focus time you did not earn; there is no way to inflate it.
 *
 * Refused while paused: that time is already excluded, and adding it again
 * would deduct the same stretch twice.
 */
export async function bankIdleTime(
  userId: string,
  id: string,
  awayMs: number,
): Promise<boolean> {
  const spanSoFarMs = sql`(extract(epoch from (now() - ${focusSessions.startedAt})) * 1000)::int`;

  const rows = await db
    .update(focusSessions)
    .set({
      pausedMs: sql`${focusSessions.pausedMs} + least(
        ${awayMs}::int,
        greatest(0, ${spanSoFarMs} - ${focusSessions.pausedMs})
      )`,
    })
    .where(
      and(
        eq(focusSessions.id, id),
        eq(focusSessions.userId, userId),
        isNull(focusSessions.endedAt),
        isNull(focusSessions.pausedAt),
      ),
    )
    .returning({ id: focusSessions.id });

  return rows.length > 0;
}

export async function deleteLiveSession(
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(focusSessions)
    .where(
      and(
        eq(focusSessions.id, id),
        eq(focusSessions.userId, userId),
        isNull(focusSessions.endedAt),
      ),
    )
    .returning({ id: focusSessions.id });

  return rows.length > 0;
}

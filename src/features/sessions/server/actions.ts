"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { db } from "@/db";
import { DEFAULT_POMODORO, focusSessions, tasks, tracks } from "@/db/schema";
import {
  finishSessionSchema,
  manualSessionSchema,
  sessionIdSchema,
  startSessionSchema,
  trimIdleSchema,
  updateSessionSchema,
} from "@/features/sessions/schema";
import {
  findOverlappingSessions,
  getActiveSession,
  type SessionWithTrack,
} from "@/features/sessions/server/queries";
import {
  bankIdleTime,
  deleteLiveSession,
  finishLiveSession,
  insertLiveSession,
  pauseLiveSession,
  resumeLiveSession,
  startBreakOnSession,
} from "@/features/sessions/server/timer-core";
import {
  type ActionResult,
  fail,
  isUniqueViolation,
  ok,
  violatedConstraint,
} from "@/lib/action-result";
import { notifyRoomStart } from "@/features/reminders/server/push";
import { joinedRoom } from "@/features/rooms/server/check";
import { requireUser } from "@/lib/auth-guard";
import { firstReview } from "@/features/tasks/lib/reviews";
import { dayKey } from "@/lib/time/calendar-day";
import { elapsedMs } from "@/lib/time/elapsed";
import { requireSettings } from "@/lib/auth-guard";

/**
 * Authorisation and validation only. The state transitions themselves live in
 * `timer-core.ts`, which knows nothing about who is asking — that is what makes
 * them testable without a request context.
 */

function revalidateSessionViews() {
  revalidatePath("/sessions");
  revalidatePath("/tracks");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  // The calendar's focus overlay reads sessions too.
  revalidatePath("/calendar");
}

export async function startSession(
  input: unknown,
): Promise<ActionResult<SessionWithTrack>> {
  const user = await requireUser();

  const parsed = startSessionSchema.safeParse(input);
  if (!parsed.success) return fail("Pick a track to focus on.");

  const track = await db.query.tracks.findFirst({
    where: and(eq(tracks.id, parsed.data.trackId), eq(tracks.userId, user.id)),
  });

  if (!track) return fail("That track no longer exists.", "NOT_FOUND");
  if (track.status === "archived") {
    return fail("That track is archived. Restore it first.", "ARCHIVED");
  }

  // The room id comes from the client: only a room the caller has joined may
  // be credited with their time.
  const roomId = parsed.data.roomId ?? null;
  if (roomId && !(await joinedRoom(roomId, user.id))) {
    return fail("You are not in that room any more.", "NOT_FOUND");
  }

  // The task id comes from the client too: it must be the caller's, filed
  // under this track, and still open.
  let task: { id: string; title: string; status: string } | null = null;
  if (parsed.data.taskId) {
    task =
      (await db.query.tasks.findFirst({
        where: and(
          eq(tasks.id, parsed.data.taskId),
          eq(tasks.userId, user.id),
          eq(tasks.trackId, track.id),
        ),
        columns: { id: true, title: true, status: true },
      })) ?? null;
    if (!task) return fail("That task is no longer under this track.", "NOT_FOUND");
    if (task.status === "done" || task.status === "cancelled") {
      return fail("That task is closed. Reopen it first.", "CLOSED");
    }
  }

  const settings = await requireSettings();

  try {
    const created = await insertLiveSession({
      userId: user.id,
      trackId: track.id,
      taskId: task?.id ?? null,
      roomId,
      mode: parsed.data.mode,
      pomodoroConfig:
        parsed.data.mode === "pomodoro"
          ? (settings.defaultPomodoro ?? DEFAULT_POMODORO)
          : null,
    });

    // Starting work on a to-do means it is in progress now.
    if (task?.status === "todo") {
      await db
        .update(tasks)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(and(eq(tasks.id, task.id), eq(tasks.status, "todo")));
      revalidatePath("/tasks");
    }

    revalidatePath("/tracks");
    if (roomId) {
      revalidatePath(`/rooms/${roomId}`);
      // Room alerts go out after the response, so they never slow Start down.
      after(() => notifyRoomStart(roomId, user.id));
    }
    return ok({
      ...created,
      track: {
        id: track.id,
        title: track.title,
        color: track.color,
        icon: track.icon,
      },
      task: task ? { id: task.id, title: task.title } : null,
    });
  } catch (error) {
    // The partial unique index makes a second concurrent timer impossible.
    // Rather than surfacing a raw constraint error, hand back the session that
    // is already running so the UI can offer to switch to it.
    if (
      isUniqueViolation(error) &&
      violatedConstraint(error) === "focus_sessions_one_live_per_user"
    ) {
      const running = await getActiveSession();
      return fail(
        running
          ? `A timer is already running on ${running.track.title}.`
          : "A timer is already running.",
        "ALREADY_RUNNING",
      );
    }
    throw error;
  }
}

export async function pauseSession(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown session.");

  const paused = await pauseLiveSession(user.id, parsed.data.id);

  if (!paused) {
    return fail("That timer is not running, or is already paused.", "NOT_RUNNING");
  }

  return ok(undefined);
}

export async function resumeSession(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown session.");

  const resumed = await resumeLiveSession(user.id, parsed.data.id);

  if (!resumed) {
    return fail("That timer is not paused.", "NOT_PAUSED");
  }

  return ok(undefined);
}

/**
 * Take the pomodoro break after a work interval.
 *
 * Driven by the client, which is the only place that knows the interval has
 * elapsed, but recorded server-side so a refresh mid-break resolves correctly.
 */
export async function startBreak(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown session.");

  const started = await startBreakOnSession(user.id, parsed.data.id);

  if (!started) {
    return fail("That timer is not running a pomodoro.", "NOT_RUNNING");
  }

  return ok(undefined);
}

/**
 * Trim time you were away for out of a still-running session.
 *
 * Offered when the tab comes back after a long absence. The alternative to
 * this is a log full of sessions that quietly include lunch.
 */
export async function trimIdleTime(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = trimIdleSchema.safeParse(input);
  if (!parsed.success) return fail("Could not work out how long you were away.");

  const trimmed = await bankIdleTime(user.id, parsed.data.id, parsed.data.awayMs);

  if (!trimmed) {
    return fail("That timer is not running, or is paused already.", "NOT_RUNNING");
  }

  return ok(undefined);
}

export async function finishSession(
  input: unknown,
): Promise<ActionResult<{ id: string; elapsedMs: number }>> {
  const user = await requireUser();

  const parsed = finishSessionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Could not finish that session.");
  }

  const finished = await finishLiveSession(
    user.id,
    parsed.data.id,
    parsed.data.note,
    parsed.data.tags,
  );

  if (!finished) {
    return fail("That timer has already been stopped.", "NOT_RUNNING");
  }

  if (parsed.data.completeTask && finished.taskId) {
    const timeZone = parsed.data.reviewTask ? (await requireSettings()).timezone : null;
    await db
      .update(tasks)
      .set({
        status: "done",
        completedAt: sql`coalesce(${tasks.completedAt}, now())`,
        ...(timeZone ? firstReview(dayKey(Date.now(), timeZone), timeZone) : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, finished.taskId), eq(tasks.userId, user.id)));
    revalidatePath("/tasks");
  }

  revalidateSessionViews();

  // elapsed.ts is the only place focus time is computed.
  return ok({ id: finished.id, elapsedMs: elapsedMs(finished) });
}

/**
 * Throw a running session away entirely.
 *
 * Deleted rather than kept with an end reason: a session you discarded is one
 * that did not happen, and keeping a zero-value row would mean every count and
 * average downstream had to remember to filter it out.
 */
export async function discardSession(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown session.");

  const discarded = await deleteLiveSession(user.id, parsed.data.id);

  if (!discarded) return fail("That timer is not running.", "NOT_RUNNING");

  return ok(undefined);
}

/** Log time that was focused but never timed. */
export async function createManualSession(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  const parsed = manualSessionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check those times.");
  }

  const track = await db.query.tracks.findFirst({
    where: and(eq(tracks.id, parsed.data.trackId), eq(tracks.userId, user.id)),
  });
  if (!track) return fail("That track no longer exists.", "NOT_FOUND");

  const clashes = await findOverlappingSessions(
    parsed.data.startedAt,
    parsed.data.endedAt,
  );
  if (clashes.length > 0) {
    return fail(
      `That overlaps a session already logged on ${clashes[0].track.title}.`,
      "OVERLAP",
    );
  }

  const [created] = await db
    .insert(focusSessions)
    .values({
      userId: user.id,
      trackId: track.id,
      startedAt: parsed.data.startedAt,
      endedAt: parsed.data.endedAt,
      note: parsed.data.note,
      tags: parsed.data.tags,
      endReason: "manual_entry",
    })
    .returning({ id: focusSessions.id });

  revalidateSessionViews();
  return ok(created);
}

export async function updateSession(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = updateSessionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check those values.");
  }

  const { id, ...changes } = parsed.data;

  const existing = await db.query.focusSessions.findFirst({
    where: and(eq(focusSessions.id, id), eq(focusSessions.userId, user.id)),
  });
  if (!existing) return fail("That session no longer exists.", "NOT_FOUND");
  if (!existing.endedAt) {
    return fail("Stop the timer before editing this session.", "STILL_RUNNING");
  }

  // The new track id comes from the client. Without this check a session
  // could be moved onto another user's track, inflating their totals and
  // blocking them from deleting it.
  if (changes.trackId && changes.trackId !== existing.trackId) {
    const owned = await db.query.tracks.findFirst({
      where: and(eq(tracks.id, changes.trackId), eq(tracks.userId, user.id)),
      columns: { id: true },
    });
    if (!owned) return fail("That track no longer exists.", "NOT_FOUND");
  }

  const startedAt = changes.startedAt ?? existing.startedAt;
  const endedAt = changes.endedAt ?? existing.endedAt;

  if (endedAt <= startedAt) {
    return fail("The end time has to be after the start time.");
  }

  // Paused time was measured against the original span; if the span is edited
  // to be shorter than the pause it recorded, the stored pause is nonsense.
  const pausedMs = Math.min(
    existing.pausedMs,
    Math.max(0, endedAt.getTime() - startedAt.getTime()),
  );

  if (changes.startedAt || changes.endedAt) {
    const clashes = await findOverlappingSessions(startedAt, endedAt, id);
    if (clashes.length > 0) {
      return fail(
        `That would overlap a session on ${clashes[0].track.title}.`,
        "OVERLAP",
      );
    }
  }

  await db
    .update(focusSessions)
    .set({
      // A task belongs to one track, so moving the session off it drops the task.
      ...(changes.trackId && changes.trackId !== existing.trackId
        ? { trackId: changes.trackId, taskId: null }
        : {}),
      startedAt,
      endedAt,
      pausedMs,
      ...(changes.note !== undefined ? { note: changes.note } : {}),
      ...(changes.tags !== undefined ? { tags: changes.tags } : {}),
    })
    .where(and(eq(focusSessions.id, id), eq(focusSessions.userId, user.id)));

  revalidateSessionViews();
  return ok(undefined);
}

export async function deleteSession(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = sessionIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown session.");

  const deleted = await db
    .delete(focusSessions)
    .where(
      and(eq(focusSessions.id, parsed.data.id), eq(focusSessions.userId, user.id)),
    )
    .returning({ id: focusSessions.id });

  if (deleted.length === 0) return fail("That session no longer exists.", "NOT_FOUND");

  revalidateSessionViews();
  return ok(undefined);
}

/**
 * Your tags, most used first, for suggestions while tagging. A Server Action
 * rather than a query because the finish dialog lives in the timer bar on
 * every page and asks for them only when it opens.
 */
export async function getMyTags(): Promise<string[]> {
  const user = await requireUser();

  const result = await db.execute<{ tag: string }>(sql`
    select tag
    from ${focusSessions}, unnest(${focusSessions.tags}) as tag
    where ${focusSessions.userId} = ${user.id}
    group by tag
    order by count(*) desc, tag
    limit 30
  `);
  return result.rows.map((r) => r.tag);
}

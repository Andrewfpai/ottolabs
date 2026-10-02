"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { focusSessions, type Track, tracks } from "@/db/schema";
import {
  createTrackSchema,
  trackIdSchema,
  updateTrackSchema,
} from "@/features/tracks/schema";
import {
  type ActionResult,
  fail,
  isForeignKeyViolation,
  isUniqueViolation,
  ok,
} from "@/lib/action-result";
import { getTrackOptions } from "@/features/tracks/server/queries";
import { requireUser } from "@/lib/auth-guard";

const DUPLICATE_TITLE = "You already have a track with that name.";

function revalidateTrackViews() {
  revalidatePath("/tracks");
  revalidatePath("/dashboard");
  revalidatePath("/sessions");
}

export async function createTrack(input: unknown): Promise<ActionResult<Track>> {
  // Server Actions are reachable by direct POST, so this authorises itself
  // rather than trusting the layout that rendered the form.
  const user = await requireUser();

  const parsed = createTrackSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That does not look right.");
  }

  const [{ nextOrder }] = await db
    .select({
      nextOrder: sql<number>`coalesce(max(${tracks.sortOrder}), -1)::int + 1`,
    })
    .from(tracks)
    .where(eq(tracks.userId, user.id));

  try {
    const [created] = await db
      .insert(tracks)
      .values({ ...parsed.data, userId: user.id, sortOrder: nextOrder })
      .returning();

    revalidateTrackViews();
    return ok(created);
  } catch (error) {
    if (isUniqueViolation(error)) return fail(DUPLICATE_TITLE, "DUPLICATE_TITLE");
    throw error;
  }
}

export async function updateTrack(input: unknown): Promise<ActionResult<Track>> {
  const user = await requireUser();

  const parsed = updateTrackSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That does not look right.");
  }

  const { id, ...values } = parsed.data;

  try {
    const [updated] = await db
      .update(tracks)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(tracks.id, id), eq(tracks.userId, user.id)))
      .returning();

    if (!updated) return fail("That track no longer exists.", "NOT_FOUND");

    revalidateTrackViews();
    return ok(updated);
  } catch (error) {
    if (isUniqueViolation(error)) return fail(DUPLICATE_TITLE, "DUPLICATE_TITLE");
    throw error;
  }
}

export async function setTrackStatus(
  input: unknown,
  status: "active" | "paused" | "archived",
): Promise<ActionResult<Track>> {
  const user = await requireUser();

  const parsed = trackIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown track.");

  const [updated] = await db
    .update(tracks)
    .set({
      status,
      archivedAt: status === "archived" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(tracks.id, parsed.data.id), eq(tracks.userId, user.id)))
    .returning();

  if (!updated) return fail("That track no longer exists.", "NOT_FOUND");

  revalidateTrackViews();
  return ok(updated);
}

export async function archiveTrack(input: unknown) {
  return setTrackStatus(input, "archived");
}

export async function unarchiveTrack(input: unknown) {
  return setTrackStatus(input, "active");
}

/**
 * Hard-delete, permitted only when no sessions reference the track.
 *
 * The foreign key is ON DELETE RESTRICT precisely so that deleting a track can
 * never take its history with it. We check first to give a useful message, and
 * still catch the violation in case a session is logged between the check and
 * the delete.
 */
export async function deleteTrack(input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = trackIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown track.");

  const [{ sessionCount }] = await db
    .select({ sessionCount: sql<number>`count(*)::int` })
    .from(focusSessions)
    // Scoped to the caller: unscoped, this count would tell anyone whether
    // another user's track exists and how much it has been used.
    .where(and(eq(focusSessions.trackId, parsed.data.id), eq(focusSessions.userId, user.id)));

  if (sessionCount > 0) {
    return fail(
      `That track has ${sessionCount} logged ${sessionCount === 1 ? "session" : "sessions"}. Archive it instead so the history survives.`,
      "HAS_SESSIONS",
    );
  }

  try {
    const deleted = await db
      .delete(tracks)
      .where(and(eq(tracks.id, parsed.data.id), eq(tracks.userId, user.id)))
      .returning({ id: tracks.id });

    if (deleted.length === 0) return fail("That track no longer exists.", "NOT_FOUND");

    revalidateTrackViews();
    return ok(undefined);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return fail(
        "A session was logged against that track just now, so it can no longer be deleted. Archive it instead.",
        "HAS_SESSIONS",
      );
    }
    throw error;
  }
}

/**
 * Your non-archived tracks, for the command palette. An action rather than a
 * layout prop so it is fetched only when the palette opens, not on every page.
 */
export async function listTracksForPalette() {
  await requireUser();
  const options = await getTrackOptions();
  return options.filter((track) => track.status !== "archived");
}

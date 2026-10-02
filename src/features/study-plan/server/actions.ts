"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { tracks, trackUnits } from "@/db/schema";
import { MAX_UNIT_TITLE, MAX_UNITS, parseUnitTitles, UNIT_LABELS } from "@/features/study-plan/lib/plan";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireUser } from "@/lib/auth-guard";

const TRACK_GONE = "That track no longer exists.";
const UNIT_GONE = "That part of the plan no longer exists.";

function revalidatePlan(trackId: string) {
  revalidatePath(`/tracks/${trackId}`);
  revalidatePath("/tracks");
}

/** Ids come from the client; every action checks the caller owns them. */
async function ownsTrack(trackId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)))
    .limit(1);
  return Boolean(row);
}

async function ownedUnit(unitId: string, userId: string) {
  const [unit] = await db
    .select()
    .from(trackUnits)
    .where(and(eq(trackUnits.id, unitId), eq(trackUnits.userId, userId)))
    .limit(1);
  return unit ?? null;
}

/** Add units at the end, from text with one per line (a pasted contents page). */
export async function addUnits(input: unknown): Promise<ActionResult<number>> {
  const user = await requireUser();
  const parsed = z.object({ trackId: z.uuid(), text: z.string().max(20_000) }).safeParse(input);
  if (!parsed.success) return fail("That list is too long to add at once.");

  const titles = parseUnitTitles(parsed.data.text);
  if (titles.length === 0) return fail("Type at least one title.");
  if (!(await ownsTrack(parsed.data.trackId, user.id))) return fail(TRACK_GONE, "NOT_FOUND");

  const [{ count, last }] = await db
    .select({
      count: sql<number>`count(*)::int`,
      last: sql<number>`coalesce(max(${trackUnits.position}), 0)::int`,
    })
    .from(trackUnits)
    .where(eq(trackUnits.trackId, parsed.data.trackId));
  if (count + titles.length > MAX_UNITS) {
    return fail(`A plan holds up to ${MAX_UNITS} parts; this would make ${count + titles.length}.`);
  }

  await db.insert(trackUnits).values(
    titles.map((title, i) => ({
      userId: user.id,
      trackId: parsed.data.trackId,
      title,
      position: last + (i + 1) * 10,
    })),
  );

  revalidatePlan(parsed.data.trackId);
  return ok(titles.length);
}

export async function renameUnit(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z
    .object({ id: z.uuid(), title: z.string().trim().min(1, "Give it a title").max(MAX_UNIT_TITLE) })
    .safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Give it a title.");

  const unit = await ownedUnit(parsed.data.id, user.id);
  if (!unit) return fail(UNIT_GONE, "NOT_FOUND");

  await db.update(trackUnits).set({ title: parsed.data.title }).where(eq(trackUnits.id, unit.id));
  revalidatePlan(unit.trackId);
  return ok(undefined);
}

export async function setUnitDone(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.object({ id: z.uuid(), done: z.boolean() }).safeParse(input);
  if (!parsed.success) return fail("Unknown part of the plan.");

  const unit = await ownedUnit(parsed.data.id, user.id);
  if (!unit) return fail(UNIT_GONE, "NOT_FOUND");

  await db
    .update(trackUnits)
    // Re-ticking keeps the original completion time.
    .set({ completedAt: parsed.data.done ? (unit.completedAt ?? new Date()) : null })
    .where(eq(trackUnits.id, unit.id));
  revalidatePlan(unit.trackId);
  return ok(undefined);
}

/** Swap a unit with its neighbour above or below, then renumber the plan. */
export async function moveUnit(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.object({ id: z.uuid(), direction: z.enum(["up", "down"]) }).safeParse(input);
  if (!parsed.success) return fail("Unknown part of the plan.");

  const unit = await ownedUnit(parsed.data.id, user.id);
  if (!unit) return fail(UNIT_GONE, "NOT_FOUND");

  const order = (
    await db
      .select({ id: trackUnits.id })
      .from(trackUnits)
      .where(and(eq(trackUnits.trackId, unit.trackId), eq(trackUnits.userId, user.id)))
      .orderBy(asc(trackUnits.position), asc(trackUnits.createdAt))
  ).map((row) => row.id);

  const from = order.indexOf(unit.id);
  const to = parsed.data.direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= order.length) return ok(undefined);
  [order[from], order[to]] = [order[to], order[from]];

  // Renumbering the whole plan keeps it correct even if two units ever
  // shared a position. Plans are short, so this is cheap.
  await db.transaction(async (tx) => {
    for (const [index, id] of order.entries()) {
      await tx.update(trackUnits).set({ position: (index + 1) * 10 }).where(eq(trackUnits.id, id));
    }
  });

  revalidatePlan(unit.trackId);
  return ok(undefined);
}

export async function deleteUnit(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Unknown part of the plan.");

  const unit = await ownedUnit(parsed.data.id, user.id);
  if (!unit) return fail(UNIT_GONE, "NOT_FOUND");

  await db.delete(trackUnits).where(eq(trackUnits.id, unit.id));
  revalidatePlan(unit.trackId);
  return ok(undefined);
}

/** What the plan calls its parts: Chapter, Unit, Module… */
export async function setUnitLabel(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.object({ trackId: z.uuid(), label: z.enum(UNIT_LABELS) }).safeParse(input);
  if (!parsed.success) return fail("Pick one of the listed names.");

  const updated = await db
    .update(tracks)
    .set({ unitLabel: parsed.data.label, updatedAt: new Date() })
    .where(and(eq(tracks.id, parsed.data.trackId), eq(tracks.userId, user.id)))
    .returning({ id: tracks.id });
  if (updated.length === 0) return fail(TRACK_GONE, "NOT_FOUND");

  revalidatePlan(parsed.data.trackId);
  return ok(undefined);
}

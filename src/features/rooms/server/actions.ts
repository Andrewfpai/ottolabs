"use server";

import { and, count, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { friendships, roomMembers, studyRooms } from "@/db/schema";
import { MAX_ROOM_MEMBERS } from "@/features/rooms/lib/room";
import {
  createRoomSchema,
  renameRoomSchema,
  roomIdSchema,
  roomMemberSchema,
} from "@/features/rooms/schema";
import { joinedRoom } from "@/features/rooms/server/check";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireUser } from "@/lib/auth-guard";

const NOT_OWNER = "Only the room's owner can do that.";
const ROOM_GONE = "That room no longer exists, or you are not in it.";

function revalidateRooms() {
  // "layout" so /rooms/[id] pages refresh with the list.
  revalidatePath("/rooms", "layout");
}

/** The caller's room, only if they own it. */
async function ownedRoom(roomId: string, userId: string) {
  const membership = await joinedRoom(roomId, userId);
  return membership?.isOwner ? membership.room : null;
}

export async function createRoom(input: unknown): Promise<ActionResult<string>> {
  const me = await requireUser();
  const parsed = createRoomSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Give the room a name.");

  const roomId = await db.transaction(async (tx) => {
    const [room] = await tx
      .insert(studyRooms)
      .values({ name: parsed.data.name, ownerId: me.id })
      .returning({ id: studyRooms.id });
    // The owner is a joined member like anyone else.
    await tx
      .insert(roomMembers)
      .values({ roomId: room.id, userId: me.id, status: "joined", joinedAt: new Date() });
    return room.id;
  });

  revalidateRooms();
  return ok(roomId);
}

export async function renameRoom(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = renameRoomSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Give the room a name.");

  if (!(await ownedRoom(parsed.data.roomId, me.id))) return fail(NOT_OWNER, "FORBIDDEN");

  await db
    .update(studyRooms)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(studyRooms.id, parsed.data.roomId));

  revalidateRooms();
  return ok(undefined);
}

/** Deletes the room and its memberships. Sessions keep their time; their room tag clears. */
export async function deleteRoom(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = roomIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown room.");

  const deleted = await db
    .delete(studyRooms)
    .where(and(eq(studyRooms.id, parsed.data.roomId), eq(studyRooms.ownerId, me.id)))
    .returning({ id: studyRooms.id });
  if (deleted.length === 0) return fail(NOT_OWNER, "FORBIDDEN");

  revalidateRooms();
  return ok(undefined);
}

/**
 * Owner adds a friend. They are only invited: nothing about the room is
 * visible to them, and nothing about them to the room, until they join.
 */
export async function addMember(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = roomMemberSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown person.");
  const { roomId, userId } = parsed.data;

  if (!(await ownedRoom(roomId, me.id))) return fail(NOT_OWNER, "FORBIDDEN");

  const [friendship] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.requesterId, me.id), eq(friendships.addresseeId, userId)),
          and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, me.id)),
        ),
      ),
    )
    .limit(1);
  if (!friendship) return fail("You can only add people you are friends with.");

  const [{ members }] = await db
    .select({ members: count() })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, roomId));
  if (members >= MAX_ROOM_MEMBERS) {
    return fail(`A room holds ${MAX_ROOM_MEMBERS} people, invitations included.`);
  }

  const inserted = await db
    .insert(roomMembers)
    .values({ roomId, userId, status: "invited" })
    .onConflictDoNothing()
    .returning({ userId: roomMembers.userId });
  if (inserted.length === 0) return fail("They are already in this room or invited.");

  revalidateRooms();
  return ok(undefined);
}

/** Owner removes someone, or withdraws an invitation. Not themselves. */
export async function removeMember(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = roomMemberSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown person.");
  const { roomId, userId } = parsed.data;

  if (!(await ownedRoom(roomId, me.id))) return fail(NOT_OWNER, "FORBIDDEN");
  if (userId === me.id) return fail("You own this room. Delete it instead of leaving.");

  const deleted = await db
    .delete(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .returning({ userId: roomMembers.userId });
  if (deleted.length === 0) return fail("They are not in this room.", "NOT_FOUND");

  revalidateRooms();
  return ok(undefined);
}

/** Accept an invitation. This is the consent to being seen by the room. */
export async function joinRoom(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = roomIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown room.");

  const joined = await db
    .update(roomMembers)
    .set({ status: "joined", joinedAt: new Date() })
    .where(
      and(
        eq(roomMembers.roomId, parsed.data.roomId),
        eq(roomMembers.userId, me.id),
        eq(roomMembers.status, "invited"),
      ),
    )
    .returning({ roomId: roomMembers.roomId });
  if (joined.length === 0) return fail("That invitation is no longer open.", "NOT_FOUND");

  revalidateRooms();
  return ok(undefined);
}

/** Decline an invitation, or leave a room you joined. The owner cannot leave. */
export async function leaveRoom(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = roomIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown room.");

  const [room] = await db
    .select({ ownerId: studyRooms.ownerId })
    .from(studyRooms)
    .where(eq(studyRooms.id, parsed.data.roomId))
    .limit(1);
  if (room?.ownerId === me.id) return fail("You own this room. Delete it instead of leaving.");

  const deleted = await db
    .delete(roomMembers)
    .where(and(eq(roomMembers.roomId, parsed.data.roomId), eq(roomMembers.userId, me.id)))
    .returning({ roomId: roomMembers.roomId });
  if (deleted.length === 0) return fail(ROOM_GONE, "NOT_FOUND");

  revalidateRooms();
  return ok(undefined);
}

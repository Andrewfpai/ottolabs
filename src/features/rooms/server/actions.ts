"use server";

import { randomBytes } from "node:crypto";

import { and, count, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { z } from "zod";

import { db } from "@/db";
import { focusSessions, friendships, roomMembers, studyRooms, users } from "@/db/schema";
import { notifyRoomStart, notifyStudyInvite } from "@/features/reminders/server/push";
import { displayName } from "@/features/friends/lib/sharing";
import { parseRoomCode } from "@/features/rooms/lib/invite-code";
import { MAX_ROOM_MEMBERS } from "@/features/rooms/lib/room";
import {
  createRoomSchema,
  renameRoomSchema,
  roomIdSchema,
  roomMemberSchema,
  setRoomGoalSchema,
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
/** 9 random bytes → 12 base64url characters. */
function newRoomCode(): string {
  return randomBytes(9).toString("base64url");
}

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
      .values({ name: parsed.data.name, goal: parsed.data.goal, ownerId: me.id, inviteCode: newRoomCode() })
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

/** Owner sets or clears what the room is working toward. */
export async function setRoomGoal(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = setRoomGoalSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the goal.");
  if (!(await ownedRoom(parsed.data.roomId, me.id))) return fail(NOT_OWNER, "FORBIDDEN");

  await db
    .update(studyRooms)
    .set({ goal: parsed.data.goal, updatedAt: new Date() })
    .where(eq(studyRooms.id, parsed.data.roomId));
  revalidateRooms();
  return ok(undefined);
}

/**
 * The room's invite code, made on first ask for rooms from before links
 * existed. With `reset`, a new one: the old link stops working.
 */
export async function roomInviteCode(input: unknown): Promise<ActionResult<string>> {
  const me = await requireUser();
  const parsed = roomIdSchema.extend({ reset: z.boolean().default(false) }).safeParse(input);
  if (!parsed.success) return fail("Unknown room.");
  const room = await ownedRoom(parsed.data.roomId, me.id);
  if (!room) return fail(NOT_OWNER, "FORBIDDEN");

  if (room.inviteCode && !parsed.data.reset) return ok(room.inviteCode);
  const code = newRoomCode();
  await db.update(studyRooms).set({ inviteCode: code, updatedAt: new Date() }).where(eq(studyRooms.id, room.id));
  return ok(code);
}

/**
 * Join a room from its invite link. Anyone with access to OttoLabs may, as
 * long as there is space; joining is still the consent to being seen. An
 * open invitation is simply accepted.
 */
export async function joinRoomByCode(input: unknown): Promise<ActionResult<string>> {
  const me = await requireUser();
  const parsed = z.object({ code: z.string().max(500) }).safeParse(input);
  const code = parsed.success ? parseRoomCode(parsed.data.code) : null;
  if (!code) return fail("That does not look like a room link.");

  const [room] = await db
    .select({ id: studyRooms.id })
    .from(studyRooms)
    .where(eq(studyRooms.inviteCode, code))
    .limit(1);
  if (!room) return fail("That room link no longer works. Ask the owner for a new one.", "NOT_FOUND");

  const [existing] = await db
    .select({ status: roomMembers.status })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, me.id)))
    .limit(1);

  if (existing?.status === "joined") return ok(room.id);
  if (existing?.status === "invited") {
    await db
      .update(roomMembers)
      .set({ status: "joined", joinedAt: new Date() })
      .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, me.id)));
  } else {
    const [{ members }] = await db.select({ members: count() }).from(roomMembers).where(eq(roomMembers.roomId, room.id));
    if (members >= MAX_ROOM_MEMBERS) return fail(`That room is full (${MAX_ROOM_MEMBERS} people).`, "FULL");
    await db
      .insert(roomMembers)
      .values({ roomId: room.id, userId: me.id, status: "joined", joinedAt: new Date() })
      .onConflictDoNothing();
  }

  revalidateRooms();
  return ok(room.id);
}

/**
 * Move the timer you already have running into a room, so it counts there
 * and the room sees you. The whole session counts, from its start.
 */
export async function focusInRoom(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = roomIdSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown room.");
  if (!(await joinedRoom(parsed.data.roomId, me.id))) return fail(ROOM_GONE, "NOT_FOUND");

  const moved = await db
    .update(focusSessions)
    .set({ roomId: parsed.data.roomId })
    .where(and(eq(focusSessions.userId, me.id), isNull(focusSessions.endedAt)))
    .returning({ id: focusSessions.id });
  if (moved.length === 0) return fail("Start a timer first, then bring it into the room.", "NOT_RUNNING");

  revalidateRooms();
  after(() => notifyRoomStart(parsed.data.roomId, me.id));
  return ok(undefined);
}

/** Your personal room, made on first use. */
async function personalRoom(userId: string) {
  const [existing] = await db
    .select()
    .from(studyRooms)
    .where(and(eq(studyRooms.ownerId, userId), eq(studyRooms.personal, true)))
    .limit(1);
  if (existing) {
    if (existing.inviteCode) return existing;
    const inviteCode = newRoomCode();
    await db.update(studyRooms).set({ inviteCode }).where(eq(studyRooms.id, existing.id));
    return { ...existing, inviteCode };
  }

  const [me] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  const name = `${me ? displayName(me) : "My"}'s room`.slice(0, 60);
  return db.transaction(async (tx) => {
    const [room] = await tx
      .insert(studyRooms)
      .values({ name, ownerId: userId, personal: true, inviteCode: newRoomCode() })
      .onConflictDoNothing()
      .returning();
    // Two tabs racing: the other one made it; use theirs.
    if (!room) {
      const [made] = await tx
        .select()
        .from(studyRooms)
        .where(and(eq(studyRooms.ownerId, userId), eq(studyRooms.personal, true)))
        .limit(1);
      return made;
    }
    await tx.insert(roomMembers).values({ roomId: room.id, userId, status: "joined", joinedAt: new Date() });
    return room;
  });
}

/**
 * "Study together" with one friend: invite them into your personal room,
 * bring your running timer there, and let them know. One tap, no setup.
 */
export async function studyWith(input: unknown): Promise<ActionResult<{ roomId: string; already: boolean }>> {
  const me = await requireUser();
  const parsed = z.object({ friendId: z.string().min(1).max(100) }).safeParse(input);
  if (!parsed.success) return fail("Unknown person.");
  const { friendId } = parsed.data;

  const [friendship] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.requesterId, me.id), eq(friendships.addresseeId, friendId)),
          and(eq(friendships.requesterId, friendId), eq(friendships.addresseeId, me.id)),
        ),
      ),
    )
    .limit(1);
  if (!friendship) return fail("You can only invite your friends.", "NOT_FOUND");

  const room = await personalRoom(me.id);
  const [member] = await db
    .select({ status: roomMembers.status })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, friendId)))
    .limit(1);

  if (!member) {
    const [{ members }] = await db.select({ members: count() }).from(roomMembers).where(eq(roomMembers.roomId, room.id));
    if (members >= MAX_ROOM_MEMBERS) return fail(`Your room is full (${MAX_ROOM_MEMBERS} people). Remove someone first.`, "FULL");
    await db.insert(roomMembers).values({ roomId: room.id, userId: friendId, status: "invited" }).onConflictDoNothing();
  }

  // Your own timer, if running, now counts in the room they are joining.
  await db
    .update(focusSessions)
    .set({ roomId: room.id })
    .where(and(eq(focusSessions.userId, me.id), isNull(focusSessions.endedAt)));

  revalidateRooms();
  revalidatePath("/focus");
  if (member?.status !== "joined") {
    const code = room.inviteCode!;
    after(() => notifyStudyInvite(me.id, friendId, code));
  }
  return ok({ roomId: room.id, already: member?.status === "joined" });
}

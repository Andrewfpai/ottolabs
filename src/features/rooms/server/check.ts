/**
 * The membership gate for study rooms.
 *
 * Every room read and write goes through `joinedRoom`: an invited-but-not-yet
 * joined person, an ex-member and a stranger all get null, which pages turn
 * into a 404. Kept free of auth-guard so the sessions feature can use it to
 * check a room id before tagging a session with it.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { roomMembers, type StudyRoom, studyRooms } from "@/db/schema";

export async function joinedRoom(
  roomId: string,
  userId: string,
): Promise<{ room: StudyRoom; isOwner: boolean } | null> {
  // A malformed id from a URL is "no such room", not a Postgres cast error.
  if (!z.uuid().safeParse(roomId).success) return null;

  const [row] = await db
    .select({ room: studyRooms })
    .from(roomMembers)
    .innerJoin(studyRooms, eq(studyRooms.id, roomMembers.roomId))
    .where(
      and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, userId),
        eq(roomMembers.status, "joined"),
      ),
    )
    .limit(1);
  return row ? { room: row.room, isOwner: row.room.ownerId === userId } : null;
}

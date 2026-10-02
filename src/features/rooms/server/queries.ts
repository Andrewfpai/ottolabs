/**
 * Reads for study rooms. Members' data is loaded only after `joinedRoom` has
 * confirmed the viewer is a joined member. What a room ever sees: each
 * member's timer state, track label (real name only if they share names) and
 * timestamps to tick from, plus time focused in the room. Never notes, tags
 * or tasks.
 */
import { and, asc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  focusSessions,
  friendships,
  roomMembers,
  studyRooms,
  tracks,
  userSettings,
  users,
} from "@/db/schema";
import { displayName, redactTrackTitles } from "@/features/friends/lib/sharing";
import { MAX_ROOM_MEMBERS, type MemberState, memberState, roomTotals } from "@/features/rooms/lib/room";
import { joinedRoom } from "@/features/rooms/server/check";
import { requireSettings, requireUser } from "@/lib/auth-guard";

export type RoomSummary = {
  id: string;
  name: string;
  ownerName: string;
  isOwner: boolean;
  status: "invited" | "joined";
  memberCount: number;
  /** Joined members focusing right now, with a fresh heartbeat. */
  focusingNow: number;
};

export async function getRoomsOverview(): Promise<RoomSummary[]> {
  const me = await requireUser();
  const now = Date.now();

  const mine = await db
    .select({
      id: studyRooms.id,
      name: studyRooms.name,
      ownerId: studyRooms.ownerId,
      ownerName: users.name,
      ownerEmail: users.email,
      status: roomMembers.status,
    })
    .from(roomMembers)
    .innerJoin(studyRooms, eq(studyRooms.id, roomMembers.roomId))
    .innerJoin(users, eq(users.id, studyRooms.ownerId))
    .where(eq(roomMembers.userId, me.id))
    .orderBy(asc(studyRooms.createdAt));

  const roomIds = mine.map((r) => r.id);
  if (roomIds.length === 0) return [];

  // Counts only for rooms the viewer has joined; an invitation shows the
  // room's name and owner, nothing about who is inside.
  const joinedIds = mine.filter((r) => r.status === "joined").map((r) => r.id);
  const members = joinedIds.length
    ? await db
        .select({
          roomId: roomMembers.roomId,
          endedAt: focusSessions.endedAt,
          pausedAt: focusSessions.pausedAt,
          breakStartedAt: focusSessions.breakStartedAt,
          lastHeartbeatAt: focusSessions.lastHeartbeatAt,
        })
        .from(roomMembers)
        .leftJoin(
          focusSessions,
          and(eq(focusSessions.userId, roomMembers.userId), isNull(focusSessions.endedAt)),
        )
        .where(and(inArray(roomMembers.roomId, joinedIds), eq(roomMembers.status, "joined")))
    : [];

  return mine.map((room) => {
    const inRoom = members.filter((m) => m.roomId === room.id);
    return {
      id: room.id,
      name: room.name,
      ownerName: displayName({ name: room.ownerName, email: room.ownerEmail }),
      isOwner: room.ownerId === me.id,
      status: room.status,
      memberCount: inRoom.length,
      // A member with no open session joins as all-null fields: "away".
      focusingNow: inRoom.filter((m) => memberState(m, now) === "focusing").length,
    };
  });
}

export type RoomMemberLive = {
  id: string;
  name: string;
  image: string | null;
  isSelf: boolean;
  isOwner: boolean;
  state: MemberState;
  /** Their running session was started from this room. */
  inThisRoom: boolean;
  /** Present unless away. ISO strings, so server render and polling agree. */
  session: {
    startedAt: string;
    pausedMs: number;
    pausedAt: string | null;
    trackLabel: string;
    trackColor: string;
  } | null;
  /** This week's focus in this room. */
  weekMs: number;
};

export type RoomLive = {
  members: RoomMemberLive[];
  todayMs: number;
  weekMs: number;
};

/** Days of room sessions to load: enough for any "this week". */
const ROOM_HISTORY_DAYS = 9;

/**
 * The live view of a room, for the page and for polling. Returns null unless
 * the viewer is a joined member.
 */
export async function getRoomLive(roomId: string, viewerId: string): Promise<RoomLive | null> {
  const membership = await joinedRoom(roomId, viewerId);
  if (!membership) return null;

  const now = Date.now();
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      shareTrackNames: userSettings.shareTrackNames,
    })
    .from(roomMembers)
    .innerJoin(users, eq(users.id, roomMembers.userId))
    .leftJoin(userSettings, eq(userSettings.userId, roomMembers.userId))
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.status, "joined")))
    .orderBy(asc(roomMembers.joinedAt));

  const memberIds = members.map((m) => m.id);
  const since = new Date(now - ROOM_HISTORY_DAYS * 86_400_000);

  const [openSessions, trackRows, roomSessions, viewerSettings] = await Promise.all([
    db
      .select({
        userId: focusSessions.userId,
        trackId: focusSessions.trackId,
        roomId: focusSessions.roomId,
        startedAt: focusSessions.startedAt,
        endedAt: focusSessions.endedAt,
        pausedMs: focusSessions.pausedMs,
        pausedAt: focusSessions.pausedAt,
        breakStartedAt: focusSessions.breakStartedAt,
        lastHeartbeatAt: focusSessions.lastHeartbeatAt,
      })
      .from(focusSessions)
      .where(and(inArray(focusSessions.userId, memberIds), isNull(focusSessions.endedAt))),
    db
      .select({ id: tracks.id, userId: tracks.userId, title: tracks.title, color: tracks.color })
      .from(tracks)
      .where(inArray(tracks.userId, memberIds))
      .orderBy(asc(tracks.sortOrder), asc(tracks.createdAt)),
    // Only sessions started in this room, and only by people still in it.
    db
      .select({
        userId: focusSessions.userId,
        trackId: focusSessions.trackId,
        startedAt: focusSessions.startedAt,
        endedAt: focusSessions.endedAt,
        pausedMs: focusSessions.pausedMs,
        pausedAt: focusSessions.pausedAt,
        lastHeartbeatAt: focusSessions.lastHeartbeatAt,
      })
      .from(focusSessions)
      .where(
        and(
          eq(focusSessions.roomId, roomId),
          inArray(focusSessions.userId, memberIds),
          gte(focusSessions.startedAt, since),
        ),
      ),
    requireSettings(),
  ]);

  // Track labels as each member lets the room see them; your own are real.
  const labels = new Map<string, { title: string; color: string }>();
  for (const member of members) {
    const own = trackRows.filter((t) => t.userId === member.id);
    const share = member.id === viewerId || (member.shareTrackNames ?? false);
    for (const t of redactTrackTitles(own, share)) labels.set(t.id, { title: t.title, color: t.color });
  }

  const totals = roomTotals(
    roomSessions,
    {
      timeZone: viewerSettings.timezone,
      dayStartHour: viewerSettings.dayStartHour,
      weekStartsOn: viewerSettings.weekStartsOn,
    },
    now,
  );

  return {
    members: members.map((member) => {
      const open = openSessions.find((s) => s.userId === member.id) ?? null;
      const state = memberState(open, now);
      const track = open ? labels.get(open.trackId) : undefined;
      return {
        id: member.id,
        name: displayName(member),
        image: member.image,
        isSelf: member.id === viewerId,
        isOwner: member.id === membership.room.ownerId,
        state,
        inThisRoom: Boolean(open && open.roomId === roomId && state !== "away"),
        session:
          open && state !== "away"
            ? {
                startedAt: open.startedAt.toISOString(),
                pausedMs: open.pausedMs,
                pausedAt: open.pausedAt?.toISOString() ?? null,
                trackLabel: track?.title ?? "a track",
                trackColor: track?.color ?? "teal",
              }
            : null,
        weekMs: totals.weekByMember[member.id] ?? 0,
      };
    }),
    todayMs: totals.todayMs,
    weekMs: totals.weekMs,
  };
}

export type RoomPage = {
  room: { id: string; name: string };
  isOwner: boolean;
  live: RoomLive;
  /** Owner only: people invited who have not joined yet. */
  invited: { id: string; name: string; image: string | null }[];
  /** Owner only: friends who can still be added, within the size cap. */
  addable: { id: string; name: string; image: string | null }[];
  maxMembers: number;
};

export async function getRoomPage(roomId: string): Promise<RoomPage | null> {
  const me = await requireUser();
  const membership = await joinedRoom(roomId, me.id);
  if (!membership) return null;

  const live = await getRoomLive(roomId, me.id);
  if (!live) return null;

  let invited: RoomPage["invited"] = [];
  let addable: RoomPage["addable"] = [];

  if (membership.isOwner) {
    const invitedRows = await db
      .select({ id: users.id, name: users.name, email: users.email, image: users.image })
      .from(roomMembers)
      .innerJoin(users, eq(users.id, roomMembers.userId))
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.status, "invited")));
    invited = invitedRows.map((u) => ({ id: u.id, name: displayName(u), image: u.image }));

    const inRoom = new Set([...live.members.map((m) => m.id), ...invited.map((u) => u.id)]);
    const friendRows = await db
      .select({ id: users.id, name: users.name, email: users.email, image: users.image })
      .from(friendships)
      .innerJoin(
        users,
        sql`${users.id} = case when ${friendships.requesterId} = ${me.id} then ${friendships.addresseeId} else ${friendships.requesterId} end`,
      )
      .where(
        and(
          eq(friendships.status, "accepted"),
          or(eq(friendships.requesterId, me.id), eq(friendships.addresseeId, me.id)),
        ),
      );
    addable = friendRows
      .filter((u) => !inRoom.has(u.id))
      .map((u) => ({ id: u.id, name: displayName(u), image: u.image }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    room: { id: membership.room.id, name: membership.room.name },
    isOwner: membership.isOwner,
    live,
    invited,
    addable,
    maxMembers: MAX_ROOM_MEMBERS,
  };
}


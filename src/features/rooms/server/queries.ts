/**
 * Reads for study rooms. Members' data is loaded only after `joinedRoom` has
 * confirmed the viewer is a joined member. What a room ever sees: each
 * member's timer state, track label (real name only if they share names) and
 * timestamps to tick from, plus time focused in the room. Never notes, tags
 * or tasks.
 */
import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  focusSessions,
  friendships,
  roomMembers,
  roomReactions,
  studyRooms,
  tracks,
  userSettings,
  users,
} from "@/db/schema";
import { displayName, redactTrackTitles } from "@/features/friends/lib/sharing";
import { userPicture } from "@/features/friends/server/picture";
import {
  type ActivityEvent,
  MAX_ROOM_MEMBERS,
  type MemberState,
  memberState,
  REACTION_WINDOW_MS,
  roomActivity,
  type RoomReaction,
  roomTotals,
} from "@/features/rooms/lib/room";
import { parseRoomCode } from "@/features/rooms/lib/invite-code";
import { joinedRoom } from "@/features/rooms/server/check";
import { requireSettings, requireUser } from "@/lib/auth-guard";
import { elapsedMs } from "@/lib/time/elapsed";

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
  /** All of their focus today and this week, in the viewer's days: the leaderboard. */
  todayMs: number;
  weekMs: number;
};

export type RoomReactionLive = { id: string; reaction: RoomReaction; userId: string; name: string; at: number };

export type RoomActivityLive = ActivityEvent & { name: string };

export type RoomLive = {
  members: RoomMemberLive[];
  /** The last minute of reactions, newest first. */
  reactions: RoomReactionLive[];
  /** What happened lately: starts and finishes. */
  activity: RoomActivityLive[];
  /** When this was read; live minutes are added on top of it client-side. */
  asOf: number;
};

/** Days of sessions to load: enough for any "this week". */
const ROOM_HISTORY_DAYS = 9;

/**
 * The live view of a room, for the page, focus mode and polling. Returns
 * null unless the viewer is a joined member. Each person's timer stays their
 * own; the room just sees everyone's, side by side.
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
      image: userPicture,
      shareTrackNames: userSettings.shareTrackNames,
    })
    .from(roomMembers)
    .innerJoin(users, eq(users.id, roomMembers.userId))
    .leftJoin(userSettings, eq(userSettings.userId, roomMembers.userId))
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.status, "joined")))
    .orderBy(asc(roomMembers.joinedAt));

  const memberIds = members.map((m) => m.id);
  const since = new Date(now - ROOM_HISTORY_DAYS * 86_400_000);

  const [sessions, trackRows, reactionRows, viewerSettings] = await Promise.all([
    // Everything members did lately, in any room or none: the leaderboard
    // is everyone's own focus, not a pooled timer.
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
      .where(
        and(
          inArray(focusSessions.userId, memberIds),
          or(gte(focusSessions.startedAt, since), isNull(focusSessions.endedAt)),
        ),
      ),
    db
      .select({ id: tracks.id, userId: tracks.userId, title: tracks.title, color: tracks.color })
      .from(tracks)
      .where(inArray(tracks.userId, memberIds))
      .orderBy(asc(tracks.sortOrder), asc(tracks.createdAt)),
    db
      .select({ id: roomReactions.id, reaction: roomReactions.reaction, userId: roomReactions.userId, createdAt: roomReactions.createdAt })
      .from(roomReactions)
      .where(and(eq(roomReactions.roomId, roomId), gte(roomReactions.createdAt, new Date(now - REACTION_WINDOW_MS))))
      .orderBy(desc(roomReactions.createdAt))
      .limit(30),
    requireSettings(),
  ]);

  // Track labels as each member lets the room see them; your own are real.
  const labels = new Map<string, { title: string; color: string }>();
  for (const member of members) {
    const own = trackRows.filter((t) => t.userId === member.id);
    const share = member.id === viewerId || (member.shareTrackNames ?? false);
    for (const t of redactTrackTitles(own, share)) labels.set(t.id, { title: t.title, color: t.color });
  }
  const labelOf = (trackId: string) => labels.get(trackId) ?? { title: "a track", color: "teal" };
  const nameOf = new Map(members.map((m) => [m.id, displayName(m)]));

  const totals = roomTotals(
    sessions,
    {
      timeZone: viewerSettings.timezone,
      dayStartHour: viewerSettings.dayStartHour,
      weekStartsOn: viewerSettings.weekStartsOn,
    },
    now,
  );

  // An abandoned timer is not news: only fresh or finished sessions make the feed.
  const feedSessions = sessions.filter((s) => s.endedAt !== null || memberState(s, now) !== "away");
  const activity = roomActivity(feedSessions, labelOf, (s) => elapsedMs(s, now), now).map((event) => ({
    ...event,
    name: nameOf.get(event.userId) ?? "Someone",
  }));

  return {
    members: members.map((member) => {
      const open = sessions.find((s) => s.userId === member.id && s.endedAt === null) ?? null;
      const state = memberState(open, now);
      const track = open ? labelOf(open.trackId) : undefined;
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
        todayMs: totals.todayByMember[member.id] ?? 0,
        weekMs: totals.weekByMember[member.id] ?? 0,
      };
    }),
    reactions: reactionRows.map((r) => ({
      id: r.id,
      reaction: r.reaction as RoomReaction,
      userId: r.userId,
      name: nameOf.get(r.userId) ?? "Someone",
      at: r.createdAt.getTime(),
    })),
    activity,
    asOf: now,
  };
}

export type RoomPage = {
  room: { id: string; name: string; goal: string | null };
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
      .select({ id: users.id, name: users.name, email: users.email, image: userPicture })
      .from(roomMembers)
      .innerJoin(users, eq(users.id, roomMembers.userId))
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.status, "invited")));
    invited = invitedRows.map((u) => ({ id: u.id, name: displayName(u), image: u.image }));

    const inRoom = new Set([...live.members.map((m) => m.id), ...invited.map((u) => u.id)]);
    const friendRows = await db
      .select({ id: users.id, name: users.name, email: users.email, image: userPicture })
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
    room: { id: membership.room.id, name: membership.room.name, goal: membership.room.goal },
    isOwner: membership.isOwner,
    live,
    invited,
    addable,
    maxMembers: MAX_ROOM_MEMBERS,
  };
}


export type RoomInvite = {
  id: string;
  name: string;
  goal: string | null;
  ownerName: string;
  memberCount: number;
  alreadyJoined: boolean;
};

/** The room behind an invite link, for the join page. Null if the link is dead or the room is full. */
export async function getRoomInvite(code: string): Promise<RoomInvite | null> {
  const me = await requireUser();
  if (!parseRoomCode(code)) return null;
  const [room] = await db
    .select({ id: studyRooms.id, name: studyRooms.name, goal: studyRooms.goal, ownerName: users.name, ownerEmail: users.email })
    .from(studyRooms)
    .innerJoin(users, eq(users.id, studyRooms.ownerId))
    .where(eq(studyRooms.inviteCode, code))
    .limit(1);
  if (!room) return null;

  const members = await db
    .select({ userId: roomMembers.userId, status: roomMembers.status })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, room.id));
  const mine = members.find((m) => m.userId === me.id);
  if (!mine && members.length >= MAX_ROOM_MEMBERS) return null;

  return {
    id: room.id,
    name: room.name,
    goal: room.goal,
    ownerName: displayName({ name: room.ownerName, email: room.ownerEmail }),
    memberCount: members.filter((m) => m.status === "joined").length,
    alreadyJoined: mine?.status === "joined",
  };
}

export type MyRoom = { id: string; name: string; goal: string | null; isOwner: boolean };

/** Rooms you have joined, for the focus screen's Study together panel. */
export async function getMyRooms(): Promise<MyRoom[]> {
  const me = await requireUser();
  const rows = await db
    .select({ id: studyRooms.id, name: studyRooms.name, goal: studyRooms.goal, ownerId: studyRooms.ownerId })
    .from(roomMembers)
    .innerJoin(studyRooms, eq(studyRooms.id, roomMembers.roomId))
    .where(and(eq(roomMembers.userId, me.id), eq(roomMembers.status, "joined")))
    .orderBy(asc(studyRooms.name));
  return rows.map((r) => ({ id: r.id, name: r.name, goal: r.goal, isOwner: r.ownerId === me.id }));
}

export type RoomInvitation = { roomId: string; roomName: string; from: string; image: string | null };

/** Rooms you have been invited to and not joined yet, newest first. */
export async function getMyRoomInvitations(): Promise<RoomInvitation[]> {
  const me = await requireUser();
  const rows = await db
    .select({
      roomId: studyRooms.id,
      roomName: studyRooms.name,
      ownerName: users.name,
      ownerEmail: users.email,
      image: userPicture,
    })
    .from(roomMembers)
    .innerJoin(studyRooms, eq(studyRooms.id, roomMembers.roomId))
    .innerJoin(users, eq(users.id, studyRooms.ownerId))
    .where(and(eq(roomMembers.userId, me.id), eq(roomMembers.status, "invited")))
    .orderBy(desc(roomMembers.invitedAt));
  return rows.map((r) => ({
    roomId: r.roomId,
    roomName: r.roomName,
    from: displayName({ name: r.ownerName, email: r.ownerEmail }),
    image: r.image,
  }));
}

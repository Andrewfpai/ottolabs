/**
 * Study rooms: a small group who can see each other's live timers.
 *
 * Membership is two-step. The owner adds a friend, which creates an `invited`
 * row; nothing is shared until that person joins, because joining is the
 * consent to being seen by the room. The owner has a `joined` row like
 * everyone else, so "who is in this room" is one query.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const roomMemberStatusEnum = pgEnum("room_member_status", ["invited", "joined"]);

export const studyRooms = pgTable(
  "study_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** What the room is working toward, shown to everyone in it: "Finish chapter 3". */
    goal: text("goal"),
    /**
     * The secret in the room's invite link. Anyone with access to OttoLabs who
     * has it can join. Regenerating it retires the old link.
     */
    inviteCode: text("invite_code").unique(),
    /**
     * The room "Study together" invites a friend into, made the first time
     * and reused after, so one-tap invites do not pile up rooms.
     */
    personal: boolean("personal").notNull().default(false),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("study_rooms_owner_idx").on(t.ownerId),
    // At most one personal room each.
    uniqueIndex("study_rooms_one_personal").on(t.ownerId).where(sql`${t.personal}`),
    check("study_rooms_name_length", sql`char_length(${t.name}) between 1 and 60`),
    check("study_rooms_goal_length", sql`${t.goal} is null or char_length(${t.goal}) between 1 and 120`),
  ],
);

export const roomMembers = pgTable(
  "room_members",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => studyRooms.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: roomMemberStatusEnum("status").notNull().default("invited"),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.roomId, t.userId] }),
    // "Which rooms am I in" is asked on every Rooms page load.
    index("room_members_user_idx").on(t.userId),
  ],
);

export type StudyRoom = typeof studyRooms.$inferSelect;
export type RoomMember = typeof roomMembers.$inferSelect;

/**
 * A 👏 🔥 💪 or ☕ sent to everyone in a room. Short-lived: the room shows
 * the last minute of them, floating up, so being together feels alive.
 */
export const roomReactions = pgTable(
  "room_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => studyRooms.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reaction: text("reaction").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("room_reactions_room_created_idx").on(t.roomId, t.createdAt.desc()),
    check("room_reactions_kind", sql`${t.reaction} in ('clap', 'fire', 'muscle', 'coffee')`),
  ],
);

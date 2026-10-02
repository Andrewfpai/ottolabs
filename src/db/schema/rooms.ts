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
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const roomMemberStatusEnum = pgEnum("room_member_status", ["invited", "joined"]);

export const studyRooms = pgTable(
  "study_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("study_rooms_owner_idx").on(t.ownerId),
    check("study_rooms_name_length", sql`char_length(${t.name}) between 1 and 60`),
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

/**
 * Auth.js (NextAuth v5) tables for the Drizzle adapter.
 *
 * Column names here are dictated by @auth/drizzle-adapter and must not be
 * renamed. Table names are ours, and are passed explicitly to the adapter in
 * `src/lib/auth.ts`.
 *
 * Note the `accounts` table stores the Google `refresh_token`. That is what
 * lets v1.1 add the Calendar scope to this same grant without a second OAuth
 * flow — do not drop this table when trimming things down.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
    image: text("image"),
    /**
     * Ours, not the adapter's: how friends find you without your email.
     * Null until chosen in Settings. Stored lowercase, so a plain unique
     * constraint is case-insensitive. Rules in `features/friends/lib/username.ts`.
     */
    username: text("username").unique(),
    /**
     * Ours too: a built-in animal avatar id (`lib/avatars.ts`), shown in
     * place of `image`. Null means use the Google photo.
     */
    avatar: text("avatar"),
    /** Accessories worn on the animal avatar, one per slot. Each must be unlocked. */
    accessories: text("accessories").array().notNull().default(sql`ARRAY[]::text[]`),
  },
  (t) => [check("users_username_format", sql`${t.username} ~ '^[a-z0-9_]{3,20}$'`)],
);

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const authenticators = pgTable(
  "authenticators",
  {
    credentialID: text("credential_id").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("provider_account_id").notNull(),
    credentialPublicKey: text("credential_public_key").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credential_device_type").notNull(),
    credentialBackedUp: boolean("credential_backed_up").notNull(),
    transports: text("transports"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.credentialID] })],
);

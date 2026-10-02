/**
 * The single answer to "may this email use the app?", shared by the sign-in
 * callback and every authenticated request.
 *
 * Kept apart from the rest of the access feature so `lib/auth-guard` can call
 * it without an import cycle (the queries and actions call auth-guard).
 */
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { allowedEmails, sessions, users } from "@/db/schema";
import { isOwnerEmail, normalizeEmail } from "@/lib/access";

export async function isInvited(email: string): Promise<boolean> {
  const [row] = await db
    .select({ email: allowedEmails.email })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, normalizeEmail(email)))
    .limit(1);
  return Boolean(row);
}

/**
 * Owners are answered from the environment without touching the database, so
 * an owner can always sign in — even before the invite table exists.
 */
export async function hasAccess(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isOwnerEmail(email)) return true;
  return isInvited(email);
}

/**
 * Sign a user out on every device by deleting their Auth.js login sessions.
 *
 * Logins are database sessions that last weeks; without this, removing
 * someone's invite would leave them signed in until theirs expired.
 */
export async function signOutEverywhere(email: string): Promise<void> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    // Stored as Google returned it; compare without case.
    .where(eq(sql`lower(${users.email})`, normalizeEmail(email)))
    .limit(1);
  if (user) await db.delete(sessions).where(eq(sessions.userId, user.id));
}

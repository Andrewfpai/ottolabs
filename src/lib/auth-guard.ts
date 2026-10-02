import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { type UserSettings, userSettings } from "@/db/schema";
import { auth } from "@/lib/auth";

export type AuthedUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

/**
 * Gate for every authenticated Server Component and Server Action.
 *
 * Wrapped in React's `cache` so that a page calling it, plus three of its
 * children doing the same, results in one session lookup per request.
 *
 * Server Actions are reachable by direct POST, not only through our UI, so
 * every action must call this itself. Protecting the layout is not enough.
 */
export const requireUser = cache(async (): Promise<AuthedUser> => {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    redirect("/sign-in");
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
});

/**
 * Settings are created by the `createUser` auth event, so a row should always
 * exist. The fallback covers users created before that event existed and keeps
 * every caller from having to handle a null.
 */
export const requireSettings = cache(async (): Promise<UserSettings> => {
  const user = await requireUser();

  const existing = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, user.id),
  });

  if (existing) return existing;

  const [created] = await db
    .insert(userSettings)
    .values({ userId: user.id })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  // Lost an insert race with a concurrent request; the row exists now.
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, user.id),
  });

  if (!settings) {
    throw new Error(`Could not load or create settings for user ${user.id}`);
  }

  return settings;
});

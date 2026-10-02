"use server";

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { cheers, friendships, userSettings, users } from "@/db/schema";
import { hasAccess } from "@/features/access/server/check";
import { CHEER_KINDS, cheerWaitMs, describeWait } from "@/features/friends/lib/cheers";
import { displayName } from "@/features/friends/lib/sharing";
import { notifyCheer } from "@/features/reminders/server/push";
import { parseFriendHandle, usernameSchema } from "@/features/friends/lib/username";
import { type ActionResult, fail, isUniqueViolation, ok, violatedConstraint } from "@/lib/action-result";
import { requireUser } from "@/lib/auth-guard";
import { ANIMAL_AVATAR_IDS } from "@/lib/avatars";

const idSchema = z.object({ id: z.uuid() });
const respondSchema = z.object({ id: z.uuid(), accept: z.boolean() });
const unfriendSchema = z.object({ friendId: z.string().min(1).max(100) });
const handleSchema = z.object({ handle: z.string().max(254) });
const sharingSchema = z.object({ shareTrackNames: z.boolean(), shareLiveStatus: z.boolean() });

function revalidateFriends() {
  // "layout" so the profile pages under /friends refresh too.
  revalidatePath("/friends", "layout");
}

/** The pair, in either direction. */
function pair(a: string, b: string) {
  return or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  );
}

/**
 * Ask someone to be friends, by username or email. Only people who can use
 * this OttoLabs can be asked. If they already asked you, this accepts their
 * request rather than making a second one.
 */
export async function sendFriendRequest(input: unknown): Promise<ActionResult<"sent" | "accepted">> {
  const me = await requireUser();

  const parsed = handleSchema.safeParse(input);
  const handle = parsed.success ? parseFriendHandle(parsed.data.handle) : null;
  if (!handle) return fail("Enter a username like @budi, or an email address.");

  const [target] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      handle.kind === "email"
        ? eq(sql`lower(${users.email})`, handle.email)
        : eq(users.username, handle.username),
    )
    .limit(1);

  if (target?.id === me.id) return fail("That is you.");
  if (!target || !(await hasAccess(target.email))) {
    return fail(
      handle.kind === "email"
        ? "Nobody with that email uses this OttoLabs yet. They need an invite from an owner, then to sign in once."
        : `Nobody here is called @${handle.username}. Check the spelling, or try their email.`,
      "NOT_FOUND",
    );
  }

  const [existing] = await db.select().from(friendships).where(pair(me.id, target.id)).limit(1);

  if (existing?.status === "accepted") return fail("You are already friends.");
  if (existing && existing.requesterId === me.id) return fail("Your request is already waiting for them.");
  if (existing) {
    await db
      .update(friendships)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(friendships.id, existing.id));
    revalidateFriends();
    return ok("accepted");
  }

  try {
    await db.insert(friendships).values({ requesterId: me.id, addresseeId: target.id });
  } catch (error) {
    // They asked at the same moment; the pair index caught it.
    if (isUniqueViolation(error)) return fail("A request between you already exists. Reload the page.");
    throw error;
  }

  revalidateFriends();
  return ok("sent");
}

/** Accept or decline a request addressed to you. Declining deletes it. */
export async function respondToRequest(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown request.");

  // Scoped to requests *to* the caller: you cannot accept on someone's behalf.
  const mine = and(
    eq(friendships.id, parsed.data.id),
    eq(friendships.addresseeId, me.id),
    eq(friendships.status, "pending"),
  );

  const changed = parsed.data.accept
    ? await db
        .update(friendships)
        .set({ status: "accepted", respondedAt: new Date() })
        .where(mine)
        .returning({ id: friendships.id })
    : await db.delete(friendships).where(mine).returning({ id: friendships.id });

  if (changed.length === 0) return fail("That request is no longer waiting.", "NOT_FOUND");

  revalidateFriends();
  return ok(undefined);
}

/** Withdraw a request you sent that has not been answered. */
export async function cancelRequest(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown request.");

  const deleted = await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.id, parsed.data.id),
        eq(friendships.requesterId, me.id),
        eq(friendships.status, "pending"),
      ),
    )
    .returning({ id: friendships.id });

  if (deleted.length === 0) return fail("That request is no longer waiting.", "NOT_FOUND");

  revalidateFriends();
  return ok(undefined);
}

/** End a friendship. Both of you stop seeing each other's statistics at once. */
export async function unfriend(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = unfriendSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown friend.");

  const deleted = await db
    .delete(friendships)
    .where(and(pair(me.id, parsed.data.friendId), eq(friendships.status, "accepted")))
    .returning({ id: friendships.id });

  if (deleted.length === 0) return fail("You are not friends with that person.", "NOT_FOUND");

  revalidateFriends();
  return ok(undefined);
}

/** What your friends may see. */
export async function updateSharing(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = sharingSchema.safeParse(input);
  if (!parsed.success) return fail("Those sharing settings do not look right.");

  await db.update(userSettings).set(parsed.data).where(eq(userSettings.userId, me.id));

  revalidateFriends();
  revalidatePath("/settings");
  return ok(undefined);
}

/** Choose or change your username. Taken names are refused, case-insensitively. */
export async function setUsername(input: unknown): Promise<ActionResult<string>> {
  const me = await requireUser();
  const parsed = z.object({ username: usernameSchema }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That username will not work.");
  const { username } = parsed.data;

  try {
    await db.update(users).set({ username }).where(eq(users.id, me.id));
  } catch (error) {
    if (isUniqueViolation(error) && violatedConstraint(error)?.includes("username")) {
      return fail(`@${username} is taken. Try another.`, "TAKEN");
    }
    throw error;
  }

  revalidateFriends();
  revalidatePath("/settings");
  return ok(username);
}

/** Pick a built-in animal avatar, or null to go back to your Google photo. */
export async function setAvatar(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = z.object({ avatar: z.enum(ANIMAL_AVATAR_IDS).nullable() }).safeParse(input);
  if (!parsed.success) return fail("Pick one of the avatars shown.");

  await db.update(users).set({ avatar: parsed.data.avatar }).where(eq(users.id, me.id));
  // Avatars show in the sidebar on every page, not just on Friends.
  revalidatePath("/", "layout");
  return ok(undefined);
}

const cheerSchema = z.object({ friendId: z.string().min(1).max(100), kind: z.enum(CHEER_KINDS) });

/** Send a friend a 👏 or 🔥. Friends only, once per three hours per friend. */
export async function sendCheer(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = cheerSchema.safeParse(input);
  if (!parsed.success) return fail("Pick a cheer to send.");
  const { friendId, kind } = parsed.data;

  const [friendship] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(pair(me.id, friendId), eq(friendships.status, "accepted")))
    .limit(1);
  if (!friendship) return fail("You can only cheer your friends.", "NOT_FOUND");

  const [last] = await db
    .select({ createdAt: cheers.createdAt })
    .from(cheers)
    .where(and(eq(cheers.fromUserId, me.id), eq(cheers.toUserId, friendId)))
    .orderBy(desc(cheers.createdAt))
    .limit(1);
  const wait = cheerWaitMs(last?.createdAt ?? null, Date.now());
  if (wait > 0) {
    const [friend] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, friendId)).limit(1);
    return fail(
      `You cheered ${friend ? displayName(friend) : "them"} recently. You can again in ${describeWait(wait)}.`,
      "COOLDOWN",
    );
  }

  await db.insert(cheers).values({ fromUserId: me.id, toUserId: friendId, kind });
  after(() => notifyCheer(me.id, friendId, kind));
  return ok(undefined);
}

/** The Friends page was opened: the cheers waiting there have been seen. */
export async function markCheersSeen(): Promise<ActionResult> {
  const me = await requireUser();
  await db
    .update(cheers)
    .set({ seenAt: new Date() })
    .where(and(eq(cheers.toUserId, me.id), isNull(cheers.seenAt)));
  return ok(undefined);
}

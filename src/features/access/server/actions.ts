"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { allowedEmails } from "@/db/schema";
import { inviteSchema } from "@/features/access/schema";
import { signOutEverywhere } from "@/features/access/server/check";
import { isOwnerEmail } from "@/lib/access";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireUser } from "@/lib/auth-guard";

const NOT_OWNER = "Only an owner can change who has access.";

/**
 * Both actions authorise themselves: Server Actions are reachable by direct
 * POST, so hiding the Access section from non-owners is not protection.
 */
async function requireOwnerId(): Promise<string | null> {
  const user = await requireUser();
  return isOwnerEmail(user.email) ? user.id : null;
}

export async function inviteEmail(input: unknown): Promise<ActionResult<string>> {
  const ownerId = await requireOwnerId();
  if (!ownerId) return fail(NOT_OWNER, "FORBIDDEN");

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
  }
  const { email } = parsed.data;

  if (isOwnerEmail(email)) return fail("That address is an owner and always has access.");

  const inserted = await db
    .insert(allowedEmails)
    .values({ email, invitedBy: ownerId })
    .onConflictDoNothing()
    .returning({ email: allowedEmails.email });

  if (inserted.length === 0) return fail("That address is already invited.", "DUPLICATE");

  revalidatePath("/settings");
  return ok(email);
}

/**
 * Revoke access and sign the person out on every device. Their tracks,
 * sessions and tasks are kept, so inviting them again restores everything.
 */
export async function removeInvite(input: unknown): Promise<ActionResult<string>> {
  const ownerId = await requireOwnerId();
  if (!ownerId) return fail(NOT_OWNER, "FORBIDDEN");

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return fail("Unknown address.");
  const { email } = parsed.data;

  const deleted = await db
    .delete(allowedEmails)
    .where(eq(allowedEmails.email, email))
    .returning({ email: allowedEmails.email });

  if (deleted.length === 0) return fail("That address was not on the list.", "NOT_FOUND");

  await signOutEverywhere(email);

  revalidatePath("/settings");
  return ok(email);
}

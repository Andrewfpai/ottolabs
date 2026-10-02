"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { allowedEmails, inviteLinks } from "@/db/schema";
import { INVITE_EXPIRY_OPTIONS } from "@/features/access/lib/invite-links";
import { inviteSchema } from "@/features/access/schema";
import { signOutEverywhere } from "@/features/access/server/check";
import { hashInviteToken, newInviteToken } from "@/features/access/server/invite-links";
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

const inviteLinkSchema = z.object({
  label: z.string().trim().min(1, "Say who it is for").max(40, "Keep the name under 40 characters"),
  hours: z.number().refine((h) => INVITE_EXPIRY_OPTIONS.some((o) => o.hours === h), "Pick how long it lasts"),
});

/**
 * Make a one-time invite link. The token is returned once, here, and only
 * its hash is kept: lose the link and you make another.
 */
export async function createInviteLink(input: unknown): Promise<ActionResult<{ token: string }>> {
  const ownerId = await requireOwnerId();
  if (!ownerId) return fail(NOT_OWNER, "FORBIDDEN");
  const parsed = inviteLinkSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the name and expiry.");

  const token = newInviteToken();
  await db.insert(inviteLinks).values({
    tokenHash: hashInviteToken(token),
    label: parsed.data.label,
    createdBy: ownerId,
    expiresAt: new Date(Date.now() + parsed.data.hours * 3_600_000),
  });

  revalidatePath("/settings");
  return ok({ token });
}

/** Withdraw an unused link, or tidy away a used or expired one. Access already granted stays. */
export async function deleteInviteLink(input: unknown): Promise<ActionResult> {
  const ownerId = await requireOwnerId();
  if (!ownerId) return fail(NOT_OWNER, "FORBIDDEN");
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Unknown link.");

  await db.delete(inviteLinks).where(eq(inviteLinks.id, parsed.data.id));
  revalidatePath("/settings");
  return ok(undefined);
}

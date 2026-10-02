/**
 * Usernames: how friends find each other without sharing an email address.
 * Pure, so the rules are tested and the client and server apply the same ones.
 */
import { z } from "zod";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
/** Lowercase letters, digits and underscores. Mirrored by a check constraint on `users`. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/** "@Andrew_P " → "andrew_p". A leading @ is how people write usernames, so it is accepted. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .min(USERNAME_MIN, `At least ${USERNAME_MIN} characters`)
      .max(USERNAME_MAX, `At most ${USERNAME_MAX} characters`)
      .regex(USERNAME_PATTERN, "Use only letters, numbers and underscores"),
  );

export type FriendHandle = { kind: "email"; email: string } | { kind: "username"; username: string };

/**
 * What was typed into "Add a friend": an email if it has an @ after the first
 * character, otherwise a username. Null when it is neither.
 */
export function parseFriendHandle(raw: string): FriendHandle | null {
  const value = raw.trim();
  if (value.indexOf("@") > 0) {
    const email = z.email().safeParse(value.toLowerCase());
    return email.success ? { kind: "email", email: email.data } : null;
  }
  const username = usernameSchema.safeParse(value);
  return username.success ? { kind: "username", username: username.data } : null;
}

/** A starting suggestion from the email's local part: "Andrew.F.Pai+x@…" → "andrew_f_pai". */
export function suggestUsername(email: string): string {
  const base = email
    .split("@")[0]
    .split("+")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, USERNAME_MAX);
  return base.length >= USERNAME_MIN ? base : `${base}_user`.slice(0, USERNAME_MAX);
}

/**
 * Deletes your tracks, focus sessions and tasks — but not your account.
 *
 * Use this to strip seed data out of a branch you intend to use for real.
 * Signing in again is not required afterwards: the `users`, `accounts` and
 * Auth.js `sessions` rows are left alone.
 *
 *   npm run db:clear          show what would be deleted, delete nothing
 *   npm run db:clear -- --yes actually delete
 *
 * It acts on whatever DATABASE_URL currently points at, and prints the endpoint
 * before doing anything, because "which branch am I connected to" is exactly
 * the thing you are most likely to get wrong here.
 */
import { eq, sql } from "drizzle-orm";

import { db } from "./index";
import { focusSessions, tasks, tracks, users } from "./schema";

const CONFIRMED = process.argv.includes("--yes");

async function main() {
  const endpoint = new URL(process.env.DATABASE_URL!).hostname.split(".")[0];
  console.log(`\nEndpoint: ${endpoint}`);

  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const user = allowed.length
    ? await db.query.users.findFirst({ where: eq(users.email, allowed[0]) })
    : await db.query.users.findFirst();

  if (!user) {
    console.log("No user row on this branch. Nothing to clear.\n");
    return;
  }

  const [counts] = await db
    .select({
      sessions: sql<number>`(select count(*)::int from ${focusSessions} where user_id = ${user.id})`,
      tasks: sql<number>`(select count(*)::int from ${tasks} where user_id = ${user.id})`,
      tracks: sql<number>`(select count(*)::int from ${tracks} where user_id = ${user.id})`,
    })
    .from(users)
    .where(eq(users.id, user.id));

  console.log(`User:     ${user.email}`);
  console.log(
    `Would delete: ${counts.sessions} sessions, ${counts.tasks} tasks, ${counts.tracks} tracks`,
  );
  console.log("Keeping:      your account, OAuth tokens and login sessions");

  if (!CONFIRMED) {
    console.log("\nDry run. Re-run with --yes to actually delete.\n");
    return;
  }

  // Order matters: focus_sessions references tracks with ON DELETE RESTRICT,
  // so the sessions have to go before the tracks they point at.
  await db.transaction(async (tx) => {
    await tx.delete(focusSessions).where(eq(focusSessions.userId, user.id));
    await tx.delete(tasks).where(eq(tasks.userId, user.id));
    await tx.delete(tracks).where(eq(tracks.userId, user.id));
  });

  console.log("\nCleared.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

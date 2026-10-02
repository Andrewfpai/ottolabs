/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Single-user by design: only addresses in ALLOWED_EMAILS may sign in, but the
 * schema is multi-user throughout (`user_id` on every table), so opening it up
 * later is a config change rather than a migration.
 *
 * Route protection lives in `src/app/(app)/layout.tsx`, not in `proxy.ts`.
 * The Next.js docs are explicit that proxy (formerly middleware) is for
 * optimistic checks, not session management.
 */
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { db } from "@/db";
import {
  accounts,
  authenticators,
  sessions,
  userSettings,
  users,
  verificationTokens,
} from "@/db/schema";

function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),

  // Database sessions rather than JWT: we want the `accounts` row (and its
  // Google refresh_token) to be the durable record, ready for Calendar in v1.1.
  session: { strategy: "database" },

  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },

  providers: [
    Google({
      authorization: {
        params: {
          // `offline` + `consent` is what actually guarantees a refresh_token.
          // Google only returns one on the first consent unless you force it,
          // and without it the v1.1 Calendar sync has nothing to refresh with.
          access_type: "offline",
          prompt: "consent",
          response_type: "code",
          scope: "openid email profile",
        },
      },
    }),
  ],

  callbacks: {
    signIn({ user }) {
      const allowed = allowedEmails();

      if (allowed.length === 0) {
        // Fail closed. An unset allowlist must not mean "the internet may log in".
        console.error(
          "[auth] ALLOWED_EMAILS is empty, so every sign-in is rejected. " +
            "Set it in .env.local to your Google address.",
        );
        return false;
      }

      return Boolean(user.email && allowed.includes(user.email.toLowerCase()));
    },

    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      if (!user.id) return;
      // Every user needs a settings row; creating it here means no other code
      // path has to defend against it being missing.
      await db.insert(userSettings).values({ userId: user.id }).onConflictDoNothing();
    },
  },
});

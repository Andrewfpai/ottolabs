/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Invite-only. Owners are named in ALLOWED_EMAILS; anyone else must be on the
 * invite list owners manage in Settings → Access (`allowed_emails`). Every
 * table carries `user_id`, so each person gets their own separate data.
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
import { pictureFor } from "@/lib/avatars";
import { hasAccess } from "@/features/access/server/check";
import { ownerEmails } from "@/lib/access";

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
    async signIn({ user }) {
      if (ownerEmails().length === 0) {
        // Fail closed for owners. An unset ALLOWED_EMAILS must not mean "the
        // internet may log in"; invited addresses can still get in.
        console.error(
          "[auth] ALLOWED_EMAILS is empty, so nobody is an owner. " +
            "Set it to your Google address in .env.local and in Vercel.",
        );
      }
      // Owners from the environment, everyone else from the invite list.
      return hasAccess(user.email);
    },

    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // The adapter loads the whole users row, our columns included.
        const own = user as { avatar?: string | null; accessories?: string[] };
        session.user.image = pictureFor(own.avatar, user.image, own.accessories ?? []);
      }
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

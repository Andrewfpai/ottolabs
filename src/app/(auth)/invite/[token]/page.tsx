import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE_S, looksLikeInviteToken } from "@/features/access/lib/invite-links";
import { peekInvite } from "@/features/access/server/invite-links";
import { auth, signIn } from "@/lib/auth";

export const metadata: Metadata = { title: "You are invited" };

/**
 * Where an invite link lands. Signing in from here carries the token through
 * Google in a short-lived cookie; the sign-in callback spends it on whichever
 * Google account comes back.
 */
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const invite = await peekInvite(token);

  async function acceptInvite() {
    "use server";
    // Checked again here: the page may have sat open past the expiry.
    if (!looksLikeInviteToken(token) || !(await peekInvite(token))) redirect(`/invite/${token}`);
    (await cookies()).set(INVITE_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: INVITE_COOKIE_MAX_AGE_S,
    });
    await signIn("google", { redirectTo: "/dashboard" });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 space-y-3 text-center">
          <div
            aria-hidden
            className="bg-primary/10 ring-primary/20 mx-auto flex size-12 items-center justify-center rounded-2xl ring-1"
          >
            <span className="text-primary font-numeric text-lg font-semibold">OL</span>
          </div>
          {invite ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">You are invited to OttoLabs</h1>
              <p className="text-muted-foreground text-sm text-balance">
                {invite.from} made this link for <span className="text-foreground font-medium">{invite.label}</span>.
                Sign in with any Google account to join. The link works once.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">This invite has run out</h1>
              <p className="text-muted-foreground text-sm text-balance">
                It was already used, or it expired. Ask whoever sent it for a new link.
              </p>
            </>
          )}
        </div>

        {invite ? (
          <form action={acceptInvite}>
            <GoogleSignInButton />
          </form>
        ) : (
          <p className="text-center text-sm">
            <Link href="/sign-in" className="underline underline-offset-4">
              Already have access? Sign in
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

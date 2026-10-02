import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getActiveSession } from "@/features/sessions/server/queries";
import { TimezoneSync } from "@/features/settings/components/timezone-sync";
import { signOut } from "@/lib/auth";
import { requireSettings, requireUser } from "@/lib/auth-guard";

/**
 * Every authenticated route lives under this layout, which is where access is
 * enforced. Next.js documents proxy (formerly middleware) as unsuitable for
 * session management, so the check happens here, on the server, per request.
 *
 * This does NOT protect Server Actions — those are reachable by direct POST
 * and must each call `requireUser()` themselves.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [settings, activeSession] = await Promise.all([
    requireSettings(),
    getActiveSession(),
  ]);

  async function signOutAction() {
    "use server";
    await signOut({ redirect: false });
    redirect("/sign-in");
  }

  return (
    <AppShell
      user={user}
      signOutAction={signOutAction}
      activeSession={activeSession}
    >
      <TimezoneSync currentTimezone={settings.timezone} />
      {children}
    </AppShell>
  );
}

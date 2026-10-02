import type { Metadata } from "next";

import { FocusScreen } from "@/features/sessions/components/focus-screen";
import { getActiveSession } from "@/features/sessions/server/queries";

export const metadata: Metadata = { title: "Focus" };

/**
 * Fullscreen distraction-free timer.
 *
 * Not in the sidebar: it is a mode you enter from a running timer, not a place
 * you browse to. Arriving here with nothing running is still handled — the
 * screen offers to start something — because the URL is bookmarkable whatever
 * we intend.
 *
 * The session is read on the server so the timer is correct in the very first
 * paint, rather than flashing empty while a fetch resolves.
 */
export default async function FocusPage() {
  const session = await getActiveSession();

  return <FocusScreen initial={session} />;
}

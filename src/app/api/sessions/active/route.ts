import { getActiveSession } from "@/features/sessions/server/queries";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * The live session, polled by the timer bar.
 *
 * A GET route rather than a Server Action so TanStack Query can refetch it on
 * window focus — that is what keeps a second tab from showing a timer that was
 * stopped somewhere else.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ session: null }, { status: 401 });
  }

  const active = await getActiveSession();

  return Response.json(
    { session: active, serverNow: Date.now() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

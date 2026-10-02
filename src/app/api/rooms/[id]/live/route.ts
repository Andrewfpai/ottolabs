import { getRoomLive } from "@/features/rooms/server/queries";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Polled by an open room page every ~10 seconds. A GET route rather than a
 * Server Action so TanStack Query can refetch it on an interval and on focus.
 * Same membership gate and same payload as the page's first render, so the
 * two never disagree; anyone not joined gets a 404.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/rooms/[id]/live">) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });

  const { id } = await ctx.params;
  const live = await getRoomLive(id, session.user.id);
  if (!live) return new Response(null, { status: 404 });

  return Response.json(live, { headers: { "Cache-Control": "no-store, private" } });
}

/**
 * Server clock, for browser clock-skew correction. See `src/lib/time/clock.ts`.
 *
 * Deliberately unauthenticated and trivial: it leaks nothing, and the timer
 * needs it before anything else on the page is useful.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { now: Date.now() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

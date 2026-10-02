import { PageContainer } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while a page's data loads. The sidebar and the timer bar live in the
 * layout above this boundary, so they stay put and the running timer keeps
 * ticking; only the page body is stood in for. Shaped like the common page —
 * a header, a row of cards, a list — so the real content lands without a jump.
 */
export default function Loading() {
  return (
    <PageContainer>
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading…</span>

        <div className="mb-6 space-y-2 sm:mb-8" aria-hidden>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>

        <div className="mt-4 space-y-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

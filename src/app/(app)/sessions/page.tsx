import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SessionFiltersBar } from "@/features/sessions/components/session-filters";
import { SessionsTable } from "@/features/sessions/components/sessions-table";
import { hasFilters, parseSessionFilters, sessionsHref } from "@/features/sessions/lib/filters";
import { getMyTags } from "@/features/sessions/server/actions";
import { getSessions } from "@/features/sessions/server/queries";
import { getStartableTracks, getTrackOptions } from "@/features/tracks/server/queries";
import { requireSettings } from "@/lib/auth-guard";
import { elapsedMs, formatCompact } from "@/lib/time/elapsed";

export const metadata: Metadata = { title: "Sessions" };

const PAGE_SIZE = 25;

export default async function SessionsPage({ searchParams }: PageProps<"/sessions">) {
  const params = await searchParams;
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const filters = parseSessionFilters(params);
  const filtered = hasFilters(filters);

  const [{ sessions, total, pageCount }, startable, allTracks, tags, settings] = await Promise.all([
    getSessions({ page, pageSize: PAGE_SIZE, filters }),
    getStartableTracks(),
    getTrackOptions(),
    getMyTags(),
    requireSettings(),
  ]);

  const pageFocusMs = sessions.reduce((sum, s) => sum + elapsedMs(s), 0);
  const noun = total === 1 ? "session" : "sessions";

  return (
    <PageContainer>
      <PageHeader
        title="Sessions"
        description={
          total > 0
            ? `${total} ${filtered ? `${noun} match` : "logged"}. ${formatCompact(pageFocusMs)} on this page.`
            : "Every focus session you have logged, newest first."
        }
      />

      <SessionFiltersBar filters={filters} tracks={allTracks} tags={tags} />

      {filtered && total === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No sessions match"
          description="Try a wider date range, another track or tag, or different words."
          action={
            <Button asChild variant="outline" className="cursor-pointer">
              <Link href="/sessions">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <SessionsTable sessions={sessions} tracks={startable} timeZone={settings.timezone} />
      )}

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
          <Button variant="outline" asChild={page > 1} disabled={page <= 1} className="cursor-pointer">
            {page > 1 ? <Link href={sessionsHref(filters, page - 1)}>Newer</Link> : <span>Newer</span>}
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            asChild={page < pageCount}
            disabled={page >= pageCount}
            className="cursor-pointer"
          >
            {page < pageCount ? (
              <Link href={sessionsHref(filters, page + 1)}>Older</Link>
            ) : (
              <span>Older</span>
            )}
          </Button>
        </nav>
      ) : null}
    </PageContainer>
  );
}

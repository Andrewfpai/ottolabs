import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SessionsTable } from "@/features/sessions/components/sessions-table";
import { getSessions } from "@/features/sessions/server/queries";
import { getStartableTracks } from "@/features/tracks/server/queries";
import { requireSettings } from "@/lib/auth-guard";
import { formatCompact } from "@/lib/time/elapsed";
import { elapsedMs } from "@/lib/time/elapsed";

export const metadata: Metadata = { title: "Sessions" };

const PAGE_SIZE = 25;

export default async function SessionsPage({
  searchParams,
}: PageProps<"/sessions">) {
  const params = await searchParams;
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;

  const [{ sessions, total, pageCount }, tracks, settings] = await Promise.all([
    getSessions({ page, pageSize: PAGE_SIZE }),
    getStartableTracks(),
    requireSettings(),
  ]);

  const pageFocusMs = sessions.reduce((sum, s) => sum + elapsedMs(s), 0);

  return (
    <PageContainer>
      <PageHeader
        title="Sessions"
        description={
          total > 0
            ? `${total} logged. ${formatCompact(pageFocusMs)} on this page.`
            : "Every focus session you have logged, newest first."
        }
      />

      <SessionsTable
        sessions={sessions}
        tracks={tracks}
        timeZone={settings.timezone}
      />

      {pageCount > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-4 flex items-center justify-between"
        >
          <Button
            variant="outline"
            asChild={page > 1}
            disabled={page <= 1}
            className="cursor-pointer"
          >
            {page > 1 ? <Link href={`/sessions?page=${page - 1}`}>Newer</Link> : <span>Newer</span>}
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
              <Link href={`/sessions?page=${page + 1}`}>Older</Link>
            ) : (
              <span>Older</span>
            )}
          </Button>
        </nav>
      ) : null}
    </PageContainer>
  );
}

import { ArrowLeft, ListTodo } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-header";
import { TrackIcon } from "@/components/track-icon";
import { Badge } from "@/components/ui/badge";
import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { StatTile } from "@/features/analytics/components/panels";
import { parseRangeKey } from "@/features/analytics/lib/compute";
import { sessionsHref } from "@/features/sessions/lib/filters";
import { TrackActions } from "@/features/tracks/components/track-actions";
import { TrackNotes } from "@/features/tracks/components/track-notes";
import { getTrackDetail, NOTES_PAGE_SIZE } from "@/features/tracks/server/queries";
import { requireSettings } from "@/lib/auth-guard";
import { dayKey, formatDayKey } from "@/lib/time/calendar-day";
import { formatCompact, MINUTE_MS } from "@/lib/time/elapsed";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Track" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TrackPage({ params, searchParams }: PageProps<"/tracks/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const rangeKey = parseRangeKey(first(query.range));
  const notesPage = Math.max(1, Number(first(query.notes)) || 1);

  // Null for someone else's track and for made-up ids alike.
  const [detail, settings] = await Promise.all([getTrackDetail(id, rangeKey, notesPage), requireSettings()]);
  if (!detail) notFound();

  const { track, analytics, weekMs, notes, notesTotal, openTasks } = detail;
  const colors = trackColorClasses(track.color);
  const basePath = `/tracks/${track.id}`;
  const targetMs = track.targetMinutesPerWeek ? track.targetMinutesPerWeek * MINUTE_MS : null;

  const notesHref = (page: number) => {
    const params = new URLSearchParams();
    if (rangeKey !== "30d") params.set("range", rangeKey);
    if (page > 1) params.set("notes", String(page));
    const q = params.toString();
    return q ? `${basePath}?${q}#track-notes` : `${basePath}#track-notes`;
  };

  return (
    <PageContainer>
      <Link
        href="/tracks"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tracks
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", colors.surface, colors.text)}>
            <TrackIcon name={track.icon} className="size-6" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">{track.title}</h1>
              {track.status !== "active" ? (
                <Badge variant="outline" className="capitalize">
                  {track.status}
                </Badge>
              ) : null}
            </div>
            {track.description ? (
              <p className="text-muted-foreground mt-1 max-w-[65ch] text-sm">{track.description}</p>
            ) : null}
          </div>
        </div>
        <TrackActions track={track} />
      </div>

      {/*
        Only what the range-based analytics below do not already show: the
        all-time total and this week against the target.
      */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatTile
          label="All-time focus"
          value={formatCompact(track.totalMs)}
          detail={`${track.sessionCount} ${track.sessionCount === 1 ? "session" : "sessions"}${
            track.lastActiveAt
              ? ` · last ${formatDayKey(dayKey(track.lastActiveAt, settings.timezone), { day: "numeric", month: "short" })}`
              : ""
          }`}
        />
        <StatTile
          label="This week"
          value={formatCompact(weekMs)}
          detail={
            targetMs
              ? `of ${formatCompact(targetMs)} target · ${Math.round((weekMs / targetMs) * 100)}%`
              : "No weekly target set"
          }
        />
      </div>

      <AnalyticsView data={analytics} basePath={basePath} scope="track" />

      <div className="mt-4 space-y-4">
        <TrackNotes
          notes={notes}
          total={notesTotal}
          page={notesPage}
          pageSize={NOTES_PAGE_SIZE}
          timeZone={settings.timezone}
          hrefForPage={notesHref}
        />

        <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href={sessionsHref({ track: track.id })} className="hover:text-foreground underline-offset-4 hover:underline">
            All sessions on this track
          </Link>
          <Link
            href={`/tasks?track=${track.id}`}
            className="hover:text-foreground inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            <ListTodo className="size-4" aria-hidden />
            {openTasks} open {openTasks === 1 ? "task" : "tasks"}
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}

/**
 * The non-Recharts pieces of the analytics page. Server-rendered: none of them
 * need the browser.
 */
import Link from "next/link";

import type { TaskStats } from "@/features/analytics/lib/metrics";
import {
  ANALYTICS_RANGES,
  type AnalyticsRangeKey,
  type TrackFocus,
} from "@/features/analytics/lib/compute";
import { PRIORITY_META } from "@/features/tasks/lib/labels";
import { formatCompact } from "@/lib/time/elapsed";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

export function RangeFilter({ current }: { current: AnalyticsRangeKey }) {
  return (
    <nav aria-label="Date range" className="flex w-fit rounded-lg border p-0.5">
      {(Object.keys(ANALYTICS_RANGES) as AnalyticsRangeKey[]).map((key) => (
        <Link
          key={key}
          href={key === "30d" ? "/analytics" : `/analytics?range=${key}`}
          aria-current={key === current ? "page" : undefined}
          scroll={false}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            key === current ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {ANALYTICS_RANGES[key].label}
        </Link>
      ))}
    </nav>
  );
}

/** Label, value, and an optional line of context. */
export function StatTile({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn("bg-card rounded-xl border p-4", className)}>
      <div className="text-muted-foreground text-xs">{label}</div>
      {/* Proportional figures: a lone large number looks loose in tabular ones. */}
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {detail ? <div className="text-muted-foreground mt-0.5 text-xs">{detail}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  aside,
  className,
  children,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("bg-card min-w-0 rounded-xl border p-4 sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
          ) : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Every chart's plain-table twin. Tooltips enhance, they never gate: a value
 * you can only read by hovering is a value a keyboard or screen-reader user
 * cannot read at all.
 */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: [string, string];
  rows: [string, string][];
}) {
  return (
    <details className="group mt-3">
      <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer text-xs">
        Show as table
      </summary>
      <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border">
        <table className="w-full text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th scope="col" className="px-3 py-1.5 text-left font-medium">
                {columns[0]}
              </th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">
                {columns[1]}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([a, b]) => (
              <tr key={a} className="border-t">
                <td className="px-3 py-1">{a}</td>
                <td className="tabular px-3 py-1 text-right">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Horizontal bars, each named in text beside it. Track colours are chosen per
 * track and several pairs are hard to tell apart for colour-blind readers, so
 * the colour here is a reminder of the track card, never the only label.
 */
export function TrackBreakdown({ tracks }: { tracks: TrackFocus[] }) {
  if (tracks.length === 0) {
    return <p className="text-muted-foreground text-sm">No focus logged in this range.</p>;
  }
  const max = tracks[0].ms;

  return (
    <ul className="space-y-3">
      {tracks.map((track) => (
        <li key={track.trackId}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{track.title}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              <span className="text-foreground tabular font-medium">
                {formatCompact(track.ms)}
              </span>{" "}
              · {Math.round(track.share * 100)}%
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className={cn("h-full rounded-full", trackColorClasses(track.color).bg)}
              style={{ width: `${Math.max(2, (track.ms / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TaskSummary({ stats }: { stats: TaskStats }) {
  const withDeadline = stats.onTime + stats.late;
  const onTimeRate = withDeadline > 0 ? Math.round((stats.onTime / withDeadline) * 100) : null;
  const open = stats.openByPriority.p1 + stats.openByPriority.p2 + stats.openByPriority.p3;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-muted-foreground text-xs">Completed</dt>
          <dd className="text-xl font-semibold">{stats.completed}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Added</dt>
          <dd className="text-xl font-semibold">{stats.created}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">On time</dt>
          <dd className="text-xl font-semibold">{onTimeRate === null ? "—" : `${onTimeRate}%`}</dd>
        </div>
      </dl>
      <p className="text-muted-foreground text-xs">
        {withDeadline > 0
          ? `${stats.onTime} of ${withDeadline} tasks with a deadline were finished by it.`
          : "No tasks with a deadline were finished in this range."}
      </p>
      <div>
        <div className="text-muted-foreground mb-1.5 text-xs">Open now · {open}</div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {(["p1", "p2", "p3"] as const).map((p) => (
            <li key={p} className="flex items-center gap-1.5">
              <span className={cn("text-xs", PRIORITY_META[p].className)}>●</span>
              {PRIORITY_META[p].label}
              <span className="font-medium">{stats.openByPriority[p]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { ChartNoAxesColumn, Lightbulb } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { HourChart, LengthChart, TrendChart, TrendLegend } from "@/features/analytics/components/charts";
import { FocusHeatmap } from "@/features/analytics/components/focus-heatmap";
import {
  DataTable,
  Panel,
  RangeFilter,
  StatTile,
  TaskSummary,
  TrackBreakdown,
} from "@/features/analytics/components/panels";
import { ANALYTICS_RANGES, type AnalyticsData } from "@/features/analytics/lib/compute";
import { formatHour, MIN_SESSIONS_FOR_INSIGHTS } from "@/features/analytics/lib/insights";
import { formatDayKey } from "@/lib/time/calendar-day";
import { formatCompact } from "@/lib/time/elapsed";

/** Everything under the page header, driven entirely by `data`. */
export function AnalyticsView({ data }: { data: AnalyticsData }) {
  const { kpis, streaks, trend } = data;
  const rangeLabel = ANALYTICS_RANGES[data.rangeKey].label.toLowerCase();

  const dayStartNote =
    data.dayStartHour > 0
      ? `Days run from ${formatHour(data.dayStartHour)}, so late-night work counts toward the evening before.`
      : "Days run midnight to midnight.";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <RangeFilter current={data.rangeKey} />
        <p className="text-muted-foreground text-xs">
          {data.timeZone.replace(/_/g, " ")} · {dayStartNote}
        </p>
      </div>

      {kpis.sessionCount === 0 && kpis.totalMs === 0 ? (
        <EmptyState
          icon={ChartNoAxesColumn}
          title={`Nothing logged in the last ${rangeLabel}`}
          description="Start a timer from Tracks, or pick a longer range. Finished sessions show up here; one that is still running joins in when you finish it."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile
              label="Total focus"
              value={formatCompact(kpis.totalMs)}
              detail={`over ${kpis.days} days`}
            />
            <StatTile label="Sessions" value={String(kpis.sessionCount)} />
            <StatTile
              label="Typical session"
              value={data.medianSessionMs ? formatCompact(data.medianSessionMs) : "—"}
              detail={kpis.sessionCount ? `mean ${formatCompact(kpis.averageSessionMs)}` : undefined}
            />
            <StatTile
              label="Days with focus"
              value={`${kpis.activeDays} of ${kpis.days}`}
              detail={
                kpis.bestDay
                  ? `best: ${formatCompact(kpis.bestDay.ms)} on ${formatDayKey(kpis.bestDay.day, { day: "numeric", month: "short" })}`
                  : undefined
              }
            />
            <StatTile
              // Five tiles in two columns leave this one alone on its row.
              className="max-lg:col-span-2"
              label="Current streak"
              value={`${streaks.current} ${streaks.current === 1 ? "day" : "days"}`}
              detail={`longest ${streaks.longest}`}
            />
          </div>

          <Panel title="What stands out">
            {data.insights.length > 0 ? (
              <ul className="space-y-2">
                {data.insights.map((insight) => (
                  <li key={insight.id} className="flex gap-2.5 text-sm">
                    <Lightbulb className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                    {insight.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Patterns appear once there are at least {MIN_SESSIONS_FOR_INSIGHTS} sessions in
                the range. Until then any “peak hour” would be noise.
              </p>
            )}
          </Panel>

          <Panel
            title={trend.kind === "daily" ? "Focus per day" : "Focus per week"}
            description={trend.kind === "daily" ? undefined : "Weekly totals; a year of daily bars is unreadable."}
            aside={trend.kind === "daily" ? <TrendLegend /> : null}
          >
            <TrendChart trend={trend} />
            <DataTable
              caption={trend.kind === "daily" ? "Focus per day" : "Focus per week"}
              columns={[trend.kind === "daily" ? "Day" : "Week of", "Focus"]}
              rows={
                trend.kind === "daily"
                  ? trend.points.map((p) => [
                      formatDayKey(p.day, { weekday: "short", day: "numeric", month: "short" }),
                      formatCompact(p.ms),
                    ])
                  : trend.points.map((p) => [
                      formatDayKey(p.weekStart, { day: "numeric", month: "short", year: "numeric" }),
                      formatCompact(p.ms),
                    ])
              }
            />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="When you focus"
              description={
                data.peak
                  ? `Peak window ${formatHour(data.peak.startHour)}–${formatHour(data.peak.endHour)}, highlighted.`
                  : "Total focus in each hour of the day."
              }
            >
              <HourChart hours={data.hours} peak={data.peak} />
              <DataTable
                caption="Focus by hour of day"
                columns={["Hour", "Focus"]}
                rows={data.hours.map((ms, hour) => [
                  `${formatHour(hour)}–${formatHour((hour + 1) % 24)}`,
                  formatCompact(ms),
                ])}
              />
            </Panel>

            <Panel title="Where the hours went" description={`Share of focus in the last ${rangeLabel}.`}>
              <TrackBreakdown tracks={data.tracks} />
            </Panel>
          </div>

          <Panel title="The last year" description="Each square is a day.">
            <FocusHeatmap
              start={data.heatmap.start}
              end={data.heatmap.end}
              byDay={data.heatmap.byDay}
            />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Session lengths"
              description="Many short sessions, or a few long ones?"
            >
              <LengthChart lengths={data.lengths} />
              <DataTable
                caption="Sessions by length"
                columns={["Length", "Sessions"]}
                rows={data.lengths.map((b) => [b.label, String(b.count)])}
              />
            </Panel>

            <Panel title="Tasks" description={`Finished and added in the last ${rangeLabel}.`}>
              <TaskSummary stats={data.tasks} />
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

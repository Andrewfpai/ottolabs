"use client";

/**
 * The Recharts-drawn charts. Shared spec, from the data-viz guidelines:
 * bars ≤ 24px with a 4px rounded data end, 2px lines, solid hairline grid,
 * one hue. A second hue never appears here — where one thing matters (the
 * peak window) it is emphasis: the accent on those bars, muted on the rest.
 */
import { useReducedMotion } from "motion/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer } from "@/components/ui/chart";
import { formatHour } from "@/features/analytics/lib/insights";
import type { DayPoint, LengthBucket, PeakWindow, WeekPoint } from "@/features/analytics/lib/metrics";
import { formatDayKey } from "@/lib/time/calendar-day";
import { formatCompact, HOUR_MS } from "@/lib/time/elapsed";

const ACCENT = "var(--primary)";
const MUTED = "var(--muted-foreground)";
const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

const hoursTick = (value: number) => (value === 0 ? "0" : `${Number(value.toFixed(1))}h`);

type ReadoutRow = { label: string; value: string; color?: string; line?: boolean };

/** Value first, label second — the reader already knows the series. */
function Readout({ title, rows }: { title: string; rows: ReadoutRow[] }) {
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
      <div className="text-muted-foreground mb-1">{title}</div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          {row.color ? (
            <span
              aria-hidden
              className={row.line ? "h-0.5 w-3 rounded-full" : "size-2 rounded-sm"}
              style={{ background: row.color }}
            />
          ) : null}
          <span className="tabular text-foreground font-semibold">{row.value}</span>
          <span className="text-muted-foreground">{row.label}</span>
        </div>
      ))}
    </div>
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11 },
} as const;

export function TrendChart({
  trend,
}: {
  trend: { kind: "daily"; points: DayPoint[] } | { kind: "weekly"; points: WeekPoint[] };
}) {
  const reduceMotion = useReducedMotion();

  type TrendDatum = { key: string; label: string; hours: number; average?: number };
  const data: TrendDatum[] =
    trend.kind === "daily"
      ? trend.points.map((p) => ({
          key: p.day,
          label: formatDayKey(p.day, { day: "numeric", month: "short" }),
          hours: p.ms / HOUR_MS,
          average: p.averageMs / HOUR_MS,
        }))
      : trend.points.map((p) => ({
          key: p.weekStart,
          label: formatDayKey(p.weekStart, { day: "numeric", month: "short" }),
          hours: p.ms / HOUR_MS,
        }));

  return (
    <ChartContainer config={{}} className="aspect-auto h-60 w-full">
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" {...axisProps} minTickGap={24} interval="preserveStartEnd" />
        <YAxis {...axisProps} tickFormatter={hoursTick} width={44} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={({ active, payload }) => {
            const point = active ? payload?.[0]?.payload : null;
            if (!point) return null;
            const rows: ReadoutRow[] = [
              {
                label: trend.kind === "daily" ? "focused" : "focused that week",
                value: formatCompact(point.hours * HOUR_MS),
                color: ACCENT,
              },
            ];
            if (point.average !== undefined) {
              rows.push({
                label: "7-day average",
                value: formatCompact(point.average * HOUR_MS),
                color: ACCENT,
                line: true,
              });
            }
            return (
              <Readout
                title={trend.kind === "daily" ? formatDayKey(point.key, { weekday: "short", day: "numeric", month: "short" }) : `Week of ${point.label}`}
                rows={rows}
              />
            );
          }}
        />
        <Bar
          dataKey="hours"
          fill={ACCENT}
          fillOpacity={trend.kind === "daily" ? 0.35 : 0.85}
          radius={BAR_RADIUS}
          maxBarSize={24}
          isAnimationActive={!reduceMotion}
        />
        {trend.kind === "daily" ? (
          <Line
            dataKey="average"
            stroke={ACCENT}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            strokeLinecap="round"
            strokeLinejoin="round"
            type="monotone"
            isAnimationActive={!reduceMotion}
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  );
}

export function TrendLegend() {
  return (
    <div className="text-muted-foreground flex items-center gap-4 text-xs">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="bg-primary/35 size-2.5 rounded-sm" />
        Each day
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="bg-primary h-0.5 w-3.5 rounded-full" />
        7-day average
      </span>
    </div>
  );
}

export function HourChart({ hours, peak }: { hours: number[]; peak: PeakWindow | null }) {
  const reduceMotion = useReducedMotion();

  // Modular, because the window can wrap midnight (23:00–01:00).
  const width = peak ? (peak.endHour - peak.startHour + 24) % 24 || 24 : 0;
  const inPeak = (hour: number) => peak !== null && (hour - peak.startHour + 24) % 24 < width;

  const data = hours.map((ms, hour) => ({ hour, label: String(hour).padStart(2, "0"), hours: ms / HOUR_MS }));

  return (
    <ChartContainer config={{}} className="aspect-auto h-52 w-full">
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" {...axisProps} interval={2} />
        <YAxis {...axisProps} tickFormatter={hoursTick} width={44} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={({ active, payload }) => {
            const point = active ? payload?.[0]?.payload : null;
            if (!point) return null;
            return (
              <Readout
                title={`${formatHour(point.hour)}–${formatHour((point.hour + 1) % 24)}`}
                rows={[{ label: "focused", value: formatCompact(point.hours * HOUR_MS) }]}
              />
            );
          }}
        />
        <Bar dataKey="hours" radius={BAR_RADIUS} maxBarSize={24} isAnimationActive={!reduceMotion}>
          {data.map((d) => (
            <Cell
              key={d.hour}
              fill={inPeak(d.hour) ? ACCENT : MUTED}
              fillOpacity={inPeak(d.hour) ? 1 : 0.35}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function LengthChart({ lengths }: { lengths: LengthBucket[] }) {
  const reduceMotion = useReducedMotion();

  return (
    <ChartContainer config={{}} className="aspect-auto h-52 w-full">
      <BarChart data={lengths} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" {...axisProps} interval={0} />
        <YAxis {...axisProps} allowDecimals={false} width={44} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={({ active, payload }) => {
            const bucket = active ? payload?.[0]?.payload : null;
            if (!bucket) return null;
            return (
              <Readout
                title={bucket.label}
                rows={[{ label: bucket.count === 1 ? "session" : "sessions", value: String(bucket.count) }]}
              />
            );
          }}
        />
        <Bar
          dataKey="count"
          fill={ACCENT}
          fillOpacity={0.85}
          radius={BAR_RADIUS}
          maxBarSize={24}
          isAnimationActive={!reduceMotion}
        />
      </BarChart>
    </ChartContainer>
  );
}

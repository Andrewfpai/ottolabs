"use client";

import { useState } from "react";

import { addDays, type DayKey, formatDayKey } from "@/lib/time/calendar-day";
import { formatCompact, MINUTE_MS } from "@/lib/time/elapsed";
import { cn } from "@/lib/utils";

/**
 * Fixed thresholds rather than quantiles, so a cell means the same thing next
 * month as it does today and the legend can say what each step is.
 * One hue, lighter to darker — magnitude, not identity.
 */
const LEVELS = [
  { minMinutes: 0, className: "bg-muted", label: "None" },
  { minMinutes: 1, className: "bg-primary/25", label: "Under 30m" },
  { minMinutes: 30, className: "bg-primary/50", label: "30m–1h" },
  { minMinutes: 60, className: "bg-primary/75", label: "1–2h" },
  { minMinutes: 120, className: "bg-primary", label: "2h+" },
] as const;

function levelFor(ms: number) {
  const minutes = ms / MINUTE_MS;
  let level: (typeof LEVELS)[number] = LEVELS[0];
  for (const candidate of LEVELS) if (minutes >= candidate.minMinutes) level = candidate;
  return level;
}

export function FocusHeatmap({
  start,
  end,
  byDay,
  periodLabel = "the last year",
}: {
  /** First day of the first column — always a week start. */
  start: DayKey;
  /** Today; later cells in the final week are left blank. */
  end: DayKey;
  byDay: Record<DayKey, number>;
  /** How the summary line names the span: "the last year", "the last 17 weeks". */
  periodLabel?: string;
}) {
  const [hovered, setHovered] = useState<DayKey | null>(null);

  const weeks: DayKey[][] = [];
  for (let weekStart = start; weekStart <= end; weekStart = addDays(weekStart, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
  }

  // A month label sits over the first column whose first day is in that month.
  // Labels need about three columns of room; a month that only gets the first
  // column or two (the tail of the month before the grid starts) goes unlabelled
  // rather than colliding with the next one.
  const monthLabels = weeks.map((week, i) => {
    const month = week[0].slice(0, 7);
    const previous = i > 0 ? weeks[i - 1][0].slice(0, 7) : null;
    if (month === previous) return null;
    const nextChange = weeks.findIndex((w, j) => j > i && w[0].slice(0, 7) !== month);
    if (nextChange !== -1 && nextChange - i < 3) return null;
    return formatDayKey(week[0], { month: "short" });
  });

  const activeDays = Object.values(byDay).filter((ms) => ms >= MINUTE_MS).length;
  const hoveredMs = hovered ? (byDay[hovered] ?? 0) : 0;

  return (
    <div>
      {/* Wide content scrolls inside its own container so the page never does. */}
      <div className="overflow-x-auto pb-1">
        <div
          className="inline-grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, 11px)` }}
          onPointerLeave={() => setHovered(null)}
          role="img"
          aria-label={`Daily focus over ${periodLabel}. ${activeDays} days with focus.`}
        >
          {monthLabels.map((label, i) => (
            <span
              key={`m-${weeks[i][0]}`}
              aria-hidden
              className="text-muted-foreground h-4 overflow-visible text-[10px] leading-4 whitespace-nowrap"
              style={{ gridRow: 1, gridColumn: i + 1 }}
            >
              {label}
            </span>
          ))}
          {weeks.map((week, col) =>
            week.map((day, row) => {
              if (day > end) return null;
              const ms = byDay[day] ?? 0;
              return (
                <span
                  key={day}
                  aria-hidden
                  onPointerEnter={() => setHovered(day)}
                  className={cn(
                    "size-[11px] rounded-[2px] transition-shadow",
                    levelFor(ms).className,
                    hovered === day && "ring-foreground/60 ring-1",
                  )}
                  style={{ gridRow: row + 2, gridColumn: col + 1 }}
                />
              );
            }),
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <p className="text-muted-foreground min-h-4" aria-live="polite">
          {hovered ? (
            <>
              <span className="text-foreground font-medium">
                {formatCompact(hoveredMs)}
              </span>{" "}
              on {formatDayKey(hovered, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </>
          ) : (
            `${activeDays} days with focus in ${periodLabel}. Point at a day for its total.`
          )}
        </p>
        <div className="text-muted-foreground flex items-center gap-1.5">
          <span>Less</span>
          {LEVELS.map((level) => (
            <span
              key={level.label}
              title={level.label}
              className={cn("size-[11px] rounded-[2px]", level.className)}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

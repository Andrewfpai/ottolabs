"use client";

import { CircleCheck, Pencil } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { splitSession } from "@/features/analytics/lib/split";
import { useActiveSession } from "@/features/sessions/hooks/use-active-session";
import { setDailyGoal } from "@/features/settings/server/actions";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { now as clockNow } from "@/lib/time/clock";
import type { DayKey } from "@/lib/time/calendar-day";
import { formatCompact, MINUTE_MS } from "@/lib/time/elapsed";

const SIZE = 136;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The ring only needs to move a pixel at a time; twice a minute is plenty. */
const TICK_MS = 30_000;

const PRESETS = [60, 120, 180, 240];

/**
 * Today's focus against the daily goal, including a timer that is running
 * right now.
 *
 * The server sends finished focus only; the live session's share of *today*
 * is added here, cut with the same `splitSession` the analytics use so a timer
 * started before the day-start hour is not credited whole. It is added only
 * after hydration, so the server render and the first client render agree.
 */
export function GoalRing({
  finishedTodayMs,
  goalMinutes,
  todayKey,
  timeZone,
  dayStartHour,
}: {
  finishedTodayMs: number;
  goalMinutes: number;
  /** Today's *focus* day, honouring dayStartHour. */
  todayKey: DayKey;
  timeZone: string;
  dayStartHour: number;
}) {
  const hydrated = useIsHydrated();
  const { data: active } = useActiveSession();
  const running = Boolean(active && !active.endedAt && !active.pausedAt);

  // The interval only repaints; the value is always recomputed from the
  // session's timestamps, so a throttled background tab cannot drift.
  const [, repaint] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => repaint((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  let liveMs = 0;
  if (hydrated && active && !active.endedAt) {
    // The active-session endpoint returns JSON, so the timestamps arrive as
    // strings; splitSession needs real Dates.
    const slices = splitSession(
      {
        startedAt: new Date(active.startedAt),
        endedAt: null,
        pausedMs: active.pausedMs,
        pausedAt: active.pausedAt ? new Date(active.pausedAt) : null,
        trackId: active.trackId,
      },
      timeZone,
      dayStartHour,
      clockNow(),
    );
    liveMs = slices.filter((s) => s.day === todayKey).reduce((sum, s) => sum + s.ms, 0);
  }

  const totalMs = finishedTodayMs + liveMs;
  const goalMs = goalMinutes * MINUTE_MS;
  const progress = Math.min(1, totalMs / goalMs);
  const reached = totalMs >= goalMs;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${formatCompact(totalMs)} of a ${formatCompact(goalMs)} goal`}
          className="-rotate-90"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-numeric text-2xl font-semibold">{formatCompact(totalMs)}</span>
          <span className="text-muted-foreground text-xs">of {formatCompact(goalMs)}</span>
        </div>
      </div>

      <div className="space-y-2 text-center sm:text-left">
        {reached ? (
          <p className="text-success flex items-center gap-1.5 text-sm font-medium">
            <CircleCheck className="size-4" aria-hidden />
            Daily goal reached
          </p>
        ) : (
          <p className="text-sm">
            <span className="font-numeric font-medium">{formatCompact(goalMs - totalMs)}</span>{" "}
            <span className="text-muted-foreground">to go today</span>
          </p>
        )}
        {liveMs > 0 ? (
          <p className="text-muted-foreground text-xs">Includes the timer running now.</p>
        ) : null}
        <GoalEditor goalMinutes={goalMinutes} />
      </div>
    </div>
  );
}

function GoalEditor({ goalMinutes }: { goalMinutes: number }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(String(goalMinutes));
  const [pending, startTransition] = useTransition();

  function save(value: number) {
    startTransition(async () => {
      const result = await setDailyGoal({ minutes: value });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Daily goal set to ${formatCompact(value * MINUTE_MS)}.`);
      setOpen(false);
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setMinutes(String(goalMinutes));
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2 cursor-pointer gap-1.5">
          <Pencil className="size-3.5" aria-hidden />
          Change goal
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save(Number(minutes));
          }}
        >
          <div className="text-sm font-medium">Daily focus goal</div>
          <div className="grid grid-cols-4 gap-1">
            {PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={Number(minutes) === preset ? "secondary" : "outline"}
                size="sm"
                className="cursor-pointer"
                onClick={() => save(preset)}
                disabled={pending}
              >
                {preset / 60}h
              </Button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="daily-goal" className="text-xs">
                Or in minutes
              </Label>
              <Input
                id="daily-goal"
                type="number"
                inputMode="numeric"
                min={15}
                max={1440}
                step={15}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="tabular"
              />
            </div>
            <Button type="submit" className="cursor-pointer" disabled={pending}>
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

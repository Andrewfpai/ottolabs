"use client";

import { Info } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAY_START_HOURS, settingsSchema, type SettingsValues } from "@/features/settings/schema";
import { updateSettings } from "@/features/settings/server/actions";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { formatCompact, MINUTE_MS } from "@/lib/time/elapsed";

const zoneLabel = (zone: string) => zone.replace(/_/g, " ");
const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

type NumberField = { id: string; label: string; suffix: string; value: string; set: (v: string) => void };

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 py-6 first:pt-0 md:grid-cols-[minmax(0,14rem)_1fr] md:gap-8">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-muted-foreground mt-1 text-xs text-balance">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function NumberInput({ field, min, max, step = 1 }: { field: NumberField; min: number; max: number; step?: number }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>{field.label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={field.id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={field.value}
          onChange={(e) => field.set(e.target.value)}
          className="tabular w-24"
        />
        <span className="text-muted-foreground text-sm">{field.suffix}</span>
      </div>
    </div>
  );
}

export function SettingsForm({ initial, timeZones }: { initial: SettingsValues; timeZones: string[] }) {
  const hydrated = useIsHydrated();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(initial);

  const [timezone, setTimezone] = useState(initial.timezone);
  const [dayStartHour, setDayStartHour] = useState(initial.dayStartHour);
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(initial.weekStartsOn);
  const [dailyGoal, setDailyGoal] = useState(String(initial.dailyGoalMinutes));
  const [work, setWork] = useState(String(initial.pomodoro.workMinutes));
  const [shortBreak, setShortBreak] = useState(String(initial.pomodoro.breakMinutes));
  const [longBreak, setLongBreak] = useState(String(initial.pomodoro.longBreakMinutes));
  const [cycles, setCycles] = useState(String(initial.pomodoro.cyclesBeforeLongBreak));

  // Only knowable in the browser, so read after hydration.
  const deviceZone = hydrated ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

  const values: SettingsValues = {
    timezone,
    dayStartHour,
    weekStartsOn,
    dailyGoalMinutes: Number(dailyGoal),
    pomodoro: {
      workMinutes: Number(work),
      breakMinutes: Number(shortBreak),
      longBreakMinutes: Number(longBreak),
      cyclesBeforeLongBreak: Number(cycles),
    },
  };
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const goalMinutes = Number(dailyGoal);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const check = settingsSchema.safeParse(values);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Those settings do not look right.");
      return;
    }

    startTransition(async () => {
      const result = await updateSettings(check.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(check.data);
      toast.success("Settings saved.");
    });
  }

  return (
    <form onSubmit={submit} className="bg-card divide-y rounded-xl border px-4 py-6 sm:px-6">
      <Section
        title="Time"
        description="Every daily total, streak and deadline is worked out in this zone."
      >
        <div className="space-y-2">
          <Label htmlFor="settings-timezone">Time zone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="settings-timezone" className="w-full cursor-pointer sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {timeZones.map((zone) => (
                <SelectItem key={zone} value={zone} className="cursor-pointer">
                  {zoneLabel(zone)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {deviceZone && deviceZone !== timezone ? (
            <p className="text-muted-foreground text-xs">
              This device is on {zoneLabel(deviceZone)}.{" "}
              {timeZones.includes(deviceZone) ? (
                <button
                  type="button"
                  className="text-foreground cursor-pointer underline underline-offset-4"
                  onClick={() => setTimezone(deviceZone)}
                >
                  Use it
                </button>
              ) : null}
            </p>
          ) : null}
          {timezone !== saved.timezone ? (
            <p className="text-muted-foreground flex gap-1.5 text-xs">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              All-day deadlines keep their dates. Timed deadlines keep their exact moment, so
              their clock time shifts with the zone.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-day-start">Day starts at</Label>
            <Select value={String(dayStartHour)} onValueChange={(v) => setDayStartHour(Number(v))}>
              <SelectTrigger id="settings-day-start" className="w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_START_HOURS.map((hour) => (
                  <SelectItem key={hour} value={String(hour)} className="cursor-pointer">
                    {hourLabel(hour)}
                    {hour === 0 ? " (midnight)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {dayStartHour === 0
                ? "Days run midnight to midnight."
                : `Focus before ${hourLabel(dayStartHour)} counts toward the evening before, for totals and streaks. Deadlines still use the calendar date.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-week-start">Week starts on</Label>
            <Select
              value={String(weekStartsOn)}
              onValueChange={(v) => setWeekStartsOn(v === "0" ? 0 : 1)}
            >
              <SelectTrigger id="settings-week-start" className="w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="cursor-pointer">
                  Monday
                </SelectItem>
                <SelectItem value="0" className="cursor-pointer">
                  Sunday
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <Section
        title="Goals"
        description="The dashboard ring fills toward this. Weekly targets per track are set on each track."
      >
        <NumberInput
          field={{ id: "settings-goal", label: "Daily focus goal", suffix: "minutes", value: dailyGoal, set: setDailyGoal }}
          min={15}
          max={1440}
          step={15}
        />
        {Number.isFinite(goalMinutes) && goalMinutes >= 15 ? (
          <p className="text-muted-foreground -mt-2 text-xs">That is {formatCompact(goalMinutes * MINUTE_MS)} a day.</p>
        ) : null}
      </Section>

      <Section
        title="Pomodoro"
        description="Used for Pomodoro sessions you start from now on. A running session keeps the timings it started with."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumberInput
            field={{ id: "settings-work", label: "Focus", suffix: "min", value: work, set: setWork }}
            min={5}
            max={120}
          />
          <NumberInput
            field={{ id: "settings-break", label: "Short break", suffix: "min", value: shortBreak, set: setShortBreak }}
            min={1}
            max={60}
          />
          <NumberInput
            field={{ id: "settings-long-break", label: "Long break", suffix: "min", value: longBreak, set: setLongBreak }}
            min={1}
            max={90}
          />
          <NumberInput
            field={{ id: "settings-cycles", label: "Long break every", suffix: "cycles", value: cycles, set: setCycles }}
            min={1}
            max={12}
          />
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-6">
        {error ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive mr-auto rounded-lg border px-3 py-2 text-sm"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" className="cursor-pointer" disabled={!dirty || pending} aria-busy={pending}>
          {pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { BellPlus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  describeOffset,
  MAX_OFFSET_MINUTES,
  MAX_REMINDERS,
  normalizeOffsets,
  REMINDER_PRESETS,
  type ReminderUnit,
  UNIT_MINUTES,
} from "@/features/tasks/lib/task-reminders";

/**
 * A list of "remind me …" chips with an Add button: presets, or any number
 * of minutes, hours, days or weeks before the deadline.
 */
export function ReminderOffsetsEditor({
  value,
  onChange,
  disabled,
}: {
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("3");
  const [unit, setUnit] = useState<ReminderUnit>("hours");
  const full = value.length >= MAX_REMINDERS;

  function add(minutes: number) {
    onChange(normalizeOffsets([...value, minutes]));
    setOpen(false);
  }

  const custom = Math.round(Number(amount) * UNIT_MINUTES[unit]);
  const customValid = Number.isFinite(custom) && custom > 0 && custom <= MAX_OFFSET_MINUTES;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((minutes) => (
        <span key={minutes} className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-2.5 text-xs">
          {describeOffset(minutes)}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(value.filter((m) => m !== minutes))}
            aria-label={`Remove the reminder ${describeOffset(minutes).toLowerCase()}`}
            className="hover:bg-background/60 flex size-5 cursor-pointer items-center justify-center rounded-full"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-7 cursor-pointer gap-1 rounded-full text-xs" disabled={disabled || full}>
            <BellPlus className="size-3.5" aria-hidden />
            {value.length === 0 ? "Add a reminder" : "Add"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="grid gap-0.5">
            {REMINDER_PRESETS.filter((m) => !value.includes(m)).map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => add(minutes)}
                className="hover:bg-muted cursor-pointer rounded-md px-2 py-1.5 text-left text-sm"
              >
                {describeOffset(minutes)}
              </button>
            ))}
          </div>
          <div className="mt-2 border-t pt-2">
            <p className="text-muted-foreground mb-1.5 px-1 text-xs">Custom</p>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label="How many"
                className="h-8 w-16"
              />
              <Select value={unit} onValueChange={(v) => setUnit(v as ReminderUnit)}>
                <SelectTrigger aria-label="Unit" className="h-8 flex-1 cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(UNIT_MINUTES) as ReminderUnit[]).map((u) => (
                    <SelectItem key={u} value={u} className="cursor-pointer">
                      {u} before
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" className="h-8 cursor-pointer" disabled={!customValid} onClick={() => add(custom)}>
                Add
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

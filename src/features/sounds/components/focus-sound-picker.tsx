"use client";

import { Headphones, Play, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSoundPrefs } from "@/features/sounds/hooks/use-focus-sounds";
import { previewSound } from "@/features/sounds/lib/engine";
import { SOUNDSCAPES, type SoundPrefs, writeSoundPrefs } from "@/features/sounds/lib/prefs";
import { cn } from "@/lib/utils";

const OPTIONS = [{ id: "off" as const, label: "Off", description: "Silence" }, ...SOUNDSCAPES];

/**
 * Pick a soundscape and its volume. With `audibleNow` the choice is heard at
 * once through the running session; otherwise picking plays a short preview.
 */
export function FocusSoundControls({ audibleNow }: { audibleNow: boolean }) {
  const prefs = useSoundPrefs();

  function choose(next: SoundPrefs) {
    writeSoundPrefs(next);
    if (!audibleNow && next.sound !== "off") previewSound(next.sound, next.volume);
  }

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Focus sound" className="grid gap-1">
        {OPTIONS.map((option) => {
          const selected = prefs.sound === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose({ ...prefs, sound: option.id })}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                selected ? "bg-primary/10" : "hover:bg-muted",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0 rounded-full border-2",
                  selected ? "border-primary bg-primary" : "border-muted-foreground/40",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-medium", selected && "text-primary")}>{option.label}</span>
                <span className="text-muted-foreground block text-xs">{option.description}</span>
              </span>
              {option.id !== "off" && !audibleNow ? (
                <Play className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 px-1">
        <VolumeX className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(prefs.volume * 100)}
          aria-label="Focus sound volume"
          disabled={prefs.sound === "off"}
          onChange={(e) => writeSoundPrefs({ ...prefs, volume: Number(e.target.value) / 100 })}
          className="accent-primary h-1.5 flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="text-muted-foreground font-numeric w-9 text-right text-xs">
          {Math.round(prefs.volume * 100)}%
        </span>
      </div>
    </div>
  );
}

/** The headphones button in the timer bar and in focus mode. */
export function FocusSoundButton({ audibleNow, className }: { audibleNow: boolean; className?: string }) {
  const prefs = useSoundPrefs();
  const on = prefs.sound !== "off";
  const label = on ? `Focus sound: ${SOUNDSCAPES.find((s) => s.id === prefs.sound)?.label}` : "Focus sounds";

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={label}
              className={cn("size-9 cursor-pointer", on && "text-primary", className)}
            >
              <Headphones className="size-4" aria-hidden />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" side="top" className="w-72 p-2">
        <FocusSoundControls audibleNow={audibleNow} />
        <p className="text-muted-foreground mt-2 px-1 text-xs">
          Plays while you focus and fades out on pauses and breaks. Saved on this device.
        </p>
      </PopoverContent>
    </Popover>
  );
}

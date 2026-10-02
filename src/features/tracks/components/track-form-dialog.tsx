"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { getTrackIcon } from "@/components/track-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Track } from "@/db/schema";
import { TRACK_ICONS, trackFormSchema } from "@/features/tracks/schema";
import { createTrack, updateTrack } from "@/features/tracks/server/actions";
import {
  DEFAULT_TRACK_COLOR,
  TRACK_COLOR_CLASSES,
  TRACK_COLORS,
  type TrackColor,
} from "@/lib/track-colors";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit to create. */
  track?: Track;
  /** Colours already in use, so a new track gets a distinct one by default. */
  suggestedColor?: TrackColor;
};

export function TrackFormDialog({
  open,
  onOpenChange,
  track,
  suggestedColor,
}: Props) {
  const isEdit = Boolean(track);

  const [title, setTitle] = useState(track?.title ?? "");
  const [description, setDescription] = useState(track?.description ?? "");
  const [color, setColor] = useState<TrackColor>(
    (track?.color as TrackColor) ?? suggestedColor ?? DEFAULT_TRACK_COLOR,
  );
  const [icon, setIcon] = useState<string>(track?.icon ?? "book-open");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);

    const fields = {
      title,
      description,
      color,
      icon,
      targetMinutesPerWeek: track?.targetMinutesPerWeek ?? null,
    };

    // Checked here for an instant message, but the raw fields are what is
    // sent: the server parses them itself rather than trusting our output.
    const parsed = trackFormSchema.safeParse(fields);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check those values.");
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateTrack({ ...fields, id: track!.id })
        : await createTrack(fields);

      if (!result.ok) {
        // Shown inline rather than as a toast: it is a problem with the field
        // right in front of you, and the fix is in this dialog.
        setError(result.error);
        return;
      }

      toast.success(isEdit ? "Track updated." : `Created ${parsed.data.title}.`);
      onOpenChange(false);
      if (!isEdit) {
        setTitle("");
        setDescription("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit track" : "New track"}</DialogTitle>
          <DialogDescription>
            A track is a topic you want to put hours into. Sessions accumulate
            against it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="track-title">Name</Label>
            <Input
              id="track-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Databases"
              autoFocus
              maxLength={60}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="track-description">
              Description{" "}
              <span className="text-muted-foreground font-normal">optional</span>
            </Label>
            <Textarea
              id="track-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Indexing, query planning, transactions."
              rows={2}
              maxLength={280}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {TRACK_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  aria-label={option}
                  aria-pressed={color === option}
                  className={cn(
                    "focus-visible:ring-ring size-8 cursor-pointer rounded-full transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-offset-2",
                    TRACK_COLOR_CLASSES[option].bg,
                    color === option
                      ? "ring-foreground scale-110 ring-2 ring-offset-2"
                      : "hover:scale-105",
                  )}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Icon</legend>
            <div className="grid grid-cols-8 gap-1.5">
              {TRACK_ICONS.map((option) => {
                const Icon = getTrackIcon(option);
                const selected = icon === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setIcon(option)}
                    aria-label={option}
                    aria-pressed={selected}
                    className={cn(
                      "focus-visible:ring-ring flex size-9 cursor-pointer items-center justify-center rounded-lg border transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none",
                      selected
                        ? cn(
                            TRACK_COLOR_CLASSES[color].surface,
                            TRACK_COLOR_CLASSES[color].text,
                            TRACK_COLOR_CLASSES[color].border,
                          )
                        : "text-muted-foreground hover:bg-accent border-transparent",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error ? (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            className="cursor-pointer"
            onClick={submit}
            disabled={pending || title.trim().length === 0}
            aria-busy={pending}
          >
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create track"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

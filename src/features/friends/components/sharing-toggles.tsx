"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateSharing } from "@/features/friends/server/actions";

type Sharing = { shareTrackNames: boolean; shareLiveStatus: boolean };

const OPTIONS: { key: keyof Sharing; label: string; description: string }[] = [
  {
    key: "shareTrackNames",
    label: "Show my track names",
    description: "Off: friends see your time split across “Track 1, Track 2…” in your colours.",
  },
  {
    key: "shareLiveStatus",
    label: "Show when I am focusing",
    description: "Friends see “Studying now” with the track and minutes while your timer runs.",
  },
];

/** Saves on each flip; there is nothing to batch with two switches. */
export function SharingToggles({ initial }: { initial: Sharing }) {
  const [sharing, setSharing] = useState(initial);
  const [pending, startTransition] = useTransition();

  function flip(key: keyof Sharing, value: boolean) {
    const next = { ...sharing, [key]: value };
    const previous = sharing;
    setSharing(next);
    startTransition(async () => {
      const result = await updateSharing(next);
      if (!result.ok) {
        setSharing(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {OPTIONS.map((option) => (
        <div key={option.key} className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor={`share-${option.key}`} className="cursor-pointer">
              {option.label}
            </Label>
            <p className="text-muted-foreground mt-1 text-xs">{option.description}</p>
          </div>
          <Switch
            id={`share-${option.key}`}
            checked={sharing[option.key]}
            onCheckedChange={(value) => flip(option.key, value)}
            disabled={pending}
            className="mt-0.5 cursor-pointer"
          />
        </div>
      ))}
      <p className="text-muted-foreground text-xs">
        Always shared with friends: focus time, streaks and patterns. Never shared: session notes
        and tasks.
      </p>
    </div>
  );
}

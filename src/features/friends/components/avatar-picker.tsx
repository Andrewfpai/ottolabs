"use client";

import { Check } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { AnimalAvatar } from "@/components/animal-avatar";
import { PersonAvatar } from "@/features/friends/components/person-avatar";
import { setAvatar } from "@/features/friends/server/actions";
import { ANIMAL_AVATARS, type AnimalAvatarId, currentAnimal } from "@/lib/avatars";
import { cn } from "@/lib/utils";

type Choice = AnimalAvatarId | null;

/** Saves on each pick; the ring moves at once and the server catches up. */
export function AvatarPicker({
  current,
  photo,
  name,
}: {
  current: string | null;
  /** The Google photo, shown as the "no animal" option. */
  photo: string | null;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useOptimistic<Choice>(currentAnimal(current));

  function pick(next: Choice) {
    if (next === chosen) return;
    startTransition(async () => {
      setChosen(next);
      const result = await setAvatar({ avatar: next });
      if (!result.ok) toast.error(result.error);
    });
  }

  const options: { id: Choice; label: string }[] = [
    { id: null, label: photo ? "Google photo" : "Initials" },
    ...ANIMAL_AVATARS.map((a) => ({ id: a.id, label: a.label })),
  ];

  return (
    <div role="radiogroup" aria-label="Avatar" aria-busy={pending} className="flex flex-wrap gap-3">
      {options.map((option) => {
        const selected = option.id === chosen;
        return (
          <button
            key={option.id ?? "photo"}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => pick(option.id)}
            className={cn(
              "relative size-14 shrink-0 cursor-pointer rounded-full transition-transform motion-safe:hover:scale-105",
              "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              selected && "ring-primary ring-offset-background ring-2 ring-offset-2",
            )}
          >
            {option.id ? (
              <span className="block size-full overflow-hidden rounded-full">
                <AnimalAvatar id={option.id} />
              </span>
            ) : (
              <PersonAvatar name={name} image={photo} className="size-14" />
            )}
            {selected ? (
              <span className="bg-primary text-primary-foreground absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full">
                <Check className="size-3" aria-hidden />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

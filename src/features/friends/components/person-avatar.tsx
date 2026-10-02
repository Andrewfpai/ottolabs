import { AnimalAvatar } from "@/components/animal-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { parsePicture } from "@/lib/avatars";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** A person's chosen animal, else their photo, else their initials. */
export function PersonAvatar({
  name,
  image,
  className,
}: {
  name: string;
  /** A photo URL or an `animal:<id>` picture — see `lib/avatars.ts`. */
  image: string | null;
  className?: string;
}) {
  const animal = parsePicture(image);
  if (animal) {
    return (
      <span className={cn("inline-flex size-9 shrink-0 overflow-hidden rounded-full", className)}>
        <AnimalAvatar id={animal.animal} accessories={animal.accessories} />
      </span>
    );
  }

  return (
    <Avatar className={cn("size-9", className)}>
      {image && !image.startsWith("animal:") ? <AvatarImage src={image} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

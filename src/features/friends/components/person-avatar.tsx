import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

export function PersonAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-9", className)}>
      {image ? <AvatarImage src={image} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

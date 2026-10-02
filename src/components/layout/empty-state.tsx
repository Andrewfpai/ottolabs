import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Empty states carry a lot of weight in a personal tracker: for the first week
 * they *are* the app. Each one says what the thing is for and offers the single
 * next action, rather than just reporting that a list is empty.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      <div
        aria-hidden
        className="bg-muted text-muted-foreground mb-4 flex size-11 items-center justify-center rounded-full"
      >
        <Icon className="size-5" />
      </div>
      <h3 className="text-base font-medium">{title}</h3>
      {description ? (
        <p className="text-muted-foreground mt-1.5 max-w-sm text-sm text-balance">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

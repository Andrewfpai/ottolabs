"use client";

import { Check, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { AnimalAvatar } from "@/components/animal-avatar";
import { Button } from "@/components/ui/button";
import {
  type AchievementStats,
  MILESTONES,
  type Milestone,
  progressOf,
  progressText,
} from "@/features/achievements/lib/milestones";
import { setAccessories } from "@/features/achievements/server/actions";
import {
  ACCESSORIES,
  type AccessoryId,
  type AnimalAvatarId,
  currentAnimal,
  takeOff,
  wear,
} from "@/lib/avatars";
import { dayKey, formatDayKey } from "@/lib/time/calendar-day";
import { cn } from "@/lib/utils";

const accessoryLabel = (id: AccessoryId) => ACCESSORIES.find((a) => a.id === id)?.label ?? id;

export function MilestonesBoard({
  stats,
  unlocked,
  wearing,
  avatar,
  timeZone,
}: {
  stats: AchievementStats;
  unlocked: Record<string, Date>;
  wearing: AccessoryId[];
  avatar: string | null;
  timeZone: string;
}) {
  const [pending, startTransition] = useTransition();
  const [worn, setWorn] = useOptimistic(wearing);
  const animal = currentAnimal(avatar);
  // Without an animal there is nothing to dress; preview on the cat.
  const model: AnimalAvatarId = animal ?? "cat";
  const unlockedCount = MILESTONES.filter((m) => unlocked[m.id]).length;

  function toggle(reward: AccessoryId) {
    const next = worn.includes(reward) ? takeOff(worn, reward) : wear(worn, reward);
    startTransition(async () => {
      setWorn(next);
      const result = await setAccessories({ accessories: next });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="bg-card flex flex-col items-center gap-5 rounded-xl border p-5 sm:flex-row sm:items-center">
        <span className="block size-28 shrink-0 overflow-hidden rounded-full">
          <AnimalAvatar id={model} accessories={worn} />
        </span>
        <div className="w-full min-w-0 flex-1 text-center sm:text-left">
          <p className="text-2xl font-medium">
            <span className="font-numeric">{unlockedCount}</span>
            <span className="text-muted-foreground"> of {MILESTONES.length} unlocked</span>
          </p>
          <div className="bg-muted mt-2 h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full motion-safe:transition-[width]"
              style={{ width: `${(unlockedCount / MILESTONES.length) * 100}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            {worn.length > 0 ? `Wearing: ${worn.map(accessoryLabel).join(", ")}.` : "Unlock a milestone to earn something to wear."}
          </p>
          {!animal ? (
            <p className="text-muted-foreground mt-1 text-xs">
              Accessories show on animal avatars.{" "}
              <Link href="/settings#username" className="text-foreground underline underline-offset-4">
                Pick an animal
              </Link>{" "}
              to wear them where friends can see.
            </p>
          ) : null}
        </div>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MILESTONES.map((milestone) => (
          <MilestoneCard
            key={milestone.id}
            milestone={milestone}
            stats={stats}
            unlockedAt={unlocked[milestone.id] ?? null}
            model={model}
            wearing={worn.includes(milestone.reward)}
            pending={pending}
            onToggle={() => toggle(milestone.reward)}
            timeZone={timeZone}
          />
        ))}
      </ul>
    </div>
  );
}

function MilestoneCard({
  milestone,
  stats,
  unlockedAt,
  model,
  wearing,
  pending,
  onToggle,
  timeZone,
}: {
  milestone: Milestone;
  stats: AchievementStats;
  unlockedAt: Date | null;
  model: AnimalAvatarId;
  wearing: boolean;
  pending: boolean;
  onToggle: () => void;
  timeZone: string;
}) {
  const progress = progressOf(milestone, stats);
  const isUnlocked = unlockedAt !== null;

  return (
    <li
      className={cn(
        "bg-card flex gap-4 rounded-xl border p-4",
        isUnlocked && "border-primary/40",
      )}
    >
      <span className="relative block size-16 shrink-0">
        <span
          className={cn(
            "block size-full overflow-hidden rounded-full",
            !isUnlocked && "opacity-45 grayscale",
          )}
        >
          <AnimalAvatar id={model} accessories={[milestone.reward]} />
        </span>
        {isUnlocked ? null : (
          <span className="bg-background text-muted-foreground absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border">
            <Lock className="size-3" aria-hidden />
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          {milestone.title}
          {isUnlocked ? <Sparkles className="text-primary size-3.5" aria-hidden /> : null}
        </h3>
        <p className="text-muted-foreground mt-0.5 text-xs">{milestone.description}</p>
        <p className="mt-1 text-xs">
          Reward: <span className="font-medium">{accessoryLabel(milestone.reward)}</span>
        </p>

        {isUnlocked ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={wearing ? "secondary" : "outline"}
              className="h-7 cursor-pointer gap-1 px-2.5 text-xs"
              disabled={pending}
              onClick={onToggle}
              aria-pressed={wearing}
            >
              {wearing ? <Check className="size-3.5" aria-hidden /> : null}
              {wearing ? "Wearing" : "Wear"}
            </Button>
            <span className="text-muted-foreground text-xs">
              Unlocked {formatDayKey(dayKey(unlockedAt, timeZone), { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        ) : (
          <div className="mt-2.5">
            <div
              className="bg-muted h-1.5 overflow-hidden rounded-full"
              role="progressbar"
              aria-label={`${milestone.title} progress`}
              aria-valuemin={0}
              aria-valuemax={milestone.target}
              aria-valuenow={Math.min(Math.floor(progress.value), milestone.target)}
            >
              <div className="bg-primary/70 h-full rounded-full" style={{ width: `${progress.ratio * 100}%` }} />
            </div>
            <p className="text-muted-foreground tabular mt-1 text-xs">{progressText(milestone, progress)}</p>
          </div>
        )}
      </div>
    </li>
  );
}

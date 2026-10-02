"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { AnimalAvatar } from "@/components/animal-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { markCelebrated, setAccessories } from "@/features/achievements/server/actions";
import type { Celebration } from "@/features/achievements/server/queries";
import { ACCESSORIES, parsePicture, wear } from "@/lib/avatars";

/**
 * "Milestone unlocked!", once, the next time any page renders after one is
 * reached. Shows the reward on your own animal and lets you put it on.
 */
export function MilestoneCelebration({ items, picture }: { items: Celebration[]; picture: string | null }) {
  const [open, setOpen] = useState(items.length > 0);
  const [pending, startTransition] = useTransition();
  const reduceMotion = useReducedMotion();
  const first = items[0];

  // Seen as soon as it is shown: closing the tab should not replay it.
  useEffect(() => {
    if (items.length > 0) void markCelebrated();
  }, [items.length]);

  if (!first) return null;

  const own = parsePicture(picture);
  const model = own?.animal ?? "cat";
  const reward = ACCESSORIES.find((a) => a.id === first.reward);
  const others = items.slice(1);

  function wearIt() {
    startTransition(async () => {
      const result = await setAccessories({ accessories: wear(own?.accessories ?? [], first.reward) });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Wearing your ${reward?.label.toLowerCase()}.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <motion.span
            className="mb-2 block size-32 overflow-hidden rounded-full"
            initial={reduceMotion ? false : { scale: 0.6, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14 }}
          >
            <AnimalAvatar id={model} accessories={wear(own?.accessories ?? [], first.reward)} />
          </motion.span>
          <DialogTitle>Milestone unlocked: {first.title}</DialogTitle>
          <DialogDescription>
            You earned the {reward?.label.toLowerCase()}.
            {others.length > 0 ? ` Also unlocked: ${others.map((o) => o.title).join(", ")}.` : ""}
            {own ? "" : " Pick an animal avatar in Settings to wear it."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-center sm:gap-2">
          <Button asChild variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
            <Link href="/milestones">See milestones</Link>
          </Button>
          <Button className="cursor-pointer" disabled={pending} aria-busy={pending} onClick={wearIt}>
            Wear it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

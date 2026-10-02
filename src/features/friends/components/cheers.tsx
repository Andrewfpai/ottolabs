"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { PersonAvatar } from "@/features/friends/components/person-avatar";
import { CHEER_EMOJI, CHEER_KINDS, type CheerKind } from "@/features/friends/lib/cheers";
import { markCheersSeen, sendCheer } from "@/features/friends/server/actions";
import type { ReceivedCheer } from "@/features/friends/server/queries";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<CheerKind, string> = { clap: "a clap", fire: "some fire" };

/** The 👏 and 🔥 buttons beside a friend. */
export function CheerButtons({ friendId, name }: { friendId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<CheerKind | null>(null);
  const reduceMotion = useReducedMotion();

  function cheer(kind: CheerKind) {
    startTransition(async () => {
      const result = await sendCheer({ friendId, kind });
      if (!result.ok) {
        toast.message(result.error);
        return;
      }
      setSent(kind);
      toast.success(`Sent ${name} ${CHEER_EMOJI[kind]}`);
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1 pr-3">
      {CHEER_KINDS.map((kind) => (
        <motion.button
          key={kind}
          type="button"
          disabled={pending}
          onClick={() => cheer(kind)}
          aria-label={`Cheer ${name} on with ${KIND_LABEL[kind]}`}
          title={`Cheer ${name} on`}
          whileTap={reduceMotion ? undefined : { scale: 0.85 }}
          animate={sent === kind && !reduceMotion ? { scale: [1, 1.35, 1] } : undefined}
          transition={{ duration: 0.35 }}
          className={cn(
            "hover:bg-muted flex size-9 cursor-pointer items-center justify-center rounded-full text-lg transition-colors disabled:opacity-50",
            sent === kind && "bg-muted",
          )}
        >
          <span aria-hidden>{CHEER_EMOJI[kind]}</span>
        </motion.button>
      ))}
    </div>
  );
}

function ago(date: Date, now: number): string {
  const minutes = Math.max(0, Math.round((now - date.getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Cheers you received lately. Opening the page marks them seen. */
export function ReceivedCheers({ cheers, now }: { cheers: ReceivedCheer[]; now: number }) {
  const anyNew = cheers.some((c) => c.isNew);

  useEffect(() => {
    if (anyNew) void markCheersSeen();
  }, [anyNew]);

  if (cheers.length === 0) return null;

  return (
    <section aria-labelledby="cheers-heading" className="bg-card rounded-xl border">
      <h2 id="cheers-heading" className="border-b px-4 py-3 text-sm font-medium">
        Cheers for you
      </h2>
      <ul className="divide-y">
        {cheers.map((cheer) => (
          <li key={cheer.id} className="flex items-center gap-3 px-4 py-2.5">
            <PersonAvatar name={cheer.from.name} image={cheer.from.image} className="size-8" />
            <p className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{cheer.from.name}</span>{" "}
              <span className="text-muted-foreground">cheered you on</span>{" "}
              <span aria-label={KIND_LABEL[cheer.kind]}>{CHEER_EMOJI[cheer.kind]}</span>
            </p>
            {cheer.isNew ? (
              <span className="bg-primary size-2 shrink-0 rounded-full" aria-label="New" />
            ) : null}
            <span className="text-muted-foreground shrink-0 text-xs">{ago(cheer.createdAt, now)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

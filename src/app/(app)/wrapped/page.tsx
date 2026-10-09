import { Gift, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { getWrappedMonths } from "@/features/wrapped/server/queries";
import { formatCompact } from "@/lib/time/elapsed";

export const metadata: Metadata = { title: "Wrapped" };

/** Each month you studied, as a story to replay and share. */
export default async function WrappedPage() {
  const months = await getWrappedMonths();

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Wrapped" description="Each month of studying, told as a story you can replay and share." />
      {months.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="Nothing to wrap yet"
          description="Focus on a track this month and your first Wrapped appears here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {months.map((m, i) => (
            <li key={m.month}>
              <Link
                href={`/wrapped/${m.month}`}
                className="group relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-2xl p-5 text-white transition-transform motion-safe:hover:-translate-y-0.5"
                style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }}
              >
                <span aria-hidden className="absolute -top-10 -right-10 size-32 rounded-[38%] bg-white/20" />
                <span aria-hidden className="absolute -bottom-12 -left-8 size-36 rounded-full bg-black/15" />
                <div className="relative">
                  <p className="text-xs font-bold tracking-widest uppercase opacity-85">
                    {m.current ? "So far" : "Wrapped"}
                  </p>
                  <p className="text-3xl font-black">{m.monthName}</p>
                  <p className="text-sm font-semibold opacity-85">{m.year}</p>
                </div>
                <div className="relative flex items-end justify-between">
                  <p className="text-2xl font-black">{formatCompact(m.focusMs)}</p>
                  <span className="flex size-11 items-center justify-center rounded-full bg-white text-black transition-transform group-hover:scale-110">
                    <Play className="size-5 fill-current" aria-hidden />
                    <span className="sr-only">Play {m.monthName} {m.year}</span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

const CARD_GRADIENTS = [
  "linear-gradient(160deg, #2A0E61 0%, #6A1B9A 55%, #E040A0 100%)",
  "linear-gradient(170deg, #0B3D2E 0%, #0F5E44 60%, #1DB954 100%)",
  "linear-gradient(160deg, #FF5F1F 0%, #FF2E63 100%)",
  "linear-gradient(175deg, #0A1033 0%, #1B2A6B 70%, #3B4FCF 100%)",
  "linear-gradient(155deg, #FF006E 0%, #8338EC 50%, #3A86FF 100%)",
  "linear-gradient(170deg, #003B46 0%, #07575B 55%, #12B5A5 100%)",
];

"use client";

import { useRouter } from "next/navigation";

import { WrappedStory } from "@/features/wrapped/components/wrapped-story";
import type { WrappedData } from "@/features/wrapped/lib/wrapped";

/** The story on its own page; closing goes back to the list of months. */
export function WrappedPlayer({ data }: { data: WrappedData }) {
  const router = useRouter();
  return <WrappedStory data={data} onClose={() => router.push("/wrapped")} />;
}

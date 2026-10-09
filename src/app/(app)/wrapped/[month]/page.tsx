import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WrappedPlayer } from "@/features/wrapped/components/wrapped-player";
import { getWrapped } from "@/features/wrapped/server/queries";

export const metadata: Metadata = { title: "Wrapped" };

/** One month's Wrapped, full screen. */
export default async function WrappedMonthPage({ params }: PageProps<"/wrapped/[month]">) {
  const { month } = await params;
  const data = await getWrapped(month);
  if (!data) notFound();
  return <WrappedPlayer data={data} />;
}

import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CalendarView } from "@/features/calendar/components/calendar-view";
import { parseView } from "@/features/calendar/lib/range";
import { getCalendarData } from "@/features/calendar/server/queries";
import { getTrackOptions } from "@/features/tracks/server/queries";

export const metadata: Metadata = { title: "Calendar" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const params = await searchParams;

  const [data, tracks] = await Promise.all([
    getCalendarData({
      view: parseView(first(params.view)),
      anchor: first(params.d),
      showFocus: first(params.focus) === "1",
    }),
    getTrackOptions(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Calendar"
        description="Deadlines by month, week or as an agenda. Click a day to add a task due then."
      />
      <CalendarView data={data} tracks={tracks} />
    </PageContainer>
  );
}

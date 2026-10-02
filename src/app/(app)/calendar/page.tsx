import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Calendar"
        description="Deadlines laid out by month, week, or as an agenda."
      />
      <EmptyState
        icon={CalendarDays}
        title="Calendar arrives in Phase 3"
        description="Task deadlines laid out by month, week or agenda, with an option to overlay your focus sessions."
      />
    </PageContainer>
  );
}

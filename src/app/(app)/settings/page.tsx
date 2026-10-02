import { Settings } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Timezone, daily goal, pomodoro defaults, and data export."
      />
      <EmptyState
        icon={Settings}
        title="Settings arrives in Phase 5"
        description="Timezone, the hour your day starts, daily and weekly goals, pomodoro defaults, and JSON/CSV export."
      />
    </PageContainer>
  );
}

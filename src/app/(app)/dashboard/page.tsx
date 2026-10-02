import { LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Today at a glance: what is running, what is due, and how the week is going."
      />
      <EmptyState
        icon={LayoutDashboard}
        title="Dashboard widgets arrive in Phase 4"
        description="The timer works now — start one from Tracks and it follows you across every page, or expand it into fullscreen focus mode. Goal rings, today's tasks and upcoming deadlines land here with the analytics work."
      />
    </PageContainer>
  );
}

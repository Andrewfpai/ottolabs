import { ChartNoAxesColumn } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { getDataSummary } from "@/features/analytics/server/queries";
import { requireSettings } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const [summary, settings] = await Promise.all([
    getDataSummary(),
    requireSettings(),
  ]);

  const hasData = summary.sessions > 0;

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description="When you focus best, how consistent you have been, and where the hours actually went."
      />

      <EmptyState
        icon={ChartNoAxesColumn}
        title="Charts arrive in Phase 4"
        description={
          hasData
            ? `The data is already here — ${summary.sessions} sessions across ${summary.tracks} tracks, ${summary.focusHours} hours of focus, bucketed in ${settings.timezone}. The charts that read it are not built yet.`
            : "Nothing logged yet. Run npm run db:seed to load 90 days of synthetic sessions, or start a real timer once Phase 1 lands."
        }
      />
    </PageContainer>
  );
}

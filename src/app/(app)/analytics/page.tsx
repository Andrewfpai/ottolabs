import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { parseRangeKey } from "@/features/analytics/lib/compute";
import { getAnalytics } from "@/features/analytics/server/queries";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const raw = (await searchParams).range;
  const data = await getAnalytics(parseRangeKey(Array.isArray(raw) ? raw[0] : raw));

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        description="When you focus best, how consistent you have been, and where the hours actually went."
      />
      <AnalyticsView data={data} />
    </PageContainer>
  );
}

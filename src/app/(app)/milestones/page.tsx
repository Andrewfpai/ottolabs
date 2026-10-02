import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { MilestonesBoard } from "@/features/achievements/components/milestones-board";
import { getMilestonesPage } from "@/features/achievements/server/queries";
import { requireSettings } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Milestones" };

export default async function MilestonesPage() {
  const [page, settings] = await Promise.all([getMilestonesPage(), requireSettings()]);

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        title="Milestones"
        description="Reach them to earn accessories for your avatar. Friends and study rooms see what you wear."
      />
      <MilestonesBoard
        stats={page.stats}
        unlocked={page.unlocked}
        wearing={page.wearing}
        avatar={page.avatar}
        timeZone={settings.timezone}
      />
    </PageContainer>
  );
}

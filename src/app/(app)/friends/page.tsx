import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { FriendsBoard } from "@/features/friends/components/friends-board";
import { getFriendsOverview } from "@/features/friends/server/queries";

export const metadata: Metadata = { title: "Friends" };

export default async function FriendsPage() {
  const overview = await getFriendsOverview();

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Friends"
        description="See how the people you study alongside are doing, and let them see you."
        actions={
          <Button asChild variant="outline" size="sm" className="cursor-pointer">
            <Link href="/settings#sharing">What I share</Link>
          </Button>
        }
      />
      <FriendsBoard overview={overview} />
    </PageContainer>
  );
}

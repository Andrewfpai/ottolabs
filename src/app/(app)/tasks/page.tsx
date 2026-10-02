import { ListTodo } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Tasks"
        description="What you mean to get done, with optional deadlines."
      />
      <EmptyState
        icon={ListTodo}
        title="Tasks arrive in Phase 3"
        description="To-dos with optional deadlines and priorities, each optionally linked to a track."
      />
    </PageContainer>
  );
}

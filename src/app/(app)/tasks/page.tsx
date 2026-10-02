import type { Metadata } from "next";
import { z } from "zod";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { TaskBoard } from "@/features/tasks/components/task-board";
import { getTaskBoard } from "@/features/tasks/server/queries";
import { getTrackOptions } from "@/features/tracks/server/queries";
import { requireSettings } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Tasks" };

/** Anything that is not "none" or a uuid is ignored rather than queried. */
function parseTrackFilter(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "none") return value;
  return z.uuid().safeParse(value).success ? value : undefined;
}

function describe(open: Record<string, unknown[]>): string {
  const total = Object.values(open).reduce((n, list) => n + list.length, 0);
  if (total === 0) return "What you mean to get done, with optional deadlines.";

  const parts = [`${total} open`];
  if (open.today.length > 0) parts.push(`${open.today.length} due today`);
  if (open.overdue.length > 0) parts.push(`${open.overdue.length} overdue`);
  return `${parts.join(" · ")}.`;
}

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const trackFilter = parseTrackFilter((await searchParams).track);

  const [board, tracks, settings] = await Promise.all([
    getTaskBoard({ trackId: trackFilter }),
    getTrackOptions(),
    requireSettings(),
  ]);

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Tasks" description={describe(board.open)} />
      <TaskBoard
        board={board}
        tracks={tracks}
        trackFilter={trackFilter}
        weekStartsOn={settings.weekStartsOn === 0 ? 0 : 1}
      />
    </PageContainer>
  );
}

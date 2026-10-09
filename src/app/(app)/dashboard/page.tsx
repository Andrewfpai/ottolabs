import { Flame, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { FocusHeatmap } from "@/features/analytics/components/focus-heatmap";
import { Panel } from "@/features/analytics/components/panels";
import { RECENT_WEEKS } from "@/features/analytics/lib/compute";
import { getFocusSummary } from "@/features/analytics/server/queries";
import { DashboardTasks } from "@/features/dashboard/components/dashboard-tasks";
import { GoalRing } from "@/features/dashboard/components/goal-ring";
import { getTaskBoard } from "@/features/tasks/server/queries";
import { getTrackOptions } from "@/features/tracks/server/queries";
import { requireSettings } from "@/lib/auth-guard";
import { formatDayKey } from "@/lib/time/calendar-day";
import { formatCompact, MINUTE_MS } from "@/lib/time/elapsed";
import { trackColorClasses } from "@/lib/track-colors";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

/** How many upcoming deadlines the dashboard lists before pointing at /tasks. */
const UPCOMING_LIMIT = 5;

export default async function DashboardPage() {
  const [summary, board, tracks, settings] = await Promise.all([
    getFocusSummary(),
    getTaskBoard(),
    getTrackOptions(),
    requireSettings(),
  ]);

  const goals = tracks.filter((t) => t.status === "active" && t.targetMinutesPerWeek);
  const dueToday = [...board.open.overdue, ...board.open.today];
  const upcoming = board.open.upcoming.slice(0, UPCOMING_LIMIT);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description={formatDayKey(board.todayKey, { weekday: "long", day: "numeric", month: "long" })}
      />

      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Today">
            <GoalRing
              finishedTodayMs={summary.todayMs}
              goalMinutes={settings.dailyGoalMinutes}
              todayKey={summary.todayKey}
              timeZone={summary.settings.timeZone}
              dayStartHour={summary.settings.dayStartHour}
            />
          </Panel>

          <Panel title="This week">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-muted-foreground text-xs">Focused</dt>
                <dd className="mt-1 text-2xl font-semibold">{formatCompact(summary.weekMs)}</dd>
                <dd className="text-muted-foreground text-xs">
                  since {formatDayKey(summary.weekStart, { weekday: "short", day: "numeric", month: "short" })}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Flame className="size-3.5" aria-hidden />
                  Streak
                </dt>
                <dd className="mt-1 text-2xl font-semibold">
                  {summary.streaks.current} {summary.streaks.current === 1 ? "day" : "days"}
                </dd>
                <dd className="text-muted-foreground text-xs">longest {summary.streaks.longest}</dd>
              </div>
            </dl>
            <Link
              href="/analytics"
              className="text-muted-foreground hover:text-foreground mt-4 inline-block text-xs"
            >
              See when you focus best
            </Link>
          </Panel>

          <Panel title="Weekly track goals">
            {goals.length === 0 ? (
              <div className="text-muted-foreground flex gap-2 text-sm">
                <Target className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  Give a track a weekly target on the{" "}
                  <Link href="/tracks" className="text-foreground underline underline-offset-4">
                    Tracks page
                  </Link>{" "}
                  and its progress shows up here.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {goals.map((track) => {
                  const doneMs = summary.weekByTrack[track.id] ?? 0;
                  const targetMs = (track.targetMinutesPerWeek ?? 0) * MINUTE_MS;
                  const share = Math.min(1, doneMs / targetMs);
                  const colors = trackColorClasses(track.color);
                  return (
                    <li key={track.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate">{track.title}</span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          <span className="text-foreground font-medium">{formatCompact(doneMs)}</span> /{" "}
                          {formatCompact(targetMs)}
                        </span>
                      </div>
                      {/* A meter: the track is a lighter step of the fill's own hue. */}
                      <div
                        className={cn("h-2 overflow-hidden rounded-full", colors.surface)}
                        role="meter"
                        aria-label={`${track.title} weekly goal`}
                        aria-valuemin={0}
                        aria-valuemax={targetMs}
                        aria-valuenow={Math.min(doneMs, targetMs)}
                        aria-valuetext={`${formatCompact(doneMs)} of ${formatCompact(targetMs)}`}
                      >
                        <div
                          className={cn("h-full rounded-full", colors.bg)}
                          style={{ width: `${share * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <DashboardTasks
          sections={[
            {
              id: "today",
              title: "Due today",
              tasks: dueToday,
              emptyText:
                board.open.upcoming.length > 0
                  ? "Nothing due today. A good day to get ahead."
                  : "Nothing due today.",
            },
            {
              id: "upcoming",
              title: "Coming up",
              tasks: upcoming,
              emptyText: "No upcoming deadlines.",
              more: board.open.upcoming.length - upcoming.length,
            },
          ]}
          tracks={tracks}
          now={board.now}
          timeZone={board.timeZone}
          todayKey={board.todayKey}
          weekStartsOn={settings.weekStartsOn === 0 ? 0 : 1}
          defaultReminders={board.defaultReminders}
        />

        <Panel title="Recent activity" description={`The last ${RECENT_WEEKS} weeks, one square a day.`}>
          <FocusHeatmap
            start={summary.recent.start}
            end={summary.recent.end}
            byDay={summary.recent.byDay}
            periodLabel={`the last ${RECENT_WEEKS} weeks`}
          />
        </Panel>
      </div>
    </PageContainer>
  );
}

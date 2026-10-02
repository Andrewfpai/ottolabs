import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DEFAULT_POMODORO } from "@/db/schema";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { requireSettings, requireUser } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Settings" };

const EXPORTS = [
  {
    format: "json",
    icon: FileJson,
    title: "Everything, as JSON",
    description: "Tracks, sessions, tasks and settings. The complete record, for backups or moving elsewhere.",
  },
  {
    format: "sessions.csv",
    icon: FileSpreadsheet,
    title: "Sessions, as CSV",
    description: "One row per session, with focus minutes and local times, ready for a spreadsheet.",
  },
  {
    format: "tasks.csv",
    icon: FileSpreadsheet,
    title: "Tasks, as CSV",
    description: "One row per task, with deadlines in your time zone.",
  },
];

function supportedTimeZones(current: string): string[] {
  const zones = new Set(Intl.supportedValuesOf("timeZone"));
  // The stored zone must always be selectable, even if this runtime's list
  // spells it differently (and UTC is not in every runtime's list).
  zones.add(current);
  zones.add("UTC");
  return [...zones].sort();
}

export default async function SettingsPage() {
  const [user, settings] = await Promise.all([requireUser(), requireSettings()]);
  const pomodoro = settings.defaultPomodoro ?? DEFAULT_POMODORO;

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Settings" description={`Signed in as ${user.email}.`} />

      <SettingsForm
        initial={{
          timezone: settings.timezone,
          dayStartHour: settings.dayStartHour,
          weekStartsOn: settings.weekStartsOn === 0 ? 0 : 1,
          dailyGoalMinutes: settings.dailyGoalMinutes,
          pomodoro: {
            workMinutes: pomodoro.workMinutes,
            breakMinutes: pomodoro.breakMinutes,
            longBreakMinutes: pomodoro.longBreakMinutes,
            cyclesBeforeLongBreak: pomodoro.cyclesBeforeLongBreak,
          },
        }}
        timeZones={supportedTimeZones(settings.timezone)}
      />

      <section aria-labelledby="export-heading" className="bg-card mt-6 rounded-xl border p-4 sm:p-6">
        <h2 id="export-heading" className="text-sm font-medium">
          Your data
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Download a copy whenever you like. Times are included in UTC and in your time zone.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {EXPORTS.map(({ format, icon: Icon, title, description }) => (
            <li key={format} className="flex flex-col rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Icon className="text-muted-foreground size-4" aria-hidden />
                {title}
              </div>
              <p className="text-muted-foreground mt-1 mb-3 flex-1 text-xs">{description}</p>
              <Button asChild variant="outline" size="sm" className="w-fit cursor-pointer gap-1.5">
                {/* A plain link, not next/link: this is a file download, not a page. */}
                <a href={`/api/export?format=${format}`} download>
                  <Download className="size-3.5" aria-hidden />
                  Download
                </a>
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}

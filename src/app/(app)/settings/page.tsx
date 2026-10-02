import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DEFAULT_POMODORO } from "@/db/schema";
import { AccessManager } from "@/features/access/components/access-manager";
import { getAccessList } from "@/features/access/server/queries";
import { SharingToggles } from "@/features/friends/components/sharing-toggles";
import { ReminderSettings } from "@/features/reminders/components/reminder-settings";
import { getReminderSettings } from "@/features/reminders/server/queries";
import { PomodoroAlertSettings } from "@/features/sessions/components/pomodoro-alert-settings";
import { getMySharing } from "@/features/friends/server/queries";
import { DeleteAccount } from "@/features/settings/components/delete-account";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { isOwnerEmail } from "@/lib/access";
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
  const [user, settings, access, sharing, reminders] = await Promise.all([
    requireUser(),
    requireSettings(),
    getAccessList(),
    getMySharing(),
    getReminderSettings(),
  ]);
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

      <section aria-labelledby="alerts-heading" className="bg-card mt-6 rounded-xl border p-4 sm:p-6">
        <h2 id="alerts-heading" className="text-sm font-medium">
          Pomodoro alerts on this device
        </h2>
        <p className="text-muted-foreground mt-1 mb-4 text-xs">
          Saved in this browser, so your laptop and phone can differ.
        </p>
        <PomodoroAlertSettings />
      </section>

      <section
        id="reminders"
        aria-labelledby="reminders-heading"
        className="bg-card mt-6 scroll-mt-20 rounded-xl border p-4 sm:p-6"
      >
        <h2 id="reminders-heading" className="text-sm font-medium">
          Reminders
        </h2>
        <p className="text-muted-foreground mt-1 mb-4 text-xs">
          Notifications on your phone or computer, even when OttoLabs is closed.
        </p>
        <ReminderSettings settings={reminders} />
      </section>

      <section
        id="sharing"
        aria-labelledby="sharing-heading"
        className="bg-card mt-6 scroll-mt-20 rounded-xl border p-4 sm:p-6"
      >
        <h2 id="sharing-heading" className="text-sm font-medium">
          Sharing with friends
        </h2>
        <p className="text-muted-foreground mt-1 mb-4 text-xs">
          Applies to everyone you are friends with. Changes take effect immediately.
        </p>
        <SharingToggles initial={sharing} />
      </section>

      {access ? (
        <section aria-labelledby="access-heading" className="bg-card mt-6 rounded-xl border p-4 sm:p-6">
          <h2 id="access-heading" className="text-sm font-medium">
            Access
          </h2>
          <p className="text-muted-foreground mt-1 mb-4 text-xs">
            Only you see this, as an owner. Owners come from ALLOWED_EMAILS in Vercel; everyone
            else is invited here.
          </p>
          <AccessManager access={access} timeZone={settings.timezone} />
        </section>
      ) : null}

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

      <section
        aria-labelledby="delete-heading"
        className="border-destructive/30 mt-6 rounded-xl border p-4 sm:p-6"
      >
        <h2 id="delete-heading" className="text-sm font-medium">
          Delete account
        </h2>
        <p className="text-muted-foreground mt-1 mb-4 text-xs">
          Removes your account and all your data for good. Download a copy above first if you
          want to keep it.
        </p>
        <DeleteAccount email={user.email} isOwner={isOwnerEmail(user.email)} />
      </section>
    </PageContainer>
  );
}

"use client";

import { BellRing, Smartphone, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { subscribeThisDevice, thisDeviceSubscribed } from "@/features/reminders/lib/subscribe";
import {
  removeSubscription,
  saveSubscription,
  sendTestPush,
  updateReminderPrefs,
} from "@/features/reminders/server/actions";
import type { ReminderSettings as Settings } from "@/features/reminders/server/queries";

type Prefs = Settings["prefs"];

const OPTIONS: { key: keyof Prefs; label: string; description: string }[] = [
  {
    key: "remindDeadlines",
    label: "Deadlines tomorrow",
    description: "One evening reminder listing tasks due the next day.",
  },
  {
    key: "remindDailyGoal",
    label: "Daily goal",
    description: "In the evening, if you are short of today's goal: how far off you are.",
  },
  {
    key: "notifyRoomActivity",
    label: "Room activity",
    description: "When someone in one of your rooms starts focusing there. At most once per person per 30 minutes.",
  },
];

const SUBSCRIBE_ERRORS: Record<string, string> = {
  unsupported:
    "This browser cannot receive push here. On iPhone and iPad, add OttoLabs to your Home Screen (iOS 16.4 or later) and open it from there.",
  denied: "Notifications are blocked for this site. Allow them in your browser's site settings, then try again.",
  "no-key": "Push is not set up on the server yet.",
  failed: "This browser could not subscribe. Try again, or try another browser.",
};

export function ReminderSettings({ settings }: { settings: Settings }) {
  const [prefs, setPrefs] = useState(settings.prefs);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  // Only the browser knows whether it holds a subscription.
  useEffect(() => {
    let live = true;
    void thisDeviceSubscribed().then((on) => live && setSubscribed(on));
    return () => {
      live = false;
    };
  }, []);

  if (!settings.configured) {
    return (
      <p className="text-muted-foreground text-sm">
        Push is not set up on the server yet: the VAPID keys are missing from the environment
        variables. Once they are added and the app is redeployed, this section switches on.
      </p>
    );
  }

  function enableThisDevice() {
    startTransition(async () => {
      const result = await subscribeThisDevice();
      if (!result.ok) {
        toast.error(SUBSCRIBE_ERRORS[result.reason]);
        return;
      }
      const saved = await saveSubscription(result.subscription);
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      setSubscribed(true);
      toast.success("Reminders will arrive on this device.");
    });
  }

  function flip(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    const previous = prefs;
    setPrefs(next);
    startTransition(async () => {
      const result = await updateReminderPrefs(next);
      if (!result.ok) {
        setPrefs(previous);
        toast.error(result.error);
      }
    });
  }

  function test() {
    startTransition(async () => {
      const result = await sendTestPush();
      if (result.ok) toast.success(`Sent to ${result.data} ${result.data === 1 ? "device" : "devices"}.`);
      else toast.error(result.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeSubscription({ id });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {subscribed ? (
          <span className="text-success inline-flex items-center gap-1.5 text-sm">
            <BellRing className="size-4" aria-hidden />
            On for this device
          </span>
        ) : (
          <Button className="cursor-pointer gap-1.5" onClick={enableThisDevice} disabled={pending || subscribed === null}>
            <BellRing className="size-4" aria-hidden />
            Turn on for this device
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={test}
          disabled={pending || settings.devices.length === 0}
        >
          Send a test
        </Button>
      </div>

      <div className="space-y-4">
        {OPTIONS.map((option) => (
          <div key={option.key} className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor={`remind-${option.key}`} className="cursor-pointer">
                {option.label}
              </Label>
              <p className="text-muted-foreground mt-1 text-xs">{option.description}</p>
            </div>
            <Switch
              id={`remind-${option.key}`}
              checked={prefs[option.key]}
              onCheckedChange={(on) => flip(option.key, on)}
              disabled={pending}
              className="mt-0.5 cursor-pointer"
            />
          </div>
        ))}
      </div>

      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          Devices that receive reminders · {settings.devices.length}
        </div>
        {settings.devices.length === 0 ? (
          <p className="text-muted-foreground text-sm">None yet. Turn reminders on above on each device you want them on.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {settings.devices.map((device) => (
              <li key={device.id} className="flex items-center gap-3 px-3 py-2">
                <Smartphone className="text-muted-foreground size-4" aria-hidden />
                <span className="flex-1 truncate text-sm">{device.label}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive size-8 cursor-pointer"
                  aria-label={`Stop reminders on ${device.label}`}
                  onClick={() => remove(device.id)}
                  disabled={pending}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        Evening reminders are checked once a day at 12:00 UTC, which is 19:00 in Jakarta and 20:00
        in Beijing; anyone for whom that is not evening is skipped that day. They arrive even when
        the app is closed.
      </p>
    </div>
  );
}

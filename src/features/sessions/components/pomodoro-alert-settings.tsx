"use client";

import { BellRing } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAlertPrefs } from "@/features/sessions/hooks/use-pomodoro-alerts";
import {
  enableNotifications,
  notificationState,
  type NotificationState,
  showNotification,
  writeAlertPrefs,
} from "@/features/sessions/lib/alerts";
import { playChime } from "@/features/sessions/lib/chime";

const noop = () => () => {};

const BLOCKED_HELP: Partial<Record<NotificationState, string>> = {
  denied:
    "Notifications are blocked for this site. Allow them in your browser's site settings (the icon left of the address), then switch this on again.",
  unsupported:
    "This browser cannot show notifications here. On iPhone and iPad, add OttoLabs to your Home Screen first and open it from there.",
};

/** Per device: stored in this browser, not your account. */
export function PomodoroAlertSettings() {
  const prefs = useAlertPrefs();
  // Read after hydration only: the server cannot know this browser's permission.
  const initialPermission = useSyncExternalStore(noop, notificationState, () => "default" as NotificationState);
  const [permission, setPermission] = useState<NotificationState | null>(null);
  const state = permission ?? initialPermission;
  const [asking, setAsking] = useState(false);

  async function toggleNotify(on: boolean) {
    if (!on) {
      writeAlertPrefs({ ...prefs, notify: false });
      return;
    }
    setAsking(true);
    const result = await enableNotifications();
    setAsking(false);
    setPermission(result);
    writeAlertPrefs({ ...prefs, notify: result === "granted" });
    if (result === "granted") toast.success("Notifications on for this device.");
  }

  function test() {
    if (prefs.sound) playChime("break");
    if (prefs.notify && state === "granted") {
      void showNotification(
        { title: "Focus done: test", body: "This is what the end of a focus interval looks like." },
        "ottolabs-test",
      );
    }
    if (!prefs.sound && !(prefs.notify && state === "granted")) {
      toast.message("Both alerts are off, so there is nothing to test.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor="alert-sound" className="cursor-pointer">
            Sound when a phase ends
          </Label>
          <p className="text-muted-foreground mt-1 text-xs">
            A short bell: falling notes for a break, rising for back to work. Rings in a background
            tab too, once you have clicked anywhere in the app.
          </p>
        </div>
        <Switch
          id="alert-sound"
          checked={prefs.sound}
          onCheckedChange={(on) => writeAlertPrefs({ ...prefs, sound: on })}
          className="mt-0.5 cursor-pointer"
        />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor="alert-notify" className="cursor-pointer">
            Notification when a phase ends
          </Label>
          <p className="text-muted-foreground mt-1 text-xs">
            {BLOCKED_HELP[state] ??
              "Shown when OttoLabs is not the tab you are looking at. Your browser asks for permission the first time you switch this on."}
          </p>
        </div>
        <Switch
          id="alert-notify"
          checked={prefs.notify && state === "granted"}
          disabled={asking || state === "unsupported"}
          onCheckedChange={(on) => void toggleNotify(on)}
          className="mt-0.5 cursor-pointer"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" className="cursor-pointer gap-1.5" onClick={test}>
          <BellRing className="size-3.5" aria-hidden />
          Test
        </Button>
        <p className="text-muted-foreground text-xs">
          On a phone, alerts need the app open: a locked phone or a backgrounded app is paused by
          the system, and the bell rings when you come back.
        </p>
      </div>
    </div>
  );
}

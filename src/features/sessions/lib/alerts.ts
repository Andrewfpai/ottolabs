/**
 * Telling you a Pomodoro phase has ended: a sound, and — if you switched it on
 * — a system notification.
 *
 * Alerting is deliberately separate from *transitioning*. The engine only
 * starts a break or resumes work while the tab is in front (AGENTS rule 12),
 * but the moment you most need to hear "time's up" is when you are in another
 * tab or app. So the alert fires when the phase ends wherever you are, and
 * the transition still waits until you are back to see it.
 *
 * Preferences are per device (localStorage): the laptop on your desk and the
 * phone in your pocket can reasonably want different things, and the
 * notification permission is per device anyway.
 */
import type { PomodoroConfig } from "@/db/schema";
import type { PomodoroPhaseKind } from "@/features/sessions/lib/pomodoro";

export type AlertPrefs = { sound: boolean; notify: boolean };

/** Sound on, notifications off until you opt in: no permission prompt unasked. */
export const DEFAULT_ALERT_PREFS: AlertPrefs = { sound: true, notify: false };

const PREFS_KEY = "ottolabs:pomodoro-alerts";
const CLAIM_PREFIX = "ottolabs:alerted:";
const CLAIM_TTL_MS = 24 * 3_600_000;

// ── Preferences, as an external store for useSyncExternalStore ─────────────

let cached: AlertPrefs | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Private mode or blocked site data.
    return null;
  }
}

export function parseAlertPrefs(raw: string | null): AlertPrefs {
  if (!raw) return DEFAULT_ALERT_PREFS;
  try {
    const value = JSON.parse(raw) as Partial<AlertPrefs>;
    return {
      sound: typeof value.sound === "boolean" ? value.sound : DEFAULT_ALERT_PREFS.sound,
      notify: typeof value.notify === "boolean" ? value.notify : DEFAULT_ALERT_PREFS.notify,
    };
  } catch {
    return DEFAULT_ALERT_PREFS;
  }
}

export function readAlertPrefs(): AlertPrefs {
  cached ??= parseAlertPrefs(storage()?.getItem(PREFS_KEY) ?? null);
  return cached;
}

export function writeAlertPrefs(prefs: AlertPrefs): void {
  cached = prefs;
  try {
    storage()?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Kept for this page's lifetime even if it cannot be saved.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeAlertPrefs(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changed them.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PREFS_KEY) return;
    cached = null;
    listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

// ── One alert per phase, across tabs ───────────────────────────────────────

/** Identifies one phase of one session: the same in every tab. */
export function phaseKey(sessionId: string, kind: PomodoroPhaseKind, completedCycles: number): string {
  return `${sessionId}:${kind}:${completedCycles}`;
}

/**
 * True for the first caller per phase, false for every later one — including
 * other tabs of the app, so two open tabs ring once, not twice.
 */
export function claimAlert(key: string, now: number = Date.now()): boolean {
  const store = storage();
  if (!store) return true;
  try {
    const name = CLAIM_PREFIX + key;
    if (store.getItem(name)) return false;
    store.setItem(name, String(now));
    pruneClaims(store, now);
    return true;
  } catch {
    return true;
  }
}

function pruneClaims(store: Storage, now: number): void {
  for (let i = store.length - 1; i >= 0; i--) {
    const name = store.key(i);
    if (!name?.startsWith(CLAIM_PREFIX)) continue;
    if (now - Number(store.getItem(name)) > CLAIM_TTL_MS) store.removeItem(name);
  }
}

// ── What the notification says ─────────────────────────────────────────────

export function phaseEndMessage(input: {
  ended: PomodoroPhaseKind;
  nextBreakIsLong: boolean;
  config: PomodoroConfig;
  trackTitle: string;
}): { title: string; body: string } {
  const { ended, nextBreakIsLong, config, trackTitle } = input;
  if (ended === "work") {
    const minutes = nextBreakIsLong ? config.longBreakMinutes : config.breakMinutes;
    return {
      title: `Focus done: ${trackTitle}`,
      body: `Time for a ${minutes}-minute ${nextBreakIsLong ? "long break" : "break"}.`,
    };
  }
  return {
    title: "Break's over",
    body: `Back to ${trackTitle} for ${config.workMinutes} minutes.`,
  };
}

// ── Notifications ──────────────────────────────────────────────────────────

export type NotificationState = "unsupported" | "default" | "granted" | "denied";

export function notificationState(): NotificationState {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Android and iOS only show notifications through a service worker (the
 * `Notification` constructor throws there), so every platform goes through
 * one. It handles notifications only — no fetch handler, no offline cache.
 */
async function notificationWorker(): Promise<ServiceWorkerRegistration | null> {
  if (notificationState() === "unsupported") return null;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** Ask for permission — only ever from a click on the switch, never unprompted. */
export async function enableNotifications(): Promise<NotificationState> {
  if (notificationState() === "unsupported") return "unsupported";
  await notificationWorker();
  return Notification.requestPermission();
}

export async function showNotification(message: { title: string; body: string }, tag: string): Promise<void> {
  if (notificationState() !== "granted") return;
  const registration = await notificationWorker();
  if (!registration) return;
  try {
    await registration.showNotification(message.title, {
      body: message.body,
      // One notification per phase even if two tabs race past the claim.
      tag,
      icon: "/icon/192",
      badge: "/icon/192",
      data: { url: "/dashboard" },
    });
  } catch {
    // Permission revoked between the check and the call.
  }
}

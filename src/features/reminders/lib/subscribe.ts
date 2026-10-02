/**
 * Subscribing this browser to server-sent reminders (Web Push). Browser-only.
 */
import { notificationState, notificationWorker } from "@/features/sessions/lib/alerts";

/** The VAPID public key, base64url, as the Push API wants it: bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type SubscribeResult =
  | { ok: true; subscription: { endpoint: string; p256dh: string; auth: string } }
  | { ok: false; reason: "unsupported" | "denied" | "no-key" | "failed" };

/** Ask permission (from a click), subscribe, and return what the server stores. */
export async function subscribeThisDevice(): Promise<SubscribeResult> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return { ok: false, reason: "no-key" };
  if (notificationState() === "unsupported" || !("PushManager" in window)) return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  const registration = await notificationWorker();
  if (!registration) return { ok: false, reason: "failed" };

  try {
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        // Every push shows a notification; browsers require this promise.
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      }));
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return { ok: false, reason: "failed" };
    return { ok: true, subscription: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth } };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Whether this browser already holds a push subscription. */
export async function thisDeviceSubscribed(): Promise<boolean> {
  if (notificationState() !== "granted" || !("PushManager" in window)) return false;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return Boolean(await registration?.pushManager.getSubscription());
}

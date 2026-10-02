/*
 * OttoLabs service worker — notifications only.
 *
 * Android and iOS can only show web notifications through a service worker,
 * so this exists for that and nothing else. There is deliberately no fetch
 * handler and no cache: the app depends on the server's clock and data, and
 * an offline copy would only show stale timers.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Clicking a notification brings an open OttoLabs window to the front, or
// opens one. Only same-origin paths are ever opened.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = event.notification.data && event.notification.data.url;
  const url = typeof requested === "string" && requested.startsWith("/") ? requested : "/dashboard";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

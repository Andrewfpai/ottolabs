/*
 * OttoLabs service worker — notifications only.
 *
 * Android and iOS can only show web notifications through a service worker,
 * and server-sent reminders (Web Push) arrive here, so this exists for that
 * and nothing else. There is deliberately no fetch
 * handler and no cache: the app depends on the server's clock and data, and
 * an offline copy would only show stale timers.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Reminders pushed by the server (deadlines, daily goal, room activity). The
// payload is JSON built by the server: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let message = { title: "OttoLabs", body: "", url: "/dashboard", tag: "ottolabs" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // An empty or malformed push still shows something rather than failing.
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: "/icon/192",
      badge: "/icon/192",
      data: { url: message.url },
    }),
  );
});

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
        // A reminder points somewhere specific (a room, your tasks); a
        // Pomodoro alert does not, and leaves you where you were.
        if (requested && "navigate" in open) await open.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

/* Push notifications service worker for Vinné Taxi drivers */
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", (event) => {
  let payload = { title: "▸ NOVÁ ZAKÁZKA", body: "Nová jízda čeká" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {
    try { payload.body = event.data.text(); } catch (_) {}
  }
  const opts = {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200, 100, 400],
    tag: payload.tag || "vinne-taxi-order",
    renotify: true,
    requireInteraction: !!payload.priority,
    data: { url: payload.url || "/driver" },
  };
  event.waitUntil(self.registration.showNotification(payload.title, opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/driver";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) { c.navigate(url); return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});

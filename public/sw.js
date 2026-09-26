// Strive Elite service worker. Its only job is Web Push: receive a push
// event even while the app is closed, show a real system notification, and
// send a tap on it to the right place in the app. No offline caching here
// on purpose - the app itself is always live data, nothing to cache stale.

self.addEventListener("push", (event) => {
  let data = { title: "Strive Elite", body: "You've got an update.", url: "/dashboard" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // non-JSON payload: fall back to the defaults above
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/strive-logo-512.png",
      badge: "/strive-logo-512.png",
      data: { url: data.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

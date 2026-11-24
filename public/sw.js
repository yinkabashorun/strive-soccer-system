// Strive Elite service worker. Its only job is Web Push: receive a push
// event even while the app is closed, show a real system notification, and
// send a tap on it to the right place in the app. No offline caching here
// on purpose - the app itself is always live data, nothing to cache stale.
//
// What a push carries (lib/elite/push.ts webPushBody, built from the notice
// in lib/elite/notices.ts): title, body, url (a page of ours), tag (a later
// notification with the same tag replaces the earlier one instead of
// piling up) and silent (a quiet delivery: no sound, no vibration).

// A path on our own site, or the front door. Never another address, and
// never a page that may not exist for this account.
function ownPath(url) {
  return typeof url === "string" && /^\/(?!\/)[^\\]*$/.test(url) ? url : "/";
}

self.addEventListener("push", (event) => {
  let data = { title: "Strive Elite", body: "Something new is in your app.", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // non-JSON payload: fall back to the defaults above
  }

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/strive-logo-512.png",
    silent: data.silent === true,
    data: { url: ownPath(data.url) },
  };
  if (typeof data.tag === "string" && data.tag) {
    options.tag = data.tag;
    options.renotify = false;
  }
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = ownPath(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).pathname === url && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

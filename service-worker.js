
const CACHE_NAME = "usman-yobe-talk-show-v86";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./app-services.js"
];

// INSTALL
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

// ACTIVATE
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

// FETCH - OFFLINE SUPPORT
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);

        if (cached) return cached;

        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }

        return new Response(
          "Offline - Please connect to the internet.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain"
            }
          }
        );
      })
  );
});

// PUSH NOTIFICATIONS
self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: "USMAN YOBE TALK SHOW",
      body: event.data ? event.data.text() : "Akwai sabon bayani."
    };
  }

  const title = data.title || "USMAN YOBE TALK SHOW";

  const options = {
    body: data.body || "Akwai sabon labari a tasharmu.",
    icon: "./74556.png",
    badge: "./74556.png",
    tag: data.tag || "usman-yobe-news",
    renotify: true,
    data: {
      url: data.url || "./"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// WHEN USER CLICKS NOTIFICATION
self.addEventListener("notificationclick", event => {
  event.notification.close();

  const target = new URL(
    event.notification.data?.url || "./",
    self.registration.scope
  );

  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(clients => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target.href);
          return client.focus();
        }
      }

      return self.clients.openWindow(target.href);
    })
  );
});

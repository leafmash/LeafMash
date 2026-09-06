importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

const CACHE_NAME = "leafmash-shell-v3";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/leafmash-192.png",
  "/icons/leafmash-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(url).then((res) => cachePut(cache, url, res)).catch(() => {})
        )
      )
    ).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

async function cachePut(cache, request, response) {
  try {
    await cache.put(request, response);
  } catch (_) {
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const networkFetch = fetch(request).then((res) => {
      cachePut(cache, request, res.clone());
      return res;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(networkFetch);
      return cached;
    }

    return (await networkFetch) || (await caches.match("/index.html"));
  })());
});

firebase.initializeApp({
  apiKey: "AIzaSyD-rHKO1f8FSjaUVEilN27BXckeIAuMpBk",
  authDomain: "leafmash-app.firebaseapp.com",
  projectId: "leafmash-app",
  storageBucket: "leafmash-app.firebasestorage.app",
  messagingSenderId: "397042984769",
  appId: "1:397042984769:web:80d7e17cf7f0ad2d77e3c0"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || "LeafMash";
  const options = {
    body: payload.data?.body || "",
    icon: "/icons/leafmash-192.png",
    badge: "/icons/leafmash-badge.png",
    data: { url: payload.data?.url || "/" }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.postMessage({ type: "leafmash-notification-click", url: targetUrl });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

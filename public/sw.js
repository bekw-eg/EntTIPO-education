/**
 * Service Worker for ENT TIPO PWA.
 * Caches public static assets; personal pages and API responses stay on the network.
 */

const CACHE_NAME = "ent-tipo-static-v2";
const PRECACHE_ASSETS = [
  "/manifest.json",
  "/icon.svg",
  "/offline.html",
];

// 1. Install event: Pre-cache essential app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("Service Worker pre-caching partial warning:", err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate event: Clean up old cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith("ent-tipo-") && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch event: Strategy routing
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests, chrome-extension, and localhost development
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.protocol.startsWith("chrome-extension") ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1"
  ) {
    return;
  }

  // Never read or write a shared cache for account data, including auth endpoints.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  // A. Static assets (JS, CSS, fonts, KaTeX fonts, icons): Cache-First
  if (
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // B. Private pages must never survive an account change in a shared cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .catch(async () => {
          const offlinePage = await caches.match("/offline.html");
          if (offlinePage) return offlinePage;
          return new Response("Нет подключения к сети", { status: 503 });
        })
    );
    return;
  }

  // React Server Component responses can also contain account data.
  event.respondWith(fetch(request, { cache: "no-store" }));
});

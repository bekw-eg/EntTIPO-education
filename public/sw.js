/**
 * Service Worker for ENT TIPO PWA.
 * Enables offline caching of KaTeX assets, pages, styles, and API responses.
 */

const CACHE_NAME = "ent-tipo-v1.0.0";
const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/topics",
  "/practice",
  "/geometry",
  "/mistakes",
  "/statistics",
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
          if (key !== CACHE_NAME) {
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

  // Ignore non-GET requests and chrome-extension
  if (request.method !== "GET" || url.protocol.startsWith("chrome-extension")) {
    return;
  }

  // A. Static assets (JS, CSS, fonts, KaTeX fonts, icons): Cache-First
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.includes("fonts") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2")
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

  // B. Navigation requests (HTML pages): Network-First, fallback to Cache or offline.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offlinePage = await caches.match("/offline.html");
          if (offlinePage) return offlinePage;
          return caches.match("/");
        })
    );
    return;
  }

  // C. API requests: Network-First with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Default: Network with Cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

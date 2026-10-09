// Retirement worker: keep all personal requests network-only and remove old caches.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith("ent-tipo-")) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request, { cache: "no-store" }).catch(error => {
    if (event.request.mode === "navigate") return new Response('<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synaq</title><body><h1>Нет подключения</h1><p>Для пробника и сохранения ответов восстановите сеть.</p><a href="/exam">Открыть пробник</a></body></html>', { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    throw error;
  }));
});

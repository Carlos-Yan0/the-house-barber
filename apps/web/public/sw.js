const url = new URL(self.location.href);
const appVersion = url.searchParams.get("appVersion") || "dev";
const staticCacheName = `thb-static-${appVersion}`;
const runtimeCacheName = `thb-runtime-${appVersion}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(staticCacheName).then((cache) =>
      cache.addAll([
        "/",
        "/manifest.webmanifest",
        "/pwa-icon.svg",
        "/pwa-maskable.svg",
      ])
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("thb-static-") ||
                key.startsWith("thb-runtime-")
            )
            .filter(
              (key) => key !== staticCacheName && key !== runtimeCacheName
            )
            .map((key) => caches.delete(key))
        )
      ),
    ])
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(runtimeCacheName).then((cache) => {
            cache.put("/", responseClone);
          });
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(runtimeCacheName);
          return (await cache.match("/")) || caches.match("/");
        })
    );
    return;
  }

  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(runtimeCacheName).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});

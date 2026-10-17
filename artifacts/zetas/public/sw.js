const CACHE_NAME = "zetas-static-v1";
const APP_SHELL = ["/manifest.webmanifest", "/icon.svg", "/offline.html"];
const PRIVATE_OR_API_PATH = /^\/(?:api|auth|session|account)(?:\/|$)/i;
const STATIC_TYPES = [
  "text/css",
  "application/javascript",
  "text/javascript",
  "image/",
  "font/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("zetas-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match("/offline.html");
      }),
    );
    return;
  }

  if (PRIVATE_OR_API_PATH.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then(async (response) => {
        const contentType = response.headers.get("content-type") || "";
        const cacheControl = response.headers.get("cache-control") || "";
        const isCacheable =
          response.ok &&
          !response.headers.has("set-cookie") &&
          !/no-store|private/i.test(cacheControl) &&
          STATIC_TYPES.some((type) => contentType.startsWith(type));

        if (isCacheable) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      });

      return cached || network;
    }),
  );
});

const CACHE_VERSION = "homerow-v4";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const withBase = (value) => {
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${scopePath}${path}`;
};
const APP_SHELL = [withBase("/"), withBase("/manifest.webmanifest"), withBase("/favicon.svg"), withBase("/favicon.ico"), withBase("/pwa-192.png"), withBase("/pwa-512.png")];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith(withBase("/api/"))) {
    return;
  }

  // Backward-compatibility for older cached bundles that still import from
  // /assets/*. New builds serve hashed files under /_build/assets/*.
  if (url.pathname.startsWith(withBase("/assets/"))) {
    const rewritten = new URL(request.url);
    rewritten.pathname = rewritten.pathname.replace(withBase("/assets/"), withBase("/_build/assets/"));
    event.respondWith(
      fetch(rewritten.toString())
        .then((response) => {
          if (!response || !response.ok) return fetch(request);
          return response;
        })
        .catch(() => fetch(request))
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match(withBase("/"));
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});

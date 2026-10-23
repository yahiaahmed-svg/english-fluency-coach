const CACHE = "fluency-pro-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./cloud.js",
  "./data.js",
  "./auth-patch.js",
  "./speech-local-patch.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  // الصفحات: هات أحدث نسخة من الإنترنت الأول
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE).then(cache => {
            cache.put("./index.html", copy);
          });

          return response;
        })
        .catch(() => caches.match("./index.html"))
    );

    return;
  }

  // باقي الملفات: حاول تجيب أحدث نسخة ثم استخدم الكاش لو مفيش نت
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const copy = response.clone();

          caches.open(CACHE).then(cache => {
            cache.put(event.request, copy);
          });
        }

        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

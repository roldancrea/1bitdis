// Service worker mínimo: permite jugar sin conexión una vez cargado.
const CACHE = "niebla-v4";
const FILES = [
  "./", "index.html", "style.css?v=4", "manifest.webmanifest", "icons/icon.svg",
  "js/story.js?v=4", "js/render.js?v=4", "js/engine.js?v=4", "audio/chiptune.js?v=4",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Red primero, caché como respaldo
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

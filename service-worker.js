const CACHE_NAME = "afinador-cache-v1";
const urlsToCache = [
    "./",
    "./index.html",
    "./manifest.json",
    "./favicon-192x192.png",
    "./favicon-512x512.png",
    "./styles.css", // Adicione outros arquivos necessários
    "./script.js"   // Adicione outros arquivos necessários
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
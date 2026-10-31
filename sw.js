const CACHE = "ti-obras-cache-v3";
const ARQUIVOS = ["./", "./index.html", "./script.js", "./style.css", "./manifest.json"];

self.addEventListener("install", (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys()
            .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

// Sempre tenta a internet primeiro; só usa o cache se estiver offline
self.addEventListener("fetch", (e) => {
    if (e.request.method !== "GET") return;
    e.respondWith(
        fetch(e.request)
            .then((resp) => {
                const copia = resp.clone();
                caches.open(CACHE).then((c) => c.put(e.request, copia));
                return resp;
            })
            .catch(() => caches.match(e.request))
    );
});
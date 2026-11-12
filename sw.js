const CACHE = "ti-obras-cache-v4";
const ARQUIVOS = [
    "./",
    "./index.html",
    "./script.js",
    "./style.css",
    "./manifest.json",
    "./logo.jpg"
];

self.addEventListener("install", (e) => {
    self.skipWaiting();
    // Cada arquivo é guardado separadamente: se um deles não existir,
    // os outros continuam sendo guardados (com addAll, um arquivo ausente faria todos falharem).
    e.waitUntil(
        caches.open(CACHE).then((c) =>
            Promise.all(ARQUIVOS.map((url) => c.add(new Request(url, { cache: "reload" })).catch(() => {})))
        )
    );
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
    const req = e.request;
    if (req.method !== "GET") return;
    if (req.headers.has("range")) return;

    const url = new URL(req.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    e.respondWith(
        fetch(req, { cache: "no-cache" })
            .then((resp) => {
                // Só guarda respostas válidas (evita erro 404/500 e respostas parciais no cache)
                if (resp && (resp.ok || resp.type === "opaque")) {
                    const copia = resp.clone();
                    caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
                }
                return resp;
            })
            .catch(() =>
                caches.match(req, { ignoreSearch: true })
                    .then((r) => r || (req.mode === "navigate" ? caches.match("./index.html") : null))
                    .then((r) => r || Response.error())
            )
    );
});
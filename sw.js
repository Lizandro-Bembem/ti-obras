/* Service Worker — TI em Obras
   Cache offline + atualizações automáticas. */
const CACHE = "ti-obras-cache-v7";
const ARQUIVOS = [
    "./",
    "./index.html",
    "./script.js",
    "./style.css",
    "./manifest.json",
    "./favicon.png",
    "./logo.jpg",
    "./icon-192.png",
    "./icon-512.png",
    "./icon-maskable-512.png",
    "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE).then(async (c) => {
            // Um arquivo que falhar não derruba o restante do cache
            await Promise.allSettled(ARQUIVOS.map((a) => c.add(new Request(a, { cache: "reload" }))));
        })
    );
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys()
            .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (e) => {
    const req = e.request;
    if (req.method !== "GET") return;

    // Fontes do Google e outros domínios: deixa a internet cuidar
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    // Internet primeiro; se estiver offline, usa o cache (navegações caem na tela inicial)
    e.respondWith(
        (async () => {
            try {
                const resp = await fetch(req, { cache: "no-cache" });
                if (resp && resp.ok) {
                    const copia = resp.clone();
                    caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
                    return resp;
                }
            } catch (erro) { /* offline: usa cache abaixo */ }

            const emCache = await caches.match(req, { ignoreSearch: true });
            if (emCache) return emCache;
            if (req.mode === "navigate") {
                const inicio = await caches.match("./index.html");
                if (inicio) return inicio;
            }
            return new Response("Sem conexão e conteúdo não disponível em cache.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        })()
    );
});
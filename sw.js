const PREFIXO = 'sistema-financeiro-';
const CACHE = PREFIXO + 'v11';
const LOCAIS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './fundo.jpg'];
const EXTERNOS = [
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE).then((c) => Promise.allSettled([...LOCAIS, ...EXTERNOS].map((a) => c.add(a))))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIXO) && k !== CACHE).map((k) => caches.delete(k))))
    );
    self.clients.claim();
});

// Rede primeiro; se estiver offline, usa o cache (o Chrome exige um fetch handler para instalar o app)
self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;
    e.respondWith(
        fetch(e.request)
            .then((res) => {
                if (res && (res.ok || res.type === 'opaque')) {
                    const copia = res.clone();
                    caches.open(CACHE).then((c) => c.put(e.request, copia));
                }
                return res;
            })
            .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
    );
});
// Cho app chạy offline: lưu sẵn mọi file vào cache.
// Mở app luôn lấy từ cache (nhanh), đồng thời tải bản mới ở nền → lần mở sau sẽ là bản mới.
// Khi thêm/bớt file, cập nhật ASSETS và tăng VERSION.

const VERSION = 'v1';
const CACHE = `score-tracker-${VERSION}`;
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/grid.js',
  'js/model.js',
  'js/storage.js',
  'js/ui.js',
  'js/xlsx.js',
  'icons/favicon.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, { ignoreSearch: true })
      ?? (request.mode === 'navigate' ? await cache.match('./') : undefined);

    const network = fetch(request)
      .then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(() => cached);

    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return network;
  })());
});

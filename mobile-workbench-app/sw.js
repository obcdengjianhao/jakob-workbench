const CACHE_NAME = 'jakob-workbench-mobile-v18';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './apple-touch-icon.png',
  './app-icon-1024.png',
  './app-icon-180.png',
  './app-icon-167.png',
  './app-icon-152.png',
  './app-icon-120.png',
  './app-icon-87.png',
  './app-icon-80.png',
  './app-icon-76.png',
  './app-icon-60.png',
  './app-icon-58.png',
  './app-icon-40.png',
  './app-icon-29.png',
  './app-icon-20.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_SHELL).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 导航请求 - 缓存优先，秒开页面，后台静默更新
  if (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          // 有缓存，立即返回，后台尝试更新
          fetch(event.request).then(response => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
            }
          }).catch(() => {});
          return cached;
        }
        // 无缓存（首次打开），尝试网络，失败则用index.html兜底
        return fetch(event.request).then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        }).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // 静态资源 - 缓存优先
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});

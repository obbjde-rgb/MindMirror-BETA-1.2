// MindMirror Live 2026 - Zero-Stale Live-Update Service Worker
const CACHE_VERSION = 'mindmirror-2026-v43-live';
const STATIC_CACHE_NAME = `static-${CACHE_VERSION}`;

// Only cache truly immutable PWA brand icons / manifests offline
const PRECACHE_MEDIA_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/pwa-192x192.png',
  '/pwa-maskable-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/icon.svg'
];

const NEVER_CACHE_PREFIXES = [
  '/api/',
  '/live',
  '/src/',
  '/@vite/',
  '/@react-refresh',
  '/@fs/',
  '/@id/',
  '/node_modules/'
];

const IMMUTABLE_MEDIA_REGEX = /\.(?:png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf|eot)$/i;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_MEDIA_ASSETS.map((asset) => cache.add(asset).catch(() => {}))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== STATIC_CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve(true);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'FORCE_PURGE_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // NEVER intercept APIs, WebSockets, or Vite dev source modules (.ts/.tsx/.jsx/.mjs)
  if (
    NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
    /\.(?:tsx?|jsx?|mjs|map)$/.test(url.pathname) && (url.pathname.startsWith('/src') || url.searchParams.has('t') || url.searchParams.has('v'))
  ) {
    return;
  }

  // Navigation / HTML shell: ALWAYS strictly Network-First (never return stale HTML when server is reachable)
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => cache.put('/', clone)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          const fallback = (await caches.match('/')) || (await caches.match('/index.html'));
          if (fallback) return fallback;
          return new Response(
            '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>MindMirror Live 2026</title></head><body style="background:#02040a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>محراب العقول 2026</h2><p>جاري استعادة الاتصال بالخادم...</p></div></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // Compiled JS/CSS assets: Network-First so updates apply instantaneously without hard refresh
  if (/\.(?:js|css)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(async () => {
        const cached = await caches.match(request);
        return cached || Response.error();
      })
    );
    return;
  }

  // Static PWA icons / brand images: Stale-while-revalidate / cache fallback
  if (IMMUTABLE_MEDIA_REGEX.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return networkResponse;
        }).catch(() => Response.error());
      })
    );
  }
});

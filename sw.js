// Bump version whenever static assets change
const CACHE = 'dfg-v14';

// Derive base path from SW location so any GitHub Pages repo name works
const BASE = self.location.pathname.replace(/\/sw\.js$/, '');

const ASSETS = [
  BASE + '/daniel_finance_v6.html',
  BASE + '/manifest.json',
  BASE + '/client.json',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('message', e => {
  if(e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => {
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'NEW_VERSION' }));
      });
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Let Supabase and Google Fonts go straight to network — never cache
  if (e.request.url.includes('supabase.co') || e.request.url.includes('fonts.googleapis')) return;

  // version.json: ALWAYS bypass SW — never cache, never intercept.
  // This is the heartbeat of the auto-update system; it must always be fresh.
  if (e.request.url.includes('version.json')) return;

  // manifest.json: build dynamically from client.json
  if (e.request.url.includes('manifest.json')) {
    e.respondWith(
      fetch(BASE + '/client.json')
        .then(r => r.json())
        .then(cfg => {
          const appTitle = cfg?.client?.branding?.app_title || 'Φ Finances';
          const repo     = cfg?.client?.repo || 'dfg-finance1';
          const manifest = {
            name: appTitle,
            short_name: appTitle,
            description: appTitle,
            start_url: '/' + repo + '/daniel_finance_v6.html',
            scope: '/' + repo + '/',
            display: 'standalone',
            background_color: '#0f0f0f',
            theme_color: '#0f0f0f',
            orientation: 'portrait-primary',
            icons: [
              { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
            ],
            categories: ['finance', 'productivity'],
            lang: 'es'
          };
          return new Response(JSON.stringify(manifest), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // client.json: network-first, cache fallback for offline
  if (e.request.url.includes('client.json')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r.ok) { const cl = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)); }
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // HTML files: network-first.
  // Fetch WITH query params (?r=timestamp) so the CDN sees a unique URL and returns fresh content.
  // Cache under the CLEAN URL (no params) to avoid fragmenting the cache.
  if (e.request.url.includes('.html')) {
    const cleanUrl = e.request.url.replace(/\?.*$/, '');
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(r => {
          if (r.ok) {
            const cl = r.clone();
            caches.open(CACHE).then(c => c.put(new Request(cleanUrl), cl));
          }
          return r;
        })
        .catch(() => caches.match(new Request(cleanUrl)))
    );
    return;
  }

  // Everything else: network-first, auto-cache on success, fallback to cache
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok && e.request.method === 'GET') {
          const cl = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, cl));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});

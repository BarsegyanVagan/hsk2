// Service worker: приложение работает без интернета.
// - Файлы приложения хранятся в кэше версии VERSION. При выходе новой версии
//   приложение показывает «Доступна новая версия · Обновить».
// - data/words.json берётся сначала из сети (новые слова видны сразу), без сети — из кэша.
// При любом изменении кода увеличьте VERSION (и добавьте новые файлы в ASSETS).

const VERSION = '2.0.0';
const PREFIX = 'hsk2app-';
const CACHE = PREFIX + VERSION;
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/ui.js',
  'js/store.js',
  'js/data.js',
  'js/pinyin.js',
  'js/audio.js',
  'js/celebrate.js',
  'js/core.js',
  'js/components.js',
  'js/achievements.js',
  'js/session.js',
  'js/charts.js',
  'js/strokes.js',
  'js/pwa.js',
  'js/options.js',
  'js/screens/home.js',
  'js/screens/learn.js',
  'js/screens/combo.js',
  'js/screens/cards.js',
  'js/screens/quiz.js',
  'js/screens/blitz.js',
  'js/screens/tones.js',
  'js/screens/match.js',
  'js/screens/result.js',
  'js/screens/dict.js',
  'js/screens/word.js',
  'js/screens/stats.js',
  'js/screens/history.js',
  'js/screens/settings.js',
  'js/vendor/hanzi-writer.min.js',
  'data/words.json',
  'data/strokes.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-64.png',
];

const SCOPE = self.registration.scope;
const WORDS_URL = new URL('data/words.json', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'activate-update') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !req.url.startsWith(SCOPE)) return;

  if (url.href.split('?')[0] === WORDS_URL) {
    event.respondWith(networkFirst(event));
  } else if (req.mode === 'navigate') {
    event.respondWith(fromCache(event, SCOPE));
  } else {
    event.respondWith(fromCache(event, req));
  }
});

async function fromCache(event, key) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(key, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const res = await fetch(event.request);
    if (res && res.ok && !res.redirected && res.type === 'basic') {
      event.waitUntil(cache.put(key, res.clone()));
    }
    return res;
  } catch {
    if (event.request.mode === 'navigate') {
      const shell = await cache.match(SCOPE);
      if (shell) return shell;
    }
    return Response.error();
  }
}

async function networkFirst(event) {
  const cache = await caches.open(CACHE);
  const network = fetch(WORDS_URL, { cache: 'no-store' }).then((res) => {
    if (res && res.ok) event.waitUntil(cache.put(WORDS_URL, res.clone()));
    return res;
  });
  event.waitUntil(network.catch(() => null));
  try {
    // Медленная сеть: через 4 секунды берём кэш, а сеть обновит его в фоне
    const res = await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);
    if (res && res.ok) return res;
    throw new Error('bad response');
  } catch {
    const cached = await cache.match(WORDS_URL);
    return cached || Response.error();
  }
}

// Service Worker — Método Pleno
// Cacheia todo o app shell para funcionar 100% offline (essencial para uso em aula
// sem internet). Estratégia: cache-first para assets estáticos, com atualização em
// segundo plano; index.html sempre disponível offline como fallback de navegação.

const CACHE_VERSION = 'metodo-pleno-v8';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './css/fonts.css',
  './assets/imagens/logo_metodo_pleno_transparente.png',
  './js/utils.js',
  './js/constants.js',
  './js/db.js',
  './js/evaluation-data.js',
  './js/charts.js',
  './js/rest-timer.js',
  './js/students.js',
  './js/state.js',
  './js/settings.js',
  './js/registration.js',
  './js/payment-logic.js',
  './js/payments.js',
  './js/admin.js',
  './js/anamnesis.js',
  './js/planning.js',
  './js/execution.js',
  './js/dashboard.js',
  './js/evaluation.js',
  './js/physical-evaluation.js',
  './js/backup.js',
  './js/app.js',
  './fonts/manrope-variable.woff2',
  './fonts/fraunces-normal-variable.woff2',
  './fonts/fraunces-italic-variable.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => {
          if (req.mode === 'navigate') return caches.match('./index.html');
          return cached;
        });
      return cached || networkFetch;
    })
  );
});

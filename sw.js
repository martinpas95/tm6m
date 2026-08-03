// Service worker cache-first: la app funciona sin internet una vez instalada.
// Al cambiar de versión (nombre de CACHE_NAME) se vuelve a descargar todo.
var CACHE_NAME = 'tm6m-v7';
var CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/storage.js',
  './js/calc.js',
  './js/ui.js',
  './js/logo.js',
  './js/pdf.js',
  './js/google.js',
  './js/home.js',
  './js/patient.js',
  './js/test.js',
  './js/recovery.js',
  './js/review.js',
  './js/report.js',
  './js/settings.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/logo-sanatorio.jpg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_FILES);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function () { return cached; });
    })
  );
});

// Service worker cache-first: la app funciona sin internet una vez instalada.
// Al cambiar de versión (nombre de CACHE_NAME) se vuelve a descargar todo.
//
// IMPORTANTE: GitHub Pages sirve los .js/.css con Cache-Control: max-age=600, así que
// aunque acá se borre todo, el navegador puede seguir sirviendo una copia vieja desde su
// propio caché HTTP (no el de este service worker) hasta que expire ese margen. Por eso
// index.html pide cada archivo local con "?v=N" (cache-busting): eso hace que el navegador
// lo trate como una URL distinta y lo baje de nuevo sí o sí. CADA VEZ que se suba un cambio
// real, hay que bumpear el mismo N en TRES lugares a la vez: CACHE_NAME acá abajo, la lista
// CORE_FILES (para que coincida exactamente con las URLs que pide index.html) y los "?v=N"
// de los <script>/<link> en index.html.
var CACHE_NAME = 'tm6m-v14';
var CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css?v=14',
  './js/storage.js?v=14',
  './js/calc.js?v=14',
  './js/ui.js?v=14',
  './js/logo.js?v=14',
  './js/pdf.js?v=14',
  './js/google.js?v=14',
  './js/home.js?v=14',
  './js/patient.js?v=14',
  './js/test.js?v=14',
  './js/recovery.js?v=14',
  './js/review.js?v=14',
  './js/report.js?v=14',
  './js/settings.js?v=14',
  './js/main.js?v=14',
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

var CACHE_NAME = 'Oyeti';
//new
var urlsToCache = [
  '/',
  'style.css',
  'main.js',
  'icons/icon-256x256.png',
  'bootstrap/js/bootstrap.min.js',
  'bootstrap/css/bootstrap.min.css',
  'Jquery/jquery-3.3.1.min.js'
];


self.addEventListener('install', function (event) {
  console.log("installing")
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache).then(function () {
          console.log('All resources have been fetched and cached.');
        });
      })
  );
});

self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (response) {
      return response || fetch(event.request);

    })
  );

});

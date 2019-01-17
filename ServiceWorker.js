var CACHE_NAME = 'Oyeti';
//new
var urlsToCache = [
  '/',
  'style.css',
  'assets/app.js',
  'assets/icons/icon-256x256.png',
  'assets/bootstrap/js/bootstrap.min.js',
  'assets/bootstrap/css/bootstrap.min.css',
  'assets/Jquery/jquery-3.3.1.min.js'
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

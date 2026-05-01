self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(key => caches.delete(key)))
        )
    );
});
self.addEventListener('fetch', (e) => {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
});
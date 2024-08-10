import { precacheAndRoute } from 'workbox-precaching';

const appVersion = __APP_VERSION__;
const CACHE_NAME = `my-app-cache-v${appVersion}`;
console.log('Service Worker Version:', appVersion);

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', (event) => {
  console.log(`Service Worker installing. Version: ${appVersion}`);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`Service Worker activating. Version: ${appVersion}`);
  
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log(`Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated.');
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('controllerchange', () => {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage('Service Worker Updated.'));
  });
});

const CACHE_NAME = 'lexiflow-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/index.tsx',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // CRITICAL: Do not intercept API calls or Supabase Auth calls
  // This prevents "Failed to fetch" errors caused by the SW trying to manage dynamic requests
  if (
    url.hostname.includes('supabase.co') || 
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('datamuse.com') ||
    event.request.method !== 'GET'
  ) {
    return; // Let the browser handle these normally
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

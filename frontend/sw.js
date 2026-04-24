const CACHE_NAME = 'efootball-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/js/api.js',
    '/js/auth.js',
    '/js/ui.js',
    '/js/app.js',
    '/js/chat.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Cache-first strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;
    
    // Skip non-GET requests and API calls
    if (request.method !== 'GET' || request.url.includes('/api/') || request.url.includes('/socket.io/')) {
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            
            return fetch(request).then((response) => {
                // Cache successful responses
                if (response.ok && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            }).catch(() => {
                // Fallback for HTML pages
                if (request.destination === 'document') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================

self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'New notification',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/icon-72x72.png',
        tag: data.tag || 'default',
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || [],
        data: data.data || {},
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'eFootball Arena', options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const { notification } = event;
    const action = event.action;
    const data = notification.data || {};

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing window or open new one
            const hadWindow = clientList.some((client) => {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    // Navigate to specific page if provided
                    if (data.url) {
                        client.navigate(data.url);
                    }
                    return true;
                }
                return false;
            });

            if (!hadWindow && clients.openWindow) {
                return clients.openWindow(data.url || '/');
            }
        })
    );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('Notification closed:', event.notification);
});
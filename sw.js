/**
 * SMVDU Floris: Progressive Web App Service Worker (sw.js)
 * High-Performance Offline Caching & Non-Blocking GIS Tile Pipeline
 * Shri Mata Vaishno Devi University, Kakryal, Katra
 */

const CACHE_NAME = 'smvdu-floris-v2.3.0';
const GIS_TILE_CACHE = 'smvdu-floris-gis-tiles-v2';

// 1. Static App Shell & Core Assets
const APP_SHELL = [
    './',
    './index.html',
    './database.html',
    './maps.html',
    './research.html',
    './safety.html',
    './manifest.json',
    './css/style.css',
    './css/database.css',
    './css/maps.css',
    './css/research.css',
    './css/safety.css',
    './js/data.js',
    './js/main.js',
    './js/database.js',
    './js/maps.js',
    './js/research.js',
    './js/safety.js'
];

// 2. External CDN Vendor Libraries
const EXTERNAL_DEPENDENCIES = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
    'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

// =========================================================================
// INSTALL LIFECYCLE
// =========================================================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[Service Worker] Pre-caching application shell...');
            await cache.addAll(APP_SHELL);

            for (const url of EXTERNAL_DEPENDENCIES) {
                try {
                    const response = await fetch(url, { mode: 'cors' });
                    if (response.ok || response.type === 'opaque') {
                        await cache.put(url, response);
                    }
                } catch (err) {
                    console.warn(`[Service Worker] CDN bypassed: ${url}`, err);
                }
            }
        }).then(() => self.skipWaiting())
    );
});

// =========================================================================
// ACTIVATE LIFECYCLE (Purge Outdated Caches & Claim Clients)
// =========================================================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME && name !== GIS_TILE_CACHE) {
                        console.log(`[Service Worker] Purging stale cache: ${name}`);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// =========================================================================
// FETCH ENGINE (Non-Blocking GIS Pipeline & Resilient Cache Delivery)
// =========================================================================
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Only intercept HTTP(S) GET operations
    if (request.method !== 'GET' || !request.url.startsWith('http')) {
        return;
    }

    // STRATEGY 1: Leaflet GIS Map Tiles (ArcGIS Online)
    // Non-blocking cache fallback to prevent aborted-request locks during pan/zoom
    if (url.hostname.includes('arcgisonline.com') || url.pathname.includes('/tile/')) {
        event.respondWith(
            caches.open(GIS_TILE_CACHE).then(async (tileCache) => {
                const cachedTile = await tileCache.match(request);
                if (cachedTile) {
                    return cachedTile;
                }

                try {
                    const networkTile = await fetch(request);
                    if (networkTile && networkTile.status === 200) {
                        tileCache.put(request, networkTile.clone());
                    }
                    return networkTile;
                } catch (fetchErr) {
                    return cachedTile || new Response('', { status: 408, statusText: 'Tile Request Aborted' });
                }
            })
        );
        return;
    }

    // STRATEGY 2: HTML Page Navigations (Network-First with Cache Fallback)
    // Guarantees immediate delivery of updated DOM/scripts while maintaining offline access
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(async (networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    const cachedPage = await caches.match(request);
                    if (cachedPage) return cachedPage;
                    return caches.match('./index.html');
                })
        );
        return;
    }

    // STRATEGY 3: Static Assets & Vendor Bundles (Cache-First with Background Update)
    event.respondWith(
        caches.match(request).then(async (cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            try {
                const networkResponse = await fetch(request);

                if (networkResponse && networkResponse.status === 200 && (
                    request.destination === 'style' ||
                    request.destination === 'script' ||
                    request.destination === 'font' ||
                    request.destination === 'image'
                )) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(request, networkResponse.clone());
                }

                return networkResponse;
            } catch (networkError) {
                throw networkError;
            }
        })
    );
});
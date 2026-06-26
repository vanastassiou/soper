/**
 * Service Worker for Soap Recipe Calculator
 * Provides offline capability with cache-first strategy for static assets
 */

// Cache version - increment to force cache invalidation on deploy
const CACHE_VERSION = 4;
const STATIC_CACHE_NAME = `soap-calc-static-v${CACHE_VERSION}`;
const DATA_CACHE_NAME = `soap-calc-data-v${CACHE_VERSION}`;

// Static assets to cache on install (cache-first).
// The arrays below are generated from the filesystem by
// `scripts/generate-sw-manifest.mjs` (run `npm run build:sw` before deploy).
// Do not edit the lines between the markers by hand — they will be overwritten.
const STATIC_ASSETS = [
    // --- BEGIN GENERATED STATIC_ASSETS (npm run build:sw) ---
    '/',
    '/index.html',
    '/styles.css',
    '/manifest.json',
    '/js/core/calculator.js',
    '/js/core/calculator.test.js',
    '/js/core/optimizer.bench.js',
    '/js/core/optimizer.js',
    '/js/core/optimizer.test.js',
    '/js/core/optimizer/cupboard.js',
    '/js/core/optimizer/dietary.js',
    '/js/core/optimizer/generation.js',
    '/js/core/optimizer/profile.js',
    '/js/core/optimizer/scoring.js',
    '/js/core/optimizer/weights.js',
    '/js/features/additives/index.js',
    '/js/features/additives/render.js',
    '/js/features/cupboard/index.js',
    '/js/features/cupboard/render.js',
    '/js/features/profileBuilder/index.js',
    '/js/features/profileBuilder/render.js',
    '/js/features/selectFats/index.js',
    '/js/features/selectFats/render.js',
    '/js/features/yolo/index.js',
    '/js/features/yolo/render.js',
    '/js/lib/cards.js',
    '/js/lib/constants.js',
    '/js/lib/dietary.js',
    '/js/lib/dietary.test.js',
    '/js/lib/references.js',
    '/js/lib/references.test.js',
    '/js/lib/validation.js',
    '/js/main.js',
    '/js/state/state.js',
    '/js/state/state.test.js',
    '/js/ui/components/itemRow.js',
    '/js/ui/components/toast.js',
    '/js/ui/finalRecipe.js',
    '/js/ui/helpers.js',
    '/js/ui/panelManager.js',
    '/js/ui/properties.js',
    '/js/ui/ui.js',
    '/js/vendor/ajv.min.js',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg',
    // --- END GENERATED STATIC_ASSETS ---
];

// Data files to cache (network-first, updated more frequently).
const DATA_ASSETS = [
    // --- BEGIN GENERATED DATA_ASSETS (npm run build:sw) ---
    '/data/colourants.json',
    '/data/equipment.json',
    '/data/fats.json',
    '/data/fatty-acids.json',
    '/data/formulas.json',
    '/data/fragrances.json',
    '/data/glossary.json',
    '/data/processes.json',
    '/data/schemas/colourants.schema.json',
    '/data/schemas/common-definitions.schema.json',
    '/data/schemas/equipment.schema.json',
    '/data/schemas/fats.schema.json',
    '/data/schemas/fatty-acids.schema.json',
    '/data/schemas/formulas.schema.json',
    '/data/schemas/fragrances.schema.json',
    '/data/schemas/glossary.schema.json',
    '/data/schemas/processes.schema.json',
    '/data/schemas/skin-care.schema.json',
    '/data/schemas/soap-performance.schema.json',
    '/data/schemas/sources.schema.json',
    '/data/schemas/tooltips.schema.json',
    '/data/skin-care.json',
    '/data/soap-performance.json',
    '/data/sources.json',
    '/data/tooltips.json',
    // --- END GENERATED DATA_ASSETS ---
];

/**
 * Cache a list of assets, logging any individual failure instead of failing
 * the whole install. `cache.addAll()` is atomic: one missing path rejects the
 * entire batch and the cache silently stays empty. Adding paths individually
 * keeps the rest of the cache populated and surfaces exactly which path failed.
 * @param {string} cacheName - Target cache
 * @param {string[]} assets - Web paths to cache
 */
async function cacheAssets(cacheName, assets) {
    const cache = await caches.open(cacheName);
    const results = await Promise.allSettled(assets.map((asset) => cache.add(asset)));
    const failed = results
        .map((result, i) => ({ result, asset: assets[i] }))
        .filter(({ result }) => result.status === 'rejected');

    for (const { result, asset } of failed) {
        console.error(`[SW] Failed to cache ${asset}:`, result.reason?.message || result.reason);
    }
    if (failed.length > 0) {
        console.error(`[SW] ${failed.length}/${assets.length} assets failed to cache in ${cacheName}`);
    }
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            cacheAssets(STATIC_CACHE_NAME, STATIC_ASSETS),
            cacheAssets(DATA_CACHE_NAME, DATA_ASSETS)
        ]).then(() => {
            console.log('[SW] Installation complete');
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old versioned caches and take control
self.addEventListener('activate', (event) => {
    const currentCaches = [STATIC_CACHE_NAME, DATA_CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('soap-calc-') && !currentCaches.includes(name))
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - cache-first for static, network-first for data
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Skip pages directory - let browser handle normally
    // These pages aren't pre-cached and should always fetch from network
    if (url.pathname.startsWith('/pages/')) {
        return;
    }

    // Data files: network-first with cache fallback
    if (url.pathname.startsWith('/data/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Clone and cache the new response
                    const responseClone = response.clone();
                    caches.open(DATA_CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Network failed, try cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Static assets: stale-while-revalidate
    // Serves cached content immediately, updates cache in background
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((response) => {
                // Don't cache non-success responses
                if (!response || response.status !== 200) {
                    return response;
                }

                // Clone and update cache in background
                const responseClone = response.clone();
                caches.open(STATIC_CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });

                return response;
            });

            // Return cached response immediately, or wait for network
            return cachedResponse || fetchPromise;
        })
    );
});

// Handle messages from the client
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

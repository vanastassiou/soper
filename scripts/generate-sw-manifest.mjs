#!/usr/bin/env node
/**
 * Generate the service-worker precache manifest from the filesystem.
 *
 * The service worker must list every asset to precache for offline use. Hand
 * maintaining that list lets it drift from the real files on disk: renamed or
 * deleted modules linger, new ones are forgotten, and `cache.addAll()` then
 * fails silently on a fresh install. This script makes the filesystem the
 * single source of truth by regenerating the arrays at deploy time.
 *
 * Usage:
 *   node scripts/generate-sw-manifest.mjs          # rewrite service-worker.js
 *   node scripts/generate-sw-manifest.mjs --check   # exit 1 if out of date
 *
 * It rewrites the lines between the AUTO-GENERATED markers in
 * `service-worker.js`. Run it (via `npm run build:sw`) before every deploy.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW_PATH = join(ROOT, 'service-worker.js');

/**
 * Recursively collect web paths ('/js/main.js', ...) under a directory.
 * @param {string} dir - Directory relative to repo root
 * @param {(name: string) => boolean} [filter] - Keep files whose basename passes
 * @returns {string[]} Sorted web paths
 */
function collect(dir, filter = () => true) {
    const abs = join(ROOT, dir);
    const out = [];
    const walk = (current) => {
        for (const entry of readdirSync(current)) {
            const full = join(current, entry);
            if (statSync(full).isDirectory()) {
                walk(full);
            } else if (filter(entry)) {
                out.push('/' + relative(ROOT, full).split(sep).join('/'));
            }
        }
    };
    walk(abs);
    return out.sort();
}

// Static assets: cache-first. The navigation root plus every shell file the app
// needs to boot offline. `pages/` is intentionally excluded; the fetch handler
// serves those from the network instead of the cache.
const staticAssets = [
    '/',
    '/index.html',
    '/styles.css',
    '/manifest.json',
    ...collect('js', (f) => f.endsWith('.js')),
    ...collect('icons')
];

// Data assets: network-first with cache fallback. Every JSON data file and schema.
const dataAssets = collect('data', (f) => f.endsWith('.json'));

/**
 * Render a JS array literal block for splicing between markers.
 * @param {string[]} items - Web paths
 * @returns {string} Indented, single-quoted, comma-terminated lines
 */
function renderArray(items) {
    return items.map((p) => `    '${p}',`).join('\n');
}

/**
 * Replace the content between a BEGIN/END marker pair.
 * @param {string} source - File contents
 * @param {string} marker - Marker name (e.g. 'STATIC_ASSETS')
 * @param {string} body - Replacement body
 * @returns {string} Updated contents
 */
function spliceMarker(source, marker, body) {
    const begin = `    // --- BEGIN GENERATED ${marker} (npm run build:sw) ---`;
    const end = `    // --- END GENERATED ${marker} ---`;
    const pattern = new RegExp(
        `${escapeRegExp(begin)}[\\s\\S]*?${escapeRegExp(end)}`
    );
    if (!pattern.test(source)) {
        throw new Error(`Marker ${marker} not found in service-worker.js`);
    }
    return source.replace(pattern, `${begin}\n${body}\n${end}`);
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const original = readFileSync(SW_PATH, 'utf8');
let updated = spliceMarker(original, 'STATIC_ASSETS', renderArray(staticAssets));
updated = spliceMarker(updated, 'DATA_ASSETS', renderArray(dataAssets));

const checkMode = process.argv.includes('--check');
if (checkMode) {
    if (updated !== original) {
        console.error(
            'ERROR: service-worker.js precache manifest is out of date.\n' +
            'Remediation: run `npm run build:sw` and commit the result.'
        );
        process.exit(1);
    }
    console.log('service-worker.js manifest is up to date.');
} else if (updated !== original) {
    writeFileSync(SW_PATH, updated);
    console.log(
        `Updated service-worker.js: ${staticAssets.length} static, ` +
        `${dataAssets.length} data assets.`
    );
} else {
    console.log('service-worker.js manifest already up to date.');
}

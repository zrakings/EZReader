/* EZReader offline app shell. Document copies live in a separate browser cache. */
const VERSION = 'ezreader-shell-v3'
const SHELL_CACHE = `${VERSION}-core`
const ASSET_CACHE = `${VERSION}-assets`
const FILE_CACHE = 'ezreader-files-v1'

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './favicon.ico',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './libarchive/worker-bundle.js',
  './libarchive/libarchive.wasm',
]

/**
 * Cache the core shell plus the content-hashed bundles referenced by the built
 * HTML. Vite filenames change on every deploy, so they cannot be listed here.
 */
async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE)
  await cache.addAll(CORE_ASSETS)

  try {
    const response = await fetch('./index.html', { cache: 'reload' })
    if (!response.ok) return
    const html = await response.text()
    const assetUrls = new Set()
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const value = match[1]
      if (!value || value.startsWith('data:') || value.startsWith('#')) continue
      const url = new URL(value, self.location.href)
      if (url.origin !== self.location.origin) continue
      if (!/\.(?:js|css|woff2?|png|svg|ico)$/i.test(url.pathname)) continue
      assetUrls.add(url.href)
    }
    await Promise.all(
      Array.from(assetUrls).map(async (url) => {
        try {
          const asset = await fetch(url, { cache: 'reload' })
          if (asset.ok) await cache.put(url, asset)
        } catch {
          // Non-fatal: the runtime cache fills this asset on first use.
        }
      }),
    )
  } catch {
    // Offline install still succeeds with the core shell.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE && key !== FILE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isCacheableAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.includes('/assets/') ||
      url.pathname.includes('/pdfjs/') ||
      url.pathname.includes('/libarchive/') ||
      url.pathname.endsWith('.woff2') ||
      url.pathname.endsWith('.woff') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.wasm'))
  )
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // A navigation goes to the network first so updates are picked up, with the
  // cached app shell as the offline fallback for any hash-router route.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(SHELL_CACHE).then((cache) => cache.put('./index.html', copy))
          }
          return response
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE)
          return (
            (await cache.match(request)) ||
            (await cache.match('./index.html')) ||
            (await cache.match('./')) ||
            new Response('EZReader is offline. Reopen the app once online to install the offline shell.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          )
        }),
    )
    return
  }

  if (!isCacheableAsset(url)) return

  event.respondWith(
    (async () => {
      const [assetCache, shellCache] = await Promise.all([
        caches.open(ASSET_CACHE),
        caches.open(SHELL_CACHE),
      ])
      const cached = (await assetCache.match(request)) || (await shellCache.match(request))
      const network = fetch(request)
        .then((response) => {
          if (response.ok) void assetCache.put(request, response.clone())
          return response
        })
        .catch(() => null)
      if (cached) {
        // Refresh in the background while serving instantly from cache.
        void network
        return cached
      }
      const response = await network
      return (
        response ||
        new Response('', { status: 504, statusText: 'Offline asset unavailable' })
      )
    })(),
  )
})

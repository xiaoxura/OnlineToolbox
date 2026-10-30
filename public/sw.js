/* Offline shell + runtime cache for OnlineToolbox.
 * Bump CACHE_VERSION when changing the caching strategy or the shell list. */
const CACHE_VERSION = 'v5'
const SHELL_CACHE = `toolbox-shell-${CACHE_VERSION}`
const RUNTIME_CACHE = `toolbox-runtime-${CACHE_VERSION}`
const SHELL = ['./', './index.html', './site.webmanifest', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE)
    await Promise.all(SHELL.map(async url => {
      try {
        const response = await fetch(url, { cache: 'reload' })
        if (response.ok) await cache.put(url, response)
      } catch {
        // A missing optional asset must not block the service worker install.
      }
    }))

    // The hashed entry JS/CSS are only discoverable from the HTML. Without
    // them the cached shell would render an empty page when offline.
    try {
      const indexResponse = await fetch('./index.html', { cache: 'reload' })
      if (indexResponse.ok) {
        await cache.put('./index.html', indexResponse.clone())
        await cache.put('./', indexResponse.clone())
        const html = await indexResponse.text()
        const assets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map(match => match[1])
        await Promise.all(assets.map(async url => {
          try {
            const response = await fetch(url, { cache: 'reload' })
            if (response.ok) await cache.put(url, response)
          } catch {
            // Keep the shell despite a single failed asset.
          }
        }))
      }
    } catch {
      // The app shell is still usable from the network when this fails.
    }

    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key !== SHELL_CACHE && key !== RUNTIME_CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

async function cacheResponse(request, response) {
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(RUNTIME_CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

async function matchCached(request) {
  // `Vary: Origin` is set by some static hosts. CORS-mode script/style
  // requests carry an Origin header, so a strict match would miss responses
  // that were cached from a same-origin fetch.
  return await caches.match(request, { ignoreVary: true }) || await caches.match(request.url, { ignoreVary: true })
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    return cacheResponse(request, response)
  } catch {
    const cached = await matchCached(request)
    if (cached) return cached
    const shell = await caches.match('./index.html')
    return shell || Response.error()
  }
}

async function cacheFirst(request) {
  try {
    const cached = await matchCached(request)
    if (cached) return cached
    const response = await fetch(request)
    return cacheResponse(request, response)
  } catch {
    return Response.error()
  }
}

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  // Hashed build assets, icons and styles never change under the same URL.
  if (/\/(assets|icons)\//.test(url.pathname) || /\.(css|js|png|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request))
  }
})

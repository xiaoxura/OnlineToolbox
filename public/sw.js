/* Offline shell + runtime cache for OnlineToolbox.
 *
 * The cache version and the list of build assets are injected by
 * scripts/build-sw.mjs after every Vite build. Each deployment gets a fresh
 * cache name. The previous build's cache is kept for one more version so a tab
 * that is still running during a deploy can finish loading its hashed chunks;
 * anything older is pruned, which keeps storage from growing without bound.
 *
 * All small build chunks are pre-cached in the background after activation so
 * an unvisited tool still opens offline. Large lazy chunks (BPE vocabularies,
 * OpenCC dictionaries, Prettier/Terser) are deliberately left out: fetching
 * them eagerly would cost megabytes for a tool most users never open. They are
 * cached on first use instead. */
const CACHE_VERSION = '__CACHE_VERSION__'
const SHELL_CACHE = `toolbox-shell-${CACHE_VERSION}`
const RUNTIME_CACHE = `toolbox-runtime-${CACHE_VERSION}`
const MANIFEST_URL = './asset-manifest.json'
const CACHE_META = './__cache-meta__'
const SHELL = ['./', './index.html', './site.webmanifest', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png']

// A chunk larger than this (uncompressed) is only fetched on demand. Keep this
// in sync with the `precache` flag in scripts/build-sw.mjs.
const PRECACHE_MAX_BYTES = 512 * 1024

async function loadManifest() {
  try {
    const response = await fetch(MANIFEST_URL, { cache: 'no-cache' })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE)
    // Timestamp this build so activate can keep one previous version (for
    // tabs that are mid-session during a deploy) and prune older ones.
    if (!(await cache.match(CACHE_META))) {
      await cache.put(CACHE_META, new Response(JSON.stringify({
        version: CACHE_VERSION,
        createdAt: Date.now()
      }), { headers: { 'Content-Type': 'application/json' } }))
    }
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

// Fetch every small build chunk once the worker is idle. Failures are ignored:
// this is a best-effort offline upgrade, never a prerequisite for using the app.
async function precacheBuildAssets() {
  const manifest = await loadManifest()
  if (!manifest?.assets?.length) return
  if (self.navigator?.connection?.saveData) return
  // Do not spend a metered/slow connection on a background warm-up.
  const effectiveType = self.navigator?.connection?.effectiveType
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return
  const cache = await caches.open(RUNTIME_CACHE)
  const pending = []
  for (const asset of manifest.assets) {
    if (!asset.precache || asset.size > PRECACHE_MAX_BYTES) continue
    pending.push(asset.url)
  }
  if (!pending.length) return
  const queue = [...pending]
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift()
      try {
        if (await cache.match(url, { ignoreVary: true })) continue
        const response = await fetch(url)
        if (response.ok && response.type === 'basic') await cache.put(url, response)
      } catch {
        // Offline or quota exceeded: the chunk stays network-only.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker))
}

async function cacheCreatedAt(version) {
  try {
    const cacheName = `toolbox-shell-${version}`
    if (!(await caches.has(cacheName))) return 0
    const cache = await caches.open(cacheName)
    const response = await cache.match(CACHE_META)
    if (!response) return 0
    const meta = await response.json()
    return Number(meta.createdAt) || 0
  } catch {
    return 0
  }
}

// Keep the current version plus the single newest previous one. Older caches
// (and unrelated cache entries) are removed. Retaining one previous build is
// deliberate: deleting it immediately would break a tab that was open during a
// deploy when it later imports a chunk whose hash only exists in the old build.
async function pruneOldVersions() {
  const keys = await caches.keys()
  const versions = new Set()
  for (const key of keys) {
    const match = /^toolbox-(?:shell|runtime)-(.+)$/.exec(key)
    if (match) versions.add(match[1])
  }
  versions.delete(CACHE_VERSION)
  const previous = await Promise.all([...versions].map(async version => ({
    version,
    createdAt: await cacheCreatedAt(version)
  })))
  previous.sort((a, b) => b.createdAt - a.createdAt)
  const keep = new Set([CACHE_VERSION, ...previous.slice(0, 1).map(item => item.version)])
  await Promise.all(keys.filter(key => {
    const match = /^toolbox-(?:shell|runtime)-(.+)$/.exec(key)
    // Leave unrelated caches on the origin alone.
    return Boolean(match) && !keep.has(match[1])
  }).map(key => caches.delete(key)))
}

// Delete runtime entries that are not part of the current build. This keeps
// the 3 MB tokenizer vocabulary (and every previous hashed chunk) from
// accumulating inside one version.
async function cleanStaleCaches(manifest) {
  await pruneOldVersions()
  if (!manifest?.assets) return
  const current = new Set(manifest.assets.map(asset => {
    try {
      return new URL(asset.url, self.location.href).pathname
    } catch {
      return asset.url
    }
  }))
  current.add(new URL(MANIFEST_URL, self.location.href).pathname)
  const cache = await caches.open(RUNTIME_CACHE)
  const requests = await cache.keys()
  await Promise.all(requests.map(request => {
    let pathname
    try {
      pathname = new URL(request.url).pathname
    } catch {
      return undefined
    }
    // Only prune build output; icons / shell files live in the shell cache.
    if (!pathname.includes('/assets/')) return undefined
    return current.has(pathname) ? undefined : cache.delete(request)
  }))
}

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const manifest = await loadManifest()
    await cleanStaleCaches(manifest)
    await self.clients.claim()
    // Do not extend activation on the pre-cache run; it continues in the
    // background and the first navigation must not wait for it.
    precacheBuildAssets()
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
    // Prefer this build's shell. `caches.match` is global and the previous
    // version's shell is retained on purpose, so an unqualified lookup could
    // pair an old index with a chunk that only exists in the new build.
    const currentShell = await caches.open(SHELL_CACHE)
    const shell = await currentShell.match('./index.html')
    if (shell) return shell
    const cached = await matchCached(request)
    if (cached) return cached
    return Response.error()
  }
}

async function cacheFirst(request) {
  try {
    const cached = await matchCached(request)
    if (cached) return cached
    // A hashed URL can still be missing after a redeploy; fall back to the
    // network rather than failing the tool outright.
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

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
 * cached on first use instead.
 *
 * Edge protection (EdgeOne bot management, for example) can answer a burst of
 * asset requests with a 200 text/html JavaScript challenge. Such a response is
 * never a valid script or stylesheet: caching it would permanently break that
 * tool for the visitor, so every write and every read validates the response
 * content type first. Pre-caching is also paced to stay below the rate that
 * triggers those challenges. */
const CACHE_VERSION = '__CACHE_VERSION__'
const SHELL_CACHE = `toolbox-shell-${CACHE_VERSION}`
const RUNTIME_CACHE = `toolbox-runtime-${CACHE_VERSION}`
const MANIFEST_URL = './asset-manifest.json'
const CACHE_META = './__cache-meta__'
const SHELL = ['./', './index.html', './site.webmanifest', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png']

// A chunk larger than this (uncompressed) is only fetched on demand. Keep this
// in sync with the `precache` flag in scripts/build-sw.mjs.
const PRECACHE_MAX_BYTES = 512 * 1024
// EdgeOne starts returning a bot challenge when dozens of cache-miss assets are
// requested at once. One request every 150 ms (~6.7 rps) stayed well below the
// threshold in production tests; the 255 small chunks still finish in ~40 s.
const PRECACHE_INTERVAL_MS = 150

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Returns the content type an asset URL must have, or null for unknown types.
function expectedContentType(url) {
  const pathname = new URL(url, self.location.href).pathname.toLowerCase()
  if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) return /(?:java|ecma)script/
  if (pathname.endsWith('.css')) return /text\/css/
  if (pathname.endsWith('.json')) return /application\/json/
  if (/\.(png|jpe?g|gif|webp|avif|svg|ico)$/.test(pathname)) return /image\//
  if (/\.(woff2?|ttf|otf)$/.test(pathname)) return /font\//
  if (pathname.endsWith('.webmanifest')) return /application\/(?:manifest\+)?json/
  return null
}

function isUsableAsset(url, response) {
  if (!response?.ok) return false
  const expected = expectedContentType(url)
  if (!expected) return true
  const contentType = (response.headers.get('content-type') || '').toLowerCase()
  return expected.test(contentType)
}

// Distinguishes the real app shell from a bot-challenge HTML page.
async function isAppShell(response) {
  if (!response?.ok) return false
  if (!/text\/html/i.test(response.headers.get('content-type') || '')) return false
  try {
    const html = await response.clone().text()
    return /id=["']app["']/.test(html) && /\/assets\//.test(html)
  } catch {
    return false
  }
}

async function fetchShellAsset(cache, url) {
  try {
    const response = await fetch(url, { cache: 'reload' })
    if (!response.ok) return
    const pathname = new URL(url, self.location.href).pathname
    const valid = /\/$|\/index\.html$/.test(pathname)
      ? await isAppShell(response)
      : isUsableAsset(url, response)
    if (valid) await cache.put(url, response)
  } catch {
    // A missing optional asset must not block the service worker install.
  }
}

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
    await Promise.all(SHELL.map(url => fetchShellAsset(cache, url)))

    // The hashed entry JS/CSS are only discoverable from the HTML. Without
    // them the cached shell would render an empty page when offline.
    try {
      const indexResponse = await fetch('./index.html', { cache: 'reload' })
      if (await isAppShell(indexResponse)) {
        await cache.put('./index.html', indexResponse.clone())
        await cache.put('./', indexResponse.clone())
        const html = await indexResponse.text()
        const assets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map(match => match[1])
        await Promise.all(assets.map(url => fetchShellAsset(cache, url)))
      }
    } catch {
      // The app shell is still usable from the network when this fails.
    }

    await self.skipWaiting()
  })())
})

// Fetch every small build chunk once the worker is idle. Failures are ignored:
// this is a best-effort offline upgrade, never a prerequisite for using the app.
// Requests are sequential with a small gap: a parallel warm-up of 250+ chunks
// looks like a bot burst to edge protection and would get challenged instead of
// cached.
async function precacheBuildAssets() {
  const manifest = await loadManifest()
  if (!manifest?.assets?.length) return
  if (self.navigator?.connection?.saveData) return
  // Do not spend a metered/slow connection on a background warm-up.
  const effectiveType = self.navigator?.connection?.effectiveType
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return
  const cache = await caches.open(RUNTIME_CACHE)
  let lastRequestAt = 0
  for (const asset of manifest.assets) {
    if (!asset.precache || asset.size > PRECACHE_MAX_BYTES) continue
    const url = asset.url
    try {
      const cached = await cache.match(url, { ignoreVary: true })
      if (cached) {
        // Drop entries left by an older worker that cached a challenge page.
        if (await isUsableAsset(url, cached)) continue
        await cache.delete(url, { ignoreVary: true })
      }
      // Space request *starts* at least PRECACHE_INTERVAL_MS apart. Sleeping a
      // fixed amount after each response made slow origins (EdgeOne is ~300 ms
      // per asset) take twice as long as necessary.
      const wait = PRECACHE_INTERVAL_MS - (Date.now() - lastRequestAt)
      if (lastRequestAt && wait > 0) await sleep(wait)
      lastRequestAt = Date.now()
      const response = await fetch(url)
      if (isUsableAsset(url, response)) await cache.put(url, response)
    } catch {
      // Offline or quota exceeded: the chunk stays network-only.
    }
  }
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

// Delete runtime entries that are not part of the current build, plus entries
// that cannot be the asset they are stored under (a challenge page cached by an
// older worker). This keeps the 3 MB tokenizer vocabulary and every previous
// hashed chunk from accumulating inside one version.
async function cleanStaleCaches(manifest) {
  await pruneOldVersions()
  const shellCache = await caches.open(SHELL_CACHE)
  const shell = await shellCache.match('./index.html')
  if (shell && !(await isAppShell(shell))) {
    await shellCache.delete('./index.html')
    await shellCache.delete('./')
  }
  // Heal the previous build's runtime cache too. It is intentionally retained
  // for tabs that are mid-session during a deploy, and an older worker may have
  // stored challenge pages there. Valid old chunks stay available.
  const runtimeNames = (await caches.keys()).filter(name => name.startsWith('toolbox-runtime-'))
  await Promise.all(runtimeNames.map(async name => {
    const cache = await caches.open(name)
    for (const request of await cache.keys()) {
      const response = await cache.match(request, { ignoreVary: true })
      if (response && !(await isUsableAsset(request.url, response))) await cache.delete(request)
    }
  }))
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
  await Promise.all(requests.map(async request => {
    let pathname
    try {
      pathname = new URL(request.url).pathname
    } catch {
      return
    }
    // Only prune build output; icons / shell files live in the shell cache.
    if (!pathname.includes('/assets/')) return
    if (!current.has(pathname)) {
      await cache.delete(request)
      return
    }
    const response = await cache.match(request, { ignoreVary: true })
    if (response && !(await isUsableAsset(request.url, response))) await cache.delete(request)
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
  if (response.type === 'basic' && isUsableAsset(request.url, response)) {
    try {
      const cache = await caches.open(RUNTIME_CACHE)
      await cache.put(request, response.clone())
    } catch {
      // Quota or storage errors must not turn a successful fetch into a failure.
    }
  }
  return response
}

async function matchCached(request) {
  // `Vary: Origin` is set by some static hosts. CORS-mode script/style
  // requests carry an Origin header, so a strict match would miss responses
  // that were cached from a same-origin fetch.
  return await caches.match(request, { ignoreVary: true }) || await caches.match(request.url, { ignoreVary: true })
}

// A poisoned entry can live in the previous build's cache, which is retained
// for tabs that are mid-session during a deploy. Evict it everywhere so a
// later lookup cannot keep returning it.
async function deleteCachedResponse(request) {
  const names = await caches.keys()
  await Promise.all(names.map(async name => {
    const cache = await caches.open(name)
    await cache.delete(request, { ignoreVary: true })
  }))
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    // Cache navigations only when they really are the app shell; a bot
    // challenge page must never become the offline fallback.
    if (await isAppShell(response)) {
      try {
        const currentShell = await caches.open(SHELL_CACHE)
        await currentShell.put('./index.html', response.clone())
        await currentShell.put('./', response.clone())
      } catch {
        // A full quota must not prevent the live page from loading.
      }
    }
    return response
  } catch {
    // Prefer this build's shell. `caches.match` is global and the previous
    // version's shell is retained on purpose, so an unqualified lookup could
    // pair an old index with a chunk that only exists in the new build.
    const currentShell = await caches.open(SHELL_CACHE)
    const shell = await currentShell.match('./index.html')
    if (shell && await isAppShell(shell)) return shell
    const cached = await matchCached(request)
    if (cached) {
      const usable = request.mode === 'navigate' ? await isAppShell(cached) : await isUsableAsset(request.url, cached)
      if (usable) return cached
      await deleteCachedResponse(request)
    }
    return Response.error()
  }
}

async function cacheFirst(request) {
  try {
    const cached = await matchCached(request)
    if (cached) {
      if (await isUsableAsset(request.url, cached)) return cached
      // A challenge page stored under an asset URL by an older worker. Evict it
      // and let this request heal from the network.
      await deleteCachedResponse(request)
    }
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

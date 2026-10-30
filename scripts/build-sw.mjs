// Post-build step for the service worker.
//
// Vite emits content-hashed chunks, so the worker cannot know their names at
// author time. This script (1) writes dist/asset-manifest.json describing the
// build, and (2) stamps a build hash into dist/sw.js. The worker uses the
// manifest to pre-cache small chunks and to delete stale ones; the hash makes
// every deployment start from a fresh cache name.
import { createHash } from 'node:crypto'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const dist = resolve('dist')
const assetsDir = resolve(dist, 'assets')
const PRECACHE_MAX_BYTES = 512 * 1024

async function walk(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...await walk(resolve(dir, entry.name), relative))
      continue
    }
    const info = await stat(resolve(dir, entry.name))
    files.push({ relative, size: info.size })
  }
  return files
}

const files = await walk(assetsDir)
if (!files.length) throw new Error('build-sw: dist/assets is empty; run vite build first')

const hash = createHash('sha256')
for (const file of files) {
  hash.update(file.relative)
  hash.update(await readFile(resolve(assetsDir, file.relative)))
}
const buildHash = hash.digest('hex').slice(0, 12)

const assets = files.map(file => ({
  url: `./assets/${file.relative}`,
  size: file.size,
  precache: file.size <= PRECACHE_MAX_BYTES
}))

const manifest = {
  buildHash,
  generatedAt: new Date().toISOString(),
  precacheMaxBytes: PRECACHE_MAX_BYTES,
  assets
}
await writeFile(resolve(dist, 'asset-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

const swPath = resolve(dist, 'sw.js')
const source = await readFile(swPath, 'utf8')
if (!source.includes('__CACHE_VERSION__')) throw new Error('build-sw: dist/sw.js is missing the __CACHE_VERSION__ placeholder')
const stamped = source.replaceAll('__CACHE_VERSION__', buildHash)
await writeFile(swPath, stamped)

const bytes = assets.reduce((total, asset) => total + asset.size, 0)
const precached = assets.filter(asset => asset.precache)
console.log(`build-sw: ${assets.length} assets (${(bytes / 1024).toFixed(0)} KB), ${precached.length} pre-cached, cache ${buildHash}`)

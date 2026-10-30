// Fails the build when generated output drifts from the registry or when a
// chunk grows past the documented budget. Keeps the SEO surface and the lazy
// loading guarantees honest without adding a CI-only service.
import { readFile, readdir, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { categories, tools } from '../src/tools/registry.js'

const dist = resolve('dist')
const failures = []
const notes = []

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function gzipSize(path) {
  return gzipSync(await readFile(path)).length
}

const indexHtml = await readFile(resolve(dist, 'index.html'), 'utf8')
if (indexHtml.includes('%TOOL_COUNT%')) failures.push('dist/index.html still contains %TOOL_COUNT%')

const manifest = await readFile(resolve(dist, 'site.webmanifest'), 'utf8')
if (manifest.includes('%TOOL_COUNT%')) failures.push('dist/site.webmanifest still contains %TOOL_COUNT%')

const toolDirs = (await readdir(resolve(dist, 'tools'), { withFileTypes: true })).filter(entry => entry.isDirectory())
if (toolDirs.length !== tools.length) failures.push(`dist/tools has ${toolDirs.length} directories, registry has ${tools.length}`)
for (const tool of tools) {
  if (!await exists(resolve(dist, 'tools', tool.id, 'index.html'))) failures.push(`missing landing page for ${tool.id}`)
  if (!await exists(resolve(dist, 'tools', tool.id, 'og.png'))) failures.push(`missing OG card for ${tool.id}`)
}

const categoryEntries = categories.filter(category => category.id !== 'all')
const categoryDirs = (await readdir(resolve(dist, 'categories'), { withFileTypes: true })).filter(entry => entry.isDirectory())
if (categoryDirs.length !== categoryEntries.length) failures.push(`dist/categories has ${categoryDirs.length} directories, registry has ${categoryEntries.length}`)
for (const category of categoryEntries) {
  if (!await exists(resolve(dist, 'categories', category.id, 'index.html'))) failures.push(`missing landing page for category ${category.id}`)
  if (!await exists(resolve(dist, 'categories', category.id, 'og.png'))) failures.push(`missing OG card for category ${category.id}`)
}

const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8')
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])
const missing = tools.filter(tool => !sitemapUrls.some(url => url.endsWith(`/tools/${tool.id}/`)))
if (missing.length) failures.push(`sitemap is missing ${missing.length} tools`)
const missingCategories = categoryEntries.filter(category => !sitemapUrls.some(url => url.endsWith(`/categories/${category.id}/`)))
if (missingCategories.length) failures.push(`sitemap is missing ${missingCategories.length} categories`)
const expectedUrls = tools.length + categoryEntries.length + 1
if (sitemapUrls.length !== expectedUrls) failures.push(`sitemap has ${sitemapUrls.length} URLs, expected ${expectedUrls}`)
notes.push(`sitemap URLs: ${sitemapUrls.length}`)

for (const asset of ['sw.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']) {
  if (!await exists(resolve(dist, asset))) failures.push(`missing ${asset}`)
}

const assets = await readdir(resolve(dist, 'assets'))
const mainJs = assets.find(name => /^index-.*\.js$/.test(name))
const mainCss = assets.find(name => /^index-.*\.css$/.test(name))
if (!mainJs) failures.push('main JS chunk not found')
if (!mainCss) failures.push('main CSS chunk not found')

if (mainJs) {
  const size = await gzipSize(resolve(dist, 'assets', mainJs))
  notes.push(`main JS (gzip): ${(size / 1024).toFixed(1)} KB`)
  if (size > 120 * 1024) failures.push(`main JS chunk is ${(size / 1024).toFixed(1)} KB gzip, budget is 120 KB`)
}
if (mainCss) {
  const size = await gzipSize(resolve(dist, 'assets', mainCss))
  notes.push(`main CSS (gzip): ${(size / 1024).toFixed(1)} KB`)
  if (size > 20 * 1024) failures.push(`main CSS chunk is ${(size / 1024).toFixed(1)} KB gzip, budget is 20 KB`)
}

let largest = { name: '', size: 0 }
for (const name of assets) {
  if (!name.endsWith('.js')) continue
  const size = await gzipSize(resolve(dist, 'assets', name))
  if (size > largest.size) largest = { name, size }
}
notes.push(`largest lazy chunk: ${largest.name} (${(largest.size / 1024).toFixed(1)} KB gzip)`)
if (largest.size > 1200 * 1024) failures.push(`lazy chunk ${largest.name} is ${(largest.size / 1024).toFixed(1)} KB gzip, budget is 1200 KB`)

for (const note of notes) console.log(`verify: ${note}`)
if (failures.length) {
  for (const failure of failures) console.error(`verify: FAIL ${failure}`)
  process.exit(1)
}
console.log(`verify: ${tools.length} tool pages, sitemap and bundle budgets OK`)

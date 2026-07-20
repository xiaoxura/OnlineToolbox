import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { categories, tools } from '../src/tools/registry.js'

const outputDir = resolve('dist')
const siteUrl = (process.env.SITE_URL || 'https://xiaoxura.github.io/OnlineToolbox/').replace(/\/?$/, '/')
const categoryNames = new Map(categories.map(category => [category.id, category.name]))

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

function toolPage(tool) {
  const title = `${tool.name} - 在线工具箱`
  const canonical = `${siteUrl}tools/${encodeURIComponent(tool.id)}/`
  const appUrl = `../../index.html#/${encodeURIComponent(tool.id)}`
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: tool.name,
    description: tool.description,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    url: canonical,
    isAccessibleForFree: true
  }).replaceAll('<', '\\u003c')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(tool.description)}。所有处理均在浏览器中完成。">
  <meta name="theme-color" content="#f4f5f8">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" type="image/svg+xml" href="../../favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(tool.description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">${schema}</script>
  <style>
    :root{color-scheme:light dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f5f8;color:#171923}
    body{margin:0;min-height:100vh;display:grid;place-items:start center;padding:12vh 24px 48px;box-sizing:border-box}
    main{width:min(680px,100%);border-top:3px solid #4f46d9;padding:28px 0;box-sizing:border-box}
    .category{color:#4f46d9;font-weight:650;font-size:13px}h1{margin:8px 0 12px;font-size:30px;letter-spacing:0}p{color:#667085;line-height:1.7}
    a{display:inline-flex;margin-top:12px;padding:10px 18px;border-radius:6px;background:#4f46d9;color:#fff;text-decoration:none;font-weight:700}
    a:focus-visible{outline:3px solid rgba(79,70,217,.48);outline-offset:3px}
    @media(prefers-color-scheme:dark){:root{background:#111216;color:#f5f6f8}.category{color:#aaa5ff}p{color:#c3c6ce}a{background:#6259d2}}
  </style>
</head>
<body>
  <main>
    <div class="category">${escapeHtml(categoryNames.get(tool.category) || '在线工具')}</div>
    <h1>${escapeHtml(tool.name)}</h1>
    <p>${escapeHtml(tool.description)}。</p>
    <p>该工具无需安装，可直接在浏览器中使用。除明确标注的联网功能外，输入数据不会离开当前设备。</p>
    <a href="${escapeHtml(appUrl)}">打开工具</a>
  </main>
</body>
</html>`
}

for (const tool of tools) {
  const directory = resolve(outputDir, 'tools', tool.id)
  await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'index.html'), toolPage(tool))
}

const urls = [siteUrl, ...tools.map(tool => `${siteUrl}tools/${encodeURIComponent(tool.id)}/`)]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`
await writeFile(resolve(outputDir, 'sitemap.xml'), sitemap)
await writeFile(resolve(outputDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`)

let index = await readFile(resolve(outputDir, 'index.html'), 'utf8')
index = index.replace('</head>', `  <link rel="canonical" href="${escapeHtml(siteUrl)}">\n  <meta property="og:url" content="${escapeHtml(siteUrl)}">\n</head>`)
await writeFile(resolve(outputDir, 'index.html'), index)
console.log(`Generated ${tools.length} SEO landing pages for ${siteUrl}`)

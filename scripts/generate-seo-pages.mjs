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
  <meta name="theme-color" content="#4263eb">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" type="image/svg+xml" href="../../favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(tool.description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">${schema}</script>
  <style>
    :root{color-scheme:light dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8f9fa;color:#212529}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}
    main{width:min(640px,100%);background:#fff;border:1px solid #d0d5dd;border-radius:16px;padding:32px;box-sizing:border-box;box-shadow:0 8px 30px rgba(0,0,0,.08)}
    .category{color:#4263eb;font-weight:600;font-size:14px}h1{margin:8px 0 12px;font-size:32px}p{color:#667085;line-height:1.7}
    a{display:inline-flex;margin-top:12px;padding:11px 20px;border-radius:8px;background:#4263eb;color:#fff;text-decoration:none;font-weight:700}
    a:focus-visible{outline:3px solid rgba(66,99,235,.4);outline-offset:3px}
    @media(prefers-color-scheme:dark){:root{background:#111827;color:#f3f4f6}main{background:#18212f;border-color:#374151}p{color:#cbd5e1}}
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

// Builds the static, crawlable surface of the site:
//   dist/tools/<id>/index.html   one landing page per tool
//   dist/tools/<id>/og.png       per-tool social card
//   dist/sitemap.xml             with content-derived lastmod
//   dist/robots.txt              with an explicit AI-crawler policy
//   dist/llms.txt / llms-full.txt  machine-readable indexes for AI engines
//
// The landing-page copy is derived by rendering each tool (scripts/tool-facts.mjs)
// rather than written by hand, so it describes the real implementation and stays
// in sync when a tool gains an option.
import { register } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync, writeSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { collectToolFacts, detectNetworkUsage } from './tool-facts.mjs'
import { renderOgCard } from './og-image.mjs'

register('./css-stub.mjs', import.meta.url)

const { categories, tools } = await import('../src/tools/registry.js')

const outputDir = resolve('dist')
const manifestPath = resolve('.seo-manifest.json')
const siteUrl = (process.env.SITE_URL || 'https://xiaoxura.github.io/OnlineToolbox/').replace(/\/?$/, '/')
const siteName = '在线工具箱'
const repoUrl = 'https://github.com/xiaoxura/OnlineToolbox'
const today = new Date().toISOString().slice(0, 10)

const categoryNames = new Map(categories.map(category => [category.id, category.name]))
const toolsByCategory = new Map()
for (const tool of tools) {
  if (!toolsByCategory.has(tool.category)) toolsByCategory.set(tool.category, [])
  toolsByCategory.get(tool.category).push(tool)
}

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const jsonLd = value => JSON.stringify(value).replaceAll('<', '\\u003c')

const toolUrl = tool => `${siteUrl}tools/${encodeURIComponent(tool.id)}/`
const appUrl = tool => `../../index.html#/${encodeURIComponent(tool.id)}`
const categoryName = tool => categoryNames.get(tool.category) || '在线工具'

const facts = await collectToolFacts(tools)
const networkTools = new Set(tools.filter(detectNetworkUsage).map(tool => tool.id))

// --- Copy derived from the rendered tool ------------------------------------

function joinList(items, separator = '、') {
  return items.filter(Boolean).join(separator)
}

// Several tools put more than one field in a single section, so their labels
// collide ("在「输入文本」、「输入文本」中…"). Fall back to the field's example
// text to tell them apart.
function describeInputs(inputs) {
  const counts = new Map()
  for (const input of inputs) counts.set(input.label, (counts.get(input.label) || 0) + 1)
  return inputs.map(input => {
    if (counts.get(input.label) === 1) return `「${input.label}」`
    return input.placeholder ? `「${input.label}」（${input.placeholder}）` : `「${input.label}」`
  })
}

function capabilityParagraph(tool, fact) {
  const sentences = []
  sentences.push(`「${tool.name}」是一款在浏览器本地运行的在线工具，${tool.description.replace(/。$/, '')}。`)

  if (fact?.modes?.length) {
    sentences.push(`工具提供 ${fact.modes.map(group => joinList(group, ' / ')).join('；')} 等模式，可在同一页面内切换。`)
  }
  if (fact?.inputs?.length) {
    sentences.push(`输入方式为${joinList(describeInputs(fact.inputs))}${fact.hasFileInput ? '，也支持直接选择本地文件' : ''}。`)
  } else if (fact?.hasFileInput) {
    sentences.push('直接从本地选择文件即可使用，文件不会上传。')
  }
  if (fact?.resultSections?.length) {
    sentences.push(`结果输出到${joinList(fact.resultSections.map(section => `「${section}」`))}。`)
  }
  if (networkTools.has(tool.id)) {
    sentences.push('该工具需要访问第三方服务，因此会发起网络请求；请求由你的浏览器直接发出。')
  } else {
    sentences.push('所有计算都在当前页面内完成，输入内容不会离开你的设备。')
  }
  return sentences.join('')
}

function usageSteps(tool, fact) {
  const steps = [`打开「${tool.name}」页面，无需注册或登录。`]
  if (fact?.hasFileInput) steps.push('选择或拖入需要处理的本地文件。')
  if (fact?.inputs?.length) {
    steps.push(`在${joinList(describeInputs(fact.inputs))}中填入或粘贴内容。`)
  }
  if (fact?.modes?.length) {
    steps.push(`按需切换${fact.modes.map(group => joinList(group, ' / ')).join('、')}等模式。`)
  }
  if (fact?.selects?.length || fact?.toggles?.length) {
    const bits = []
    if (fact.selects?.length) bits.push(joinList(fact.selects.map(select => `「${select.label}」`)))
    if (fact.toggles?.length) bits.push(joinList(fact.toggles.map(toggle => `「${toggle}」`)))
    steps.push(`调整${joinList(bits)}等选项。`)
  }
  if (fact?.actions?.length) {
    steps.push(`点击「${fact.actions[0]}」执行。`)
  } else if (fact?.hasEditableText) {
    steps.push('输入内容后结果会自动更新。')
  }
  if (fact?.resultSections?.length) {
    steps.push(`在${joinList(fact.resultSections.map(section => `「${section}」`))}查看结果，可一键复制或下载。`)
  }
  return steps
}

function buildFaq(tool, fact) {
  const faq = []
  const local = !networkTools.has(tool.id)

  faq.push({
    question: `「${tool.name}」需要注册或安装吗？`,
    answer: `不需要。「${tool.name}」是纯静态网页工具，打开浏览器即可使用，无需账号、插件或客户端。`
  })

  faq.push(local
    ? {
        question: `使用「${tool.name}」时，我的数据会被上传吗？`,
        answer: `不会。「${tool.name}」的全部计算都在你的浏览器内完成，输入内容不会发送到任何服务器。页面本身是静态资源，加载后即可离线使用。`
      }
    : {
        question: `使用「${tool.name}」时，我的数据会被上传吗？`,
        answer: `「${tool.name}」是本站少数需要联网的工具：它会把必要的查询内容发送给第三方服务（例如 IP 归属地查询）。请求由你的浏览器直接发出，不经过本站服务器。除此之外的数据处理仍在本地完成。`
      })

  if (fact?.modes?.length) {
    faq.push({
      question: `「${tool.name}」支持哪些模式？`,
      answer: `支持 ${fact.modes.map(group => group.join(' / ')).join('；')}。切换模式后重新执行即可得到对应结果。`
    })
  }

  if (fact?.selects?.length) {
    const detail = fact.selects
      .map(select => `${select.label}可选 ${select.values.join('、')}`)
      .join('；')
    faq.push({ question: `「${tool.name}」有哪些可配置的选项？`, answer: `${detail}。` })
  } else if (fact?.toggles?.length) {
    faq.push({
      question: `「${tool.name}」有哪些可配置的选项？`,
      answer: `可勾选${joinList(fact.toggles.map(toggle => `「${toggle}」`))}。`
    })
  }

  faq.push({
    question: `「${tool.name}」可以在手机上使用吗？`,
    answer: '可以。界面适配桌面端与移动端，并支持深浅色主题，在手机浏览器中同样可以正常操作。'
  })

  faq.push({
    question: `「${tool.name}」是开源的吗？`,
    answer: `是。${siteName}基于 MIT 协议开源，源码托管在 GitHub，可自行部署或二次开发。`
  })

  return faq.slice(0, 5)
}

// --- Page rendering ---------------------------------------------------------

function renderOptionsTable(fact) {
  const rows = []
  for (const select of fact?.selects || []) {
    rows.push(`<tr><th scope="row">${escapeHtml(select.label)}</th><td>${escapeHtml(select.values.join('、'))}</td></tr>`)
  }
  for (const toggle of fact?.toggles || []) {
    rows.push(`<tr><th scope="row">${escapeHtml(toggle)}</th><td>开关，可勾选</td></tr>`)
  }
  if (!rows.length) return ''
  return `
      <h2>可配置选项</h2>
      <table>
        <thead><tr><th scope="col">选项</th><th scope="col">可选值</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>`
}

function renderRelated(tool) {
  const siblings = (toolsByCategory.get(tool.category) || []).filter(other => other.id !== tool.id)
  if (!siblings.length) return ''
  const links = siblings.slice(0, 8)
    .map(other => `<li><a href="../${encodeURIComponent(other.id)}/">${escapeHtml(other.name)}</a></li>`)
    .join('')
  return `
      <h2>同类工具</h2>
      <ul class="related">${links}</ul>`
}

function toolPage(tool, fact) {
  const title = `${tool.name} - 在线免费使用 - ${siteName}`
  const canonical = toolUrl(tool)
  const faq = buildFaq(tool, fact)
  const steps = usageSteps(tool, fact)

  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: tool.name,
      description: tool.description,
      applicationCategory: 'DeveloperApplication',
      applicationSubCategory: categoryName(tool),
      operatingSystem: 'Any',
      url: canonical,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
      featureList: [
        ...(fact?.modes || []).flat(),
        ...(fact?.selects || []).map(select => select.label),
        ...(fact?.toggles || [])
      ],
      inLanguage: 'zh-CN'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: siteName, item: siteUrl },
        { '@type': 'ListItem', position: 2, name: categoryName(tool), item: `${siteUrl}#/` },
        { '@type': 'ListItem', position: 3, name: tool.name, item: canonical }
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer }
      }))
    }
  ].map(entry => `<script type="application/ld+json">${jsonLd(entry)}</script>`).join('\n  ')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(`${tool.description}。${categoryName(tool)}类在线工具，浏览器本地运行，无需注册，免费使用。`)}">
  <meta name="theme-color" content="#f4f5f8">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" type="image/svg+xml" href="../../favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(siteName)}">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(tool.description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(`${canonical}og.png`)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(tool.name)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(tool.description)}">
  <meta name="twitter:image" content="${escapeHtml(`${canonical}og.png`)}">
  ${schema}
  <style>
    :root{color-scheme:light dark;--bg:#f4f5f8;--fg:#171923;--muted:#667085;--line:#e3e5ec;--accent:#4f46d9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--fg)}
    @media(prefers-color-scheme:dark){:root{--bg:#111216;--fg:#f5f6f8;--muted:#c3c6ce;--line:#2a2d36;--accent:#aaa5ff}}
    body{margin:0;padding:0 24px 72px}
    main{width:min(760px,100%);margin:0 auto}
    .top{border-top:3px solid var(--accent);padding:28px 0 20px}
    nav[aria-label=breadcrumb]{font-size:13px;color:var(--muted);margin-bottom:14px}
    nav[aria-label=breadcrumb] a{color:var(--accent);text-decoration:none}
    nav[aria-label=breadcrumb] a:hover{text-decoration:underline}
    h1{margin:8px 0 12px;font-size:30px;letter-spacing:0;line-height:1.3}
    h2{margin:34px 0 10px;font-size:18px}
    p,li{color:var(--muted);line-height:1.75}
    ol,ul{padding-left:22px}
    .lead{font-size:16px;color:var(--fg)}
    .cta{display:inline-flex;margin:22px 0 4px;padding:12px 22px;border-radius:6px;background:var(--accent);color:#fff;text-decoration:none;font-weight:700}
    .cta:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
    table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}
    th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line)}
    th[scope=row]{color:var(--fg);font-weight:600;width:34%}
    thead th{color:var(--muted);font-weight:600;font-size:13px}
    .related{display:flex;flex-wrap:wrap;gap:8px 10px;list-style:none;padding:0;margin:12px 0}
    .related a{display:inline-block;padding:6px 12px;border:1px solid var(--line);border-radius:999px;color:var(--fg);text-decoration:none;font-size:13px}
    .related a:hover{border-color:var(--accent);color:var(--accent)}
    details{border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:8px 0}
    summary{cursor:pointer;font-weight:600;color:var(--fg)}
    details p{margin:10px 0 2px}
    footer{margin-top:44px;padding-top:18px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
    footer a{color:var(--accent)}
  </style>
</head>
<body>
  <main>
    <div class="top">
      <nav aria-label="breadcrumb">
        <a href="../../">${escapeHtml(siteName)}</a> / ${escapeHtml(categoryName(tool))} / ${escapeHtml(tool.name)}
      </nav>
      <h1>${escapeHtml(tool.name)}</h1>
      <p class="lead">${escapeHtml(capabilityParagraph(tool, fact))}</p>
      <a class="cta" href="${escapeHtml(appUrl(tool))}">打开「${escapeHtml(tool.name)}」</a>
    </div>

    <h2>怎么用</h2>
    <ol>${steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
${renderOptionsTable(fact)}
${renderRelated(tool)}
    <h2>常见问题</h2>
${faq.map(item => `    <details>
      <summary>${escapeHtml(item.question)}</summary>
      <p>${escapeHtml(item.answer)}</p>
    </details>`).join('\n')}

    <footer>
      <p>${escapeHtml(siteName)} · ${escapeHtml(categoryName(tool))} · 浏览器本地运行 · 无需登录</p>
      <p><a href="${escapeHtml(repoUrl)}" rel="noopener">MIT 开源项目</a></p>
    </footer>
  </main>
</body>
</html>`
}

// --- Emit pages, cards, and the crawl surface -------------------------------

const manifest = existsSync(manifestPath)
  ? JSON.parse(await readFile(manifestPath, 'utf8'))
  : {}
const nextManifest = {}
const sitemapEntries = []

for (const tool of tools) {
  const fact = facts.get(tool.id)
  const html = toolPage(tool, fact)
  const directory = resolve(outputDir, 'tools', tool.id)
  await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'index.html'), html)
  await writeFile(resolve(directory, 'og.png'), renderOgCard({ id: tool.id, category: tool.category }))

  // lastmod should reflect when the page's content actually changed, otherwise a
  // rebuild that touches nothing still claims every URL changed and search
  // engines learn to ignore the signal.
  const hash = createHash('sha256').update(html).digest('hex').slice(0, 16)
  const previous = manifest[tool.id]
  const lastmod = previous && previous.hash === hash ? previous.lastmod : today
  nextManifest[tool.id] = { hash, lastmod }
  sitemapEntries.push({ loc: toolUrl(tool), lastmod, changefreq: 'monthly', priority: '0.8' })
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeHtml(siteUrl)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${sitemapEntries.map(entry => `  <url>
    <loc>${escapeHtml(entry.loc)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>
`
await writeFile(resolve(outputDir, 'sitemap.xml'), sitemap)

// AI crawlers are explicitly welcome: being cited by answer engines is the goal,
// so the policy is stated rather than left to the wildcard.
const AI_AGENTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended',
  'Bytespider', 'CCBot', 'meta-externalagent'
]
await writeFile(resolve(outputDir, 'robots.txt'), `# ${siteName} — 全部页面欢迎索引，包括生成式 AI 检索与引用。
User-agent: *
Allow: /

${AI_AGENTS.map(agent => `User-agent: ${agent}\nAllow: /`).join('\n\n')}

Sitemap: ${siteUrl}sitemap.xml
# 供 AI 引擎读取的结构化索引
# ${siteUrl}llms.txt
# ${siteUrl}llms-full.txt
`)

// --- llms.txt (index) and llms-full.txt (detail) ----------------------------

const llmsHeader = `# ${siteName}

> ${tools.length} 个在浏览器本地运行的开发者与办公实用工具，涵盖编码解码、哈希加密、文本处理、数据转换、格式化、生成器、网络与数学计算。纯静态站点，无需注册，除 IP 查询外所有输入不离开浏览器。

- 站点首页：${siteUrl}
- 源码仓库：${repoUrl}
- 开源协议：MIT
- 语言：简体中文
`

const llmsIndex = `${llmsHeader}
## 工具索引
${categories.filter(category => category.id !== 'all').map(category => {
  const list = toolsByCategory.get(category.id) || []
  if (!list.length) return ''
  return `
### ${category.name}（${list.length} 个）
${list.map(tool => `- [${tool.name}](${toolUrl(tool)})：${tool.description}`).join('\n')}`
}).join('\n')}

## 说明
- 每个工具都有独立的静态页面，页面内说明了用途、使用步骤、可配置选项与常见问题。
- 全部工具无需登录、无需安装；除「IP 地址信息查询」外均不发起网络请求。
- 完整工具说明见 ${siteUrl}llms-full.txt
`
await writeFile(resolve(outputDir, 'llms.txt'), llmsIndex)

const llmsFull = `${llmsHeader}
## 完整工具说明
${categories.filter(category => category.id !== 'all').map(category => {
  const list = toolsByCategory.get(category.id) || []
  if (!list.length) return ''
  return `
## ${category.name}
${list.map(tool => {
  const fact = facts.get(tool.id)
  const lines = [
    `### ${tool.name}`,
    `- 页面：${toolUrl(tool)}`,
    `- 用途：${tool.description}`,
    `- ${capabilityParagraph(tool, fact)}`
  ]
  if (fact?.modes?.length) lines.push(`- 模式：${fact.modes.map(group => group.join(' / ')).join('；')}`)
  if (fact?.inputs?.length) lines.push(`- 输入：${fact.inputs.map(input => input.label).join('；')}`)
  if (fact?.resultSections?.length) lines.push(`- 输出：${fact.resultSections.join('；')}`)
  if (fact?.selects?.length) lines.push(`- 选项：${fact.selects.map(select => `${select.label}（${select.values.join('、')}）`).join('；')}`)
  if (fact?.toggles?.length) lines.push(`- 开关：${fact.toggles.join('、')}`)
  lines.push(`- 联网：${networkTools.has(tool.id) ? '需要访问第三方服务' : '否，完全在本地运行'}`)
  return lines.join('\n')
}).join('\n\n')}`
}).join('\n')}
`
await writeFile(resolve(outputDir, 'llms-full.txt'), llmsFull)

// --- Homepage metadata ------------------------------------------------------

const homeFaq = [
  {
    question: '这些工具需要注册或付费吗？',
    answer: `${siteName}的全部工具都免费使用，无需注册、登录或安装。`
  },
  {
    question: '我的数据会被上传到服务器吗？',
    answer: '不会。除「IP 地址信息查询」需要向第三方服务查询归属地外，所有工具都在你的浏览器内完成计算，输入内容不会离开设备。'
  },
  {
    question: `一共有多少个工具？`,
    answer: `当前提供 ${tools.length} 个工具，覆盖${categories.filter(c => c.id !== 'all').map(c => c.name).join('、')}等分类。`
  }
]

const homeSchema = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: siteUrl,
    inLanguage: 'zh-CN',
    description: `${tools.length} 个在浏览器本地运行的常用开发者工具`,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}?q={search_term_string}` },
      'query-input': 'required name=search_term_string'
    }
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${siteName}工具列表`,
    numberOfItems: tools.length,
    itemListElement: tools.map((tool, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: tool.name,
      description: tool.description,
      url: toolUrl(tool)
    }))
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: homeFaq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer }
    }))
  }
]

let index = await readFile(resolve(outputDir, 'index.html'), 'utf8')
index = index.replace(
  /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
  homeSchema.map(entry => `<script type="application/ld+json">${jsonLd(entry)}</script>`).join('\n  ')
)
// Drop the placeholder social tags the source ships with, so the values below
// replace them instead of sitting alongside as duplicates (crawlers honour the
// first tag, which would keep the small summary card).
index = index.replace(/\s*<meta (?:name|property)="(?:twitter:card|og:url|og:image|og:site_name|og:locale)"[^>]*>/g, '')
index = index.replace('</head>', `  <link rel="canonical" href="${escapeHtml(siteUrl)}">
  <meta property="og:url" content="${escapeHtml(siteUrl)}">
  <meta property="og:site_name" content="${escapeHtml(siteName)}">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:image" content="${escapeHtml(`${siteUrl}og.png`)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escapeHtml(`${siteUrl}og.png`)}">
</head>`)
index = index.replaceAll('%TOOL_COUNT%', String(tools.length))
await writeFile(resolve(outputDir, 'index.html'), index)

await writeFile(resolve(outputDir, 'og.png'), renderOgCard({ id: 'onlinetoolbox', category: 'converter' }))
await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`)

const rendered = [...facts.values()].filter(Boolean).length
// Written synchronously: a tool that leaves a timer behind would otherwise keep
// the event loop alive and the async stdout write could be cut short on exit.
writeSync(1, [
  `Generated ${tools.length} tool pages + OG cards (copy derived from ${rendered}/${tools.length} rendered tools)`,
  `Sitemap: ${sitemapEntries.length + 1} URLs · llms.txt + llms-full.txt written`,
  ''
].join('\n'))
process.exit(0)

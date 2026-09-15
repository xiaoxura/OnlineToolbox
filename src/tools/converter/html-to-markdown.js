import '../../styles/tools/markdown.css'
import { createElement, createSection } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

// --- HTML → Markdown --------------------------------------------------------
// The document is parsed with DOMParser and walked node by node (never with a
// regex over the raw source) so nesting, list numbering and table structure
// come out of the recursion instead of being patched up afterwards.

const INLINE_TAGS = new Set([
  'A', 'ABBR', 'ACRONYM', 'B', 'BDI', 'BDO', 'BIG', 'BR', 'CITE', 'CODE', 'DATA', 'DEL',
  'DFN', 'EM', 'FONT', 'I', 'IMG', 'INS', 'KBD', 'LABEL', 'MARK', 'Q', 'S', 'SAMP',
  'SMALL', 'SPAN', 'STRIKE', 'STRONG', 'SUB', 'SUP', 'TIME', 'TT', 'U', 'VAR', 'WBR'
])

// Never carry any text into the output.
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'HEAD', 'TITLE', 'META', 'LINK', 'BASE', 'NOSCRIPT', 'TEMPLATE'])

// No Markdown equivalent: dropped unless 保留 HTML 标签 is on.
const OPAQUE_TAGS = new Set([
  'IFRAME', 'VIDEO', 'AUDIO', 'CANVAS', 'SVG', 'OBJECT', 'EMBED', 'INPUT', 'BUTTON',
  'SELECT', 'TEXTAREA', 'MAP', 'AREA', 'PROGRESS', 'METER', 'DIALOG', 'SLOT'
])

// Tags Markdown cannot express but that stay readable as inline HTML.
const HTML_ONLY_INLINE = new Set(['SUB', 'SUP', 'MARK', 'U', 'INS', 'KBD', 'Q', 'ABBR'])

const TRANSPARENT_BLOCKS = new Set([
  'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'FORM',
  'FIELDSET', 'DETAILS', 'SUMMARY', 'BODY', 'HTML', 'CENTER', 'FIGURE', 'HGROUP', 'CAPTION'
])

function normalizeOptions(options = {}) {
  return {
    keepHtml: Boolean(options.keepHtml),
    absoluteUrls: Boolean(options.absoluteUrls),
    baseUrl: options.baseUrl || (typeof document === 'undefined' ? '' : document.baseURI),
    // spaces: two trailing spaces, backslash: hard break with "\", html: keep <br>
    lineBreak: ['spaces', 'backslash', 'html'].includes(options.lineBreak) ? options.lineBreak : 'spaces'
  }
}

function resolveUrl(raw, ctx) {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  if (!ctx.opts.absoluteUrls) return value
  // In-page anchors and non-navigational schemes stay untouched.
  if (value.startsWith('#') || /^(mailto|tel|data|javascript|sms):/i.test(value)) return value
  try {
    return new URL(value, ctx.opts.baseUrl || undefined).href
  } catch {
    return value
  }
}

// Literal "*" and "_" in HTML text are always meant literally, but an escaped
// underscore would ruin snake_case identifiers, so only word-internal ASCII
// underscores stay bare.
function escapeEmphasis(text) {
  return text.replace(/[*_]/g, (match, offset, whole) => {
    if (match === '*') return '\\*'
    const before = offset > 0 ? whole[offset - 1] : ''
    const after = offset + 1 < whole.length ? whole[offset + 1] : ''
    return /[A-Za-z0-9]/.test(before) && /[A-Za-z0-9]/.test(after) ? '_' : '\\_'
  })
}

// Collapse HTML whitespace and escape the characters that would otherwise be
// read as Markdown syntax.
function escapeText(value) {
  return escapeEmphasis(
    String(value ?? '')
      .replace(/[\t\r\n ]+/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
  )
}

// A paragraph must not accidentally open a heading, quote or list.
function protectParagraph(text) {
  return text
    .replace(/^([ \t]*)([#>])/gm, '$1\\$2')
    .replace(/^([ \t]*)([-+])(\s)/gm, '$1\\$2$3')
    .replace(/^([ \t]*)(\d+)([.)])(\s)/gm, '$1$2\\$3$4')
}

function normalizeParagraph(buffer) {
  const text = protectParagraph(buffer.trim())
  return text.trim() ? text : ''
}

function wrapInline(text, marker) {
  if (!text.trim()) return text
  const leading = /^\s*/.exec(text)[0]
  const trailing = /\s*$/.exec(text)[0]
  return `${leading}${marker}${text.trim()}${marker}${trailing}`
}

function lineBreakMarkdown(ctx) {
  if (ctx.opts.lineBreak === 'html') return '<br>'
  if (ctx.opts.lineBreak === 'backslash') return '\\\n'
  return '  \n'
}

function detectLanguage(el) {
  if (!el) return ''
  const fromData = el.getAttribute?.('data-language')
  if (fromData) return fromData.trim()
  const className = el.getAttribute?.('class') || ''
  const match = /(?:language|lang|brush|highlight-source)-([\w+#.-]+)/i.exec(className)
  return match ? match[1] : ''
}

// Inline-only children: used for headings, paragraphs, table cells and the
// inside of inline elements, where a block never belongs.
function inlineChildren(el, ctx) {
  let out = ''
  for (const node of el.childNodes) {
    if (node.nodeType === 3) {
      out += escapeText(node.nodeValue)
      continue
    }
    if (node.nodeType !== 1) continue
    const tag = node.tagName
    if (SKIP_TAGS.has(tag)) continue
    if (OPAQUE_TAGS.has(tag)) {
      if (ctx.opts.keepHtml) out += node.outerHTML
      continue
    }
    if (INLINE_TAGS.has(tag)) {
      out += renderInline(node, ctx)
      continue
    }
    if (ctx.opts.keepHtml && !TRANSPARENT_BLOCKS.has(tag) && !['P', 'UL', 'OL', 'PRE', 'TABLE', 'DL', 'HR'].includes(tag)) {
      out += node.outerHTML
      continue
    }
    out += renderChildren(node, ctx)
  }
  return out
}

function renderCodeSpan(el) {
  const text = el.textContent.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const longest = (text.match(/`+/g) || []).reduce((max, run) => Math.max(max, run.length), 0)
  const fence = '`'.repeat(longest + 1)
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : ''
  return `${fence}${pad}${text}${pad}${fence}`
}

function renderImage(el, ctx) {
  const src = resolveUrl(el.getAttribute('src'), ctx)
  const alt = String(el.getAttribute('alt') ?? '').replace(/[[\]]/g, '')
  if (!src) return ctx.opts.keepHtml ? el.outerHTML : escapeText(alt)
  const title = String(el.getAttribute('title') ?? '').replace(/"/g, "'")
  return `![${alt}](${src}${title ? ` "${title}"` : ''})`
}

function renderAnchor(el, ctx) {
  const rawHref = String(el.getAttribute('href') ?? '').trim()
  const href = resolveUrl(rawHref, ctx)
  const text = inlineChildren(el, ctx).trim().replace(/[[\]]/g, match => `\\${match}`)
  if (!href) return text
  if (!text) return `[${href}](${href})`
  if (text === href && /^[a-z][a-z0-9+.-]*:/i.test(href)) return `<${href}>`
  const title = String(el.getAttribute('title') ?? '').replace(/"/g, "'")
  return `[${text}](${href}${title ? ` "${title}"` : ''})`
}

function renderInline(el, ctx) {
  const tag = el.tagName
  switch (tag) {
    case 'BR':
      return lineBreakMarkdown(ctx)
    case 'IMG':
      return renderImage(el, ctx)
    case 'A':
      return renderAnchor(el, ctx)
    case 'STRONG':
    case 'B':
      return wrapInline(inlineChildren(el, ctx), '**')
    case 'EM':
    case 'I':
      return wrapInline(inlineChildren(el, ctx), '*')
    case 'DEL':
    case 'S':
    case 'STRIKE':
      return wrapInline(inlineChildren(el, ctx), '~~')
    case 'CODE':
      return renderCodeSpan(el)
    default:
      if (HTML_ONLY_INLINE.has(tag)) {
        return ctx.opts.keepHtml ? el.outerHTML : inlineChildren(el, ctx)
      }
      return inlineChildren(el, ctx)
  }
}

function renderHeading(el, ctx) {
  const level = Number(el.tagName[1])
  const text = inlineChildren(el, ctx).trim().replace(/\s*\n\s*/g, ' ')
  if (!text) return ''
  return `${'#'.repeat(level)} ${text}`
}

function renderPre(el) {
  const code = el.querySelector('code')
  const source = (code || el).textContent.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  if (!source.trim()) return ''
  const language = detectLanguage(code || el)
  const longest = (source.match(/`{3,}/g) || []).reduce((max, run) => Math.max(max, run.length), 2)
  const fence = '`'.repeat(longest + 1)
  return `${fence}${language}\n${source}\n${fence}`
}

function renderBlockquote(el, ctx) {
  const inner = renderChildren(el, ctx)
  if (!inner) return ''
  return inner.split('\n').map(line => (line ? `> ${line}` : '>')).join('\n')
}

function renderList(el, ctx) {
  const ordered = el.tagName === 'OL'
  const parsedStart = Number.parseInt(el.getAttribute('start') ?? '1', 10)
  const start = Number.isFinite(parsedStart) ? parsedStart : 1
  const items = []
  let index = 0
  for (const child of el.children) {
    if (child.tagName !== 'LI') continue
    const value = Number.parseInt(child.getAttribute('value') ?? '', 10)
    const number = Number.isFinite(value) ? value : start + index
    items.push(renderListItem(child, ctx, ordered ? `${number}. ` : '- '))
    index++
  }
  return items.join('\n')
}

function renderListItem(li, ctx, marker) {
  const segments = []
  let buffer = ''
  const flush = () => {
    const text = normalizeParagraph(buffer)
    if (text) segments.push({ text, list: false, paragraph: false })
    buffer = ''
  }

  for (const node of li.childNodes) {
    if (node.nodeType === 3) {
      buffer += escapeText(node.nodeValue)
      continue
    }
    if (node.nodeType !== 1) continue
    const tag = node.tagName
    if (SKIP_TAGS.has(tag)) continue
    if (INLINE_TAGS.has(tag)) {
      buffer += renderInline(node, ctx)
      continue
    }
    if (tag === 'UL' || tag === 'OL') {
      flush()
      segments.push({ text: renderList(node, ctx), list: true, paragraph: false })
      continue
    }
    if (tag === 'P') {
      flush()
      const text = normalizeParagraph(inlineChildren(node, ctx))
      if (text) segments.push({ text, list: false, paragraph: true })
      continue
    }
    flush()
    const block = renderBlock(node, ctx)
    if (block) segments.push({ text: block, list: false, paragraph: false })
  }
  flush()

  if (!segments.length) return marker.trimEnd()

  const pad = ' '.repeat(marker.length)
  const lines = []
  segments.forEach((segment, index) => {
    if (index > 0) {
      // A nested list stays tight unless the previous block was a paragraph.
      const tight = segment.list && !segments[index - 1].paragraph
      if (!tight) lines.push('')
    }
    const first = index === 0 ? marker : pad
    segment.text.split('\n').forEach((line, lineIndex) => {
      if (line === '') lines.push('')
      else lines.push((lineIndex === 0 ? first : pad) + line)
    })
  })
  return lines.join('\n')
}

function cellAlignment(cell) {
  const align = (cell.getAttribute('align') || cell.style?.textAlign || '').toLowerCase()
  if (align === 'center' || align === 'right' || align === 'left') return align
  return ''
}

function cellMarkdown(cell, ctx) {
  return inlineChildren(cell, ctx)
    .trim()
    .replace(/\s*\n\s*/g, '<br>')
    .replace(/\|/g, '\\|')
}

function renderTable(el, ctx) {
  const rows = []
  for (const row of el.querySelectorAll('tr')) {
    if (row.closest('table') !== el) continue
    const cells = []
    for (const cell of row.children) {
      if (cell.tagName !== 'TD' && cell.tagName !== 'TH') continue
      const span = Math.max(1, Number.parseInt(cell.getAttribute('colspan') ?? '1', 10) || 1)
      cells.push({ text: cellMarkdown(cell, ctx), align: cellAlignment(cell) })
      for (let i = 1; i < span; i++) cells.push({ text: '', align: '' })
    }
    if (!cells.length) continue
    const headerRow = row.parentElement?.tagName === 'THEAD' || [...row.children].every(cell => cell.tagName === 'TH')
    rows.push({ cells, headerRow })
  }
  if (!rows.length) return ''

  const width = Math.max(...rows.map(row => row.cells.length))
  const header = rows[0].headerRow ? rows.shift() : null
  const alignments = []
  for (let i = 0; i < width; i++) {
    const fromHeader = header?.cells[i]?.align
    const fromBody = rows.find(row => row.cells[i]?.align)?.cells[i]?.align
    alignments.push(fromHeader || fromBody || '')
  }

  const renderRow = cells => `| ${Array.from({ length: width }, (_, i) => cells[i]?.text ?? '').join(' | ')} |`
  const markerFor = align => (align === 'center' ? ':---:' : align === 'right' ? '---:' : '---')

  const lines = []
  lines.push(renderRow(header ? header.cells : Array.from({ length: width }, () => ({ text: '' }))))
  lines.push(`| ${alignments.map(markerFor).join(' | ')} |`)
  for (const row of rows) lines.push(renderRow(row.cells))
  return lines.join('\n')
}

function renderDefinitionList(el, ctx) {
  const groups = []
  let current = null
  for (const child of el.children) {
    if (child.tagName === 'DT') {
      current = { terms: [inlineChildren(child, ctx).trim()], definitions: [] }
      groups.push(current)
    } else if (child.tagName === 'DD') {
      if (!current) {
        current = { terms: [], definitions: [] }
        groups.push(current)
      }
      const text = renderChildren(child, ctx)
      if (text) current.definitions.push(text)
    }
  }
  return groups
    .map(group => [...group.terms, ...group.definitions.map(definition => `: ${definition}`)].join('\n'))
    .filter(Boolean)
    .join('\n\n')
}

function renderBlock(el, ctx) {
  const tag = el.tagName
  if (SKIP_TAGS.has(tag)) return ''
  if (OPAQUE_TAGS.has(tag)) return ctx.opts.keepHtml ? el.outerHTML : ''

  switch (tag) {
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      return renderHeading(el, ctx)
    case 'P':
      return normalizeParagraph(inlineChildren(el, ctx))
    case 'HR':
      return '---'
    case 'PRE':
      return renderPre(el)
    case 'BLOCKQUOTE':
      return renderBlockquote(el, ctx)
    case 'UL':
    case 'OL':
      return renderList(el, ctx)
    case 'LI':
      return renderListItem(el, ctx, '- ')
    case 'TABLE':
      return renderTable(el, ctx)
    case 'DL':
      return renderDefinitionList(el, ctx)
    case 'FIGCAPTION':
      return wrapInline(renderChildren(el, ctx), '*')
    default:
      // Known containers read as if they were not there; anything else is kept
      // verbatim only when 保留 HTML 标签 is on.
      if (TRANSPARENT_BLOCKS.has(tag)) return renderChildren(el, ctx)
      return ctx.opts.keepHtml ? el.outerHTML : renderChildren(el, ctx)
  }
}

function renderChildren(parent, ctx) {
  const parts = []
  let buffer = ''
  const flush = () => {
    const text = normalizeParagraph(buffer)
    if (text) parts.push(text)
    buffer = ''
  }

  for (const node of parent.childNodes) {
    if (node.nodeType === 3) {
      buffer += escapeText(node.nodeValue)
      continue
    }
    if (node.nodeType !== 1) continue
    const tag = node.tagName
    if (SKIP_TAGS.has(tag)) continue
    if (INLINE_TAGS.has(tag)) {
      buffer += renderInline(node, ctx)
      continue
    }
    flush()
    const block = renderBlock(node, ctx)
    if (block) parts.push(block)
  }
  flush()
  return parts.join('\n\n')
}

function clean(markdown) {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function htmlToMarkdown(html, options = {}) {
  const source = String(html ?? '')
  if (!source.trim()) return ''
  if (typeof DOMParser === 'undefined') throw new Error('当前环境不支持 DOMParser，无法解析 HTML')
  const ctx = { opts: normalizeOptions(options) }
  const document_ = new DOMParser().parseFromString(source, 'text/html')
  return clean(renderChildren(document_.body, ctx))
}

function renderPreview(target, markdown) {
  if (!markdown.trim()) {
    target.innerHTML = ''
    return
  }
  target.innerHTML = DOMPurify.sanitize(marked.parse(markdown, { gfm: true, breaks: false }))
}

const SAMPLE_HTML = `<article>
  <h1>项目说明</h1>
  <p>这是一个 <strong>离线</strong> 工具箱，支持 <em>格式互转</em> 与 <code>代码片段</code>。</p>
  <h2>功能列表</h2>
  <ul>
    <li>转换标题、列表与表格</li>
    <li>支持嵌套列表
      <ol>
        <li>有序列表</li>
        <li>自动编号</li>
      </ol>
    </li>
    <li>链接：<a href="https://example.com/docs" title="文档">项目文档</a></li>
  </ul>
  <blockquote><p>引用内容也可以嵌套。</p></blockquote>
  <pre><code class="language-js">const answer = 42</code></pre>
  <table>
    <thead><tr><th align="left">字段</th><th align="right">长度</th></tr></thead>
    <tbody>
      <tr><td>name</td><td>64</td></tr>
      <tr><td>email</td><td>128</td></tr>
    </tbody>
  </table>
</article>`

export default {
  id: 'html-to-markdown',
  name: 'HTML 转 Markdown',
  description: '将 HTML 转换为 Markdown，支持标题、列表、链接、表格与代码块',
  category: 'converter',
  icon: 'markdown',
  keywords: ['html', 'markdown', '转换', '富文本'],
  render(container) {
    const keepHtmlBox = createElement('input', { type: 'checkbox' })
    const absoluteBox = createElement('input', { type: 'checkbox' })
    const lineBreakSelect = createElement('select', { className: 'select', 'aria-label': '换行策略' }, [
      createElement('option', { value: 'spaces', textContent: '行尾双空格（默认）' }),
      createElement('option', { value: 'backslash', textContent: '反斜杠换行' }),
      createElement('option', { value: 'html', textContent: '保留 <br> 标签' })
    ])

    const options = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '换行策略' }),
        lineBreakSelect
      ]),
      createElement('div', { className: 'form-group option-control-group' }, [
        createElement('label', { className: 'option-item' }, [
          keepHtmlBox,
          createElement('span', { textContent: '保留 HTML 标签' })
        ]),
        createElement('label', { className: 'option-item' }, [
          absoluteBox,
          createElement('span', { textContent: '链接转绝对地址' })
        ])
      ])
    ])

    const preview = createElement('div', { className: 'markdown-preview' })
    const previewSection = createSection('渲染预览', preview)
    previewSection.hidden = true

    const state = renderTextTransform(container, {
      inputTitle: 'HTML 输入',
      outputTitle: 'Markdown 输出',
      inputPlaceholder: '粘贴 HTML 片段或整页代码…',
      outputPlaceholder: 'Markdown 结果将显示在此…',
      actionLabel: '转换为 Markdown',
      sample: SAMPLE_HTML,
      options,
      transform(html) {
        const markdown = htmlToMarkdown(html, {
          keepHtml: keepHtmlBox.checked,
          absoluteUrls: absoluteBox.checked,
          lineBreak: lineBreakSelect.value
        })
        renderPreview(preview, markdown)
        previewSection.hidden = !markdown.trim()
        return markdown
      }
    })

    container.append(previewSection)

    keepHtmlBox.addEventListener('change', state.run)
    absoluteBox.addEventListener('change', state.run)
    lineBreakSelect.addEventListener('change', state.run)
  }
}

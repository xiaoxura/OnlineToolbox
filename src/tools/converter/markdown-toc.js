import { createElement } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

// --- Markdown TOC -----------------------------------------------------------
// Headings are collected line by line with an explicit fence switch, so a "#"
// inside a code block can never end up in the table of contents.

const BULLETS = ['-', '*', '+']

// Inline Markdown in a heading is not part of the anchor text.
export function stripInlineMarkdown(text) {
  return String(text ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim()
}

// GitHub anchor rules: lowercase, drop punctuation (hyphens and underscores
// survive), spaces become hyphens.
export function slugifyHeading(text) {
  return stripInlineMarkdown(text)
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
}

export function parseHeadings(markdown, options = {}) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n')
  const headings = []
  let fence = null

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]

    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (!fence) fence = marker
      else if (fence === marker) fence = null
      continue
    }
    if (fence) continue

    const atx = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/.exec(line)
    if (atx) {
      const text = (atx[2] ?? '').trim()
      if (text) headings.push({ level: atx[1].length, text })
      continue
    }

    if (!options.setext) continue
    const underline = /^ {0,3}(=+|-+)[ \t]*$/.exec(lines[index + 1] ?? '')
    if (!underline) continue
    const text = line.trim()
    // A setext underline cannot follow a blank line, a block marker or a list.
    if (!text || /^(#|>|[-+*]|\d+[.)])\s/.test(text) || /^ {0,3}(`|~~~)/.test(text)) continue
    headings.push({ level: underline[1][0] === '=' ? 1 : 2, text })
    index++
  }

  return headings
}

function uniqueSlugFactory(githubSlug) {
  const used = new Set()
  return text => {
    const base = (githubSlug ? slugifyHeading(text) : text.trim().toLowerCase().replace(/\s+/g, '-')) || 'section'
    if (!used.has(base)) {
      used.add(base)
      return base
    }
    let counter = 1
    let candidate = `${base}-${counter}`
    while (used.has(candidate)) {
      counter++
      candidate = `${base}-${counter}`
    }
    used.add(candidate)
    return candidate
  }
}

export function generateToc(markdown, options = {}) {
  const bullet = BULLETS.includes(options.bullet) ? options.bullet : '-'
  const minLevel = Number(options.minLevel) || 1
  const maxLevel = Number(options.maxLevel) || 6
  if (minLevel > maxLevel) return ''

  const all = parseHeadings(markdown, { setext: Boolean(options.setext) })
  let headings = all.filter(heading => heading.level >= minLevel && heading.level <= maxLevel)
  // The document title (a leading H1) is optional: it usually names the page
  // rather than a section of it.
  if (options.includeTitle === false && headings.length && headings[0].level === 1 && headings[0] === all[0]) {
    headings = headings.slice(1)
  }
  if (!headings.length) return ''

  const nextSlug = uniqueSlugFactory(options.githubSlug !== false)
  const stack = []
  const lines = []
  for (const heading of headings) {
    while (stack.length && stack[stack.length - 1] >= heading.level) stack.pop()
    const depth = stack.length
    stack.push(heading.level)
    const text = heading.text.replace(/([[\]|])/g, match => `\\${match}`)
    lines.push(`${'  '.repeat(depth)}${bullet} [${text}](#${nextSlug(heading.text)})`)
  }
  return lines.join('\n')
}

const SAMPLE_MARKDOWN = `# 项目文档

概述段落。

## 快速开始

### 安装

\`\`\`bash
# 这行注释不是标题
npm install
\`\`\`

### 配置

## 快速开始

## API 参考

### 函数列表

#### 参数说明

### 返回值
`

export default {
  id: 'markdown-toc',
  name: 'Markdown 目录生成',
  description: '为 Markdown 文档生成带锚点的可跳转目录',
  category: 'converter',
  icon: 'markdown',
  keywords: ['toc', '目录', '锚点', 'markdown', 'outline'],
  render(container) {
    const levels = Array.from({ length: 6 }, (_, index) => index + 1)
    const minLevel = createElement('select', { className: 'select', 'aria-label': '最小层级' },
      levels.map(level => createElement('option', { value: String(level), textContent: `H${level}` })))
    const maxLevel = createElement('select', { className: 'select', 'aria-label': '最大层级' },
      levels.map(level => createElement('option', { value: String(level), textContent: `H${level}` })))
    maxLevel.value = '6'
    const bullet = createElement('select', { className: 'select', 'aria-label': '列表标记' }, [
      createElement('option', { value: '-', textContent: '连字符（-）' }),
      createElement('option', { value: '*', textContent: '星号（*）' }),
      createElement('option', { value: '+', textContent: '加号（+）' })
    ])
    const githubBox = createElement('input', { type: 'checkbox', checked: true })
    const titleBox = createElement('input', { type: 'checkbox', checked: true })
    const setextBox = createElement('input', { type: 'checkbox' })

    const controls = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '最小层级' }),
        minLevel
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '最大层级' }),
        maxLevel
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '列表标记' }),
        bullet
      ]),
      createElement('div', { className: 'form-group option-control-group' }, [
        createElement('label', { className: 'option-item' }, [
          githubBox,
          createElement('span', { textContent: 'GitHub 风格锚点' })
        ]),
        createElement('label', { className: 'option-item' }, [
          titleBox,
          createElement('span', { textContent: '包含标题本身' })
        ]),
        createElement('label', { className: 'option-item' }, [
          setextBox,
          createElement('span', { textContent: '识别 Setext 标题' })
        ])
      ])
    ])

    const options = createElement('div', { className: 'tool-stack' }, [
      controls,
      createElement('p', {
        className: 'form-hint',
        textContent: '关闭「包含标题本身」后，文档开头的第一个 H1 不会出现在目录中；Setext 标题使用 === / --- 下划线形式。'
      })
    ])

    const state = renderTextTransform(container, {
      inputTitle: 'Markdown 文档',
      outputTitle: '目录',
      inputPlaceholder: '# 标题\n\n## 小节\n\n正文…',
      outputPlaceholder: '目录将显示在此…',
      actionLabel: '生成目录',
      sample: SAMPLE_MARKDOWN,
      options,
      transform(markdown) {
        return generateToc(markdown, {
          minLevel: Number(minLevel.value),
          maxLevel: Number(maxLevel.value),
          bullet: bullet.value,
          githubSlug: githubBox.checked,
          includeTitle: titleBox.checked,
          setext: setextBox.checked
        })
      }
    })

    for (const control of [minLevel, maxLevel, bullet, githubBox, titleBox, setextBox]) {
      control.addEventListener('change', state.run)
    }
  }
}

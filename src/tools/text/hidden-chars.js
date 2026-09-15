import { createElement, createSegmentedGroup, createTableScroll } from '../../utils/dom.js'
import { renderTextTransform } from '../shared/text-transform.js'

// Detection and removal of invisible / deceptive characters. All of the logic
// below is pure so it can be unit-tested without a DOM; the render() at the
// bottom is a thin shell over these functions.

export const CATEGORIES = [
  { id: 'zeroWidth', label: '零宽字符', strippable: true },
  { id: 'bom', label: 'BOM', strippable: true },
  { id: 'invisible', label: '不可见格式符', strippable: true },
  { id: 'control', label: '控制字符', strippable: true },
  { id: 'space', label: '异常空格', strippable: true },
  { id: 'confusable', label: '易混淆字符', strippable: false }
]

// Explicit code point table. `token` is the ASCII placeholder used when an
// invisible character has to be shown inside a text report.
const CHAR_TABLE = new Map([
  [0x200B, { name: '零宽空格', token: 'ZWSP', category: 'zeroWidth' }],
  [0x200C, { name: '零宽非连接符', token: 'ZWNJ', category: 'zeroWidth' }],
  [0x200D, { name: '零宽连接符', token: 'ZWJ', category: 'zeroWidth' }],
  [0x2060, { name: '单词连接符', token: 'WJ', category: 'zeroWidth' }],
  [0xFEFF, { name: '零宽不换行空格（BOM）', token: 'BOM', category: 'bom' }],
  [0x00AD, { name: '软连字符', token: 'SHY', category: 'invisible' }],
  [0x180E, { name: '蒙古文元音分隔符', token: 'MVS', category: 'invisible' }],
  [0x200E, { name: '从左到右标记', token: 'LRM', category: 'invisible' }],
  [0x200F, { name: '从右到左标记', token: 'RLM', category: 'invisible' }],
  [0x202A, { name: '从左到右嵌入', token: 'LRE', category: 'invisible' }],
  [0x202B, { name: '从右到左嵌入', token: 'RLE', category: 'invisible' }],
  [0x202C, { name: '方向格式化终止符', token: 'PDF', category: 'invisible' }],
  [0x202D, { name: '从左到右覆盖', token: 'LRO', category: 'invisible' }],
  [0x202E, { name: '从右到左覆盖（可用于伪装文件名）', token: 'RLO', category: 'invisible' }],
  [0x2066, { name: '从左到右隔离', token: 'LRI', category: 'invisible' }],
  [0x2067, { name: '从右到左隔离', token: 'RLI', category: 'invisible' }],
  [0x2068, { name: '首个强方向字符隔离', token: 'FSI', category: 'invisible' }],
  [0x2069, { name: '方向隔离终止符', token: 'PDI', category: 'invisible' }],
  [0x00A0, { name: '不换行空格', token: 'NBSP', category: 'space' }],
  [0x3000, { name: '全角空格', token: 'IDSP', category: 'space' }]
])

// Cyrillic / Greek letters that are commonly used to spoof Latin words in
// domains, file names and identifiers. They are reported but never removed —
// deleting them would silently rewrite legitimate non-Latin text.
const CONFUSABLES = new Map([
  [0x0410, { latin: 'A', script: '西里尔' }], [0x0412, { latin: 'B', script: '西里尔' }],
  [0x0415, { latin: 'E', script: '西里尔' }], [0x041A, { latin: 'K', script: '西里尔' }],
  [0x041C, { latin: 'M', script: '西里尔' }], [0x041D, { latin: 'H', script: '西里尔' }],
  [0x041E, { latin: 'O', script: '西里尔' }], [0x0420, { latin: 'P', script: '西里尔' }],
  [0x0421, { latin: 'C', script: '西里尔' }], [0x0422, { latin: 'T', script: '西里尔' }],
  [0x0423, { latin: 'Y', script: '西里尔' }], [0x0425, { latin: 'X', script: '西里尔' }],
  [0x0430, { latin: 'a', script: '西里尔' }], [0x0435, { latin: 'e', script: '西里尔' }],
  [0x043E, { latin: 'o', script: '西里尔' }], [0x0440, { latin: 'p', script: '西里尔' }],
  [0x0441, { latin: 'c', script: '西里尔' }], [0x0443, { latin: 'y', script: '西里尔' }],
  [0x0445, { latin: 'x', script: '西里尔' }], [0x0455, { latin: 's', script: '西里尔' }],
  [0x0456, { latin: 'i', script: '西里尔' }], [0x0458, { latin: 'j', script: '西里尔' }],
  [0x04CF, { latin: 'l', script: '西里尔' }],
  [0x0391, { latin: 'A', script: '希腊' }], [0x0392, { latin: 'B', script: '希腊' }],
  [0x0395, { latin: 'E', script: '希腊' }], [0x0396, { latin: 'Z', script: '希腊' }],
  [0x0397, { latin: 'H', script: '希腊' }], [0x0399, { latin: 'I', script: '希腊' }],
  [0x039A, { latin: 'K', script: '希腊' }], [0x039C, { latin: 'M', script: '希腊' }],
  [0x039D, { latin: 'N', script: '希腊' }], [0x039F, { latin: 'O', script: '希腊' }],
  [0x03A1, { latin: 'P', script: '希腊' }], [0x03A4, { latin: 'T', script: '希腊' }],
  [0x03A5, { latin: 'Y', script: '希腊' }], [0x03A7, { latin: 'X', script: '希腊' }],
  [0x03B9, { latin: 'i', script: '希腊' }], [0x03BA, { latin: 'k', script: '希腊' }],
  [0x03BD, { latin: 'v', script: '希腊' }], [0x03BF, { latin: 'o', script: '希腊' }],
  [0x03C1, { latin: 'p', script: '希腊' }], [0x03C4, { latin: 't', script: '希腊' }]
])

const CONTROL_NAMES = new Map([
  [0x00, '空字符 NUL'], [0x07, '响铃 BEL'], [0x08, '退格 BS'], [0x0B, '垂直制表 VT'],
  [0x0C, '换页 FF'], [0x1B, '转义 ESC'], [0x7F, '删除 DEL']
])

export function formatCodePoint(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`
}

export function categoryLabel(id) {
  return CATEGORIES.find(category => category.id === id)?.label ?? id
}

function lookupEntry(codePoint) {
  const known = CHAR_TABLE.get(codePoint)
  if (known) return known
  const isControl = (codePoint <= 0x1F && codePoint !== 0x0A && codePoint !== 0x0D && codePoint !== 0x09) || codePoint === 0x7F
  if (isControl) {
    const label = CONTROL_NAMES.get(codePoint)
    return { name: label ? `控制字符（${label}）` : '控制字符', token: formatCodePoint(codePoint), category: 'control' }
  }
  const confusable = CONFUSABLES.get(codePoint)
  if (confusable) {
    return {
      name: `${confusable.script}字母，形似拉丁字母 ${confusable.latin}`,
      token: formatCodePoint(codePoint),
      category: 'confusable',
      strippable: false
    }
  }
  return null
}

// Scan the text and report every suspicious character with its code-unit
// offset, code point, human name and category.
export function detectHiddenChars(text) {
  const value = String(text ?? '')
  const findings = []
  let index = 0
  for (const char of value) {
    const codePoint = char.codePointAt(0)
    const entry = lookupEntry(codePoint)
    if (entry) {
      findings.push({
        index,
        char,
        codePoint: formatCodePoint(codePoint),
        name: entry.name,
        token: entry.token,
        category: entry.category,
        categoryLabel: categoryLabel(entry.category),
        strippable: entry.strippable !== false
      })
    }
    index += char.length
  }
  return findings
}

// Per-category tally for the stats row: { total, categories: [{id, label, count, strippable}] }
export function summarizeChars(text) {
  const findings = detectHiddenChars(text)
  const counts = new Map()
  for (const finding of findings) counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1)
  return {
    total: findings.length,
    categories: CATEGORIES
      .filter(category => counts.has(category.id))
      .map(category => ({
        id: category.id,
        label: category.label,
        count: counts.get(category.id),
        strippable: category.strippable
      }))
  }
}

function selectedCategories(options) {
  const ids = options.categories ?? CATEGORIES.filter(category => category.strippable).map(category => category.id)
  return new Set(ids)
}

// Remove the selected categories. Confusables are never removed (they are real
// letters); the `space` category collapses to a single normal space so words
// do not run together.
export function stripHiddenChars(text, options = {}) {
  const value = String(text ?? '')
  const selected = selectedCategories(options)
  const replacement = options.spaceReplacement ?? ' '
  let out = ''
  let cursor = 0
  for (const finding of detectHiddenChars(value)) {
    if (!finding.strippable || !selected.has(finding.category)) continue
    out += value.slice(cursor, finding.index)
    if (finding.category === 'space') out += replacement
    cursor = finding.index + finding.char.length
  }
  return out + value.slice(cursor)
}

// Same text, but every invisible character is replaced by a visible ⟨TOKEN⟩
// marker and every confusable gets its code point appended, so the report can
// be read without a hex viewer.
export function annotateHiddenChars(text, options = {}) {
  const value = String(text ?? '')
  const selected = options.categories ? selectedCategories(options) : null
  let out = ''
  let cursor = 0
  for (const finding of detectHiddenChars(value)) {
    if (selected && !selected.has(finding.category)) continue
    out += value.slice(cursor, finding.index)
    out += finding.strippable ? `⟨${finding.token}⟩` : `${finding.char}⟨${finding.codePoint}⟩`
    cursor = finding.index + finding.char.length
  }
  return out + value.slice(cursor)
}

const SAMPLE_TEXT = '订单编号\u200B：A-1001\uFEFF\n价格：\u00A0123 元\u3000（含税）\n客户：\u0410нна\u00AD 提交于 3 月 12 日\n备注：\u200E英文\u200F混排\u202E示例'

function statCard(label, value) {
  return createElement('div', { className: 'stat-item' }, [
    createElement('div', { className: 'stat-value', textContent: String(value) }),
    createElement('div', { className: 'stat-label', textContent: label })
  ])
}

export default {
  id: 'hidden-chars',
  name: '隐藏字符检测',
  description: '检测并清除零宽字符、BOM、控制符与易混淆字符',
  category: 'text',
  icon: 'unicode',
  keywords: ['zero width', '零宽', 'bom', '不可见字符', '同形字', 'homoglyph'],
  render(container) {
    let state
    let refresh = () => {}

    const mode = createSegmentedGroup([
      { value: 'detect', label: '检测' },
      { value: 'clear', label: '清除' }
    ], () => {
      syncLabels()
      refresh()
    })

    const checkboxes = new Map()
    const categoryGrid = createElement('div', { className: 'grid-3' })
    for (const category of CATEGORIES) {
      const box = createElement('input', { className: 'checkbox', type: 'checkbox', checked: true })
      box.addEventListener('change', () => refresh())
      checkboxes.set(category.id, box)
      categoryGrid.appendChild(createElement('label', { className: 'option-item' }, [
        box,
        createElement('span', { textContent: category.label })
      ]))
    }

    const enabledCategories = () => [...checkboxes.entries()].filter(([, box]) => box.checked).map(([id]) => id)
    const isDetect = () => mode.getValue() === 'detect'

    // The findings live inside the output card, so the two-column layout keeps
    // the input on the left and the annotated text plus its table on the right.
    const detailHost = createElement('div')
    const detailTitle = createElement('div', { className: 'label', textContent: '检测明细' })

    const options = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('div', { className: 'label', textContent: '处理模式' }),
        mode
      ]),
      createElement('div', { className: 'form-group' }, [
        createElement('div', { className: 'label', textContent: '检测 / 清除范围' }),
        categoryGrid
      ])
    ])

    state = renderTextTransform(container, {
      inputTitle: '原始文本',
      outputTitle: '标注结果',
      inputPlaceholder: '粘贴需要检查的文本，隐藏字符会显示为 ⟨ZWSP⟩ 之类的标记…',
      outputPlaceholder: '检测 / 清除结果将显示在此…',
      actionLabel: '开始检测',
      sample: SAMPLE_TEXT,
      rows: 10,
      options,
      transform(text) {
        if (!text) return ''
        const categories = enabledCategories()
        return isDetect()
          ? annotateHiddenChars(text, { categories })
          : stripHiddenChars(text, { categories })
      }
    })

    const actionButton = container.querySelector('.btn-primary')

    function syncLabels() {
      const detect = isDetect()
      actionButton.textContent = detect ? '开始检测' : '开始清除'
      detailTitle.textContent = detect ? '检测明细' : '清除明细'
      const outputHeading = state.output.closest('.tool-section')?.querySelector('h2')
      if (outputHeading) outputHeading.textContent = detect ? '标注结果' : '清除结果'
    }

    function renderDetail(text) {
      detailHost.replaceChildren()
      detailTitle.hidden = !text
      if (!text) return

      const categories = new Set(enabledCategories())
      const findings = detectHiddenChars(text)
      const listed = isDetect()
        ? findings.filter(finding => categories.has(finding.category))
        : findings.filter(finding => finding.strippable && categories.has(finding.category))

      const hint = createElement('div', { className: 'form-hint' })
      const stats = createElement('div', { className: 'stats-row' })
      stats.appendChild(statCard(isDetect() ? '可疑字符总数' : '已清除字符数', listed.length))

      const counts = new Map()
      for (const finding of listed) counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1)
      for (const [id, count] of counts) stats.appendChild(statCard(categoryLabel(id), count))

      if (isDetect()) {
        const flagged = findings.filter(finding => !finding.strippable)
        if (flagged.length) stats.appendChild(statCard('易混淆字符（不自动清除）', flagged.length))
      }

      if (!listed.length) {
        hint.textContent = isDetect()
          ? '未检测到所选范围内的隐藏字符，文本是干净的。'
          : '所选范围内没有需要清除的字符。'
        detailHost.append(stats, hint)
        return
      }

      const table = createElement('table', { className: 'result-table' })
      table.append(
        createElement('thead', {}, [
          createElement('tr', {}, [
            createElement('th', { textContent: '位置' }),
            createElement('th', { textContent: '字符' }),
            createElement('th', { textContent: '码点' }),
            createElement('th', { textContent: '说明' })
          ])
        ]),
        createElement('tbody', {}, listed.map(finding => createElement('tr', {}, [
          createElement('th', { scope: 'row', textContent: String(finding.index + 1) }),
          createElement('td', { className: 'code-text', textContent: finding.strippable ? `⟨${finding.token}⟩` : finding.char }),
          createElement('td', { className: 'code-text', textContent: finding.codePoint }),
          createElement('td', { textContent: `${finding.name}（${finding.categoryLabel}）${finding.strippable ? '' : '，建议人工确认'}` })
        ])))
      )

      const host = createElement('div')
      host.appendChild(table)
      createTableScroll(table, '隐藏字符检测结果，可横向滚动')
      hint.textContent = isDetect()
        ? '位置为字符在文本中的序号（从 1 开始）。标记为“易混淆字符”的字母不会被自动清除。'
        : '以上字符已从输出文本中移除；异常空格会被替换为一个普通空格。'
      detailHost.append(stats, hint, host)
    }

    // The detail panel is driven by the same controls as the textarea output:
    // re-run the transform, then rebuild the findings table from the input.
    refresh = () => {
      state.run()
      renderDetail(state.input.value)
    }
    actionButton.addEventListener('click', () => renderDetail(state.input.value))
    container.querySelector('.form-action-row .btn-secondary')?.addEventListener('click', () => renderDetail(state.input.value))

    const outputBody = state.output.closest('.tool-section')?.querySelector(':scope > .tool-section-body')
    outputBody?.append(detailTitle, detailHost)

    mode.setValue('detect')
    syncLabels()
    refresh()
  }
}
